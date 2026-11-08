import { afterEach, describe, expect, test } from 'bun:test'
import { generateWithProvider } from '../providers/generate.ts'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

const input = {
  schemaVersion: 1 as const,
  requestId: 'provider_test_123',
  game: 'guessup' as const,
  itemKind: 'charade' as const,
  categoryId: 'animals',
  locale: 'en',
  suitability: 'general' as const,
  count: 1,
  recentItems: [],
}
const adultInput = { ...input, suitability: 'adult' as const, adultMode: true }

describe('provider adapters', () => {
  test('Gemini adapter uses the request-scoped BYOK key', async () => {
    let captured: RequestInit | undefined
    globalThis.fetch = (async (_url, init) => {
      captured = init
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"items":[{"text":"Penguin walk","hints":[]}]}' }] } }] })
    }) as typeof fetch
    const result = await generateWithProvider('gemini', input, { AI_ENABLED: 'true', GEMINI_MODEL: 'gemini-3.8-flash' }, 'g'.repeat(32))
    expect(result[0]?.text).toBe('Penguin walk')
    expect(new Headers(captured?.headers).get('x-goog-api-key')).toBe('g'.repeat(32))
    const requestBody = JSON.parse(String(captured?.body)) as { generationConfig?: { responseSchema?: { type?: string; properties?: { items?: { type?: string } } } } }
    expect(requestBody.generationConfig?.responseSchema?.type).toBe('OBJECT')
    expect(requestBody.generationConfig?.responseSchema?.properties?.items?.type).toBe('ARRAY')
  })

  test('Gemini rejects missing BYOK keys', async () => {
    await expect(generateWithProvider('gemini', input, { AI_ENABLED: 'true' })).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' })
  })

  test('Groq adapter parses OpenAI-compatible JSON content', async () => {
    globalThis.fetch = (async () => Response.json({ choices: [{ message: { content: '{"items":[{"text":"Robot dance","hints":[]}]}' } }] })) as typeof fetch
    const result = await generateWithProvider('groq', input, { AI_ENABLED: 'true' }, 'r'.repeat(32))
    expect(result[0]?.text).toBe('Robot dance')
  })

  test('Cloudflare remains operator-managed and rejects client credentials', async () => {
    await expect(generateWithProvider('cloudflare-workers-ai', input, { AI_ENABLED: 'true' })).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' })
  })

  test('Cloudflare supports explicitly enabled adult generation', async () => {
    globalThis.fetch = (async () => Response.json({
      choices: [{ message: { content: 'Here is the JSON:\n{"items":[{"text":"What is a private fantasy you would discuss with a trusted partner?","hints":[]}]}' } }],
    })) as typeof fetch
    const result = await generateWithProvider('cloudflare-workers-ai', adultInput, {
      AI_ENABLED: 'true',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
      CLOUDFLARE_API_TOKEN: 'c'.repeat(32),
      CLOUDFLARE_AI_MODEL: '@cf/meta/llama-3.1-8b-instruct-fast',
    })
    expect(result[0]?.text).toContain('private fantasy')
  })
})
