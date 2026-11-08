import { describe, expect, test } from 'bun:test'
import { validateGenerateInput, validateGeneratedItems } from '../content/schema.ts'
import { SafeProviderError } from '../types.ts'

const valid = { schemaVersion: 1, requestId: 'request_12345678', game: 'truth-or-dare', itemKind: 'truth', categoryId: 'icebreakers', locale: 'en', suitability: 'general', count: 3, recentItems: ['What is your biggest fear?'] }
describe('AI generation request contract', () => {
  test('accepts a bounded supported request', () => { expect(validateGenerateInput({ ...valid, playerNames: ['Sam', 'Taylor'] }).count).toBe(3) })
  test('rejects arbitrary games, kinds, oversized batches and arbitrary metadata', () => {
    for (const value of [{ ...valid, game: 'proxy' }, { ...valid, itemKind: 'tool' }, { ...valid, count: 6 }, { ...valid, categoryId: '../secret' }]) expect(() => validateGenerateInput(value)).toThrow(SafeProviderError)
  })
  test('rejects oversized recent-item lists, control characters and malformed request IDs', () => {
    expect(() => validateGenerateInput({ ...valid, recentItems: Array(31).fill('x') })).toThrow(SafeProviderError)
    expect(() => validateGenerateInput({ ...valid, recentItems: ['normal', 'contains\u0000control'] })).toThrow(SafeProviderError)
    expect(() => validateGenerateInput({ ...valid, requestId: 'short' })).toThrow(SafeProviderError)
  })
})
describe('AI generated content validation', () => {
  test('normalizes IDs server-side and excludes exact/canonical repeats', () => {
    const input = validateGenerateInput(valid)
    const result = validateGeneratedItems({ items: [{ text: '  A new question? ', hints: [] }, { text: 'A NEW question', hints: [] }, { text: 'What is your biggest fear?', hints: [] }, { text: 'A different question', hints: [] }, { text: 'Where would you travel tomorrow?', hints: [] }] }, input)
    expect(result).toHaveLength(3)
    expect(result[0]?.id).toMatch(/^[a-f0-9]{24}$/)
  })
  test('rejects malformed and empty provider responses', () => {
    const input = validateGenerateInput(valid)
    expect(() => validateGeneratedItems({ choices: [] }, input)).toThrow(SafeProviderError)
    expect(() => validateGeneratedItems({ items: [{ text: ' ' }] }, input)).toThrow(SafeProviderError)
  })
  test('requires the schema-defined hints array for non-category items', () => {
    const input = validateGenerateInput({ ...valid, count: 1 })
    expect(() => validateGeneratedItems({ items: [{ text: 'A safe prompt without the required hints field' }] }, input)).toThrow(SafeProviderError)
    expect(validateGeneratedItems({ items: [{ text: 'A valid safe prompt', hints: [] }] }, input)).toHaveLength(1)
  })
})

describe('Imposter AI word clues', () => {
  test('requires selected category title and description for word generation', () => {
    const request = { schemaVersion: 1, requestId: 'imposter_test_123', game: 'imposter', itemKind: 'word', categoryId: 'animals', locale: 'en', suitability: 'general', count: 1, recentItems: [] }
    expect(() => validateGenerateInput(request)).toThrow(SafeProviderError)
    expect(validateGenerateInput({ ...request, categoryName: 'Animals', categoryDescription: 'Recognisable animals with clear habitats and traits.' }).categoryName).toBe('Animals')
  })

  test('requires 20 distinct answer-safe hints for every generated word', () => {
    const input = validateGenerateInput({ schemaVersion: 1, requestId: 'imposter_test_123', game: 'imposter', itemKind: 'word', categoryId: 'animals', categoryName: 'Animals', categoryDescription: 'Recognisable animals with clear habitats, behaviours and traits.', locale: 'en', suitability: 'general', count: 1, recentItems: [] })
    const hints = Array.from({ length: 20 }, (_, index) => `Clue ${index + 1}`)
    expect(validateGeneratedItems({ items: [{ text: 'Penguin', hints }] }, input)[0]?.hints).toHaveLength(20)
    expect(() => validateGeneratedItems({ items: [{ text: 'Penguin', hints: hints.slice(0, 19) }] }, input)).toThrow(SafeProviderError)
    expect(() => validateGeneratedItems({ items: [{ text: 'Penguin', hints: [...hints.slice(0, 19), 'A penguin'] }] }, input)).toThrow(SafeProviderError)
    expect(() => validateGeneratedItems({ items: [{ text: 'Penguin', hints: [...hints.slice(0, 19), 'A very obvious long clue'] }] }, input)).toThrow(SafeProviderError)
  })
})


