import { describe, expect, test } from 'bun:test'
import { SEEDED_CONTENT, SEEDED_PACKS } from './seed.ts'
import { IMPOSTER_CATEGORIES } from './imposter-categories.ts'
import { canonicalizeContentText } from '../domain/content/canonicalize.ts'

describe('bundled offline game content', () => {
  test('keeps every content ID unique and every pack reference resolvable', () => {
    const ids = SEEDED_CONTENT.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
    const knownIds = new Set(ids)
    for (const pack of SEEDED_PACKS) {
      expect(new Set(pack.contentIds).size).toBe(pack.contentIds.length)
      for (const id of pack.contentIds) expect(knownIds.has(id)).toBe(true)
    }
  })

  test('keeps all built-in Mystery Who categories as metadata-only AI categories', () => {
    const imposterPacks = SEEDED_PACKS.filter(pack => pack.gameId === 'imposter')
    expect(IMPOSTER_CATEGORIES).toHaveLength(31)
    expect(imposterPacks).toHaveLength(IMPOSTER_CATEGORIES.length)
    for (const category of IMPOSTER_CATEGORIES) {
      const pack = imposterPacks.find(item => item.id === `pack-imposter-${category.id}-v1`)
      expect(pack).toBeDefined()
      expect(pack?.name).toBe(category.name)
      expect(pack?.description).toBe(category.description)
      expect(pack?.isDefault).toBe(true)
      expect(pack?.contentIds).toEqual([])
    }
    expect(imposterPacks.filter(pack => pack.suitability === 'adult')).toHaveLength(1)
    expect(imposterPacks.filter(pack => pack.suitability !== 'adult')).toHaveLength(30)
    expect(SEEDED_CONTENT.filter(item => item.gameId === 'imposter')).toHaveLength(0)
  })

  test('ships a useful baseline pool for all four games', () => {
    const count = (gameId: string, kind?: string) => SEEDED_CONTENT.filter(item => item.gameId === gameId && (!kind || item.kind === kind)).length
    expect(count('imposter', 'word')).toBe(0)
    expect(count('guessup', 'phrase')).toBeGreaterThanOrEqual(40)
    expect(count('truth-or-dare', 'truth')).toBeGreaterThanOrEqual(10)
    expect(count('truth-or-dare', 'dare')).toBeGreaterThanOrEqual(10)
    expect(count('never-have-i-ever', 'never-have-i-ever')).toBeGreaterThanOrEqual(16)
  })


  test('ships playable packs and answer metadata for every additional arcade game', () => {
    const additionalGames = [
      'timer-impostor', 'werewolf', 'mafia', 'murder', 'fake-it', 'fake-story', 'fact-or-fiction',
      'wrong-answers-only', 'hot-bomb', 'hot-bomb-duel', 'whos-most-likely', 'would-you-rather',
      'share-or-pass', 'challenge-20', 'tilt-it', 'letterburg', 'discussion-starter', 'who-am-i',
      'ten-tangle', 'qupid', 'questions-for-love', 'a-or-b', 'reverse-singing',
    ]
    for (const gameId of additionalGames) {
      expect(SEEDED_PACKS.some(pack => pack.gameId === gameId)).toBe(true)
      expect(SEEDED_CONTENT.some(item => item.gameId === gameId)).toBe(true)
    }
    expect(SEEDED_CONTENT.filter(item => item.gameId === 'fake-it').every(item => Boolean(item.hints?.[0]))).toBe(true)
    expect(SEEDED_CONTENT.filter(item => item.gameId === 'fact-or-fiction').every(item => ['true', 'false'].includes(item.hints?.[0] ?? ''))).toBe(true)
    const fakeItItems = SEEDED_CONTENT.filter(item => item.gameId === 'fake-it')
    expect(fakeItItems.every(item => !item.text.includes('?') && !canonicalizeContentText(item.text).includes(canonicalizeContentText(item.hints?.[0] ?? '\u0000')))).toBe(true)
  })

})
