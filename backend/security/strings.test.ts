import { describe, expect, test } from 'bun:test'
import { hasControlCharacters } from './strings.ts'

describe('hasControlCharacters', () => {
  test('accepts ordinary text and printable Unicode', () => {
    expect(hasControlCharacters('King-FUN — 海洋生物 🐠')).toBe(false)
  })

  test('rejects C0 control characters and DEL', () => {
    for (const value of ['\u0000', '\u0008', '\u0009', '\u000a', '\u001f', '\u007f']) {
      expect(hasControlCharacters(`safe${value}text`)).toBe(true)
    }
  })
})
