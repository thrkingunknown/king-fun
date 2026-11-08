import { describe, expect, test } from 'bun:test'
import { transitionGuessUpTilt } from './guessup-tilt.ts'

describe('GuessUp tilt input hysteresis', () => {
  test('requires a neutral reading before the first action', () => {
    expect(transitionGuessUpTilt(30, false)).toEqual({ armed: false, action: null })
    expect(transitionGuessUpTilt(0, false)).toEqual({ armed: true, action: null })
    expect(transitionGuessUpTilt(30, true)).toEqual({ armed: false, action: 'correct' })
  })

  test('does not repeat while held beyond a threshold, even across rerenders', () => {
    const first = transitionGuessUpTilt(30, true)
    expect(first).toEqual({ armed: false, action: 'correct' })
    expect(transitionGuessUpTilt(34, first.armed)).toEqual({ armed: false, action: null })
    expect(transitionGuessUpTilt(31, false)).toEqual({ armed: false, action: null })
  })

  test('re-arms only inside the neutral band, then supports the opposite action', () => {
    expect(transitionGuessUpTilt(15, false)).toEqual({ armed: false, action: null })
    const neutral = transitionGuessUpTilt(9.9, false)
    expect(neutral).toEqual({ armed: true, action: null })
    expect(transitionGuessUpTilt(-25, neutral.armed)).toEqual({ armed: false, action: 'pass' })
  })

  test('ignores null and non-finite sensor readings without changing arming state', () => {
    expect(transitionGuessUpTilt(null, true)).toEqual({ armed: true, action: null })
    expect(transitionGuessUpTilt(Number.NaN, false)).toEqual({ armed: false, action: null })
    expect(transitionGuessUpTilt(Number.POSITIVE_INFINITY, true)).toEqual({ armed: true, action: null })
  })

  test('does not trigger inside the directional dead zone', () => {
    expect(transitionGuessUpTilt(24.9, true)).toEqual({ armed: true, action: null })
    expect(transitionGuessUpTilt(-24.9, true)).toEqual({ armed: true, action: null })
  })
})
