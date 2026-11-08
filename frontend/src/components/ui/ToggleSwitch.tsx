import { useId } from 'react'

type Props = {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  tone?: 'default' | 'compact'
}

/** Accessible touch-sized switch for interface preferences. */
export function ToggleSwitch({ label, description, checked, onCheckedChange, disabled = false, className = '', tone = 'default' }: Props) {
  const id = useId()
  return <div className={`kf-switch-row ${tone === 'compact' ? 'is-compact' : ''} ${className}`.trim()}>
    <div className="kf-switch-copy">
      <span className="kf-switch-label" id={`${id}-label`}>{label}</span>
      {description && <span className="kf-switch-description" id={`${id}-description`}>{description}</span>}
    </div>
    <button
      type="button"
      className={`kf-switch ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-description` : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="kf-switch-track" aria-hidden="true"><span className="kf-switch-thumb" /></span>
    </button>
  </div>
}
