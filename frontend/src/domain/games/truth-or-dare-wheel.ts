export const TRUTH_DARE_WHEEL_OPTIONS = [
  'truth', 'dare', 'truth', 'dare',
  'truth', 'dare', 'truth', 'dare',
] as const
export type TruthDareWheelOption = typeof TRUTH_DARE_WHEEL_OPTIONS[number]

/** Resolve a committed, cryptographically selected wheel sector to its prompt kind. */
export function truthDareKindForIndex(index: number): TruthDareWheelOption {
  if (!Number.isSafeInteger(index) || index < 0 || index >= TRUTH_DARE_WHEEL_OPTIONS.length) {
    throw new RangeError(`Truth/Dare wheel selection must be between 0 and ${TRUTH_DARE_WHEEL_OPTIONS.length - 1}.`)
  }
  return TRUTH_DARE_WHEEL_OPTIONS[index]!
}
