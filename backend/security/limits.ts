import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'

const WINDOW_SECONDS = 60
const INSTANCE_SALT = randomBytes(32).toString('hex')
type Counter = { count: number; resetAt: number }
let dailyCounter: Counter = { count: 0, resetAt: utcDayReset(Date.now()) }
const minuteCounters = new Map<string, Counter>()
let activeRequests = 0

export type LimitedProvider = 'gemini' | 'groq' | 'cloudflare-workers-ai'
export type LimitResult =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; reason: 'rate' | 'daily' | 'provider-daily' | 'concurrency' | 'configuration' | 'storage' }

const ACQUIRE_SCRIPT = `
-- Use Redis time so serverless clock skew cannot expire another instance's lease.
local redisTime = redis.call('TIME')
local nowMs = (tonumber(redisTime[1]) * 1000) + math.floor(tonumber(redisTime[2]) / 1000)
-- Prune only expired leases; each in-flight request owns an independent ZSET member.
redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', nowMs)
if redis.call('ZCARD', KEYS[4]) >= tonumber(ARGV[3]) then return 3 end

-- Check all quota counters before mutating any of them. Rejected requests must not
-- consume daily/provider quota or advance a minute counter.
if tonumber(redis.call('GET', KEYS[1]) or '0') >= tonumber(ARGV[1]) then return 1 end
if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[2]) then return 2 end
if tonumber(redis.call('GET', KEYS[3]) or '0') >= tonumber(ARGV[4]) then return 4 end

local minute = redis.call('INCR', KEYS[1])
if minute == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[5])) end
local daily = redis.call('INCR', KEYS[2])
if daily == 1 then redis.call('EXPIRE', KEYS[2], tonumber(ARGV[6])) end
local providerDaily = redis.call('INCR', KEYS[3])
if providerDaily == 1 then redis.call('EXPIRE', KEYS[3], tonumber(ARGV[6])) end

redis.call('ZADD', KEYS[4], nowMs + tonumber(ARGV[7]), ARGV[8])
redis.call('EXPIRE', KEYS[4], math.ceil(tonumber(ARGV[7]) / 1000) * 2)
return 0
`
const RELEASE_SCRIPT = `
return redis.call('ZREM', KEYS[1], ARGV[1])
`

function utcDayReset(now: number): number {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
}

function positiveInteger(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

export function hashClientAddress(address: string, stableSecret?: string): string {
  // Shared-store keys must be deterministic across serverless instances. The shared
  // limiter token is a stable HMAC key; local-only buckets use an ephemeral salt.
  return stableSecret
    ? createHmac('sha256', stableSecret).update(address).digest('hex')
    : createHash('sha256').update(INSTANCE_SALT).update(address).digest('hex')
}

function providerDailyLimit(env: NodeJS.ProcessEnv, provider: LimitedProvider, globalLimit: number): number {
  const key = provider === 'cloudflare-workers-ai'
    ? 'AI_CLOUDFLARE_DAILY_REQUEST_LIMIT'
    : provider === 'gemini' ? 'AI_GEMINI_DAILY_REQUEST_LIMIT' : 'AI_GROQ_DAILY_REQUEST_LIMIT'
  return positiveInteger(env[key], globalLimit, 100_000)
}

function sharedLimiterConfiguration(env: NodeJS.ProcessEnv): { url: string; token: string } | null {
  const url = env.AI_LIMITER_REST_URL?.trim().replace(/\/$/, '')
  const token = env.AI_LIMITER_REST_TOKEN?.trim()
  if (!url || !token) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null
    return { url, token }
  } catch { return null }
}

export function hasSharedLimiterConfiguration(env: NodeJS.ProcessEnv): boolean {
  return sharedLimiterConfiguration(env) !== null
}

export async function isSharedLimiterReady(env: NodeJS.ProcessEnv): Promise<boolean> {
  const config = sharedLimiterConfiguration(env)
  if (!config) return false
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2_500)
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
      // Prove that Lua EVAL is permitted; a PING-only check can report healthy
      // while all atomic limiter operations are forbidden by the Redis token.
      body: JSON.stringify(['EVAL', 'return 1', '0']),
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) return false
    const payload = await response.json() as { result?: unknown; error?: unknown }
    return !payload.error && payload.result === 1
  } catch { return false }
  finally { clearTimeout(timeout) }
}

async function runSharedScript(
  config: { url: string; token: string },
  script: string,
  keys: readonly string[],
  args: readonly (string | number)[],
): Promise<number> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2_500)
  try {
    const command = ['EVAL', script, String(keys.length), ...keys, ...args.map(String)]
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(command),
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error('Shared limiter request failed.')
    const payload = await response.json() as { result?: unknown; error?: unknown }
    if (payload.error || !Number.isInteger(payload.result)) throw new Error('Shared limiter returned an invalid result.')
    return Number(payload.result)
  } finally { clearTimeout(timeout) }
}

