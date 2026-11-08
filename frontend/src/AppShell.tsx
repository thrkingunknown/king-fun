import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { ContentItem, ContentPack } from './domain/shared/contracts.ts'
import { StatusPanel } from './components/ui/StatusPanel.tsx'
import { Icon } from './components/ui/Icon.tsx'
import { AmbientBackground } from './components/ui/AmbientBackground.tsx'
import { ScreenErrorBoundary } from './components/ui/ScreenErrorBoundary.tsx'
import HomePage from './App.tsx'
import './App.css'
import './design-system.css'
import './visual-refresh.css'
import { appendRecentContent, contentAllowedForMode, eligibleContentItems, easiestContentSlice, isKailasCreatorTarget, uniqueContentItems } from './domain/content/selection.ts'
import { categoryRepeatWindow, selectPlayerNoRepeat } from './domain/random/selection.ts'
import { secureRandomInteger, secureShuffle } from './domain/random/secure-random.ts'
import type { GuessUpRoundState } from './domain/games/guessup.ts'
import { asContentId, asPackId, asPlayerId } from './domain/shared/ids.ts'
import { parseContentItem, parseContentPack } from './domain/shared/validation.ts'
import {
  announceRevision,
  clearCustomPacks,
  commitPortalSnapshot,
  deleteCustomPack as deleteStoredCustomPack,
  exportPortalBackup,
  forceResetPortalDatabase,
  getPersistentStorageState,
  listCustomPacks,
  listenForRemoteRevision,
  publishStorageStatus,
  readPortalSnapshot,
  resetPortalDatabase,
  replaceCustomPacks,
  requestPersistentStorage,
  restorePortalBackup,
  parsePortalBackup,
  saveCustomPack as persistCustomPack,
  StorageConflictError,
} from './domain/storage/portal-storage.ts'
import { usePortalStorageStatus } from './domain/storage/storage-status.ts'
const ImposterGame = lazy(() => import('./games/ImposterGame.tsx').then(module => ({ default: module.ImposterGame })))
const GuessUpGame = lazy(() => import('./games/GuessUpGame.tsx').then(module => ({ default: module.GuessUpGame })))
const TruthOrDareGame = lazy(() => import('./games/TruthOrDareGame.tsx').then(module => ({ default: module.TruthOrDareGame })))
const NeverHaveIEverGame = lazy(() => import('./games/NeverHaveIEverGame.tsx').then(module => ({ default: module.NeverHaveIEverGame })))
const PartyArcadeGame = lazy(() => import('./games/PartyArcadeGame.tsx').then(module => ({ default: module.PartyArcadeGame })))
const SetupScreen = lazy(() => import('./screens/SetupScreen.tsx').then(module => ({ default: module.SetupScreen })))
const HistoryScreen = lazy(() => import('./screens/HistoryScreen.tsx').then(module => ({ default: module.HistoryScreen })))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen.tsx').then(module => ({ default: module.SettingsScreen })))
const CommandPalette = lazy(() => import('./components/ui/CommandPalette.tsx').then(module => ({ default: module.CommandPalette })))
const ConfirmDialog = lazy(() => import('./components/ui/ConfirmDialog.tsx').then(module => ({ default: module.ConfirmDialog })))
import type { AiGame, AiGeneratedItem, AiItemKind } from './services/ai-providers.ts'
import { generateAiContent } from './services/ai-providers.ts'
import { GAMES, INITIAL_SAVE, normalizePromptReports, normalizeSave, resolveGameRoster, type Game, type GameSetup, type GuessUpPreferences, type MotionPreference, type Save, type SetupPackDraft, normalizeImportedSave } from './types.ts'
import { wheelAngleForPlayer, wheelAngleForSegment } from './domain/games/roulette.ts'
import { TRUTH_DARE_WHEEL_OPTIONS, truthDareKindForIndex } from './domain/games/truth-or-dare-wheel.ts'
import type { PromptReportReason } from './components/gameplay/PromptReportDialog.tsx'
import { clearCreatorToken, getCreatorToken, unlockCreator, verifyCreator, loadModerationQueue, loadBlockedContentIds, moderateCommunityContent, type ModerationQueueItem } from './services/creator-access.ts'

const uid = () => crypto.randomUUID()
const contentQueueKey = (item: ContentItem) => `content:${item.gameId}:${item.categoryId}:${item.kind}:${item.locale}:${item.suitability ?? 'general'}`
const normalizePlayerName = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
type AppProps = { readonly initialState: Save; readonly initialRevision: number; readonly initialPersistenceAvailable: boolean }
type SeedContentModule = typeof import('./content/seed.ts')
type LoadedSeedContent = { readonly content: SeedContentModule['SEEDED_CONTENT']; readonly packs: SeedContentModule['SEEDED_PACKS'] }
type Screen = 'home' | 'setup' | 'play' | 'history' | 'settings'
type Confirmation = { title: string; description: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void }

function patchActiveSave(current: Save, phase: string, data: Record<string, any>): Save {
  if (!current.active) return current
  return { ...current, active: { ...current.active, phase, data } }
}

function makeDefaultSetup(game: Game, players: Save['players'], packs: readonly ContentPack[], preferences: GuessUpPreferences, imposterPreferences: NonNullable<Save['imposterPreferences']>): GameSetup {
  const firstPack = packs.find(pack => pack.gameId === game && pack.isDefault) ?? packs.find(pack => pack.gameId === game)
  return {
    packIds: firstPack ? [firstPack.id] : [],
    mode: 'spin-wheel',
    durationSeconds: preferences.durationSeconds,
    teamAName: 'Team A',
    teamBName: 'Team B',
    teamAssignments: Object.fromEntries(players.map((player, index) => [player.id, index % 2 === 0 ? 'A' : 'B'])),
    responseMethod: 'fingers',
    soundEnabled: preferences.soundEnabled,
    musicEnabled: preferences.musicEnabled,
    vibrationEnabled: preferences.vibrationEnabled,
    inputMode: preferences.inputMode,
    imposter: { ...imposterPreferences },
    arcade: {
      playStyle: game === 'tilt-it' || game === 'letterburg' ? 'teams' : 'classic',
      durationSeconds: preferences.durationSeconds,
      roleCount: 1,
      phoneNarrator: true,
      antiItemsMode: false,
      readPromptsAloud: false,
      fuseSeconds: 10,
    },
  }
}

