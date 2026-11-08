/** PlayerWheel adapts the shared SpinWheel to a saved local player roster. */
import { useMemo } from 'react'
import type { Player } from '../../types.ts'
import { SpinWheel } from './SpinWheel.tsx'
import type { SpinWheelSegment } from './SpinWheel.tsx'

type Props = {
  players: readonly Player[]
  angle: number
  busy: boolean
  chosenId?: string | null
  fromAngle?: number
  durationMs?: number
}

const PLAYER_COLORS = ['#c0ed76', '#f5a36b', '#a99cf5', '#ec91b7', '#78c7bf', '#e6d176', '#89aee9', '#d49ae8']

export function PlayerWheel({ players, angle, busy, chosenId, fromAngle = 0, durationMs = 3600 }: Props) {
  const selected = players.find(player => player.id === chosenId)
  const segments = useMemo<SpinWheelSegment[]>(() => players.map((player, index) => ({
    id: player.id,
    label: players.length > 14 ? String(index + 1) : player.name.length > 14 ? `${player.name.slice(0, 12)}…` : player.name,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length]!,
  })), [players])

  return <>
    <SpinWheel
      segments={segments}
      angle={angle}
      fromAngle={fromAngle}
      durationMs={durationMs}
      busy={busy}
      selectedId={chosenId ?? null}
      ariaLabel="Player selection wheel"
      shellClassName="player-selection-wheel"
      wheelClassName=""
      labelClassName="player-wheel-label"
      caption={busy ? 'Spinning…' : selected ? `${selected.name} is up next` : `${players.length} players`}
    />
    <ol className="sr-only" aria-label="Players on the wheel">{players.map(player => <li key={player.id}>{player.name}</li>)}</ol>
  </>
}
