export type GuessUpTiltAction = 'correct' | 'pass'

export interface GuessUpTiltTransition {
  readonly armed: boolean
  readonly action: GuessUpTiltAction | null
}

/**
 * Convert a device-orientation gamma reading into one edge-triggered action.
 * A new action is armed only after the device returns to the neutral band.
 */
export function transitionGuessUpTilt(gamma: number | null, armed: boolean): GuessUpTiltTransition {
  if (gamma === null || !Number.isFinite(gamma)) return { armed, action: null }
  if (Math.abs(gamma) < 10) return { armed: true, action: null }
  if (!armed) return { armed: false, action: null }
  if (gamma >= 25) return { armed: false, action: 'correct' }
  if (gamma <= -25) return { armed: false, action: 'pass' }
  return { armed: true, action: null }
}
