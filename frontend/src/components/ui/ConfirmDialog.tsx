import { useEffect, useRef } from 'react'
import { Icon } from './Icon.tsx'
import { Button } from './button.tsx'

type Props = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string | undefined
  destructive?: boolean | undefined
  onConfirm: () => void
  onCancel: () => void
}

/** Native modal confirmation dialog with browser-managed focus and Escape behavior. */
export function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', destructive = false, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    return () => { if (dialog.open) dialog.close() }
  }, [open])

  return <dialog
    ref={dialogRef}
    className="ui-confirm-dialog kf-dialog"
    aria-labelledby="ui-confirm-title"
    aria-describedby="ui-confirm-description"
    onCancel={event => { event.preventDefault(); onCancel() }}
    onClick={event => { if (event.target === event.currentTarget) onCancel() }}
  >
    <div className={`kf-dialog-icon ${destructive ? 'is-danger' : ''}`} aria-hidden="true"><Icon name={destructive ? 'alert-triangle' : 'shield-check'} size={22} /></div>
    <div className="kf-dialog-heading"><span className="eyebrow">CONFIRM ACTION</span><h2 id="ui-confirm-title">{title}</h2></div>
    <p id="ui-confirm-description">{description}</p>
    <div className="ui-dialog-actions">
      <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      <Button type="button" variant={destructive ? 'destructive' : 'primary'} onClick={onConfirm}>{confirmLabel}<Icon name="arrow-right" size={15} /></Button>
    </div>
  </dialog>
}
