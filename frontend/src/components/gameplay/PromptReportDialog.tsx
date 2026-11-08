/** Accessible prompt-report dialog shared by content games; the caller validates and stores submitted reports. */
import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui/Icon.tsx'

export type PromptReportReason = 'unsafe' | 'spelling' | 'category' | 'not-a-prompt'

const REASONS: readonly { value: PromptReportReason; label: string }[] = [
  { value: 'unsafe', label: 'Offensive or unsafe content' },
  { value: 'spelling', label: 'Spelling or grammar issue' },
  { value: 'category', label: 'Wrong category' },
  { value: 'not-a-prompt', label: 'Not actually a truth or dare' },
]

type Props = {
  game: string
  open: boolean
  onClose: () => void
  onSubmit: (reason: PromptReportReason, note: string) => void
}

export function PromptReportDialog({ game, open, onClose, onSubmit }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState<PromptReportReason>('unsafe')
  const [note, setNote] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    return () => { if (dialog.open) dialog.close() }
  }, [open])

  const submit = () => {
    onSubmit(reason, note.trim())
    setReason('unsafe')
    setNote('')
  }

  return <dialog
    ref={dialogRef}
    className="ui-confirm-dialog report-dialog"
    aria-labelledby="prompt-report-title"
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}
  >
    <div className="ui-dialog-mark" aria-hidden="true"><Icon name="flag" size={21} /></div>
    <h2 id="prompt-report-title">Report this prompt</h2>
    <p>This report is saved only in this device’s local game history and is never uploaded. Do not include player names or other personal information in your note.</p>
    <fieldset className="report-reasons">
      <legend>What needs attention?</legend>
      {REASONS.map(item => <label key={item.value}>
        <input type="radio" name="prompt-report-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} />
        <span>{item.value === 'not-a-prompt' ? (game === 'guessup' ? 'Not a charades prompt' : game === 'never-have-i-ever' ? 'Not an I Have Never statement' : item.label) : item.label}</span>
      </label>)}
    </fieldset>
    <label className="report-note-label">Optional note<textarea value={note} maxLength={240} rows={3} placeholder="Add context without including personal information…" onChange={event => setNote(event.target.value)} /></label>
    <div className="ui-dialog-actions">
      <button type="button" className="ui-dialog-cancel" onClick={onClose}>Cancel</button>
      <button type="button" className="ui-dialog-confirm" onClick={submit}>Save report</button>
    </div>
  </dialog>
}
