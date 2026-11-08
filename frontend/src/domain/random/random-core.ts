/** Internal seam for deterministic tests. Production entry points never accept an injected source. */
export interface RandomSource {
  /** Uniform integer in [0, 2^53). */
  nextUint53(): number
}

const RANDOM_RANGE = 2 ** 53

export function randomIntegerFromSource(exclusiveMax: number, source: RandomSource): number {
  if (!Number.isSafeInteger(exclusiveMax) || exclusiveMax <= 0) {
    throw new RangeError('exclusiveMax must be a positive safe integer.')
  }

  const acceptanceLimit = RANDOM_RANGE - (RANDOM_RANGE % exclusiveMax)
  let candidate: number
  do {
    candidate = source.nextUint53()
    if (!Number.isSafeInteger(candidate) || candidate < 0 || candidate >= RANDOM_RANGE) {
      throw new RangeError('Random source returned a value outside [0, 2^53).')
    }
  } while (candidate >= acceptanceLimit)

  return candidate % exclusiveMax
}

export function shuffleFromSource<T>(items: readonly T[], source: RandomSource): T[] {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIntegerFromSource(index + 1, source)
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!]
  }
  return shuffled
}
