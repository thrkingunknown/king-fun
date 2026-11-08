import { describe, expect, test } from 'bun:test'
import { assertImposterPackImportSize, MAX_IMPOSTER_PACK_IMPORT_BYTES, parseImposterPackImport, validateImposterPackEntries } from './imposter-pack.ts'

describe('Mystery Who custom word packs', () => {
  test('bounds imported file size before parsing or reading its contents', () => {
    expect(() => assertImposterPackImportSize(0)).not.toThrow()
    expect(() => assertImposterPackImportSize(MAX_IMPOSTER_PACK_IMPORT_BYTES)).not.toThrow()
    expect(() => assertImposterPackImportSize(MAX_IMPOSTER_PACK_IMPORT_BYTES + 1)).toThrow('1 MB or smaller')
    expect(() => assertImposterPackImportSize(-1)).toThrow('size is invalid')
    expect(() => assertImposterPackImportSize(Number.POSITIVE_INFINITY)).toThrow('size is invalid')
  })

  test('accepts one to twenty non-empty hints for each unique word', () => {
    const entries = validateImposterPackEntries([
      'Lantern | Light | Portable | Glass panels',
      'Compass | North | Magnetic needle',
    ])
    expect(entries).toHaveLength(2)
    expect(validateImposterPackEntries([
      `Map | ${Array.from({ length: 20 }, (_, index) => `Clue ${index + 1}`).join(' | ')}`,
      'Atlas | Geography | Pages',
    ])).toHaveLength(2)
  })

  test('rejects missing words, missing hints, empty hints, excessive hints, and duplicate words', () => {
    expect(() => validateImposterPackEntries([' | clue', 'Map | paper'])).toThrow('needs a secret word')
    expect(() => validateImposterPackEntries(['Map', 'Atlas | pages'])).toThrow('1–20 non-empty hints')
    expect(() => validateImposterPackEntries(['Map | paper | ', 'Atlas | pages'])).toThrow('1–20 non-empty hints')
    expect(() => validateImposterPackEntries([`Map | ${Array.from({ length: 21 }, () => 'clue').join(' | ')}`, 'Atlas | pages'])).toThrow('1–20')
    expect(() => validateImposterPackEntries(['Map | paper', ' map  | Cartography'])).toThrow('duplicate secret words')
    expect(() => validateImposterPackEntries(['Map | Map | Paper', 'Atlas | Pages'])).toThrow('must not reveal')
    expect(() => validateImposterPackEntries(['Lantern | A lantern is useful', 'Compass | North'])).toThrow('must not reveal')
    expect(() => validateImposterPackEntries(['Lantern | Lantern!', 'Compass | North'])).toThrow('must not reveal')
    expect(() => validateImposterPackEntries(['Map | Paper | paper', 'Atlas | Pages'])).toThrow('duplicate hints')
  })

  test('imports TXT files and preserves names with normalized rows', () => {
    expect(parseImposterPackImport('Lantern | Light | Glass\r\nCompass | North | Needle', 'Outdoor.txt')).toEqual({
      name: 'Outdoor',
      emoji: '🃏',
      description: 'Imported local word pack.',
      entries: ['Lantern | Light | Glass', 'Compass | North | Needle'],
    })
  })

  test('imports JSON packs and validates the document shape and metadata', () => {
    const imported = parseImposterPackImport(JSON.stringify({
      name: 'Travel kit', emoji: '🧭', description: 'A small themed word set.',
      words: [{ word: 'Passport', hints: ['Border', 'Identity'] }, { word: 'Suitcase', hints: ['Luggage', 'Handle'] }],
    }), 'custom.json')
    expect(imported.name).toBe('Travel kit')
    expect(imported.emoji).toBe('🧭')
    expect(imported.entries).toEqual(['Passport | Border | Identity', 'Suitcase | Luggage | Handle'])
    expect(() => parseImposterPackImport('{', 'broken.json')).toThrow('not valid JSON')
    expect(() => parseImposterPackImport(JSON.stringify({ words: [{ word: 'No clues', hints: [] }, { word: 'Another', hints: ['x'] }] }), 'bad.json')).toThrow('1–20')
    expect(() => parseImposterPackImport(JSON.stringify({ name: 'x'.repeat(81), words: [{ word: 'Map', hints: ['Paper'] }, { word: 'Atlas', hints: ['Pages'] }] }), 'bad.json')).toThrow('name must')
  })
})
