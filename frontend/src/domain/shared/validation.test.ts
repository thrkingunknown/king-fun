import { describe, expect, test } from 'bun:test'
import { SEEDED_CONTENT, SEEDED_PACKS } from '../../content/seed.ts'
import { GAME_IDS } from './contracts.ts'
import { asContentId, asPlayerId, asSessionId } from './ids.ts'
import { ContractValidationError, parseContentItem, parseContentPack, parseGameAction, parseGameSession } from './validation.ts'

const now = 1_799_999_000_000

const validSnapshot = {
  schemaVersion: 1,
  revision: 0,
  gameId: 'imposter',
  phase: 'setup',
  state: {},
} as const

const validSession = {
  schemaVersion: 1,
  id: asSessionId('session:test-1'),
  gameId: 'imposter',
  status: 'active',
  players: [{ id: asPlayerId('player:one'), displayName: 'Player One' }],
  snapshot: validSnapshot,
  createdAt: now,
  updatedAt: now,
} as const

const validAction = {
  type: 'content.commit',
  sessionId: asSessionId('session:test-1'),
  expectedRevision: 0,
  contentId: asContentId('content:one'),
  at: now,
} as const

describe('shared contract validation', () => {
  test('accepts every bundled content item and pack across the complete game registry', () => {
    expect(SEEDED_CONTENT.length).toBeGreaterThan(20)
    expect([...new Set(SEEDED_PACKS.map(pack => pack.gameId))].sort()).toEqual([...GAME_IDS].sort())
    expect(SEEDED_PACKS.filter(pack => pack.gameId === 'imposter' && pack.suitability !== 'adult')).toHaveLength(30)
    for (const item of SEEDED_CONTENT) expect(parseContentItem(item)).toEqual(item)
    for (const pack of SEEDED_PACKS) expect(parseContentPack(pack)).toEqual(pack)
  })

  test('accepts a valid resumable session', () => {
    expect(parseGameSession(validSession)).toEqual(validSession)
  })

  test('rejects duplicate player IDs and mismatched snapshot game IDs', () => {
    expect(() => parseGameSession({
      ...validSession,
      players: [validSession.players[0], validSession.players[0]],
    })).toThrow(ContractValidationError)

    expect(() => parseGameSession({
      ...validSession,
      snapshot: { ...validSnapshot, gameId: 'guessup' },
    })).toThrow(ContractValidationError)
  })

  test('rejects unknown schema versions, invalid phases, and unbounded JSON', () => {
    expect(() => parseGameSession({ ...validSession, schemaVersion: 2 })).toThrow(ContractValidationError)
    expect(() => parseGameSession({
      ...validSession,
      snapshot: { ...validSnapshot, phase: 'unknown-phase' },
    })).toThrow(ContractValidationError)
    expect(() => parseGameSession({
      ...validSession,
      snapshot: { ...validSnapshot, state: { bad: Number.POSITIVE_INFINITY } },
    })).toThrow(ContractValidationError)
    expect(() => parseGameSession({
      ...validSession,
      snapshot: { ...validSnapshot, state: { note: 'x'.repeat(20_001) } },
    })).toThrow(ContractValidationError)
  })

  test('rejects invalid content metadata and duplicate pack members', () => {
    const sample = SEEDED_CONTENT[0]!
    expect(() => parseContentItem({ ...sample, provenance: { ...sample.provenance, license: '' } }))
      .toThrow(ContractValidationError)
    expect(() => parseContentItem({ ...sample, gameId: 'imposter', kind: 'truth' }))
      .toThrow(ContractValidationError)

    const pack = SEEDED_PACKS[0]!
    expect(() => parseContentPack({ ...pack, contentIds: [pack.contentIds[0], pack.contentIds[0]] }))
      .toThrow(ContractValidationError)
  })

  test('keeps explicit adult vocabulary and intimate dares out of all-ages content', () => {
    const sample = SEEDED_CONTENT.find(item => item.suitability === 'general')!
    for (const text of ['BDSM', 'Hentai', 'Penis', 'Kiss the person next to you on the lips', 'Shout that you are gay', 'Make out with the person next to you']) {
      expect(() => parseContentItem({ ...sample, text, suitability: 'general' })).toThrow(ContractValidationError)
    }
    expect(() => parseContentItem({ ...sample, text: 'BDSM', suitability: 'adult' })).not.toThrow()
  })

  test('validates action-specific required data', () => {
    expect(parseGameAction(validAction)).toEqual(validAction)
    expect(() => parseGameAction({ ...validAction, contentId: undefined })).toThrow(ContractValidationError)
    expect(() => parseGameAction({ ...validAction, expectedRevision: -1 })).toThrow(ContractValidationError)
  })
})
