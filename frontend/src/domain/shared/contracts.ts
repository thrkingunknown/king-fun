import type { ContentId, PackId, PlayerId, SessionId } from './ids.ts'

export const GAME_IDS = [
  'imposter', 'guessup', 'truth-or-dare', 'never-have-i-ever',
  'timer-impostor', 'werewolf', 'mafia', 'murder', 'fake-it', 'fake-story',
  'fact-or-fiction', 'wrong-answers-only', 'hot-bomb', 'hot-bomb-duel',
  'whos-most-likely', 'would-you-rather', 'share-or-pass', 'challenge-20',
  'tilt-it', 'letterburg', 'discussion-starter', 'who-am-i', 'ten-tangle',
  'qupid', 'questions-for-love', 'a-or-b', 'reverse-singing',
] as const

export type GameId = (typeof GAME_IDS)[number]
export type Locale = 'en' | 'nl' | 'hi' | 'ml'
export type Suitability = 'general' | 'teen' | 'adult'
export type ContentKind = 'word' | 'phrase' | 'truth' | 'dare' | 'never-have-i-ever' | 'party-prompt'
export type SessionStatus = 'active' | 'paused' | 'completed' | 'abandoned'

export interface Player {
  readonly id: PlayerId
  readonly displayName: string
}

export interface ContentProvenance {
  /** Use a stable project identifier or a source URL; never leave provenance implicit. */
  readonly source: string
  /** SPDX identifier or `LicenseRef-Project-Original`. */
  readonly license: string
  readonly creator: string
  readonly createdAt: number
  readonly reviewedAt: number | null
}

export interface ContentItem {
  readonly id: ContentId
  readonly gameId: GameId
  readonly kind: ContentKind
  readonly text: string
  readonly hints?: readonly string[]
  readonly locale: Locale
  readonly packId: PackId
  readonly categoryId: string
  readonly suitability: Suitability
  readonly tags: readonly string[]
  readonly provenance: ContentProvenance
}

export interface ContentPack {
  readonly id: PackId
  readonly gameId: GameId
  readonly name: string
  readonly emoji?: string
  readonly description: string
  readonly locale: Locale
  readonly suitability: Suitability
  readonly version: number
  readonly contentIds: readonly ContentId[]
  readonly isDefault: boolean
}

export interface GameStateData {
  readonly [key: string]: JsonValue
}

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue }

export type GameSnapshot =
  | { readonly schemaVersion: 1; readonly revision: number; readonly gameId: 'imposter'; readonly phase: 'setup' | 'private-reveal' | 'discussion' | 'voting' | 'resolved'; readonly state: GameStateData }
  | { readonly schemaVersion: 1; readonly revision: number; readonly gameId: 'guessup'; readonly phase: 'setup' | 'playing' | 'complete'; readonly state: GameStateData }
  | { readonly schemaVersion: 1; readonly revision: number; readonly gameId: 'truth-or-dare'; readonly phase: 'setup' | 'selecting-player' | 'prompt' | 'complete'; readonly state: GameStateData }
  | { readonly schemaVersion: 1; readonly revision: number; readonly gameId: 'never-have-i-ever'; readonly phase: 'setup' | 'playing' | 'complete'; readonly state: GameStateData }
  | { readonly schemaVersion: 1; readonly revision: number; readonly gameId: Exclude<GameId, 'imposter' | 'guessup' | 'truth-or-dare' | 'never-have-i-ever'>; readonly phase: string; readonly state: GameStateData }

export interface GameSession {
  readonly schemaVersion: 1
  readonly id: SessionId
  readonly gameId: GameId
  readonly status: SessionStatus
  readonly players: readonly Player[]
  readonly snapshot: GameSnapshot
  /** Unix epoch milliseconds. */
  readonly createdAt: number
  /** Unix epoch milliseconds. */
  readonly updatedAt: number
}

export type GameAction =
  | { readonly type: 'session.pause'; readonly sessionId: SessionId; readonly expectedRevision: number; readonly at: number }
  | { readonly type: 'session.resume'; readonly sessionId: SessionId; readonly expectedRevision: number; readonly at: number }
  | { readonly type: 'session.complete'; readonly sessionId: SessionId; readonly expectedRevision: number; readonly at: number }
  | { readonly type: 'player.add'; readonly sessionId: SessionId; readonly expectedRevision: number; readonly player: Player }
  | { readonly type: 'player.remove'; readonly sessionId: SessionId; readonly expectedRevision: number; readonly playerId: PlayerId }
  | { readonly type: 'game.advance'; readonly sessionId: SessionId; readonly expectedRevision: number; readonly at: number }
  | { readonly type: 'game.skip'; readonly sessionId: SessionId; readonly expectedRevision: number; readonly at: number }
  | { readonly type: 'content.commit'; readonly sessionId: SessionId; readonly expectedRevision: number; readonly contentId: ContentId; readonly at: number }
