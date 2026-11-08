/** Shared prompt surface with an action slot; the game screen owns prompt selection, progression, and persistence. */
import type { ReactNode } from 'react'
type Props = {
  eyebrow: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function PromptCard({ eyebrow, children, footer, className = '' }: Props) {
  return <article className={`ui-prompt-card ${className}`}>
    <span className="eyebrow">{eyebrow}</span>
    <div className="ui-prompt-content" aria-live="polite" aria-atomic="true">{children}</div>
    {footer && <div className="ui-prompt-footer">{footer}</div>}
  </article>
}