function localAcquire(
  env: NodeJS.ProcessEnv,
  address: string,
  provider: LimitedProvider,
  now: number,
): LimitResult {
  const minuteLimit = positiveInteger(env.AI_RATE_LIMIT_PER_MINUTE, 12, 120)
  const dailyLimit = positiveInteger(env.AI_DAILY_REQUEST_LIMIT, 250, 100_000)
  const providerLimit = providerDailyLimit(env, provider, dailyLimit)
  const concurrencyLimit = positiveInteger(env.AI_MAX_CONCURRENT_REQUESTS, 4, 32)
  if (dailyCounter.resetAt <= now) dailyCounter = { count: 0, resetAt: utcDayReset(now) }

  const key = hashClientAddress(address || 'unknown')
  const current = minuteCounters.get(key)
  if (current && current.resetAt > now && current.count >= minuteLimit) return { ok: false, reason: 'rate' }
  if (dailyCounter.count >= dailyLimit) return { ok: false, reason: 'daily' }
  if (activeRequests >= concurrencyLimit) return { ok: false, reason: 'concurrency' }

  let providerCounter = localProviderCounters.get(provider)
  if (!providerCounter || providerCounter.resetAt <= now) {
    providerCounter = { count: 0, resetAt: utcDayReset(now) }
    localProviderCounters.set(provider, providerCounter)
  }
  if (providerCounter.count >= providerLimit) return { ok: false, reason: 'provider-daily' }

  if (!current || current.resetAt <= now) minuteCounters.set(key, { count: 1, resetAt: now + WINDOW_SECONDS * 1000 })
  else current.count += 1
  dailyCounter.count += 1
  providerCounter.count += 1
  activeRequests += 1
  if (minuteCounters.size > 10_000) {
    for (const [entryKey, entry] of minuteCounters) if (entry.resetAt <= now) minuteCounters.delete(entryKey)
  }
  let released = false
  return { ok: true, release: async () => { if (!released) { released = true; activeRequests = Math.max(0, activeRequests - 1) } } }
}

const localProviderCounters = new Map<LimitedProvider, Counter>()

/**
 * Uses a shared Redis-compatible REST limiter in production. The public serverless
 * deployment fails closed when it is absent; local development gets deterministic
 * per-process limits so the gateway remains usable without external infrastructure.
 */
export async function acquireGenerationSlotForAddress(
  env: NodeJS.ProcessEnv,
  address: string,
  provider: LimitedProvider,
  now = Date.now(),
): Promise<LimitResult> {
  const shared = sharedLimiterConfiguration(env)
  if (!shared && env.NODE_ENV === 'production') return { ok: false, reason: 'configuration' }
  if (!shared) return localAcquire(env, address, provider, now)

  const minuteLimit = positiveInteger(env.AI_RATE_LIMIT_PER_MINUTE, 12, 120)
  const dailyLimit = positiveInteger(env.AI_DAILY_REQUEST_LIMIT, 250, 100_000)
  const providerLimit = providerDailyLimit(env, provider, dailyLimit)
  const concurrencyLimit = positiveInteger(env.AI_MAX_CONCURRENT_REQUESTS, 4, 32)
  const minuteBucket = Math.floor(now / 60_000)
  const day = new Date(now).toISOString().slice(0, 10)
  const addressHash = hashClientAddress(address || 'unknown', shared.token)
  const prefix = env.AI_LIMITER_KEY_PREFIX?.trim().replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 48) || 'king-fun:ai:v1'
  const keys = [
    `${prefix}:minute:${minuteBucket}:${addressHash}`,
    `${prefix}:daily:${day}`,
    `${prefix}:provider:${day}:${provider}`,
    `${prefix}:active-leases`,
  ]
  const dailyTtl = Math.max(60, Math.ceil((utcDayReset(now) - now) / 1000) + 60)
  const leaseMs = 90_000
  const leaseId = randomUUID()
  let result: number
  try {
    result = await runSharedScript(shared, ACQUIRE_SCRIPT, keys, [minuteLimit, dailyLimit, concurrencyLimit, providerLimit, 60, dailyTtl, leaseMs, leaseId])
  } catch {
    return { ok: false, reason: 'storage' }
  }
  if (result !== 0) {
    const reason = result === 1 ? 'rate' : result === 2 ? 'daily' : result === 3 ? 'concurrency' : result === 4 ? 'provider-daily' : 'storage'
    return { ok: false, reason }
  }

  let released = false
  return {
    ok: true,
    release: async () => {
      if (released) return
      released = true
      // Await release while the serverless invocation is alive. If the store is
      // unavailable or the function is terminated, this request's 90-second lease
      // expires independently and cannot erase another request's active slot.
      await runSharedScript(shared, RELEASE_SCRIPT, [keys[3]!], [leaseId]).catch(() => undefined)
    },
  }
}


const CREATOR_UNLOCK_ATTEMPT_SCRIPT = `
local attempts = redis.call('INCR', KEYS[1])
if attempts == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
return attempts
`

/** Persistent creator-key brute-force control using the existing limiter database. */
export async function allowCreatorUnlockAttempt(env: NodeJS.ProcessEnv, address: string, now = Date.now()): Promise<boolean> {
  const shared = sharedLimiterConfiguration(env)
  if (!shared) return env.NODE_ENV !== 'production'
  const prefix = env.AI_LIMITER_KEY_PREFIX?.trim().replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 48) || 'king-fun:ai:v1'
  const window = Math.floor(now / (15 * 60_000))
  const addressHash = hashClientAddress(address || 'unknown', shared.token)
  try {
    const attempts = await runSharedScript(shared, CREATOR_UNLOCK_ATTEMPT_SCRIPT, [`${prefix}:creator-unlock:${window}:${addressHash}`], [900])
    return attempts <= 5
  } catch { return false }
}

export function getClientAddress(request: Request): string {
  // Only platform edge headers are accepted. Direct-origin traffic collapses into
  // a shared bucket rather than trusting arbitrary forwarded-IP headers.
  const isCloudflareEdge = request.headers.has('cf-ray')
  const isVercelEdge = request.headers.has('x-vercel-id')
  const cloudflare = isCloudflareEdge ? request.headers.get('cf-connecting-ip')?.trim() : undefined
  const vercel = isVercelEdge ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() : undefined
  return cloudflare || vercel || 'unknown'
}

export function readInstanceCounters(now = Date.now()) {
  if (dailyCounter.resetAt <= now) dailyCounter = { count: 0, resetAt: utcDayReset(now) }
  return { requestsToday: dailyCounter.count, activeRequests }
}
