import { useEffect, useMemo, useRef, useState } from 'react'
import { useClockNow } from './useClockNow.ts'
import type { ActiveGame, Player } from '../../types.ts'
import { PartyActions, PartyButton, PartyCard, PartyMetric, PartyStage } from './PartyGameUI.tsx'

type Props = { active: ActiveGame; players: Player[]; patchActive: (phase: string, data: Record<string, any>) => void; finish: (title: string, detail: string) => void }

const EMPTY_STRIKES: Record<string, number> = Object.freeze({})
const EMPTY_ANSWERS: readonly string[] = Object.freeze([])

/** Fuse is an absolute persisted deadline, so backgrounding or reload cannot reset it. */
export function HotBombGame({ active, players, patchActive, finish }: Props) {
  const data = active.data
  const roster: Player[] = Array.isArray(data.playerRoster) ? data.playerRoster : players
  const survivors: string[] = useMemo(() => Array.isArray(data.activePlayerIds) ? data.activePlayerIds : roster.map(player => player.id), [data.activePlayerIds, roster])
  const currentIndex = Math.max(0, Number(data.currentPlayerIndex ?? 0)) % Math.max(1, survivors.length)
  const currentId = survivors[currentIndex]
  const currentPlayer = roster.find(player => player.id === currentId)
  const turnKey = `${active.phase}:${currentId ?? 'none'}:${Number(data.explosionCount ?? 0)}`
  const [answerState, setAnswerState] = useState({ key: '', value: '' })
  const answer = answerState.key === turnKey ? answerState.value : ''
  const setAnswer = (value: string) => setAnswerState({ key: turnKey, value })
  const now = useClockNow(active.phase === 'playing')
  const processedDeadline = useRef<number | null>(null)
  const deadline = Number(data.endsAt ?? 0)
  const secondsLeft = deadline > 0 ? Math.max(0, (deadline - (now || deadline - Number(data.fuseSeconds ?? 10) * 1000)) / 1000) : 0
  const strikes: Record<string, number> = data.strikes ?? EMPTY_STRIKES
  const usedAnswers: readonly string[] = data.usedAnswers ?? EMPTY_ANSWERS
  const normalizedUsed = useMemo(() => new Set(usedAnswers.map(value => value.normalize('NFKC').trim().toLocaleLowerCase())), [usedAnswers])


  useEffect(() => {
    if (active.phase !== 'playing' || !deadline || secondsLeft > 0 || processedDeadline.current === deadline || !currentId) return
    processedDeadline.current = deadline
    const nextStrikes = { ...strikes, [currentId]: (strikes[currentId] ?? 0) + 1 }
    const eliminated = (nextStrikes[currentId] ?? 0) >= (active.game === 'hot-bomb-duel' ? 1 : 2)
    const nextSurvivors = eliminated ? survivors.filter(id => id !== currentId) : [...survivors]
    const explosionCount = Number(data.explosionCount ?? 0) + 1
    if (nextSurvivors.length <= 1) {
      patchActive('results', { ...data, strikes: nextStrikes, activePlayerIds: nextSurvivors, explosionCount, winnerId: nextSurvivors[0] ?? null, explodedPlayerId: currentId, endedAt: Date.now() })
      return
    }
    const nextIndex = eliminated ? currentIndex % nextSurvivors.length : (currentIndex + 1) % nextSurvivors.length
    const fuseSeconds = Math.max(5, Math.min(30, Number(data.setupSnapshot?.fuseSeconds ?? data.fuseSeconds ?? 10)))
    patchActive('playing', { ...data, strikes: nextStrikes, activePlayerIds: nextSurvivors, currentPlayerIndex: nextIndex, explosionCount, explodedPlayerId: currentId, endsAt: Date.now() + fuseSeconds * 1000, fuseSeconds, usedAnswers: [], lastAnswer: '', roundNotice: `${currentPlayer?.name ?? 'A player'} was holding the bomb when it exploded${eliminated ? ' and is out' : ''}.` })
  }, [active.phase, active.game, deadline, secondsLeft, currentId, strikes, survivors, data, currentIndex, currentPlayer?.name, patchActive])

  const passBomb = () => {
    // Guard the deadline in the handler as well as the disabled UI state;
    // keyboard activation can race the next timer render.
    if (!deadline || Date.now() >= deadline || !currentId || active.phase !== 'playing') return
    const clean = answer.normalize('NFKC').trim()
    if (!clean || normalizedUsed.has(clean.toLocaleLowerCase())) return
    const nextUsed = [...usedAnswers, clean]
    setAnswer('')
    patchActive('playing', { ...data, usedAnswers: nextUsed, lastAnswer: clean, currentPlayerIndex: (currentIndex + 1) % survivors.length })
  }

  if (active.phase === 'results') {
    const winner = roster.find(player => player.id === data.winnerId)
    return <PartyStage eyebrow={active.game === 'hot-bomb-duel' ? 'HOT BOMB DUEL · FINAL' : 'HOT BOMB · FINAL'} title={winner ? `${winner.name} survives.` : 'The fuse got everyone.'} subtitle="The round ends when one player remains, or the duel reaches its first explosion."><PartyCard tone="accent"><PartyMetric label="EXPLOSIONS" value={data.explosionCount ?? 0}/><div className="party-result-list">{roster.map(player => <div key={player.id}><span>{player.name}</span><strong>{strikes[player.id] ?? 0} strike{(strikes[player.id] ?? 0) === 1 ? '' : 's'}</strong></div>)}</div><PartyButton onClick={() => finish(active.game, winner ? `${winner.name} won Hot Bomb.` : 'No player survived.')}>Save result</PartyButton></PartyCard></PartyStage>
  }

  if (!currentId) return <PartyStage eyebrow="HOT BOMB" title="No players remain." subtitle="This round cannot continue."><PartyButton onClick={() => finish(active.game, 'No players remain.')}>Finish</PartyButton></PartyStage>

  return <PartyStage eyebrow={active.game === 'hot-bomb-duel' ? 'HOT BOMB DUEL · HEAD TO HEAD' : 'HOT BOMB · PASS THE DEVICE'} title={`${currentPlayer?.name ?? 'Next player'}, name one.`} subtitle={`Category: ${data.category}. Enter a valid example, say it out loud, then pass the bomb immediately.`}>
    <PartyCard tone={secondsLeft < 3 ? 'warning' : 'accent'} className="hot-bomb-card"><div className="hot-bomb-timer" role="timer" aria-live="off"><span>{secondsLeft.toFixed(1)}</span><small>SECONDS</small></div><p className="party-card-label">CATEGORY</p><h2>{data.category}</h2><label htmlFor="bomb-answer" className="party-field-label">Your answer</label><input id="bomb-answer" className="party-input" value={answer} onChange={event => setAnswer(event.target.value)} maxLength={60} autoComplete="off" onKeyDown={event => { if (event.key === 'Enter') passBomb() }} placeholder="Type an example…"/><PartyButton onClick={passBomb} disabled={!answer.trim() || normalizedUsed.has(answer.normalize('NFKC').trim().toLocaleLowerCase()) || secondsLeft <= 0}>Valid answer · pass bomb</PartyButton>{normalizedUsed.has(answer.normalize('NFKC').trim().toLocaleLowerCase()) && answer.trim() && <p className="party-inline-error">That answer has already been used this round.</p>}<PartyActions><PartyMetric label="STRIKES" value={strikes[currentId] ?? 0}/><PartyMetric label="EXPLOSIONS" value={data.explosionCount ?? 0}/><PartyMetric label="PLAYERS LEFT" value={survivors.length}/></PartyActions>{data.roundNotice && <p className="party-notice" role="status">{data.roundNotice}</p>}</PartyCard>
    <p className="party-help">Each player may not repeat an answer. On explosion, the holder receives a strike; two strikes eliminate a player. In Duel, the first explosion decides the match. The category is self-judged by the group.</p>
  </PartyStage>
}
