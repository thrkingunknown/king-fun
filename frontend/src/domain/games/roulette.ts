import type { Player } from '../../types.ts'

/**
 * Calculate the final clockwise rotation that places a segment centre below a
 * fixed top pointer. Selection is committed by the caller before motion starts.
 */
export function wheelAngleForSegment(
  segmentCount: number,
  selectedIndex: number,
  currentAngle = 0,
  extraTurns = 5,
): number {
  if (!Number.isSafeInteger(segmentCount) || segmentCount < 1) {
    throw new RangeError('Wheel segment count must be a positive integer.')
  }
  if (!Number.isFinite(currentAngle) || !Number.isSafeInteger(extraTurns) || extraTurns < 0) {
    throw new RangeError('Wheel rotation and extra turn count must be valid.')
  }
  if (!Number.isSafeInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= segmentCount) {
    return currentAngle + extraTurns * 360
  }
  const segmentCenter = (selectedIndex + 0.5) * (360 / segmentCount)
  const currentModulo = ((currentAngle % 360) + 360) % 360
  const delta = (360 - segmentCenter - currentModulo + 360) % 360
  return currentAngle + extraTurns * 360 + delta
}

/** Player-specific compatibility wrapper used by the local turn wheel. */
export function wheelAngleForPlayer(
  players: readonly Pick<Player, 'id'>[],
  chosenId: string,
  currentAngle = 0,
  extraTurns = 5,
): number {
  const index = players.findIndex(player => player.id === chosenId)
  if (index < 0 || players.length === 0) {
    if (!Number.isFinite(currentAngle) || !Number.isSafeInteger(extraTurns) || extraTurns < 0) {
      throw new RangeError('Wheel rotation and extra turn count must be valid.')
    }
    return currentAngle + extraTurns * 360
  }
  return wheelAngleForSegment(players.length, index, currentAngle, extraTurns)
}
