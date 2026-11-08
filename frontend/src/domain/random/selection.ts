import type { PlayerId, ContentId } from '../shared/ids.ts'
import { randomIntegerFromSource, shuffleFromSource } from './random-core.ts'
import type { RandomSource } from './random-core.ts'
import { secureRandomInteger, secureShuffle } from './secure-random.ts'

export function playerRepeatWindow(playerCount: number): number {
  if (!Number.isSafeInteger(playerCount) || playerCount < 0) {
    throw new RangeError('Player count must be a non-negative safe integer.')
  }
  return playerCount < 4 ? 0 : Math.max(1, Math.round((playerCount / 2) - 1))
}

export function categoryRepeatWindow(categoryCount: number): number {
  if (!Number.isSafeInteger(categoryCount) || categoryCount < 0) {
    throw new RangeError('Category count must be a non-negative safe integer.')
  }
  if (categoryCount < 2) return 0
  if (categoryCount < 4) return 1
  return Math.max(1, Math.round((categoryCount / 2) - 1))
}

export interface PlayerSelection {
  readonly playerId: PlayerId
  readonly recentPlayerIds: readonly PlayerId[]
}

export interface ContentDeckState {
  /** Order for the current cycle. */
  readonly orderedContentIds: readonly ContentId[]
  /** Index of the next item to draw. */
  readonly cursor: number
  readonly cycle: number
  readonly availableFingerprint: string
  readonly lastContentId: ContentId | null
}

export interface ContentDraw {
  readonly contentId: ContentId
  readonly deck: ContentDeckState
}

export function selectPlayerNoRepeat(
  playerIds: readonly PlayerId[],
  recentPlayerIds: readonly PlayerId[],
  recentWindow = playerRepeatWindow(playerIds.length),
): PlayerSelection {
  const { pool, recent } = preparePlayerPool(playerIds, recentPlayerIds, recentWindow)
  const playerId = pool[secureRandomInteger(pool.length)]!
  return {
    playerId,
    recentPlayerIds: recentWindow === 0 ? [] : [...recent, playerId].slice(-recentWindow),
  }
}

/** Internal deterministic seam used by property/unit tests. */
export function selectPlayerNoRepeatFromSource(
  playerIds: readonly PlayerId[],
  recentPlayerIds: readonly PlayerId[],
  recentWindow: number,
  source: RandomSource,
): PlayerSelection {
  const { pool, recent } = preparePlayerPool(playerIds, recentPlayerIds, recentWindow)
  const playerId = pool[randomIntegerFromSource(pool.length, source)]!
  return {
    playerId,
    recentPlayerIds: recentWindow === 0 ? [] : [...recent, playerId].slice(-recentWindow),
  }
}

export function drawNextContent(
  availableContentIds: readonly ContentId[],
  currentDeck: ContentDeckState | null,
): ContentDraw {
  return drawNextContentWithShuffle(availableContentIds, currentDeck, secureShuffle)
}

/** Internal deterministic seam used by property/unit tests. */
export function drawNextContentFromSource(
  availableContentIds: readonly ContentId[],
  currentDeck: ContentDeckState | null,
  source: RandomSource,
): ContentDraw {
  return drawNextContentWithShuffle(
    availableContentIds,
    currentDeck,
    (ids) => shuffleFromSource(ids, source),
  )
}

function drawNextContentWithShuffle(
  availableContentIds: readonly ContentId[],
  currentDeck: ContentDeckState | null,
  shuffle: <T>(items: readonly T[]) => T[],
): ContentDraw {
  assertUniqueNonEmpty(availableContentIds, 'content')
  const fingerprint = fingerprintIds(availableContentIds)
  const reusableDeck = currentDeck !== null
    && currentDeck.availableFingerprint === fingerprint
    && currentDeck.orderedContentIds.length === availableContentIds.length
    && currentDeck.cursor >= 0
    && currentDeck.cursor < currentDeck.orderedContentIds.length
    && sameIds(currentDeck.orderedContentIds, availableContentIds)
    ? currentDeck
    : null

  const orderedContentIds = reusableDeck
    ? [...reusableDeck.orderedContentIds]
    : shuffle(availableContentIds)
  const cycle = reusableDeck ? reusableDeck.cycle : (currentDeck?.cycle ?? -1) + 1
  const cursor = reusableDeck ? reusableDeck.cursor : 0
  const contentId = orderedContentIds[cursor]!

  return {
    contentId,
    deck: {
      orderedContentIds,
      cursor: cursor + 1,
      cycle,
      availableFingerprint: fingerprint,
      lastContentId: contentId,
    },
  }
}

function preparePlayerPool(
  playerIds: readonly PlayerId[],
  recentPlayerIds: readonly PlayerId[],
  recentWindow: number,
): { readonly pool: readonly PlayerId[]; readonly recent: readonly PlayerId[] } {
  assertUniqueNonEmpty(playerIds, 'player')
  if (!Number.isSafeInteger(recentWindow) || recentWindow < 0) {
    throw new RangeError('recentWindow must be a non-negative safe integer.')
  }
  const recent = recentWindow === 0
    ? []
    : recentPlayerIds.filter((id) => playerIds.includes(id)).slice(-recentWindow)
  const recentSet = new Set(recent)
  const eligible = playerIds.filter((id) => !recentSet.has(id))
  return { pool: eligible.length > 0 ? eligible : [...playerIds], recent }
}

function assertUniqueNonEmpty<T extends string>(ids: readonly T[], label: string): void {
  if (ids.length === 0) throw new RangeError(`At least one ${label} ID is required.`)
  if (ids.some((id) => typeof id !== 'string' || id.length === 0)) {
    throw new TypeError(`${label} IDs must be non-empty strings.`)
  }
  if (new Set(ids).size !== ids.length) throw new TypeError(`${label} IDs must be unique.`)
}

function fingerprintIds(ids: readonly string[]): string {
  return JSON.stringify([...ids].sort())
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((id) => rightSet.has(id))
}
