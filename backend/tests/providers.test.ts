import { afterEach, describe, expect, test } from 'bun:test'
import { generateWithProvider, normalizeGenerationInput, getProviderTimeout } from '../providers/generate.ts'

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
    const requestBody = JSON.parse(String(captured?.body)) as { generationConfig?: { maxOutputTokens?: number; responseSchema?: { type?: string; properties?: { items?: { type?: string } } } } }
    expect(requestBody.generationConfig?.responseSchema?.type).toBe('OBJECT')
    expect(requestBody.generationConfig?.responseSchema?.properties?.items?.type).toBe('ARRAY')
    expect(requestBody.generationConfig?.maxOutputTokens).toBe(4_000)
  })

  test('Gemini rejects missing BYOK keys', async () => {
    await expect(generateWithProvider('gemini', input, { AI_ENABLED: 'true' })).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' })
  })

  test('Groq adapter parses JSON and keeps its generic output budget', async () => {
    let capturedBody: Record<string, unknown> | undefined
    globalThis.fetch = (async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({ choices: [{ message: { content: '{"items":[{"text":"Robot dance","hints":[]}]}' } }] })
    }) as typeof fetch
    const result = await generateWithProvider('groq', input, { AI_ENABLED: 'true' }, 'r'.repeat(32))
    expect(result[0]?.text).toBe('Robot dance')
    expect(capturedBody?.max_completion_tokens).toBe(4_000)
  })

  test('Cloudflare remains operator-managed and rejects client credentials', async () => {
    await expect(generateWithProvider('cloudflare-workers-ai', input, { AI_ENABLED: 'true' })).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' })
  })

  test('every provider receives only the one Imposter word a game start consumes', () => {
    const imposterBatch = { ...input, game: 'imposter' as const, itemKind: 'word' as const, count: 5 }
    expect(normalizeGenerationInput(imposterBatch).count).toBe(1)
    expect(normalizeGenerationInput({ ...imposterBatch, count: 1 }).count).toBe(1)
    // The one-item rule is Imposter-specific; other games retain their batch.
    expect(normalizeGenerationInput({ ...input, game: 'guessup', count: 5 }).count).toBe(5)
  })

  test('Cloudflare has a provider-specific timeout while Gemini/Groq keep the normal deadline', () => {
    expect(getProviderTimeout({}, 'cloudflare-workers-ai')).toBe(52_000)
    expect(getProviderTimeout({ AI_PROVIDER_TIMEOUT_MS: '45000' }, 'cloudflare-workers-ai')).toBe(52_000)
    expect(getProviderTimeout({ CLOUDFLARE_AI_TIMEOUT_MS: '60000' }, 'cloudflare-workers-ai')).toBe(52_000)
    expect(getProviderTimeout({ CLOUDFLARE_AI_TIMEOUT_MS: '30000' }, 'cloudflare-workers-ai')).toBe(30_000)
    expect(getProviderTimeout({ AI_PROVIDER_TIMEOUT_MS: '40000' }, 'gemini')).toBe(40_000)
  })

  test('Cloudflare rejects capacity-queue waits and bounds generation output', async () => {
    let capturedBody: Record<string, unknown> | undefined
    globalThis.fetch = (async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({ choices: [{ message: { content: JSON.stringify({ items: [{ text: 'Penguin', hints: Array.from({ length: 20 }, (_, index) => `hint${index + 1}`) }] }) } }] })
    }) as typeof fetch
    await generateWithProvider('cloudflare-workers-ai', {
      ...input, game: 'imposter', itemKind: 'word', count: 1, categoryId: 'animals',
    }, {
      AI_ENABLED: 'true',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
      CLOUDFLARE_API_TOKEN: 'c'.repeat(32),
    })
    expect(capturedBody?.options).toEqual({ rejectIfBusy: true })
    expect(capturedBody?.reasoning_effort).toBe('low')
    expect(capturedBody?.max_tokens).toBe(6_000)
    const messages = capturedBody?.messages as Array<{ role: string; content: string }>
    const prompt = messages.map(message => message.content).join('\n')
    expect(prompt).toContain('put the answer in text')
    expect(prompt).toContain('exactly 20 distinct, indirect hints')
    expect(prompt).not.toContain('Do not generate any other content besides the hints')
    const responseFormat = capturedBody?.response_format as { type?: string }
    expect(responseFormat.type).toBe('json_object')
  })

  test('Cloudflare output truncation reports the server-side token-budget cause', async () => {
    globalThis.fetch = (async () => Response.json({
      choices: [{ finish_reason: 'length', message: { content: '{\"items\":[{\"text\":\"Penguin\",' } }] },
    })) as typeof fetch
    await expect(generateWithProvider('cloudflare-workers-ai', {
      ...input, game: 'imposter', itemKind: 'word', count: 1, categoryId: 'animals',
    }, {
      AI_ENABLED: 'true',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
      CLOUDFLARE_API_TOKEN: 'c'.repeat(32),
    })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      message: 'Cloudflare Workers AI stopped at the 6,000-token completion limit before returning the complete JSON response. Check the deployed backend version and server-side AI_MAX_OUTPUT_TOKENS setting, then retry.',
    })
  })

  test('Cloudflare bounds GuessUp charade and five-item party-prompt output', async () => {
    const env = {
      AI_ENABLED: 'true',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
      CLOUDFLARE_API_TOKEN: 'c'.repeat(32),
    }
    for (const scenario of [
      { request: { ...input, count: 5 }, expected: 4_000, prefix: 'Charade' },
      { request: { ...input, game: 'fake-story' as const, itemKind: 'party-prompt' as const, count: 5 }, expected: 4_000, prefix: 'Story prompt' },
    ]) {
      let capturedBody: Record<string, unknown> | undefined
      globalThis.fetch = (async (_url, init) => {
        capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
        const items = Array.from({ length: 5 }, (_, index) => ({ text: `${scenario.prefix} number ${index + 1}`, hints: [] }))
        return Response.json({ choices: [{ message: { content: JSON.stringify({ items }) } }] })
      }) as typeof fetch
      await generateWithProvider('cloudflare-workers-ai', scenario.request, env)
      expect(capturedBody?.max_tokens).toBe(scenario.expected)
    }
  })

  test('Cloudflare respects an explicit global output-token ceiling', async () => {
    let capturedBody: Record<string, unknown> | undefined
    globalThis.fetch = (async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({ choices: [{ message: { content: JSON.stringify({ items: [{ text: 'Penguin', hints: Array.from({ length: 20 }, (_, index) => `hint${index + 1}`) }] }) } }] })
    }) as typeof fetch
    await generateWithProvider('cloudflare-workers-ai', {
      ...input, game: 'imposter', itemKind: 'word', count: 1, categoryId: 'animals',
    }, {
      AI_ENABLED: 'true',
      AI_MAX_OUTPUT_TOKENS: '2048',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
      CLOUDFLARE_API_TOKEN: 'c'.repeat(32),
    })
    expect(capturedBody?.max_tokens).toBe(2_048)
  })

  test('Cloudflare retains the generic token budget for longer Truth prompts', async () => {
    let capturedBody: Record<string, unknown> | undefined
    globalThis.fetch = (async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({ choices: [{ message: { content: '{"items":[{"text":"What small thing made you smile recently?","hints":[]}]}' } }] })
    }) as typeof fetch
    await generateWithProvider('cloudflare-workers-ai', { ...input, game: 'truth-or-dare', itemKind: 'truth', count: 1 }, {
      AI_ENABLED: 'true',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
      CLOUDFLARE_API_TOKEN: 'c'.repeat(32),
    })
    expect(capturedBody?.max_tokens).toBe(4_000)
  })

  test('Generation prompts never include player names, even when older clients submit legacy player fields', async () => {
    let capturedBody: Record<string, unknown> | undefined
    globalThis.fetch = (async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return Response.json({ choices: [{ message: { content: '{"items":[{"text":"Penguin walk","hints":[]}]}' } }] })
    }) as typeof fetch
    await generateWithProvider('cloudflare-workers-ai', {
      ...input, game: 'truth-or-dare', itemKind: 'truth', playerCount: 4, playerNames: ['KF_PRIVATE_ALICE', 'KF_PRIVATE_BOB'], currentTurnPlayerNames: ['KF_PRIVATE_ALICE'],
    }, {
      AI_ENABLED: 'true',
      CLOUDFLARE_ACCOUNT_ID: 'a'.repeat(32),
      CLOUDFLARE_API_TOKEN: 'c'.repeat(32),
    })
    const serializedPrompt = JSON.stringify(capturedBody?.messages ?? [])
    expect(serializedPrompt).not.toContain('KF_PRIVATE_ALICE')
    expect(serializedPrompt).not.toContain('KF_PRIVATE_BOB')
    expect(serializedPrompt).not.toContain('Player names')
    expect(serializedPrompt).not.toContain('exactly 20 distinct, indirect hints')
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
