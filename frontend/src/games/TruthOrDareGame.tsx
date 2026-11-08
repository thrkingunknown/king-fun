/**
 * TruthOrDareGame composes player selection, challenge selection, prompt play,
 * reactions, reporting and turn progression. Domain selection/persistence stays
 * in AppShell; reusable wheel and prompt components remain presentation-only.
 */
import { useState } from 'react'
import { ChoiceButton } from '../components/ui/ChoiceButton.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { PromptCard } from '../components/ui/PromptCard.tsx'
import { PlayerWheel } from '../components/gameplay/PlayerWheel.tsx'
import { TruthDareWheel } from '../components/gameplay/TruthDareWheel.tsx'
import { PromptReportDialog, type PromptReportReason } from '../components/gameplay/PromptReportDialog.tsx'
import { ReactionBar } from '../components/gameplay/ReactionBar.tsx'
import { useGamePhaseFocus } from '../components/gameplay/useGamePhaseFocus.ts'
import type { GameViewProps } from './game-props.ts'
import { resolveGameRoster } from '../types.ts'
import { submitCommunityVote } from '../services/creator-access.ts'

type Props = Pick<GameViewProps, 'active' | 'players' | 'patchActive' | 'draw' | 'finish'> & {
  spin: () => void
  spinKind: () => void
  angle: number
  choiceAngle: number
  choiceFromAngle: number
  busy: boolean
  choiceBusy: boolean
  spinPending: boolean
  wheelDurationMs: number
  reportPrompt: (reason: PromptReportReason, note: string, contentId: string | null) => void
}

