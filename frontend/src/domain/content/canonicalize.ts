/** Produces a comparison key without mutating or replacing the display text. */
export function canonicalizeContentText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, '')
}

export function findDuplicateContent<T extends { readonly id: string; readonly text: string }>(
  items: readonly T[],
): readonly (readonly [string, string])[] {
  const firstByCanonicalText = new Map<string, string>()
  const duplicates: Array<readonly [string, string]> = []

  for (const item of items) {
    const canonical = canonicalizeContentText(item.text)
    if (canonical.length === 0) continue
    const existingId = firstByCanonicalText.get(canonical)
    if (existingId) duplicates.push([existingId, item.id])
    else firstByCanonicalText.set(canonical, item.id)
  }

  return duplicates
}
