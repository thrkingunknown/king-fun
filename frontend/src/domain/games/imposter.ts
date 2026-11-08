import type { Player } from '../../types.ts'
import { canonicalizeContentText } from '../content/canonicalize.ts'
import { secureRandomInteger } from '../random/secure-random.ts'

export type ImposterMode = 'classic' | 'mystics' | 'chaos'
export type ImposterRole = 'Civilian' | 'Mystic' | 'Mr. White'
export type ImposterVote = Readonly<Record<string, string | readonly string[]>>

function ballotTargets(value: string | readonly string[]): readonly string[] {
  return Array.isArray(value) ? value : [value as string]
}

function containsSecretWord(hint: string, word: string): boolean {
  const wordTokens = word.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  const hintTokens = hint.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  if (wordTokens.length === 0 || hintTokens.length < wordTokens.length) return false
  return hintTokens.some((_, start) => wordTokens.every((token, offset) => hintTokens[start + offset] === token))
}

function checkedRandom(random: () => number): number {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError('Random source must return a finite number in [0, 1).')
  }
  return value
}

function checkedIndex(randomIndex: (exclusiveMax: number) => number, exclusiveMax: number, label: string): number {
  const index = randomIndex(exclusiveMax)
  if (!Number.isInteger(index) || index < 0 || index >= exclusiveMax) {
    throw new RangeError(`Random ${label} index is outside the eligible pool.`)
  }
  return index
}

export interface ImposterOptions {
  readonly mode?: ImposterMode
  readonly mysticCount?: number
  readonly mysticHintsEnabled?: boolean
  readonly sameMysticHint?: boolean
  readonly hints?: readonly string[]
  readonly discussionTimerEnabled?: boolean
  readonly discussionSeconds?: number
  readonly votingEnabled?: boolean
  readonly hiddenVoter?: boolean
  /** Secure unbiased integer source. Production callers should pass secureRandomInteger. */
  readonly randomInteger?: (exclusiveMax: number) => number
  /** Deterministic float seam retained for reproducible unit tests and legacy callers. */
  readonly random?: () => number
}

