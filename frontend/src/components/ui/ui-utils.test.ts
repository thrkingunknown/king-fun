import { describe, expect, test } from 'bun:test'
import { formatDuration, progressPercent } from './ui-utils.ts'
import * as fc from 'fast-check'

describe('shared UI utilities', () => {
  test('clamps progress to the 0–100 range', () => {
    expect(progressPercent(25, 100)).toBe(25)
    expect(progressPercent(-1, 100)).toBe(0)
    expect(progressPercent(120, 100)).toBe(100)
    expect(progressPercent(1, 0)).toBe(0)
    expect(progressPercent(Number.NaN, 10)).toBe(0)
  })

  test('formats durations as minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(9)).toBe('0:09')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(125)).toBe('2:05')
    expect(formatDuration(-3)).toBe('0:00')
  })
})

describe('shared UI utility properties', () => {
  test('progress is always finite and bounded for finite numeric input', async () => {
    fc.assert(fc.property(
      fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true, noDefaultInfinity: true }),
      (value, max) => {
        const result = progressPercent(value, max)
        return Number.isFinite(result) && result >= 0 && result <= 100
      },
    ), { numRuns: 500 })
  })

  test('formatted durations are always canonical M:SS strings', async () => {
    fc.assert(fc.property(fc.integer({ min: -1_000_000, max: 100_000_000 }), seconds => {
      const formatted = formatDuration(seconds)
      return /^\d+:[0-5]\d$/.test(formatted)
    }), { numRuns: 500 })
  })
})
