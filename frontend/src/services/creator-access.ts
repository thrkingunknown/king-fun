import { getAiApiBase } from './ai-providers.ts'
import { apiFetch } from './api-transport.ts'

const TOKEN_KEY = 'king-fun.creator-access.v1'

export function getCreatorToken(): string | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function clearCreatorToken(): void {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* storage is optional */ }
}

function isLoopbackHost(host: string) { return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host) }
function isTauriRuntime() {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}
function assertSecureTransport(): void {
  if (typeof window === 'undefined') return
  const base = new URL(getAiApiBase(), window.location.origin)
  if (isTauriRuntime()) {
    if (!(base.protocol === 'https:' || isLoopbackHost(base.hostname))) throw new Error('Creator access requires an HTTPS API in the packaged app.')
    return
  }
  if (!(isLoopbackHost(window.location.hostname) && isLoopbackHost(base.hostname)) && (window.location.protocol !== 'https:' || base.protocol !== 'https:')) {
    throw new Error('Creator access requires HTTPS.')
  }
}

export async function unlockCreator(secret: string): Promise<string> {
  assertSecureTransport()
  const response = await apiFetch(`${getAiApiBase()}/v1/creator/unlock`, {
    method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ secret }),
  })
  const body = await response.json() as { token?: string; error?: { message?: string } }
  if (!response.ok || typeof body.token !== 'string') throw new Error(body.error?.message ?? 'Creator unlock was not accepted.')
  try { localStorage.setItem(TOKEN_KEY, body.token) } catch { throw new Error('This device cannot save creator access. Enable site storage and retry.') }
  return body.token
}

export async function verifyCreator(token = getCreatorToken()): Promise<boolean> {
  if (!token) return false
  try {
    assertSecureTransport()
    const response = await apiFetch(`${getAiApiBase()}/v1/creator/verify`, {
      cache: 'no-store', headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    })
    const body = await response.json() as { valid?: boolean }
    if (!response.ok || body.valid !== true) { clearCreatorToken(); return false }
    return true
  } catch { return false }
}

export function getCommunityVoterId(): string {
  const key = 'king-fun.community-voter.v1'
  try {
    const current = localStorage.getItem(key)
    if (current && /^[a-zA-Z0-9_-]{16,80}$/.test(current)) return current
    const next = crypto.randomUUID().replaceAll('-', '')
    localStorage.setItem(key, next)
    return next
  } catch { return crypto.randomUUID().replaceAll('-', '') }
}

export async function submitCommunityVote(contentId: string, vote: 'up' | 'down', metadata?: { text: string; game: string; kind: string }): Promise<string | null> {
  if (!contentId || contentId.length > 128) return null
  try {
    const response = await apiFetch(`${getAiApiBase()}/v1/content/feedback`, {
      method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ contentId, vote, voterId: getCommunityVoterId(), ...(metadata ? { text: metadata.text.slice(0, 260), game: metadata.game, kind: metadata.kind } : {}) }),
    })
    if (!response.ok) return null
    const body = await response.json() as { status?: string }
    const status = body.status ?? 'approved'
    if (status === 'quarantined' && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('king-fun:content-quarantined', { detail: contentId }))
    return status
  } catch { return null }
}

export async function moderateCommunityContent(contentId: string, status: 'approved' | 'quarantined' | 'rejected' | 'retired'): Promise<boolean> {
  const token = getCreatorToken()
  if (!token) return false
  try {
    assertSecureTransport()
    const response = await apiFetch(`${getAiApiBase()}/v1/content/moderate`, {
      method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ contentId, status }),
    })
    return response.ok
  } catch { return false }
}


export type ModerationQueueItem = { contentId: string; item: { text: string; game?: string; kind?: string } | null; status: string; score: number; downVotes: number }

export async function loadModerationQueue(): Promise<ModerationQueueItem[]> {
  const token = getCreatorToken()
  if (!token) return []
  try {
    assertSecureTransport()
    const response = await apiFetch(`${getAiApiBase()}/v1/content/moderation-queue`, {
      cache: 'no-store', headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    })
    const body = await response.json() as { items?: ModerationQueueItem[] }
    return response.ok && Array.isArray(body.items) ? body.items : []
  } catch { return [] }
}


export type ContentStatusProgress = {
  stage: 'checking' | 'received' | 'unavailable'
  batch: number
  totalBatches: number
  checkedItems: number
  totalItems: number
  detail?: string
}

const CONTENT_STATUS_TIMEOUT_MS = 2_500

export async function loadBlockedContentIds(
  ids: readonly string[],
  onProgress?: (event: ContentStatusProgress) => void,
): Promise<string[]> {
  const blocked = new Set<string>()
  const startedAt = Date.now()
  const totalBatches = Math.ceil(ids.length / 300)
  let checkedItems = 0
  for (let offset = 0; offset < ids.length; offset += 300) {
    const batch = Math.floor(offset / 300) + 1
    const batchIds = ids.slice(offset, offset + 300)
    const remainingMs = CONTENT_STATUS_TIMEOUT_MS - (Date.now() - startedAt)
    if (remainingMs <= 0) {
      onProgress?.({ stage: 'unavailable', batch, totalBatches, checkedItems, totalItems: ids.length, detail: 'The moderation-status time budget elapsed; local eligibility rules will continue.' })
      break
    }
    onProgress?.({ stage: 'checking', batch, totalBatches, checkedItems, totalItems: ids.length })
    try {
      const response = await apiFetch(`${getAiApiBase()}/v1/content/status`, {
        method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ ids: batchIds }),
        // This optional moderation lookup must never hold a local game start
        // indefinitely. The existing catch path continues with local rules.
        signal: AbortSignal.timeout(remainingMs),
      })
      if (!response.ok) {
        onProgress?.({ stage: 'unavailable', batch, totalBatches, checkedItems, totalItems: ids.length, detail: `The backend content-status request returned HTTP ${response.status}; local eligibility checks will continue.` })
        continue
      }
      const body = await response.json() as { blocked?: string[] }
      for (const id of body.blocked ?? []) if (typeof id === 'string') blocked.add(id)
      checkedItems += batchIds.length
      onProgress?.({ stage: 'received', batch, totalBatches, checkedItems, totalItems: ids.length, detail: `Received moderation status for ${checkedItems} of ${ids.length} local content items.` })
    } catch {
      onProgress?.({ stage: 'unavailable', batch, totalBatches, checkedItems, totalItems: ids.length, detail: 'The backend content-status endpoint could not be reached; local eligibility checks will continue.' })
      // Offline play continues with the local content catalogue.
    }
  }
  return [...blocked]
}