export function normalizeImposterWord(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Select a word without relaxing the source-parity last-ten exclusion.
 * The caller may pass additional per-category recent IDs; those are hard exclusions too.
 */
export function selectImposterWord<T extends { readonly id: string; readonly text?: string }>(
  items: readonly T[],
  recentIds: readonly string[],
  randomIndex: (exclusiveMax: number) => number,
  recentWords: readonly string[] = [],
): T | null {
  if (new Set(items.map(item => item.id)).size !== items.length) {
    throw new TypeError('Word IDs must be unique.')
  }
  const recent = new Set(recentIds)
  const recentText = new Set(recentWords.map(normalizeImposterWord))
  const eligible = items.filter(item =>
    !recent.has(item.id)
    && (!item.text || !recentText.has(normalizeImposterWord(item.text))),
  )
  if (!eligible.length) return null
  return eligible[checkedIndex(randomIndex, eligible.length, 'word')] ?? null
}

/**
 * Select a category before generating or drawing its word. Category cooldowns
 * relax only when they would leave no eligible selected category.
 */
export function selectImposterCategory(
  categoryIds: readonly string[],
  recentCategoryIds: readonly string[],
  categoryWindow: number,
  randomIndex: (exclusiveMax: number) => number,
): string | null {
  if (!Number.isSafeInteger(categoryWindow) || categoryWindow < 0) {
    throw new RangeError('Category cooldown must be a non-negative safe integer.')
  }
  if (categoryIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw new TypeError('Category IDs must be non-empty strings.')
  }
  if (new Set(categoryIds).size !== categoryIds.length) {
    throw new TypeError('Category IDs must be unique.')
  }
  if (!categoryIds.length) return null

  const eligible = [...categoryIds]
  const cooled = new Set(categoryWindow === 0
    ? []
    : recentCategoryIds.filter(id => eligible.includes(id)).slice(-categoryWindow))
  const outsideCooldown = eligible.filter(id => !cooled.has(id))
  const categoryPool = outsideCooldown.length ? outsideCooldown : eligible
  return categoryPool[checkedIndex(randomIndex, categoryPool.length, 'category')] ?? null
}

/**
 * Pick a category uniformly from eligible categories, then pick a word uniformly
 * inside that category. Category cooldowns may relax only when they would leave
 * no eligible category; word-repeat exclusions are never relaxed.
 */
export function selectImposterWordFromCategories<
  T extends { readonly id: string; readonly text: string; readonly categoryId: string },
>(
  items: readonly T[],
  recentIds: readonly string[],
  recentWords: readonly string[],
  randomIndex: (exclusiveMax: number) => number,
  recentCategoryIds: readonly string[] = [],
  categoryWindow = 0,
): T | null {
  if (!Number.isSafeInteger(categoryWindow) || categoryWindow < 0) {
    throw new RangeError('Category cooldown must be a non-negative safe integer.')
  }
  if (new Set(items.map(item => item.id)).size !== items.length) {
    throw new TypeError('Word IDs must be unique.')
  }
  const recentIdSet = new Set(recentIds)
  const recentWordSet = new Set(recentWords.map(normalizeImposterWord))
  const eligibleItems = items.filter(item =>
    !recentIdSet.has(item.id) && !recentWordSet.has(normalizeImposterWord(item.text)),
  )
  if (!eligibleItems.length) return null

  const eligibleCategories = [...new Set(eligibleItems.map(item => item.categoryId))]
  const cooledCategories = new Set(categoryWindow === 0
    ? []
    : recentCategoryIds.filter(categoryId => eligibleCategories.includes(categoryId)).slice(-categoryWindow))
  const outsideCooldown = eligibleCategories.filter(categoryId => !cooledCategories.has(categoryId))
  const categoryPool = outsideCooldown.length ? outsideCooldown : eligibleCategories
  const categoryId = categoryPool[checkedIndex(randomIndex, categoryPool.length, 'category')]!
  const categoryItems = eligibleItems.filter(item => item.categoryId === categoryId)
  return categoryItems[checkedIndex(randomIndex, categoryItems.length, 'word')] ?? null
}

export interface ImposterRoundState {
  readonly word: string
  readonly category: string
  readonly mode: ImposterMode
  readonly roles: Readonly<Record<string, ImposterRole>>
  readonly hints: Readonly<Record<string, string | null>>
  readonly order: readonly string[]
  readonly reveal: number
  readonly votes: ImposterVote
  readonly skip: readonly string[]
  readonly voter: number
  readonly mysticCount: number
  readonly mrWhiteId: string | null
  readonly discussionTimerEnabled: boolean
  readonly discussionSeconds: number
  readonly votingEnabled: boolean
  readonly hiddenVoter: boolean
  readonly discussionEndsAt?: number | null
  readonly outcome?: ImposterVoteOutcome
  readonly mrWhiteGuess?: string
  readonly mrWhiteCorrect?: boolean
}

export interface ImposterVoteProgress {
  readonly total: number
  readonly completed: number
  readonly votes: number
  readonly skipped: number
  readonly remaining: number
}

export type ImposterVoteOutcome = {
  readonly kind: 'no-votes' | 'tie' | 'single-leader'
  readonly counts: Readonly<Record<string, number>>
  readonly leaders: readonly string[]
}

/** Mystic-count bands from the Mystery Who local rules. */
export function mysticCount(playerCount: number): number {
  if (!Number.isInteger(playerCount) || playerCount < 3 || playerCount > 20) {
    throw new RangeError('Imposter requires between 3 and 20 players.')
  }
  return Math.min(4, Math.floor((playerCount - 1) / 5) + 1)
}

function shuffle<T>(items: readonly T[], randomIndex: (exclusiveMax: number) => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = checkedIndex(randomIndex, index + 1, 'shuffle')
    ;[result[index], result[target]] = [result[target]!, result[index]!]
  }
  return result
}

