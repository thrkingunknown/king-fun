import {
  GAME_IDS,
  type ContentItem,
  type ContentKind,
  type ContentPack,
  type GameAction,
  type GameId,
  type GameSession,
  type GameSnapshot,
  type JsonValue,
  type Locale,
  type Suitability,
} from './contracts.ts'
import { isStableId } from './ids.ts'

export interface ValidationIssue {
  readonly path: string
  readonly message: string
}

export class ContractValidationError extends TypeError {
  readonly issues: readonly ValidationIssue[]

  constructor(issues: readonly ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '))
    this.name = 'ContractValidationError'
    this.issues = issues
  }
}

const LOCALES = new Set<Locale>(['en', 'nl', 'hi', 'ml'])
const SUITABILITY = new Set<Suitability>(['general', 'teen', 'adult'])
const CONTENT_KINDS = new Set<ContentKind>(['word', 'phrase', 'truth', 'dare', 'never-have-i-ever', 'party-prompt'])
const SESSION_STATUSES = new Set(['active', 'paused', 'completed', 'abandoned'])
const ACTION_TYPES = new Set([
  'session.pause', 'session.resume', 'session.complete', 'player.add', 'player.remove',
  'game.advance', 'game.skip', 'content.commit',
])
const MAX_TEXT_LENGTH = 500
const MAX_PLAYERS = 32
const MAX_CONTENT_IDS = 5_000
const ALL_AGES_BLOCKED_PATTERNS = [
  /\b(?:sex(?:ual|ually)?|penis|vagina|vulva|clitoris|orgasm|masturbat(?:e|ion)|bdsm|hentai|porn(?:ography)?|erotic|fetish|sexting|virginity|virgin|condom|lingerie|striptease|hookup|one[- ]night stand|intimate|nudity|nude|naked|topless|undress(?:ing)?|make out|blowjob|fellatio|cunnilingus|intercourse|penetration)\b/i,
  /\bkiss(?:es|ed|ing)?\b.{0,40}\b(?:lips?|mouth)\b|\b(?:lips?|mouth)\b.{0,40}\bkiss\b/i,
  /\b(?:get naked|go naked|strip off|undress|topless)\b/i,
  /\b(?:say|shout|announce|declare)\b.{0,70}\b(?:(?:i|you|they|he|she)\s+(?:am|are|is)|i'm|you're|they're)\s+(?:gay|lesbian|bisexual|trans|queer)\b/i,
]
const CONTENT_KINDS_BY_GAME: Record<GameId, readonly ContentKind[]> = {
  imposter: ['word'],
  guessup: ['word', 'phrase'],
  'truth-or-dare': ['truth', 'dare'],
  'never-have-i-ever': ['never-have-i-ever'],
  'timer-impostor': ['party-prompt'], 'werewolf': ['party-prompt'], 'mafia': ['party-prompt'],
  'murder': ['party-prompt'], 'fake-it': ['party-prompt'], 'fake-story': ['party-prompt'],
  'fact-or-fiction': ['party-prompt'], 'wrong-answers-only': ['party-prompt'],
  'hot-bomb': ['party-prompt'], 'hot-bomb-duel': ['party-prompt'],
  'whos-most-likely': ['party-prompt'], 'would-you-rather': ['party-prompt'],
  'share-or-pass': ['party-prompt'], 'challenge-20': ['party-prompt'],
  'tilt-it': ['party-prompt'], 'letterburg': ['party-prompt'],
  'discussion-starter': ['party-prompt'], 'who-am-i': ['party-prompt'],
  'ten-tangle': ['party-prompt'], 'qupid': ['party-prompt'],
  'questions-for-love': ['party-prompt'], 'a-or-b': ['party-prompt'],
  'reverse-singing': ['party-prompt'],
}

export function parseContentItem(input: unknown): ContentItem {
  const issues: ValidationIssue[] = []
  const value = record(input, '$', issues)
  if (value) {
    requireId(value.id, 'id', '$.id', issues)
    requireEnum(value.gameId, GAME_IDS, '$.gameId', issues)
    requireEnum(value.kind, [...CONTENT_KINDS], '$.kind', issues)
    if (typeof value.gameId === 'string' && GAME_IDS.includes(value.gameId as GameId)
      && typeof value.kind === 'string' && CONTENT_KINDS.has(value.kind as ContentKind)
      && !CONTENT_KINDS_BY_GAME[value.gameId as GameId].includes(value.kind as ContentKind)) {
      issues.push({ path: '$.kind', message: `is not valid for game ${value.gameId}` })
    }
    requireText(value.text, '$.text', issues, MAX_TEXT_LENGTH)
    const text = typeof value.text === 'string' ? value.text : ''
    if (value.hints !== undefined) {
      requireStringArray(value.hints, '$.hints', issues, 20, 240)
      if (value.suitability !== 'adult' && Array.isArray(value.hints) && value.hints.some(hint => typeof hint === 'string' && ALL_AGES_BLOCKED_PATTERNS.some(pattern => pattern.test(hint.normalize('NFKC'))))) {
        issues.push({ path: '$.hints', message: 'contains adult-only content but is not tagged for the 18+ pool' })
      }
    }
    requireEnum(value.locale, [...LOCALES], '$.locale', issues)
    requireId(value.packId, 'id', '$.packId', issues)
    requireId(value.categoryId, 'category', '$.categoryId', issues)
    requireEnum(value.suitability, [...SUITABILITY], '$.suitability', issues)
    if (value.suitability !== 'adult' && text && ALL_AGES_BLOCKED_PATTERNS.some(pattern => pattern.test(text.normalize('NFKC')))) {
      issues.push({ path: '$.text', message: 'contains adult-only content but is not tagged for the 18+ pool' })
    }
    requireStringArray(value.tags, '$.tags', issues, 24, 40)
    const provenance = record(value.provenance, '$.provenance', issues)
    if (provenance) {
      requireText(provenance.source, '$.provenance.source', issues, 500)
      requireText(provenance.license, '$.provenance.license', issues, 100)
      requireText(provenance.creator, '$.provenance.creator', issues, 120)
      requireTimestamp(provenance.createdAt, '$.provenance.createdAt', issues)
      if (provenance.reviewedAt !== null) requireTimestamp(provenance.reviewedAt, '$.provenance.reviewedAt', issues)
    }
  }
  throwIfInvalid(issues)
  return input as ContentItem
}

export function parseContentPack(input: unknown): ContentPack {
  const issues: ValidationIssue[] = []
  const value = record(input, '$', issues)
  if (value) {
    requireId(value.id, 'id', '$.id', issues)
    requireEnum(value.gameId, GAME_IDS, '$.gameId', issues)
    requireText(value.name, '$.name', issues, 80)
    if (value.emoji !== undefined) requireText(value.emoji, '$.emoji', issues, 16)
    requireText(value.description, '$.description', issues, 240)
    requireEnum(value.locale, [...LOCALES], '$.locale', issues)
    requireEnum(value.suitability, [...SUITABILITY], '$.suitability', issues)
    if (typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 1) {
      issues.push({ path: '$.version', message: 'must be a positive safe integer' })
    }
    if (!Array.isArray(value.contentIds) || value.contentIds.length > MAX_CONTENT_IDS) {
      issues.push({ path: '$.contentIds', message: `must be an array of at most ${MAX_CONTENT_IDS} IDs` })
    } else {
      value.contentIds.forEach((id, index) => requireId(id, 'id', `$.contentIds[${index}]`, issues))
      if (new Set(value.contentIds).size !== value.contentIds.length) {
        issues.push({ path: '$.contentIds', message: 'must not contain duplicate IDs' })
      }
    }
    if (typeof value.isDefault !== 'boolean') {
      issues.push({ path: '$.isDefault', message: 'must be a boolean' })
    }
  }
  throwIfInvalid(issues)
  return input as ContentPack
}

export function parseGameSession(input: unknown): GameSession {
  const issues: ValidationIssue[] = []
  const value = record(input, '$', issues)
  if (value) {
    if (value.schemaVersion !== 1) issues.push({ path: '$.schemaVersion', message: 'unsupported session schema version' })
    requireId(value.id, 'id', '$.id', issues)
    requireEnum(value.gameId, GAME_IDS, '$.gameId', issues)
    requireEnum(value.status, [...SESSION_STATUSES], '$.status', issues)
    requireTimestamp(value.createdAt, '$.createdAt', issues)
    requireTimestamp(value.updatedAt, '$.updatedAt', issues)
    if (Number(value.updatedAt) < Number(value.createdAt)) {
      issues.push({ path: '$.updatedAt', message: 'must not be earlier than createdAt' })
    }
    if (!Array.isArray(value.players) || value.players.length > MAX_PLAYERS) {
      issues.push({ path: '$.players', message: `must be an array of at most ${MAX_PLAYERS} players` })
    } else {
      value.players.forEach((player, index) => validatePlayer(player, `$.players[${index}]`, issues))
      const ids = value.players.map((player) => isRecord(player) ? player.id : undefined)
      if (new Set(ids).size !== ids.length) issues.push({ path: '$.players', message: 'player IDs must be unique' })
    }
    const snapshot = parseSnapshot(value.snapshot, '$.snapshot', issues)
    if (snapshot && snapshot.gameId !== value.gameId) {
      issues.push({ path: '$.snapshot.gameId', message: 'must match session gameId' })
    }
  }
  throwIfInvalid(issues)
  return input as GameSession
}

export function parseGameAction(input: unknown): GameAction {
  const issues: ValidationIssue[] = []
  const value = record(input, '$', issues)
  if (value) {
    requireEnum(value.type, [...ACTION_TYPES], '$.type', issues)
    requireId(value.sessionId, 'id', '$.sessionId', issues)
    if (typeof value.expectedRevision !== 'number' || !Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 0) {
      issues.push({ path: '$.expectedRevision', message: 'must be a non-negative safe integer' })
    }
    if (typeof value.type === 'string') {
      if (value.type === 'player.add') validatePlayer(value.player, '$.player', issues)
      if (value.type === 'player.remove') requireId(value.playerId, 'id', '$.playerId', issues)
      if (value.type === 'content.commit') requireId(value.contentId, 'id', '$.contentId', issues)
      if (['session.pause', 'session.resume', 'session.complete', 'game.advance', 'game.skip', 'content.commit'].includes(value.type)) {
        requireTimestamp(value.at, '$.at', issues)
      }
    }
  }
  throwIfInvalid(issues)
  return input as GameAction
}

export function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 12) return false
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'string') return value.length <= 20_000
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length <= 1_000 && value.every((item) => isJsonValue(item, depth + 1))
  if (!isRecord(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  const entries = Object.entries(value)
  return entries.length <= 100 && entries.every(([key, item]) =>
    key.length <= 100
      && key !== '__proto__'
      && key !== 'prototype'
      && key !== 'constructor'
      && isJsonValue(item, depth + 1),
  )
}

function parseSnapshot(input: unknown, path: string, issues: ValidationIssue[]): GameSnapshot | null {
  const value = record(input, path, issues)
  if (!value) return null
  if (value.schemaVersion !== 1) issues.push({ path: `${path}.schemaVersion`, message: 'unsupported snapshot schema version' })
  if (!Number.isSafeInteger(value.revision) || Number(value.revision) < 0) {
    issues.push({ path: `${path}.revision`, message: 'must be a non-negative safe integer' })
  }
  requireEnum(value.gameId, GAME_IDS, `${path}.gameId`, issues)
  const phases: Record<GameId, readonly string[]> = {
    imposter: ['setup', 'reveal', 'discussion', 'voting', 'resolved'],
    guessup: ['setup', 'ready', 'playing', 'complete'],
    'truth-or-dare': ['setup', 'spin', 'choice', 'spinning', 'prompt', 'complete'],
    'never-have-i-ever': ['setup', 'spin', 'prompt', 'complete'],
    'timer-impostor': ['setup', 'private-reveal', 'attempts', 'voting', 'results'],
    werewolf: ['setup', 'private-reveal', 'night', 'day', 'voting', 'complete'],
    mafia: ['setup', 'private-reveal', 'night', 'day', 'voting', 'complete'],
    murder: ['setup', 'private-reveal', 'investigation', 'voting', 'results'],
    'fake-it': ['setup', 'private-reveal', 'questioning', 'guessing', 'results'],
    'fake-story': ['setup', 'private-reveal', 'storytelling', 'voting', 'results'],
    'fact-or-fiction': ['setup', 'private-reveal', 'answering', 'voting', 'results'],
    'wrong-answers-only': ['setup', 'answering', 'judging', 'results'],
    'hot-bomb': ['setup', 'playing', 'results'],
    'hot-bomb-duel': ['setup', 'playing', 'results'],
    'whos-most-likely': ['setup', 'voting', 'results'],
    'would-you-rather': ['setup', 'voting', 'results'],
    'share-or-pass': ['setup', 'prompt', 'complete'],
    'challenge-20': ['setup', 'bidding', 'judging', 'results'],
    'tilt-it': ['setup', 'ready', 'playing', 'round-results'],
    letterburg: ['setup', 'ready', 'playing', 'round-results'],
    'discussion-starter': ['setup', 'prompt', 'complete'],
    'who-am-i': ['setup', 'questioning', 'results'],
    'ten-tangle': ['setup', 'puzzle', 'results'],
    qupid: ['setup', 'prompt', 'complete'],
    'questions-for-love': ['setup', 'prompt', 'complete'],
    'a-or-b': ['setup', 'choosing', 'guessing', 'round-result', 'results'],
    'reverse-singing': ['setup', 'intro', 'recording', 'replay', 'results'],
  }
  if (typeof value.gameId === 'string' && GAME_IDS.includes(value.gameId as GameId)) {
    requireEnum(value.phase, phases[value.gameId as GameId], `${path}.phase`, issues)
  }
  if (!isRecord(value.state) || !isJsonValue(value.state)) {
    issues.push({ path: `${path}.state`, message: 'must be a bounded JSON object' })
  }
  return value as unknown as GameSnapshot
}

function validatePlayer(input: unknown, path: string, issues: ValidationIssue[]): void {
  const player = record(input, path, issues)
  if (!player) return
  requireId(player.id, 'id', `${path}.id`, issues)
  requireText(player.displayName, `${path}.displayName`, issues, 40)
}

function record(input: unknown, path: string, issues: ValidationIssue[]): Record<string, unknown> | null {
  if (!isRecord(input)) {
    issues.push({ path, message: 'must be an object' })
    return null
  }
  return input
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireId(value: unknown, _kind: string, path: string, issues: ValidationIssue[]): void {
  if (!isStableId(value)) issues.push({ path, message: 'must be a valid stable ID' })
}

function requireText(value: unknown, path: string, issues: ValidationIssue[], maxLength: number): void {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    issues.push({ path, message: `must be non-empty text no longer than ${maxLength} characters` })
  }
}

function requireTimestamp(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    issues.push({ path, message: 'must be a non-negative Unix epoch millisecond value' })
  }
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[], path: string, issues: ValidationIssue[]): void {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    issues.push({ path, message: `must be one of: ${allowed.join(', ')}` })
  }
}

function requireStringArray(value: unknown, path: string, issues: ValidationIssue[], maxItems: number, maxLength: number): void {
  if (!Array.isArray(value) || value.length > maxItems || value.some((entry) =>
    typeof entry !== 'string' || entry.trim().length === 0 || entry.length > maxLength,
  )) {
    issues.push({ path, message: `must be an array of up to ${maxItems} strings (max ${maxLength} characters each)` })
  }
}

function throwIfInvalid(issues: readonly ValidationIssue[]): void {
  if (issues.length > 0) throw new ContractValidationError(issues)
}
