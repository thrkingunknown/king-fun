export type Game =
  | 'imposter' | 'guessup' | 'truth-or-dare' | 'never-have-i-ever'
  | 'timer-impostor' | 'werewolf' | 'mafia' | 'murder'
  | 'fake-it' | 'fake-story' | 'fact-or-fiction' | 'wrong-answers-only'
  | 'hot-bomb' | 'hot-bomb-duel' | 'whos-most-likely' | 'would-you-rather'
  | 'share-or-pass' | 'challenge-20' | 'tilt-it' | 'letterburg'
  | 'discussion-starter' | 'who-am-i' | 'ten-tangle'
  | 'qupid' | 'questions-for-love' | 'a-or-b' | 'reverse-singing'
export type Player = { id: string; name: string }
export type PromptReportReason = 'unsafe' | 'spelling' | 'category' | 'not-a-prompt'
export type PromptReportRecord = { contentId: string | null; reason: PromptReportReason; note: string; at: number }
export type HistoryItem = { id: string; game: Game; title: string; detail: string; at: number; reports?: PromptReportRecord[] }
export type ActiveGame = { game: Game; phase: string; data: Record<string, any> }
export type PlayerMode = 'all-together' | 'spin-wheel' | 'one-at-a-time'
export type ResponseMethod = 'fingers' | 'points' | 'stories'
export type GuessUpPreferences = { durationSeconds: 30 | 45 | 60 | 90 | 120; soundEnabled: boolean; musicEnabled: boolean; vibrationEnabled: boolean; inputMode: 'touch' | 'tilt' }
export type ArcadeSetupOptions = {
  readonly playStyle: 'classic' | 'teams' | 'solo' | 'battle'
  readonly durationSeconds: 30 | 45 | 60 | 90 | 120
  readonly roleCount: 1 | 2 | 3
  readonly phoneNarrator: boolean
  readonly antiItemsMode: boolean
  readonly readPromptsAloud: boolean
  readonly fuseSeconds: 8 | 10 | 12 | 15
}
export type SetupPackDraft = {
  gameId: Game
  categoryId?: string
  name: string
  emoji: string
  description: string
  suitability: 'general' | 'teen' | 'adult'
  kind: 'word' | 'phrase' | 'truth' | 'dare' | 'never-have-i-ever' | 'party-prompt'
  entries: string[]
  apiOnly?: boolean
}
export type ImposterSetup = { mode: 'classic' | 'mystics' | 'chaos'; mysticCount: number; mysticHintsEnabled: boolean; sameMysticHint: boolean; discussionTimerEnabled: boolean; discussionSeconds: number; votingEnabled: boolean; hiddenVoter: boolean }
export type GameSetup = {
  imposter?: ImposterSetup
  packIds: string[]
  mode: PlayerMode
  durationSeconds: 30 | 45 | 60 | 90 | 120
  teamAName: string
  teamBName: string
  teamAssignments: Record<string, 'A' | 'B'>
  responseMethod: ResponseMethod
  soundEnabled: boolean
  musicEnabled: boolean
  vibrationEnabled: boolean
  inputMode: 'touch' | 'tilt'
  arcade?: ArcadeSetupOptions
}
export type MotionPreference = 'system' | 'reduce'
export type Save = {
  players: Player[]
  recent: Record<string, string[]>
  history: HistoryItem[]
  theme: 'dark' | 'light'
  adultMode: boolean
  motionPreference?: MotionPreference
  active: ActiveGame | null
  selectedPackIdsByGame?: Partial<Record<Game, string[]>>
  guessUpPreferences?: GuessUpPreferences
  imposterPreferences?: ImposterSetup
}
export type GameDefinition = {
  id: Game
  name: string
  tagline: string
  icon: string
  color: string
  description: string
}
export const INITIAL_SAVE: Save = {
  players: [
    { id: 'p1', name: 'Alex' },
    { id: 'p2', name: 'Sam' },
    { id: 'p3', name: 'Jamie' },
  ],
  recent: {},
  history: [],
  theme: 'dark',
  adultMode: false,
  motionPreference: 'system',
  active: null,
  selectedPackIdsByGame: {},
  guessUpPreferences: { durationSeconds: 60, soundEnabled: false, musicEnabled: false, vibrationEnabled: false, inputMode: 'touch' },
  imposterPreferences: { mode: 'classic', mysticCount: 1, mysticHintsEnabled: true, sameMysticHint: false, discussionTimerEnabled: false, discussionSeconds: 180, votingEnabled: true, hiddenVoter: true },
}
export const GAMES: GameDefinition[] = [
  { id: 'imposter', name: 'Imposter', tagline: 'Blend in. Find the faker.', icon: '◈', color: 'violet', description: 'A secret word, hidden roles and one very suspicious room.' },
  { id: 'guessup', name: 'GuessUp', tagline: 'Act it. Guess it. Score it.', icon: '✳', color: 'orange', description: 'Headband-style charades against the clock.' },
  { id: 'truth-or-dare', name: 'Truth or Dare', tagline: 'Spin into the unexpected.', icon: '✺', color: 'pink', description: 'Pick a pack, choose a player mode, then let the prompt decide.' },
  { id: 'never-have-i-ever', name: 'I Have Never', tagline: 'The stories come out.', icon: '☻', color: 'mint', description: 'Pick a pack and play together, around the wheel, or one by one.' },
  { id: 'timer-impostor', name: 'Timer Impostor', tagline: 'One knows the time. One does not.', icon: '◷', color: 'violet', description: 'Count in your head, stop the clock and spot the bluff.' },
  { id: 'werewolf', name: 'Werewolf', tagline: 'Survive the night. Find the pack.', icon: '☾', color: 'mint', description: 'A narrated night-and-day social deduction game.' },
  { id: 'mafia', name: 'Mafia', tagline: 'Trust is a limited resource.', icon: '♟', color: 'violet', description: 'A classic hidden-team game with a local narrator option.' },
  { id: 'murder', name: 'Murder', tagline: 'Watch closely. Trust nobody.', icon: '⌁', color: 'pink', description: 'One secret murderer, silent winks and a final accusation.' },
  { id: 'fake-it', name: 'Fake It', tagline: 'Ask yes/no. Find the word.', icon: '◇', color: 'orange', description: 'One player knows the secret word; the group questions and guesses.' },
  { id: 'fake-story', name: 'Fake Story', tagline: 'One story is made up.', icon: '▤', color: 'orange', description: 'Tell a true story—or convincingly invent one.' },
  { id: 'fact-or-fiction', name: 'Fact or Fiction', tagline: 'Someone is bending the truth.', icon: '≋', color: 'violet', description: 'Read the statement, give your answer and find the liar.' },
  { id: 'wrong-answers-only', name: 'Wrong Answers Only', tagline: 'The right answer is forbidden.', icon: '↯', color: 'pink', description: 'Quick-fire questions where only wrong answers count.' },
  { id: 'hot-bomb', name: 'Hot Bomb', tagline: 'Name it. Pass it. Fast.', icon: '◉', color: 'orange', description: 'Name something in the category before the fuse runs out.' },
  { id: 'hot-bomb-duel', name: 'Hot Bomb Duel', tagline: 'Two players. One ticking fuse.', icon: '◉', color: 'pink', description: 'A face-to-face two-player Hot Bomb match.' },
  { id: 'whos-most-likely', name: "Who's Most Likely", tagline: 'The room has an opinion.', icon: '◎', color: 'mint', description: 'Vote for the person who best fits the prompt.' },
  { id: 'would-you-rather', name: 'Would You Rather', tagline: 'Pick a side. Own the choice.', icon: '⇄', color: 'pink', description: 'Choose between two scenarios and compare the room.' },
  { id: 'share-or-pass', name: 'Share or Pass', tagline: 'Share a thought—or skip.', icon: '▱', color: 'mint', description: 'A pressure-free alternative to drinking-based forfeits.' },
  { id: 'challenge-20', name: '$20 Challenge', tagline: 'Ten lots. Twenty dollars. One build.', icon: '$', color: 'orange', description: 'Bid on ten themed items and build your winning concept.' },
  { id: 'tilt-it', name: 'Tilt It', tagline: 'Head up. Clues on. Tilt to score.', icon: '⌃', color: 'mint', description: 'Guess the word on the screen with optional motion controls.' },
  { id: 'letterburg', name: 'Letterburg', tagline: 'A word game for younger players.', icon: 'A', color: 'mint', description: 'Family-friendly headband guessing with simple word packs.' },
  { id: 'discussion-starter', name: 'Discussion Starter', tagline: 'Better questions. Better conversations.', icon: '☷', color: 'violet', description: 'A thoughtful prompt-card game for groups.' },
  { id: 'who-am-i', name: 'Who Am I?', tagline: 'Ask yes or no. Find your identity.', icon: '?', color: 'violet', description: 'A forehead identity game with the name visible to everyone else.' },
  { id: 'ten-tangle', name: 'Ten Tangle', tagline: 'Ten words. One scrambled set.', icon: '⌘', color: 'orange', description: 'Unscramble ten words before the group gives up.' },
  { id: 'qupid', name: 'Qupid', tagline: 'Make room for meaningful answers.', icon: '♡', color: 'pink', description: 'A couples conversation deck for connection and discovery.' },
  { id: 'questions-for-love', name: 'Questions for Love', tagline: 'Go a little deeper.', icon: '♡', color: 'pink', description: 'Relationship prompts for thoughtful two-person conversations.' },
  { id: 'a-or-b', name: 'A or B', tagline: 'This or that. No overthinking.', icon: 'A/B', color: 'mint', description: 'Choose a preference, then see whether your partner guessed it.' },
  { id: 'reverse-singing', name: 'Reverse Singing', tagline: 'Hear it backwards. Sing it forwards.', icon: '♫', color: 'orange', description: 'Record a short line, hear the reversed clip and recreate it.' },
]


