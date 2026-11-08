import { describe, expect, test } from 'bun:test'
import { wheelAngleForPlayer, wheelAngleForSegment } from '../../domain/games/roulette.ts'
import { TRUTH_DARE_WHEEL_OPTIONS } from '../../domain/games/truth-or-dare-wheel.ts'
import type { Player } from '../../types.ts'

const players: Player[] = [
  { id: 'p1', name: 'Alex' },
  { id: 'p2', name: 'Sam' },
  { id: 'p3', name: 'Jamie' },
  { id: 'p4', name: 'Riley' },
]

function normalize(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

describe('roulette outcome geometry', () => {
  test('lands each selected segment centre at the fixed top pointer', () => {
    players.forEach((player, index) => {
      const finalAngle = wheelAngleForPlayer(players, player.id, 0, 5)
      const centre = (index + 0.5) * (360 / players.length)
      expect(Math.abs(normalize(finalAngle + centre) - 0)).toBeLessThan(1e-8)
    })
  })

  test('continues forward from an existing wheel rotation and adds full turns', () => {
    const current = 1_247
    const finalAngle = wheelAngleForPlayer(players, 'p3', current, 4)
    expect(finalAngle).toBeGreaterThan(current + 4 * 360 - 1)
    const centre = (2 + 0.5) * (360 / players.length)
    expect(Math.abs(normalize(finalAngle + centre))).toBeLessThan(1e-8)
  })

  test('returns a forward rotation for a missing selection without throwing', () => {
    expect(wheelAngleForPlayer(players, 'missing', 90, 3)).toBe(1_170)
  })

  test('lands every sector of two-, four-, and eight-segment wheels under the pointer', () => {
    for (const segmentCount of [2, 4, TRUTH_DARE_WHEEL_OPTIONS.length]) {
      for (let index = 0; index < segmentCount; index += 1) {
        const finalAngle = wheelAngleForSegment(segmentCount, index, 725, 5)
        const centre = (index + 0.5) * (360 / segmentCount)
        expect(finalAngle).toBeGreaterThan(725 + 5 * 360 - 1)
        expect(Math.abs(normalize(finalAngle + centre))).toBeLessThan(1e-8)
      }
    }
  })

  test('rejects invalid segment geometry and safely handles an invalid outcome index', () => {
    expect(() => wheelAngleForSegment(0, 0)).toThrow()
    expect(() => wheelAngleForSegment(2, 0, Number.NaN)).toThrow()
    expect(wheelAngleForSegment(2, 4, 90, 2)).toBe(810)
  })
})
