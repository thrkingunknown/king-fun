import { createHash, randomUUID } from 'node:crypto'
import type { GenerateInput, GeneratedItem } from '../types.ts'
import { canonicalizeGeneratedText } from './schema.ts'

type VaultEnv = NodeJS.ProcessEnv & {
  CONTENT_VAULT_REST_URL?: string
  CONTENT_VAULT_REST_TOKEN?: string
  CONTENT_VAULT_KEY_PREFIX?: string
  CONTENT_VAULT_TTL_SECONDS?: string
}

const DEFAULT_PREFIX = 'king-fun:content:v1'
const MAX_POOL_ITEMS = 100
const FEEDBACK_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1])) end
return count
`
const DEDUPE_SCRIPT = `
local accepted = {}
for i = 1, #KEYS do
  local owner = redis.call('GET', KEYS[i])
  local id = ARGV[(i - 1) * 2 + 1]
  local ttl = tonumber(ARGV[(i - 1) * 2 + 2])
  if not owner then redis.call('SET', KEYS[i], id, 'EX', ttl); accepted[i] = 1
  elseif owner == id then redis.call('EXPIRE', KEYS[i], ttl); accepted[i] = 1
  else accepted[i] = 0 end
end
return accepted
`
const VOTE_SCRIPT = `
local old = redis.call('HGET', KEYS[1], ARGV[1])
local next = ARGV[2]
if ARGV[5] ~= '' then redis.call('SET', KEYS[5], ARGV[5], 'NX', 'EX', 31536000) end
if old == next then
  return {0, tonumber(redis.call('HGET', KEYS[2], 'score') or '0'), tonumber(redis.call('HGET', KEYS[2], 'down') or '0'), redis.call('GET', KEYS[3]) or 'approved', redis.call('SCARD', KEYS[7])}
end
if old == 'up' then redis.call('HINCRBY', KEYS[2], 'score', -1) end
if old == 'down' then redis.call('HINCRBY', KEYS[2], 'score', 1); redis.call('HINCRBY', KEYS[2], 'down', -1) end
if next == 'up' then redis.call('HINCRBY', KEYS[2], 'score', 1) end
if next == 'down' then redis.call('HINCRBY', KEYS[2], 'score', -1); redis.call('HINCRBY', KEYS[2], 'down', 1) end
redis.call('HSET', KEYS[1], ARGV[1], next)
-- Auto-quarantine requires distinct network addresses, not merely client IDs.
-- A browser can mint unlimited local voter IDs, so installation IDs alone are
-- not meaningful evidence of independent community reports.
local oldNetworkVote = redis.call('HGET', KEYS[6], ARGV[6])
if oldNetworkVote == 'down' then redis.call('SREM', KEYS[7], ARGV[6]) end
redis.call('HSET', KEYS[6], ARGV[6], next)
if next == 'down' then redis.call('SADD', KEYS[7], ARGV[6]) end
redis.call('EXPIRE', KEYS[1], 31536000)
redis.call('EXPIRE', KEYS[2], 31536000)
redis.call('EXPIRE', KEYS[6], 31536000)
redis.call('EXPIRE', KEYS[7], 31536000)
local down = tonumber(redis.call('HGET', KEYS[2], 'down') or '0')
local score = tonumber(redis.call('HGET', KEYS[2], 'score') or '0')
local uniqueDownNetworks = redis.call('SCARD', KEYS[7])
if uniqueDownNetworks >= tonumber(ARGV[3]) then redis.call('SET', KEYS[3], 'quarantined'); redis.call('SADD', KEYS[4], ARGV[4]); redis.call('EXPIRE', KEYS[4], 63072000) end
return {1, score, down, redis.call('GET', KEYS[3]) or 'approved', uniqueDownNetworks}
`

function config(env: VaultEnv) {
  const url = env.CONTENT_VAULT_REST_URL?.trim().replace(/\/$/, '')
  const token = env.CONTENT_VAULT_REST_TOKEN?.trim()
  if (!url || !token) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null
    return { url, token, prefix: env.CONTENT_VAULT_KEY_PREFIX?.trim().replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 48) || DEFAULT_PREFIX }
  } catch { return null }
}

async function command<T>(env: VaultEnv, args: readonly (string | number)[]): Promise<T | null> {
  const selected = config(env)
  if (!selected) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2_000)
  try {
    const response = await fetch(selected.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${selected.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args), cache: 'no-store', redirect: 'error', signal: controller.signal,
    })
    if (!response.ok) throw new Error('Content vault request failed.')
    const payload = await response.json() as { result?: T; error?: unknown }
    if (payload.error) throw new Error('Content vault command failed.')
    return payload.result ?? null
  } finally { clearTimeout(timeout) }
}

async function pipeline(env: VaultEnv, commands: readonly (readonly (string | number)[])[]): Promise<unknown[]> {
  const selected = config(env)
  if (!selected || commands.length === 0) return []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3_000)
  try {
    const response = await fetch(`${selected.url}/pipeline`, {
      method: 'POST', headers: { authorization: `Bearer ${selected.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(commands), cache: 'no-store', redirect: 'error', signal: controller.signal,
    })
    if (!response.ok) throw new Error('Content vault pipeline failed.')
    const payload = await response.json() as Array<{ result?: unknown; error?: unknown }>
    if (!Array.isArray(payload) || payload.some(row => row.error)) throw new Error('Content vault pipeline command failed.')
    return payload.map(row => row.result)
  } finally { clearTimeout(timeout) }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function poolKey(env: VaultEnv, input: GenerateInput): string {
  const selected = config(env)
  const identity = [input.game, input.itemKind, input.categoryId, input.locale, input.suitability].join('|')
  return `${selected?.prefix ?? DEFAULT_PREFIX}:pool:${digest(identity)}`
}