export function TruthOrDareGame({ active, players, patchActive, draw, spin, spinKind, angle, choiceAngle, choiceFromAngle, busy, choiceBusy, spinPending, wheelDurationMs, reportPrompt, finish }: Props) {
  const data = active.data
  const [reportOpen, setReportOpen] = useState(false)
  const mode = data.mode === 'all-together' || data.mode === 'one-at-a-time' ? data.mode : 'spin-wheel'
  const roster = resolveGameRoster(data.playerRoster, players)
  const selectedPackNames = Array.isArray(data.packNames) ? data.packNames as string[] : []
  const currentLabel = mode === 'all-together' ? 'EVERYONE' : (typeof data.chosen === 'string' && data.chosen ? data.chosen.toUpperCase() : 'THE GROUP')
  const seen = Array.isArray(data.seenContentIds) ? data.seenContentIds as string[] : []
  const reportsCount = Array.isArray(data.reports) ? data.reports.length : 0
  const promptId = typeof data.promptId === 'string' ? data.promptId : null
  useGamePhaseFocus(`${active.phase}:${promptId ?? ''}:${typeof data.chosenId === 'string' ? data.chosenId : ''}`)

  const [drawing, setDrawing] = useState(false)

  const nextRecipient = (extra: Record<string, unknown> = {}) => {
    const next = { ...data, ...extra, prompt: null, promptId: null, kind: null, reaction: null, turn: (Number(data.turn) || 0) + 1 }
    if (mode === 'spin-wheel') {
      patchActive('spin', { ...next, chosen: null, chosenId: null })
      return
    }
    if (mode === 'one-at-a-time') {
      const currentIndex = Number.isInteger(data.oneAtATimeIndex) ? Number(data.oneAtATimeIndex) : 0
      const nextIndex = (currentIndex + 1) % Math.max(1, roster.length)
      const nextPlayer = roster[nextIndex]
      patchActive('choice', { ...next, oneAtATimeIndex: nextIndex, chosen: nextPlayer?.name ?? null, chosenId: nextPlayer?.id ?? null })
      return
    }
    patchActive('choice', { ...next, chosen: null, chosenId: null })
  }

  const choosePrompt = async (kind: 'truth' | 'dare') => {
    setDrawing(true)
    try {
      const item = await draw('truth-or-dare', kind, data.packIds ?? [], seen, typeof data.chosen === 'string' ? data.chosen : undefined)
      if (!item) {
        patchActive('exhausted', { ...data, prompt: null, promptId: null, kind, reaction: null })
        return
      }
      patchActive('prompt', {
        ...data,
        kind,
        prompt: item.text,
        promptId: item.id,
        seenContentIds: [...seen, item.id],
        reaction: null,
      })
    } finally {
      setDrawing(false)
    }
  }

  const replacePrompt = () => {
    if (data.kind !== 'truth' && data.kind !== 'dare') return
    void choosePrompt(data.kind)
  }

  const skipPrompt = () => nextRecipient({ skipped: (Number(data.skipped) || 0) + 1 })
  const optOut = () => nextRecipient({ optOuts: (Number(data.optOuts) || 0) + 1 })
  const react = (reaction: 'heart' | 'helpful' | 'not-helpful' | null) => {
    patchActive(active.phase, { ...data, reaction })
    if (promptId && (reaction === 'helpful' || reaction === 'not-helpful')) void submitCommunityVote(promptId, reaction === 'helpful' ? 'up' : 'down', { text: String(data.prompt ?? ''), game: 'truth-or-dare', kind: String(data.kind ?? 'truth') })
  }
  const modeLabel = mode === 'all-together' ? 'ALL TOGETHER' : mode === 'one-at-a-time' ? 'ONE AT A TIME' : 'SPIN THE WHEEL'

  if (active.phase === 'spin' || active.phase === 'spinning') return <div className="game-stage wheel-stage">
    <span className="eyebrow">TRUTH OR DARE · {modeLabel}</span>
    <h1 className="page-title">Who's<br /><em>up next?</em></h1>
    <PlayerWheel players={roster} angle={angle} busy={busy} chosenId={data.chosenId ?? null} fromAngle={Number(data.wheelFromAngle) || 0} durationMs={wheelDurationMs} />
    {active.phase === 'spin' ? <button className="primary" disabled={spinPending} onClick={spin}>{spinPending ? 'Saving selection…' : 'Spin for a player'} <Icon name="arrow-up-right" size={16} /></button> : <p className="muted" role="status">The selection is locked. The wheel is landing on {data.chosen ?? 'the selected player'}.</p>}
    
    <button className="text-button" disabled={spinPending} onClick={() => finish('Truth or Dare session ended', `${data.turn} turns · ${data.skipped} skipped · ${data.optOuts} opt-outs`)}>End session</button>
  </div>


  if (active.phase === 'choice-spinning') return <div className="game-stage wheel-stage truth-dare-spin-stage">
    <h1 className="page-title">Truth<br /><em>or dare?</em></h1>
    <TruthDareWheel angle={choiceAngle} fromAngle={choiceFromAngle} busy={choiceBusy} durationMs={wheelDurationMs} selectedKind={data.kind === 'dare' ? 'dare' : 'truth'} />
    
  </div>

  if (active.phase === 'choice') return <div className="game-stage truth-choice-stage">
    <span className="eyebrow">TRUTH OR DARE · {modeLabel}</span>
    <h1 className="page-title">Pick your<br /><em>challenge.</em></h1>
    <div className="turn-spotlight"><small>{mode === 'all-together' ? 'THE WHOLE GROUP' : 'CURRENT PLAYER'}</small><strong>{mode === 'all-together' ? 'Everyone' : data.chosen ?? 'Next player'}</strong><span>{selectedPackNames.join(' · ') || 'Curated local pack'}</span></div>
    <p className="lead">Spin or choose.</p>
    <section className="truth-dare-choice-panel" aria-label="Truth or Dare selection">
      <TruthDareWheel angle={choiceAngle} fromAngle={choiceFromAngle} busy={false} durationMs={wheelDurationMs} />
      <button className="primary truth-dare-spin-button" type="button" disabled={spinPending} onClick={spinKind}>{spinPending ? 'Saving wheel result…' : 'Spin for Truth or Dare'} <Icon name="shuffle" size={16} /></button>
      <div className="manual-choice-divider"><span>OR CHOOSE MANUALLY</span></div>
      <div className="choice-buttons"><ChoiceButton disabled={spinPending || drawing} onClick={() => void choosePrompt('truth')} icon={<Icon name="activity" size={18} />}>{drawing ? 'LOADING…' : 'TRUTH'}</ChoiceButton><ChoiceButton disabled={spinPending || drawing} onClick={() => void choosePrompt('dare')} icon={<Icon name="sparkles" size={18} />}>{drawing ? 'LOADING…' : 'DARE'}</ChoiceButton></div>
    </section>
    <div className="session-small-stats"><span>{data.turn} turns</span><span>{data.skipped} skipped</span><span>{data.optOuts} opt-outs</span></div>
    <button className="text-button" disabled={spinPending} onClick={() => finish('Truth or Dare session ended', `${data.turn} turns · ${data.skipped} skipped · ${data.optOuts} opt-outs`)}>End session</button>
  </div>

  if (active.phase === 'exhausted' || !data.prompt) return <div className="game-stage prompt-exhausted-stage">
    <span className="eyebrow">PACK COMPLETE</span>
    <h1 className="page-title">That’s all<br /><em>for now.</em></h1>
    <p className="lead">There are no unused prompts left in the selected packs. KING-FUN will not repeat one silently.</p>
    <div className="secret-card"><p>{selectedPackNames.join(' · ') || 'Selected local pack'} has been used for this session.</p><button className="primary" onClick={() => finish('Truth or Dare session completed', `${data.turn} turns · ${data.skipped} skipped · ${data.optOuts} opt-outs`)}>Save session</button></div>
  </div>

  return <div className="game-stage truth-prompt-stage">
    <h1 className="sr-only">{data.kind === 'dare' ? 'Dare' : 'Truth'} prompt for {currentLabel}</h1>
    <div className="prompt-stage-heading"><span className="eyebrow">TRUTH OR DARE · {modeLabel}</span><span className="prompt-counter">TURN {Number(data.turn) + 1}</span></div>
    <div className="turn-spotlight compact"><small>{data.kind?.toUpperCase()} FOR</small><strong>{currentLabel}</strong><span>{selectedPackNames.join(' · ') || 'Curated local pack'}</span></div>
    <PromptCard className={`truth-prompt-card ${data.kind === 'dare' ? 'is-dare' : 'is-truth'}`} eyebrow={`${data.kind?.toUpperCase()} · ${currentLabel}`} footer={<>
      <button className="primary" onClick={() => nextRecipient()}>{mode === 'all-together' ? 'Next prompt' : 'Next player'}</button>
      <button className="secondary-action" onClick={replacePrompt}>Replace prompt</button>
      <button className="text-button" onClick={skipPrompt}>Skip prompt</button>
      <button className="text-button opt-out-button" onClick={optOut}>Opt out &amp; pass</button>
    </>}><p>{data.prompt}</p></PromptCard>
    <ReactionBar value={data.reaction ?? null} onChange={react} />
    <div className="prompt-report-row"><button className="text-button" onClick={() => setReportOpen(true)}>Report prompt</button><span>{reportsCount} local reports · {data.skipped} skipped · {data.optOuts} opt-outs</span></div>
    <PromptReportDialog game="truth-or-dare" open={reportOpen} onClose={() => setReportOpen(false)} onSubmit={(reason, note) => { reportPrompt(reason, note, promptId); setReportOpen(false) }} />
  </div>
}