export function createImposterRound(
  players: readonly Player[],
  shuffledPlayerIds: readonly string[],
  word: string,
  category = 'Everyday',
  options: ImposterOptions = {},
): ImposterRoundState {
  if (players.length < 3 || players.length > 20) {
    throw new RangeError('Imposter requires between 3 and 20 players.')
  }
  if (!word.trim() || !category.trim()) throw new TypeError('A secret word and category are required.')

  const ids = players.map(player => player.id.trim())
  const names = players.map(player => normalizeImposterWord(player.name))
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    throw new TypeError('Player IDs must be unique and non-empty.')
  }
  if (names.some(name => !name) || new Set(names).size !== names.length) {
    throw new TypeError('Player names must be unique and non-empty, ignoring case.')
  }
  if (
    shuffledPlayerIds.length !== ids.length
    || new Set(shuffledPlayerIds).size !== ids.length
    || shuffledPlayerIds.some(id => !ids.includes(id))
  ) {
    throw new TypeError('The reveal order must contain every player exactly once.')
  }

  const mode = options.mode ?? 'classic'
  if (mode !== 'classic' && mode !== 'mystics' && mode !== 'chaos') {
    throw new TypeError('Unknown Imposter game mode.')
  }
  const legacyRandom = options.random
  const randomIndex = options.randomInteger ?? (exclusiveMax => legacyRandom
    ? Math.floor(checkedRandom(legacyRandom) * exclusiveMax)
    : secureRandomInteger(exclusiveMax))
  const randomBelow = (threshold: number) => checkedIndex(randomIndex, 1_000_000, 'probability') < Math.floor(threshold * 1_000_000)
  let count = options.mysticCount ?? mysticCount(players.length)
  let hasWhite = mode === 'mystics'

  if (mode === 'chaos') {
    count = 1 + checkedIndex(randomIndex, Math.min(3, players.length - 2), 'Mystic count')
    hasWhite = players.length >= 4 && randomBelow(0.45)
  } else {
    const max = Math.min(mysticCount(players.length), players.length - (hasWhite ? 2 : 1))
    if (!Number.isInteger(count) || count < 1 || count > max) {
      throw new RangeError(`Mystic count must be between 1 and ${max}.`)
    }
  }

  const roleList: ImposterRole[] = [
    ...Array.from({ length: count }, () => 'Mystic' as const),
    ...(hasWhite ? ['Mr. White' as const] : []),
    ...Array.from({ length: players.length - count - (hasWhite ? 1 : 0) }, () => 'Civilian' as const),
  ]
  const shuffledRoles = shuffle(roleList, randomIndex)
  const roles = Object.fromEntries(
    shuffledPlayerIds.map((id, index) => [id, shuffledRoles[index]!]),
  ) as Record<string, ImposterRole>
  const mystics = shuffledPlayerIds.filter(id => roles[id] === 'Mystic')
  const rawHints = options.mysticHintsEnabled === false
    ? []
    : (options.hints ?? []).filter(hint => typeof hint === 'string').map(hint => hint.trim()).filter(Boolean)
  if (rawHints.length > 20) throw new RangeError('A Mystery Who word can have at most 20 Mystic hints.')
  const uniqueHints = new Map<string, string>()
  for (const hint of rawHints) {
    const key = canonicalizeContentText(hint)
    if (key && !uniqueHints.has(key)) uniqueHints.set(key, hint)
  }
  const availableHints = [...uniqueHints.values()]
    .map(hint => hint.trim().split(/\s+/).slice(0, 2).join(' '))
    .filter(Boolean)
  // If hints are provided but all are unusable, fall back to no-hint play rather than blocking.
  const canonicalWord = canonicalizeContentText(word)
  const safeHints = availableHints.filter(hint => canonicalizeContentText(hint) !== canonicalWord && !containsSecretWord(hint, word))
  const uniqueShortHints = new Map<string, string>()
  for (const hint of safeHints) {
    const key = canonicalizeContentText(hint)
    if (key && !uniqueShortHints.has(key)) uniqueShortHints.set(key, hint)
  }
  const shortHints = [...uniqueShortHints.values()]
  const hintOrder = shuffle(shortHints, randomIndex)
  const hints: Record<string, string | null> = {}

  mystics.forEach((id, index) => {
    hints[id] = shortHints.length
      ? hintOrder[options.sameMysticHint ? 0 : index % hintOrder.length] ?? null
      : null
  })
  for (const id of shuffledPlayerIds) {
    if (roles[id] !== 'Mystic') hints[id] = null
  }

  const requestedSeconds = options.discussionSeconds ?? 180
  if (!Number.isFinite(requestedSeconds)) throw new RangeError('Discussion duration must be a finite number.')
  const discussionSeconds = Math.max(15, Math.min(600, Math.round(requestedSeconds / 15) * 15))

  return {
    word: word.trim(),
    category: category.trim(),
    mode,
    roles,
    hints,
    order: [...shuffledPlayerIds],
    reveal: 0,
    votes: {},
    skip: [],
    voter: 0,
    mysticCount: count,
    mrWhiteId: shuffledPlayerIds.find(id => roles[id] === 'Mr. White') ?? null,
    discussionTimerEnabled: options.discussionTimerEnabled ?? false,
    discussionSeconds,
    votingEnabled: options.votingEnabled ?? true,
    hiddenVoter: options.hiddenVoter ?? true,
  }
}

