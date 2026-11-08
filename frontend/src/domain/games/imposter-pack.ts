import { canonicalizeContentText } from '../content/canonicalize.ts'

export const MAX_IMPOSTER_PACK_IMPORT_BYTES = 1024 * 1024

export function assertImposterPackImportSize(byteLength: number): void {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
    throw new Error('The import file size is invalid.')
  }
  if (byteLength > MAX_IMPOSTER_PACK_IMPORT_BYTES) {
    throw new Error('Import files must be 1 MB or smaller.')
  }
}

function containsSecretWord(hint: string, word: string): boolean {
  const wordTokens = word.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  const hintTokens = hint.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  if (wordTokens.length === 0 || hintTokens.length < wordTokens.length) return false
  return hintTokens.some((_, start) => wordTokens.every((token, offset) => hintTokens[start + offset] === token))
}

export interface ImposterPackImport {
  readonly name: string
  readonly emoji: string
  readonly description: string
  readonly entries: readonly string[]
}

export function validateImposterPackEntries(input: readonly string[]): string[] {
  const entries = input.map(entry => entry.trim()).filter(Boolean)
  if (entries.length < 2) throw new Error('Add at least two secret words, one per line.')
  if (entries.length > 100) throw new Error('A custom Imposter category can contain at most 100 words.')

  const words: string[] = []
  for (const [index, entry] of entries.entries()) {
    const [rawWord = '', ...rawHints] = entry.split('|')
    const word = rawWord.trim()
    const hints = rawHints.map(hint => hint.trim())
    if (!word) throw new Error(`Entry ${index + 1} needs a secret word before the first |.`)
    if (word.length > 240) throw new Error(`Secret word ${index + 1} must be 240 characters or fewer.`)
    if (hints.length < 1 || hints.length > 20 || hints.some(hint => !hint)) {
      throw new Error(`Entry ${index + 1} needs 1–20 non-empty hints after the secret word.`)
    }
    if (hints.some(hint => hint.length > 240)) {
      throw new Error(`Each hint in entry ${index + 1} must be 240 characters or fewer.`)
    }
    const canonicalHints = hints.map(canonicalizeContentText)
    if (canonicalHints.includes(canonicalizeContentText(word)) || hints.some(hint => containsSecretWord(hint, word))) {
      throw new Error(`A Mystic hint in entry ${index + 1} must not reveal its secret word.`)
    }
    if (new Set(canonicalHints).size !== canonicalHints.length) {
      throw new Error(`Entry ${index + 1} contains duplicate hints. Use distinct clues.`)
    }
    words.push(word)
  }

  const canonicalWords = words.map(canonicalizeContentText)
  if (new Set(canonicalWords).size !== canonicalWords.length) {
    throw new Error('This category contains duplicate secret words. Remove duplicates before saving.')
  }
  return entries
}

export function parseImposterPackImport(raw: string, fileName: string): ImposterPackImport {
  const isJson = fileName.toLowerCase().endsWith('.json')
  const fallbackName = fileName.replace(/\.(json|txt)$/i, '').trim() || 'Imported category'
  if (!isJson) {
    const entries = validateImposterPackEntries(raw.split(/\r?\n/))
    return { name: fallbackName.slice(0, 80), emoji: '🃏', description: 'Imported local word pack.', entries }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('The JSON file is not valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON must contain an object with a words array.')
  }
  const source = parsed as Record<string, unknown>
  if (!Array.isArray(source.words)) throw new Error('JSON must contain a words array.')
  const entries = source.words.map((value, index) => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Word ${index + 1} must be a string or an object.`)
    }
    const row = value as Record<string, unknown>
    if (typeof row.word !== 'string' || !Array.isArray(row.hints) || row.hints.some(hint => typeof hint !== 'string')) {
      throw new Error(`Word ${index + 1} must contain a word and a string hints array.`)
    }
    return [row.word, ...row.hints].join(' | ')
  })
  const validEntries = validateImposterPackEntries(entries)
  const name = typeof source.name === 'string' ? source.name.trim() : fallbackName
  const emoji = typeof source.emoji === 'string' ? source.emoji.trim() : '🃏'
  const description = typeof source.description === 'string' ? source.description.trim() : 'Imported local word pack.'
  if (!name || name.length > 80) throw new Error('The imported category name must contain 1–80 characters.')
  if (emoji.length > 16) throw new Error('The imported category emoji must be 16 characters or fewer.')
  if (!description || description.length > 240) throw new Error('The imported category description must contain 1–240 characters.')
  return { name, emoji: emoji || '🃏', description, entries: validEntries }
}