const VALID_GAMES = new Set<Game>(['imposter', 'guessup', 'truth-or-dare', 'never-have-i-ever', 'timer-impostor', 'werewolf', 'mafia', 'murder', 'fake-it', 'fake-story', 'fact-or-fiction', 'wrong-answers-only', 'hot-bomb', 'hot-bomb-duel', 'whos-most-likely', 'would-you-rather', 'share-or-pass', 'challenge-20', 'tilt-it', 'letterburg', 'discussion-starter', 'who-am-i', 'ten-tangle', 'qupid', 'questions-for-love', 'a-or-b', 'reverse-singing'])
const GUESS_DURATIONS = new Set<GuessUpPreferences['durationSeconds']>([30, 45, 60, 90, 120])

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Read a round-owned roster without silently substituting a later global roster. */
export function resolveGameRoster(input: unknown, fallback: readonly Player[]): Player[] {
  if (!Array.isArray(input)) return [...fallback]
  const result: Player[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const candidate of input.slice(0, 32)) {
    if (!isPlainRecord(candidate)) continue
    const id = typeof candidate.id === 'string' ? candidate.id.trim().slice(0, 100) : ''
    const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 40) : ''
    const nameKey = name.normalize('NFKC').toLocaleLowerCase()
    if (!id || !name || ids.has(id) || names.has(nameKey)) continue
    ids.add(id)
    names.add(nameKey)
    result.push({ id, name })
  }
  return result
}

