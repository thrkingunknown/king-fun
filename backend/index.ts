import { Elysia } from 'elysia'
import { generateWithProvider, type ProviderEnv } from './providers/generate.ts'
import { isNearDuplicateGeneratedText, validateGenerateInput } from './content/schema.ts'
import { readBoundedText } from './security/body.ts'
import { parseAllowedOrigins } from './security/origins.ts'
import { acquireGenerationSlotForAddress, allowCreatorUnlockAttempt, getClientAddress, hasSharedLimiterConfiguration, isSharedLimiterReady } from './security/limits.ts'
import { SafeProviderError, type ProviderId } from './types.ts'
import { hasControlCharacters } from './security/strings.ts'
import { acquireContentGenerationLock, allowContentFeedback, isContentVaultConfigured, readContentPool, releaseContentGenerationLock, setContentModerationStatus, submitContentVote, writeContentPool, listContentModerationQueue, getBlockedContentIds } from './content/vault.ts'
import { constantTimeTokenDigest, isCreatorUnlockConfigured, issueCreatorToken, verifyCreatorToken } from './security/creator.ts'
import { createHash } from 'node:crypto'

const env = process.env as NodeJS.ProcessEnv & ProviderEnv
const inferredVercelOrigins = [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL]
  .filter((value): value is string => Boolean(value?.trim()))
  .map(value => `https://${value.trim().replace(/^https?:\/\//, '')}`)
const allowedOrigins = parseAllowedOrigins(env.FRONTEND_ORIGINS, env.NODE_ENV === 'production', [...inferredVercelOrigins, 'http://tauri.localhost'])
const allowedProviders = new Set<ProviderId>(['gemini', 'groq', 'cloudflare-workers-ai'])
const maxBodyBytes = 12_000
const feedbackBodyBytes = 2_000
const creatorUnlockAttempts = new Map<string, { count: number; resetAt: number }>()

function securityHeaders(origin?: string): HeadersInit {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, private',
    'pragma': 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'permissions-policy': 'camera=(), microphone=(self), geolocation=()',
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
    ...(env.NODE_ENV === 'production' ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {}),
  }
}

function safeJson(status: number, body: unknown, origin?: string): Response {
  return new Response(JSON.stringify(body), { status, headers: securityHeaders(origin) })
}

function rejectOrigin(origin: string | null): boolean {
  return origin !== null && !allowedOrigins.has(origin)
}

function errorResponse(error: unknown, origin?: string): Response {
  const safe = error instanceof SafeProviderError
    ? error
    : new SafeProviderError('INTERNAL_ERROR', 'Generation could not be completed.', true, 500)
  return safeJson(safe.status, { error: { code: safe.code, message: safe.message, retryable: safe.retryable } }, origin)
}

const supportedTasks = [
  'imposter:word', 'imposter:category',
  'guessup:charade',
  'truth-or-dare:truth', 'truth-or-dare:dare',
  'never-have-i-ever:statement',
  'fake-it:party-prompt', 'fake-story:party-prompt', 'fact-or-fiction:party-prompt', 'wrong-answers-only:party-prompt',
  'hot-bomb:party-prompt', 'hot-bomb-duel:party-prompt', 'whos-most-likely:party-prompt', 'would-you-rather:party-prompt',
  'share-or-pass:party-prompt', 'challenge-20:party-prompt', 'tilt-it:party-prompt', 'letterburg:party-prompt',
  'discussion-starter:party-prompt', 'who-am-i:party-prompt', 'ten-tangle:party-prompt',
  'qupid:party-prompt', 'questions-for-love:party-prompt', 'a-or-b:party-prompt', 'reverse-singing:party-prompt',
]

type GenerationProgress = {
  stage: 'gateway-accepted' | 'vault-checking' | 'vault-hit' | 'vault-miss' | 'vault-waiting' | 'vault-busy' | 'vault-unavailable' | 'vault-skipped' | 'provider-starting' | 'provider-waiting' | 'provider-generated' | 'provider-failed' | 'vault-saving' | 'vault-saved' | 'vault-save-failed' | 'content-ready'
  provider?: ProviderId
  detail?: string
}
type GenerationProgressReporter = (event: GenerationProgress) => void
type GenerationStreamFrame =
  | ({ type: 'progress' } & GenerationProgress)
  | { type: 'result'; status: number; body: unknown }

