import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useDropzone } from 'react-dropzone'
import type { ContentItem, ContentKind, ContentPack } from '../domain/shared/contracts.ts'
import { canonicalizeContentText } from '../domain/content/canonicalize.ts'
import { assertImposterPackImportSize, parseImposterPackImport, validateImposterPackEntries } from '../domain/games/imposter-pack.ts'
import { mysticCount as maxMysticCountForPlayers, normalizeImposterWord } from '../domain/games/imposter.ts'
import type { ArcadeSetupOptions, GameDefinition, GameSetup, GuessUpPreferences, ImposterSetup, Player, SetupPackDraft } from '../types.ts'
import { Icon, type IconName } from '../components/ui/Icon.tsx'
import { GameMark } from '../components/ui/GameMark.tsx'
import { ToggleSwitch } from '../components/ui/ToggleSwitch.tsx'

type Props = {
  game: GameDefinition
  adultMode: boolean
  players: Player[]
  packs: readonly ContentPack[]
  contentItems: readonly ContentItem[]
  savedPackIds?: readonly string[]
  guessUpPreferences: GuessUpPreferences
  imposterPreferences: ImposterSetup
  updateGuessUpPreferences: (patch: Partial<GuessUpPreferences>) => void
  addPlayer: (name: string) => boolean
  removePlayer: (id: string) => void
  renamePlayer: (id: string, name: string) => boolean
  startGame: (setup: GameSetup) => void | Promise<void>
  saveCustomPack: (draft: SetupPackDraft, existingId?: string) => Promise<ContentPack | null>
  deleteCustomPack: (packId: string) => void
  resetRecentContent: () => void
  goHome: () => void
}

const MODES = [
  { id: 'all-together', title: 'All together', description: 'One prompt for everyone.', icon: 'users' },
  { id: 'spin-wheel', title: 'Spin the wheel', description: 'Pick a player, then Truth or Dare.', icon: 'shuffle' },
  { id: 'one-at-a-time', title: 'One at a time', description: 'Pass the phone.', icon: 'list-ordered' },
] as const

const KIND_BY_GAME: Record<GameDefinition['id'], ContentKind> = {
  imposter: 'word', guessup: 'phrase', 'truth-or-dare': 'truth', 'never-have-i-ever': 'never-have-i-ever',
  'timer-impostor': 'party-prompt', werewolf: 'party-prompt', mafia: 'party-prompt', murder: 'party-prompt',
  'fake-it': 'party-prompt', 'fake-story': 'party-prompt', 'fact-or-fiction': 'party-prompt',
  'wrong-answers-only': 'party-prompt', 'hot-bomb': 'party-prompt', 'hot-bomb-duel': 'party-prompt',
  'whos-most-likely': 'party-prompt', 'would-you-rather': 'party-prompt', 'share-or-pass': 'party-prompt',
  'challenge-20': 'party-prompt', 'tilt-it': 'party-prompt', letterburg: 'party-prompt',
  'discussion-starter': 'party-prompt', 'who-am-i': 'party-prompt', 'ten-tangle': 'party-prompt',
  qupid: 'party-prompt', 'questions-for-love': 'party-prompt', 'a-or-b': 'party-prompt', 'reverse-singing': 'party-prompt',
}

const RULE_ONLY_GAMES = new Set<GameDefinition['id']>(['timer-impostor', 'werewolf', 'mafia', 'murder'])

const DEFAULT_ARCADE_OPTIONS: ArcadeSetupOptions = {
  playStyle: 'classic', durationSeconds: 60, roleCount: 1, phoneNarrator: true,
  antiItemsMode: false, readPromptsAloud: false, fuseSeconds: 10,
}

function minimumPlayersForGame(game: GameDefinition['id']): number {
  if (game === 'imposter' || game === 'timer-impostor') return 3
  if (game === 'werewolf' || game === 'mafia') return 5
  if (game === 'murder' || game === 'fake-story' || game === 'fact-or-fiction' || game === 'fake-it') return 3
  if (game === 'hot-bomb-duel') return 2
  return 2
}
function maximumPlayersForGame(game: GameDefinition['id']): number {
  if (game === 'imposter' || game === 'werewolf' || game === 'mafia' || game === 'who-am-i') return 20
  if (game === 'hot-bomb-duel' || game === 'qupid' || game === 'questions-for-love' || game === 'a-or-b') return 2
  return 32
}

const DURATION_OPTIONS = [30, 45, 60, 90, 120] as const

type DeckFilter = 'all' | 'packs' | 'featured' | 'all-ages'
type SuitabilityFilter = 'all' | 'general' | 'teen' | 'adult'

const playerSchema = z.object({ name: z.string().trim().min(1, 'Enter a player name.').max(24, 'Player names can contain up to 24 characters.') })
type PlayerFormValues = z.infer<typeof playerSchema>