export function recordImposterBallot(
  state: ImposterRoundState,
  voterId: string,
  targets: readonly string[],
): ImposterRoundState {
  assertCurrentVoter(state, voterId)
  if (!Array.isArray(targets)) throw new TypeError('A ballot must be an array of player IDs.')
  if (state.votes[voterId] || state.skip.includes(voterId)) throw new Error('This player has already voted.')
  if (targets.length !== state.mysticCount) {
    throw new RangeError(`Select exactly ${state.mysticCount} suspected player(s).`)
  }
  if (new Set(targets).size !== targets.length || targets.some(id => !state.order.includes(id))) {
    throw new RangeError('Votes must contain unique players from this round.')
  }
  return { ...state, votes: { ...state.votes, [voterId]: [...targets] }, voter: state.voter + 1 }
}

/** Compatibility for older single-target snapshots; only valid with one ordinary Mystic. */
export function recordImposterVote(
  state: ImposterRoundState,
  voterId: string,
  targetId: string,
): ImposterRoundState {
  if (state.mysticCount !== 1) {
    throw new RangeError('This round requires a multi-target ballot; use recordImposterBallot.')
  }
  return recordImposterBallot(state, voterId, [targetId])
}

export function skipImposterVote(state: ImposterRoundState, voterId: string): ImposterRoundState {
  assertCurrentVoter(state, voterId)
  if (state.votes[voterId] || state.skip.includes(voterId)) throw new Error('This player has already voted.')
  return { ...state, skip: [...state.skip, voterId], voter: state.voter + 1 }
}

