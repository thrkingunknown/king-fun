import type { ReactNode } from 'react'
import { PartyButton, PartyCard } from '../../games/party/PartyGameUI.tsx'

export type VoteChoice = { readonly id: string; readonly label: string; readonly description?: string }

export function PrivateVotePanel(props: {
  readonly eyebrow: string
  readonly title: string
  readonly subtitle?: string
  readonly voterLabel?: string
  readonly progressLabel?: string
  readonly choices: readonly VoteChoice[]
  readonly selectedId: string
  readonly onSelect: (id: string) => void
  readonly onSubmit: () => void
  readonly allowSkip?: boolean
  readonly skipId?: string
  readonly skipLabel?: string
  readonly submitLabel?: string
  readonly disabled?: boolean
  readonly children?: ReactNode
}) {
  const skipId = props.skipId ?? 'skip'
  const hasSelection = Boolean(props.selectedId)
  return <PartyCard tone="accent" className="private-vote-panel">
    {props.voterLabel ? <p className="party-card-label">{props.voterLabel}</p> : null}
    <div className="party-choice-grid private-vote-choices" role="group" aria-label={props.title}>
      {props.choices.map(choice => <button
        key={choice.id}
        type="button"
        className={props.selectedId === choice.id ? 'is-selected' : ''}
        aria-pressed={props.selectedId === choice.id}
        onClick={() => props.onSelect(choice.id)}
      >
        <span className="private-vote-choice-label">{choice.label}</span>
        {choice.description ? <small className="private-vote-choice-desc">{choice.description}</small> : null}
      </button>)}
    </div>
    {props.allowSkip !== false ? <PartyButton variant="secondary" onClick={() => props.onSelect(skipId)}>{props.selectedId === skipId ? (props.skipLabel ?? 'Skip selected') : (props.skipLabel ?? 'Skip vote')}</PartyButton> : null}
    <PartyButton onClick={props.onSubmit} disabled={props.disabled || !hasSelection}>{props.submitLabel ?? 'Submit private vote'}</PartyButton>
    {props.progressLabel ? <p className="party-progress-note">{props.progressLabel}</p> : null}
    {props.children}
  </PartyCard>
}
