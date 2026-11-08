import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { getAiApiBase, getAiBackendStatus, getAiProviderSnapshot, generateAiContent, testAiProvider, removeAiProviderKey, setAiProviderKey, setAiProviderStatus, subscribeAiProviders, updateAiProviderPreferences, type AiGame, type AiItemKind, type AiGeneratedItem, type AiGenerationProvider } from '../services/ai-providers.ts'
import type { MotionPreference } from '../types.ts'
import { Icon } from '../components/ui/Icon.tsx'
import { ToggleSwitch } from '../components/ui/ToggleSwitch.tsx'
import { SortableProviderRow } from '../components/settings/SortableProviderRow.tsx'
import { IMPOSTER_CATEGORIES } from '../content/imposter-categories.ts'

const AI_GAMES: Array<{ value: AiGame; label: string; defaultCategory: string; kinds: AiItemKind[] }> = [
  { value: 'imposter', label: 'Imposter', defaultCategory: 'animals', kinds: ['word', 'category'] },
  { value: 'guessup', label: 'GuessUp', defaultCategory: 'quick-scenes', kinds: ['charade'] },
  { value: 'truth-or-dare', label: 'Truth or Dare', defaultCategory: 'truth', kinds: ['truth', 'dare'] },
  { value: 'never-have-i-ever', label: 'I Have Never', defaultCategory: 'general', kinds: ['statement'] },
  { value: 'fake-it', label: 'Fake It', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'fake-story', label: 'Fake Story', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'fact-or-fiction', label: 'Fact or Fiction', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'wrong-answers-only', label: 'Wrong Answers Only', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'hot-bomb', label: 'Hot Bomb', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'hot-bomb-duel', label: 'Hot Bomb Duel', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'whos-most-likely', label: "Who's Most Likely", defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'would-you-rather', label: 'Would You Rather', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'share-or-pass', label: 'Share or Pass', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'challenge-20', label: '$20 Challenge', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'tilt-it', label: 'Tilt It', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'letterburg', label: 'Letterburg', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'discussion-starter', label: 'Discussion Starter', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'who-am-i', label: 'Who Am I?', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'ten-tangle', label: 'Ten Tangle', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'qupid', label: 'Qupid', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'questions-for-love', label: 'Questions for Love', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'a-or-b', label: 'A or B', defaultCategory: 'general', kinds: ['party-prompt'] },
  { value: 'reverse-singing', label: 'Reverse Singing', defaultCategory: 'general', kinds: ['party-prompt'] },
]

type Props = {
  adultMode: boolean
  onAdultModeChange: (enabled: boolean) => void
  theme: 'dark' | 'light'
  motionPreference: MotionPreference
  soundEnabled: boolean
  vibrationEnabled: boolean
  persistenceAvailable: boolean
  storagePersisted: boolean | null
  toggleTheme: (light: boolean) => void
  setMotionPreference: (value: MotionPreference) => void
  setSoundEnabled: (value: boolean) => void
  setVibrationEnabled: (value: boolean) => void
  exportBackup: () => void
  importBackup: (file: File) => void
  retryPersistence: () => void
  requestPersistentStorage: () => void
  deleteCustomPacks: () => void
  eraseLocalData: () => void
  goHome: () => void
  getRecentAiItems: (game: AiGame, kind: AiItemKind, categoryId: string, suitability: 'general' | 'adult') => string[]
  saveGeneratedPack: (game: AiGame, kind: AiItemKind, items: readonly AiGeneratedItem[], metadata?: { name: string; description: string; emoji: string; categoryId?: string; suitability?: 'general' | 'adult' }) => Promise<void>
}

const settingsQueryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } })

export function SettingsScreen(props: Props) {
  return <QueryClientProvider client={settingsQueryClient}><SettingsScreenContent {...props} /></QueryClientProvider>
}

