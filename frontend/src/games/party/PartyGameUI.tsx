import type { ReactNode } from 'react'

export function PartyStage({ eyebrow, title, subtitle, children, className = '' }: {
  eyebrow: string; title: string; subtitle?: string; children: ReactNode; className?: string
}) {
  return <div className={`party-stage ${className}`}>
    <div className="party-stage-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    <div className="party-stage-content">{children}</div>
  </div>
}

export function PartyCard({ children, tone = 'default', className = '' }: { children: ReactNode; tone?: 'default' | 'accent' | 'warning'; className?: string }) {
  return <section className={`party-card party-card-${tone} ${className}`}>{children}</section>
}

export function PartyButton({ children, onClick, variant = 'primary', disabled = false, type = 'button' }: {
  children: ReactNode; onClick: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean; type?: 'button' | 'submit'
}) {
  return <button type={type} className={`party-button party-button-${variant}`} onClick={onClick} disabled={disabled}>{children}</button>
}

export function PartyActions({ children }: { children: ReactNode }) {
  return <div className="party-actions">{children}</div>
}

export function PartyPlayer({ name, active = false, subdued = false }: { name: string; active?: boolean; subdued?: boolean }) {
  return <span className={`party-player${active ? ' is-active' : ''}${subdued ? ' is-subdued' : ''}`}><span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>{name}</span>
}

export function PartyMetric({ label, value }: { label: string; value: ReactNode }) {
  return <div className="party-metric"><span>{label}</span><strong>{value}</strong></div>
}
