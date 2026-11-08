export type AiProvider = 'gemini' | 'groq' | 'cloudflare-workers-ai'
export type AiItemKind = 'word' | 'charade' | 'truth' | 'dare' | 'statement' | 'category' | 'party-prompt'
export type AiGame =
  | 'imposter' | 'guessup' | 'truth-or-dare' | 'never-have-i-ever'
  | 'fake-it' | 'fake-story' | 'fact-or-fiction' | 'wrong-answers-only'
  | 'hot-bomb' | 'hot-bomb-duel' | 'whos-most-likely' | 'would-you-rather'
  | 'share-or-pass' | 'challenge-20' | 'tilt-it' | 'letterburg'
  | 'discussion-starter' | 'who-am-i' | 'ten-tangle'
  | 'qupid' | 'questions-for-love' | 'a-or-b' | 'reverse-singing'
export type AiGeneratedItem = { id: string; text: string; categoryId: string; kind: AiItemKind; locale: string; hints?: string[]; description?: string; emoji?: string }
export type AiGenerationProvider = AiProvider | 'local-curated' | 'content-vault'
import { SEEDED_CONTENT } from '../content/seed.ts'
import { secureShuffle } from '../domain/random/secure-random.ts'
import { apiFetch } from './api-transport.ts'
type Preferences = { order: ('gemini' | 'groq')[]; enabled: Record<'gemini' | 'groq', boolean> }
type Snapshot = { preferences: Preferences; keys: Partial<Record<'gemini' | 'groq', string>>; status: Partial<Record<AiProvider, string>> }
const STORAGE_KEY = 'king-fun.ai-provider-preferences.v1'
const defaults: Preferences = { order: ['gemini', 'groq'], enabled: { gemini: false, groq: false } }
function readPreferences(): Preferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Preferences> | null
    if (!parsed) return defaults
    const order = Array.isArray(parsed.order) ? (['gemini', 'groq'] as const).filter(x => parsed.order!.includes(x)) : defaults.order
    return { order: order.length === 2 ? [...order] : [...defaults.order], enabled: { gemini: parsed.enabled?.gemini === true, groq: parsed.enabled?.groq === true } }
  } catch { return defaults }
}
let preferences = typeof localStorage === 'undefined' ? defaults : readPreferences()
let keys: Snapshot['keys'] = {}
const failureCounts: Partial<Record<AiProvider, number>> = {}
const cooldownUntil: Partial<Record<AiProvider, number>> = {}
let status: Snapshot['status'] = {}
const listeners = new Set<() => void>()
const emit = () => { refreshSnapshot(); listeners.forEach(listener => listener()) }
let currentSnapshot: Snapshot = { preferences, keys: {}, status: {} }
const snapshot = () => currentSnapshot
const refreshSnapshot = () => { currentSnapshot = { preferences, keys: { ...keys }, status: { ...status } } }
export const subscribeAiProviders = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) }
export const getAiProviderSnapshot = snapshot
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)) } catch { /* preferences are optional; keys are never persisted */ } }
export function updateAiProviderPreferences(next: Preferences) { preferences = next; persist(); emit() }
export function setAiProviderKey(provider: 'gemini' | 'groq', key: string) { keys = { ...keys, [provider]: key.trim() }; status = { ...status, [provider]: 'Key configured for this session' }; emit() }
export function removeAiProviderKey(provider: 'gemini' | 'groq') { const next = { ...keys }; delete next[provider]; keys = next; const s = { ...status }; delete s[provider]; status = s; preferences = { ...preferences, enabled: { ...preferences.enabled, [provider]: false } }; persist(); emit() }
export function setAiProviderStatus(provider: AiProvider, value: string) { status = { ...status, [provider]: value }; emit() }
export function getAiProviderKey(provider: 'gemini' | 'groq') { return keys[provider] }
export function getAiProviderOrder(): AiProvider[] { return [...preferences.order.filter(p => preferences.enabled[p] && Boolean(keys[p])), 'cloudflare-workers-ai'] }
const configuredApiBase = (import.meta.env.VITE_KING_FUN_API_URL as string | undefined)?.trim().replace(/\/$/, '')
// Web/PWA: same-origin `/api`. Packaged Tauri: set VITE_KING_FUN_API_URL=https://YOUR_PROJECT.vercel.app/api
const apiBase = configuredApiBase || '/api'
export function getAiApiBase() { return apiBase }
function isLoopbackHost(host: string) { return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host) }
function isTauriRuntime() {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}
function assertSecureTransport(): void {
  if (typeof window === 'undefined') return
  const target = new URL(apiBase, window.location.origin)
  if (isTauriRuntime()) {
    // Tauri uses local WebView protocols; validate the configured remote API URL itself.
    if (!(target.protocol === 'https:' || isLoopbackHost(target.hostname))) {
      throw new Error('The configured KING-FUN API must use HTTPS in the packaged app.')
    }
    return
  }
  if (!(isLoopbackHost(window.location.hostname) && isLoopbackHost(target.hostname)) && (window.location.protocol !== 'https:' || target.protocol !== 'https:')) {
    throw new Error('AI generation requires HTTPS. Configure the gateway on the same secure origin or a trusted HTTPS API origin.')
  }
}

