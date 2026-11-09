import type { Game } from '../../types.ts'
import { GameMark } from '../ui/GameMark.tsx'
import { Icon, type IconName } from '../ui/Icon.tsx'
import './GameLoadingOverlay.css'

export type GameLoadingEntry = {
  id: string
  title: string
  detail: string
  state: 'active' | 'complete' | 'warning' | 'error'
}

type Props = {
  game: Game
  gameName: string
  currentTitle: string
  currentDetail: string
  entries: readonly GameLoadingEntry[]
  reduceMotion: boolean
}

const ENTRY_ICONS: Record<GameLoadingEntry['state'], IconName> = {
  active: 'refresh',
  complete: 'check-circle',
  warning: 'alert-triangle',
  error: 'x',
}

export function GameLoadingOverlay({ game, gameName, currentTitle, currentDetail, entries, reduceMotion }: Props) {
  return <div
    className={`game-loading-layer ${reduceMotion ? 'motion-reduced' : ''}`}
    data-game={game}
    role="region"
    aria-label={`Starting ${gameName}`}
    aria-busy={entries.some(entry => entry.state === 'active')}
  >
    <section className="game-loading-panel" aria-labelledby="game-loading-title">
      <div className="game-loading-visual" aria-hidden="true">
        <span className="game-loading-orbit orbit-one" />
        <span className="game-loading-orbit orbit-two" />
        <span className="game-loading-orbit orbit-three" />
        <span className="game-loading-particle particle-one" />
        <span className="game-loading-particle particle-two" />
        <span className="game-loading-particle particle-three" />
        <span className="game-loading-mark"><GameMark game={game} size={38} /></span>
      </div>

      <div className="game-loading-copy">
        <p className="eyebrow">GAME STARTUP / {game.toUpperCase()}</p>
        <h1 id="game-loading-title">Getting the room <em>ready.</em></h1>
        <p className="game-loading-intro">Preparing <strong>{gameName}</strong> for your group.</p>

        <div className="game-loading-current" role="status" aria-live="polite" aria-atomic="true">
          <span className="game-loading-live-dot" aria-hidden="true" />
          <div>
            <strong>{currentTitle}</strong>
            <p>{currentDetail}</p>
          </div>
        </div>

        <div className="game-loading-progress" aria-hidden="true"><span /></div>

        <div className="game-loading-log-heading">
          <span>LIVE STARTUP LOG</span>
          <span>{String(entries.length).padStart(2, '0')} EVENTS</span>
        </div>
        <ol className="game-loading-log" aria-label="Startup activity history" aria-live="off">
          {entries.slice(-12).map(entry => <li className={`game-loading-log-entry is-${entry.state}`} key={entry.id}>
            <span className="game-loading-log-icon"><Icon name={ENTRY_ICONS[entry.state]} size={14} /></span>
            <span className="game-loading-log-copy"><strong>{entry.title}</strong><small>{entry.detail}</small></span>
            {entry.state === 'active' && <span className="game-loading-log-pulse" aria-hidden="true" />}
          </li>)}
        </ol>
        <p className="game-loading-footnote">No game data is sent to the AI provider unless content generation is needed.</p>
      </div>
    </section>
  </div>
}
