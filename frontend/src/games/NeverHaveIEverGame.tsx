import { useState } from 'react'
import { Icon } from '../components/ui/Icon.tsx'
import { PromptCard } from '../components/ui/PromptCard.tsx'
import { PromptReportDialog, type PromptReportReason } from '../components/gameplay/PromptReportDialog.tsx'
import { PlayerWheel } from '../components/gameplay/PlayerWheel.tsx'
import { ReactionBar } from '../components/gameplay/ReactionBar.tsx'
import { recordNeverHaveResponse } from '../domain/games/never-have-i-ever.ts'
import { useGamePhaseFocus } from '../components/gameplay/useGamePhaseFocus.ts'
import type { GameViewProps } from './game-props.ts'
import { resolveGameRoster } from '../types.ts'
import { submitCommunityVote } from '../services/creator-access.ts'

type Props = Pick<GameViewProps, 'active' | 'players' | 'patchActive' | 'finish' | 'draw'> & {
  reportPrompt: (reason: PromptReportReason, note: string, contentId: string | null) => void
  spin: () => void
  angle: number
  busy: boolean
  spinPending: boolean
  wheelDurationMs: number
}

const METHOD_COPY = {
  fingers: 'Put a finger down if this applies to you.',
  points: 'A “yes” adds one point to that player’s local score.',
  stories: 'Share a story if you want, or simply pass. No explanation is required.',
} as const

type ResponseMethod = keyof typeof METHOD_COPY

