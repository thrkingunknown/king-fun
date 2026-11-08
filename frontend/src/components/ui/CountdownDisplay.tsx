/** Reusable countdown presentation; the owning game controls timer lifecycle and completion behavior. */
import { formatDuration } from './ui-utils.ts'

type Props = { seconds: number; label: string; className?: string }

/** Visual countdown that does not interrupt screen readers every second. */
export function CountdownDisplay({ seconds, label, className = '' }: Props) {
  return <output className={className} role="timer" aria-label={`${label}: ${formatDuration(seconds)}`} aria-live="off">
    {formatDuration(seconds)}
  </output>
}
