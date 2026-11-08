import { Icon, type CoreIconName } from './CoreIcon.tsx'

/** Reusable status and recovery feedback surface; callers own status state and recovery callbacks. */
type Props = {
  title?: string
  message: string
  tone?: 'info' | 'success' | 'warning' | 'error'
  busy?: boolean
  actionLabel?: string | undefined
  onAction?: (() => void) | undefined
}

const STATUS_ICONS: Record<NonNullable<Props['tone']>, CoreIconName> = {
  info: 'help',
  success: 'check-circle',
  warning: 'alert-triangle',
  error: 'alert-triangle',
}

export function StatusPanel({ title, message, tone = 'info', busy = false, actionLabel, onAction }: Props) {
  const urgent = tone === 'warning' || tone === 'error'
  return <section className={`ui-status-panel is-${tone}`} role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'}>
    <span className="ui-status-icon" aria-hidden="true">{busy ? <span className="ui-status-spinner" /> : <Icon name={STATUS_ICONS[tone]} size={19} />}</span>
    <div className="ui-status-copy">{title && <strong>{title}</strong>}<span>{message}</span></div>
    {actionLabel && onAction && <button type="button" className="ui-status-action" onClick={onAction}>{actionLabel}<Icon name="arrow-right" size={15} /></button>}
  </section>
}
