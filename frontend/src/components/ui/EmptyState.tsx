import type { ReactNode } from 'react'
import { Icon } from './Icon.tsx'
type Props = { title: string; description: string; icon?: ReactNode; action?: ReactNode }

export function EmptyState({ title, description, icon = <Icon name="sparkles" size={24} />, action }: Props) {
  return <div className="ui-empty-state" role="status">
    <span className="ui-empty-icon" aria-hidden="true">{icon}</span>
    <h2>{title}</h2>
    <p>{description}</p>
    {action && <div className="ui-empty-action">{action}</div>}
  </div>
}
