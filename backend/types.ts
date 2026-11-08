export type ProviderId = 'gemini' | 'groq' | 'cloudflare-workers-ai'
/** Prompt-driven games that can use the content vault/LLM. Rule-only social deduction games are excluded. */
export type GameId =
  | 'imposter' | 'guessup' | 'truth-or-dare' | 'never-have-i-ever'
  | 'fake-it' | 'fake-story' | 'fact-or-fiction' | 'wrong-answers-only'
  | 'hot-bomb' | 'hot-bomb-duel' | 'whos-most-likely' | 'would-you-rather'
  | 'share-or-pass' | 'challenge-20' | 'tilt-it' | 'letterburg'
  | 'discussion-starter' | 'who-am-i' | 'ten-tangle'
  | 'qupid' | 'questions-for-love' | 'a-or-b' | 'reverse-singing'
export type ItemKind = 'word' | 'charade' | 'truth' | 'dare' | 'statement' | 'category' | 'party-prompt'
export type GenerateInput = {
  schemaVersion: 1
  requestId: string
  game: GameId
  itemKind: ItemKind
  categoryId: string
  /** Optional user-provided theme/title for API-only category/pack generation (inert data). */
  categoryName?: string
  /** Optional user-provided description for API-only category/pack generation (inert data). */
  categoryDescription?: string
  locale: string
  suitability: 'general' | 'teen' | 'adult'
  adultMode?: boolean
  count: number
  playerCount?: number
  playerNames?: string[]
  /** Names of player(s) whose turn it is now — prompt must target them, not others. */
  currentTurnPlayerNames?: string[]
  recentItems: string[]
}
export type GeneratedItem = { id: string; text: string; categoryId: string; kind: ItemKind; locale: string; hints?: string[]; description?: string; emoji?: string }
export type SafeCode = 'ORIGIN_NOT_ALLOWED' | 'INVALID_REQUEST' | 'PROVIDER_NOT_CONFIGURED' | 'AUTH_INVALID' | 'RATE_LIMITED' | 'TIMEOUT' | 'PROVIDER_UNAVAILABLE' | 'INVALID_RESPONSE' | 'BUDGET_EXHAUSTED' | 'REQUEST_CANCELLED' | 'INTERNAL_ERROR'
export class SafeProviderError extends Error {
  readonly code: SafeCode
  readonly retryable: boolean
  readonly status: number
  constructor(code: SafeCode, message: string, retryable: boolean, status = 502) { super(message); this.code = code; this.retryable = retryable; this.status = status; this.name = 'SafeProviderError' }
}
