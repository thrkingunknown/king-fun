import type { Player } from '../../types.ts'

export type GuessUpTeam = 'A' | 'B'
export type GuessUpCardResult = 'correct' | 'pass'

export interface GuessUpRoundOptions {
  readonly durationSeconds?: number
  readonly teamAName?: string
  readonly teamBName?: string
  readonly teamAPlayerIds?: readonly string[]
  readonly teamBPlayerIds?: readonly string[]
  /** Optional separate deck for Team B; when omitted, Team B reuses `deck` for legacy compatibility. */
  readonly deckB?: readonly string[]
}

export interface GuessUpRoundState {
  readonly deck: readonly string[]
  readonly deckB?: readonly string[]
  readonly index: number
  readonly indexB?: number
  readonly correct: number
  readonly pass: number
  readonly seconds: number
  readonly durationSeconds: number
  readonly endsAt: number | null
  readonly running: boolean
  readonly activeTeam: GuessUpTeam
  readonly teamA: number
  readonly teamB: number
  readonly teamAName: string
  readonly teamBName: string
  readonly teamAPlayers: readonly string[]
  readonly teamBPlayers: readonly string[]
  readonly teamAPlayerIds: readonly string[]
  readonly teamBPlayerIds: readonly string[]
}

export interface GuessUpTeamTransition {
  readonly phase: 'team-break' | 'complete'
  readonly state: GuessUpRoundState
}

const VALID_DURATIONS = new Set([30, 45, 60, 90, 120])

/** Create a two-team round with an optional, explicit player assignment. */
export function createGuessUpRound(
  players: readonly Player[],
  deck: readonly string[],
  options: GuessUpRoundOptions = {},
): GuessUpRoundState {
  if (players.length < 2) throw new RangeError('GuessUp requires at least two players.')
  if (deck.length === 0 || deck.some(card => !card.trim())) throw new TypeError('GuessUp needs a non-empty deck of readable cards.')
  const names = players.map(player => player.name.trim())
  const ids = players.map(player => player.id.trim())
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new TypeError('GuessUp player IDs must be unique and non-empty.')
  if (names.some(name => !name) || new Set(names.map(name => name.toLocaleLowerCase())).size !== names.length) {
    throw new TypeError('GuessUp players must have unique, non-empty names.')
  }
  const durationSeconds = options.durationSeconds ?? 60
  if (!VALID_DURATIONS.has(durationSeconds)) throw new RangeError('GuessUp round duration must be 30, 45, 60, 90, or 120 seconds.')
  const teamAName = options.teamAName === undefined ? 'Team A' : options.teamAName.trim()
  const teamBName = options.teamBName === undefined ? 'Team B' : options.teamBName.trim()
  if (!teamAName || !teamBName || teamAName.toLocaleLowerCase() === teamBName.toLocaleLowerCase()) {
    throw new TypeError('GuessUp team names must be non-empty and different.')
  }

  const teamAIds = options.teamAPlayerIds ? [...options.teamAPlayerIds] : ids.filter((_, index) => index % 2 === 0)
  const teamBIds = options.teamBPlayerIds ? [...options.teamBPlayerIds] : ids.filter((_, index) => index % 2 === 1)
  const roster = new Set(ids)
  if (teamAIds.length === 0 || teamBIds.length === 0 ||
      teamAIds.some(id => !roster.has(id)) || teamBIds.some(id => !roster.has(id)) ||
      new Set([...teamAIds, ...teamBIds]).size !== ids.length ||
      teamAIds.length + teamBIds.length !== ids.length) {
    throw new TypeError('Every player must be assigned to exactly one non-empty GuessUp team.')
  }

  const deckB = options.deckB ? [...options.deckB] : undefined
  if (deckB !== undefined && (deckB.length === 0 || deckB.some(card => !card.trim()))) throw new TypeError('GuessUp needs a non-empty Team B deck of readable cards.')
  const nameById = new Map(players.map(player => [player.id, player.name]))
  return {
    deck: [...deck], ...(deckB ? { deckB } : {}), index: 0, indexB: 0, correct: 0, pass: 0, seconds: durationSeconds,
    durationSeconds, endsAt: null, running: true, activeTeam: 'A', teamA: 0, teamB: 0,
    teamAName,
    teamBName,
    teamAPlayers: teamAIds.map(id => nameById.get(id)!),
    teamBPlayers: teamBIds.map(id => nameById.get(id)!),
    teamAPlayerIds: teamAIds,
    teamBPlayerIds: teamBIds,
  }
}

