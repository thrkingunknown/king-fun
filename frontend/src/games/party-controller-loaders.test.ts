import { describe, expect, test } from 'bun:test'
import { getPartyArcadeControllerFamily, preloadPartyArcadeController } from './party-controller-loaders.ts'
import type { Game } from '../types.ts'

const familyCases: readonly [Game, string][] = [
  ['timer-impostor', 'social-deduction'],
  ['werewolf', 'social-deduction'],
  ['mafia', 'social-deduction'],
  ['murder', 'social-deduction'],
  ['fake-story', 'social-deduction'],
  ['fact-or-fiction', 'social-deduction'],
  ['fake-it', 'prompt-arcade'],
  ['wrong-answers-only', 'prompt-arcade'],
  ['whos-most-likely', 'prompt-arcade'],
  ['would-you-rather', 'prompt-arcade'],
  ['share-or-pass', 'prompt-arcade'],
  ['discussion-starter', 'prompt-arcade'],
  ['qupid', 'prompt-arcade'],
  ['questions-for-love', 'prompt-arcade'],
  ['a-or-b', 'prompt-arcade'],
  ['hot-bomb', 'hot-bomb'],
  ['hot-bomb-duel', 'hot-bomb'],
  ['tilt-it', 'tilt-it'],
  ['letterburg', 'tilt-it'],
  ['challenge-20', 'challenge-20'],
  ['who-am-i', 'word-arcade'],
  ['ten-tangle', 'word-arcade'],
  ['reverse-singing', 'reverse-singing'],
]

describe('Party Arcade controller routing', () => {
  test('maps every added game to exactly one lazy controller family', () => {
    for (const [game, family] of familyCases) {
      expect(getPartyArcadeControllerFamily(game), game).toBe(family)
    }
    expect(familyCases).toHaveLength(23)
  })

  test('does not preload a Party Arcade chunk for the four original games', async () => {
    for (const game of ['imposter', 'guessup', 'truth-or-dare', 'never-have-i-ever'] as const) {
      expect(getPartyArcadeControllerFamily(game), game).toBeNull()
      await expect(preloadPartyArcadeController(game)).resolves.toBeUndefined()
    }
  })
})
