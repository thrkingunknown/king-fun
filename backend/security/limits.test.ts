import { afterEach, describe, expect, test } from 'bun:test'
import { acquireGenerationSlotForAddress, getClientAddress, hasSharedLimiterConfiguration, hashClientAddress, isSharedLimiterReady } from './limits.ts'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

describe('gateway abuse controls', () => {
  test('uses edge-provided client addresses only', () => {
    expect(getClientAddress(new Request('https://king-fun.test', { headers: { 'x-forwarded-for': '203.0.113.9' } }))).toBe('unknown')
    expect(getClientAddress(new Request('https://king-fun.test', { headers: { 'x-vercel-id': 'sfo1::test', 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }))).toBe('203.0.113.9')
    expect(getClientAddress(new Request('https://king-fun.test', { headers: { 'cf-ray': 'ray-id', 'cf-connecting-ip': '203.0.113.10' } }))).toBe('203.0.113.10')
  })

  test('uses stable keyed address hashes across serverless instances without storing raw addresses', () => {
    const first = hashClientAddress('203.0.113.25', 'shared-limiter-token')
    expect(first).toBe(hashClientAddress('203.0.113.25', 'shared-limiter-token'))
    expect(first).not.toBe(hashClientAddress('203.0.113.25', 'rotated-limiter-token'))
    expect(first).not.toContain('203.0.113.25')
  })

  test('rejects malformed shared limiter endpoints', () => {
    expect(hasSharedLimiterConfiguration({ AI_LIMITER_REST_URL: 'http://redis.invalid', AI_LIMITER_REST_TOKEN: 'secret' } as NodeJS.ProcessEnv)).toBe(false)
    expect(hasSharedLimiterConfiguration({ AI_LIMITER_REST_URL: 'https://redis.invalid', AI_LIMITER_REST_TOKEN: 'secret' } as NodeJS.ProcessEnv)).toBe(true)
  })

  test('checks EVAL permissions during shared-store readiness rather than accepting PING alone', async () => {
    let command: string[] = []
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      command = JSON.parse(String(init?.body ?? '[]')) as string[]
      return Response.json({ result: 1 })
    }) as typeof fetch
    const env = { AI_LIMITER_REST_URL: 'https://redis.example.test', AI_LIMITER_REST_TOKEN: 'shared-limiter-token' } as NodeJS.ProcessEnv
    expect(await isSharedLimiterReady(env)).toBe(true)
    expect(command.slice(0, 3)).toEqual(['EVAL', 'return 1', '0'])
  })

  test('enforces local per-address rate limits and idempotent release', async () => {
    const env = { NODE_ENV: 'test', AI_RATE_LIMIT_PER_MINUTE: '1', AI_DAILY_REQUEST_LIMIT: '20', AI_MAX_CONCURRENT_REQUESTS: '3' } as NodeJS.ProcessEnv
    const first = await acquireGenerationSlotForAddress(env, 'rate-test-unique-address', 'gemini', Date.now())
    expect(first.ok).toBe(true)
    const second = await acquireGenerationSlotForAddress(env, 'rate-test-unique-address', 'gemini', Date.now())
    expect(second).toEqual({ ok: false, reason: 'rate' })
    if (first.ok) { await first.release(); await first.release() }
  })

  test('fails closed in production without a shared limiter', async () => {
    const env = { NODE_ENV: 'production' } as NodeJS.ProcessEnv
    await expect(acquireGenerationSlotForAddress(env, 'prod-test', 'groq')).resolves.toEqual({ ok: false, reason: 'configuration' })
  })
  test('uses atomic Redis quota checks and request-scoped expiring concurrency leases', async () => {
    const calls: string[][] = []
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body ?? '[]')) as string[])
      return Response.json({ result: 0 })
    }) as typeof fetch
    const env = {
      NODE_ENV: 'production',
      AI_LIMITER_REST_URL: 'https://redis.example.test',
      AI_LIMITER_REST_TOKEN: 'shared-limiter-token',
      AI_LIMITER_KEY_PREFIX: 'king-fun:test',
    } as NodeJS.ProcessEnv
    const slot = await acquireGenerationSlotForAddress(env, '203.0.113.71', 'gemini', Date.UTC(2026, 10, 5, 10, 0, 0))
    expect(slot.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.[0]).toBe('EVAL')
    const acquireScript = calls[0]?.[1] ?? ''
    expect(acquireScript).toContain('ZREMRANGEBYSCORE')
    expect(acquireScript).toContain('ZADD')
    expect(acquireScript.indexOf("redis.call('GET'")).toBeLessThan(acquireScript.indexOf("redis.call('INCR'"))
    expect(calls[0]?.[6]).toContain('active-leases')
    if (slot.ok) {
      await slot.release()
      await slot.release()
    }
    expect(calls).toHaveLength(2)
    expect(calls[1]?.[0]).toBe('EVAL')
    expect(calls[1]?.[1]).toContain('ZREM')
    expect(calls[1]?.[4]).toBe(calls[0]?.[14])
  })

})
