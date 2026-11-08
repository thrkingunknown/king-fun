import { canonicalizeContentText } from './canonicalize.ts'
type SelectableContent = { readonly id: string; readonly text: string }
type SuitabilityTagged = { readonly suitability?: 'general' | 'teen' | 'adult' }

/** Adult-tagged items are never eligible unless 18+ mode is explicitly enabled. */
export function contentAllowedForMode(item: SuitabilityTagged, adultMode: boolean): boolean {
  // Without the explicit 18+ opt-in, only the all-ages pool is eligible.
  // Legacy records with no suitability marker are treated as general, while
  // unknown future values fail closed instead of silently entering gameplay.
  if (item.suitability === undefined || item.suitability === 'general') return true
  return adultMode === true && (item.suitability === 'teen' || item.suitability === 'adult')
}

export function filterContentForMode<T extends SuitabilityTagged>(items: readonly T[], adultMode: boolean): T[] {
  return items.filter(item => contentAllowedForMode(item, adultMode))
}

/** Remove duplicate IDs and canonical text collisions while preserving display text. */
export function uniqueContentItems<T extends SelectableContent>(items: readonly T[]): T[] {
  const ids = new Set<string>()
  const texts = new Set<string>()
  const unique: T[] = []
  for (const item of items) {
    const canonical = canonicalizeContentText(item.text)
    if (!item.id || !canonical || ids.has(item.id) || texts.has(canonical)) continue
    ids.add(item.id)
    texts.add(canonical)
    unique.push(item)
  }
  return unique
}

/**
 * A recent queue and current-round seen set are both hard exclusions. Exhaustion
 * is represented by an empty result; callers must never silently relax either set.
 */
export function eligibleContentItems<T extends SelectableContent>(
  items: readonly T[],
  recentIds: readonly string[],
  seenIds: readonly string[] = [],
): T[] {
  const unique = uniqueContentItems(items)
  const recent = new Set(recentIds)
  const seen = new Set(seenIds)
  return unique.filter(item => !recent.has(item.id) && !seen.has(item.id))
}

export function appendRecentContent<T extends string>(current: readonly T[], id: T, capacity: number): T[] {
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new RangeError('Content history capacity must be a positive integer.')
  return [...current.filter(value => value !== id), id].slice(-capacity)
}

/** A small, deterministic reading-load heuristic used only by the creator's private Kailas profile. */
export function contentReadingLoad(text: string): number {
  const words = text.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? []
  if (words.length === 0) return Number.POSITIVE_INFINITY
  const averageLength = words.reduce((total, word) => total + word.length, 0) / words.length
  const longWords = words.filter(word => word.length >= 9).length
  const sentenceBreaks = (text.match(/[.!?;:]/g) ?? []).length
  const clauses = (text.match(/[,()]/g) ?? []).length
  return averageLength + longWords * 0.8 + sentenceBreaks * 0.65 + clauses * 0.2 + Math.max(0, words.length - 12) * 0.08
}

/** Returns the simplest third while retaining a small random choice set for variety. */
export function easiestContentSlice<T extends SelectableContent>(items: readonly T[]): T[] {
  if (items.length <= 1) return [...items]
  const ranked = [...items].sort((left, right) => contentReadingLoad(left.text) - contentReadingLoad(right.text) || left.id.localeCompare(right.id))
  return ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 3)))
}


export function isKailasCreatorTarget(creatorUnlocked: boolean, playerName: string | undefined): boolean {
  return creatorUnlocked && typeof playerName === 'string' && playerName.normalize('NFKC').trim().toLocaleLowerCase('en') === 'kailas'
}