export function getImposterVoteProgress(state: ImposterRoundState): ImposterVoteProgress {
  if (!Array.isArray(state.order) || state.order.length < 3 || state.order.length > 20 || state.order.some(id => typeof id !== 'string' || !id.trim()) || new Set(state.order).size !== state.order.length) {
    throw new TypeError('The saved player order is invalid.')
  }
  if (!Number.isInteger(state.mysticCount) || state.mysticCount < 1 || state.mysticCount >= state.order.length) {
    throw new TypeError('The saved Mystic count is invalid.')
  }
  if (!Number.isInteger(state.voter) || state.voter < 0 || state.voter > state.order.length) {
    throw new TypeError('The saved voter index is invalid.')
  }
  if (!state.votes || typeof state.votes !== 'object' || Array.isArray(state.votes) || !Array.isArray(state.skip)) {
    throw new TypeError('The saved vote collection is malformed.')
  }

  const ids = new Set(state.order)
  const voterIds = [...Object.keys(state.votes), ...state.skip]
  if (voterIds.some(id => !ids.has(id)) || new Set(voterIds).size !== voterIds.length) {
    throw new TypeError('The saved vote collection contains an unknown or duplicate player.')
  }

  for (const value of Object.values(state.votes)) {
    const targets = ballotTargets(value)
    const legacySingleTarget = !Array.isArray(value) && state.mysticCount === 1
    if ((!Array.isArray(value) && !legacySingleTarget) || targets.length !== state.mysticCount
      || targets.some(id => !ids.has(id)) || new Set(targets).size !== targets.length) {
      throw new TypeError('The saved vote collection contains an invalid target or ballot size.')
    }
  }

  if (state.skip.some(id => typeof id !== 'string' || !id.trim())) {
    throw new TypeError('The saved skip collection contains an invalid player ID.')
  }

  const votes = Object.keys(state.votes).length
  const skipped = state.skip.length
  const completed = votes + skipped
  if (completed !== state.voter) {
    throw new TypeError('The saved voter index does not match the recorded votes and skips.')
  }
  const expectedVoters = new Set(state.order.slice(0, completed))
  if (voterIds.some(id => !expectedVoters.has(id))) {
    throw new TypeError('The saved vote collection is not in sequential turn order.')
  }

  return { total: state.order.length, completed, votes, skipped, remaining: state.order.length - completed }
}

export function resolveImposterVotes(state: ImposterRoundState): ImposterVoteOutcome {
  if (state.voter !== state.order.length || getImposterVoteProgress(state).remaining !== 0) {
    throw new Error('Every player must vote or skip before the result can be resolved.')
  }
  const counts: Record<string, number> = {}
  for (const value of Object.values(state.votes)) {
    for (const id of ballotTargets(value)) counts[id] = (counts[id] ?? 0) + 1
  }
  const highest = Math.max(0, ...Object.values(counts))
  const leaders = Object.keys(counts).filter(id => counts[id] === highest).sort()
  if (!highest) return { kind: 'no-votes', counts, leaders: [] }
  if (leaders.length > 1) return { kind: 'tie', counts, leaders }
  return { kind: 'single-leader', counts, leaders }
}

export function mrWhiteGuessWins(state: ImposterRoundState, guess: string): boolean {
  return Boolean(state.mrWhiteId && normalizeGuess(guess) === normalizeGuess(state.word))
}

export function normalizeGuess(value: string): string {
  return normalizeImposterWord(value)
}

export function mrWhiteThreshold(state: ImposterRoundState): number {
  getImposterVoteProgress(state)
  const totalSelections = Object.values(state.votes).reduce((sum, ballot) => sum + ballotTargets(ballot).length, 0)
  return Math.max(1, Math.ceil(totalSelections / 2))
}

export function mrWhiteReachedThreshold(state: ImposterRoundState): boolean {
  if (!state.mrWhiteId || state.voter !== state.order.length) return false
  getImposterVoteProgress(state)
  const received = Object.values(state.votes).reduce(
    (sum, ballot) => sum + (ballotTargets(ballot).includes(state.mrWhiteId!) ? 1 : 0),
    0,
  )
  return received >= mrWhiteThreshold(state)
}

function assertCurrentVoter(state: ImposterRoundState, voterId: string): void {
  getImposterVoteProgress(state)
  if (!Number.isInteger(state.voter) || state.voter < 0 || state.voter >= state.order.length) {
    throw new Error('Voting is already complete or the saved voter index is invalid.')
  }
  if (state.order[state.voter] !== voterId) throw new Error('It is not this player’s turn to vote.')
}