describe('strict request and response boundaries', () => {
  test('rejects arbitrary fields including model and upstream URL', () => {
    expect(() => validateGenerateInput({ ...valid, model: 'attacker-model' })).toThrow(SafeProviderError)
    expect(() => validateGenerateInput({ ...valid, url: 'https://attacker.invalid' })).toThrow(SafeProviderError)
  })
  test('rejects unknown provider output fields instead of accepting unvalidated metadata', () => {
    const input = validateGenerateInput({ ...valid, count: 1 })
    expect(() => validateGeneratedItems({ items: [{ text: 'An unrelated safe question', rawPrompt: 'sensitive' }] }, input)).toThrow(SafeProviderError)
  })

  test('rejects near-duplicates rather than returning undersized batches', () => {
    const input = validateGenerateInput({ ...valid, count: 2 })
    expect(() => validateGeneratedItems({ items: [{ text: 'What is your biggest fear?', hints: [] }, { text: 'What is your biggest fear today?', hints: [] }] }, input)).toThrow(SafeProviderError)
  })
  test('requires exactly twenty distinct answer-safe hints', () => {
    const input = validateGenerateInput({ schemaVersion: 1, requestId: 'imposter_test_123', game: 'imposter', itemKind: 'word', categoryId: 'animals', categoryName: 'Animals', categoryDescription: 'Recognisable animals with clear habitats, behaviours and traits.', locale: 'en', suitability: 'general', count: 1, recentItems: [] })
    const hints = Array.from({ length: 20 }, (_, index) => `Penguin clue ${index + 1}`)
    expect(() => validateGeneratedItems({ items: [{ text: 'Penguin', hints }] }, input)).toThrow(SafeProviderError)
  })
})

describe('Imposter category metadata generation', () => {
  const categoryRequest = validateGenerateInput({
    schemaVersion: 1,
    requestId: 'category_test_123',
    game: 'imposter',
    itemKind: 'category',
    categoryId: 'party-categories',
    locale: 'en',
    suitability: 'general',
    count: 2,
    recentItems: ['Animals'],
  })

  test('validates category name, description and emoji and derives a stable category slug', () => {
    const result = validateGeneratedItems({ items: [
      { text: 'Ocean Life', description: 'Marine animals, plants and habitats.', emoji: '🐠' },
      { text: 'Space Exploration', description: 'Astronomy, spacecraft and distant worlds.', emoji: '🚀' },
    ] }, categoryRequest)
    expect(result[0]).toMatchObject({ text: 'Ocean Life', categoryId: 'ocean-life', kind: 'category', description: 'Marine animals, plants and habitats.', emoji: '🐠' })
    expect(result[1]?.categoryId).toBe('space-exploration')
  })

  test('derives distinct stable category IDs for non-Latin names and long labels', () => {
    const request = validateGenerateInput({
      schemaVersion: 1,
      requestId: 'category_unicode_123',
      game: 'imposter',
      itemKind: 'category',
      categoryId: 'party-categories',
      locale: 'en',
      suitability: 'general',
      count: 2,
      recentItems: [],
    })
    const result = validateGeneratedItems({ items: [
      { text: '海洋生物', description: 'Marine animals, plants and ocean habitats.', emoji: '🐠' },
      { text: '宇宙探索', description: 'Astronomy, spacecraft and distant worlds.', emoji: '🚀' },
    ] }, request)
    expect(result).toHaveLength(2)
    expect(result[0]?.categoryId).not.toBe(result[1]?.categoryId)
    expect(result.every(item => /^[a-z0-9][a-z0-9-]{0,63}$/.test(item.categoryId))).toBe(true)
  })

  test('rejects incomplete or malformed category metadata', () => {
    expect(() => validateGeneratedItems({ items: [
      { text: 'Ocean Life', description: 'Marine animals, plants and habitats.' },
      { text: 'Space Exploration', description: 'Astronomy, spacecraft and distant worlds.', emoji: '🚀' },
    ] }, categoryRequest)).toThrow(SafeProviderError)
    expect(() => validateGeneratedItems({ items: [
      { text: 'Ocean Life', description: 'Marine animals, plants and habitats.', emoji: 'not-an-emoji' },
      { text: 'Space Exploration', description: 'Astronomy, spacecraft and distant worlds.', emoji: '🚀' },
    ] }, categoryRequest)).toThrow(SafeProviderError)
    expect(() => validateGeneratedItems({ items: [
      { text: 'Ocean Life', description: 'Marine animals, plants and habitats.' },
      { text: 'Space Exploration', description: '   ' },
    ] }, categoryRequest)).toThrow(SafeProviderError)
    expect(() => validateGeneratedItems({ items: [
      { text: 'Ocean Life', description: 'Marine animals, plants and habitats.', emoji: '🐠', hints: [] },
      { text: 'Ocean Life', description: 'Another description for ocean life.', emoji: '🌊' },
    ] }, categoryRequest)).toThrow(SafeProviderError)
  })
})


