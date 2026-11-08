import { describe, expect, test } from 'bun:test'
import { SEEDED_CONTENT, SEEDED_PACKS } from './seed.ts'
import { IMPOSTER_CATEGORY_BANKS } from './imposter-categories.ts'
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

  test('ships all 30 Mystery Who category banks with category-specific words', () => {
    const imposterPacks = SEEDED_PACKS.filter(pack => pack.gameId === 'imposter')
    const categoryPacks = imposterPacks.filter(pack => pack.suitability !== 'adult')
    expect(categoryPacks).toHaveLength(IMPOSTER_CATEGORY_BANKS.length)
    expect(IMPOSTER_CATEGORY_BANKS).toHaveLength(30)
    for (const pack of categoryPacks) {
      const entries = SEEDED_CONTENT.filter(item => item.packId === pack.id)
      expect(entries).toHaveLength(60)
      expect(entries.every(item => item.kind === 'word')).toBe(true)
    }
    const categoryIds = new Set(categoryPacks.map(pack => pack.id))
    const words = SEEDED_CONTENT.filter(item => item.gameId === 'imposter' && categoryIds.has(item.packId)).map(item => canonicalizeContentText(item.text))
    expect(words).toHaveLength(IMPOSTER_CATEGORY_BANKS.length * 60)
    expect(new Set(words).size).toBe(words.length)
  })

  test('built-in Mystic hints do not contain their secret answer', () => {
    const words = SEEDED_CONTENT.filter(item => item.gameId === 'imposter')
    const tokens = (value: string) => value.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
    for (const item of words) {
      const answer = tokens(item.text)
      for (const hint of item.hints ?? []) {
        const clue = tokens(hint)
        const leaksAnswer = clue.some((_, start) => answer.every((token, offset) => clue[start + offset] === token))
        expect(leaksAnswer).toBe(false)
      }
    }
  })

  test('ships a useful baseline pool for all four games', () => {
    const count = (gameId: string, kind?: string) => SEEDED_CONTENT.filter(item => item.gameId === gameId && (!kind || item.kind === kind)).length
    expect(count('imposter', 'word')).toBeGreaterThanOrEqual(IMPOSTER_CATEGORY_BANKS.length * 60)
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
