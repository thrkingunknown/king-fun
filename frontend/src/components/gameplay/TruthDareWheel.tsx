/** TruthDareWheel adapts the shared SpinWheel to eight equal challenge sectors. */
import { useMemo } from 'react'
import { SpinWheel } from './SpinWheel.tsx'
import type { SpinWheelSegment } from './SpinWheel.tsx'
import { TRUTH_DARE_WHEEL_OPTIONS } from '../../domain/games/truth-or-dare-wheel.ts'

export type TruthDareKind = 'truth' | 'dare'

type Props = {
  readonly angle: number
  readonly fromAngle?: number
  readonly durationMs?: number
  readonly busy: boolean
  readonly selectedKind?: TruthDareKind | null
}

const TRUTH_COLORS = ['#c6f36b', '#b7e965', '#c9f77a', '#afe15f']
const DARE_COLORS = ['#ffb77e', '#f4a36e', '#ffc18d', '#f29b68']

export function TruthDareWheel({ angle, fromAngle = 0, durationMs = 3600, busy, selectedKind = null }: Props) {
  const segments = useMemo<SpinWheelSegment[]>(() => TRUTH_DARE_WHEEL_OPTIONS.map((kind, index) => ({
    id: `${kind}-${index}`,
    label: kind.toUpperCase(),
    color: kind === 'truth' ? TRUTH_COLORS[Math.floor(index / 2) % TRUTH_COLORS.length]! : DARE_COLORS[Math.floor(index / 2) % DARE_COLORS.length]!,
  })), [])

  return <>
    <SpinWheel
      segments={segments}
      angle={angle}
      fromAngle={fromAngle}
      durationMs={durationMs}
      busy={busy}
      ariaLabel="Truth or Dare challenge wheel with four truth and four dare sectors"
      shellClassName="truth-dare-wheel-shell"
      wheelClassName="truth-dare-wheel"
      labelClassName="truth-dare-wheel-label"
      size="large"
      center="OR"
      caption={busy ? 'Spinning…' : selectedKind ? `${selectedKind === 'truth' ? 'Truth' : 'Dare'} selected` : '4 truths · 4 dares'}
    />
    <ol className="sr-only" aria-label="Wheel options">{segments.map(segment => <li key={segment.id}>{segment.label}</li>)}</ol>
  </>
}
