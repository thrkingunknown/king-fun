import { format, formatDistanceToNow } from 'date-fns'
import { EmptyState } from '../components/ui/EmptyState.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { GameMark } from '../components/ui/GameMark.tsx'
import { Button } from '../components/ui/button.tsx'
import type { GameDefinition, HistoryItem } from '../types.ts'

type Props = { history: HistoryItem[]; games: GameDefinition[]; goHome: () => void; clearHistory: () => void }

export function HistoryScreen({ history, games, goHome, clearHistory }: Props) {
  const gameFor = (id: HistoryItem['game']) => games.find(game => game.id === id)
  const sortedHistory = [...history].sort((a, b) => b.at - a.at)
  return <section className="workspace history-workspace kf-workspace" aria-labelledby="history-title">
    <div className="workspace-topline"><button className="back-link" type="button" onClick={goHome}><Icon name="arrow-left" size={15} /> Back</button></div>
    <header className="workspace-heading history-heading">
      <div><p className="eyebrow">History</p><h1 id="history-title" className="page-title">Recent sessions</h1></div>
      <div className="history-summary-card"><strong>{history.length}</strong><small>Sessions</small></div>
    </header>
    <div className="history-toolbar"><h2>Timeline</h2><Button variant="outline" size="sm" onClick={clearHistory} disabled={history.length === 0}><Icon name="trash" size={14} /> Clear</Button></div>
    <div className="history-list history-list-v2">
      {sortedHistory.length ? sortedHistory.map((item, index) => {
        const game = gameFor(item.game)
        return <article className={`history-row history-row-v2 ${game?.color ?? ''}`} key={item.id} style={{ animationDelay: `${Math.min(index * 25, 200)}ms` }}>
          <span className="history-game-mark"><GameMark game={item.game} size={20} /></span>
          <div className="history-entry-main"><div className="history-entry-title"><strong>{item.title}</strong><span className="history-game-pill">{game?.name ?? item.game}</span></div><p>{item.detail}</p><div className="history-timestamp"><time dateTime={new Date(item.at).toISOString()}>{format(new Date(item.at), 'dd MMM yyyy · HH:mm')}</time><span>{formatDistanceToNow(new Date(item.at), { addSuffix: true })}</span></div>
            {item.reports && item.reports.length > 0 && <details className="history-reports"><summary><Icon name="flag" size={14} /> {item.reports.length} report{item.reports.length === 1 ? '' : 's'} <Icon name="chevron-down" size={13} /></summary><ul>{item.reports.map((report, reportIndex) => <li key={`${report.at}-${report.contentId ?? 'item'}-${reportIndex}`}><strong>{report.reason === 'unsafe' ? 'Offensive or unsafe' : report.reason === 'spelling' ? 'Spelling or grammar' : report.reason === 'category' ? 'Wrong category' : 'Not the right kind of prompt'}</strong>{report.contentId && <span> · {report.contentId}</span>}{report.note && <p>{report.note}</p>}</li>)}</ul></details>}
          </div>
          <span className="history-row-arrow"><Icon name="arrow-up-right" size={17} /></span>
        </article>
      }) : <EmptyState title="No sessions yet" description="Finished rounds will appear here." icon={<Icon name="history" size={24} />} action={<Button onClick={goHome}><Icon name="play" size={15} /> Browse games</Button>} />}
    </div>
  </section>
}
