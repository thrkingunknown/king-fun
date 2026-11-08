import { useEffect } from 'react'

/** Move assistive-technology focus to the new game phase heading after a transition. */
export function useGamePhaseFocus(focusKey: string | number): void {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>('.play-screen .game-stage h1, .play-screen .game-stage h2')
      if (!heading) return
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusKey])
}