/** Begin a timed turn using a wall-clock deadline, so background throttling cannot add time. */
export function beginGuessUpTurn(state: GuessUpRoundState, now = Date.now()): GuessUpRoundState {
  if (state.running) throw new Error('This GuessUp turn is already running.')
  if (!Number.isFinite(now)) throw new TypeError('A valid turn start time is required.')
  if (!VALID_DURATIONS.has(state.durationSeconds)) throw new RangeError('GuessUp round duration must be valid before the timer starts.')
  return { ...state, seconds: state.durationSeconds, endsAt: now + state.durationSeconds * 1000, running: true }
}

/** Reconcile remaining time against the deadline rather than counting interval ticks. */
export function reconcileGuessUpTimer(
  state: GuessUpRoundState,
  now = Date.now(),
): GuessUpTeamTransition | { readonly phase: 'playing'; readonly state: GuessUpRoundState } {
  if (!state.running || !Number.isFinite(state.endsAt) || !Number.isFinite(now)) {
    throw new Error('The GuessUp timer is not running with a valid deadline.')
  }
  const seconds = Math.max(0, Math.ceil((state.endsAt! - now) / 1000))
  if (seconds <= 0) return endGuessUpTeamRound({ ...state, seconds: 0 })
  if (seconds === state.seconds) return { phase: 'playing', state }
  return { phase: 'playing', state: { ...state, seconds } }
}

/** Advance exactly one visible card for the active team. */
export function scoreGuessUpCard(state: GuessUpRoundState, result: GuessUpCardResult): GuessUpRoundState {
  if (!state.running || state.seconds <= 0) throw new Error('This GuessUp team round is not active.')
  const activeTeam: GuessUpTeam = state.activeTeam === 'B' ? 'B' : 'A'
  const activeDeck = activeTeam === 'B' && state.deckB?.length ? state.deckB : state.deck
  const activeIndex = activeTeam === 'B' && state.deckB?.length ? (state.indexB ?? 0) : state.index
  if (activeDeck.length === 0) throw new Error('The GuessUp deck is empty.')
  if (activeIndex >= activeDeck.length) throw new Error('The shuffled GuessUp deck has been exhausted.')
  if (result !== 'correct' && result !== 'pass') throw new TypeError('Unknown GuessUp card result.')
  const nextIndex = activeIndex + 1
  return {
    ...state,
    activeTeam,
    index: activeTeam === 'A' ? nextIndex : state.index,
    indexB: activeTeam === 'B' && state.deckB?.length ? nextIndex : (state.indexB ?? 0),
    correct: state.correct + (result === 'correct' ? 1 : 0),
    pass: state.pass + (result === 'pass' ? 1 : 0),
    teamA: state.teamA + (result === 'correct' && activeTeam === 'A' ? 1 : 0),
    teamB: state.teamB + (result === 'correct' && activeTeam === 'B' ? 1 : 0),
  }
}

/** End the active team's turn exactly once. */
export function endGuessUpTeamRound(state: GuessUpRoundState): GuessUpTeamTransition {
  if (state.running !== true) throw new Error('This GuessUp team round has already ended.')
  const activeTeam: GuessUpTeam = state.activeTeam === 'B' ? 'B' : 'A'
  const nextState = { ...state, activeTeam, seconds: 0, endsAt: null, running: false }
  return { phase: activeTeam === 'A' ? 'team-break' : 'complete', state: nextState }
}

/** Prepare Team B with a separate deck when available, otherwise the legacy shared deck. */
export function startGuessUpTeamB(state: GuessUpRoundState): GuessUpRoundState {
  if (state.activeTeam !== 'A' || state.running || state.seconds > 0) {
    throw new Error('Team B can start only after Team A has finished.')
  }
  return { ...state, activeTeam: 'B', index: state.deckB?.length ? state.index : 0, indexB: 0, seconds: state.durationSeconds, endsAt: null, running: true }
}

/** Prepare Team B for the same visible ready countdown used by the first team. */
export function prepareGuessUpTeamB(state: GuessUpRoundState): GuessUpRoundState {
  const teamB = startGuessUpTeamB(state)
  return { ...teamB, running: false }
}

/** Legacy one-second helper retained for existing domain consumers/tests. */
export function tickGuessUpTimer(state: GuessUpRoundState): GuessUpTeamTransition | { readonly phase: 'playing'; readonly state: GuessUpRoundState } {
  if (!state.running || !Number.isFinite(state.seconds) || state.seconds < 0) {
    throw new Error('The GuessUp timer is not running.')
  }
  const seconds = Math.max(0, Math.floor(state.seconds) - 1)
  if (seconds > 0) return { phase: 'playing', state: { ...state, seconds } }
  return endGuessUpTeamRound({ ...state, seconds: 0 })
}