function SettingsScreenContent(props: Props) {
  const importRef = useRef<HTMLInputElement>(null)
  const keyDialogRef = useRef<HTMLDialogElement>(null)
  const generationControllerRef = useRef<AbortController | null>(null)
  const ai = useSyncExternalStore(subscribeAiProviders, getAiProviderSnapshot, getAiProviderSnapshot)
  const [providerAnnouncement, setProviderAnnouncement] = useState('')
  const [draggedProvider, setDraggedProvider] = useState<'gemini' | 'groq' | null>(null)
  const [editingProvider, setEditingProvider] = useState<'gemini' | 'groq' | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [keyConsent, setKeyConsent] = useState(false)
  const [backendMessage, setBackendMessage] = useState('')
  const [aiGame, setAiGame] = useState<AiGame>('truth-or-dare')
  const [aiKind, setAiKind] = useState<AiItemKind>('truth')
  const [aiCategory, setAiCategory] = useState('truth')
  const [aiCategoryName, setAiCategoryName] = useState('')
  const [aiCategoryDescription, setAiCategoryDescription] = useState('')
  const [aiCategoryEmoji, setAiCategoryEmoji] = useState('🃏')
  const selectedImposterCategory = aiGame === 'imposter'
    ? IMPOSTER_CATEGORIES.find(category => category.id === aiCategory)
    : undefined
  const aiThemeName = aiCategoryName.trim() || selectedImposterCategory?.name || ''
  const aiThemeDescription = aiCategoryDescription.trim() || selectedImposterCategory?.description || ''
  const requiresCustomImposterMetadata = aiGame === 'imposter' && aiKind === 'word' && !selectedImposterCategory
  const [aiBusy, setAiBusy] = useState(false)
  const [aiOutput, setAiOutput] = useState<AiGeneratedItem[]>([])
  const [aiSource, setAiSource] = useState<AiGenerationProvider | null>(null)
  const [aiError, setAiError] = useState('')
  const gatewayQuery = useQuery({ queryKey: ['ai-gateway-status'], queryFn: ({ signal }) => getAiBackendStatus(signal), staleTime: 30_000, retry: 1 })
  const backendStatus = backendMessage || (gatewayQuery.isPending ? 'Checking gateway…' : gatewayQuery.isError ? gatewayQuery.error.message : gatewayQuery.data ? `Gateway ${gatewayQuery.data.status} · ${gatewayQuery.data.tasks.length} task types` : 'Not checked')
  useEffect(() => {
    const dialog = keyDialogRef.current
    if (!dialog) return
    if (editingProvider && !dialog.open) dialog.showModal()
    if (!editingProvider && dialog.open) dialog.close()
    return () => { if (dialog.open) dialog.close() }
  }, [editingProvider])
  const checkBackend = () => { setBackendMessage(''); void gatewayQuery.refetch() }
  const saveKey = () => { if (editingProvider && keyConsent && keyDraft.trim().length >= 20) { setAiProviderKey(editingProvider, keyDraft.trim()); setKeyDraft(''); setKeyConsent(false); setEditingProvider(null) } }
  useEffect(() => {
    generationControllerRef.current?.abort()
    generationControllerRef.current = null
    queueMicrotask(() => {
      setAiOutput([])
      setAiSource(null)
      setAiBusy(false)
      setAiError('')
    })
    return () => generationControllerRef.current?.abort()
  }, [props.adultMode])
  const generate = async () => {
    generationControllerRef.current?.abort()
    const controller = new AbortController()
    generationControllerRef.current = controller
    setAiBusy(true); setAiError(''); setAiOutput([]); setAiSource(null)
    const suitability = props.adultMode ? 'adult' : 'general'
    try {
      const count = aiGame === 'imposter' && aiKind === 'word' ? 1 : 5
      if (aiGame === 'imposter' && aiKind === 'word' && (!aiThemeName || !aiThemeDescription)) {
        throw new Error('Enter a category title and description for this custom Imposter theme.')
      }
      const result = await generateAiContent({ game: aiGame, itemKind: aiKind, categoryId: aiCategory, ...(aiThemeName ? { categoryName: aiThemeName } : {}), ...(aiThemeDescription ? { categoryDescription: aiThemeDescription } : {}), count, suitability, adultMode: suitability === 'adult', recentItems: props.getRecentAiItems(aiGame, aiKind, aiCategory, suitability) }, controller.signal)
      if (controller.signal.aborted || generationControllerRef.current !== controller) return
      setAiOutput(result.items)
      setAiSource(result.provider)
      setAiError(result.provider === 'local-curated' ? `${'fallbackReason' in result ? result.fallbackReason : 'Using local/offline content.'}` : aiKind === 'category' ? `Generated by ${result.provider}. Select a category, generate words, then save.` : `Generated by ${result.provider}. Review and save as a custom pack.`)
    } catch (error) {
      if (!controller.signal.aborted && generationControllerRef.current === controller) setAiError(error instanceof Error ? error.message : 'Generation failed.')
    } finally {
      if (generationControllerRef.current === controller) { generationControllerRef.current = null; setAiBusy(false) }
    }
  }
  const moveProvider = (provider: 'gemini' | 'groq', direction: -1 | 1) => { const order = [...ai.preferences.order]; const index = order.indexOf(provider); const target = index + direction; if (target < 0 || target >= order.length) return; [order[index], order[target]] = [order[target]!, order[index]!]; updateAiProviderPreferences({ ...ai.preferences, order }) }
  const dropProvider = (targetProvider: 'gemini' | 'groq') => {
    const sourceProvider = draggedProvider
    setDraggedProvider(null)
    if (!sourceProvider || sourceProvider === targetProvider) return
    const order = [...ai.preferences.order]
    const from = order.indexOf(sourceProvider)
    const to = order.indexOf(targetProvider)
    if (from < 0 || to < 0) return
    const [moved] = order.splice(from, 1)
    order.splice(to, 0, moved!)
    updateAiProviderPreferences({ ...ai.preferences, order })
    setProviderAnnouncement(`${sourceProvider === 'gemini' ? 'Google Gemini' : 'Groq'} moved to priority ${to + 1}.`)
  }
  return <section className="workspace settings-workspace kf-workspace" aria-labelledby="settings-title">
    <button type="button" className="back-link" onClick={props.goHome}><Icon name="arrow-left" size={15} /> Back</button>
    <p className="eyebrow">Settings</p>
    <h1 id="settings-title" className="page-title">Preferences</h1>
    <div className="settings-grid kf-grid">
      <section className="setting-card" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2>
        <p>Theme and motion preferences.</p>
        <ToggleSwitch label="Light appearance" checked={props.theme === 'light'} onCheckedChange={props.toggleTheme} />
        <label className="setting-field" htmlFor="motion-preference">Motion</label>
        <select id="motion-preference" className="setting-select" value={props.motionPreference} onChange={event => props.setMotionPreference(event.currentTarget.value as MotionPreference)}>
          <option value="system">Follow device</option>
          <option value="reduce">Reduce motion</option>
        </select>
        <ToggleSwitch label="GuessUp sound effects" checked={props.soundEnabled} onCheckedChange={props.setSoundEnabled} />
        <ToggleSwitch label="GuessUp vibration" checked={props.vibrationEnabled} onCheckedChange={props.setVibrationEnabled} />
      </section>


      <section className="setting-card adult-mode-card" aria-labelledby="adult-mode-heading">
        <h2 id="adult-mode-heading">18+ mode</h2>
        <p>Optional adult content pool for eligible packs and generation. Audience setting, not age verification.</p>
        <ToggleSwitch label="18+ mode" description="Only enable when every player is 18 or older. Players can skip any prompt." checked={props.adultMode} onCheckedChange={props.onAdultModeChange} />
        {props.adultMode && <small role="status">Adult pool enabled. AI generation uses your configured provider order.</small>}
      </section>

      <section className="setting-card ai-provider-card" aria-labelledby="ai-generation-heading">
        <h2 id="ai-generation-heading">AI content</h2>
        <p>Optional generation through the gateway. Provider keys stay in memory for this tab session.</p>
        <div className="storage-state" role="status"><span className="storage-state-dot is-warning" aria-hidden="true"/><span>{backendStatus}</span><button type="button" className="text-button" onClick={checkBackend} disabled={gatewayQuery.isFetching}><Icon name="refresh" size={14} /> {gatewayQuery.isFetching ? 'Checking…' : 'Check'}</button></div>
        <small>API: {getAiApiBase() || 'same origin'}</small>
        <p className="visually-hidden" aria-live="polite">{providerAnnouncement}</p>
        <div className="ai-provider-stack">
          <div className="ai-provider-list kf-provider-list" role="list" aria-label="AI provider priority">
            {ai.preferences.order.map((provider, index) => <SortableProviderRow
              key={provider}
              provider={provider}
              index={index}
              isDragging={draggedProvider === provider}
              onDragStart={setDraggedProvider}
              onDrop={dropProvider}
              onDragEnd={() => setDraggedProvider(null)}
              status={ai.keys[provider] ? ai.status[provider] ?? 'Session key configured' : 'No session key'}
              hasKey={Boolean(ai.keys[provider])}
              enabled={ai.preferences.enabled[provider]}
              onEdit={() => { setEditingProvider(provider); setKeyDraft(''); setKeyConsent(false) }}
              onTest={() => void testAiProvider(provider).catch(error => setAiProviderStatus(provider, error instanceof Error ? error.message : 'Connection test failed.'))}
              onRemove={() => removeAiProviderKey(provider)}
              onToggle={enabled => updateAiProviderPreferences({ ...ai.preferences, enabled: { ...ai.preferences.enabled, [provider]: enabled } })}
              onMove={direction => moveProvider(provider, direction)}
            />)}
          </div>
          <div className="ai-provider-row pinned kf-provider-row kf-provider-pinned" role="group" aria-label="Pinned server-side fallback">
            <span className="provider-pinned-icon"><Icon name="cloud" size={16} /></span>
            <span className="ai-provider-rank">03</span>
            <div className="provider-identity"><strong className="provider-name">Cloudflare Workers AI</strong><span className="provider-connection is-connected"><i />Operator-managed fallback</span></div>
            <button type="button" className="setting-action provider-pinned-test" onClick={() => void testAiProvider('cloudflare-workers-ai').then(() => setBackendMessage('Cloudflare Workers AI connection test passed')).catch(error => setBackendMessage(error instanceof Error ? error.message : 'Cloudflare test failed.'))}><Icon name="activity" size={14} /> Test</button>
          </div>
        </div>
        {editingProvider && <dialog
          ref={keyDialogRef}
          id="ai-key-dialog"
          className="ai-key-editor"
          aria-labelledby="ai-key-title"
          aria-describedby="ai-key-description"
          onCancel={event => { event.preventDefault(); setEditingProvider(null); setKeyDraft(''); setKeyConsent(false) }}
          onClick={event => { if (event.target === event.currentTarget) { setEditingProvider(null); setKeyDraft(''); setKeyConsent(false) } }}
        >
          <h3 id="ai-key-title">{editingProvider === 'gemini' ? 'Gemini' : 'Groq'} API key</h3>
          <p id="ai-key-description">The key stays in this tab’s memory and is sent through the gateway to the selected provider for generation. It is not intentionally persisted or returned to the browser.</p>
          <label htmlFor="ai-session-key">API key</label>
          <input id="ai-session-key" type="password" autoComplete="off" autoFocus value={keyDraft} onChange={event => setKeyDraft(event.currentTarget.value)} placeholder="Paste provider API key"/>
          <ToggleSwitch label="I understand this key is sent to the selected provider" checked={keyConsent} onCheckedChange={setKeyConsent} />
          <div className="setting-action-group">
            <button type="button" className="setting-action" disabled={keyDraft.trim().length < 20 || !keyConsent} onClick={saveKey}>Save for this session</button>
            <button type="button" className="setting-action" onClick={() => { setEditingProvider(null); setKeyDraft(''); setKeyConsent(false) }}>Cancel</button>
          </div>
        </dialog>}
        <div className="ai-generate-tools">
          <h3>Generate content</h3>
          <small>{props.adultMode ? 'Adult pool' : 'All-ages pool'}</small>
          <div className="ai-generate-fields">
            <label>Game
              <select className="setting-select" value={aiGame} onChange={event => {
                const value = event.currentTarget.value as AiGame
                setAiGame(value)
                const meta = AI_GAMES.find(g => g.value === value)
                setAiCategory(meta?.defaultCategory ?? 'general')
                setAiKind(meta?.kinds[0] ?? 'party-prompt')
                setAiCategoryName('')
                setAiCategoryDescription('')
                setAiCategoryEmoji('🃏')
                setAiOutput([])
                setAiSource(null)
              }}>
                {AI_GAMES.map(game => <option key={game.value} value={game.value}>{game.label}</option>)}
              </select>
            </label>
            <label>Type
              <select className="setting-select" value={aiKind} onChange={event => { setAiKind(event.currentTarget.value as AiItemKind); setAiOutput([]); setAiSource(null) }}>
                {(AI_GAMES.find(g => g.value === aiGame)?.kinds ?? ['party-prompt']).map(kind => <option key={kind} value={kind}>{kind === 'category' ? 'Category metadata' : kind === 'party-prompt' ? 'Prompt' : kind}</option>)}
              </select>
            </label>
            <label>Theme / category ID
              <input value={aiCategory} maxLength={64} onChange={event => setAiCategory(event.currentTarget.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))} placeholder="e.g. animals, travel"/>
            </label>
          </div>
          <label>Theme title {aiGame === 'imposter' && aiKind === 'word' ? '(required for custom themes; built-ins use saved metadata)' : '(optional, sent to API)'}
            <input value={aiCategoryName} maxLength={80} required={requiresCustomImposterMetadata} onChange={event => setAiCategoryName(event.currentTarget.value)} placeholder={selectedImposterCategory?.name ?? 'Short title for this theme'}/>
          </label>
          <label>Theme description {aiGame === 'imposter' && aiKind === 'word' ? '(required for custom themes; built-ins use saved metadata)' : '(optional, sent to API)'}
            <input value={aiCategoryDescription} maxLength={180} required={requiresCustomImposterMetadata} onChange={event => setAiCategoryDescription(event.currentTarget.value)} placeholder={selectedImposterCategory?.description ?? 'Short description for generation'}/>
          </label>
          {aiGame === 'imposter' && <label>Pack emoji
            <input value={aiCategoryEmoji} maxLength={8} onChange={event => setAiCategoryEmoji(event.currentTarget.value)} placeholder="🃏"/>
          </label>}
          <button type="button" className="setting-action" disabled={aiBusy || !aiCategory.trim() || (requiresCustomImposterMetadata && (!aiCategoryName.trim() || !aiCategoryDescription.trim()))} onClick={() => void generate()}>
            {aiBusy ? 'Generating…' : aiKind === 'category' ? 'Generate categories' : 'Generate items'}
          </button>
          <p role="status" aria-live="polite">{aiError}</p>
          {aiOutput.length > 0 && <ul className="ai-generated-list">
            {aiOutput.map(item => <li key={item.id}>
              {aiKind === 'category' ? <>
                <strong><Icon name="dice" size={15} /> {item.text}</strong>
                <small>{item.description}</small>
                <button type="button" className="setting-action" onClick={() => {
                  setAiCategory(item.categoryId)
                  setAiCategoryName(item.text)
                  setAiCategoryDescription(item.description ?? '')
                  setAiCategoryEmoji(item.emoji || '🃏')
                  setAiKind('word')
                  setAiOutput([])
                  setAiSource(null)
                  setAiError(`Selected “${item.text}”. Generate words, review hints, then save the pack.`)
                }}>Use category</button>
              </> : <>
                <strong>{item.text}</strong>
                {item.hints?.length ? <small>Hints: {item.hints.join(' · ')}</small> : null}
              </>}
            </li>)}
          </ul>}
          {aiOutput.length > 0 && aiSource !== 'local-curated' && aiKind !== 'category' && <button type="button" className="setting-action" onClick={() => {
            const kind = aiKind
            const game = aiGame
            const items = [...aiOutput]
            const suitability: 'adult' | 'general' = props.adultMode ? 'adult' : 'general'
            const metadata = game === 'imposter' ? {
              name: aiCategoryName.trim() || `AI ${kind} pack ${new Date().toLocaleDateString()}`,
              description: aiCategoryDescription.trim() || 'AI-assisted Imposter category reviewed and saved locally.',
              emoji: aiCategoryEmoji.trim() || '🃏',
              categoryId: aiCategory,
              suitability,
            } : { name: `AI ${kind} pack ${new Date().toLocaleDateString()}`, description: props.adultMode ? 'AI-assisted adult content reviewed and saved locally.' : 'AI-assisted content reviewed and saved locally.', emoji: '✨', suitability }
            void props.saveGeneratedPack(game, kind, items, metadata).then(() => {
              setAiOutput([])
              setAiError('Saved as a local custom pack.')
            }).catch(error => setAiError(error instanceof Error ? error.message : 'Could not save generated pack.'))
          }}>Save as local custom pack</button>}
        </div>
        <small role="status">Generated batches require explicit local review and saving before entering local gameplay packs. Bundled and custom packs are available without AI generation.</small>

      </section>

      <section className="setting-card" aria-labelledby="local-data-heading">
        <h2 id="local-data-heading">Data & storage</h2>
        <p>Manage players, sessions, history, preferences, and custom packs.</p>
        <div className="storage-state" role="status">
          <span className={`storage-state-dot${props.persistenceAvailable ? ' is-ready' : ' is-warning'}`} aria-hidden="true" />
          <span>{props.persistenceAvailable ? 'Storage available' : 'Storage unavailable — changes may not survive reload'}</span>
        </div>
        <div className="storage-state" role="status">
          <span className={`storage-state-dot${props.storagePersisted ? ' is-ready' : ' is-warning'}`} aria-hidden="true" />
          <span>{props.storagePersisted === true ? 'Persistent storage granted' : props.storagePersisted === false ? 'Persistent storage not granted' : 'Persistent storage status unknown'}</span>
        </div>
        {!props.persistenceAvailable && <button type="button" className="setting-action" onClick={props.retryPersistence}>Retry storage</button>}
        {props.storagePersisted !== true && <button type="button" className="setting-action" onClick={props.requestPersistentStorage}>Request persistent storage</button>}
        <div className="setting-action-group">
          <button type="button" className="setting-action" onClick={props.exportBackup}><Icon name="download" size={14} /> Export backup</button>
          <button type="button" className="setting-action" onClick={() => importRef.current?.click()}><Icon name="upload" size={14} /> Import backup</button>
          <input
            ref={importRef}
            className="visually-hidden-file-input"
            type="file"
            accept="application/json,.json"
            aria-label="Choose a KING-FUN JSON backup file"
            onChange={event => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) props.importBackup(file)
            }}
          />
        </div>
        <small>Restoring a backup replaces current data.</small>
        <button type="button" className="setting-action" onClick={props.deleteCustomPacks}>Delete custom packs</button>
        <button type="button" className="setting-action danger" onClick={props.eraseLocalData}>Erase all data</button>
      </section>
    </div>
  </section>
}
