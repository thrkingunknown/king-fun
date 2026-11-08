import { useCallback, useSyncExternalStore } from 'react'

/**
 * Shared wall-clock snapshot for countdown UIs.
 *
 * Components subscribe to a cached timestamp instead of calling Date.now()
 * during render. A single timer serves every visible countdown controller and
 * is stopped when the final subscriber unmounts.
 */
let snapshot = 0
let intervalId: number | null = null
const subscribers = new Set<() => void>()

function publishTime() {
  snapshot = Date.now()
  for (const subscriber of subscribers) subscriber()
}

function subscribe(subscriber: () => void) {
  // Capture the initial timestamp during subscription (outside render) so a
  // restored countdown paints its true remaining time on the first client pass.
  if (subscribers.size === 0) snapshot = Date.now()
  subscribers.add(subscriber)
  if (intervalId === null && typeof window !== 'undefined') {
    intervalId = window.setInterval(publishTime, 80)
  }
  return () => {
    subscribers.delete(subscriber)
    if (subscribers.size === 0 && intervalId !== null) {
      window.clearInterval(intervalId)
      intervalId = null
    }
  }
}

function getSnapshot() {
  return snapshot
}

function getServerSnapshot() {
  return 0
}

export function useClockNow(enabled = true): number {
  const subscribeWhenEnabled = useCallback((subscriber: () => void) => (
    enabled ? subscribe(subscriber) : () => undefined
  ), [enabled])
  return useSyncExternalStore(subscribeWhenEnabled, getSnapshot, getServerSnapshot)
}