const PROMPT_REPORT_REASONS = new Set<PromptReportReason>(['unsafe', 'spelling', 'category', 'not-a-prompt'])

/** Keep only bounded, non-identifying prompt reports in the local game archive. */
export function normalizePromptReports(input: unknown): PromptReportRecord[] {
  if (!Array.isArray(input)) return []
  const reports: PromptReportRecord[] = []
  for (const candidate of input.slice(-50)) {
    if (!isPlainRecord(candidate) || !PROMPT_REPORT_REASONS.has(candidate.reason as PromptReportReason)) continue
    const contentId = candidate.contentId === null
      ? null
      : typeof candidate.contentId === 'string' && candidate.contentId.length <= 180
        ? candidate.contentId
        : null
    if (candidate.contentId !== null && contentId === null) continue
    if (typeof candidate.note !== 'string' || typeof candidate.at !== 'number'
      || !Number.isSafeInteger(candidate.at) || candidate.at <= 0 || candidate.at > Date.now() + 5 * 60_000) continue
    reports.push({
      contentId,
      reason: candidate.reason as PromptReportReason,
      note: candidate.note.trim().slice(0, 240),
      at: candidate.at,
    })
  }
  return reports
}

function isBoundedJson(value: unknown, depth = 0, budget = { nodes: 0 }): boolean {
  budget.nodes += 1
  if (budget.nodes > 8_000 || depth > 12) return false
  if (value === null || typeof value === 'boolean') return true
  if (typeof value === 'string') return value.length <= 20_000
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length <= 1_000 && value.every(item => isBoundedJson(item, depth + 1, budget))
  if (!isPlainRecord(value)) return false
  const entries = Object.entries(value)
  return entries.length <= 120 && entries.every(([key, item]) =>
    key.length <= 100 && !['__proto__', 'prototype', 'constructor'].includes(key) && isBoundedJson(item, depth + 1, budget),
  )
}

