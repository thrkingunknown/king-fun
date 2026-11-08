import { describe, expect, test } from 'bun:test'
import { SEEDED_CONTENT } from '../../content/seed.ts'
import { canonicalizeContentText, findDuplicateContent } from './canonicalize.ts'

describe('content canonicalization', () => {
  test('normalizes Unicode, case, whitespace, and punctuation for comparisons', () => {
    expect(canonicalizeContentText('  HELLO—World! ')).toBe('helloworld')
    expect(canonicalizeContentText('Ｆｏｏ　Ｂａｒ')).toBe('foobar')
  })

  test('each game content pool contains no canonical duplicate prompts', () => {
    const gameIds = [...new Set(SEEDED_CONTENT.map(item => item.gameId))]
    const duplicates = gameIds.flatMap(gameId =>
      findDuplicateContent(SEEDED_CONTENT.filter(item => item.gameId === gameId)),
    )
    expect(duplicates).toEqual([])
  })

  test('detects duplicates without changing display text', () => {
    const items = [
      { id: 'one', text: 'Coffee break!' },
      { id: 'two', text: ' coffee-break ' },
      { id: 'three', text: 'A fresh prompt' },
    ]
    expect(findDuplicateContent(items)).toEqual([['one', 'two']])
    expect(items[0]?.text).toBe('Coffee break!')
  })
})
