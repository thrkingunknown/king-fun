import type { Game } from '../types.ts'

const SOCIAL_GAMES = new Set<Game>(['timer-impostor', 'werewolf', 'mafia', 'murder', 'fake-story', 'fact-or-fiction'])
const PROMPT_GAMES = new Set<Game>(['fake-it', 'wrong-answers-only', 'whos-most-likely', 'would-you-rather', 'share-or-pass', 'discussion-starter', 'qupid', 'questions-for-love', 'a-or-b'])
const WORD_GAMES = new Set<Game>(['who-am-i', 'ten-tangle'])

export type PartyArcadeControllerFamily =
  | 'social-deduction'
  | 'prompt-arcade'
  | 'hot-bomb'
  | 'tilt-it'
  | 'challenge-20'
  | 'word-arcade'
  | 'reverse-singing'

export const loadSocialDeduction = () => import('./party/SocialDeductionGame.tsx')
export const loadPromptArcade = () => import('./party/PromptArcadeGame.tsx')
export const loadHotBomb = () => import('./party/HotBombGame.tsx')
export const loadTiltIt = () => import('./party/TiltItGame.tsx')
export const loadChallenge20 = () => import('./party/Challenge20Game.tsx')
export const loadWordArcade = () => import('./party/WordArcadeGame.tsx')
export const loadReverseSinging = () => import('./party/ReverseSingingGame.tsx')

export function getPartyArcadeControllerFamily(game: Game): PartyArcadeControllerFamily | null {
  if (SOCIAL_GAMES.has(game)) return 'social-deduction'
  if (PROMPT_GAMES.has(game)) return 'prompt-arcade'
  if (game === 'hot-bomb' || game === 'hot-bomb-duel') return 'hot-bomb'
  if (game === 'tilt-it' || game === 'letterburg') return 'tilt-it'
  if (game === 'challenge-20') return 'challenge-20'
  if (WORD_GAMES.has(game)) return 'word-arcade'
  if (game === 'reverse-singing') return 'reverse-singing'
  return null
}

/** Warm only the selected controller family before the player starts a round. */
export async function preloadPartyArcadeController(game: Game): Promise<void> {
  switch (getPartyArcadeControllerFamily(game)) {
    case 'social-deduction': await loadSocialDeduction(); break
    case 'prompt-arcade': await loadPromptArcade(); break
    case 'hot-bomb': await loadHotBomb(); break
    case 'tilt-it': await loadTiltIt(); break
    case 'challenge-20': await loadChallenge20(); break
    case 'word-arcade': await loadWordArcade(); break
    case 'reverse-singing': await loadReverseSinging(); break
    case null: return
  }
}
