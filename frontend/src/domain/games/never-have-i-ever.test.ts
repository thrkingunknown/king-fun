import { describe, expect, test } from 'bun:test'
import { recordNeverHaveResponse } from './never-have-i-ever.ts'

const roster = [{ id: 'p1' }, { id: 'p2' }]

describe('I Have Never response recording', () => {
  test('records one response per player and rejects a second response for that prompt', () => {
    const first = recordNeverHaveResponse({ playerRoster: roster, responseByPlayer: {}, responses: 0 }, 'p1', true, 'fingers')!
    expect(first.responseByPlayer).toEqual({ p1: true })
    expect(first.responses).toBe(1)
    expect(recordNeverHaveResponse(first, 'p1', false, 'fingers')).toBeNull()
    expect(recordNeverHaveResponse({ ...first, playerRoster: roster }, 'p2', false, 'fingers')?.noResponses).toBe(1)
  })

  test('adds personal points only for yes responses in points mode', () => {
    const yes = recordNeverHaveResponse({ playerRoster: roster, responseByPlayer: {}, playerPoints: {} }, 'p1', true, 'points')!
    expect(yes.playerPoints).toEqual({ p1: 1 })
    const no = recordNeverHaveResponse({ playerRoster: roster, responseByPlayer: {}, playerPoints: {} }, 'p1', false, 'points')!
    expect(no.playerPoints).toEqual({})
    const story = recordNeverHaveResponse({ playerRoster: roster, responseByPlayer: {}, playerPoints: {} }, 'p2', true, 'stories')!
    expect(story.playerPoints).toEqual({})
  })

  test('rejects an empty or unknown player identifier and invalid response types', () => {
    expect(recordNeverHaveResponse({}, 'p1', true, 'fingers')).toBeNull()
    expect(recordNeverHaveResponse({}, '  ', true, 'fingers')).toBeNull()
    expect(recordNeverHaveResponse({ playerRoster: roster }, 'unknown', true, 'fingers')).toBeNull()
    expect(recordNeverHaveResponse({ playerRoster: roster }, 'p1', 'yes' as unknown as boolean, 'fingers')).toBeNull()
  })
})
