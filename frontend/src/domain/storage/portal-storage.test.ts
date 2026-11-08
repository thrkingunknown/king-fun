import { describe, expect, test } from 'bun:test'
import {
  DATABASE_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
  StorageConflictError,
  exportPortalBackup,
  migrateSnapshot,
  parsePortalBackup,
  pruneSnapshotHistory,
  validateCustomPackCollection,
  validateStoredCustomPackRecord,
} from './portal-storage.ts'

describe('IndexedDB persistence contracts', () => {
  test('TEST-STOR-003: database and snapshot schemas are versioned', () => {
    expect(DATABASE_VERSION).toBe(2)
    expect(SNAPSHOT_SCHEMA_VERSION).toBe(2)
  })

  test('TEST-STOR-006: migrates a version 1 snapshot without changing its revision', () => {
    const migrated = migrateSnapshot({
      key: 'current',
      schemaVersion: 1,
      revision: 7,
      updatedAt: 123,
      value: { theme: 'light', history: [] },
    }, { theme: 'dark', players: [] })
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.revision).toBe(7)
    expect(migrated.value).toEqual({ theme: 'light', players: [], history: [] })
  })

  test('TEST-STOR-007: rejects future, unknown, and malformed schema records', () => {
    expect(() => migrateSnapshot({
      key: 'current', schemaVersion: 99, revision: 1, updatedAt: 1, value: {},
    }, {})).toThrow('Unsupported snapshot schema version')
    expect(() => migrateSnapshot({
      key: 'current', schemaVersion: 2, revision: -1, updatedAt: 1, value: {},
    }, {})).toThrow('invalid revision')
    expect(() => migrateSnapshot({
      key: 'current', schemaVersion: 2, revision: 1, updatedAt: 1, value: null,
    }, {})).toThrow('malformed')
  })

  test('rejects snapshots with an invalid key or timestamp', () => {
    expect(() => migrateSnapshot({ key: 'other', schemaVersion: 2, revision: 1, updatedAt: 1, value: {} }, {})).toThrow('invalid key')
    expect(() => migrateSnapshot({ key: 'current', schemaVersion: 2, revision: 1, updatedAt: -1, value: {} }, {})).toThrow('timestamp')
  })

  test('parses versioned backups and normalizes the imported snapshot', () => {
    const parsed = parsePortalBackup({
      format: 'king-fun-backup',
      schemaVersion: 2,
      exportedAt: 100,
      snapshot: { key: 'current', schemaVersion: 2, revision: 8, updatedAt: 99, value: { theme: 'light' } },
      customPacks: [],
    }, { theme: 'dark', players: [] }, value => ({ ...(value as object), imported: true }))
    expect(parsed.value).toEqual({ theme: 'light', imported: true })
    expect(parsed.customPacks).toHaveLength(0)
  })

  test('exports the current memory snapshot without reading stale IndexedDB state', async () => {
    const backup = await exportPortalBackup({ theme: 'light', players: [] }, 4, [], undefined, true)
    expect(backup.format).toBe('king-fun-backup')
    expect(backup.snapshot.revision).toBe(4)
    expect(backup.snapshot.value).toEqual({ theme: 'light', players: [] })
    expect(backup.customPacks).toEqual([])
  })

  test('validates custom-pack collection bounds before opening IndexedDB', () => {
    expect(() => validateCustomPackCollection(Array.from({ length: 201 }, () => ({})))).toThrow('maximum of 200')
    expect(validateCustomPackCollection([])).toEqual([])
  })

  test('rejects custom packs whose item suitability does not match pack suitability', async () => {
    const { SEEDED_CONTENT, SEEDED_PACKS } = await import('../../content/seed.ts')
    const item = SEEDED_CONTENT.find(value => value.suitability === 'general')!
    const pack = SEEDED_PACKS.find(value => value.id === item.packId)!
    const record = {
      id: pack.id, schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision: 1, updatedAt: 100,
      pack: { ...pack, contentIds: [item.id] },
      items: [{ ...item, suitability: 'adult' as const }],
    }
    expect(() => validateStoredCustomPackRecord(record)).toThrow('mismatched or duplicate content')
  })

  test('rejects backups with unsupported formats, schemas, or missing pack arrays', () => {
    const validSnapshot = { key: 'current', schemaVersion: 2, revision: 1, updatedAt: 1, value: {} }
    expect(() => parsePortalBackup({ format: 'other', schemaVersion: 2, snapshot: validSnapshot, customPacks: [] }, {}, value => value)).toThrow('not a King-Fun backup')
    expect(() => parsePortalBackup({ format: 'king-fun-backup', schemaVersion: 99, exportedAt: Date.now(), snapshot: validSnapshot, customPacks: [] }, {}, value => value)).toThrow('not supported')
    expect(() => parsePortalBackup({ format: 'king-fun-backup', schemaVersion: 2, exportedAt: Date.now(), snapshot: validSnapshot }, {}, value => value)).toThrow('custom-pack list')
    expect(() => parsePortalBackup({ format: 'king-fun-backup', schemaVersion: 2, exportedAt: -1, snapshot: validSnapshot, customPacks: [] }, {}, value => value)).toThrow('timestamp')
    expect(() => parsePortalBackup({ schemaVersion: 2, exportedAt: Date.now(), snapshot: validSnapshot, customPacks: [] }, {}, value => value)).toThrow('not a King-Fun backup')
  })

  test('TEST-STOR-010: stale revision conflicts are explicit errors', () => {
    const error = new StorageConflictError(12)
    expect(error).toBeInstanceOf(Error)
    expect(error.remoteRevision).toBe(12)
    expect(error.message).toContain('revision 12')
  })
})

  describe('local retention policy', () => {
    test('TEST-STOR-005A: history is retained for at most 30 days and 100 entries', () => {
      const now = 2_000_000_000_000
      const recent = Array.from({ length: 105 }, (_, index) => ({
        id: `h-${index}`,
        at: now - index * 1000,
      }))
      const stale = { id: 'old', at: now - 31 * 24 * 60 * 60 * 1000 }
      const result = pruneSnapshotHistory({ history: [...recent, stale], marker: true }, now)
      expect(result.history).toHaveLength(100)
      expect(result.history[0]?.id).toBe('h-0')
      expect(result.marker).toBe(true)
    })
  })