export async function getAiBackendStatus(signal?: AbortSignal) {
  assertSecureTransport()
  const response = await apiFetch(`${apiBase}/v1/status`, { signal: signal ?? null, headers: { accept: 'application/json' }, cache: 'no-store' })
  if (!response.ok) throw new Error(`API status unavailable (${response.status})`)
  return await response.json() as { status: 'available' | 'degraded' | 'unavailable'; tasks: string[]; cloudflareReady?: boolean }
}

export async function testAiProvider(provider: AiProvider, signal?: AbortSignal) {
  assertSecureTransport()
  const key = provider === 'cloudflare-workers-ai' ? undefined : keys[provider]
  if (provider !== 'cloudflare-workers-ai' && !key) throw new Error('Add a session API key before testing this provider.')
  const response = await apiFetch(`${apiBase}/v1/content/generate`, { method: 'POST', signal: signal ?? null, cache: 'no-store', headers: { 'content-type': 'application/json', 'x-provider-id': provider, 'x-provider-test': 'true', ...(key ? { 'x-provider-key': key } : {}) }, body: JSON.stringify({ schemaVersion: 1, requestId: crypto.randomUUID(), game: 'truth-or-dare', itemKind: 'truth', categoryId: `connection-test-${crypto.randomUUID().slice(0, 8)}`, locale: 'en', suitability: 'general', count: 1, recentItems: [] }) })
  const body = await response.json() as { items?: AiGeneratedItem[]; cacheHit?: boolean; error?: { message?: string } }
  if (!response.ok || body.cacheHit || !Array.isArray(body.items) || body.items.length === 0) throw new Error(body.error?.message ?? (body.cacheHit ? 'The content vault returned a cached item; a live provider test requires a fresh category.' : `Provider test failed (${response.status}).`))
  setAiProviderStatus(provider, 'Connection test passed')
  return true
}

function localCuratedFallback(input: { game: AiGame; itemKind: AiItemKind; categoryId: string; count?: number; recentItems?: string[]; locale?: string; suitability?: 'general' | 'teen' | 'adult' }, reason: string) {
  const itemKind = input.itemKind
  if (itemKind === 'category') throw new Error('Offline category generation is not available. Use the API when online, or continue with existing packs.')
  const kindMap: Record<Exclude<AiItemKind, 'category'>, string> = { word: 'word', charade: 'phrase', truth: 'truth', dare: 'dare', statement: 'never-have-i-ever', 'party-prompt': 'party-prompt' }
  const locale = input.locale ?? 'en'
  const recent = new Set((input.recentItems ?? []).map(value => value.normalize('NFKC').trim().toLocaleLowerCase(locale)))
  const matching = SEEDED_CONTENT.filter(item =>
    item.gameId === input.game
    && item.kind === kindMap[itemKind]
    && item.categoryId === input.categoryId
    && item.locale === locale
    && (input.suitability ? item.suitability === input.suitability : item.suitability === 'general')
    && !recent.has(item.text.normalize('NFKC').trim().toLocaleLowerCase(locale)),
  )
  const selected = secureShuffle(matching).slice(0, Math.min(5, Math.max(1, input.count ?? 5)))
  if (!selected.length) throw new Error(`${reason} No unused content is available offline for this selection; connect to the internet to generate from the vault/LLM or choose a different pack.`)
  return {
    provider: 'local-curated' as const,
    items: selected.map(item => ({ id: item.id, text: item.text, categoryId: item.categoryId, kind: input.itemKind, locale: item.locale, ...(item.hints?.length ? { hints: [...item.hints] } : {}) })),
    fallbackReason: reason,
  }
}

