import { describe, expect, test } from 'bun:test'
import {
  beginGuessUpTurn,
  createGuessUpRound,
  endGuessUpTeamRound,
  prepareGuessUpTeamB,
  reconcileGuessUpTimer,
  scoreGuessUpCard,
  startGuessUpTeamB,
  tickGuessUpTimer,
} from './guessup.ts'
import type { Player } from '../../types.ts'

const players: Player[] = [
  { id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Sam' }, { id: 'p3', name: 'Jamie' }, { id: 'p4', name: 'Riley' },
]
const makeRound = () => createGuessUpRound(players, ['Coffee', 'Lighthouse', 'Skateboard'])

describe('GuessUp team rounds', () => {
  test('splits players alternately and starts Team A with a shuffled deck supplied by the caller', () => {
    const round = makeRound()
    expect(round.teamAPlayers).toEqual(['Alex', 'Jamie'])
    expect(round.teamBPlayers).toEqual(['Sam', 'Riley'])
    expect(round.activeTeam).toBe('A')
    expect(round.seconds).toBe(60)
  })

  test('accepts explicit teams, names, and a supported duration', () => {
    const round = createGuessUpRound(players, ['Word'], {
      durationSeconds: 90, teamAName: 'North', teamBName: 'South',
      teamAPlayerIds: ['p1', 'p4'], teamBPlayerIds: ['p2', 'p3'],
    })
    expect(round.durationSeconds).toBe(90)
    expect(round.teamAName).toBe('North')
    expect(round.teamBName).toBe('South')
    expect(round.teamAPlayers).toEqual(['Alex', 'Riley'])
    expect(round.teamBPlayers).toEqual(['Sam', 'Jamie'])
  })

  test('scores correct cards only for the active team and tracks passes separately', () => {
    let round = scoreGuessUpCard(makeRound(), 'correct')
    round = scoreGuessUpCard(round, 'pass')
    expect(round.teamA).toBe(1)
    expect(round.teamB).toBe(0)
    expect(round.correct).toBe(1)
    expect(round.pass).toBe(1)
  })

  test('hands Team A into a separate Team B round, then completes after Team B', () => {
    const first = endGuessUpTeamRound(makeRound())
    expect(first.phase).toBe('team-break')
    const prepared = prepareGuessUpTeamB(first.state)
    expect(prepared.activeTeam).toBe('B')
    expect(prepared.index).toBe(0)
    expect(prepared.seconds).toBe(60)
    expect(prepared.running).toBe(false)
    const second = beginGuessUpTurn(prepared, 5_000)
    expect(second.running).toBe(true)
    expect(second.endsAt).toBe(65_000)
    expect(endGuessUpTeamRound(second).phase).toBe('complete')
  })

  test('uses a deadline so background timer throttling does not grant extra time', () => {
    const ready = { ...makeRound(), running: false }
    const running = beginGuessUpTurn(ready, 1_000)
    expect(running.endsAt).toBe(61_000)
    const halfway = reconcileGuessUpTimer(running, 59_001)
    expect(halfway.phase).toBe('playing')
    if (halfway.phase !== 'playing') throw new Error('Expected the timer to keep running.')
    expect(halfway.state.seconds).toBe(2)
    const late = reconcileGuessUpTimer(running, 62_001)
    expect(late.phase).toBe('team-break')
    expect(late.state.seconds).toBe(0)
    expect(late.state.running).toBe(false)
  })

  test('ticks the legacy timer and expires into the correct team transition', () => {
    const teamA = tickGuessUpTimer({ ...makeRound(), seconds: 2 })
    expect(teamA.phase).toBe('playing')
    if (teamA.phase !== 'playing') throw new Error('Expected Team A to continue.')
    expect(teamA.state.seconds).toBe(1)
    const handoff = tickGuessUpTimer({ ...teamA.state, seconds: 1 })
    expect(handoff.phase).toBe('team-break')
    if (handoff.phase !== 'team-break') throw new Error('Expected a Team A handoff.')
    const teamB = startGuessUpTeamB(handoff.state)
    expect(tickGuessUpTimer({ ...teamB, seconds: 1 }).phase).toBe('complete')
    expect(tickGuessUpTimer({ ...teamB, seconds: 0 }).phase).toBe('complete')
  })

  test('rejects missing players, empty decks, invalid assignments, unsupported duration, and invalid names', () => {
    expect(() => createGuessUpRound(players.slice(0, 1), ['Word'])).toThrow()
    expect(() => createGuessUpRound(players, [])).toThrow()
    expect(() => createGuessUpRound(players, ['Word'], { durationSeconds: 75 as unknown as 60 })).toThrow('duration must be')
    expect(() => createGuessUpRound(players, ['Word'], { teamAName: 'Same', teamBName: ' same ' })).toThrow('team names')
    expect(() => createGuessUpRound(players, ['Word'], { teamAName: ' ', teamBName: 'South' })).toThrow('team names')
    expect(() => createGuessUpRound(players, ['Word'], { teamAPlayerIds: ['p1', 'p1'], teamBPlayerIds: ['p2', 'p3', 'p4'] })).toThrow('exactly one')
    expect(() => createGuessUpRound(players, ['Word'], { teamAPlayerIds: ['p1', 'unknown'], teamBPlayerIds: ['p2', 'p3', 'p4'] })).toThrow('exactly one')
    expect(() => createGuessUpRound([{ id: 'same', name: 'Alex' }, { id: 'same', name: 'Sam' }], ['Word'])).toThrow('IDs must be unique')
    expect(() => createGuessUpRound([{ id: '1', name: 'Same' }, { id: '2', name: 'same' }], ['Word'])).toThrow()
    expect(() => scoreGuessUpCard({ ...makeRound(), running: false }, 'correct')).toThrow()
    expect(() => scoreGuessUpCard({ ...makeRound(), index: 3 }, 'correct')).toThrow('deck has been exhausted')
    expect(() => endGuessUpTeamRound({ ...makeRound(), running: false })).toThrow('already ended')
    expect(() => beginGuessUpTurn(makeRound(), 1_000)).toThrow('already running')
    expect(() => beginGuessUpTurn({ ...makeRound(), running: false }, Number.NaN)).toThrow('valid turn start')
  })
})
