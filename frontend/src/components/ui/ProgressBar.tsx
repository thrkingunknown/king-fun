/** Accessible progress indicator for game phases; callers supply the current value and descriptive label. */
import { progressPercent } from './ui-utils.ts'

type Props = {
  value: number
  max: number
  label: string
  valueText?: string
  className?: string
}

export function ProgressBar({ value, max, label, valueText, className = '' }: Props) {
  const percent = progressPercent(value, max)
  return <div className={`ui-progress ${className}`}>
    <div
      className="ui-progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-valuetext={valueText ?? `${Math.round(percent)}%`}
    >
      <span className="ui-progress-fill" style={{ width: `${percent}%` }} />
    </div>
  </div>
}
