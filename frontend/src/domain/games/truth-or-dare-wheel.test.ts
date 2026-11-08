import { describe, expect, test } from 'bun:test'
import { TRUTH_DARE_WHEEL_OPTIONS, truthDareKindForIndex } from './truth-or-dare-wheel.ts'

describe('Truth or Dare challenge wheel', () => {
  test('exposes eight equal sectors with four Truth and four Dare outcomes', () => {
    expect(TRUTH_DARE_WHEEL_OPTIONS).toHaveLength(8)
    expect(TRUTH_DARE_WHEEL_OPTIONS.filter(kind => kind === 'truth')).toHaveLength(4)
    expect(TRUTH_DARE_WHEEL_OPTIONS.filter(kind => kind === 'dare')).toHaveLength(4)
  })

  test('maps every visual sector to its exact prompt kind', () => {
    TRUTH_DARE_WHEEL_OPTIONS.forEach((kind, index) => {
      expect(truthDareKindForIndex(index)).toBe(kind)
    })
  })

  test('rejects invalid or out-of-range segment indexes', () => {
    for (const index of [-1, 8, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => truthDareKindForIndex(index)).toThrow()
    }
  })
})
