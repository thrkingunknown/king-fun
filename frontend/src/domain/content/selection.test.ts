import { describe, expect, test } from 'bun:test'
import { appendRecentContent, contentAllowedForMode, eligibleContentItems, filterContentForMode, uniqueContentItems } from './selection.ts'

const items = [
  { id: 'a', text: 'Coffee!' },
  { id: 'b', text: ' coffee ' },
  { id: 'c', text: 'Lighthouse' },
  { id: 'd', text: 'Skateboard' },
]

describe('local content selection', () => {
  test('deduplicates stable IDs and canonicalized display text', () => {
    expect(uniqueContentItems(items).map(item => item.id)).toEqual(['a', 'c', 'd'])
  })

  test('recent and current-round IDs are hard exclusions', () => {
    expect(eligibleContentItems(items, ['a'], ['c']).map(item => item.id)).toEqual(['d'])
  })

  test('returns explicit exhaustion instead of silently relaxing the window', () => {
    expect(eligibleContentItems(items, ['a', 'c', 'd'], []).map(item => item.id)).toEqual([])
  })

  test('recent FIFO moves repeated IDs to the newest position and stays bounded', () => {
    expect(appendRecentContent(['a', 'b', 'c'], 'b', 3)).toEqual(['a', 'c', 'b'])
    expect(appendRecentContent(['a', 'b', 'c'], 'd', 3)).toEqual(['b', 'c', 'd'])
  })
})


describe('private creator difficulty selection', () => {
  test('ranks simpler wording ahead of longer and more complex prompts', async () => {
    const { easiestContentSlice } = await import('./selection.ts')
    const pool = [
      { id: 'complex', text: 'Describe the extraordinary circumstances surrounding an international expedition.' },
      { id: 'simple', text: 'Name a fruit.' },
      { id: 'middle', text: 'What food do you enjoy eating most?' },
    ]
    expect(easiestContentSlice(pool).map(item => item.id)).toEqual(['simple'])
  })
  test('keeps at least one choice and never mutates the source pool', async () => {
    const { easiestContentSlice } = await import('./selection.ts')
    const pool = [{ id: 'only', text: 'Go.' }]
    expect(easiestContentSlice(pool)).toEqual(pool)
    expect(pool).toHaveLength(1)
  })
})


describe('creator-only player targeting', () => {
  test('matches Kailas case-insensitively only while creator access is unlocked', async () => {
    const { isKailasCreatorTarget } = await import('./selection.ts')
    expect(isKailasCreatorTarget(true, 'Kailas')).toBe(true)
    expect(isKailasCreatorTarget(true, '  KAILAS  ')).toBe(true)
    expect(isKailasCreatorTarget(false, 'Kailas')).toBe(false)
    expect(isKailasCreatorTarget(true, 'Kai')).toBe(false)
    expect(isKailasCreatorTarget(true, undefined)).toBe(false)
  })
})


describe('18+ suitability boundary', () => {
  const content = [
    { id: 'safe', text: 'A safe prompt', suitability: 'general' as const },
    { id: 'teen', text: 'A teen prompt', suitability: 'teen' as const },
    { id: 'adult', text: 'An adult prompt', suitability: 'adult' as const },
  ]
  test('adult content is excluded by default and admitted only with explicit adult mode', () => {
    expect(filterContentForMode(content, false).map(item => item.id)).toEqual(['safe'])
    expect(filterContentForMode(content, true).map(item => item.id)).toEqual(['safe', 'teen', 'adult'])
    expect(contentAllowedForMode(content[2]!, false)).toBe(false)
    expect(contentAllowedForMode(content[2]!, true)).toBe(true)
  })
  test('missing suitability metadata is treated as non-adult for legacy local content', () => {
    expect(contentAllowedForMode({ id: 'legacy', text: 'Legacy prompt' }, false)).toBe(true)
    expect(contentAllowedForMode({ id: 'future', text: 'Unknown suitability', suitability: 'future' as never }, false)).toBe(false)
  })
})