function isGeneratedItem(value: unknown): value is GeneratedItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && /^[a-f0-9]{24}$/.test(item.id)
    && typeof item.text === 'string' && item.text.length > 0 && item.text.length <= 260
    && typeof item.categoryId === 'string' && typeof item.kind === 'string' && typeof item.locale === 'string'
    && (item.hints === undefined || (Array.isArray(item.hints) && item.hints.length <= 20 && item.hints.every(hint => typeof hint === 'string')))
}

export function isContentVaultConfigured(env: NodeJS.ProcessEnv): boolean {
  return config(env as VaultEnv) !== null
}

export async function readContentPool(env: NodeJS.ProcessEnv, input: GenerateInput): Promise<GeneratedItem[]> {
  const raw = await command<string>(env as VaultEnv, ['GET', poolKey(env as VaultEnv, input)])
  if (!raw || typeof raw !== 'string') return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const items = parsed.filter(isGeneratedItem)
    if (!items.length) return []
    const selected = config(env as VaultEnv)
    if (!selected) return items
    const keys = items.map(item => `${selected.prefix}:item:${digest(item.id)}:status`)
    const statuses = await command<unknown>(env as VaultEnv, ['MGET', ...keys])
    // Moderation is a safety boundary: if status cannot be read for every item,
    // do not serve the pool. Missing status records are not assumed approved.
    if (!Array.isArray(statuses) || statuses.length !== items.length) return []
    return items.filter((item, index) => statuses[index] === 'approved')
  } catch { return [] }
}

export async function writeContentPool(env: NodeJS.ProcessEnv, input: GenerateInput, additions: readonly GeneratedItem[]): Promise<void> {
  const selected = config(env as VaultEnv)
  if (!selected || additions.length === 0) return
  const key = poolKey(env as VaultEnv, input)
  const existing = await readContentPool(env, input).catch(() => [])
  const byId = new Map(existing.map(item => [item.id, item]))
  const ttl = Number((env as VaultEnv).CONTENT_VAULT_TTL_SECONDS)
  const expires = Number.isSafeInteger(ttl) && ttl >= 3600 ? Math.min(ttl, 60 * 60 * 24 * 365) : 60 * 60 * 24 * 90
  const dedupeKeys = additions.map(item => `${selected.prefix}:dedupe:${digest([input.game, input.itemKind, input.locale, input.suitability, canonicalizeGeneratedText(item.text)].join('|'))}`)
  const claimed = await command<unknown>(env as VaultEnv, ['EVAL', DEDUPE_SCRIPT, dedupeKeys.length, ...dedupeKeys, ...additions.flatMap(item => [item.id, expires])])
  const accepted = Array.isArray(claimed) ? claimed : []
  const retained = additions.filter((item, index) => Number(accepted[index]) === 1 || byId.has(item.id))
  for (const item of retained) byId.set(item.id, item)
  const items = [...byId.values()].slice(-MAX_POOL_ITEMS)
  const itemCommands = retained.flatMap(item => {
    const itemRoot = `${selected.prefix}:item:${digest(item.id)}`
    return [
      ['SET', `${itemRoot}:record`, JSON.stringify({ text: item.text, game: input.game, kind: input.itemKind, categoryId: item.categoryId, suitability: input.suitability }), 'EX', 60 * 60 * 24 * 365],
      ['SET', `${itemRoot}:status`, 'approved', 'NX', 'EX', 60 * 60 * 24 * 365],
    ] as const
  })
  await pipeline(env as VaultEnv, [...itemCommands, ['SET', key, JSON.stringify(items), 'EX', expires]])
}

export async function acquireContentGenerationLock(env: NodeJS.ProcessEnv, input: GenerateInput): Promise<string | null> {
  if (!config(env as VaultEnv)) return null
  const key = `${poolKey(env as VaultEnv, input)}:lock`
  const token = randomUUID()
  const result = await command<string>(env as VaultEnv, ['SET', key, token, 'NX', 'EX', 45])
  return result === 'OK' ? token : null
}

export async function releaseContentGenerationLock(env: NodeJS.ProcessEnv, input: GenerateInput, token: string): Promise<void> {
  const key = `${poolKey(env as VaultEnv, input)}:lock`
  await command(env as VaultEnv, ['EVAL', "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end", 1, key, token]).catch(() => null)
}