describe('18+ generation suitability boundary', () => {
  const adultRequest = {
    schemaVersion: 1, requestId: 'adult_request_123', game: 'truth-or-dare', itemKind: 'truth',
    categoryId: 'after-dark', locale: 'en', suitability: 'adult', adultMode: true, count: 1, recentItems: [],
  }
  test('requires an explicit adult-mode declaration for adult suitability', () => {
    expect(() => validateGenerateInput({ ...adultRequest, adultMode: false })).toThrow(SafeProviderError)
    expect(() => validateGenerateInput({ ...adultRequest, adultMode: undefined })).toThrow(SafeProviderError)
    expect(() => validateGenerateInput({ ...valid, adultMode: true })).toThrow(SafeProviderError)
  })
  test('allows non-graphic adult vocabulary and sexual-history questions only in the adult pool', () => {
    const input = validateGenerateInput(adultRequest)
    const accepted = validateGeneratedItems({ items: [{ text: 'How did you lose your virginity, if you are comfortable sharing? You may pass.', hints: [] }] }, input)
    expect(accepted).toHaveLength(1)
    expect(accepted[0]?.id).toMatch(/^[a-f0-9]{24}$/)
  })
  test('rejects adult-topic vocabulary from the all-ages pool', () => {
    const input = validateGenerateInput({ ...valid, count: 1 })
    for (const text of ['BDSM', 'Hentai', 'Penis', 'A question about virginity', 'Kiss the person next to you on the lips', 'Shout that you are gay', 'Make out with the person next to you', 'Take your shirt off', 'Strip off for the group']) {
      expect(() => validateGeneratedItems({ items: [{ text, hints: [] }] }, input)).toThrow(SafeProviderError)
    }
  })
  test('never allows graphic, coercive or illegal sexual content in adult mode', () => {
    const input = validateGenerateInput(adultRequest)
    for (const text of ['Describe the sex in graphic detail', 'A sexual assault confession', 'A question about underage sex', 'Force someone to kiss you', 'Kiss someone without asking permission', 'A question about sexual contact with a minor']) {
      expect(() => validateGeneratedItems({ items: [{ text, hints: [] }] }, input)).toThrow(SafeProviderError)
    }
  })
  test('content IDs are separated by suitability even when text is identical', () => {
    const general = validateGenerateInput({ ...valid, count: 1 })
    const adult = validateGenerateInput({ ...adultRequest, count: 1 })
    const generalItem = validateGeneratedItems({ items: [{ text: 'What is your most awkward date?', hints: [] }] }, general)[0]
    const adultItem = validateGeneratedItems({ items: [{ text: 'What is your most awkward date?', hints: [] }] }, adult)[0]
    expect(generalItem?.id).not.toBe(adultItem?.id)
  })
})
