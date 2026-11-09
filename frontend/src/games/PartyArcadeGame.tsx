import { lazy, Suspense } from 'react'
import type { ActiveGame, Player } from '../types.ts'
import {
  getPartyArcadeControllerFamily,
  loadChallenge20,
  loadHotBomb,
  loadPromptArcade,
  loadReverseSinging,
  loadSocialDeduction,
  loadTiltIt,
  loadWordArcade,
} from './party-controller-loaders.ts'

const SocialDeductionGame = lazy(() => loadSocialDeduction().then(module => ({ default: module.SocialDeductionGame })))
const PromptArcadeGame = lazy(() => loadPromptArcade().then(module => ({ default: module.PromptArcadeGame })))
const HotBombGame = lazy(() => loadHotBomb().then(module => ({ default: module.HotBombGame })))
const TiltItGame = lazy(() => loadTiltIt().then(module => ({ default: module.TiltItGame })))
const Challenge20Game = lazy(() => loadChallenge20().then(module => ({ default: module.Challenge20Game })))
const WordArcadeGame = lazy(() => loadWordArcade().then(module => ({ default: module.WordArcadeGame })))
const ReverseSingingGame = lazy(() => loadReverseSinging().then(module => ({ default: module.ReverseSingingGame })))

type Props = {
  active: ActiveGame
  players: Player[]
  patchActive: (phase: string, data: Record<string, any>) => void
  finish: (title: string, detail: string) => void
}

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
  const family = getPartyArcadeControllerFamily(active.game)
  let screen = null

  if (family === 'social-deduction') screen = <SocialDeductionGame {...controllerProps} />
  else if (family === 'prompt-arcade') screen = <PromptArcadeGame {...controllerProps} />
  else if (family === 'hot-bomb') screen = <HotBombGame {...controllerProps} />
  else if (family === 'tilt-it') screen = <TiltItGame {...controllerProps} />
  else if (family === 'challenge-20') screen = <Challenge20Game {...controllerProps} />
  else if (family === 'word-arcade') screen = <WordArcadeGame {...controllerProps} />
  else if (family === 'reverse-singing') screen = <ReverseSingingGame {...controllerProps} />

  if (!screen) return <section className="party-stage"><h1>Game module unavailable</h1><p>This game is registered but has no playable controller.</p></section>
  return <Suspense fallback={<ArcadeLoadingState />}>{screen}</Suspense>
}