export type AiContentRequest = {
  game: AiGame
  itemKind: AiItemKind
  categoryId: string
  /** For API-only custom categories/packs: user-provided title (inert data). */
  categoryName?: string
  /** For API-only custom categories/packs: user-provided short description (inert data). */
  categoryDescription?: string
  count?: number
  recentItems?: string[]
  playerCount?: number
  playerNames?: string[]
  locale?: string
  suitability?: 'general' | 'teen' | 'adult'
  /** Explicit 18+ mode flag from settings; required for adult suitability. */
  adultMode?: boolean
}

export async function generateAiContent(input: AiContentRequest, signal?: AbortSignal) {
  // adultMode: suitability === 'adult' is required for adult generation.
  const suitability = input.suitability ?? (input.adultMode ? 'adult' : 'general')
  const adultMode = suitability === 'adult' || input.adultMode === true
  const online = typeof navigator === 'undefined' ? true : navigator.onLine
  if (!online) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Generation cancelled.', 'AbortError')
    return localCuratedFallback({ ...input, suitability }, 'No internet connection; using offline content.')

  }
  assertSecureTransport()
  // Use the configured provider order for every suitability. Cloudflare remains
  // the operator-managed fallback when no BYOK provider is configured.
  const providers: AiProvider[] = getAiProviderOrder()
  let lastError = 'No remote provider is available.'
  for (const provider of providers) {
    if ((cooldownUntil[provider] ?? 0) > Date.now()) continue
    const key = provider === 'cloudflare-workers-ai' ? undefined : keys[provider]
    if (provider !== 'cloudflare-workers-ai' && !key) continue
    try {
      const response = await apiFetch(`${apiBase}/v1/content/generate`, { method: 'POST', signal: signal ?? null, cache: 'no-store', headers: { 'content-type': 'application/json', 'x-provider-id': provider, ...(key ? { 'x-provider-key': key } : {}) }, body: JSON.stringify({ schemaVersion: 1, requestId: crypto.randomUUID(), game: input.game, itemKind: input.itemKind, categoryId: input.categoryId, ...(input.categoryName ? { categoryName: input.categoryName.slice(0, 120) } : {}), ...(input.categoryDescription ? { categoryDescription: input.categoryDescription.slice(0, 280) } : {}), locale: input.locale ?? 'en', suitability, adultMode, count: Math.min(5, Math.max(1, input.count ?? 5)), ...(input.playerCount ? { playerCount: input.playerCount } : {}), ...(input.playerNames?.length ? { playerNames: input.playerNames.slice(0, 32).map(name => name.trim().slice(0, 80)) } : {}), recentItems: (input.recentItems ?? []).slice(-30) }) })
      const body = await response.json() as { items?: AiGeneratedItem[]; cacheHit?: boolean; provider?: string; error?: { code?: string; message?: string; retryable?: boolean } }
      if (!response.ok || !Array.isArray(body.items)) {
        lastError = body.error?.message ?? `Provider request failed (${response.status}).`
        setAiProviderStatus(provider, lastError)
        failureCounts[provider] = (failureCounts[provider] ?? 0) + 1
        if (failureCounts[provider]! >= 3 && body.error?.retryable !== false) cooldownUntil[provider] = Date.now() + 30_000
        if (body.error?.code === 'AUTH_INVALID') { if (provider !== 'cloudflare-workers-ai') preferences = { ...preferences, enabled: { ...preferences.enabled, [provider]: false } }; persist(); emit(); continue }
        continue
      }
      failureCounts[provider] = 0; delete cooldownUntil[provider]
      const resolvedProvider = body.cacheHit || body.provider === 'content-vault' ? 'content-vault' : provider
      setAiProviderStatus(provider, body.cacheHit ? 'Content vault hit — no provider request used' : 'Connected — generation succeeded')
      return { provider: resolvedProvider as AiGenerationProvider, items: body.items, cacheHit: body.cacheHit === true }
    } catch (error) {
      if (signal?.aborted) throw error
      lastError = error instanceof Error ? error.message : 'Provider request failed.'
      setAiProviderStatus(provider, lastError)
      failureCounts[provider] = (failureCounts[provider] ?? 0) + 1
      if (failureCounts[provider]! >= 3) cooldownUntil[provider] = Date.now() + 30_000
    }
  }
  if (signal?.aborted) throw signal.reason ?? new DOMException('Generation cancelled.', 'AbortError')
  return localCuratedFallback({ ...input, suitability }, `Remote generation unavailable: ${lastError}.`)
}

