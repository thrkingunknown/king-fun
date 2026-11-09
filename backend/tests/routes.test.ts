import { describe, expect, test } from 'bun:test'
import { handle } from '../index.ts'

process.env.AI_ENABLED = 'true'

describe('public API routes', () => {
  test('health endpoint exposes only liveness', async () => {
    const response = await handle(new Request('https://king-fun.test/api/healthz'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin')
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })
  test('status endpoint does not disclose secrets', async () => {
    const response = await handle(new Request('https://king-fun.test/api/v1/status'))
    const body = await response.text()
    expect(response.status).toBe(200)
    expect(body).not.toContain('CLOUDFLARE_ACCOUNT_ID')
    expect(body).not.toContain('API_TOKEN')
  })
  test('rejects disallowed origins and malformed generation requests', async () => {
    const denied = await handle(new Request('https://king-fun.test/api/v1/status', { headers: { origin: 'https://attacker.invalid' } }))
    expect(denied.status).toBe(403)
    const invalid = await handle(new Request('https://king-fun.test/api/v1/content/generate', { method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-provider-id': 'gemini', 'x-provider-key': 'g'.repeat(32) }, body: '{' }))
    expect(invalid.status).toBe(400)
  })
  test('streams ordered generation progress frames and a final result for loading UI clients', async () => {
    const response = await handle(new Request('https://king-fun.test/api/v1/content/generate', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:5173',
        accept: 'application/x-ndjson',
        'content-type': 'application/json',
        'x-provider-id': 'gemini',
        'x-provider-key': 'g'.repeat(32),
      },
      body: '{',
    }))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/x-ndjson')
    expect(response.headers.get('cache-control')).toContain('no-store')
    const frames = (await response.text()).trim().split('\n').map(line => JSON.parse(line) as { type: string; stage?: string; status?: number })
    expect(frames[0]).toMatchObject({ type: 'progress', stage: 'gateway-accepted' })
    expect(frames.at(-1)).toMatchObject({ type: 'result', status: 400 })
  })
})


describe('gateway boundary hardening', () => {
  test('rejects unsupported content types before provider access', async () => {
    const response = await handle(new Request('https://king-fun.test/api/v1/content/generate', {
      method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'text/plain', 'x-provider-id': 'gemini', 'x-provider-key': 'g'.repeat(32) }, body: '{}',
    }))
    expect(response.status).toBe(415)
  })
  test('rejects client-supplied Cloudflare credentials', async () => {
    const response = await handle(new Request('https://king-fun.test/api/v1/content/generate', {
      method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-provider-id': 'cloudflare-workers-ai', 'x-provider-key': 'client-secret' }, body: JSON.stringify({ schemaVersion: 1, requestId: 'request_12345678', game: 'truth-or-dare', itemKind: 'truth', categoryId: 'icebreakers', locale: 'en', suitability: 'general', count: 1, recentItems: [] }),
    }))
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('client-secret')
  })
  test('rejects extra request properties such as model and URL overrides', async () => {
    const response = await handle(new Request('https://king-fun.test/api/v1/content/generate', {
      method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-provider-id': 'gemini', 'x-provider-key': 'g'.repeat(32) },
      body: JSON.stringify({ schemaVersion: 1, requestId: 'request_12345678', game: 'truth-or-dare', itemKind: 'truth', categoryId: 'icebreakers', locale: 'en', suitability: 'general', count: 1, recentItems: [], model: 'attacker-model', url: 'https://attacker.invalid' }),
    }))
    expect(response.status).toBe(400)
  })
})

describe('creator and community content controls', () => {
  test('creator unlock is disabled until an operator secret is configured', async () => {
    delete process.env.KING_FUN_CREATOR_SECRET
    delete process.env.KING_FUN_CREATOR_TOKEN_SECRET
    const response = await handle(new Request('https://king-fun.test/api/v1/creator/unlock', {
      method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' }, body: JSON.stringify({ secret: 'a-secret-that-is-long-enough-to-be-valid' }),
    }))
    expect(response.status).toBe(503)
  })
  test('creator unlock issues a signed token and rejects an invalid credential', async () => {
    process.env.KING_FUN_CREATOR_SECRET = 'a-long-random-creator-secret-for-route-tests'
    process.env.KING_FUN_CREATOR_TOKEN_SECRET = 'a-separate-token-signing-secret-that-is-long-enough'
    const headers = { origin: 'http://localhost:5173', 'content-type': 'application/json', 'x-vercel-id': 'test-edge', 'x-forwarded-for': `198.51.100.${Date.now() % 200 + 10}` }
    const bad = await handle(new Request('https://king-fun.test/api/v1/creator/unlock', {
      method: 'POST', headers, body: JSON.stringify({ secret: 'incorrect-creator-key' }),
    }))
    expect(bad.status).toBe(403)
    const unlocked = await handle(new Request('https://king-fun.test/api/v1/creator/unlock', {
      method: 'POST', headers, body: JSON.stringify({ secret: process.env.KING_FUN_CREATOR_SECRET }),
    }))
    const body = await unlocked.json() as { token?: string }
    expect(unlocked.status).toBe(200)
    expect(typeof body.token).toBe('string')
    const verified = await handle(new Request('https://king-fun.test/api/v1/creator/verify', { headers: { origin: 'http://localhost:5173', authorization: `Bearer ${body.token}` } }))
    expect(await verified.json()).toEqual({ valid: true })
    const denied = await handle(new Request('https://king-fun.test/api/v1/content/moderate', {
      method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' }, body: JSON.stringify({ contentId: 'item-123', status: 'rejected' }),
    }))
    expect(denied.status).toBe(403)
  })
  test('community feedback rejects malformed IDs and never accepts a client-supplied moderation status', async () => {
    const invalidId = await handle(new Request('https://king-fun.test/api/v1/content/feedback', {
      method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' }, body: JSON.stringify({ contentId: '../bad', vote: 'down', voterId: 'v'.repeat(32) }),
    }))
    expect(invalidId.status).toBe(400)
    const injected = await handle(new Request('https://king-fun.test/api/v1/content/feedback', {
      method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' }, body: JSON.stringify({ contentId: 'seed-item-1', vote: 'down', voterId: 'v'.repeat(32), status: 'approved' }),
    }))
    expect(injected.status).toBe(400)
  })
})
