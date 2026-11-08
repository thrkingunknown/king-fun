import { lazy, Suspense } from 'react'
import type { ActiveGame, Game, Player } from '../types.ts'

const SocialDeductionGame = lazy(() => import('./party/SocialDeductionGame.tsx').then(module => ({ default: module.SocialDeductionGame })))
const PromptArcadeGame = lazy(() => import('./party/PromptArcadeGame.tsx').then(module => ({ default: module.PromptArcadeGame })))
const HotBombGame = lazy(() => import('./party/HotBombGame.tsx').then(module => ({ default: module.HotBombGame })))
const TiltItGame = lazy(() => import('./party/TiltItGame.tsx').then(module => ({ default: module.TiltItGame })))
const Challenge20Game = lazy(() => import('./party/Challenge20Game.tsx').then(module => ({ default: module.Challenge20Game })))
const WordArcadeGame = lazy(() => import('./party/WordArcadeGame.tsx').then(module => ({ default: module.WordArcadeGame })))
const ReverseSingingGame = lazy(() => import('./party/ReverseSingingGame.tsx').then(module => ({ default: module.ReverseSingingGame })))

type Props = {
  active: ActiveGame
  players: Player[]
  patchActive: (phase: string, data: Record<string, any>) => void
  finish: (title: string, detail: string) => void
}

const SOCIAL_GAMES = new Set<Game>(['timer-impostor', 'werewolf', 'mafia', 'murder', 'fake-story', 'fact-or-fiction'])
const PROMPT_GAMES = new Set<Game>(['fake-it', 'wrong-answers-only', 'whos-most-likely', 'would-you-rather', 'share-or-pass', 'discussion-starter', 'qupid', 'questions-for-love', 'a-or-b'])
const WORD_GAMES = new Set<Game>(['who-am-i', 'ten-tangle'])

function ArcadeLoadingState() {
  return <section className="party-stage" role="status" aria-live="polite">
    <p className="party-eyebrow">KING-FUN ARCADE</p>
    <h1>Preparing your game…</h1>
    <p className="party-stage-subtitle">Loading only the game you selected.</p>
    <div className="party-loading-bar" aria-hidden="true"><span /></div>
  </section>
}

/** Lazy routing boundary. Each interaction family is fetched only when selected. */
export function PartyArcadeGame({ active, players, patchActive, finish }: Props) {
  const controllerProps = { active, players, patchActive, finish }
  let screen = null

  if (SOCIAL_GAMES.has(active.game)) screen = <SocialDeductionGame {...controllerProps} />
  else if (PROMPT_GAMES.has(active.game)) screen = <PromptArcadeGame {...controllerProps} />
  else if (active.game === 'hot-bomb' || active.game === 'hot-bomb-duel') screen = <HotBombGame {...controllerProps} />
  else if (active.game === 'tilt-it' || active.game === 'letterburg') screen = <TiltItGame {...controllerProps} />
  else if (active.game === 'challenge-20') screen = <Challenge20Game {...controllerProps} />
  else if (WORD_GAMES.has(active.game)) screen = <WordArcadeGame {...controllerProps} />
  else if (active.game === 'reverse-singing') screen = <ReverseSingingGame {...controllerProps} />

  if (!screen) return <section className="party-stage"><h1>Game module unavailable</h1><p>This game is registered but has no playable controller.</p></section>
  return <Suspense fallback={<ArcadeLoadingState />}>{screen}</Suspense>
}
