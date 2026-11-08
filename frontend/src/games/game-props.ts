import type { ContentItem } from '../domain/shared/contracts.ts'
import type { ActiveGame, Game, GameSetup, Player } from '../types.ts'

export type GameViewProps = {
  active: ActiveGame
  players: Player[]
  patchActive: (phase: string, data: Record<string, any>) => void
  finish: (title: string, detail: string) => void
  startGame: (setup?: GameSetup) => void | Promise<void>
  /** Draws next content; may be async when online vault/LLM generation is used. */
  draw: (game: Game, kind?: string, packIds?: readonly string[], seenIds?: readonly string[], playerName?: string) => Promise<ContentItem | null> | ContentItem | null
}
