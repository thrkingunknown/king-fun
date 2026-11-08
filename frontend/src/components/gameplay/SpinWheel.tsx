/**
 * Shared presentation-only wheel used for player and challenge selection.
 * Selection and persistence stay in the owning game/domain layer.
 */
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../ui/Icon.tsx'

export type SpinWheelSegment = Readonly<{
  id: string
  label: string
  color: string
}>

type Props = Readonly<{
  segments: readonly SpinWheelSegment[]
  angle: number
  fromAngle?: number
  durationMs?: number
  busy: boolean
  selectedId?: string | null
  center?: ReactNode
  caption?: string
  ariaLabel: string
  shellClassName?: string
  wheelClassName?: string
  labelClassName?: string
  size?: 'standard' | 'large'
  showPointer?: boolean
}>

function wheelBackground(segments: readonly SpinWheelSegment[]): string {
  if (segments.length === 0) return '#282832'
  const step = 360 / segments.length
  const stops = segments.flatMap((segment, index) => {
    const start = index * step
    const end = (index + 1) * step
    const divider = Math.min(0.9, step * 0.035)
    return [`${segment.color} ${start}deg ${end - divider}deg`, `#ffffffb8 ${end - divider}deg ${end}deg`]
  })
  return `conic-gradient(from 0deg, ${stops.join(', ')})`
}

function readableRadialRotation(angle: number): number {
  // Keep the label baseline on its spoke while avoiding upside-down text.
  const normalized = ((angle % 360) + 360) % 360
  return normalized > 90 && normalized < 270 ? angle - 90 : angle + 90
}

export function SpinWheel({
  segments,
  angle,
  fromAngle = 0,
  durationMs = 3600,
  busy,
  selectedId = null,
  center,
  caption,
  ariaLabel,
  shellClassName = '',
  wheelClassName = '',
  labelClassName = '',
  size = 'standard',
  showPointer = true,
}: Props) {
  const safeDurationMs = Number.isFinite(durationMs) ? Math.max(1, durationMs) : 3600
  const safeAngle = Number.isFinite(angle) ? angle : 0
  const safeFromAngle = Number.isFinite(fromAngle) ? fromAngle : 0
  const step = 360 / Math.max(1, segments.length)
  const style = {
    background: wheelBackground(segments),
    '--wheel-from': `${safeFromAngle}deg`,
    '--wheel-to': `${safeAngle}deg`,
    '--wheel-duration': `${safeDurationMs}ms`,
  } as CSSProperties

  return <div className={`spin-wheel-shell ${size === 'large' ? 'is-large' : ''} ${busy ? 'is-spinning' : ''} ${shellClassName}`.trim()} role="group" aria-label={ariaLabel}>
    {showPointer && <span className="spin-wheel-pointer" aria-hidden="true"><Icon name="chevron-down" size={24} strokeWidth={2.8} /></span>}
    <div className={`spin-wheel ${busy ? 'is-animating' : ''} ${wheelClassName}`.trim()} style={style} aria-hidden="true" data-segment-count={segments.length}>
      {segments.map((segment, index) => {
        const centerAngle = (index + 0.5) * step
        const radialRotation = readableRadialRotation(centerAngle)
        return <span
          className={`spin-wheel-label ${labelClassName}${segment.id === selectedId && !busy ? ' is-selected' : ''}`.trim()}
          key={segment.id}
          style={{ transform: `translate(-50%, -50%) rotate(${centerAngle}deg) translateY(calc(0px - var(--wheel-label-distance))) rotate(${radialRotation - centerAngle}deg)` }}
        >{segment.label}</span>
      })}
      <span className="spin-wheel-hub">{center ?? <Icon name="sparkles" size={20} />}</span>
    </div>
    {caption && <p className="spin-wheel-caption" role="status" aria-live="polite" aria-atomic="true">{caption}</p>}
  </div>
}
