export type NeverHaveResponseMethod = 'fingers' | 'points' | 'stories'

/** Apply one local response without exposing the response value in UI state summaries. */
export function recordNeverHaveResponse(
  state: Readonly<Record<string, unknown>>,
  playerId: string,
  hasDoneIt: boolean,
  method: NeverHaveResponseMethod,
): Record<string, unknown> | null {
  if (!playerId.trim() || typeof hasDoneIt !== 'boolean' || !['fingers', 'points', 'stories'].includes(method)) return null
  const roster = Array.isArray(state.playerRoster) ? state.playerRoster as readonly { id: string }[] : null
  if (!roster || !roster.some(player => player && player.id === playerId)) return null
  const currentResponses = state.responseByPlayer && typeof state.responseByPlayer === 'object'
    ? state.responseByPlayer as Record<string, boolean>
    : {}
  if (Object.hasOwn(currentResponses, playerId)) return null
  const currentPoints = state.playerPoints && typeof state.playerPoints === 'object'
    ? state.playerPoints as Record<string, number>
    : {}
  return {
    ...state,
    responseByPlayer: { ...currentResponses, [playerId]: hasDoneIt },
    playerPoints: { ...currentPoints, ...(hasDoneIt && method === 'points' ? { [playerId]: (currentPoints[playerId] ?? 0) + 1 } : {}) },
    responses: (Number(state.responses) || 0) + 1,
    yesResponses: (Number(state.yesResponses) || 0) + (hasDoneIt ? 1 : 0),
    noResponses: (Number(state.noResponses) || 0) + (hasDoneIt ? 0 : 1),
  }
}
