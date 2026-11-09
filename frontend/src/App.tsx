import { GAMES, type Game, type GameDefinition, type Save } from './types.ts'
import { GameMark } from './components/ui/GameMark.tsx'
import { Icon } from './components/ui/Icon.tsx'
import { HeroMotion } from './HeroMotion.tsx'

type HomePageProps = {
  save: Save
  games: GameDefinition[]
  launchGame: Game | null
  onPreloadContent: (game?: Game) => void
  onResume: () => void
  onLaunch: (game: Game, card: HTMLElement) => void
}

const GAME_DETAILS: Record<Game, { index: string; label: string; metric: string }> = {
  imposter: { index: '01', label: 'Social deduction', metric: '3–20 players' },
  guessup: { index: '02', label: 'Teams & acting', metric: 'Team rounds' },
  'truth-or-dare': { index: '03', label: 'Spin & prompts', metric: 'Pass the phone' },
  'never-have-i-ever': { index: '04', label: 'Group prompts', metric: 'Group rounds' },
  'timer-impostor': { index: '05', label: 'Timing & bluffing', metric: '3+ players' },
  werewolf: { index: '06', label: 'Hidden roles', metric: '5+ players' },
  mafia: { index: '07', label: 'Hidden teams', metric: '5+ players' },
  murder: { index: '08', label: 'Observation', metric: '3+ players' },
  'fake-it': { index: '09', label: 'Questions & bluffing', metric: '3+ players' },
  'fake-story': { index: '10', label: 'Storytelling', metric: '3+ players' },
  'fact-or-fiction': { index: '11', label: 'Knowledge & bluffing', metric: '3+ players' },
  'wrong-answers-only': { index: '12', label: 'Fast prompts', metric: 'Quick turns' },
  'hot-bomb': { index: '13', label: 'Word pressure', metric: 'Timed' },
  'hot-bomb-duel': { index: '14', label: 'Head-to-head', metric: '2 players' },
  'whos-most-likely': { index: '15', label: 'Group vote', metric: 'Poll rounds' },
  'would-you-rather': { index: '16', label: 'Choices', metric: 'Two options' },
  'share-or-pass': { index: '17', label: 'Optional sharing', metric: 'No pressure' },
  'challenge-20': { index: '18', label: 'Bidding', metric: 'Budget rounds' },
  'tilt-it': { index: '19', label: 'Motion play', metric: 'Teams or solo' },
  letterburg: { index: '20', label: 'Word families', metric: 'Family-friendly' },
  'discussion-starter': { index: '21', label: 'Conversation', metric: 'Prompt cards' },
  'who-am-i': { index: '22', label: 'Yes/no clues', metric: 'Identity game' },
  'ten-tangle': { index: '23', label: 'Word puzzle', metric: 'Ten words' },
  qupid: { index: '24', label: 'Couples', metric: 'Conversation' },
  'questions-for-love': { index: '25', label: 'Couples', metric: '2 players' },
  'a-or-b': { index: '26', label: 'This or that', metric: 'Partner play' },
  'reverse-singing': { index: '27', label: 'Audio challenge', metric: 'Mic optional' },
}

export default function HomePage({ save, games, launchGame, onPreloadContent, onResume, onLaunch }: HomePageProps) {
  const firstGame = games[0] ?? GAMES[0]!

  return <div className="home-page">
    <section className="hero hero-v2" aria-labelledby="home-title">
      <div className="hero-grid kf-grid">
        <div className="hero-copy kf-span-7">
          <h1 id="home-title">King-Fun</h1>
          <p className="hero-description">Choose a game, set the room, and run rounds with clear controls and fast setup.</p>
          <div className="hero-actions">
            <button
              type="button"
              className="kf-btn kf-btn-primary kf-btn-lg hero-primary-action"
              onPointerEnter={() => onPreloadContent(firstGame.id)}
              onFocus={() => onPreloadContent(firstGame.id)}
              onClick={event => onLaunch(firstGame.id, event.currentTarget)}
            ><Icon name="play" size={17} /> Start a game <Icon name="arrow-up-right" size={16} /></button>
          </div>
        </div>
        <div className="hero-art kf-span-5"><HeroMotion /></div>
      </div>
    </section>

    {save.active && <button
      type="button"
      className="resume-banner resume-banner-v2"
      onClick={onResume}
    >
      <span className="resume-icon"><Icon name="history" size={19} /></span>
      <span className="resume-copy"><small>Session in progress</small><b>Resume {games.find(game => game.id === save.active?.game)?.name ?? 'game'}</b><span>Continue from where you stopped.</span></span>
      <span className="resume-arrow">Resume <Icon name="arrow-up-right" size={17} /></span>
    </button>}

    <section className="game-section game-section-v2" aria-labelledby="game-library-title">
      <div className="section-heading section-heading-v2">
        <div><p className="eyebrow">Game library</p><h2 id="game-library-title">Games</h2></div>
        <div className="library-status"><span className="library-status-dot" /> {String(games.length).padStart(2, '0')} available</div>
      </div>
      <div className="game-grid game-grid-v2 kf-grid">
        {games.map((game, index) => {
          const detail = GAME_DETAILS[game.id]
          return <button
            className={`game-card game-card-v2 ${game.color}${launchGame === game.id ? ' launching' : ''} kf-span-3`}
            key={game.id}
            type="button"
            onPointerEnter={() => onPreloadContent(game.id)}
            onFocus={() => onPreloadContent(game.id)}
            onClick={event => onLaunch(game.id, event.currentTarget)}
            style={{ animationDelay: `${index * 45}ms` }}
          >
            <div className="game-card-top">
              <span className="card-icon"><GameMark game={game.id} size={22} /></span>
              <div className="game-card-top-right">
                <span id={`game-index-${game.id}`} className="game-card-index" aria-hidden="true">{detail.index}</span>
                <span className="card-arrow" aria-hidden="true"><Icon name="arrow-up-right" size={15} /></span>
              </div>
            </div>
            <div className="game-card-bottom">
              <span id={`game-category-${game.id}`} className="game-card-category">{detail.label}</span>
              <h3 id={`game-title-${game.id}`}>{game.name}</h3>
              <p id={`game-description-${game.id}`}>{game.tagline}</p>
            </div>
            <div className="game-card-meta"><span id={`game-metric-${game.id}`}><Icon name="users" size={13} /> {detail.metric}</span><span id={`game-action-${game.id}`}>Open <Icon name="arrow-right" size={13} /></span></div>
          </button>
        })}
      </div>
    </section>

  </div>
}
