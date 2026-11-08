import { describe, expect, test } from 'bun:test'
import type { Player, ArcadeSetupOptions } from '../../types.ts'
import { SEEDED_CONTENT } from '../../content/seed.ts'
import { parseGameSession } from '../shared/validation.ts'
import {
  classifyTiltGesture,
  createPartyArcadeSession,
  nextLivingPlayerIndex,
  recordArcadeVote,
  resolveHiddenTeamWinner,
  scrambleWord,
  scoreTiltCard,
  settleAuctionLot,
} from './party-arcade.ts'

describe('party arcade domain', () => {
  test('votes are unique per voter and limited to legal options', () => {
    const first = recordArcadeVote({}, 'p1', 'A', ['A', 'B'])
    expect(first).toEqual({ p1: 'A' })
    expect(() => recordArcadeVote(first, 'p1', 'B', ['A', 'B'])).toThrow('already voted')
    expect(() => recordArcadeVote(first, 'p2', 'C', ['A', 'B'])).toThrow('not valid')
  })

  test('timed guessing scores the current card once and never scores an exhausted deck', () => {
    const data = { deck: [{ id: 'a' }, { id: 'b' }], index: 0, teams: true, currentTeam: 'A', scoreA: 0, scoreB: 0 }
    expect(scoreTiltCard(data, 'correct')).toMatchObject({ index: 1, scoreA: 1, correct: 1 })
    expect(() => scoreTiltCard({ ...data, index: 2 }, 'pass')).toThrow('exhausted')
  })

  test('tilt input must return to neutral before another gesture can score', () => {
    expect(classifyTiltGesture(16, true)).toEqual({ action: 'correct', armed: false })
    expect(classifyTiltGesture(22, false)).toEqual({ action: null, armed: false })
    expect(classifyTiltGesture(6, false)).toEqual({ action: null, armed: true })
    expect(classifyTiltGesture(-15, true)).toEqual({ action: 'pass', armed: false })
    expect(classifyTiltGesture(Number.NaN, true)).toEqual({ action: null, armed: true })
  })

  test('solo Tilt It credits the active player, while pass advances without scoring', () => {
    const data = { deck: [{ id: 'a' }, { id: 'b' }], index: 0, teams: false, currentPlayerId: 'p2', soloScores: { p1: 2 } }
    expect(scoreTiltCard(data, 'correct').soloScores).toEqual({ p1: 2, p2: 1 })
    expect(scoreTiltCard(data, 'pass').soloScores).toEqual({ p1: 2 })
  })

  test('auction rejects over-budget bids, uses bid order for ties and preserves anti-item budgets', () => {
    const invalid = settleAuctionLot({ p1: 10 }, { p1: 4 }, 5, false)
    expect(invalid.winnerId).toBeNull()
    const tied = settleAuctionLot({ p2: 5, p1: 5 }, { p2: 7, p1: 7 }, 4, false)
    expect(tied).toMatchObject({ winnerId: 'p2', cost: 5 })
    expect(settleAuctionLot({ p1: 4 }, { p1: 10 }, 2, true)).toMatchObject({
      winnerId: null, cost: 0, nextBudget: { p1: 10 }, blocked: true,
    })
  })

  test('hidden-team victory resolves only when a faction reaches a terminal condition', () => {
    const roles = { a: 'Mafia', b: 'Mafia', c: 'Villager', d: 'Villager', e: 'Villager' }
    expect(resolveHiddenTeamWinner(roles, ['a', 'b', 'c', 'd', 'e'], 'Mafia')).toBeNull()
    expect(resolveHiddenTeamWinner(roles, ['a', 'b', 'c', 'd'], 'Mafia')).toBe('hostile')
    expect(resolveHiddenTeamWinner(roles, ['c', 'd', 'e'], 'Mafia')).toBe('village')
  })

  test('scramble is bounded and always changes a multi-character word', () => {
    expect(scrambleWord('PLANET', () => 0)).not.toBe('PLANET')
    expect(scrambleWord('A')).toBe('A')
  })

  test('round-robin living-player index wraps at the end', () => {
    expect(nextLivingPlayerIndex(['a', 'b', 'c'], 1)).toBe(2)
    expect(nextLivingPlayerIndex(['a', 'b', 'c'], 2)).toBe(0)
    expect(nextLivingPlayerIndex([], 0)).toBe(0)
  })

  test('every registered arcade game creates a real, typed phase-bearing session from its seeded pack', () => {
    const players: Player[] = Array.from({ length: 6 }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}` }))
    const games = [
      'timer-impostor', 'werewolf', 'mafia', 'murder', 'fake-it', 'fake-story', 'fact-or-fiction',
      'wrong-answers-only', 'hot-bomb', 'hot-bomb-duel', 'whos-most-likely', 'would-you-rather',
      'share-or-pass', 'challenge-20', 'tilt-it', 'letterburg', 'discussion-starter', 'who-am-i',
      'ten-tangle', 'qupid', 'questions-for-love', 'a-or-b', 'reverse-singing',
    ] as const
    for (const game of games) {
      const playerCount = ['hot-bomb-duel', 'qupid', 'questions-for-love', 'a-or-b'].includes(game) ? 2 : game === 'werewolf' || game === 'mafia' ? 6 : 4
      const roster = players.slice(0, playerCount)
      const content = SEEDED_CONTENT.filter(item => item.gameId === game).map(item => ({ id: item.id, text: item.text, hints: item.hints }))
      const session = createPartyArcadeSession(game, roster, content)
      expect(typeof session.phase).toBe('string')
      expect(session.data.arcadeGame).toBe(game)
      expect(session.data.playerRoster).toHaveLength(playerCount)
      const now = Date.now()
      expect(() => parseGameSession({
        schemaVersion: 1, id: `party-test:${game}`, gameId: game, status: 'active',
        players: roster.map(player => ({ id: player.id, displayName: player.name })),
        snapshot: { schemaVersion: 1, revision: 0, gameId: game, phase: session.phase, state: session.data },
        createdAt: now, updatedAt: now,
      })).not.toThrow()
    }
  })


  test('poll and wrong-answer games retain a shuffled multi-round prompt deck', () => {
    const players: Player[] = Array.from({ length: 4 }, (_, index) => ({ id: `poll${index + 1}`, name: `Poll ${index + 1}` }))
    for (const game of ['whos-most-likely', 'would-you-rather', 'wrong-answers-only'] as const) {
      const content = SEEDED_CONTENT.filter(item => item.gameId === game).map(item => ({ id: item.id, text: item.text, hints: item.hints }))
      const session = createPartyArcadeSession(game, players, content)
      expect(session.data.deck).toHaveLength(content.length)
      expect(session.data.index).toBe(0)
      expect(session.data.promptId).toBe(session.data.deck[0].id)
      if (game === 'would-you-rather') {
        expect(session.data.optionA).toBeTruthy()
        expect(session.data.optionB).toBeTruthy()
      }
    }
  })

  test('Fact or Fiction accepts uppercase custom verdict metadata', () => {
    const players: Player[] = [
      { id: 'f1', name: 'One' }, { id: 'f2', name: 'Two' }, { id: 'f3', name: 'Three' },
    ]
    const session = createPartyArcadeSession('fact-or-fiction', players, [
      { id: 'custom-fact-1', text: 'A sample statement.', hints: ['TRUE'] },
    ])
    expect(session.data.promptTruth).toBe(true)
  })

  test('custom $20 Challenge themes receive a neutral generic ten-lot market', () => {
    const players: Player[] = [{ id: 'c1', name: 'One' }, { id: 'c2', name: 'Two' }]
    const session = createPartyArcadeSession('challenge-20', players, [
      { id: 'custom-theme', text: 'Build a space station' },
    ])
    expect(session.data.market).toHaveLength(10)
    expect(session.data.market[0].label).not.toMatch(/ship|pirate|parrot/i)
    expect(session.data.budgets).toEqual({ c1: 20, c2: 20 })
  })

  test('Fake It assigns one private word-holder and gives every other player one guess', () => {
    const players: Player[] = Array.from({ length: 4 }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}` }))
    const content = SEEDED_CONTENT.filter(item => item.gameId === 'fake-it').map(item => ({ id: item.id, text: item.text, hints: item.hints }))
    const session = createPartyArcadeSession('fake-it', players, content)
    expect(session.phase).toBe('private-reveal')
    expect(typeof session.data.secretWord).toBe('string')
    expect(players.some(player => player.id === session.data.wordHolderId)).toBe(true)
    expect(session.data.guessOrder).toHaveLength(players.length - 1)
    expect(session.data.guessOrder).not.toContain(session.data.wordHolderId)
  })

  test('Who Am I begins with the identity visible for forehead play and rotates one turn per player', () => {
    const players: Player[] = Array.from({ length: 4 }, (_, index) => ({ id: `p${index + 1}`, name: `Player ${index + 1}` }))
    const content = SEEDED_CONTENT.filter(item => item.gameId === 'who-am-i').map(item => ({ id: item.id, text: item.text, hints: item.hints }))
    const session = createPartyArcadeSession('who-am-i', players, content)
    expect(session.phase).toBe('questioning')
    expect(Object.keys(session.data.assignments)).toHaveLength(players.length)
    expect(session.data.playerOrder).toHaveLength(players.length)
  })

  test('content-dependent games fail safely when their pack is empty', () => {
    const players: Player[] = [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }]
    expect(() => createPartyArcadeSession('tilt-it', players, [])).toThrow('needs at least one bundled content item')
  })

  test('session creation rejects duplicate identities and invalid options', () => {
    const duplicate: Player[] = [{ id: 'p1', name: 'Alex' }, { id: 'p1', name: 'Sam' }]
    expect(() => createPartyArcadeSession('tilt-it', duplicate, [{ id: 'w1', text: 'Planet' }])).toThrow('unique')
    const players: Player[] = [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }]
    expect(() => createPartyArcadeSession('hot-bomb', players, [{ id: 'w1', text: 'Planet' }], { fuseSeconds: 99 } as ArcadeSetupOptions)).toThrow('Fuse length')
  })
})