export function SetupScreen({ game, adultMode, players, packs, contentItems, savedPackIds, guessUpPreferences, imposterPreferences, updateGuessUpPreferences, addPlayer, removePlayer, renamePlayer, startGame, saveCustomPack, deleteCustomPack, resetRecentContent, goHome }: Props) {
  const availablePacks = useMemo(() => packs.filter(pack => pack.gameId === game.id && (adultMode || pack.suitability === 'general')), [packs, game.id, adultMode])
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(() => {
    const saved = savedPackIds?.filter(id => availablePacks.some(pack => pack.id === id)) ?? []
    if (saved.length) return saved
    const defaults = availablePacks.filter(pack => pack.isDefault).map(pack => pack.id)
    return defaults.length ? defaults : availablePacks.slice(0, 1).map(pack => pack.id)
  })
  const [mode, setMode] = useState<GameSetup['mode']>('spin-wheel')
  const [teamAName, setTeamAName] = useState('Team A')
  const [teamBName, setTeamBName] = useState('Team B')
  const [teamAssignments, setTeamAssignments] = useState<Record<string, 'A' | 'B'>>(() => Object.fromEntries(players.map((player, index) => [player.id, index % 2 === 0 ? 'A' : 'B'])))
  const [responseMethod, setResponseMethod] = useState<GameSetup['responseMethod']>('fingers')
  const [arcadeOptions, setArcadeOptions] = useState<ArcadeSetupOptions>(DEFAULT_ARCADE_OPTIONS)
  const [imposterMode, setImposterMode] = useState<ImposterSetup['mode']>(imposterPreferences.mode)
  const [mysticCountSetting, setMysticCountSetting] = useState(imposterPreferences.mysticCount)
  const [mysticHintsEnabled, setMysticHintsEnabled] = useState(imposterPreferences.mysticHintsEnabled)
  const [sameMysticHint, setSameMysticHint] = useState(imposterPreferences.sameMysticHint)
  const [discussionTimerEnabled, setDiscussionTimerEnabled] = useState(imposterPreferences.discussionTimerEnabled)
  const [discussionSeconds, setDiscussionSeconds] = useState(imposterPreferences.discussionSeconds)
  const [votingEnabled, setVotingEnabled] = useState(imposterPreferences.votingEnabled)
  const [hiddenVoter, setHiddenVoter] = useState(imposterPreferences.hiddenVoter)
  const [deckFilter, setDeckFilter] = useState<DeckFilter>('all')
  const [suitabilityFilter, setSuitabilityFilter] = useState<SuitabilityFilter>('all')
  const [packEditorOpen, setPackEditorOpen] = useState(false)
  const [editingPackId, setEditingPackId] = useState<string | undefined>()
  const [packName, setPackName] = useState('')
  const [packEmoji, setPackEmoji] = useState('🃏')
  const [packDescription, setPackDescription] = useState('Custom content pack.')

  const [packKind, setPackKind] = useState<ContentKind>(KIND_BY_GAME[game.id])
  const [packSuitability, setPackSuitability] = useState<'general' | 'teen' | 'adult'>('general')
  const [packEntries, setPackEntries] = useState('')
  const [packError, setPackError] = useState('')
  const [exportPackId, setExportPackId] = useState('')
  const [apiCategoryOpen, setApiCategoryOpen] = useState(false)
  const [apiTitle, setApiTitle] = useState('')
  const [apiDescription, setApiDescription] = useState('')
  const [apiBusy, setApiBusy] = useState(false)
  const [apiError, setApiError] = useState('')
  const [apiOutput, setApiOutput] = useState<string[]>([])
  const [savingPack, setSavingPack] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingPlayerName, setEditingPlayerName] = useState('')
  const packDialogRef = useRef<HTMLDialogElement>(null)
  const [playerListRef] = useAutoAnimate({ duration: 180 })
  const [packListRef] = useAutoAnimate({ duration: 180 })
  const playerForm = useForm<PlayerFormValues>({ resolver: zodResolver(playerSchema), defaultValues: { name: '' } })
  const packDropzone = useDropzone({
    accept: { 'application/json': ['.json'], 'text/plain': ['.txt'] },
    multiple: false,
    disabled: game.id !== 'imposter',
    onDrop: files => { void importPackFile(files[0]) },
  })

  const validSelectedPackIds = selectedPackIds.filter(id => availablePacks.some(pack => pack.id === id))
  const effectiveTeamAssignments = useMemo(() => Object.fromEntries(players.map((player, index) => [
    player.id, teamAssignments[player.id] ?? (index % 2 === 0 ? 'A' : 'B'),
  ])), [players, teamAssignments])

  useEffect(() => {
    const dialog = packDialogRef.current
    if (!dialog) return
    if (packEditorOpen && !dialog.open) dialog.showModal()
    if (!packEditorOpen && dialog.open) dialog.close()
    return () => { if (dialog.open) dialog.close() }
  }, [packEditorOpen])

  const isGroupModeGame = game.id === 'truth-or-dare' || game.id === 'never-have-i-ever'
  const isPlayerModeGame = isGroupModeGame
  const visiblePacks = availablePacks.filter(pack => {
    if (suitabilityFilter !== 'all' && pack.suitability !== suitabilityFilter) return false
    if (deckFilter === 'featured') return pack.isDefault
    if (deckFilter === 'all-ages') return pack.suitability === 'general'
    if (deckFilter === 'packs') return !pack.isDefault
    return true
  })
  const selectedPacks = availablePacks.filter(pack => validSelectedPackIds.includes(pack.id))
  const exportPack = selectedPacks.find(pack => pack.id === exportPackId) ?? selectedPacks.find(pack => !pack.isDefault) ?? selectedPacks[0]
  const selectedItems = contentItems.filter(item => validSelectedPackIds.includes(item.packId) && (adultMode || item.suitability === 'general'))
  const contentCount = (pack: ContentPack) => contentItems.filter(item => item.packId === pack.id && (adultMode || item.suitability === 'general')).length
  const enoughPlayers = players.length >= minimumPlayersForGame(game.id) && players.length <= maximumPlayersForGame(game.id)
  const balancedTeams = players.some(player => effectiveTeamAssignments[player.id] === 'A') && players.some(player => effectiveTeamAssignments[player.id] === 'B')
  const allSelectedPacksExist = RULE_ONLY_GAMES.has(game.id) || (validSelectedPackIds.length > 0 && selectedPacks.length === validSelectedPackIds.length)
  const maxMystics = Math.max(1, Math.min(players.length >= 3 && players.length <= 20 ? maxMysticCountForPlayers(players.length) : 1, players.length - (imposterMode === 'mystics' ? 2 : 1)))
  const hasGameContent = RULE_ONLY_GAMES.has(game.id) || (game.id === 'imposter'
    ? selectedItems.some(item => item.kind === 'word')
    : game.id === 'guessup'
      ? selectedItems.some(item => item.kind === 'phrase' || item.kind === 'word')
      : game.id === 'truth-or-dare'
        ? selectedItems.some(item => item.kind === 'truth') && selectedItems.some(item => item.kind === 'dare')
        : game.id === 'never-have-i-ever'
          ? selectedItems.some(item => item.kind === 'never-have-i-ever')
          : selectedItems.some(item => item.kind === 'party-prompt'))
  const hasDeferredApiCategory = selectedPacks.some(pack => !pack.isDefault && contentCount(pack) === 0)
  const teamNamesValid = teamAName.trim().length > 0 && teamBName.trim().length > 0 && teamAName.trim().toLocaleLowerCase() !== teamBName.trim().toLocaleLowerCase()
  const canStart = enoughPlayers && allSelectedPacksExist && (hasGameContent || hasDeferredApiCategory) && (game.id !== 'guessup' || (balancedTeams && teamNamesValid))

  const savePlayerName = (id: string) => {
    const name = editingPlayerName.trim()
    if (!name) return
    if (players.some(player => player.id !== id && normalizeImposterWord(player.name) === normalizeImposterWord(name))) return
    if (!renamePlayer(id, name)) return
    setEditingPlayerId(null)
    setEditingPlayerName('')
  }

  const openNewPack = () => {
    setEditingPackId(undefined)
    setPackName('')
    setPackEmoji('🃏')
    setPackDescription('Custom content pack.')

    setPackKind(KIND_BY_GAME[game.id])
    setPackSuitability('general')
    setPackEntries('')
    setPackError('')
    setPackEditorOpen(true)
  }

  const openEditPack = (pack: ContentPack) => {
    const items = contentItems.filter(item => item.packId === pack.id)
    setEditingPackId(String(pack.id))
    setPackName(pack.name)
    setPackEmoji(pack.emoji ?? '🃏')
    setPackDescription(pack.description)
    setPackKind(items[0]?.kind ?? KIND_BY_GAME[game.id])
    setPackSuitability(pack.suitability === 'adult' && adultMode ? 'adult' : pack.suitability === 'teen' ? 'teen' : 'general')
    setPackEntries(items.map(item => [item.text, ...(item.hints ?? [])].join(' | ')).join('\n'))
    setPackError('')
    setPackEditorOpen(true)
  }

  const savePack = async () => {
    const lines = packEntries.split(/\r?\n/).map(entry => entry.trim()).filter(Boolean)
    let entries = game.id === 'imposter' ? lines : [...new Set(lines)]
    if (!packName.trim()) { setPackError('Give this pack a name.'); return }
    if (availablePacks.some(pack => pack.id !== editingPackId && pack.name.trim().toLocaleLowerCase() === packName.trim().toLocaleLowerCase())) { setPackError('A pack with this name already exists for the game.'); return }
    if (entries.length < 2) { setPackError('Add at least two prompts, one per line.'); return }
    if (entries.length > 100) { setPackError('A custom pack can contain at most 100 prompts.'); return }
    if (game.id === 'imposter') {
      try { entries = validateImposterPackEntries(entries) }
      catch (error) { setPackError(error instanceof Error ? error.message : 'The Imposter category is invalid.'); return }
    } else {
      if (game.id === 'fake-it' && entries.some(entry => {
        const [category, answer, ...extra] = entry.split('|').map(value => value.trim())
        return !category || !answer || extra.some(Boolean)
      })) { setPackError('Use one broad category or clue and its secret word per line: Category | Secret word.'); return }
      if (game.id === 'fact-or-fiction' && entries.some(entry => {
        const [statement, verdict, ...extra] = entry.split('|').map(value => value.trim().toLocaleLowerCase())
        return !statement || !['true', 'false'].includes(verdict ?? '') || extra.some(Boolean)
      })) { setPackError('Use one statement and a true/false verdict per line: Statement | true.'); return }
      if ((game.id === 'would-you-rather' || game.id === 'a-or-b') && entries.some(entry => {
        const options = entry.split('||').map(value => value.trim())
        return options.length !== 2 || !options[0] || !options[1]
      })) { setPackError('Each line needs exactly two options separated by ||.'); return }
      const canonicalEntries = entries.map(canonicalizeContentText)
      if (new Set(canonicalEntries).size !== canonicalEntries.length) { setPackError('This pack contains duplicate prompts. Remove duplicates before saving.'); return }
      if (entries.some(entry => entry.length > 240)) { setPackError('Each prompt must be 240 characters or fewer.'); return }
    }
    setSavingPack(true)
    setPackError('')
    try {
      const saved = await saveCustomPack({ gameId: game.id, name: packName.trim(), emoji: packEmoji.trim() || '🃏', description: packDescription.trim(), kind: packKind as SetupPackDraft['kind'], suitability: packSuitability, entries }, editingPackId)
      if (saved) {
        setSelectedPackIds(current => [...new Set([...current.filter(id => id !== editingPackId && availablePacks.some(pack => pack.id === id)), saved.id])])
        setExportPackId(saved.id)
        setPackEditorOpen(false)
      } else {
        setPackError('The pack could not be saved. Check local storage and try again.')
      }
    } catch (error) {
      setPackError(error instanceof Error ? error.message : 'The pack could not be saved.')
    } finally {
      setSavingPack(false)
    }
  }

  const exportSelectedPack = (format: 'json' | 'txt') => {
    const pack = exportPack
    if (!pack) return
    const rows = contentItems.filter(item => item.packId === pack.id)
    const body = format === 'json'
      ? JSON.stringify({ name: pack.name, emoji: pack.emoji ?? '🃏', description: pack.description, words: rows.map(item => ({ word: item.text, hints: item.hints ?? [] })) }, null, 2)
      : rows.map(item => [item.text, ...(item.hints ?? [])].join(' | ')).join('\n')
    const url = URL.createObjectURL(new Blob([body], { type: format === 'json' ? 'application/json' : 'text/plain' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${pack.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${format}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const importPackFile = async (file?: File) => {
    if (!file) return
    try {
      assertImposterPackImportSize(file.size)
      const raw = await file.text()
      const imported = parseImposterPackImport(raw, file.name)
      setPackName(imported.name)
      setPackEmoji(imported.emoji)
      setPackDescription(imported.description)
      setPackEntries(imported.entries.join('\n'))
      setPackKind('word'); setPackError(''); setEditingPackId(undefined); setPackEditorOpen(true)
    } catch (error) { setPackEditorOpen(true); setPackError(error instanceof Error ? error.message : 'Could not import this pack.') }
  }

  const submitSetup = () => {
    if (!canStart) return
    startGame({
      packIds: RULE_ONLY_GAMES.has(game.id) ? [] : validSelectedPackIds,
      mode: isPlayerModeGame ? mode : 'all-together',
      durationSeconds: guessUpPreferences.durationSeconds,
      teamAName: teamAName.trim() || 'Team A',
      teamBName: teamBName.trim() || 'Team B',
      teamAssignments: effectiveTeamAssignments,
      responseMethod,
      soundEnabled: guessUpPreferences.soundEnabled,
      musicEnabled: guessUpPreferences.musicEnabled,
      vibrationEnabled: guessUpPreferences.vibrationEnabled,
      inputMode: guessUpPreferences.inputMode,
      arcade: arcadeOptions,
      imposter: { mode: imposterMode, mysticCount: Math.max(1, Math.min(maxMystics, mysticCountSetting)), mysticHintsEnabled, sameMysticHint, discussionTimerEnabled, discussionSeconds, votingEnabled, hiddenVoter },
    })
  }


  return <section className="workspace setup-workspace kf-workspace" aria-label={`${game.name} setup`}>
    <button type="button" className="back-link" onClick={goHome}><Icon name="arrow-left" size={15} /> BACK TO THE LINEUP</button>
    <div className="setup-layout kf-grid"><div className="setup-main-column kf-span-7">
      <h1 className="page-title">Set up <em>{game.name}.</em></h1>
      <div className="player-panel"><div className="panel-heading"><h3>Who's playing?</h3><span>{players.length} PLAYERS</span></div>
        <div ref={playerListRef} className="player-list player-list-editable">{players.map(player => <div className="player-chip player-chip-editable" key={player.id}><span className="player-avatar">{player.name.slice(0, 1).toUpperCase()}</span>{editingPlayerId === player.id ? <><input aria-label={`New name for ${player.name}`} autoFocus value={editingPlayerName} maxLength={24} onChange={event => setEditingPlayerName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); savePlayerName(player.id) } if (event.key === 'Escape') setEditingPlayerId(null) }} /><button type="button" aria-label={`Save ${player.name} name`} onClick={() => savePlayerName(player.id)}><Icon name="check" size={15} /></button><button type="button" aria-label="Cancel rename" onClick={() => setEditingPlayerId(null)}><Icon name="x" size={15} /></button></> : <><span className="player-chip-name">{player.name}</span><button type="button" aria-label={`Rename ${player.name}`} onClick={() => { setEditingPlayerId(player.id); setEditingPlayerName(player.name) }}><Icon name="edit" size={15} /></button><button type="button" aria-label={`Remove ${player.name}`} onClick={() => removePlayer(player.id)}><Icon name="x" size={15} /></button></>}</div>)}</div>
        <form className="add-player kf-player-form" onSubmit={playerForm.handleSubmit(({ name }) => { if (addPlayer(name)) playerForm.reset() })} noValidate>
          <label className="visually-hidden" htmlFor="kf-new-player">New player name</label>
          <input id="kf-new-player" aria-label="New player name" autoComplete="off" placeholder="Add a player name..." maxLength={24} {...playerForm.register('name')} />
          <button type="submit" className="kf-btn kf-btn-primary" disabled={players.length >= maximumPlayersForGame(game.id)}><Icon name="plus" size={16} /> Add player</button>
          {playerForm.formState.errors.name && <span className="field-error" role="alert">{playerForm.formState.errors.name.message}</span>}
        </form>
        <p className="helper">{game.id === 'imposter' ? '3–20 players · unique names.' : game.id === 'werewolf' || game.id === 'mafia' ? '5–20 players · unique names.' : game.id === 'hot-bomb-duel' ? 'Exactly 2 players.' : `${minimumPlayersForGame(game.id)}–${maximumPlayersForGame(game.id)} players · unique names.`}</p>
      </div>



      {isPlayerModeGame && <section className="setup-config-card" aria-labelledby="player-mode-title">
        <div className="panel-heading"><h3 id="player-mode-title">How should turns work?</h3><span>PLAY MODE</span></div>
        <div className="mode-grid">{MODES.map(item => <button type="button" key={item.id} className={`mode-card${mode === item.id ? ' is-selected' : ''}`} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}><span className="mode-card-icon"><Icon name={item.icon as IconName} size={22} /></span><strong>{item.title}</strong><small>{item.description}</small></button>)}</div>
      </section>}

      {game.id === 'guessup' && <section className="setup-config-card" aria-labelledby="guess-config-title">
        <div className="panel-heading"><h3 id="guess-config-title">Team setup</h3><span>2 TEAMS</span></div>
        <div className="team-name-fields"><label>Team A name<input value={teamAName} maxLength={20} onChange={event => setTeamAName(event.target.value)} /></label><label>Team B name<input value={teamBName} maxLength={20} onChange={event => setTeamBName(event.target.value)} /></label></div>
        <div className="panel-heading assignment-heading"><h4>Assign players</h4><button type="button" className="small-text-button" onClick={() => setTeamAssignments(Object.fromEntries(players.map((player, index) => [player.id, index % 2 === 0 ? 'A' : 'B'])))}>Balance teams</button></div>
        <div className="assignment-list">{players.map(player => <label key={player.id} className="assignment-row"><span>{player.name}</span><select aria-label={`Assign ${player.name}`} value={effectiveTeamAssignments[player.id] ?? 'A'} onChange={event => setTeamAssignments(current => ({ ...current, [player.id]: event.target.value as 'A' | 'B' }))}><option value="A">{teamAName || 'Team A'}</option><option value="B">{teamBName || 'Team B'}</option></select></label>)}</div>
        <label className="duration-setting">Round duration<select value={guessUpPreferences.durationSeconds} onChange={event => updateGuessUpPreferences({ durationSeconds: Number(event.target.value) as GuessUpPreferences['durationSeconds'] })}>{DURATION_OPTIONS.map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label>
        <div className="guess-preferences">
          <ToggleSwitch label="Background music" description="Original synthesized loop · off by default" checked={guessUpPreferences.musicEnabled} onCheckedChange={musicEnabled => updateGuessUpPreferences({ musicEnabled })} />
          <ToggleSwitch label="Sound effects" description="Subtle feedback · off by default" checked={guessUpPreferences.soundEnabled} onCheckedChange={soundEnabled => updateGuessUpPreferences({ soundEnabled })} />
          <ToggleSwitch label="Vibration" description="Short haptic feedback · off by default" checked={guessUpPreferences.vibrationEnabled} onCheckedChange={vibrationEnabled => updateGuessUpPreferences({ vibrationEnabled })} />
          <label className="duration-setting">Input mode<select value={guessUpPreferences.inputMode} onChange={event => updateGuessUpPreferences({ inputMode: event.target.value as GameSetup['inputMode'] })}><option value="touch">Touch buttons</option><option value="tilt">Tilt controls (optional)</option></select></label>
        </div>
        <p className="helper">Touch Correct/Pass buttons always stay available. Tilt requires a separate permission where the browser requests it; unsupported devices fall back to touch. Team names must be non-empty and different.{!balancedTeams ? ' Assign at least one player to each team.' : ''}{!teamNamesValid ? ' Enter two different team names.' : ''}</p>
      </section>}

      {game.id === 'never-have-i-ever' && <section className="setup-config-card" aria-labelledby="response-mode-title">
        <div className="panel-heading"><h3 id="response-mode-title">Response style</h3><span>NEUTRAL BY DEFAULT</span></div>
        <div className="response-methods">{([['fingers', 'Fingers', 'Put a finger down.'], ['points', 'Points', 'Keep a personal score.'], ['stories', 'Stories', 'Share a story or simply pass.']] as const).map(([id, title, description]) => <button type="button" key={id} className={`response-method${responseMethod === id ? ' is-selected' : ''}`} aria-pressed={responseMethod === id} onClick={() => setResponseMethod(id)}><strong>{title}</strong><small>{description}</small></button>)}</div>
        <p className="helper">No drinking, penalty or personal disclosure is required.</p>
      </section>}

        {game.id !== 'imposter' && game.id !== 'guessup' && game.id !== 'truth-or-dare' && game.id !== 'never-have-i-ever' && <section className="setup-config-card arcade-options-card" aria-labelledby="arcade-options-title">
        <div className="panel-heading"><h3 id="arcade-options-title">Game options</h3></div>

        {(game.id === 'tilt-it' || game.id === 'letterburg') && <>
          <label className="duration-setting">Play style<select value={arcadeOptions.playStyle === 'solo' ? 'solo' : 'teams'} onChange={event => setArcadeOptions(current => ({ ...current, playStyle: event.target.value as ArcadeSetupOptions['playStyle'] }))}><option value="teams">Two teams · scoreboard</option><option value="solo">Solo / everyone takes a turn</option></select></label>
          <label className="duration-setting">Round length<select value={arcadeOptions.durationSeconds} onChange={event => setArcadeOptions(current => ({ ...current, durationSeconds: Number(event.target.value) as ArcadeSetupOptions['durationSeconds'] }))}>{DURATION_OPTIONS.map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label>
        </>}
        {(game.id === 'werewolf' || game.id === 'mafia') && <>
          <label className="duration-setting">Hidden-team size<select value={arcadeOptions.roleCount} onChange={event => setArcadeOptions(current => ({ ...current, roleCount: Number(event.target.value) as ArcadeSetupOptions['roleCount'] }))}>{[1, 2, 3].filter(value => value <= Math.max(1, Math.floor((players.length - 1) / 3))).map(value => <option key={value} value={value}>{value} {value === 1 ? 'member' : 'members'}</option>)}</select></label>
          <ToggleSwitch label="Phone as narrator" description="The phone guides private role, night and day phases; no human moderator needed." checked={arcadeOptions.phoneNarrator} onCheckedChange={phoneNarrator => setArcadeOptions(current => ({ ...current, phoneNarrator }))} />
        </>}
        {(game.id === 'hot-bomb' || game.id === 'hot-bomb-duel') && <label className="duration-setting">Fuse length<select value={arcadeOptions.fuseSeconds} onChange={event => setArcadeOptions(current => ({ ...current, fuseSeconds: Number(event.target.value) as ArcadeSetupOptions['fuseSeconds'] }))}>{[8, 10, 12, 15].map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label>}
        {game.id === 'challenge-20' && <ToggleSwitch label="Anti-items filter" description="Automatically remove low-value lots (rated below 3) without spending budget." checked={arcadeOptions.antiItemsMode} onCheckedChange={antiItemsMode => setArcadeOptions(current => ({ ...current, antiItemsMode }))} />}

        {game.id === 'wrong-answers-only' && <ToggleSwitch label="Read questions aloud" description="Uses the browser's built-in speech synthesis when available." checked={arcadeOptions.readPromptsAloud} onCheckedChange={readPromptsAloud => setArcadeOptions(current => ({ ...current, readPromptsAloud }))} />}
        {game.id === 'reverse-singing' && <label className="duration-setting">Play style<select value={arcadeOptions.playStyle === 'battle' ? 'battle' : 'classic'} onChange={event => setArcadeOptions(current => ({ ...current, playStyle: event.target.value as ArcadeSetupOptions['playStyle'] }))}><option value="classic">Classic · imitate the reversed sound</option><option value="battle">Battle · first correct guess scores</option></select></label>}
        {game.id === 'timer-impostor' && <p className="helper">Everyone except the hidden impostor receives the same secret target time. Players take individual silent-counting attempts before the group votes.</p>}
        {game.id === 'share-or-pass' && <p className="helper">Passing never costs points or requires alcohol. Players can skip any prompt without explaining why.</p>}
        {game.id === 'fake-it' && <p className="helper">One player receives a secret word. The group sees its category, asks yes/no questions, then each other player gets one private guess.</p>}
      </section>}

      {game.id === 'imposter' && <section className="setup-config-card" aria-labelledby="imposter-rules-title">
        <div className="panel-heading"><h3 id="imposter-rules-title">Mystery Who rules</h3></div>

        <label className="duration-setting">Game mode<select value={imposterMode} onChange={event => setImposterMode(event.target.value as typeof imposterMode)}><option value="classic">Classic — Civilians & Mystics</option><option value="mystics">Mystics — includes Mr. White</option><option value="chaos">Chaos — randomized roles</option></select></label>
        {imposterMode !== 'chaos' && <label className="duration-setting">Ordinary Mystics<select value={Math.min(mysticCountSetting, maxMystics)} onChange={event => setMysticCountSetting(Number(event.target.value))}>{Array.from({length: Math.max(1, maxMystics)}, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} {n === 1 ? 'Mystic' : 'Mystics'}</option>)}</select></label>}
        <ToggleSwitch label="Mystic hints" description="Give Mystics indirect clues, never the secret word." checked={mysticHintsEnabled} onCheckedChange={setMysticHintsEnabled} />
        {mysticHintsEnabled && <ToggleSwitch label="Same hint for every Mystic" description="Otherwise distribute different hints." checked={sameMysticHint} onCheckedChange={setSameMysticHint} />}
        <ToggleSwitch label="Discussion timer" description="Timer applies only to discussion." checked={discussionTimerEnabled} onCheckedChange={setDiscussionTimerEnabled} />
        {discussionTimerEnabled && <label className="duration-setting">Discussion duration<select value={discussionSeconds} onChange={event => setDiscussionSeconds(Number(event.target.value))}>{Array.from({length: 40}, (_, i) => (i + 1) * 15).map(n => <option key={n} value={n}>{Math.floor(n / 60)}:{String(n % 60).padStart(2, '0')}</option>)}</select></label>}
        <ToggleSwitch label="Voting" description="Disable to reveal the round results after discussion." checked={votingEnabled} onCheckedChange={setVotingEnabled} />
        {votingEnabled && <ToggleSwitch label="Hide voter names in results" description="Only aggregate vote counts are shown." checked={hiddenVoter} onCheckedChange={setHiddenVoter} />}
        <p className="helper">{players.length} players · up to {maxMystics} ordinary Mystics. Chaos selects one to three Mystics and has a 45% Mr. White chance when at least four players are present.</p>

      </section>}

      {!RULE_ONLY_GAMES.has(game.id) && <section className="setup-config-card pack-browser" aria-labelledby="pack-browser-title">
        <div className="panel-heading"><h3 id="pack-browser-title">{game.id === 'guessup' ? 'Browse decks' : game.id === 'imposter' ? 'Choose a word category' : 'Choose prompt packs'}</h3><span>{validSelectedPackIds.length} SELECTED</span></div>
        {game.id === 'guessup' && <div className="deck-filter-row" role="group" aria-label="Filter decks">{([['all', 'All'], ['packs', 'Packs'], ['featured', 'Featured'], ['all-ages', 'All ages']] as const).map(([id, label]) => <button type="button" key={id} className={deckFilter === id ? 'is-active' : ''} aria-pressed={deckFilter === id} onClick={() => setDeckFilter(id)}>{label}</button>)}</div>}
        <div className="suitability-filter-row" role="group" aria-label="Filter content suitability">{([['all', 'All suitability'], ['general', 'All ages'], ...(adultMode ? [['teen', 'Teen'], ['adult', '18+']] as const : [])] as const).map(([id, label]) => <button type="button" key={id} className={suitabilityFilter === id ? 'is-active' : ''} aria-pressed={suitabilityFilter === id} onClick={() => setSuitabilityFilter(id)}>{label}</button>)}</div>
        <div ref={packListRef} className="pack-list">{visiblePacks.map(pack => {
          const count = contentCount(pack)
          const selected = validSelectedPackIds.includes(pack.id)
          return <article className={`pack-choice${selected ? ' is-selected' : ''}`} key={pack.id}>
            <button type="button" className="pack-select" aria-pressed={selected} onClick={() => setSelectedPackIds(current => {
              const existing = current.filter(id => availablePacks.some(packItem => packItem.id === id))
              return selected ? existing.filter(id => id !== pack.id) : [...new Set([...existing, pack.id])]
            })}>
              <span className="pack-select-mark">{selected ? <Icon name="check" size={15} /> : <Icon name="plus" size={15} />}</span><span className="pack-main"><strong><Icon name="dice" size={15} /> {pack.name}</strong><span className="pack-meta">{count} prompts · {pack.suitability === 'general' ? 'ALL AGES' : pack.suitability.toUpperCase()}</span></span>
            </button>
            {!pack.isDefault && <div className="pack-manage"><button type="button" onClick={() => openEditPack(pack)}>Edit</button><button type="button" onClick={() => deleteCustomPack(String(pack.id))}>Delete</button></div>}
          </article>
        })}</div>
        {apiCategoryOpen && !RULE_ONLY_GAMES.has(game.id) && <div className="api-category-maker" role="region" aria-label="Create category with API">
          <p className="helper">API-only category maker: enter a title and short description. Content will be generated during play when this category is selected.</p>
          <label>Category title<input value={apiTitle} maxLength={80} onChange={event => setApiTitle(event.target.value)} placeholder={game.id === 'imposter' ? 'e.g. Ocean life' : 'e.g. Road trip chaos'} /></label>
          <label>Short description<textarea value={apiDescription} rows={2} maxLength={180} onChange={event => setApiDescription(event.target.value)} placeholder="What this category should contain" /></label>
          <div className="editor-actions">
            <button type="button" className="setting-action" disabled={apiBusy || !apiTitle.trim() || !apiDescription.trim()} onClick={() => void (async () => {
              setApiBusy(true); setApiError(''); setApiOutput([])
              try {
                const saved = await saveCustomPack({
                  gameId: game.id, name: apiTitle.trim(), emoji: '✨', description: apiDescription.trim(),
                  kind: KIND_BY_GAME[game.id], suitability: adultMode ? 'adult' : 'general', entries: [], apiOnly: true,
                })
                if (!saved) throw new Error('The category could not be saved.')
                setSelectedPackIds(current => [...new Set([...current, saved.id])])
                setApiError('Category saved. Its content will be generated during play.')
                setApiTitle(''); setApiDescription('')
              } catch (error) {
                setApiError(error instanceof Error ? error.message : 'Generation failed.')
              } finally { setApiBusy(false) }
            })()}>{apiBusy ? 'Saving…' : 'Save category'}</button>
          </div>
          {apiError && <p role="status">{apiError}</p>}
          {apiOutput.length > 0 && <ul className="ai-generated-list" aria-label="Generated category preview">{apiOutput.slice(0, 8).map((line, index) => <li key={`${index}:${line.slice(0, 24)}`}><strong>{line}</strong></li>)}</ul>}
        </div>}
        <div className="pack-browser-actions"><button type="button" className="add-custom-pack kf-btn kf-btn-primary" onClick={openNewPack}><Icon name="plus" size={15} /> Create {game.id === 'imposter' ? 'category' : 'pack'}</button>{!RULE_ONLY_GAMES.has(game.id) && <button type="button" className="kf-btn kf-btn-secondary" onClick={() => { setApiCategoryOpen(value => !value); setApiError(''); setApiOutput([]) }}><Icon name="wand-sparkles" size={15} /> Make category with API</button>}{game.id === 'imposter' && <><label className="duration-setting">Pack to export<select value={exportPack?.id ?? ''} onChange={event => setExportPackId(event.target.value)}>{selectedPacks.map(pack => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select></label><div {...packDropzone.getRootProps({ className: `pack-import-dropzone ${packDropzone.isDragActive ? 'is-dragging' : ''}` })}>

          <input {...packDropzone.getInputProps()} aria-label="Import Imposter pack JSON or TXT" />
          <Icon name="upload" size={17} /><span>{packDropzone.isDragActive ? 'Drop pack to import' : 'Import JSON / TXT'}</span><small>Drop a file or browse</small>
        </div><button type="button" disabled={!selectedPacks.length} onClick={() => exportSelectedPack('json')}>Export JSON</button><button type="button" disabled={!selectedPacks.length} onClick={() => exportSelectedPack('txt')}>Export TXT</button></>}<button type="button" className="pack-history-reset kf-btn kf-btn-outline" onClick={resetRecentContent}>Reset recent content history</button></div>
      </section>}
    </div>
    <aside className={`setup-aside ${game.color} kf-span-5`}><span className="aside-icon"><GameMark game={game.id} size={38} /></span><h2>{game.name}</h2>
      <div className="setup-aside-summary"><span>{players.length} players</span><span>{RULE_ONLY_GAMES.has(game.id) ? 'Built-in rules' : `${validSelectedPackIds.length} ${validSelectedPackIds.length === 1 ? 'pack' : 'packs'}`}</span>{game.id === 'guessup' && <span>{guessUpPreferences.durationSeconds}s turns</span>}{isPlayerModeGame && <span>{MODES.find(item => item.id === mode)?.title}</span>}</div>
      <button type="button" className="primary dark-primary" disabled={!canStart} onClick={submitSetup}>Start game <Icon name="arrow-up-right" size={17} /></button>
    </aside></div>
    <div className="setup-mobile-action"><button className="primary" disabled={!canStart} onClick={submitSetup}>Start game <Icon name="arrow-up-right" size={17} /></button><small>{!enoughPlayers ? `Use ${minimumPlayersForGame(game.id)}–${maximumPlayersForGame(game.id)} players`  : !allSelectedPacksExist || !hasGameContent ? 'Select packs with playable content' : game.id === 'guessup' && !balancedTeams ? 'Assign players to both teams' : game.id === 'guessup' && !teamNamesValid ? 'Use two different team names' : 'Ready to start'}</small></div>

    <dialog ref={packDialogRef} className="custom-pack-editor" aria-labelledby="custom-pack-title" onCancel={event => { event.preventDefault(); setPackEditorOpen(false) }} onClick={event => { if (event.target === event.currentTarget) setPackEditorOpen(false) }}>

        <div className="panel-heading"><h3 id="custom-pack-title">{editingPackId ? 'Edit pack' : 'Create pack'}</h3><button type="button" aria-label="Close editor" onClick={() => setPackEditorOpen(false)}><Icon name="x" size={17} /></button></div>

        <p className="helper">{game.id === 'imposter' ? 'One secret word per line, followed by 1–20 indirect Mystic hints: Word | Hint 1 | Hint 2.' : game.id === 'fake-it' ? 'One broad category or clue and its secret word per line: Category | Secret word.' : game.id === 'fact-or-fiction' ? 'One statement and its factual verdict per line: Statement | true (or false).' : game.id === 'would-you-rather' || game.id === 'a-or-b' ? 'One prompt per line. Separate both choices with ||, e.g. Beach holiday || Mountain cabin.' : 'One prompt, category, question or word per line.'}</p>

        <label>Pack name<input value={packName} maxLength={80} onChange={event => setPackName(event.target.value)} placeholder="e.g. Campus Chaos" /></label>
        <label>Description<input value={packDescription} maxLength={240} onChange={event => setPackDescription(event.target.value)} /></label>
        <label>Content suitability<select value={packSuitability} onChange={event => setPackSuitability(event.target.value as 'general' | 'teen' | 'adult')}><option value="general">All ages</option>{adultMode && <><option value="teen">Teen</option><option value="adult">18+ only</option></>}</select></label>
        {game.id === 'truth-or-dare' && <label>Prompt type<select value={packKind} onChange={event => setPackKind(event.target.value as ContentKind)}><option value="truth">Truth prompts</option><option value="dare">Dare prompts</option></select></label>}
        <label>{game.id === 'imposter' ? 'Secret words and Mystic hints' : 'Prompts'}<textarea value={packEntries} rows={8} maxLength={24000} onChange={event => setPackEntries(event.target.value)} placeholder={game.id === 'imposter' ? 'Coffee | Hot | Morning\nLighthouse | Coast | Beacon\nSkateboard | Wheels | Tricks' : game.id === 'fake-it' ? 'A planet in our solar system | Jupiter\nAn ocean on Earth | Pacific Ocean' : game.id === 'fact-or-fiction' ? 'Octopuses have three hearts. | true\nThe Moon makes its own light. | false' : game.id === 'would-you-rather' || game.id === 'a-or-b' ? 'Beach holiday || Mountain cabin\nTrain journey || Road trip' : 'One prompt per line…'} /></label>
        <small>{packEntries.split(/\r?\n/).filter(line => line.trim()).length} lines · maximum 100 {game.id === 'imposter' ? 'words' : 'prompts'}</small>
        {game.id === 'imposter' && <p className="helper">Each line needs one unique secret word and 1–20 non-empty hints separated by |. Hints are private to Mystics and must not contain the answer. Packs with fewer than 11 words can exhaust the last-10 no-repeat window quickly.</p>}
        {packError && <p className="form-error" role="alert">{packError}</p>}
        <div className="editor-actions"><button type="button" className="text-button" onClick={() => setPackEditorOpen(false)}>Cancel</button><button type="button" className="primary" disabled={savingPack} onClick={() => void savePack()}>{savingPack ? 'Saving…' : editingPackId ? 'Save changes' : 'Save pack'}</button></div>
    </dialog>
  </section>
}