export default function AppShell({ initialState, initialRevision, initialPersistenceAvailable }: AppProps) {
  const [save, setSave] = useState<Save>(() => normalizeSave(initialState))
  const [persistenceAvailable, setPersistenceAvailable] = useState(initialPersistenceAvailable)
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null)
  const [creatorEnabled, setCreatorEnabled] = useState(false)
  const [creatorModalOpen, setCreatorModalOpen] = useState(false)
  const [creatorSecret, setCreatorSecret] = useState('')
  const [creatorUnlocking, setCreatorUnlocking] = useState(false)
  const [moderationQueue, setModerationQueue] = useState<ModerationQueueItem[]>([])
  const [moderationBusyId, setModerationBusyId] = useState<string | null>(null)
  const [, setBlockedContentIds] = useState<ReadonlySet<string>>(() => new Set())
  const blockedContentIdsRef = useRef<ReadonlySet<string>>(new Set())
  const aiGeneratedTextRef = useRef(new Map<string, string>())
  const creatorTapRef = useRef({ count: 0, startedAt: 0 })
  const creatorDialogRef = useRef<HTMLDialogElement>(null)
  const [customPacks, setCustomPacks] = useState<ContentPack[]>([])
  const [customItems, setCustomItems] = useState<ContentItem[]>([])
  const [seedContent, setSeedContent] = useState<LoadedSeedContent | null>(null)
  const seedContentPromiseRef = useRef<Promise<SeedContentModule> | null>(null)
  const guessUpRulesPromiseRef = useRef<Promise<typeof import('./domain/games/guessup.ts')> | null>(null)
  const revisionRef = useRef(initialRevision)
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve())
  const startPendingRef = useRef(false)
  const storageStatus = usePortalStorageStatus()
  const [screen, setScreen] = useState<Screen>('home')
  const [ambientMotionEnabled, setAmbientMotionEnabled] = useState(true)
  const [systemReducedMotion, setSystemReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [selected, setSelected] = useState<Game>('imposter')
  const [toastMessage, setToastMessage] = useState('')
  const toastTimerRef = useRef<number | null>(null)
  const setToast = (message: string) => {
    if (!message) return
    setToastMessage(message)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => { setToastMessage(''); toastTimerRef.current = null }, 3200)
  }
  useEffect(() => () => { if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current) }, [])
  const [spinPending, setSpinPending] = useState(false)
  const [wheelDurationMs, setWheelDurationMs] = useState(3600)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [launch, setLaunch] = useState<{ game: Game; x: number; y: number } | null>(null)
  const lastSetupRef = useRef<GameSetup | null>(null)
  const mainContentRef = useRef<HTMLElement>(null)

  const ensureSeedContent = async (): Promise<LoadedSeedContent> => {
    if (seedContent) return seedContent
    const module = await (seedContentPromiseRef.current ??= import('./content/seed.ts'))
    const loaded = { content: module.SEEDED_CONTENT, packs: module.SEEDED_PACKS }
    setSeedContent(loaded)
    return loaded
  }
  const loadGuessUpRules = () => (guessUpRulesPromiseRef.current ??= import('./domain/games/guessup.ts'))
  const contentItems = useMemo(() => [...(seedContent?.content ?? []), ...customItems], [seedContent, customItems])
  const contentPacks = useMemo(() => [...(seedContent?.packs ?? []), ...customPacks], [seedContent, customPacks])

  useEffect(() => {
    if (!contentItems.length) return
    const state = { cancelled: false }
    void loadBlockedContentIds(contentItems.map(item => item.id)).then(ids => { if (!state.cancelled) { const merged = new Set([...blockedContentIdsRef.current, ...ids]); blockedContentIdsRef.current = merged; setBlockedContentIds(merged) } })
    return () => { state.cancelled = true }
  }, [contentItems])

  useEffect(() => {
    const onQuarantined = (event: Event) => {
      const contentId = (event as CustomEvent<unknown>).detail
      if (typeof contentId === 'string') { const merged = new Set([...blockedContentIdsRef.current, contentId]); blockedContentIdsRef.current = merged; setBlockedContentIds(merged) }
    }
    window.addEventListener('king-fun:content-quarantined', onQuarantined)
    return () => window.removeEventListener('king-fun:content-quarantined', onQuarantined)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => mainContentRef.current?.focus({ preventScroll: true }))
    return () => window.cancelAnimationFrame(frame)
  }, [screen])

  const handleQuickOpen = useCallback((event: KeyboardEvent) => {
    if (event.isComposing || event.repeat || !(event.metaKey || event.ctrlKey) || event.altKey || (event.code !== 'KeyK' && event.key.toLowerCase() !== 'k')) return
    const target = event.target instanceof HTMLElement ? event.target : document.activeElement
    if (target instanceof HTMLElement && (target.isContentEditable || target.matches('input,textarea,select,[contenteditable="true"],[role="combobox"]') || target.closest('[contenteditable="true"],[role="combobox"]'))) return
    event.preventDefault()
    setCommandOpen(true)
  }, [])

  useLayoutEffect(() => {
    document.addEventListener('keydown', handleQuickOpen, true)
    return () => document.removeEventListener('keydown', handleQuickOpen, true)
  }, [handleQuickOpen])

  useEffect(() => {
    let cancelled = false
    const token = getCreatorToken()
    if (token) void verifyCreator(token).then(valid => { if (!cancelled) setCreatorEnabled(valid) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const dialog = creatorDialogRef.current
    if (creatorModalOpen && dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [creatorModalOpen])

  useEffect(() => {
    if (!creatorEnabled) {
      // oxlint-disable-next-line react-hooks/set-state-in-effect -- clear stale queue when creator access is revoked
      setModerationQueue([])
      return
    }
    let cancelled = false
    // Creator access is committed before the unlock dialog closes. Fetching must
    // follow the authenticated state, not depend on the dialog remaining open.
    void loadModerationQueue().then(items => { if (!cancelled) setModerationQueue(items) })
    return () => { cancelled = true }
  }, [creatorEnabled, creatorModalOpen])

  useEffect(() => {
    document.documentElement.dataset.motion = save.motionPreference ?? 'system'
  }, [save.motionPreference])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = (event: MediaQueryListEvent) => setSystemReducedMotion(event.matches)
    media.addEventListener('change', updateMotionPreference)
    return () => media.removeEventListener('change', updateMotionPreference)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = save.theme
  }, [save.theme])

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta) meta.content = save.theme === 'dark' ? '#090d13' : '#f3f6fa'
  }, [save.theme])

  useEffect(() => {
    let cancelled = false
    void getPersistentStorageState().then(value => { if (!cancelled) setStoragePersisted(value) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!persistenceAvailable) return
    let cancelled = false
    void listCustomPacks().then(records => {
      if (cancelled) return
      setCustomPacks(records.map(row => row.pack))
      setCustomItems(records.flatMap(row => [...row.items]))
    }).catch(error => {
      if (!cancelled) publishStorageStatus({ kind: 'warning', message: `Custom packs could not be loaded: ${error instanceof Error ? error.message : 'local storage error'}` })
    })
    return () => { cancelled = true }
  }, [persistenceAvailable])

  useEffect(() => {
    if (!persistenceAvailable) return
    writeQueueRef.current = writeQueueRef.current.then(async () => {
      try {
        const revision = await commitPortalSnapshot(save, revisionRef.current)
        revisionRef.current = revision
        announceRevision(revision)
        publishStorageStatus({ kind: 'ready', message: 'Saved on this device.' })
      } catch (error) {
        if (error instanceof StorageConflictError) {
          publishStorageStatus({ kind: 'conflict', message: 'Another tab has saved a newer version. Reload the latest save before continuing.', remoteRevision: error.remoteRevision })
        } else {
          const detail = error instanceof Error ? error.message : 'Unknown error.'
          setPersistenceAvailable(false)
          publishStorageStatus({ kind: 'warning', message: `Local saving is unavailable. The app will continue in memory-only mode: ${detail}` })
        }
      }
    })
  }, [save, persistenceAvailable])

  useEffect(() => listenForRemoteRevision(revision => {
    if (revision > revisionRef.current) publishStorageStatus({ kind: 'conflict', message: 'Another tab has changed this game. Reload the latest save to avoid overwriting it.', remoteRevision: revision })
  }), [])

  const update = (patch: Partial<Save>) => setSave(current => ({ ...current, ...patch }))
  const resetRecentContent = (game: Game) => askConfirmation({
    title: `Reset ${GAMES.find(item => item.id === game)?.name ?? 'game'} content history?`,
    description: 'Previously used prompts or words from this game become eligible again. Player history and other games are unchanged.',
    confirmLabel: 'Reset content history',
    destructive: true,
    onConfirm: () => setSave(current => {
      const recent = { ...current.recent }
      if (game === 'imposter') { delete recent['imposter:all']; delete recent['imposter:words']; delete recent['category:imposter'] }
      for (const key of Object.keys(recent)) if (key.startsWith(`content:${game}:`)) delete recent[key]
      return { ...current, recent }
    }),
  })
  const updateGuessUpPreferences = (patch: Partial<GuessUpPreferences>) => setSave(current => {
    const previous = current.guessUpPreferences ?? INITIAL_SAVE.guessUpPreferences!
    const preferences = { ...previous, ...patch }
    if (previous.durationSeconds === preferences.durationSeconds && previous.soundEnabled === preferences.soundEnabled && previous.musicEnabled === preferences.musicEnabled && previous.vibrationEnabled === preferences.vibrationEnabled && previous.inputMode === preferences.inputMode) return current
    return { ...current, guessUpPreferences: preferences }
  })
  // React Compiler owns memoization for this callback; a manual useCallback here
  // conflicts with the compiler's inferred dependency model and emits a warning.
  const patchActive = (phase: string, data: Record<string, any>) => {
    setSave(current => patchActiveSave(current, phase, data))
  }
  const askConfirmation = (dialog: Confirmation) => setConfirmation(dialog)
  const closeConfirmation = () => setConfirmation(null)
  const confirmAction = () => { const action = confirmation?.onConfirm; setConfirmation(null); action?.() }
  const setAdultMode = (enabled: boolean) => {
    if (enabled === save.adultMode) return
    if (enabled) {
      askConfirmation({
        title: 'Enable 18+ mode?',
        description: 'Confirm that every person who will play is 18 or older. Adult packs may include sexual vocabulary, sexual-history questions, dark humour and consent-based physical-contact dares. Every player must be free to skip or pass. This switch is not identity or age verification.',
        confirmLabel: 'I confirm everyone is 18+',
        onConfirm: () => update({ adultMode: true }),
      })
      return
    }
    const endsAdultSession = save.active?.data.adultMode === true
    askConfirmation({
      title: 'Turn off 18+ mode?',
      description: endsAdultSession
        ? 'Teen and adult packs will disappear and the current age-restricted game will end so an age-restricted prompt or deck cannot remain visible or be resumed.'
        : 'Only general all-ages content will be eligible. Teen and adult database results and packs will be excluded from future game selection and generation.',
      confirmLabel: 'Turn off 18+ mode',
      onConfirm: () => {
        update({ adultMode: false, ...(endsAdultSession ? { active: null } : {}) })
        if (endsAdultSession) setScreen('home')
      },
    })
  }

  const launchGame = async (game: Game, card: HTMLElement) => {
    try {
      await ensureSeedContent()
    } catch {
      setToast('The bundled content could not be loaded. Reload and try again.')

      return
    }
    const icon = card.querySelector('.card-icon')
    const bounds = icon?.getBoundingClientRect() ?? card.getBoundingClientRect()
    setLaunch({ game, x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
    const reducedMotion = save.motionPreference === 'reduce' || (save.motionPreference === 'system' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false))
    window.setTimeout(() => { setSelected(game); setScreen('setup'); setLaunch(null) }, reducedMotion ? 30 : 420)
  }

  const selectContent = useCallback((game: Game, kind: string | undefined, packIds: readonly string[], seenIds: readonly string[] = [], recordRecent = true, playerName?: string): ContentItem | null => {
    const pool = contentItems.filter(item => contentAllowedForMode(item, save.adultMode) && !blockedContentIdsRef.current.has(item.id) && item.gameId === game && packIds.includes(item.packId) && (!kind || item.kind === kind))
    const recentIds = pool.flatMap(item => save.recent[contentQueueKey(item)] ?? [])
    let eligible = eligibleContentItems(pool, recentIds, seenIds)
    // The creator override applies only to Kailas's individual turn, never the shared roster.
    if (isKailasCreatorTarget(creatorEnabled, playerName)) eligible = easiestContentSlice(eligible)
    if (eligible.length === 0) return null
    const chosen = eligible[secureRandomInteger(eligible.length)]!
    if (recordRecent) {
      const key = contentQueueKey(chosen)
      setSave(current => ({ ...current, recent: { ...current.recent, [key]: appendRecentContent(current.recent[key] ?? [], chosen.id, 20) } }))
    }
    return chosen
  }, [contentItems, save.recent, save.adultMode, creatorEnabled])

  const draw = useCallback(async (game: Game, kind?: string, packIds: readonly string[] = [], seenIds: readonly string[] = [], playerName?: string): Promise<ContentItem | null> => {
    const suitability = save.adultMode ? 'adult' : 'general'
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true
    const aiGame = (['imposter', 'guessup', 'truth-or-dare', 'never-have-i-ever', 'fake-it', 'fake-story', 'fact-or-fiction', 'wrong-answers-only', 'hot-bomb', 'hot-bomb-duel', 'whos-most-likely', 'would-you-rather', 'share-or-pass', 'challenge-20', 'tilt-it', 'letterburg', 'discussion-starter', 'who-am-i', 'ten-tangle', 'qupid', 'questions-for-love', 'a-or-b', 'reverse-singing'] as const).includes(game as any)
    const itemKind = kind === 'phrase' || kind === 'charade' ? 'charade' : kind === 'word' ? 'word' : kind === 'truth' ? 'truth' : kind === 'dare' ? 'dare' : kind === 'never-have-i-ever' ? 'statement' : kind === 'party-prompt' ? 'party-prompt' : null
    const currentTurnPlayerNames = playerName?.trim() ? [playerName.trim()] : undefined
    if (online && aiGame && itemKind && itemKind !== 'word') {
      const categoryId = (packIds[0] ?? game).toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64) || 'general'
      const sourcePack = contentPacks.find(pack => String(pack.id) === packIds[0] && pack.gameId === game)
      const queueKey = `content:${game}:${categoryId}:${itemKind}:en:${suitability}`
      const queuedIds = save.recent[queueKey] ?? []
      const recentTexts = [...new Set([
        ...queuedIds.map(id => contentItems.find(item => item.id === id)?.text ?? aiGeneratedTextRef.current.get(id)),
        ...seenIds.map(id => contentItems.find(item => item.id === id)?.text ?? aiGeneratedTextRef.current.get(id)),
      ].filter((v): v is string => Boolean(v)))].slice(-30)
      try {
        const result = await generateAiContent({ game: game as AiGame, itemKind: itemKind as AiItemKind, categoryId, ...(sourcePack ? { categoryName: sourcePack.name, categoryDescription: sourcePack.description } : {}), count: 1, suitability, adultMode: save.adultMode, playerCount: save.players.length, playerNames: save.players.map(player => player.name), ...(currentTurnPlayerNames ? { currentTurnPlayerNames } : {}), recentItems: recentTexts })
        const first = result.items[0]
        setToast(result.provider === 'content-vault'
          ? 'Loaded fresh content from the content vault.'
          : result.provider === 'local-curated'
            ? ('fallbackReason' in result ? result.fallbackReason : 'Remote generation failed; using local content.')
            : `Generated fresh content with ${result.provider === 'cloudflare-workers-ai' ? 'Cloudflare Workers AI' : result.provider}.`)
        if (first) {
          const mapped: ContentItem = {
            id: asContentId(`ai:${first.id}`),
            gameId: game as any,
            kind: (kind === 'phrase' ? 'phrase' : kind ?? 'party-prompt') as any,
            text: first.text,
            ...(first.hints?.length ? { hints: first.hints } : {}),
            locale: 'en' as any,
            packId: asPackId(`ai:${categoryId}`),
            categoryId,
            suitability: suitability as any,
            tags: [game, 'ai'],
            provenance: { source: 'ai-assisted:gateway', license: 'UserCreated', creator: 'ai', createdAt: Date.now(), reviewedAt: null },
          }
            aiGeneratedTextRef.current.set(mapped.id, mapped.text)
          const key = contentQueueKey(mapped)
          setSave(current => ({ ...current, recent: { ...current.recent, [key]: appendRecentContent(current.recent[key] ?? [], mapped.id, 20) } }))
          return mapped
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return null
        setToast(`AI generation failed; using local content if available. ${error instanceof Error ? error.message : 'Try again shortly.'}`)
        // Fall through to local selection.
      }
    }
    const local = selectContent(game, kind, packIds, seenIds, true, playerName)
    if (!local && !online) setToast('Offline content is unavailable for this selection. Reconnect to generate fresh content from the API.')
    return local
  }, [contentItems, contentPacks, save.adultMode, save.players, save.recent, selectContent])

  const drawGuessUpDeck = (packIds: readonly string[], excludeIds: ReadonlySet<string> = new Set()): ContentItem[] => {
    const pool = uniqueContentItems(contentItems.filter(item => contentAllowedForMode(item, save.adultMode) && !blockedContentIdsRef.current.has(item.id) && !excludeIds.has(item.id) && item.gameId === 'guessup' && packIds.includes(item.packId) && (item.kind === 'phrase' || item.kind === 'word')))
    const eligible = pool.filter(item => !(save.recent[contentQueueKey(item)] ?? []).includes(item.id))
    if (eligible.length === 0) return []
    const deck = secureShuffle(eligible)
    return deck
  }

  const saveCustomPack = async (draft: SetupPackDraft, existingId?: string): Promise<ContentPack | null> => {
    if (draft.suitability !== 'general' && save.adultMode !== true) throw new Error('Enable 18+ mode before creating or saving teen or adult content packs.')
    if (draft.gameId === 'imposter' && !draft.apiOnly) {
      if (draft.kind !== 'word') throw new Error('Imposter custom categories must contain secret words.')
      const { validateImposterPackEntries } = await import('./domain/games/imposter-pack.ts')
      validateImposterPackEntries(draft.entries)
    }
    const packId = existingId ?? `custom-${uid().replaceAll('-', '')}`
    const existing = customPacks.find(pack => pack.id === packId)
    const pack = parseContentPack({
      id: asPackId(packId),
      gameId: draft.gameId,
      name: draft.name,
      emoji: draft.emoji,
      description: draft.description || 'A custom local pack made for your group.',
      locale: 'en',
      suitability: draft.suitability,
      version: (existing?.version ?? 0) + 1,
      contentIds: draft.entries.map((_, index) => asContentId(`${packId}:v${(existing?.version ?? 0) + 1}:${index + 1}`)),
      isDefault: false,
    })
    const items = draft.entries.map((text, index) => {
      const fields = text.split('|').map(field => field.trim())
      const usesAnswerMetadata = draft.gameId === 'fake-it' || draft.gameId === 'fact-or-fiction'
      const displayText = draft.gameId === 'imposter' || usesAnswerMetadata ? fields[0]!.trim() : text
      const metadata = draft.gameId === 'imposter'
        ? fields.slice(1).filter(Boolean).slice(0, 20)
        : usesAnswerMetadata ? [draft.gameId === 'fact-or-fiction' ? (fields[1] ?? '').toLocaleLowerCase() : fields[1] ?? ''] : []
      return parseContentItem({
      id: asContentId(`${packId}:v${(existing?.version ?? 0) + 1}:${index + 1}`),
      gameId: draft.gameId,
      kind: draft.kind,
      text: displayText,
      ...(metadata.length ? { hints: metadata } : {}),
      locale: 'en',
      packId: pack.id,
      categoryId: draft.categoryId ?? packId.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 64),
      suitability: draft.suitability,
      tags: [draft.gameId, 'custom'],
      provenance: { source: 'user-created:local-pack', license: 'UserCreated', creator: 'local-user', createdAt: Date.now(), reviewedAt: null },
    })
    })
    let savedDurably = false
    if (persistenceAvailable) {
      try {
        await persistCustomPack(pack, items)
        savedDurably = true
      } catch (error) {
        setPersistenceAvailable(false)
        publishStorageStatus({ kind: 'warning', message: `The custom pack is kept in this tab, but could not be saved locally: ${error instanceof Error ? error.message : 'storage unavailable'}` })
      }
    }
    setCustomPacks(current => [...current.filter(item => item.id !== pack.id), pack])
    setCustomItems(current => [...current.filter(item => item.packId !== pack.id), ...items])
    setToast(savedDurably ? `Saved “${pack.name}” locally.` : `“${pack.name}” is available in this tab only until storage is restored.`)
    return pack
  }

  const deleteCustomPack = (packId: string) => {
    const pack = customPacks.find(item => item.id === packId)
    if (!pack) return
    askConfirmation({
      title: `Delete “${pack.name}”?`,
      description: 'This removes the custom pack and its prompts from this device. Curated packs are not affected.',
      confirmLabel: 'Delete pack',
      destructive: true,
      onConfirm: () => {
        const removeFromMemory = () => {
          setCustomPacks(current => current.filter(item => item.id !== packId))
          setCustomItems(current => current.filter(item => item.packId !== packId))
        }
        if (!persistenceAvailable) {
          removeFromMemory()
          setToast('Custom pack removed from this tab. Local storage is unavailable, so this change is not durable.')
          return
        }
        void deleteStoredCustomPack(packId).then(() => {
          removeFromMemory()
          setToast('Custom pack deleted from this device.')
        }).catch(error => {
          setPersistenceAvailable(false)
          removeFromMemory()
          publishStorageStatus({ kind: 'warning', message: `Custom pack removed from this tab only; persistent deletion failed: ${error instanceof Error ? error.message : 'storage unavailable'}` })
        })
      },
    })
  }

  const startGame = async (setup?: GameSetup) => {
    if (startPendingRef.current) return
    startPendingRef.current = true
    try {
      const loadedSeed = await ensureSeedContent()
      const latestBlockedIds = await loadBlockedContentIds([...loadedSeed.content, ...customItems].map(item => item.id))
      const mergedBlockedIds = new Set([...blockedContentIdsRef.current, ...latestBlockedIds])
      blockedContentIdsRef.current = mergedBlockedIds
      setBlockedContentIds(mergedBlockedIds)
      const gameContentItems = [...loadedSeed.content, ...customItems].filter(item => contentAllowedForMode(item, save.adultMode) && !mergedBlockedIds.has(item.id))
      const gameContentPacks = [...loadedSeed.packs, ...customPacks]
      const game = selected
      const requestedConfig = setup ?? lastSetupRef.current ?? makeDefaultSetup(game, save.players, gameContentPacks, save.guessUpPreferences ?? INITIAL_SAVE.guessUpPreferences!, save.imposterPreferences ?? INITIAL_SAVE.imposterPreferences!)
      // Normalize legacy or partial Imposter setup snapshots before they enter a round.
      const config: GameSetup = game === 'imposter'
        ? { ...requestedConfig, imposter: { ...(INITIAL_SAVE.imposterPreferences!), ...(save.imposterPreferences ?? {}), ...(requestedConfig.imposter ?? {}) } }
        : requestedConfig
      setSave(current => ({
        ...current,
        selectedPackIdsByGame: {
          ...(current.selectedPackIdsByGame ?? {}),
          [game]: [...config.packIds],
        },
      }))
      const minimumPlayers = game === 'imposter' || game === 'timer-impostor' ? 3
        : game === 'werewolf' || game === 'mafia' ? 5
          : game === 'murder' || game === 'fake-story' || game === 'fact-or-fiction' || game === 'fake-it' ? 3 : 2
      const maximumPlayers = game === 'imposter' || game === 'werewolf' || game === 'mafia' || game === 'who-am-i' ? 20
        : game === 'hot-bomb-duel' || game === 'qupid' || game === 'questions-for-love' || game === 'a-or-b' ? 2 : 32
      const ruleOnlyGame = ['timer-impostor', 'werewolf', 'mafia', 'murder'].includes(game)
      if (save.players.length < minimumPlayers) { setToast(`Add at least ${minimumPlayers} players for ${GAMES.find(item => item.id === game)?.name ?? 'this game'}.`); return }
      if (save.players.length > maximumPlayers) { setToast(`${GAMES.find(item => item.id === game)?.name ?? 'This game'} supports at most ${maximumPlayers} players.`); return }
      if (config.packIds.length === 0 && !ruleOnlyGame) { setToast('Select at least one content pack.'); return }
      if (!save.adultMode && gameContentPacks.some(pack => config.packIds.includes(pack.id) && pack.suitability !== 'general')) { setToast('Only all-ages packs can be played while 18+ mode is off.'); return }

      let data: Record<string, any> = {}
      let phase = 'playing'
      const recent = { ...save.recent }
      if (game === 'imposter') {
        const { createImposterRound, normalizeImposterWord, selectImposterCategory, selectImposterWord } = await import('./domain/games/imposter.ts')
        const categoryPacks = [...new Map(gameContentPacks
          .filter(pack => pack.gameId === 'imposter' && config.packIds.includes(pack.id))
          .map(pack => [String(pack.id), pack] as const)).values()]
        const selectedCategoryIds = categoryPacks.map(pack => String(pack.id))
        if (!selectedCategoryIds.length) {
          setToast('Select at least one Imposter category.')
          return
        }

        const usedWords = recent['imposter:all'] ?? []
        const usedWordTexts = recent['imposter:words'] ?? []
        const recentCategoryIds = recent['category:imposter'] ?? []
        const categoryWindow = categoryRepeatWindow(selectedCategoryIds.length)
        const selectedCategoryId = selectImposterCategory(selectedCategoryIds, recentCategoryIds, categoryWindow, secureRandomInteger)
        const sourcePack = categoryPacks.find(pack => pack.id === selectedCategoryId)
        if (!sourcePack) {
          setToast('A selected Imposter category is unavailable. Reopen setup and try again.')
          return
        }

        // Built-in category metadata always routes through the LLM provider order.
        // Only explicitly user-authored/imported packs may draw local word entries.
        const localWordPool = sourcePack.isDefault ? [] : uniqueContentItems(gameContentItems.filter(item =>
          item.gameId === 'imposter' && item.kind === 'word' && item.packId === sourcePack.id,
        ))
        const categoryWordQueueKey = localWordPool[0]
          ? contentQueueKey(localWordPool[0])
          : `content:imposter:${sourcePack.id}:word:en:${sourcePack.suitability}`
        const recentCategoryWordIds = recent[categoryWordQueueKey] ?? []
        let word = selectImposterWord(
          localWordPool,
          [...new Set([...usedWords, ...recentCategoryWordIds])],
          secureRandomInteger,
          usedWordTexts,
        )

        if (!word) {
          try {
            const generated = await generateAiContent({
              game: 'imposter',
              itemKind: 'word',
              categoryId: String(sourcePack.id),
              categoryName: sourcePack.name,
              categoryDescription: sourcePack.description,
              count: 5,
              suitability: sourcePack.suitability,
              adultMode: sourcePack.suitability === 'adult',
              recentItems: usedWordTexts,
            })
            const generatedWordPool = generated.items.map(item => ({
              id: asContentId(`ai:${item.id}`),
              gameId: 'imposter' as const,
              kind: 'word' as const,
              text: item.text,
              hints: (item.hints ?? []).map(hint => hint.trim()).filter(Boolean),
              locale: 'en' as const,
              packId: sourcePack.id,
              categoryId: String(sourcePack.id),
              suitability: sourcePack.suitability,
              tags: ['imposter', 'ai'],
              provenance: { source: 'ai-assisted:gateway' as const, license: 'UserCreated' as const, creator: 'ai' as const, createdAt: Date.now(), reviewedAt: null },
            }))
            word = selectImposterWord(
              generatedWordPool,
              [...new Set([...usedWords, ...recentCategoryWordIds])],
              secureRandomInteger,
              usedWordTexts,
            )
            if (!word) throw new Error('The category did not produce an unused secret word. Try again.')
            setToast(generated.provider === 'content-vault'
              ? `Loaded fresh ${sourcePack.name} words from the content vault.`
              : `Generated fresh ${sourcePack.name} words with ${generated.provider === 'cloudflare-workers-ai' ? 'Cloudflare Workers AI' : generated.provider}.`)
          } catch (error) {
            setToast(`Word generation failed: ${error instanceof Error ? error.message : 'Try again shortly.'}`)
            return
          }
        }

        const wordHints = config.imposter?.mysticHintsEnabled !== false && Array.isArray(word.hints)
          ? word.hints
          : []
        const shuffled = secureShuffle(save.players)
        const categoryLabel = sourcePack.name
        let round: ReturnType<typeof createImposterRound>
        try {
          const imposterSetup = config.imposter
          if (!imposterSetup) throw new Error('Imposter setup preferences are unavailable.')
          round = createImposterRound(save.players, shuffled.map(player => player.id), word.text, categoryLabel || 'Everyday', {
            mode: imposterSetup.mode,
            mysticCount: imposterSetup.mysticCount,
            mysticHintsEnabled: imposterSetup.mysticHintsEnabled,
            sameMysticHint: imposterSetup.sameMysticHint,
            hints: wordHints,
            discussionTimerEnabled: imposterSetup.discussionTimerEnabled,
            discussionSeconds: imposterSetup.discussionSeconds,
            votingEnabled: imposterSetup.votingEnabled,
            hiddenVoter: imposterSetup.hiddenVoter,
            randomInteger: secureRandomInteger,
          })
        } catch (error) {
          setToast(error instanceof Error ? error.message : 'The Mystery Who round configuration is invalid.')
          return
        }
        data = { ...round, wordId: word.id, packIds: config.packIds, setupSnapshot: config, playerRoster: save.players }
        recent['imposter:all'] = [...usedWords, word.id].slice(-10)
        recent['imposter:words'] = [...usedWordTexts, normalizeImposterWord(word.text)].slice(-10)
        const wordQueueKey = contentQueueKey(word)
        recent[wordQueueKey] = [...(recent[wordQueueKey] ?? []), word.id].filter((id, index, list) => list.indexOf(id) === index).slice(-10)
        const relevantCategoryHistory = recentCategoryIds.filter(id => selectedCategoryIds.includes(id) && id !== selectedCategoryId)
        recent['category:imposter'] = categoryWindow > 0
          ? [...relevantCategoryHistory, selectedCategoryId].slice(-categoryWindow)
          : []
        phase = 'reveal'
        if (!round.votingEnabled) data = { ...data, autoResolveAfterDiscussion: true }
      } else if (game === 'guessup') {
        const { createGuessUpRound } = await loadGuessUpRules()
        let selectedDeck = drawGuessUpDeck(config.packIds)
        let selectedDeckB = drawGuessUpDeck(config.packIds, new Set(selectedDeck.map(item => item.id)))
        if (selectedDeck.length === 0) {
          const sourcePack = gameContentPacks.find(pack => config.packIds.includes(pack.id))
          if (sourcePack) {
            try {
              const generated = await generateAiContent({
                game: 'guessup', itemKind: 'charade', categoryId: String(sourcePack.id),
                categoryName: sourcePack.name, categoryDescription: sourcePack.description, count: 12,
                suitability: save.adultMode ? 'adult' : 'general', adultMode: save.adultMode,
                playerCount: save.players.length, playerNames: save.players.map(player => player.name), recentItems: [],
              })
              setToast(`Generated a fresh GuessUp deck with ${generated.provider === 'cloudflare-workers-ai' ? 'Cloudflare Workers AI' : generated.provider}.`)
              selectedDeck = generated.items.map(item => ({
                id: asContentId(`ai:${item.id}`), gameId: 'guessup' as const, kind: 'phrase' as const, text: item.text,
                locale: 'en' as const, packId: sourcePack.id, categoryId: String(sourcePack.id),
                suitability: save.adultMode ? 'adult' as const : 'general' as const, tags: ['guessup', 'ai'],
                provenance: { source: 'ai-assisted:gateway' as const, license: 'UserCreated' as const, creator: 'ai' as const, createdAt: Date.now(), reviewedAt: null },
              }))
            } catch (error) {
              setToast(`GuessUp generation failed: ${error instanceof Error ? error.message : 'Try again shortly.'}`)
            }
          }
        }
        if (selectedDeckB.length === 0 && selectedDeck.length > 0) {
          selectedDeckB = drawGuessUpDeck(config.packIds, new Set(selectedDeck.map(item => item.id)))
          if (selectedDeckB.length === 0) {
            const sourcePack = gameContentPacks.find(pack => config.packIds.includes(pack.id))
            if (sourcePack) {
              try {
                const generated = await generateAiContent({
                  game: 'guessup', itemKind: 'charade', categoryId: String(sourcePack.id),
                  categoryName: sourcePack.name, categoryDescription: sourcePack.description, count: 12,
                  suitability: save.adultMode ? 'adult' : 'general', adultMode: save.adultMode,
                  playerCount: save.players.length, playerNames: save.players.map(player => player.name), recentItems: selectedDeck.map(item => item.text),
                })
                selectedDeckB = generated.items.map(item => ({
                  id: asContentId(`ai:${item.id}`), gameId: 'guessup' as const, kind: 'phrase' as const, text: item.text,
                  locale: 'en' as const, packId: sourcePack.id, categoryId: String(sourcePack.id),
                  suitability: save.adultMode ? 'adult' as const : 'general' as const, tags: ['guessup', 'ai'],
                  provenance: { source: 'ai-assisted:gateway' as const, license: 'UserCreated' as const, creator: 'ai' as const, createdAt: Date.now(), reviewedAt: null },
                }))
              } catch (error) {
                setToast(`GuessUp Team B generation failed: ${error instanceof Error ? error.message : 'Try again shortly.'}`)
              }
            }
          }
          if (selectedDeckB.length === 0) selectedDeckB = secureShuffle(selectedDeck)
        }
        if (selectedDeck.length === 0 || selectedDeckB.length === 0) { setToast('Every selected GuessUp deck is exhausted under its recent-content window. Select another deck or reset recent history.'); return }
        const teamAPlayerIds = save.players.filter(player => config.teamAssignments[player.id] === 'A').map(player => player.id)
        const teamBPlayerIds = save.players.filter(player => config.teamAssignments[player.id] === 'B').map(player => player.id)
        try {
          const round = createGuessUpRound(save.players, selectedDeck.map(item => item.text), {
            durationSeconds: config.durationSeconds,
            teamAName: config.teamAName,
            teamBName: config.teamBName,
            teamAPlayerIds,
            teamBPlayerIds,
            deckB: selectedDeckB.map(item => item.text),
          })
          data = {
            ...round,
            roundId: uid(),
            running: false,
            endsAt: null,
            seconds: config.durationSeconds,
            countdown: 3,
            deckIds: selectedDeck.map(item => item.id),
            deckBIds: selectedDeckB.map(item => item.id),
            deckItemIds: selectedDeck.map(item => item.id),
            deckBItemIds: selectedDeckB.map(item => item.id),
            packIds: config.packIds,
            playerRoster: save.players,
            reports: [],
            soundEnabled: config.soundEnabled,
            musicEnabled: config.musicEnabled,
            vibrationEnabled: config.vibrationEnabled,
            inputMode: config.inputMode,
          }
          for (const item of [...selectedDeck, ...selectedDeckB]) {
            if (!item.id.startsWith('ai:')) {
              const key = contentQueueKey(item)
              recent[key] = appendRecentContent(recent[key] ?? [], item.id, 20)
            }
          }
        } catch (error) { setToast(error instanceof Error ? error.message : 'GuessUp could not be started.'); return }
        phase = 'ready'
      } else if (game === 'truth-or-dare') {
        const selectedNames = gameContentPacks.filter(pack => config.packIds.includes(pack.id)).map(pack => pack.name)
        const firstPlayer = config.mode === 'one-at-a-time' ? save.players[0] : null
        data = {
          mode: config.mode,
          packIds: config.packIds,
          packNames: selectedNames,
          playerRoster: save.players,
          chosen: firstPlayer?.name ?? null,
          chosenId: firstPlayer?.id ?? null,
          oneAtATimeIndex: 0,
          kind: null,
          prompt: null,
          promptId: null,
          wheelAngle: 0,
          wheelAfterPhase: 'choice',
          seenContentIds: [],
          turn: 0,
          skipped: 0,
          optOuts: 0,
          reports: [],
          reaction: null,
        }
        phase = config.mode === 'spin-wheel' ? 'spin' : 'choice'
      } else if (game === 'never-have-i-ever') {
        const selectedNames = gameContentPacks.filter(pack => config.packIds.includes(pack.id)).map(pack => pack.name)
        const firstPlayer = config.mode === 'one-at-a-time' ? save.players[0] : null
        data = {
          mode: config.mode,
          packIds: config.packIds,
          packNames: selectedNames,
          playerRoster: save.players,
          chosen: firstPlayer?.name ?? null,
          chosenId: firstPlayer?.id ?? null,
          oneAtATimeIndex: 0,
          prompt: null,
          promptId: null,
          seenContentIds: [],
          index: 0,
          responses: 0,
          yesResponses: 0,
          noResponses: 0,
          skipped: 0,
          responseMethod: config.responseMethod,
          responseByPlayer: {},
          playerPoints: {},
          reports: [],
          reaction: null,
        }
        if (config.mode === 'spin-wheel') {
          phase = 'spin'
        } else {
          data = { ...data, prompt: null, promptId: null, seenContentIds: [] }
          phase = 'prompt'
          queueMicrotask(() => {
            void draw('never-have-i-ever', 'never-have-i-ever', config.packIds, [], typeof firstPlayer?.name === 'string' ? firstPlayer.name : undefined).then(item => {
              if (!item) return
              setSave(current => current.active?.game === 'never-have-i-ever' && current.active.phase === 'prompt' && !current.active.data.prompt
                ? patchActiveSave(current, 'prompt', { ...current.active.data, prompt: item.text, promptId: item.id, seenContentIds: [item.id] })
                : current)
            })
          })
        }
      } else {
        const { createPartyArcadeSession } = await import('./domain/games/party-arcade.ts')
        const arcadePool = uniqueContentItems(gameContentItems.filter(item =>
          item.gameId === game && item.kind === 'party-prompt' && config.packIds.includes(item.packId),
        ))
        const recentIds = arcadePool.flatMap(item => recent[contentQueueKey(item)] ?? [])
        const eligible = eligibleContentItems(arcadePool, recentIds)
        // These games are rule-driven: their roles and rounds are generated by
        // the domain, so their one-card guide pack must not exhaust after play.
        let playableItems = eligible
        if (playableItems.length === 0 && !ruleOnlyGame) {
          const sourcePack = gameContentPacks.find(pack => config.packIds.includes(pack.id))
          if (sourcePack) {
            try {
              const generated = await generateAiContent({
                game: game as AiGame, itemKind: 'party-prompt', categoryId: String(sourcePack.id),
                categoryName: sourcePack.name, categoryDescription: sourcePack.description, count: 5,
                suitability: save.adultMode ? 'adult' : 'general', adultMode: save.adultMode,
                playerCount: save.players.length, playerNames: save.players.map(player => player.name),
                recentItems: recentIds.map(id => contentItems.find(item => item.id === id)?.text ?? aiGeneratedTextRef.current.get(id)).filter((text): text is string => Boolean(text)).slice(-30),
              })
              setToast(generated.provider === 'content-vault'
                ? 'Loaded fresh content from the content vault.'
                : generated.provider === 'local-curated'
                  ? ('fallbackReason' in generated ? generated.fallbackReason : 'Remote generation failed; using local content.')
                  : `Generated fresh content with ${generated.provider === 'cloudflare-workers-ai' ? 'Cloudflare Workers AI' : generated.provider}.`)
              playableItems = generated.items.map(item => {
                const mapped = { id: asContentId(`ai:${item.id}`), gameId: game, kind: 'party-prompt' as const, text: item.text, ...(item.hints?.length ? { hints: item.hints } : {}), locale: 'en' as const, packId: sourcePack.id, categoryId: String(sourcePack.id), suitability: save.adultMode ? 'adult' as const : 'general' as const, tags: [game, 'ai'], provenance: { source: 'ai-assisted:gateway' as const, license: 'UserCreated' as const, creator: 'ai' as const, createdAt: Date.now(), reviewedAt: null } }
                aiGeneratedTextRef.current.set(mapped.id, mapped.text)
                return mapped
              })
            } catch (error) {
              setToast(`Content generation failed: ${error instanceof Error ? error.message : 'Try again shortly.'}`)
              return
            }
          }
        }
        if (playableItems.length === 0 && !ruleOnlyGame) {
          setToast('Content generation is unavailable. Reconnect and retry to load prompts for this game.')
          return
        }
        try {
          const arcadeSession = createPartyArcadeSession(
            game,
            save.players,
            playableItems.map(item => ({ id: item.id, text: item.text, ...(item.hints ? { hints: item.hints } : {}) })),
            config.arcade,
          )
          phase = arcadeSession.phase
          data = { ...arcadeSession.data, packIds: config.packIds, reports: [] }
          for (const item of playableItems.slice(0, 30)) {
            const key = contentQueueKey(item)
            recent[key] = appendRecentContent(recent[key] ?? [], item.id, 20)
          }
        } catch (error) {
          setToast(error instanceof Error ? error.message : 'This party game could not be started.')
          return
        }
      }

      data = { ...data, adultMode: save.adultMode }
      const nextSave: Save = {
        ...save,
        recent,
        ...(game === 'imposter' && config.imposter ? { imposterPreferences: config.imposter } : {}),
        active: { game, phase, data },
      }
      if (persistenceAvailable) {
        try {
          // Commit the role assignment, selected word, roster, and recent queues
          // before changing screens. A failed write must never expose a reveal.
          await writeQueueRef.current
          const revision = await commitPortalSnapshot(nextSave, revisionRef.current)
          revisionRef.current = revision
          announceRevision(revision)
          publishStorageStatus({ kind: 'ready', message: 'New game snapshot saved before gameplay began.' })
        } catch (error) {
          if (error instanceof StorageConflictError) {
            publishStorageStatus({ kind: 'conflict', message: 'Another tab has saved a newer version. Reload the latest save before starting a new game.', remoteRevision: error.remoteRevision })
            setToast('A newer save exists in another tab. Reload before starting so a role or outcome is not lost.')
          } else {
            publishStorageStatus({ kind: 'warning', message: `New game could not be committed: ${error instanceof Error ? error.message : 'local storage error'}` })
            setToast('Could not save the new round. It was not started; retry local storage and try again.')
          }
          return
        }
      } else {
        setToast('Local storage is unavailable. This game is running in memory only and may not survive a reload.')
      }
      lastSetupRef.current = config
      setSave(nextSave)
      setScreen('play')
    } finally {
      startPendingRef.current = false
    }
  }

  const restartGame = (setup?: GameSetup) => startGame(setup ?? lastSetupRef.current ?? undefined)
  const finish = (title: string, detail: string) => {
    setSave(current => {
      if (!current.active) return current
      const now = Date.now()
      const cutoff = now - 30 * 24 * 60 * 60 * 1000
      const reports = normalizePromptReports(current.active.data.reports)
      return {
        ...current,
        active: null,
        history: [{ id: uid(), game: current.active.game, title, detail, at: now, ...(reports.length ? { reports } : {}) }, ...current.history.filter(item => item.at >= cutoff)].slice(0, 100),
      }
    })
    setScreen('home')
  }

  const spinPendingRef = useRef(false)
  const spin = () => {
    const current = save.active
    if (spinPendingRef.current || !current || (current.game !== 'truth-or-dare' && current.game !== 'never-have-i-ever') || current.phase !== 'spin') return
    // A round owns an immutable player-roster snapshot. Never spin against a
    // later-edited global roster while the visible wheel renders the saved one.
    const roster = resolveGameRoster(current.data.playerRoster, save.players)
    if (roster.length === 0) { setToast('This saved game has no valid players. Return to setup and start a new session.'); return }
    spinPendingRef.current = true
    setSpinPending(true)
    const recentKey = `players:${current.game}`
    const recent = (save.recent[recentKey] || []).map(asPlayerId)
    const result = selectPlayerNoRepeat(roster.map(player => asPlayerId(player.id)), recent)
    const player = roster.find(candidate => candidate.id === result.playerId)
    if (!player) { spinPendingRef.current = false; setSpinPending(false); setToast('The selected player is no longer in the saved roster.'); return }
    const now = Date.now()
    setWheelDurationMs(3600)
    const fromAngle = Number(current.data.wheelAngle) || 0
    const angle = wheelAngleForPlayer(roster, player.id, fromAngle, 5)
    const nextSave: Save = {
      ...save,
      recent: { ...save.recent, [recentKey]: [...result.recentPlayerIds] },
      active: {
        ...current,
        phase: 'spinning',
        data: {
          ...current.data,
          chosen: player.name,
          chosenId: player.id,
          wheelFromAngle: fromAngle,
          wheelAngle: angle,
          wheelStartedAt: now,
          wheelEndsAt: now + 3600,
          wheelType: 'player',
          wheelAfterPhase: current.game === 'truth-or-dare' ? 'choice' : 'prompt',
        },
      },
    }
    void (async () => {
      let committed = false
      try {
        // Serialize behind earlier saves, then durably commit the selected outcome
        // before the UI enters the animated state.
        if (persistenceAvailable) {
          await writeQueueRef.current
          const revision = await commitPortalSnapshot(nextSave, revisionRef.current)
          revisionRef.current = revision
          announceRevision(revision)
          committed = true
          publishStorageStatus({ kind: 'ready', message: 'Player selection saved before the wheel animation.' })
        }
      } catch (error) {
        if (error instanceof StorageConflictError) {
          publishStorageStatus({ kind: 'conflict', message: 'Another tab changed this game. The selected player remains fixed for this turn; reload before continuing.', remoteRevision: error.remoteRevision })
        } else {
          publishStorageStatus({ kind: 'warning', message: `The selected player could not be saved before animation: ${error instanceof Error ? error.message : 'local storage error'}` })
        }
      } finally {
        // If the choice could not be made durable, land immediately rather than
        // showing an animation that implies a persisted selection.
        const visibleSave = committed ? nextSave : {
          ...nextSave,
          active: nextSave.active ? { ...nextSave.active, data: { ...nextSave.active.data, wheelEndsAt: now } } : null,
        }
        setSave(visibleSave)
        spinPendingRef.current = false
        setSpinPending(false)
      }
    })()
  }


  const spinKind = () => {
    const current = save.active
    if (spinPendingRef.current || !current || current.game !== 'truth-or-dare' || current.phase !== 'choice') return
    spinPendingRef.current = true
    setSpinPending(true)
    const selectedIndex = secureRandomInteger(TRUTH_DARE_WHEEL_OPTIONS.length)
    const kind = truthDareKindForIndex(selectedIndex)
    const now = Date.now()
    setWheelDurationMs(3600)
    const fromAngle = Number(current.data.choiceWheelAngle) || 0
    const angle = wheelAngleForSegment(TRUTH_DARE_WHEEL_OPTIONS.length, selectedIndex, fromAngle, 5)
    const nextSave: Save = {
      ...save,
      active: {
        ...current,
        phase: 'choice-spinning',
        data: {
          ...current.data,
          kind,
          choiceWheelFromAngle: fromAngle,
          choiceWheelAngle: angle,
          wheelStartedAt: now,
          wheelEndsAt: now + 3600,
          wheelType: 'kind',
          wheelAfterPhase: 'prompt',
        },
      },
    }
    void (async () => {
      let committed = false
      try {
        if (persistenceAvailable) {
          await writeQueueRef.current
          const revision = await commitPortalSnapshot(nextSave, revisionRef.current)
          revisionRef.current = revision
          announceRevision(revision)
          committed = true
          publishStorageStatus({ kind: 'ready', message: 'Truth or Dare choice saved before the wheel animation.' })
        }
      } catch (error) {
        if (error instanceof StorageConflictError) {
          publishStorageStatus({ kind: 'conflict', message: 'Another tab changed this game. The challenge choice remains fixed for this turn; reload before continuing.', remoteRevision: error.remoteRevision })
        } else {
          publishStorageStatus({ kind: 'warning', message: `The challenge choice could not be saved before animation: ${error instanceof Error ? error.message : 'local storage error'}` })
        }
      } finally {
        const visibleSave = committed ? nextSave : {
          ...nextSave,
          active: nextSave.active ? { ...nextSave.active, data: { ...nextSave.active.data, wheelEndsAt: now } } : null,
        }
        setSave(visibleSave)
        spinPendingRef.current = false
        setSpinPending(false)
      }
    })()
  }

  const customPackBackupRecords = () => customPacks.map(pack => ({
    id: pack.id,
    schemaVersion: 2,
    revision: Math.max(1, pack.version),
    pack,
    items: customItems.filter(item => item.packId === pack.id),
    updatedAt: Date.now(),
  }))

  const exportBackup = async () => {
    try {
      await writeQueueRef.current
      const backup = await exportPortalBackup(save, revisionRef.current, customPackBackupRecords(), undefined, !persistenceAvailable)
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `king-fun-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
      setToast('Backup exported. Keep the file somewhere safe; it contains your local game data.')
    } catch (error) {
      publishStorageStatus({ kind: 'warning', message: error instanceof Error ? error.message : 'Backup export failed.' })
    }
  }

  const applyBackup = async (input: unknown) => {
    const parsed = parsePortalBackup(input, INITIAL_SAVE, normalizeImportedSave)
    try {
      await writeQueueRef.current
      if (persistenceAvailable) {
        const restored = await restorePortalBackup(input, revisionRef.current, INITIAL_SAVE, normalizeImportedSave)
        revisionRef.current = restored.revision
        setSave(restored.value)
        setCustomPacks(restored.customPacks.map(row => row.pack))
        setCustomItems(restored.customPacks.flatMap(row => [...row.items]))
        announceRevision(restored.revision)
        setScreen('home')
        publishStorageStatus({ kind: 'ready', message: 'Backup restored and saved on this device.' })
        setToast('Backup restored.')
      } else {
        setSave(parsed.value)
        setCustomPacks(parsed.customPacks.map(row => row.pack))
        setCustomItems(parsed.customPacks.flatMap(row => [...row.items]))
        setScreen('home')
        publishStorageStatus({ kind: 'warning', message: 'Backup loaded into this tab only. Retry local storage to make it durable across reloads.' })
        setToast('Backup loaded in memory. It is not yet saved to this device.')
      }
    } catch (error) {
      if (error instanceof StorageConflictError) {
        publishStorageStatus({ kind: 'conflict', message: 'A newer local save exists. Reload it before restoring this backup.', remoteRevision: error.remoteRevision })
      } else {
        publishStorageStatus({ kind: 'warning', message: `Backup restore failed: ${error instanceof Error ? error.message : 'invalid backup'}` })
      }
    }
  }

  const importBackupFile = (file: File) => {
    void (async () => {
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error('Backup files must be 20 MB or smaller.')
        const raw: unknown = JSON.parse(await file.text())
        parsePortalBackup(raw, INITIAL_SAVE, normalizeImportedSave)
        askConfirmation({
          title: 'Restore this backup?',
          description: 'This replaces the current players, preferences, active session, history, recent-content queues, and custom packs on this device. Export the current data first if you may need it.',
          confirmLabel: 'Restore backup',
          destructive: true,
          onConfirm: () => { void applyBackup(raw) },
        })
      } catch (error) {
        publishStorageStatus({ kind: 'warning', message: `Backup could not be read: ${error instanceof Error ? error.message : 'invalid JSON file'}` })
      }
    })()
  }

  const retryPersistence = async () => {
    try {
      const latest = await readPortalSnapshot<Save>(INITIAL_SAVE)
      if (latest.value && latest.revision !== revisionRef.current) {
        publishStorageStatus({ kind: 'conflict', message: 'A stored save already exists at a different revision. Reload it before retrying to avoid overwriting newer data.', remoteRevision: latest.revision })
        return
      }
      // Reconcile the entire custom-pack store atomically, not just upsert
      // current packs. This also preserves deletions made during memory-only mode.
      await replaceCustomPacks(customPackBackupRecords())
      const revision = await commitPortalSnapshot(save, latest.revision)
      revisionRef.current = revision
      setPersistenceAvailable(true)
      announceRevision(revision)
      const durable = await getPersistentStorageState()
      setStoragePersisted(durable)
      publishStorageStatus({ kind: 'ready', message: 'Local database is available again. Your current state is saved.' })
      setToast('Local saving restored.')
    } catch (error) {
      if (error instanceof StorageConflictError) publishStorageStatus({ kind: 'conflict', message: 'Another tab has saved a newer version. Reload it before continuing.', remoteRevision: error.remoteRevision })
      else publishStorageStatus({ kind: 'warning', message: `Local storage is still unavailable: ${error instanceof Error ? error.message : 'unknown storage error'}` })
    }
  }

  const requestDurableStorage = async () => {
    const result = await requestPersistentStorage()
    setStoragePersisted(result === 'granted' ? true : result === 'denied' ? false : null)
    setToast(result === 'granted'
      ? 'Your browser granted persistent storage.'
      : result === 'denied'
        ? 'Persistent storage was not granted. The app still saves locally; export backups regularly.'
        : 'Persistent storage cannot be requested in this browser. The app still saves locally; export backups regularly.')
  }

  const reloadLatestSave = async () => {
    try {
      const latest = await readPortalSnapshot<Save>(initialState)
      if (latest.value) {
        revisionRef.current = latest.revision
        setSave(normalizeSave(latest.value))
        const storedPacks = await listCustomPacks()
        setCustomPacks(storedPacks.map(row => row.pack))
        setCustomItems(storedPacks.flatMap(row => [...row.items]))
        publishStorageStatus({ kind: 'ready', message: 'Latest save loaded.' })
        setScreen('home')
      }
    } catch (error) {
      publishStorageStatus({ kind: 'warning', message: error instanceof Error ? error.message : 'Unable to reload the latest save.' })
    }
  }

  const eraseLocalData = async () => {
    const clearInMemory = () => {
      setSave(INITIAL_SAVE)
      setCustomPacks([])
      setCustomItems([])
      lastSetupRef.current = null
      setScreen('home')
    }
    if (!persistenceAvailable) {
      try {
        const revision = await forceResetPortalDatabase(INITIAL_SAVE)
        revisionRef.current = revision
        announceRevision(revision)
        setPersistenceAvailable(true)
        publishStorageStatus({ kind: 'ready', message: 'Corrupt or unavailable local data was reset after your confirmation.' })
        setToast('Local data erased and storage recovered.')
      } catch (error) {
        publishStorageStatus({ kind: 'warning', message: `Current tab data was cleared, but persistent storage could not be reset: ${error instanceof Error ? error.message : 'storage unavailable'}` })
        setToast('Current tab data cleared. Persistent data may remain until storage is available.')
      }
      clearInMemory()
      return
    }
    try {
      await writeQueueRef.current
      const revision = await resetPortalDatabase(INITIAL_SAVE, revisionRef.current)
      revisionRef.current = revision
      announceRevision(revision)
      clearInMemory()
      publishStorageStatus({ kind: 'ready', message: 'Local data erased.' })
    } catch (error) {
      if (error instanceof StorageConflictError) {
        publishStorageStatus({ kind: 'conflict', message: 'Another tab changed the save before it could be erased. Reload the latest save and try again.', remoteRevision: error.remoteRevision })
        return
      }
      setPersistenceAvailable(false)
      try {
        // The user has explicitly confirmed erasure. Try the recovery reset once
        // the normal compare-and-swap path has failed for a storage reason.
        const revision = await forceResetPortalDatabase(INITIAL_SAVE)
        revisionRef.current = revision
        announceRevision(revision)
        setPersistenceAvailable(true)
        publishStorageStatus({ kind: 'ready', message: 'Local data erased and storage recovered.' })
        setToast('Local data erased and storage recovered.')
      } catch (recoveryError) {
        publishStorageStatus({ kind: 'warning', message: `The current tab was reset, but persistent data could not be erased: ${recoveryError instanceof Error ? recoveryError.message : 'storage unavailable'}` })
        setToast('Current tab data cleared. Persistent data may remain until storage is available.')
      }
      clearInMemory()
    }
  }

  const active = save.active
  const selectedDefinition = GAMES.find(item => item.id === (active?.game || selected)) ?? GAMES[0]!
  useEffect(() => {
    const title = screen === 'home' ? 'Home' : screen === 'play' ? selectedDefinition.name : screen === 'setup' ? `${selectedDefinition.name} setup` : screen === 'history' ? 'History' : 'Settings'
    document.title = `${title} — KING-FUN`
  }, [screen, selectedDefinition.name])
  const homeLaunch = launch?.game ?? null
  const systemMotionReduced = save.motionPreference === 'reduce' || (save.motionPreference === 'system' && systemReducedMotion)
  const ambientPaused = !ambientMotionEnabled || systemMotionReduced
  const isSpinning = Boolean(active && ((active.game === 'truth-or-dare' && (active.phase === 'spinning' || active.phase === 'choice-spinning')) || (active.game === 'never-have-i-ever' && active.phase === 'spinning')))
  const readyCountdown = active?.game === 'guessup' && active.phase === 'ready' ? Number(active.data.countdown) : null
  const guessDeadline = active?.game === 'guessup' && active.phase === 'playing' && active.data.running ? Number(active.data.endsAt) : null

  useEffect(() => {
    if (!isSpinning || !active) return
    const reducedMotion = save.motionPreference === 'reduce' || (save.motionPreference === 'system' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false))
    const storedEnd = Number(active.data.wheelEndsAt)
    const remainingMs = reducedMotion ? 40 : Number.isFinite(storedEnd) ? Math.max(0, storedEnd - Date.now()) : 3600
    const durationUpdate = window.setTimeout(() => setWheelDurationMs(Math.max(1, remainingMs)), 0)
    const cancelled = { current: false }
    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled.current) return
        if (active.game === 'truth-or-dare' && active.data.wheelType === 'kind') {
          const kind = active.data.kind === 'dare' ? 'dare' : 'truth'
          const seen = Array.isArray(active.data.seenContentIds) ? active.data.seenContentIds as string[] : []
          const item = await draw('truth-or-dare', kind, active.data.packIds ?? [], seen, typeof active.data.chosen === 'string' ? active.data.chosen : undefined)
          if (cancelled.current) return
          setSave(current => current.active === active ? patchActiveSave(current, item ? 'prompt' : 'exhausted', {
            ...active.data,
            prompt: item?.text ?? null,
            promptId: item?.id ?? null,
            seenContentIds: item ? [...seen, item.id] : seen,
            reaction: null,
          }) : current)
        } else if (active.game === 'never-have-i-ever' && !active.data.prompt) {
          const seen = Array.isArray(active.data.seenContentIds) ? active.data.seenContentIds as string[] : []
          const item = await draw('never-have-i-ever', 'never-have-i-ever', active.data.packIds ?? [], seen, typeof active.data.chosen === 'string' ? active.data.chosen : undefined)
          if (cancelled.current) return
          setSave(current => current.active === active ? patchActiveSave(current, item ? 'prompt' : 'exhausted', {
            ...active.data,
            prompt: item?.text ?? null,
            promptId: item?.id ?? null,
            seenContentIds: item ? [...seen, item.id] : seen,
            reaction: null,
          }) : current)
        } else {
          setSave(current => current.active === active ? patchActiveSave(current, String(active.data.wheelAfterPhase || 'choice'), active.data) : current)
        }
      })()
    }, remainingMs)
    return () => {
      cancelled.current = true
      window.clearTimeout(durationUpdate)
      window.clearTimeout(timer)
    }
  }, [active, isSpinning, draw, save.motionPreference])

  useEffect(() => {
    if (readyCountdown === null || !active || active.game !== 'guessup') return
    const snapshot = active
    const timer = window.setTimeout(() => {
      if (readyCountdown > 1) {
        setSave(current => current.active === snapshot ? patchActiveSave(current, 'ready', { ...snapshot.data, countdown: readyCountdown - 1 }) : current)
      } else {
        void loadGuessUpRules().then(({ beginGuessUpTurn }) => {
          const round = beginGuessUpTurn(snapshot.data as unknown as GuessUpRoundState)
          setSave(current => current.active === snapshot ? patchActiveSave(current, 'playing', { ...round, countdown: 0 }) : current)
        })
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [readyCountdown, active])

  useEffect(() => {
    if (guessDeadline === null || !Number.isFinite(guessDeadline)) return
    const timer = window.setInterval(() => {
      void loadGuessUpRules().then(({ reconcileGuessUpTimer }) => setSave(current => {
        if (!current.active || current.active.game !== 'guessup' || current.active.phase !== 'playing') return current
        const round = current.active.data as unknown as GuessUpRoundState
        const transition = reconcileGuessUpTimer(round, Date.now())
        if (transition.state === round) return current
        return { ...current, active: { ...current.active, data: transition.state as unknown as Record<string, any>, phase: transition.phase } }
      }))
    }, 200)
    return () => clearInterval(timer)
  }, [guessDeadline])

  const handleBrandPress = () => {
    setScreen('home')
    const now = Date.now()
    const taps = creatorTapRef.current
    if (now - taps.startedAt > 2500) { taps.count = 0; taps.startedAt = now }
    taps.count += 1
    if (taps.count >= 9) { taps.count = 0; taps.startedAt = 0; setCreatorModalOpen(true) }
  }

  const submitCreatorUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (creatorUnlocking || !creatorSecret.trim()) return
    setCreatorUnlocking(true)
    try {
      const token = await unlockCreator(creatorSecret)
      const valid = await verifyCreator(token)
      setCreatorEnabled(valid)
      setCreatorSecret('')
      setCreatorModalOpen(false)
      setToast(valid ? 'Creator profile unlocked on this device.' : 'Creator access could not be verified.')
    } catch (error) { setToast(error instanceof Error ? error.message : 'Creator unlock failed.') }
    finally { setCreatorUnlocking(false) }
  }

  const revokeCreatorAccess = () => { clearCreatorToken(); setCreatorEnabled(false); setModerationQueue([]); setCreatorSecret(''); setCreatorModalOpen(false); setToast('Creator profile locked on this device.') }

  const moderateQueueItem = async (contentId: string, status: 'approved' | 'rejected' | 'retired') => {
    if (moderationBusyId) return
    setModerationBusyId(contentId)
    const saved = await moderateCommunityContent(contentId, status)
    if (saved) { setModerationQueue(current => current.filter(item => item.contentId !== contentId)); const next = new Set(blockedContentIdsRef.current); if (status === 'approved') next.delete(contentId); else next.add(contentId); blockedContentIdsRef.current = next; setBlockedContentIds(next) }
    else setToast('The moderation update could not be saved.')
    setModerationBusyId(null)
  }

  const openSettings = () => {
    void ensureSeedContent().then(() => setScreen('settings')).catch(() => setToast('The content catalogue could not be loaded. Reload and try again.'))
  }

  const navigateFromPalette = (target: 'home' | 'history' | 'settings') => {
    if (target === 'settings') openSettings()
    else setScreen(target)
  }

  const reportPrompt = (game: string, reason: PromptReportReason, note: string, contentId: string | null) => {
    if (!active || active.game !== game) return
    const reports = normalizePromptReports([
      ...(Array.isArray(active.data.reports) ? active.data.reports : []),
      { contentId, reason, note, at: Date.now() },
    ])
    patchActive(active.phase, { ...active.data, reports, reaction: active.data.reaction ?? null })
    setToast('Report saved in this device’s local game history. It was not uploaded.')
  }

  return <div className={`app ${save.theme}`} tabIndex={-1}>
    <AmbientBackground paused={ambientPaused} />
    <a className="skip-link" href="#main-content">Skip to content</a>
    {storageStatus.kind !== 'ready' && <StatusPanel tone={storageStatus.kind === 'conflict' ? 'warning' : 'error'} message={storageStatus.message} actionLabel={storageStatus.kind === 'conflict' ? 'Reload latest save' : 'Retry local storage'} onAction={storageStatus.kind === 'conflict' ? reloadLatestSave : retryPersistence} />}
    <header className="topbar">
      <div className="topbar-inner">
        <button type="button" className="brand" aria-labelledby="king-fun-brand-name" onClick={handleBrandPress}>
          <span className="brand-logo-wrap"><img className="brand-logo" src="/king-fun-logo.svg" width="34" height="34" alt="" aria-hidden="true" decoding="async" /></span>
          <span className="brand-name" id="king-fun-brand-name">KING-FUN</span>
        </button>
        <nav className="primary-nav" aria-label="Main navigation">
          <button type="button" className={`primary-nav-link ${screen === 'home' || screen === 'setup' || screen === 'play' ? 'is-active' : ''}`} aria-current={screen === 'home' || screen === 'setup' || screen === 'play' ? 'page' : undefined} onClick={() => setScreen('home')}><Icon name="gamepad" size={17} /><span>Play</span></button>
          <button type="button" className={`primary-nav-link ${screen === 'history' ? 'is-active' : ''}`} aria-current={screen === 'history' ? 'page' : undefined} onClick={() => setScreen('history')}><Icon name="history" size={17} /><span>History</span>{save.history.length > 0 && <span className="nav-count" aria-label={`${save.history.length} entries`}>{save.history.length > 99 ? '99+' : save.history.length}</span>}</button>
          <button type="button" className={`primary-nav-link ${screen === 'settings' ? 'is-active' : ''}`} aria-current={screen === 'settings' ? 'page' : undefined} onClick={openSettings}><Icon name="settings" size={17} /><span>Settings</span></button>
        </nav>
        <div className="topbar-actions">
          <button type="button" className="command-trigger" title="Quick actions · Ctrl K" onClick={() => setCommandOpen(true)}><Icon name="search" size={17} /><kbd>CTRL K</kbd><span className="visually-hidden"> Open quick actions</span></button>
          <button
            type="button"
            className="ambient-toggle"
            aria-label={systemMotionReduced ? 'Ambient graphics disabled by motion preference' : ambientPaused ? 'Play ambient graphics' : 'Pause ambient graphics'}
            aria-pressed={!ambientPaused}
            title={systemMotionReduced ? 'Ambient graphics follow your reduced-motion preference' : ambientPaused ? 'Play ambient graphics' : 'Pause ambient graphics'}
            disabled={systemMotionReduced}
            onClick={() => setAmbientMotionEnabled(enabled => !enabled)}
          ><Icon name={ambientPaused ? 'orbit' : 'pause'} size={16} /></button>
          <button className="theme-toggle" type="button" role="switch" aria-checked={save.theme === 'light'} aria-label="Toggle light/dark appearance" title={`Switch to ${save.theme === 'dark' ? 'light' : 'dark'} appearance`} onClick={() => update({ theme: save.theme === 'dark' ? 'light' : 'dark' })}>
            <span className="theme-toggle-track"><Icon className="theme-icon" name={save.theme === 'dark' ? 'moon' : 'sun'} size={16} /></span>
          </button>
        </div>
      </div>
    </header>

    <main id="main-content" ref={mainContentRef} tabIndex={-1} aria-label="KING-FUN main content" className="main-shell">
      <div key={screen} className={`screen-transition${save.motionPreference === 'reduce' ? ' motion-reduced' : ''}`}>
      {screen === 'home' && <HomePage save={save} games={GAMES} launchGame={homeLaunch} onResume={() => { if (save.active) { void ensureSeedContent().then(() => { setSelected(save.active!.game); setScreen('play') }).catch(() => setToast('Saved game content could not be loaded. Reload and try again.')) } }} onLaunch={launchGame} />}
      {(screen === 'setup' || screen === 'history' || screen === 'settings' || screen === 'play') && <Suspense fallback={<div className="screen-loading" role="status">Loading screen…</div>}>
      {screen === 'setup' && <SetupScreen key={selected} game={GAMES.find(item => item.id === selected) ?? GAMES[0]!} adultMode={save.adultMode} players={save.players} packs={contentPacks} contentItems={contentItems} savedPackIds={save.selectedPackIdsByGame?.[selected] ?? []} imposterPreferences={save.imposterPreferences ?? INITIAL_SAVE.imposterPreferences!} guessUpPreferences={save.guessUpPreferences ?? INITIAL_SAVE.guessUpPreferences!} updateGuessUpPreferences={updateGuessUpPreferences} addPlayer={(rawName: string) => {
        const name = rawName.trim()
        if (!name) return false
        if (save.players.some(player => normalizePlayerName(player.name) === normalizePlayerName(name))) { setToast('That player is already in the list.'); return false }
        if (save.players.length >= (['imposter', 'werewolf', 'mafia', 'who-am-i'].includes(selected) ? 20 : ['hot-bomb-duel', 'qupid', 'questions-for-love', 'a-or-b'].includes(selected) ? 2 : 32)) { setToast('This game has reached its player limit.'); return false }
        update({ players: [...save.players, { id: uid(), name }] })
        return true
      }} removePlayer={id => update({ players: save.players.filter(player => player.id !== id) })} renamePlayer={(id, name) => {
        const normalized = name.trim()
        if (!normalized || save.players.some(player => player.id !== id && normalizePlayerName(player.name) === normalizePlayerName(normalized))) {
          setToast('Player names must be non-empty and unique.')
          return false
        }
        update({ players: save.players.map(player => player.id === id ? { ...player, name: normalized } : player) })
        return true
      }} startGame={startGame} saveCustomPack={saveCustomPack} deleteCustomPack={deleteCustomPack} resetRecentContent={() => resetRecentContent(selected)} goHome={() => setScreen('home')} />}
      {screen === 'play' && active && <ScreenErrorBoundary title={selectedDefinition.name}>
        <Suspense fallback={<section className={`play-screen ${selectedDefinition.color}`} aria-busy="true"><div className="screen-loading" role="status"><span className="ui-status-spinner" aria-hidden="true" /> Loading {selectedDefinition.name}…</div></section>}>
          <section className={`play-screen ${selectedDefinition.color}`}>
            <div className="play-head"><button type="button" className="back-link" onClick={() => { askConfirmation({ title: 'Leave this game?', description: 'Your progress will be saved on this device so you can resume later.', confirmLabel: 'Leave game', onConfirm: () => setScreen('home') }) }}><Icon name="arrow-left" size={15} /> EXIT GAME</button><span className="eyebrow">{selectedDefinition.name.toUpperCase()} / GAME IN PROGRESS</span><span className="autosave"><Icon name="check-circle" size={13} /> AUTO-SAVED</span></div>
            {active.game === 'imposter' && <ImposterGame key={`${active.game}-${active.phase}-${active.data.reveal}`} active={active} players={save.players} patchActive={patchActive} finish={finish} startGame={restartGame} />}
            {active.game === 'guessup' && <GuessUpGame active={active} players={save.players} patchActive={patchActive} finish={finish} restart={restartGame} reportPrompt={(reason, note, contentId) => reportPrompt('guessup', reason, note, contentId)} />}
            {active.game === 'truth-or-dare' && <TruthOrDareGame active={active} players={save.players} patchActive={patchActive} draw={draw} spin={spin} spinKind={spinKind} angle={Number(active.data.wheelAngle) || 0} choiceAngle={Number(active.data.choiceWheelAngle) || 0} choiceFromAngle={Number(active.data.choiceWheelFromAngle) || 0} busy={active.phase === 'spinning'} choiceBusy={active.phase === 'choice-spinning'} spinPending={spinPending} wheelDurationMs={wheelDurationMs} reportPrompt={(reason, note, contentId) => reportPrompt('truth-or-dare', reason, note, contentId)} finish={finish} />}
            {active.game === 'never-have-i-ever' && <NeverHaveIEverGame active={active} players={save.players} patchActive={patchActive} finish={finish} draw={draw} spin={spin} angle={Number(active.data.wheelAngle) || 0} busy={isSpinning} spinPending={spinPending} wheelDurationMs={wheelDurationMs} reportPrompt={(reason, note, contentId) => reportPrompt('never-have-i-ever', reason, note, contentId)} />}
            {!['imposter', 'guessup', 'truth-or-dare', 'never-have-i-ever'].includes(active.game) && <PartyArcadeGame active={active} players={save.players} patchActive={patchActive} finish={finish} />}
          </section>
        </Suspense>
      </ScreenErrorBoundary>}
      {screen === 'history' && <HistoryScreen history={save.history} games={GAMES} goHome={() => setScreen('home')} clearHistory={() => askConfirmation({ title: 'Clear game history?', description: 'This permanently deletes the saved history from this device.', confirmLabel: 'Clear history', destructive: true, onConfirm: () => update({ history: [] }) })} />}
      {screen === 'settings' && <SettingsScreen
        adultMode={save.adultMode}
        onAdultModeChange={setAdultMode}
        theme={save.theme}
        motionPreference={save.motionPreference ?? 'system'}
        soundEnabled={save.guessUpPreferences?.soundEnabled ?? false}
        vibrationEnabled={save.guessUpPreferences?.vibrationEnabled ?? false}
        toggleTheme={(light: boolean) => update({ theme: light ? 'light' : 'dark' })}
        setMotionPreference={(motionPreference: MotionPreference) => update({ motionPreference })}
        setSoundEnabled={(soundEnabled: boolean) => updateGuessUpPreferences({ soundEnabled })}
        setVibrationEnabled={(vibrationEnabled: boolean) => updateGuessUpPreferences({ vibrationEnabled })}
        exportBackup={exportBackup}
        importBackup={importBackupFile}
        persistenceAvailable={persistenceAvailable}
        storagePersisted={storagePersisted}
        requestPersistentStorage={requestDurableStorage}
        retryPersistence={retryPersistence}
        deleteCustomPacks={() => askConfirmation({ title: 'Delete custom packs?', description: 'All custom content packs stored on this device will be permanently deleted.', confirmLabel: 'Delete packs', destructive: true, onConfirm: () => {
          if (!persistenceAvailable) { setCustomPacks([]); setCustomItems([]); setToast('Custom packs cleared from this tab only; local storage is unavailable.'); return }
          void clearCustomPacks().then(() => { setCustomPacks([]); setCustomItems([]); setToast('Custom packs deleted.') }).catch(error => { setPersistenceAvailable(false); setCustomPacks([]); setCustomItems([]); publishStorageStatus({ kind: 'warning', message: `Custom packs cleared from this tab only; persistent deletion failed: ${error instanceof Error ? error.message : 'storage unavailable'}` }) })
        } })}
        eraseLocalData={() => askConfirmation({ title: 'Erase all local data?', description: 'Your active session, players, history, preferences and custom packs will be reset. This cannot be undone.', confirmLabel: 'Erase data', destructive: true, onConfirm: () => { void eraseLocalData() } })}
        goHome={() => setScreen('home')}
        getRecentAiItems={(game: AiGame, kind: AiItemKind, categoryId: string, suitability: 'general' | 'adult') => {
          if (kind === 'category') return contentPacks.filter(pack => pack.gameId === game && pack.suitability === suitability).map(pack => pack.name)
          const contentGame = game as Game
          const contentKind = kind === 'word' ? 'word' : kind === 'charade' ? 'phrase' : kind === 'truth' ? 'truth' : kind === 'dare' ? 'dare' : 'never-have-i-ever'
          const queueKey = `content:${contentGame}:${categoryId}:${contentKind}:en:${suitability}`
          const ids = save.recent[queueKey] ?? []
          const queuedTexts = ids.map(id => contentItems.find(item => item.id === id && item.suitability === suitability)?.text).filter((value): value is string => Boolean(value))
          const globalImposterTexts = game === 'imposter' && suitability === 'general' ? save.recent['imposter:words'] ?? [] : []
          return [...queuedTexts, ...globalImposterTexts].slice(-30)
        }}
        saveGeneratedPack={async (game: AiGame, kind: AiItemKind, items: readonly AiGeneratedItem[], metadata?: { name: string; description: string; emoji: string; categoryId?: string; suitability?: 'general' | 'adult' }) => {
          const gameId = game as Game
          const contentKind = kind === 'word' ? 'word' : kind === 'charade' ? 'phrase' : kind === 'truth' ? 'truth' : kind === 'dare' ? 'dare' : 'never-have-i-ever'
          if (kind === 'category') throw new Error('Choose a generated category, then generate its words before saving the pack.')
          await saveCustomPack({ gameId, ...(metadata?.categoryId ? { categoryId: metadata.categoryId } : {}), name: metadata?.name || `AI ${kind} pack ${new Date().toLocaleDateString()}`, emoji: metadata?.emoji || '✨', description: metadata?.description || 'AI-assisted content reviewed and saved locally.', suitability: metadata?.suitability === 'adult' && save.adultMode ? 'adult' : 'general', kind: contentKind, entries: items.map(item => kind === 'word' && item.hints?.length ? `${item.text} | ${item.hints.join(' | ')}` : item.text) })
        }}
      />}
      </Suspense>}
      </div>
    </main>
    {creatorModalOpen && <dialog ref={creatorDialogRef} className="creator-unlock-panel" aria-labelledby="creator-unlock-title">
      <button type="button" className="creator-unlock-close" aria-label="Close" onClick={() => { setCreatorModalOpen(false); setCreatorSecret('') }}>×</button>
      <p className="eyebrow">PRIVATE ACCESS</p>
      <h2 id="creator-unlock-title">Creator profile</h2>
      {creatorEnabled ? <><p>Creator-only Kailas ease mode is active on this device.</p>
        <div className="creator-queue"><strong>FLAGGED CONTENT · {moderationQueue.length}</strong>{moderationQueue.length === 0 ? <small>No items are waiting for review.</small> : moderationQueue.map(item => <article key={item.contentId}><p>{item.item?.text ?? item.contentId}</p><small>{item.item?.game ?? 'Content'} · {item.downVotes} negative votes · score {item.score}</small><div><button type="button" onClick={() => void moderateQueueItem(item.contentId, 'approved')} disabled={moderationBusyId === item.contentId}>Approve</button><button type="button" onClick={() => void moderateQueueItem(item.contentId, 'rejected')} disabled={moderationBusyId === item.contentId}>Reject</button><button type="button" onClick={() => void moderateQueueItem(item.contentId, 'retired')} disabled={moderationBusyId === item.contentId}>Retire</button></div></article>)}</div>
        <button type="button" className="secondary-action" onClick={revokeCreatorAccess}>Lock creator profile</button></> : <form onSubmit={event => void submitCreatorUnlock(event)}>
        <label htmlFor="creator-secret">Creator key</label>
        <input id="creator-secret" type="password" autoComplete="current-password" value={creatorSecret} onChange={event => setCreatorSecret(event.target.value)} maxLength={256} required />
        <button type="submit" className="primary" disabled={creatorUnlocking || !creatorSecret.trim()}>{creatorUnlocking ? 'Verifying…' : 'Unlock'}</button>
      </form>}
    </dialog>}
    {launch && <div className={`launch-splash ${GAMES.find(game => game.id === launch.game)?.color ?? ''}`} style={{ left: launch.x, top: launch.y }} aria-hidden="true" />}
    <footer className="app-footer"><span className="footer-brand"><img src="/king-fun-logo.svg" width="16" height="16" alt="" aria-hidden="true" /> KING-FUN</span></footer>
    {commandOpen && <Suspense fallback={null}><CommandPalette
      open={true}
      games={GAMES}
      canResume={Boolean(save.active)}
      onOpenChange={setCommandOpen}
      onNavigate={navigateFromPalette}
      onLaunch={(game, source) => launchGame(game, source)}
      onResume={() => { if (save.active) { void ensureSeedContent().then(() => { setSelected(save.active!.game); setScreen('play') }).catch(() => setToast('Saved game content could not be loaded. Reload and try again.')) } }}
    /></Suspense>}
    {toastMessage && <div className="kf-toast-viewport"><div className="kf-toast" role="status"><span>{toastMessage}</span><button type="button" aria-label="Dismiss notification" onClick={() => { setToastMessage(''); if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current); toastTimerRef.current = null }}><Icon name="x" size={15} /></button></div></div>}
    {confirmation && <Suspense fallback={null}><ConfirmDialog open={true} title={confirmation.title} description={confirmation.description} confirmLabel={confirmation.confirmLabel} destructive={confirmation.destructive} onConfirm={confirmAction} onCancel={closeConfirmation} /></Suspense>}
  </div>
}
