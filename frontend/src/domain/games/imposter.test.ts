import { describe, expect, test } from 'bun:test'
import { createImposterRound, getImposterVoteProgress, mysticCount, recordImposterVote, recordImposterBallot, resolveImposterVotes, selectImposterWord, skipImposterVote, mrWhiteGuessWins, mrWhiteReachedThreshold, normalizeImposterWord, selectImposterWordFromCategories } from './imposter.ts'
import type { Player } from '../../types.ts'

const players: Player[] = Array.from({ length: 20 }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}` }))
const round = (count: number) => createImposterRound(players.slice(0, count), players.slice(0, count).map(player => player.id), 'Coffee')

describe('Imposter role allocation', () => {
  test('assigns the required Mystic count at every range boundary', () => {
    for (const [playersCount, expected] of [[3, 1], [5, 1], [6, 2], [10, 2], [11, 3], [15, 3], [16, 4], [20, 4]] as const) {
      expect(mysticCount(playersCount)).toBe(expected)
      const state = round(playersCount)
      expect(Object.values(state.roles).filter(role => role === 'Mystic')).toHaveLength(expected)
      expect(Object.values(state.roles).filter(role => role === 'Civilian')).toHaveLength(playersCount - expected)
    }
  })
  test('rejects invalid player counts and malformed reveal orders', () => {
    expect(() => mysticCount(2)).toThrow()
    expect(() => mysticCount(21)).toThrow()
    expect(() => createImposterRound(players.slice(0, 3), ['p1', 'p1', 'p3'], 'Coffee')).toThrow()
    expect(() => createImposterRound(players.slice(0, 3), ['p1', 'p2', 'p3'], 'Coffee', ' ')).toThrow()
  })
})

describe('Imposter voting', () => {
  test('records one private vote per player and resolves a unique leader', () => {
    let state = round(3)
    state = recordImposterVote(state, 'p1', 'p2')
    state = recordImposterVote(state, 'p2', 'p2')
    state = skipImposterVote(state, 'p3')
    expect(resolveImposterVotes(state)).toEqual({ kind: 'single-leader', counts: { p2: 2 }, leaders: ['p2'] })
  })
  test('supports self-voting and detects ties', () => {
    let state = round(3)
    state = recordImposterVote(state, 'p1', 'p1')
    state = recordImposterVote(state, 'p2', 'p2')
    state = skipImposterVote(state, 'p3')
    expect(resolveImposterVotes(state).kind).toBe('tie')
  })
  test('reports voting progress and refuses to resolve an incomplete round', () => {
    let state = round(3)
    expect(getImposterVoteProgress(state)).toEqual({ total: 3, completed: 0, votes: 0, skipped: 0, remaining: 3 })
    expect(() => resolveImposterVotes(state)).toThrow('Every player must vote or skip')
    state = recordImposterVote(state, 'p1', 'p2')
    expect(getImposterVoteProgress(state)).toEqual({ total: 3, completed: 1, votes: 1, skipped: 0, remaining: 2 })
  })
  test('rejects corrupted saved vote collections', () => {
    const state = round(3)
    expect(() => getImposterVoteProgress({ ...state, skip: ['p1', 'p1'] })).toThrow('unknown or duplicate')
    expect(() => getImposterVoteProgress({ ...state, votes: { p1: 'ghost' } })).toThrow('invalid target')
    expect(() => getImposterVoteProgress({ ...state, voter: 4 })).toThrow('voter index')
    expect(() => getImposterVoteProgress({ ...state, voter: 1 })).toThrow('does not match')
  })
  test('detects all-skip rounds and rejects duplicate or out-of-turn votes', () => {
    let state = round(3)
    expect(() => recordImposterVote(state, 'p2', 'p1')).toThrow()
    state = skipImposterVote(state, 'p1')
    expect(() => skipImposterVote(state, 'p1')).toThrow()
    expect(() => recordImposterVote(state, 'p1', 'p2')).toThrow()
    state = skipImposterVote(state, 'p2')
    state = skipImposterVote(state, 'p3')
    expect(resolveImposterVotes(state).kind).toBe('no-votes')
  })
})


describe('Imposter word history', () => {
  test('excludes the last ten IDs and reports exhaustion without repeating', () => {
    const words = Array.from({ length: 12 }, (_, index) => ({ id: `w${index + 1}`, text: `Word ${index + 1}` }))
    expect(selectImposterWord(words, words.slice(0, 10).map(word => word.id), () => 0)?.id).toBe('w11')
    expect(selectImposterWord(words.slice(0, 10), words.slice(0, 10).map(word => word.id), () => 0)).toBeNull()
  })
  test('excludes normalized duplicate words even when their stable IDs differ', () => {
    const pool = [{ id: 'fruit-watermelon', text: 'Watermelon' }, { id: 'summer-watermelon', text: '  WATERMELON  ' }, { id: 'fruit-mango', text: 'Mango' }]
    expect(selectImposterWord(pool, [], () => 0, ['watermelon'])?.id).toBe('fruit-mango')
    expect(normalizeImposterWord('  Snow   Globe ')).toBe('snow globe')
  })
  test('chooses a selected category uniformly before choosing a word inside it', () => {
    const pool = [{ id: 'a1', text: 'A1', categoryId: 'A' }, { id: 'b1', text: 'B1', categoryId: 'B' }, { id: 'b2', text: 'B2', categoryId: 'B' }]
    expect(selectImposterWordFromCategories(pool, [], [], max => max - 1)?.categoryId).toBe('B')
    expect(selectImposterWordFromCategories(pool, [], [], () => 0)?.categoryId).toBe('A')
  })
  test('rejects duplicate stable IDs and invalid random indexes', () => {
    expect(() => selectImposterWord([{ id: 'same' }, { id: 'same' }], [], () => 0)).toThrow()
    expect(() => selectImposterWord([{ id: 'one' }], [], () => 1)).toThrow()
  })
})


describe('Mystery Who modes and special roles', () => {
  test('Classic mode never assigns Mr. White', () => {
    const state = createImposterRound(players.slice(0, 5), players.slice(0, 5).map(p => p.id), 'Coffee', 'Food', { mode: 'classic', random: () => 0.2 })
    expect(Object.values(state.roles).includes('Mr. White')).toBe(false)
  })
  test('Mystics mode assigns exactly one Mr. White and keeps at least one Civilian', () => {
    const state = createImposterRound(players.slice(0, 6), players.slice(0, 6).map(p => p.id), 'Coffee', 'Food', { mode: 'mystics', mysticCount: 2, random: () => 0.25 })
    expect(Object.values(state.roles).filter(role => role === 'Mr. White')).toHaveLength(1)
    expect(Object.values(state.roles).filter(role => role === 'Mystic')).toHaveLength(2)
    expect(Object.values(state.roles).filter(role => role === 'Civilian')).toHaveLength(3)
  })
  test('Chaos mode applies the 45 percent Mr. White chance at four or more players', () => {
    const white = createImposterRound(players.slice(0, 6), players.slice(0, 6).map(p => p.id), 'Coffee', 'Food', { mode: 'chaos', random: () => 0.44 })
    const noWhite = createImposterRound(players.slice(0, 6), players.slice(0, 6).map(p => p.id), 'Coffee', 'Food', { mode: 'chaos', random: () => 0.46 })
    expect(white.mrWhiteId).not.toBeNull()
    expect(noWhite.mrWhiteId).toBeNull()
  })
  test('Chaos mode preserves a Civilian and limits Mystics to three', () => {
    const state = createImposterRound(players.slice(0, 8), players.slice(0, 8).map(p => p.id), 'Coffee', 'Food', { mode: 'chaos', random: () => 0.99 })
    expect(Object.values(state.roles).filter(role => role === 'Civilian').length).toBeGreaterThanOrEqual(1)
    expect(Object.values(state.roles).filter(role => role === 'Mystic').length).toBeLessThanOrEqual(3)
  })
  test('Mystics receive hints while Mr. White and Civilians do not', () => {
    const state = createImposterRound(players.slice(0, 6), players.slice(0, 6).map(p => p.id), 'Coffee', 'Food', { mode: 'mystics', mysticCount: 1, hints: ['Warm', 'Morning'], random: () => 0.2 })
    for (const [id, role] of Object.entries(state.roles)) expect(Boolean(state.hints[id])).toBe(role === 'Mystic')
  })
  test('uses the documented discussion timer and voting defaults and clamps timer bounds', () => {
    const roster = players.slice(0, 3)
    const order = roster.map(p => p.id)
    const defaults = createImposterRound(roster, order, 'Coffee')
    expect(defaults.discussionTimerEnabled).toBe(false)
    expect(defaults.discussionSeconds).toBe(180)
    expect(defaults.votingEnabled).toBe(true)
    expect(defaults.hiddenVoter).toBe(true)
    expect(createImposterRound(roster, order, 'Coffee', 'Food', { discussionSeconds: 12 }).discussionSeconds).toBe(15)
    expect(createImposterRound(roster, order, 'Coffee', 'Food', { discussionSeconds: 610 }).discussionSeconds).toBe(600)
  })
  test('supports disabled, shared, and distinct Mystic hints', () => {
    const roster = players.slice(0, 6)
    const order = roster.map(p => p.id)
    const disabled = createImposterRound(roster, order, 'Coffee', 'Food', { mode: 'mystics', mysticCount: 2, mysticHintsEnabled: false, hints: ['one', 'two'] })
    expect(Object.values(disabled.hints).every(hint => hint === null)).toBe(true)
    const shared = createImposterRound(roster, order, 'Coffee', 'Food', { mode: 'mystics', mysticCount: 2, sameMysticHint: true, hints: ['one', 'two'], random: () => 0.2 })
    const sharedHints = Object.entries(shared.hints).filter(([id]) => shared.roles[id] === 'Mystic').map(([, hint]) => hint)
    expect(new Set(sharedHints).size).toBe(1)
    const distinct = createImposterRound(roster, order, 'Coffee', 'Food', { mode: 'mystics', mysticCount: 2, sameMysticHint: false, hints: ['one', 'two'], random: () => 0.2 })
    const distinctHints = Object.entries(distinct.hints).filter(([id]) => distinct.roles[id] === 'Mystic').map(([, hint]) => hint)
    expect(new Set(distinctHints).size).toBe(2)
  })
  test('collects the configured number of unique targets per ballot', () => {
    const state = createImposterRound(players.slice(0, 6), players.slice(0, 6).map(p => p.id), 'Coffee', 'Food', { mysticCount: 2 })
    expect(() => recordImposterBallot(state, 'p1', ['p2'])).toThrow('Select exactly 2')
    expect(() => recordImposterBallot(state, 'p1', ['p2', 'p2'])).toThrow('unique players')
    const next = recordImposterBallot(state, 'p1', ['p2', 'p3'])
    expect(next.voter).toBe(1)
  })
  test('Mr. White threshold is based on received selections and guesses normalize whitespace/case', () => {
    const state = createImposterRound(players.slice(0, 6), players.slice(0, 6).map(p => p.id), 'Coffee', 'Food', { mode: 'mystics', mysticCount: 2 })
    const whiteId = state.mrWhiteId!
    let next = state
    for (const player of players.slice(0, 6)) {
      const secondTarget = players.find(candidate => candidate.id !== whiteId && candidate.id !== player.id)?.id ?? players.find(candidate => candidate.id !== whiteId)?.id
      next = recordImposterBallot(next, player.id, [whiteId, secondTarget!])
      if (next.voter < next.order.length) expect(mrWhiteReachedThreshold(next)).toBe(false)
    }
    expect(mrWhiteReachedThreshold(next)).toBe(true)
    expect(mrWhiteGuessWins(state, '  COFFEE  ')).toBe(true)
    expect(mrWhiteGuessWins(state, 'tea')).toBe(false)
  })
  test('all-skip voting does not grant Mr. White a zero-threshold guess', () => {
    const roster = players.slice(0, 4)
    const state = createImposterRound(roster, roster.map(player => player.id), 'Coffee', 'Food', { mode: 'mystics', mysticCount: 1 })
    const finished = roster.reduce((current, player) => skipImposterVote(current, player.id), state)
    expect(mrWhiteReachedThreshold(finished)).toBe(false)
  })
})

describe('Mystery Who rule hardening', () => {
  test('Mystics mode applies the player-count bands without ever removing the Civilian', () => {
    for (const [count, expected] of [[3, 1], [5, 1], [6, 2], [10, 2], [11, 3], [15, 3], [16, 4], [20, 4]] as const) {
      const roster = Array.from({ length: count }, (_, index) => ({ id: `m${index + 1}`, name: `Mystic ${index + 1}` }))
      const state = createImposterRound(roster, roster.map(player => player.id), 'Lantern', 'Objects', {
        mode: 'mystics', mysticCount: expected, random: () => 0.37,
      })
      expect(Object.values(state.roles).filter(role => role === 'Mystic')).toHaveLength(expected)
      expect(Object.values(state.roles).filter(role => role === 'Mr. White')).toHaveLength(1)
      expect(Object.values(state.roles).filter(role => role === 'Civilian').length).toBeGreaterThanOrEqual(1)
    }
  })

  test('rejects duplicate display names ignoring case and malformed oversized rosters', () => {
    const duplicateNames = [
      { id: 'one', name: 'Alex' },
      { id: 'two', name: ' alex ' },
      { id: 'three', name: 'Sam' },
    ]
    expect(() => createImposterRound(duplicateNames, duplicateNames.map(player => player.id), 'Lantern')).toThrow('unique and non-empty')
    const oversized = Array.from({ length: 21 }, (_, index) => ({ id: `large-${index}`, name: `Player ${index}` }))
    expect(() => createImposterRound(oversized, oversized.map(player => player.id), 'Lantern')).toThrow('3 and 20')
  })

  test('rejects a Mystic hint that reveals the secret word', () => {
    const roster = players.slice(0, 3)
    expect(() => createImposterRound(roster, roster.map(player => player.id), 'Lantern', 'Objects', {
      mode: 'classic', hints: [' lantern ', 'Light'],
    })).toThrow('must not disclose the secret word')
  })

  test('rejects secret words hidden inside punctuation or longer hints', () => {
    const roster = players.slice(0, 3)
    expect(() => createImposterRound(roster, roster.map(player => player.id), 'Lantern', 'Objects', {
      hints: ['A lantern! is useful at night'],
    })).toThrow('must not disclose the secret word')
  })

  test('rejects more than twenty hints and canonicalizes duplicate hint strings', () => {
    const roster = players.slice(0, 3)
    expect(() => createImposterRound(roster, roster.map(player => player.id), 'Lantern', 'Objects', {
      hints: Array.from({ length: 21 }, (_, index) => `clue ${index}`),
    })).toThrow('at most 20')
    const roundWithDuplicates = createImposterRound(roster, roster.map(player => player.id), 'Lantern', 'Objects', {
      hints: ['A useful clue', ' a useful clue! '], random: () => 0.2,
    })
    expect(Object.values(roundWithDuplicates.hints).filter(Boolean)).toHaveLength(1)
  })

  test('rejects an unknown mode and an invalid random source', () => {
    const roster = players.slice(0, 3)
    expect(() => createImposterRound(roster, roster.map(player => player.id), 'Tea', 'Food', {
      mode: 'troll' as 'classic',
    })).toThrow('Unknown Imposter game mode')
    for (const invalid of [Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1]) {
      expect(() => createImposterRound(roster, roster.map(player => player.id), 'Tea', 'Food', {
        mode: 'chaos', random: () => invalid,
      })).toThrow('Random source')
    }
  })

  test('rejects legacy single-target voting when more than one Mystic is configured', () => {
    const state = createImposterRound(players.slice(0, 6), players.slice(0, 6).map(player => player.id), 'Coffee', 'Food', {
      mysticCount: 2,
    })
    expect(() => recordImposterVote(state, 'p1', 'p2')).toThrow('multi-target ballot')
  })

  test('rejects saved ballots with the wrong selection count and out-of-order voters', () => {
    const state = createImposterRound(players.slice(0, 6), players.slice(0, 6).map(player => player.id), 'Coffee', 'Food', {
      mysticCount: 2,
    })
    expect(() => getImposterVoteProgress({
      ...state,
      votes: { p1: ['p2'] },
      voter: 1,
    })).toThrow('ballot size')
    expect(() => getImposterVoteProgress({
      ...state,
      votes: { p2: ['p1', 'p3'] },
      voter: 1,
    })).toThrow('sequential turn order')
  })

  test('rejects an invalid saved voter limit and malformed ballot collections', () => {
    const state = createImposterRound(players.slice(0, 3), players.slice(0, 3).map(player => player.id), 'Lantern')
    expect(() => getImposterVoteProgress({ ...state, order: Array.from({ length: 21 }, (_, index) => `p${index}`) })).toThrow('player order')
    expect(() => recordImposterBallot(state, 'p1', null as unknown as readonly string[])).toThrow('must be an array')
    expect(() => getImposterVoteProgress({ ...state, votes: [] as unknown as Record<string, string> })).toThrow('malformed')
  })

  test('category cooldown is relaxed only when every eligible category is cooling down', () => {
    const pool = [
      { id: 'a1', text: 'A1', categoryId: 'A' },
      { id: 'b1', text: 'B1', categoryId: 'B' },
      { id: 'c1', text: 'C1', categoryId: 'C' },
    ]
    expect(selectImposterWordFromCategories(pool, [], [], () => 0, ['A'], 1)?.categoryId).toBe('B')
    expect(selectImposterWordFromCategories(pool, ['b1', 'c1'], [], () => 0, ['A'], 1)?.categoryId).toBe('A')
    expect(selectImposterWordFromCategories(pool, ['a1', 'b1', 'c1'], [], () => 0, ['A'], 1)).toBeNull()
  })
})
