import { describe, expect, test } from 'bun:test'
import { INITIAL_SAVE, normalizeImportedSave, normalizeSave, resolveGameRoster } from './types.ts'

describe('application save normalization', () => {
  test('keeps valid player state and fills missing preference defaults', () => {
    const save = normalizeSave({
      players: [{ id: 'p-a', name: ' Ada ' }, { id: 'p-b', name: 'Lin' }],
      theme: 'light',
      history: [],
      active: null,
    })
    expect(save.players).toEqual([{ id: 'p-a', name: 'Ada' }, { id: 'p-b', name: 'Lin' }])
    expect(save.theme).toBe('light')
    expect(save.motionPreference).toBe('system')
    expect(save.imposterPreferences).toEqual(INITIAL_SAVE.imposterPreferences)
  })


  test('requires a fresh 18+ opt-in after importing a backup and never restores an adult active session', () => {
    const imported = normalizeImportedSave({
      adultMode: true,
      active: { game: 'truth-or-dare', phase: 'prompt', data: { adultMode: true, prompt: 'Adult prompt' } },
      players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    })
    expect(imported.adultMode).toBe(false)
    expect(imported.active).toBeNull()
    expect(imported.players).toHaveLength(2)
  })

  test('drops invalid and duplicate players without changing valid roster order', () => {
    const save = normalizeSave({ players: [
      { id: 'one', name: 'Alex' },
      { id: 'two', name: ' alex ' },
      { id: 'one', name: 'Jamie' },
      { id: 'four', name: 'Sam' },
      { id: '', name: 'No ID' },
    ] })
    expect(save.players).toEqual([{ id: 'one', name: 'Alex' }, { id: 'four', name: 'Sam' }])
  })

  test('bounds recent queues and prunes malformed or expired history', () => {
    const now = Date.now()
    const save = normalizeSave({
      recent: { 'content:guessup:food:word:en': Array.from({ length: 130 }, (_, index) => `id-${index}`) },
      history: [
        { id: 'new', game: 'guessup', title: 'Recent', detail: '', at: now },
        { id: 'expired', game: 'guessup', title: 'Old', detail: '', at: now - 31 * 86_400_000 },
        { id: 'invalid', game: 'unknown', title: 'Bad', detail: '', at: now },
      ],
    })
    expect(save.recent['content:guessup:food:word:en']).toHaveLength(100)
    expect(save.recent['content:guessup:food:word:en']?.[0]).toBe('id-30')
    expect(save.history.map(item => item.id)).toEqual(['new'])
  })

  test('rejects malformed active snapshots and normalizes configuration bounds', () => {
    const save = normalizeSave({
      active: { game: 'imposter', phase: 'reveal', data: { word: 'Secret', nested: { ok: true } } },
      imposterPreferences: { mode: 'chaos', mysticCount: 99, discussionSeconds: 652, votingEnabled: false },
      guessUpPreferences: { durationSeconds: 77, inputMode: 'unknown', soundEnabled: true },
      motionPreference: 'invalid',
    })
    expect(save.active?.data.word).toBe('Secret')
    expect(save.imposterPreferences?.mysticCount).toBe(4)
    expect(save.imposterPreferences?.discussionSeconds).toBe(600)
    expect(save.imposterPreferences?.votingEnabled).toBe(false)
    expect(save.guessUpPreferences?.durationSeconds).toBe(60)
    expect(save.guessUpPreferences?.inputMode).toBe('touch')
    expect(save.motionPreference).toBe('system')

    const malformed = normalizeSave({ active: { game: 'imposter', phase: 'reveal', data: { secret: BigInt(1) } } })
    expect(malformed.active).toBeNull()
  })



  test('uses and validates the saved game roster rather than a later global roster', () => {
    const fallback = [{ id: 'global-a', name: 'Global A' }]
    expect(resolveGameRoster(undefined, fallback)).toEqual(fallback)
    expect(resolveGameRoster([
      { id: 'round-a', name: 'Ada' },
      { id: 'round-b', name: 'Lin' },
      { id: 'round-a', name: 'Duplicate ID' },
      { id: 'round-c', name: ' ada ' },
      { id: '', name: 'Invalid' },
    ], fallback)).toEqual([{ id: 'round-a', name: 'Ada' }, { id: 'round-b', name: 'Lin' }])
    expect(resolveGameRoster([], fallback)).toEqual([])
  })

  test('keeps only bounded, valid local prompt reports in completed game history', () => {
    const now = Date.now()
    const save = normalizeSave({ history: [{
      id: 'reported-round', game: 'never-have-i-ever', title: 'Session ended', detail: '3 statements', at: now,
      reports: [
        { contentId: 'content:1', reason: 'unsafe', note: '  Please review this  ', at: now },
        { contentId: 'content:2', reason: 'unknown', note: 'invalid reason', at: now },
        { contentId: 'content:3', reason: 'spelling', note: 'x'.repeat(300), at: now },
      ],
    }] })
    expect(save.history[0]?.reports).toEqual([
      { contentId: 'content:1', reason: 'unsafe', note: 'Please review this', at: now },
      { contentId: 'content:3', reason: 'spelling', note: 'x'.repeat(240), at: now },
    ])
  })

  test('caps history and rejects unbounded/cyclic active data', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const save = normalizeSave({ active: { game: 'guessup', phase: 'playing', data: cyclic } })
    expect(save.active).toBeNull()
  })

  test('keeps only the latest fifty valid prompt reports', () => {
    const now = Date.now()
    const reports = Array.from({ length: 60 }, (_, index) => ({
      contentId: `prompt-${index}`,
      reason: 'category',
      note: `Review ${index}`,
      at: now,
    }))
    const save = normalizeSave({ history: [{
      id: 'report-limit', game: 'guessup', title: 'Round completed', detail: 'Finished', at: now, reports,
    }] })
    const retained = save.history[0]?.reports ?? []
    expect(retained).toHaveLength(50)
    expect(retained[0]?.contentId).toBe('prompt-10')
    expect(retained.at(-1)?.contentId).toBe('prompt-59')
  })

})
