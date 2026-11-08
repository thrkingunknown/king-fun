import { randomIntegerFromSource, shuffleFromSource } from './random-core.ts'
import type { RandomSource } from './random-core.ts'

function createWebCryptoSource(): RandomSource {
  return {
    nextUint53(): number {
      const cryptoProvider = globalThis.crypto
      if (!cryptoProvider?.getRandomValues) {
        throw new Error('Web Crypto is unavailable; secure random selection cannot continue.')
      }
      const words = cryptoProvider.getRandomValues(new Uint32Array(2))
      const high = BigInt(words[0]!)
      const low = BigInt(words[1]!)
      return Number((high << 21n) | (low >> 11n))
    },
  }
}

/** Cryptographically secure, unbiased integer in [0, exclusiveMax). */
export function secureRandomInteger(exclusiveMax: number): number {
  return randomIntegerFromSource(exclusiveMax, createWebCryptoSource())
}

/** Returns a new shuffled array; the caller's input is never mutated. */
export function secureShuffle<T>(items: readonly T[]): T[] {
  return shuffleFromSource(items, createWebCryptoSource())
}

export function assertSecureRandomAvailable(): void {
  const cryptoProvider = globalThis.crypto
  if (!cryptoProvider?.getRandomValues) {
    throw new Error('This browser does not provide Web Crypto. Secure game selection is disabled.')
  }
  // Read a value to fail early when a secure context/runtime blocks Web Crypto.
  cryptoProvider.getRandomValues(new Uint32Array(1))
}