/** Normalize untrusted persisted/imported application state without discarding valid unrelated fields. */
/** Imports never carry an adult-mode opt-in to a new device. The local owner
 * must explicitly confirm the 18+ audience again before adult content appears. */
export function normalizeImportedSave(input: unknown): Save {
  const normalized = normalizeSave(input)
  return {
    ...normalized,
    adultMode: false,
    active: normalized.active?.data.adultMode === true ? null : normalized.active,
  }
}

export function normalizeSave(input: unknown): Save {
  const source = isPlainRecord(input) ? input : {}
  const defaultSave = INITIAL_SAVE

  const playersInput = Array.isArray(source.players) ? source.players : defaultSave.players
  const players: Player[] = []
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const candidate of playersInput.slice(0, 32)) {
    if (!isPlainRecord(candidate)) continue
    const id = typeof candidate.id === 'string' ? candidate.id.trim().slice(0, 100) : ''
    const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 40) : ''
    const nameKey = name.normalize('NFKC').toLocaleLowerCase()
    if (!id || !name || ids.has(id) || names.has(nameKey)) continue
    ids.add(id)
    names.add(nameKey)
    players.push({ id, name })
  }

  const recent: Record<string, string[]> = {}
  if (isPlainRecord(source.recent)) {
    for (const [key, value] of Object.entries(source.recent).slice(0, 250)) {
      if (key.length > 180 || !Array.isArray(value)) continue
      const idsForQueue = [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 180))]
      recent[key] = idsForQueue.slice(-100)
    }
  }

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const history: HistoryItem[] = []
  if (Array.isArray(source.history)) {
    for (const candidate of source.history) {
      if (history.length >= 100) break
      if (!isPlainRecord(candidate)) continue
      const { id, game, title, detail, at } = candidate
      if (typeof id !== 'string' || !id || id.length > 100 || !VALID_GAMES.has(game as Game)
        || typeof title !== 'string' || !title.trim() || title.length > 160
        || typeof detail !== 'string' || detail.length > 1_000
        || typeof at !== 'number' || !Number.isSafeInteger(at) || at < cutoff || at > Date.now() + 5 * 60_000) continue
      const reports = normalizePromptReports(candidate.reports)
      history.push({ id, game: game as Game, title: title.slice(0, 160), detail: detail.slice(0, 1_000), at, ...(reports.length ? { reports } : {}) })
    }
  }

  const activeCandidate = source.active
  let active: ActiveGame | null = null
  if (isPlainRecord(activeCandidate) && VALID_GAMES.has(activeCandidate.game as Game)
    && typeof activeCandidate.phase === 'string' && activeCandidate.phase.length > 0 && activeCandidate.phase.length <= 64
    && isPlainRecord(activeCandidate.data) && isBoundedJson(activeCandidate.data)) {
    if (activeCandidate.data.adultMode !== true || source.adultMode === true) {
      active = { game: activeCandidate.game as Game, phase: activeCandidate.phase, data: activeCandidate.data as Record<string, any> }
    }
  }

  const guessSource = isPlainRecord(source.guessUpPreferences) ? source.guessUpPreferences : {}
  const defaultGuess = defaultSave.guessUpPreferences!
  const duration = GUESS_DURATIONS.has(guessSource.durationSeconds as GuessUpPreferences['durationSeconds'])
    ? guessSource.durationSeconds as GuessUpPreferences['durationSeconds'] : defaultGuess.durationSeconds
  const inputMode = guessSource.inputMode === 'tilt' ? 'tilt' : 'touch'
  const guessUpPreferences: GuessUpPreferences = {
    durationSeconds: duration,
    soundEnabled: guessSource.soundEnabled === true,
    musicEnabled: guessSource.musicEnabled === true,
    vibrationEnabled: guessSource.vibrationEnabled === true,
    inputMode,
  }

  const imposterSource = isPlainRecord(source.imposterPreferences) ? source.imposterPreferences : {}
  const defaultImposter = defaultSave.imposterPreferences!
  const imposterMode = imposterSource.mode === 'mystics' || imposterSource.mode === 'chaos' ? imposterSource.mode : 'classic'
  const rawMysticCount = typeof imposterSource.mysticCount === 'number' && Number.isFinite(imposterSource.mysticCount) ? Math.round(imposterSource.mysticCount) : defaultImposter.mysticCount
  const rawDiscussionSeconds = typeof imposterSource.discussionSeconds === 'number' && Number.isFinite(imposterSource.discussionSeconds) ? Math.round(imposterSource.discussionSeconds / 15) * 15 : defaultImposter.discussionSeconds
  const imposterPreferences: ImposterSetup = {
    mode: imposterMode,
    mysticCount: Math.max(1, Math.min(4, rawMysticCount)),
    mysticHintsEnabled: imposterSource.mysticHintsEnabled !== false,
    sameMysticHint: imposterSource.sameMysticHint === true,
    discussionTimerEnabled: imposterSource.discussionTimerEnabled === true,
    discussionSeconds: Math.max(15, Math.min(600, rawDiscussionSeconds)),
    votingEnabled: imposterSource.votingEnabled !== false,
    hiddenVoter: imposterSource.hiddenVoter !== false,
  }

  const selectedPackIdsByGame: Partial<Record<Game, string[]>> = {}
  if (isPlainRecord(source.selectedPackIdsByGame)) {
    for (const [game, ids] of Object.entries(source.selectedPackIdsByGame)) {
      if (!VALID_GAMES.has(game as Game) || !Array.isArray(ids)) continue
      const validIds = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 180))].slice(0, 40)
      if (validIds.length) selectedPackIdsByGame[game as Game] = validIds
    }
  }

  return {
    players,
    recent,
    history,
    theme: source.theme === 'light' ? 'light' : 'dark',
    adultMode: source.adultMode === true,
    motionPreference: source.motionPreference === 'reduce' ? 'reduce' : 'system',
    active,
    selectedPackIdsByGame,
    guessUpPreferences,
    imposterPreferences,
  }
}
