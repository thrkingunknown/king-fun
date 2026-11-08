/** Reusable two-choice action control with an optional decorative icon; callers own labels, state, and game behavior. */
import type { ReactNode } from 'react'
type Props = {
  children: ReactNode
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
}

export function ChoiceButton({ children, icon, onClick, disabled = false, className = '' }: Props) {
  return <button type="button" className={`ui-choice-button ${className}`} onClick={onClick} disabled={disabled}>
    <span>{children}</span>{icon && <span className="ui-choice-icon" aria-hidden="true">{icon}</span>}
  </button>
}