function providerLabel(provider: ProviderId): string {
  return provider === 'cloudflare-workers-ai' ? 'Cloudflare Workers AI' : provider === 'gemini' ? 'Gemini' : 'Groq'
}

async function handleContentGenerateRequest(
  request: Request,
  report: GenerationProgressReporter = () => undefined,
  signal: AbortSignal = request.signal,
): Promise<Response> {
  const origin = request.headers.get('origin') ?? undefined
  let slot: Awaited<ReturnType<typeof acquireGenerationSlotForAddress>> | undefined
  let contentLock: string | null = null
  let contentLockInput: ReturnType<typeof validateGenerateInput> | undefined
  let activeProvider: ProviderId | undefined
  let providerGenerationStarted = false
  report({ stage: 'gateway-accepted' })

  try {
    if (env.NODE_ENV === 'production') {
      const protocol = new URL(request.url).protocol
      const forwardedProtocol = request.headers.get('x-forwarded-proto')
      if (protocol !== 'https:' && forwardedProtocol !== 'https') throw new SafeProviderError('INVALID_REQUEST', 'HTTPS is required for production generation.', false, 400)
      if (!origin || !allowedOrigins.has(origin)) throw new SafeProviderError('ORIGIN_NOT_ALLOWED', 'This origin is not allowed.', false, 403)
    }
    if (rejectOrigin(origin ?? null)) throw new SafeProviderError('ORIGIN_NOT_ALLOWED', 'This origin is not allowed.', false, 403)
    if ((request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      throw new SafeProviderError('INVALID_REQUEST', 'Content-Type must be application/json.', false, 415)
    }

    const providerHeader = request.headers.get('x-provider-id')
    if (!providerHeader || !allowedProviders.has(providerHeader as ProviderId)) throw new SafeProviderError('INVALID_REQUEST', 'Unsupported provider.', false, 400)
    const provider = providerHeader as ProviderId
    activeProvider = provider
    const liveProviderTest = request.headers.get('x-provider-test') === 'true'
    const sessionKey = request.headers.get('x-provider-key')?.trim() || undefined
    const rawBody = await readBoundedText(request, maxBodyBytes)
    let parsedBody: unknown
    try { parsedBody = JSON.parse(rawBody) }
    catch { throw new SafeProviderError('INVALID_REQUEST', 'Request body must be valid JSON.', false, 400) }
    const input = validateGenerateInput(parsedBody)
    if (input.suitability === 'adult' && input.adultMode !== true) throw new SafeProviderError('INVALID_REQUEST', 'Adult content requests require explicit 18+ mode.', false, 400)
    contentLockInput = input
    let generationInput = input

    // Cache-first: a full, already validated content pool avoids provider calls and quota consumption.
    if (!liveProviderTest && isContentVaultConfigured(env)) {
      report({ stage: 'vault-checking', detail: 'Searching the shared content vault for an approved matching batch.' })
      try {
        let pool = await readContentPool(env, input)
        const findAvailable = (items: typeof pool) => {
          const selected: typeof pool = []
          for (const item of items) {
            if (input.recentItems.some(recent => isNearDuplicateGeneratedText(recent, item.text))) continue
            if (selected.some(previous => isNearDuplicateGeneratedText(previous.text, item.text))) continue
            selected.push(item)
          }
          return selected
        }
        let available = findAvailable(pool)
        if (available.length < input.count) {
          contentLock = await acquireContentGenerationLock(env, input)
          if (!contentLock) {
            report({ stage: 'vault-waiting', detail: 'Another request is filling this content pool; waiting for its result.' })
            for (let attempt = 0; attempt < 6 && available.length < input.count; attempt += 1) {
              await new Promise(resolve => setTimeout(resolve, 250))
              pool = await readContentPool(env, input)
              available = findAvailable(pool)
            }
            if (available.length < input.count) {
              report({ stage: 'vault-busy', detail: 'The shared content pool is still being generated elsewhere.' })
              return safeJson(503, { error: { code: 'GENERATION_IN_PROGRESS', message: 'This content pool is already being generated. Retry shortly.', retryable: true } }, origin)
            }
          }
        }
        if (available.length >= input.count) {
          report({ stage: 'vault-hit', detail: 'A matching approved content batch was found. No provider request was needed.' })
          return safeJson(200, { requestId: input.requestId, provider: 'content-vault', items: available.slice(0, input.count), cacheHit: true }, origin)
        }
        report({ stage: 'vault-miss', detail: 'No complete matching batch was available; proceeding to the selected provider.' })
        if (pool.length) generationInput = { ...input, recentItems: [...new Set([...input.recentItems, ...pool.map(item => item.text)])].slice(-30) }
      } catch {
        report({ stage: 'vault-unavailable', detail: 'The content vault could not be checked; continuing to the provider.' })
        // Redis is an optimization; live generation and offline play remain available.
      }
    } else if (!liveProviderTest) {
      report({ stage: 'vault-skipped', detail: 'No shared content vault is configured; continuing to the provider.' })
    }

    if (env.AI_ENABLED !== 'true') throw new SafeProviderError('BUDGET_EXHAUSTED', 'AI generation is disabled by the operator.', false, 503)
    if (provider === 'cloudflare-workers-ai' && sessionKey) throw new SafeProviderError('INVALID_REQUEST', 'Cloudflare credentials are operator-managed and cannot be supplied by clients.', false, 400)
    if (provider !== 'cloudflare-workers-ai' && (!sessionKey || sessionKey.length < 20 || sessionKey.length > 256 || hasControlCharacters(sessionKey))) {
      throw new SafeProviderError('PROVIDER_NOT_CONFIGURED', 'A valid session provider key is required.', false, 400)
    }
    slot = await acquireGenerationSlotForAddress(env, getClientAddress(request), provider)
    if (!slot.ok) {
      const message = slot.reason === 'rate'
        ? 'Too many generation requests. Try again shortly.'
        : slot.reason === 'daily'
          ? 'The gateway daily generation budget has been reached.'
          : slot.reason === 'provider-daily'
            ? 'This provider has reached its daily generation budget.'
            : slot.reason === 'configuration'
              ? 'Production generation is disabled until a shared rate-limit and budget store is configured.'
              : slot.reason === 'storage'
                ? 'The shared abuse-control service is temporarily unavailable.'
                : 'The generation service is busy. Try again shortly.'
      const code = slot.reason === 'rate' ? 'RATE_LIMITED' : slot.reason === 'storage' ? 'PROVIDER_UNAVAILABLE' : 'BUDGET_EXHAUSTED'
      const status = slot.reason === 'rate' ? 429 : 503
      throw new SafeProviderError(code, message, slot.reason === 'rate' || slot.reason === 'storage', status)
    }

    providerGenerationStarted = true
    report({ stage: 'provider-starting', provider, detail: `Generating with ${providerLabel(provider)}.` })
    // Keep the NDJSON stream alive while the upstream provider is thinking.
    // Android WebView/mobile networks can drop an otherwise healthy request if
    // no response bytes arrive for long enough; Cloudflare Workers AI can take
    // longer than Gemini/Groq for the same gateway flow.
    const heartbeat = setInterval(() => {
      report({ stage: 'provider-waiting', provider, detail: 'Waiting for the provider response.' })
    }, 5_000)
    let items
    try {
      items = await generateWithProvider(provider, generationInput, env, sessionKey, signal)
    } finally {
      clearInterval(heartbeat)
    }
    report({ stage: 'provider-generated', provider, detail: 'Provider output passed server validation.' })
    if (!liveProviderTest && isContentVaultConfigured(env)) {
      report({ stage: 'vault-saving', detail: 'Saving the validated batch to the configured shared content vault.' })
      try {
        await writeContentPool(env, input, items)
        report({ stage: 'vault-saved', detail: 'The validated batch was saved to the shared content vault.' })
      } catch {
        // A cache write failure must not discard valid generated content for this session.
        report({ stage: 'vault-save-failed', detail: 'The content vault could not save this batch. The validated content will still be used for this session.' })
      }
    }
    report({ stage: 'content-ready', provider, detail: 'Validated content is ready for the game.' })
    return safeJson(200, { requestId: input.requestId, provider, items, cacheHit: false }, origin)
  } catch (error) {
    if (providerGenerationStarted && activeProvider) {
      const detail = error instanceof SafeProviderError ? error.message : 'The provider request failed.'
      report({ stage: 'provider-failed', provider: activeProvider, detail })
    }
    return errorResponse(error, origin)
  } finally {
    if (contentLock) await releaseContentGenerationLock(env, contentLockInput!, contentLock).catch(() => undefined)
    if (slot?.ok) await slot.release()
  }
}

function contentGenerationProgressResponse(request: Request): Response {
  const origin = request.headers.get('origin') ?? undefined
  const abortController = new AbortController()
  const encoder = new TextEncoder()
  const headers = new Headers(securityHeaders(origin))
  headers.set('content-type', 'application/x-ndjson; charset=utf-8')
  headers.set('cache-control', 'no-store, private, no-transform')
  headers.set('x-accel-buffering', 'no')

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let cancelled = false
      const send = (frame: GenerationStreamFrame) => {
        if (cancelled) return
        try { controller.enqueue(encoder.encode(`${JSON.stringify(frame)}\n`)) }
        catch { cancelled = true }
      }
      const report: GenerationProgressReporter = event => send({ type: 'progress', ...event })
      const abortFromRequest = () => abortController.abort(request.signal.reason)
      if (request.signal.aborted) abortController.abort(request.signal.reason)
      else request.signal.addEventListener('abort', abortFromRequest, { once: true })

      void handleContentGenerateRequest(request, report, abortController.signal)
        .then(async response => {
          let body: unknown
          try { body = await response.json() }
          catch { body = { error: { code: 'INVALID_RESPONSE', message: 'The gateway returned an unreadable response.', retryable: true } } }
          send({ type: 'result', status: response.status, body })
        })
        .catch(() => send({ type: 'result', status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Generation could not be completed.', retryable: true } } }))
        .finally(() => {
          request.signal.removeEventListener('abort', abortFromRequest)
          if (!cancelled) { try { controller.close() } catch { /* Already closed. */ } }
        })
    },
    cancel(reason) {
      abortController.abort(reason)
    },
  })
  return new Response(stream, { status: 200, headers })
}

export const app = new Elysia({ name: 'king-fun-api' })
  .onRequest(({ request, set }) => {
    const origin = request.headers.get('origin')
    if (rejectOrigin(origin)) {
      set.status = 403
      return safeJson(403, { error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This origin is not allowed.', retryable: false } })
    }
    for (const [key, value] of Object.entries(securityHeaders(origin ?? undefined))) set.headers[key] = value
  })
  .options('/*', ({ request }) => {
    const origin = request.headers.get('origin')
    if (!origin || rejectOrigin(origin)) return new Response(null, { status: 403, headers: securityHeaders() })
    return new Response(null, { status: 204, headers: {
      ...securityHeaders(origin),
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-provider-key,x-provider-id,x-provider-test,authorization',
      'access-control-max-age': '600',
    } })
  })
  .get('/healthz', () => safeJson(200, { status: 'ok' }))
  .get('/v1/status', async () => {
    const enabled = env.AI_ENABLED === 'true'
    const cloudflareReady = Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN)
    const limiterConfigured = hasSharedLimiterConfiguration(env)
    const limiterReady = env.NODE_ENV !== 'production' || (limiterConfigured && await isSharedLimiterReady(env))
    const status = !enabled || !limiterReady ? 'unavailable' : cloudflareReady ? 'available' : 'degraded'
    return safeJson(200, { status, tasks: supportedTasks, cloudflareReady, contentVault: isContentVaultConfigured(env), creatorUnlock: isCreatorUnlockConfigured(env) })
  })
  .post('/v1/creator/unlock', async ({ request }) => {
    const origin = request.headers.get('origin') ?? undefined
    if (env.NODE_ENV === 'production' && new URL(request.url).protocol !== 'https:' && request.headers.get('x-forwarded-proto') !== 'https') return safeJson(400, { error: { code: 'INVALID_REQUEST', message: 'HTTPS is required for creator access.', retryable: false } }, origin)
    if (!isCreatorUnlockConfigured(env)) return safeJson(503, { error: { code: 'CREATOR_UNLOCK_UNAVAILABLE', message: 'Creator access is not configured.', retryable: false } }, origin)
    const address = createHash('sha256').update(getClientAddress(request) || 'unknown').digest('hex')
    const now = Date.now()
    if (creatorUnlockAttempts.size > 5_000) for (const [key, value] of creatorUnlockAttempts) if (value.resetAt <= now) creatorUnlockAttempts.delete(key)
    const sharedAttemptAllowed = await allowCreatorUnlockAttempt(env, getClientAddress(request))
    if (!sharedAttemptAllowed) return safeJson(429, { error: { code: 'RATE_LIMITED', message: 'Too many unlock attempts. Try again later.', retryable: false } }, origin)
    if (!hasSharedLimiterConfiguration(env)) {
      const bucket = creatorUnlockAttempts.get(address)
      if (bucket && bucket.resetAt > now && bucket.count >= 5) return safeJson(429, { error: { code: 'RATE_LIMITED', message: 'Too many unlock attempts. Try again later.', retryable: false } }, origin)
      if (!bucket || bucket.resetAt <= now) creatorUnlockAttempts.set(address, { count: 1, resetAt: now + 15 * 60_000 })
      else bucket.count += 1
    }
    try {
      if ((request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() !== 'application/json') return safeJson(415, { error: { code: 'INVALID_REQUEST', message: 'Content-Type must be application/json.', retryable: false } }, origin)
      const raw = await readBoundedText(request, feedbackBodyBytes)
      const body = JSON.parse(raw) as Record<string, unknown>
      if (Object.keys(body).length !== 1 || typeof body.secret !== 'string' || body.secret.length < 1 || body.secret.length > 256 || hasControlCharacters(body.secret)) return safeJson(400, { error: { code: 'INVALID_REQUEST', message: 'Invalid creator credentials.', retryable: false } }, origin)
      const token = issueCreatorToken(env, body.secret)
      if (!token) return safeJson(403, { error: { code: 'CREATOR_ACCESS_DENIED', message: 'Creator credentials were not accepted.', retryable: false } }, origin)
      return safeJson(200, { token, expiresIn: 2_592_000 }, origin)
    } catch { return safeJson(400, { error: { code: 'INVALID_REQUEST', message: 'Invalid creator unlock request.', retryable: false } }, origin) }
  })
  .get('/v1/creator/verify', ({ request }) => {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
    return safeJson(200, { valid: verifyCreatorToken(env, token) }, request.headers.get('origin') ?? undefined)
  })
  .post('/v1/content/feedback', async ({ request }) => {
    const origin = request.headers.get('origin') ?? undefined
    try {
      if ((request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() !== 'application/json') return safeJson(415, { error: { code: 'INVALID_REQUEST', message: 'Content-Type must be application/json.', retryable: false } }, origin)
      const raw = await readBoundedText(request, feedbackBodyBytes)
      const body = JSON.parse(raw) as Record<string, unknown>
      if (Object.keys(body).some(key => !['contentId', 'vote', 'voterId', 'text', 'game', 'kind'].includes(key)) || typeof body.contentId !== 'string' || !/^[a-zA-Z0-9:_-]{1,128}$/.test(body.contentId) || !['up', 'down'].includes(String(body.vote)) || typeof body.voterId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.voterId) || (body.text !== undefined && (typeof body.text !== 'string' || body.text.trim().length < 1 || body.text.length > 260)) || (body.game !== undefined && (typeof body.game !== 'string' || !/^[a-z0-9-]{2,40}$/.test(body.game))) || (body.kind !== undefined && (typeof body.kind !== 'string' || !/^[a-z0-9-]{2,40}$/.test(body.kind)))) return safeJson(400, { error: { code: 'INVALID_REQUEST', message: 'Invalid content feedback.', retryable: false } }, origin)
      if (!isContentVaultConfigured(env)) return safeJson(503, { error: { code: 'CONTENT_VAULT_UNAVAILABLE', message: 'Community feedback is temporarily unavailable.', retryable: true } }, origin)
      if (!await allowContentFeedback(env, getClientAddress(request))) return safeJson(429, { error: { code: 'RATE_LIMITED', message: 'Too many feedback requests. Try again later.', retryable: false } }, origin)
      const address = getClientAddress(request)
      const voteSecret = env.CONTENT_VAULT_REST_TOKEN ?? env.AI_LIMITER_REST_TOKEN
      const voterHash = constantTimeTokenDigest(`${address}|${body.voterId}`, voteSecret)
      const networkHash = constantTimeTokenDigest(address || 'unknown', voteSecret)
      const result = await submitContentVote(env, body.contentId, voterHash, body.vote as 'up' | 'down', networkHash, typeof body.text === 'string' && typeof body.game === 'string' && typeof body.kind === 'string' ? { text: body.text, game: body.game, kind: body.kind } : undefined)
      return safeJson(200, { accepted: true, ...result }, origin)
    } catch { return safeJson(503, { error: { code: 'CONTENT_VAULT_UNAVAILABLE', message: 'Community feedback could not be saved.', retryable: true } }, origin) }
  })
  .post('/v1/content/status', async ({ request }) => {
    const origin = request.headers.get('origin') ?? undefined
    try {
      const raw = await readBoundedText(request, 48_000)
      const body = JSON.parse(raw) as Record<string, unknown>
      if (Object.keys(body).length !== 1 || !Array.isArray(body.ids) || body.ids.length > 300 || body.ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9:_-]{1,128}$/.test(id))) return safeJson(400, { error: { code: 'INVALID_REQUEST', message: 'Invalid content status query.', retryable: false } }, origin)
      const blocked = await getBlockedContentIds(env, body.ids as string[])
      return safeJson(200, { blocked }, origin)
    } catch { return safeJson(503, { error: { code: 'CONTENT_VAULT_UNAVAILABLE', message: 'Content status is temporarily unavailable.', retryable: true } }, origin) }
  })
  .get('/v1/content/moderation-queue', async ({ request }) => {
    const origin = request.headers.get('origin') ?? undefined
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
    if (!verifyCreatorToken(env, token)) return safeJson(403, { error: { code: 'CREATOR_ACCESS_DENIED', message: 'Creator access is required.', retryable: false } }, origin)
    try { return safeJson(200, { items: await listContentModerationQueue(env) }, origin) }
    catch { return safeJson(503, { error: { code: 'CONTENT_VAULT_UNAVAILABLE', message: 'Moderation queue is temporarily unavailable.', retryable: true } }, origin) }
  })
  .post('/v1/content/moderate', async ({ request }) => {
    const origin = request.headers.get('origin') ?? undefined
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
    if (!verifyCreatorToken(env, token)) return safeJson(403, { error: { code: 'CREATOR_ACCESS_DENIED', message: 'Creator access is required.', retryable: false } }, origin)
    try {
      const raw = await readBoundedText(request, feedbackBodyBytes)
      const body = JSON.parse(raw) as Record<string, unknown>
      if (Object.keys(body).some(key => !['contentId', 'status'].includes(key)) || typeof body.contentId !== 'string' || !/^[a-zA-Z0-9:_-]{1,128}$/.test(body.contentId) || !['approved', 'quarantined', 'rejected', 'retired'].includes(String(body.status))) return safeJson(400, { error: { code: 'INVALID_REQUEST', message: 'Invalid moderation request.', retryable: false } }, origin)
      const saved = await setContentModerationStatus(env, body.contentId, body.status as 'approved' | 'quarantined' | 'rejected' | 'retired')
      return safeJson(saved ? 200 : 503, { saved }, origin)
    } catch { return safeJson(400, { error: { code: 'INVALID_REQUEST', message: 'Invalid moderation request.', retryable: false } }, origin) }
  })
  .post('/v1/content/generate', async ({ request }) => {
    if (request.headers.get('accept')?.includes('application/x-ndjson')) return contentGenerationProgressResponse(request)
    return handleContentGenerateRequest(request)
  })

/** Vercel's root-level catch-all receives /api/...; strip only this fixed prefix. */
export const handle = (request: Request): Promise<Response> => {
  const url = new URL(request.url)
  if (url.pathname === '/api') url.pathname = '/'
  else if (url.pathname.startsWith('/api/')) url.pathname = url.pathname.slice(4)
  return app.handle(new Request(url, request))
}
