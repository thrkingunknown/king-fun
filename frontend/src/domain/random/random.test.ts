import { describe, expect, test } from 'bun:test'
import { asContentId, asPlayerId } from '../shared/ids.ts'
import { categoryRepeatWindow, drawNextContentFromSource, playerRepeatWindow, selectPlayerNoRepeatFromSource, type ContentDeckState } from './selection.ts'
import { randomIntegerFromSource, shuffleFromSource } from './random-core.ts'
import { secureRandomInteger, secureShuffle } from './secure-random.ts'

type Sequence = { nextUint53: () => number }

function sequenceSource(values: readonly number[]): Sequence {
  let index = 0
  return {
    nextUint53() {
      if (index >= values.length) throw new Error('Deterministic RNG sequence exhausted.')
      return values[index++]!
    },
  }
}

const RANGE = 2 ** 53

describe('cryptographic random selection core', () => {
  test('bounded integer stays in range for representative small and large bounds', () => {
    const source = sequenceSource([0, 1, 2, 3, 4, 5, 6, 7])
    for (const bound of [1, 2, 3, 7]) {
      const value = randomIntegerFromSource(bound, source)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(bound)
    }
    expect(randomIntegerFromSource(Number.MAX_SAFE_INTEGER, sequenceSource([Number.MAX_SAFE_INTEGER - 1])))
      .toBe(Number.MAX_SAFE_INTEGER - 1)
  })

  test('rejection sampling discards values outside the divisible range', () => {
    // 2^53 modulo 3 is 2, so the final accepted-range boundary value is rejected.
    const source = sequenceSource([RANGE - 1, 14])
    expect(randomIntegerFromSource(3, source)).toBe(2)
  })

  test('rejects invalid bounds and invalid source output', () => {
    expect(() => randomIntegerFromSource(0, sequenceSource([0]))).toThrow(RangeError)
    expect(() => randomIntegerFromSource(-1, sequenceSource([0]))).toThrow(RangeError)
    expect(() => randomIntegerFromSource(1.5, sequenceSource([0]))).toThrow(RangeError)
    expect(() => randomIntegerFromSource(Number.MAX_SAFE_INTEGER + 1, sequenceSource([0]))).toThrow(RangeError)
    expect(() => randomIntegerFromSource(2, sequenceSource([RANGE]))).toThrow(RangeError)
  })

  test('Fisher–Yates preserves the input multiset and does not mutate it', () => {
    const input = ['a', 'b', 'c', 'd']
    const shuffled = shuffleFromSource(input, sequenceSource([0, 0, 0]))
    expect([...shuffled].sort()).toEqual([...input].sort())
    expect(input).toEqual(['a', 'b', 'c', 'd'])
    expect(shuffled).not.toBe(input)
  })

  test('deterministic sequence produces reproducible shuffles', () => {
    const first = shuffleFromSource([1, 2, 3, 4], sequenceSource([0, 1, 0]))
    const second = shuffleFromSource([1, 2, 3, 4], sequenceSource([0, 1, 0]))
    expect(first).toEqual(second)
  })

  test('production adapter uses Web Crypto and returns safe values', () => {
    for (let index = 0; index < 100; index += 1) {
      expect(secureRandomInteger(17)).toBeGreaterThanOrEqual(0)
      expect(secureRandomInteger(17)).toBeLessThan(17)
    }
    const shuffled = secureShuffle([1, 2, 3, 4, 5])
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5])
  })

  test('small-domain distribution simulation stays within a broad tolerance', () => {
    const counts = [0, 0, 0]
    for (let index = 0; index < 9_000; index += 1) {
      const evenlySpacedSample = Math.floor(index * RANGE / 9_000)
      const bucket = randomIntegerFromSource(3, sequenceSource([evenlySpacedSample]))
      counts[bucket] = counts[bucket]! + 1
    }
    for (const count of counts) expect(Math.abs(count - 3_000)).toBeLessThanOrEqual(12)
  })
})

describe('player anti-repeat policy', () => {
  const players = Array.from({ length: 8 }, (_, index) => asPlayerId(`player:${index + 1}`))

  test('uses the approved adaptive player and category cooldown windows', () => {
    expect([3, 4, 5, 6, 7, 8, 9, 10].map(playerRepeatWindow)).toEqual([0, 1, 2, 2, 3, 3, 4, 4])
    expect([0, 1, 2, 3, 4, 5, 6].map(categoryRepeatWindow)).toEqual([0, 0, 1, 1, 1, 2, 2])
    expect(() => playerRepeatWindow(-1)).toThrow(RangeError)
    expect(() => categoryRepeatWindow(1.5)).toThrow(RangeError)
  })

  test('excludes the last three players while alternatives exist', () => {
    const recent = players.slice(0, 3)
    const selection = selectPlayerNoRepeatFromSource(players, recent, 3, sequenceSource([0]))
    expect(players.slice(0, 3)).not.toContain(selection.playerId)
    expect(selection.recentPlayerIds).toHaveLength(3)
  })

  test('samples each eligible player under a deterministic permutation', () => {
    const recent = players.slice(0, 3)
    const eligible = players.slice(3)
    const observed = eligible.map((_, index) => selectPlayerNoRepeatFromSource(
      players, recent, 3, sequenceSource([index]),
    ).playerId)
    expect(new Set(observed)).toEqual(new Set(eligible))
  })

  test('relaxes exclusions when the eligible pool is exhausted', () => {
    const selection = selectPlayerNoRepeatFromSource(players.slice(0, 2), players.slice(0, 2), 3, sequenceSource([0]))
    expect(players.slice(0, 2)).toContain(selection.playerId)
  })

  test('rejects empty or duplicated rosters', () => {
    expect(() => selectPlayerNoRepeatFromSource([], [], 3, sequenceSource([0]))).toThrow(RangeError)
    expect(() => selectPlayerNoRepeatFromSource([players[0]!, players[0]!], [], 3, sequenceSource([0])))
      .toThrow(TypeError)
  })
})

describe('content deck cycles', () => {
  const contentIds = ['content:a', 'content:b', 'content:c', 'content:d'].map(asContentId)

  test('draws every unique content ID once before beginning the next cycle', () => {
    let deck: ContentDeckState | null = null
    const drawn = new Set<string>()
    for (let index = 0; index < contentIds.length; index += 1) {
      const draw = drawNextContentFromSource(contentIds, deck, sequenceSource([0, 0, 0]))
      expect(drawn.has(draw.contentId)).toBe(false)
      drawn.add(draw.contentId)
      deck = draw.deck
    }
    expect(drawn.size).toBe(contentIds.length)
    const next = drawNextContentFromSource(contentIds, deck, sequenceSource([0, 0, 0]))
    expect(next.deck.cycle).toBe(1)
    expect(contentIds).toContain(next.contentId)
  })

  test('resets when the available content set changes', () => {
    const first = drawNextContentFromSource(contentIds, null, sequenceSource([0, 0, 0]))
    const changedSet = contentIds.slice(0, 3)
    const reset = drawNextContentFromSource(changedSet, first.deck, sequenceSource([0, 0]))
    expect(reset.deck.cycle).toBe(1)
    expect(reset.deck.orderedContentIds).toHaveLength(3)
  })

  test('rejects empty and duplicated decks rather than retrying indefinitely', () => {
    expect(() => drawNextContentFromSource([], null, sequenceSource([]))).toThrow(RangeError)
    expect(() => drawNextContentFromSource([contentIds[0]!, contentIds[0]!], null, sequenceSource([])))
      .toThrow(TypeError)
  })
})