export async function allowContentFeedback(env: NodeJS.ProcessEnv, address: string, now = Date.now()): Promise<boolean> {
  const selected = config(env as VaultEnv)
  if (!selected) return false
  const windowSeconds = 5 * 60
  const window = Math.floor(now / (windowSeconds * 1000))
  const addressHash = digest(`${selected.token}|${address || 'unknown'}`)
  const key = `${selected.prefix}:feedback-limit:${window}:${addressHash}`
  const count = await command<unknown>(env as VaultEnv, ['EVAL', FEEDBACK_LIMIT_SCRIPT, 1, key, windowSeconds])
  return Number.isInteger(count) && Number(count) <= 30
}

export async function submitContentVote(
  env: NodeJS.ProcessEnv,
  contentId: string,
  voterHash: string,
  vote: 'up' | 'down',
  networkHash: string,
  metadata?: { text: string; game: string; kind: string },
): Promise<{ changed: boolean; score: number; downVotes: number; uniqueDownNetworks: number; status: string } | null> {
  const selected = config(env as VaultEnv)
  if (!selected) return null
  const root = `${selected.prefix}:item:${digest(contentId)}`
  const metadataJson = metadata ? JSON.stringify(metadata) : ''
  if (!/^[a-f0-9]{64}$/i.test(networkHash)) throw new TypeError('Invalid network vote digest.')
  const result = await command<unknown>(env as VaultEnv, ['EVAL', VOTE_SCRIPT, 7, `${root}:votes`, `${root}:quality`, `${root}:status`, `${selected.prefix}:moderation:queue`, `${root}:record`, `${root}:network-votes`, `${root}:down-networks`, voterHash, vote, 3, contentId, metadataJson, networkHash])
  if (!Array.isArray(result) || result.length < 5) throw new Error('Content feedback response was invalid.')
  return { changed: Number(result[0]) === 1, score: Number(result[1]) || 0, downVotes: Number(result[2]) || 0, status: String(result[3] ?? 'approved'), uniqueDownNetworks: Number(result[4]) || 0 }
}

export async function setContentModerationStatus(
  env: NodeJS.ProcessEnv,
  contentId: string,
  status: 'approved' | 'quarantined' | 'rejected' | 'retired',
): Promise<boolean> {
  const selected = config(env as VaultEnv)
  if (!selected) return false
  const root = `${selected.prefix}:item:${digest(contentId)}`
  await command(env as VaultEnv, ['SET', `${root}:status`, status])
  if (status === 'quarantined') await command(env as VaultEnv, ['SADD', `${selected.prefix}:moderation:queue`, contentId])
  else await command(env as VaultEnv, ['SREM', `${selected.prefix}:moderation:queue`, contentId])
  return true
}


type ModerationRecord = { text: string; game?: string; kind?: string; categoryId?: string }

export async function listContentModerationQueue(env: NodeJS.ProcessEnv): Promise<Array<{ contentId: string; item: ModerationRecord | null; status: string; score: number; downVotes: number }>> {
  const selected = config(env as VaultEnv)
  if (!selected) return []
  const ids = await command<unknown>(env as VaultEnv, ['SMEMBERS', `${selected.prefix}:moderation:queue`])
  if (!Array.isArray(ids)) return []
  const safeIds = ids.filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(id)).slice(0, 100)
  if (!safeIds.length) return []
  const keys = safeIds.flatMap(id => { const root = `${selected.prefix}:item:${digest(id)}`; return [`${root}:record`, `${root}:status`] })
  const values = await command<unknown>(env as VaultEnv, ['MGET', ...keys])
  if (!Array.isArray(values)) return []
  const qualityCommands = safeIds.map(contentId => {
    const root = `${selected.prefix}:item:${digest(contentId)}`
    return ['HMGET', `${root}:quality`, 'score', 'down']
  })
  const qualityRows = await pipeline(env as VaultEnv, qualityCommands)
  const rows = safeIds.map((contentId, index) => {
    const recordValue = values[index * 2]
    const statusValue = values[index * 2 + 1]
    let item: ModerationRecord | null = null
    if (typeof recordValue === 'string') { try { const parsed: unknown = JSON.parse(recordValue); if (parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>).text === 'string') item = parsed as ModerationRecord } catch { /* malformed historical record */ } }
    const qualityValues = Array.isArray(qualityRows[index]) ? qualityRows[index] as unknown[] : []
    return { contentId, item, status: typeof statusValue === 'string' ? statusValue : 'quarantined', score: Number(qualityValues[0]) || 0, downVotes: Number(qualityValues[1]) || 0 }
  })
  return rows.filter(row => row.status === 'quarantined')
}


export async function getBlockedContentIds(env: NodeJS.ProcessEnv, ids: readonly string[]): Promise<string[]> {
  const selected = config(env as VaultEnv)
  if (!selected || ids.length === 0) return []
  const unique = [...new Set(ids)].slice(0, 300)
  const keys = unique.map(id => `${selected.prefix}:item:${digest(id)}:status`)
  const statuses = await command<unknown>(env as VaultEnv, ['MGET', ...keys])
  if (!Array.isArray(statuses)) return []
  return unique.filter((_, index) => ['quarantined', 'rejected', 'retired'].includes(String(statuses[index] ?? '')))
}