export function NeverHaveIEverGame({ active, players, patchActive, finish, draw, spin, angle, busy, spinPending, wheelDurationMs, reportPrompt }: Props) {
  const data = active.data
  const [reportOpen, setReportOpen] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const mode = data.mode === 'all-together' || data.mode === 'one-at-a-time' ? data.mode : 'spin-wheel'
  const roster = resolveGameRoster(data.playerRoster, players)
  const seen = Array.isArray(data.seenContentIds) ? data.seenContentIds as string[] : []
  const selectedPackNames = Array.isArray(data.packNames) ? data.packNames as string[] : []
  const method: ResponseMethod = data.responseMethod === 'points' || data.responseMethod === 'stories' ? data.responseMethod : 'fingers'
  const modeLabel = mode === 'all-together' ? 'ALL TOGETHER' : mode === 'one-at-a-time' ? 'ONE AT A TIME' : 'SPIN THE WHEEL'
  const currentPlayer = mode === 'all-together' ? 'Everyone' : (typeof data.chosen === 'string' && data.chosen ? data.chosen : 'The group')
  const progress = Number(data.index) || 0
  const responseByPlayer = (data.responseByPlayer && typeof data.responseByPlayer === 'object' ? data.responseByPlayer : {}) as Record<string, boolean>
  const playerPoints = (data.playerPoints && typeof data.playerPoints === 'object' ? data.playerPoints : {}) as Record<string, number>
  const responseCount = Number(data.responses) || 0
  const yesCount = Number(data.yesResponses) || 0
  const noCount = Number(data.noResponses) || 0
  const skippedCount = Number(data.skipped) || 0
  const reportsCount = Array.isArray(data.reports) ? data.reports.length : 0
  const promptId = typeof data.promptId === 'string' ? data.promptId : null
  const answeredCount = Object.keys(responseByPlayer).length
  useGamePhaseFocus(`${active.phase}:${progress}:${typeof data.chosenId === 'string' ? data.chosenId : ''}`)

  const drawNext = async (overrides: Record<string, unknown> = {}) => {
    setDrawing(true)
    try {
      const currentIndex = Math.max(0, Number(data.oneAtATimeIndex) || 0)
      const nextIndex = (currentIndex + 1) % Math.max(1, roster.length)
      const nextPlayerName = mode === 'one-at-a-time' ? roster[nextIndex]?.name : undefined
      // Spin mode chooses the next player before choosing their prompt so the
      // creator-only Kailas profile can target the actual recipient.
      const item = mode === 'spin-wheel' ? null : await draw('never-have-i-ever', 'never-have-i-ever', data.packIds ?? [], seen, nextPlayerName)
      const nextSeen = item ? [...seen, item.id] : seen
      const next = {
        ...data,
        ...overrides,
        prompt: item?.text ?? null,
        promptId: item?.id ?? null,
        seenContentIds: nextSeen,
        index: progress + 1,
        responseByPlayer: {},
        reaction: null,
      }
      if (mode === 'spin-wheel') {
        patchActive('spin', { ...next, chosen: null, chosenId: null })
        return
      }
      if (!item) {
        patchActive('exhausted', next)
        return
      }
      if (mode === 'one-at-a-time') {
        const nextPlayer = roster[nextIndex]
        patchActive('prompt', { ...next, oneAtATimeIndex: nextIndex, chosen: nextPlayer?.name ?? null, chosenId: nextPlayer?.id ?? null })
        return
      }
      patchActive('prompt', next)
    } finally {
      setDrawing(false)
    }
  }

  const recordResponse = (playerId: string, hasDoneIt: boolean) => {
    const updated = recordNeverHaveResponse(data, playerId, hasDoneIt, method)
    if (!updated) return
    if (mode === 'all-together') {
      patchActive('prompt', updated)
      return
    }
    void drawNext({ ...updated, responseByPlayer: {} })
  }

  const skipPrompt = () => void drawNext({ skipped: skippedCount + 1 })
  const nextStatement = () => void drawNext()
  const finishDetails = `${progress + 1} statements · ${responseCount} responses · ${skippedCount} skipped`
  const yesLabel = method === 'stories' ? 'Share a story' : method === 'points' ? 'I have · +1' : 'I have'
  const noLabel = method === 'stories' ? 'Pass / not me' : 'Not me —'

  if (active.phase === 'spin' || active.phase === 'spinning') return <div className="game-stage wheel-stage never-wheel-stage">
    <span className="eyebrow">I HAVE NEVER · {modeLabel}</span>
    <h1 className="page-title">Who gets<br /><em>the spotlight?</em></h1>
    <PlayerWheel players={roster} angle={angle} busy={busy} chosenId={data.chosenId ?? null} fromAngle={Number(data.wheelFromAngle) || 0} durationMs={wheelDurationMs} />
    {active.phase === 'spin' ? <button className="primary" disabled={spinPending || drawing} onClick={spin}>{spinPending ? 'Saving selection…' : drawing ? 'Loading…' : 'Spin for a player'} <Icon name="arrow-up-right" size={16} /></button> : <p className="muted" role="status">The selected player is locked in. Their statement is next.</p>}
    <p className="wheel-roster-note">{roster.length} eligible players · selection is committed before motion</p>
    <button className="text-button" disabled={spinPending || drawing} onClick={() => finish('I Have Never session ended', finishDetails)}>End session</button>
  </div>

  if (active.phase === 'exhausted' || !data.prompt) return <div className="game-stage prompt-exhausted-stage">
    <span className="eyebrow">PACK COMPLETE</span>
    <h1 className="page-title">No more<br /><em>statements.</em></h1>
    <p className="lead">The selected packs are exhausted. No statement was repeated.</p>
    <div className="secret-card"><p>{selectedPackNames.join(' · ') || 'Selected local pack'} has no unused items remaining.</p><button className="primary" onClick={() => finish('I Have Never session completed', finishDetails)}>Save session</button></div>
  </div>

  return <div className="game-stage never-stage">
    <h1 className="sr-only">I Have Never · statement {progress + 1} for {currentPlayer}</h1>
    <div className="prompt-stage-heading"><span className="eyebrow">I HAVE NEVER · {modeLabel}</span><span className="prompt-counter">STATEMENT {progress + 1}</span></div>
    <div className="turn-spotlight compact"><small>{mode === 'all-together' ? 'THE WHOLE GROUP' : 'CURRENT PLAYER'}</small><strong>{currentPlayer}</strong><span>{selectedPackNames.join(' · ') || 'Curated local pack'}</span></div>
    <PromptCard className="never-card" eyebrow={`CONFESSION CLUB · #${progress + 1}`}>
      <p>{data.prompt}</p>
      <small>{METHOD_COPY[method]} No drinking or other penalty is required.</small>
    </PromptCard>

    {mode === 'all-together' ? <section className="group-response-list" aria-label="Each player records one response">
      <div className="group-response-heading"><strong>Everyone gets a response</strong><span>{answeredCount}/{roster.length} recorded</span></div>
      {roster.map(player => {
        const responded = Object.hasOwn(responseByPlayer, player.id)
        return <div className="group-response-row" key={player.id}>
          <span className="group-response-player">{player.name}{method === 'points' && <small>{playerPoints[player.id] ?? 0} pts</small>}</span>
          {responded ? <span className="group-response-result" role="status">Response saved</span> : <span className="group-response-actions" role="group" aria-label={`${player.name}'s response`}>
            <button type="button" className="response-yes" aria-label={`${player.name}: ${yesLabel}`} onClick={() => recordResponse(player.id, true)}>{yesLabel}</button>
            <button type="button" className="response-no" aria-label={`${player.name}: ${noLabel}`} onClick={() => recordResponse(player.id, false)}>{noLabel}</button>
          </span>}
        </div>
      })}
    </section> : <div className="never-response-controls" role="group" aria-label={`Record ${currentPlayer}'s response`}>
      <button type="button" className="response-yes" onClick={() => recordResponse(String(data.chosenId ?? ''), true)}>{yesLabel}</button>
      <button type="button" className="response-no" onClick={() => recordResponse(String(data.chosenId ?? ''), false)}>{noLabel}</button>
    </div>}

    {mode !== 'all-together' && method === 'points' && <p className="current-player-score">{currentPlayer}: {playerPoints[String(data.chosenId ?? '')] ?? 0} points</p>}
    <ReactionBar value={data.reaction ?? null} onChange={reaction => { patchActive(active.phase, { ...data, reaction }); if (promptId && (reaction === 'helpful' || reaction === 'not-helpful')) void submitCommunityVote(promptId, reaction === 'helpful' ? 'up' : 'down', { text: String(data.prompt ?? ''), game: 'never-have-i-ever', kind: 'never-have-i-ever' }) }} />
    <div className="prompt-report-row"><button className="text-button" onClick={() => setReportOpen(true)}>Report statement</button><span>{reportsCount} local reports · {skippedCount} skipped</span></div>
    <PromptReportDialog game="never-have-i-ever" open={reportOpen} onClose={() => setReportOpen(false)} onSubmit={(reason, note) => { reportPrompt(reason, note, promptId); setReportOpen(false) }} />
    <div className="never-session-stats"><span>{responseCount} responses</span>{mode !== 'all-together' && <><span>{yesCount} yes</span><span>{noCount} no</span></>}<span>{skippedCount} skipped</span></div>
    <div className="never-actions">
      {mode === 'all-together' && <><button className="primary" disabled={answeredCount < roster.length || drawing} onClick={nextStatement}>{drawing ? 'Loading…' : 'Next statement'} <Icon name="arrow-right" size={15} /></button>{answeredCount < roster.length && <small className="group-response-prompt">Waiting for {roster.length - answeredCount} more {roster.length - answeredCount === 1 ? 'response' : 'responses'}.</small>}</>}
      {mode !== 'all-together' && <button className="primary" disabled={drawing} onClick={nextStatement}>{drawing ? 'Loading…' : 'Next player / statement'} <Icon name="arrow-right" size={15} /></button>}
      <button className="text-button" disabled={drawing} onClick={skipPrompt}>Skip statement</button>
      <button className="text-button" disabled={drawing} onClick={() => finish('I Have Never session completed', finishDetails)}>End game</button>
    </div>
  </div>
}
