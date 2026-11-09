import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('Cloudflare Settings generation probe', () => {
  test('uses the same Imposter one-word/20-hint request contract as game startup', () => {
    const source = readFileSync(new URL('./ai-providers.ts', import.meta.url), 'utf8')
    const testFunction = source.slice(source.indexOf('export async function testAiProvider'), source.indexOf('function localCuratedFallback'))
    expect(testFunction).toContain("provider === 'cloudflare-workers-ai'")
    expect(testFunction).toContain("game: 'imposter'")
    expect(testFunction).toContain("itemKind: 'word'")
    expect(testFunction).toContain("categoryId: 'animals'")
    expect(testFunction).toContain("categoryName: 'Animals'")
    expect(testFunction).toContain('count: 1')
  })
})
