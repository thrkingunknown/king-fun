import type { Player, ArcadeSetupOptions, Game } from '../../types.ts'
import { secureRandomInteger, secureShuffle } from '../random/secure-random.ts'

export type PartyArcadeGame = Exclude<Game,
  | 'imposter' | 'guessup' | 'truth-or-dare' | 'never-have-i-ever'
>
export interface ArcadeContent {
  readonly id: string
  readonly text: string
  readonly hints?: readonly string[]
}
export interface ArcadeSession {
  readonly phase: string
  readonly data: Record<string, any>
}

const FUSE_CHOICES = [8, 10, 12, 15] as const

const CHALLENGE_MARKETS: Record<string, Array<{ label: string; value: number }>> = {
  'theme-1': [
    { label: 'Weatherproof black sails', value: 4 }, { label: 'A seasoned navigator', value: 4 },
    { label: 'Reinforced hull plating', value: 4 }, { label: 'A concealed treasure vault', value: 3 },
    { label: 'A fast escape skiff', value: 3 }, { label: 'A reliable compass', value: 3 },
    { label: 'A shipboard cook', value: 3 }, { label: 'A parrot lookout', value: 2 },
    { label: 'A dramatic figurehead', value: 2 }, { label: 'A legendary treasure map', value: 4 },
  ],
  'theme-2': [
    { label: 'A reference-grade projector', value: 4 }, { label: 'A room-filling surround system', value: 4 },
    { label: 'A giant acoustic screen', value: 4 }, { label: 'A reclining cinema sofa', value: 3 },
    { label: 'Blackout curtains', value: 3 }, { label: 'A film-library server', value: 3 },
    { label: 'A popcorn machine', value: 2 }, { label: 'Acoustic wall panels', value: 3 },
    { label: 'A universal remote', value: 2 }, { label: 'A neon cinema sign', value: 2 },
  ],
  'theme-3': [
    { label: 'A dependable touring car', value: 4 }, { label: 'A route planner', value: 3 },
    { label: 'A premium cooler', value: 3 }, { label: 'A portable power station', value: 4 },
    { label: 'A roadside repair kit', value: 3 }, { label: 'A roof cargo box', value: 3 },
    { label: 'A shared road-trip playlist', value: 2 }, { label: 'A two-person tent', value: 3 },
    { label: 'A dash camera', value: 2 }, { label: 'A scenic detour pass', value: 2 },
  ],
  'theme-4': [
    { label: 'A chef-built picnic basket', value: 4 }, { label: 'A shady riverside spot', value: 3 },
    { label: 'A large insulated blanket', value: 2 }, { label: 'A portable coffee kit', value: 3 },
    { label: 'Fresh seasonal fruit', value: 3 }, { label: 'A compact shade canopy', value: 3 },
    { label: 'A portable speaker', value: 2 }, { label: 'A complete tableware set', value: 2 },
    { label: 'A chilled dessert box', value: 3 }, { label: 'A perfect sunset view', value: 4 },
  ],
  'theme-5': [
    { label: 'An elite striker', value: 4 }, { label: 'A world-class goalkeeper', value: 4 },
    { label: 'A creative playmaker', value: 4 }, { label: 'A commanding defender', value: 3 },
    { label: 'A tireless midfielder', value: 3 }, { label: 'A reliable captain', value: 3 },
    { label: 'A versatile substitute', value: 2 }, { label: 'A set-piece specialist', value: 3 },
    { label: 'A tactical coach', value: 4 }, { label: 'A devoted home crowd', value: 2 },
  ],
  'theme-6': [
    { label: 'A powerful workstation', value: 4 }, { label: 'A colour-accurate monitor', value: 3 },
    { label: 'An ergonomic chair', value: 4 }, { label: 'A mechanical keyboard', value: 2 },
    { label: 'A focused desk lamp', value: 2 }, { label: 'A noise-cancelling headset', value: 3 },
    { label: 'A fast external SSD', value: 3 }, { label: 'A clean cable-management kit', value: 2 },
    { label: 'A large whiteboard', value: 2 }, { label: 'A distraction-free room', value: 4 },
  ],
  'theme-7': [
    { label: 'A weatherproof shelter', value: 4 }, { label: 'A water filtration system', value: 4 },
    { label: 'A reliable heat source', value: 4 }, { label: 'A stocked first-aid kit', value: 3 },
    { label: 'A solar power kit', value: 3 }, { label: 'A compact tool set', value: 3 },
    { label: 'A vegetable garden', value: 2 }, { label: 'A secure food store', value: 3 },
    { label: 'A radio transceiver', value: 2 }, { label: 'A safe access trail', value: 2 },
  ],
  'theme-8': [
    { label: 'A headline-worthy band', value: 4 }, { label: 'A powerful stage sound rig', value: 4 },
    { label: 'A spectacular lighting show', value: 3 }, { label: 'A weatherproof main stage', value: 4 },
    { label: 'A great food court', value: 3 }, { label: 'A quiet camping zone', value: 2 },
    { label: 'A backstage lounge', value: 2 }, { label: 'A famous guest DJ', value: 3 },
    { label: 'A smooth entry system', value: 2 }, { label: 'A surprise encore', value: 3 },
  ],
  'theme-9': [
    { label: 'A private stretch of beach', value: 4 }, { label: 'A shaded beach cabana', value: 3 },
    { label: 'A professional surf lesson', value: 3 }, { label: 'A cold-drink station', value: 2 },
    { label: 'A comfortable beach lounger', value: 2 }, { label: 'A waterproof speaker', value: 2 },
    { label: 'A sunset boat trip', value: 4 }, { label: 'A reef-safe snorkel kit', value: 3 },
    { label: 'A beach volleyball court', value: 2 }, { label: 'A perfect tide and weather', value: 4 },
  ],
  'theme-10': [
    { label: 'A clean-energy power grid', value: 4 }, { label: 'A beautiful central park', value: 3 },
    { label: 'A reliable public transit loop', value: 4 }, { label: 'A lively night market', value: 3 },
    { label: 'A world-class public library', value: 3 }, { label: 'A safe walkable centre', value: 4 },
    { label: 'A creative arts district', value: 2 }, { label: 'A community sports arena', value: 3 },
    { label: 'An advanced medical centre', value: 4 }, { label: 'A striking city landmark', value: 2 },
  ],
}
// Custom themes use neutral, reusable lots rather than silently inheriting the
// first bundled theme (a pirate ship) when a user creates their own market.
const GENERIC_CHALLENGE_MARKET = [
  { label: 'A reliable foundation', value: 4 },
  { label: 'A specialist expert', value: 4 },
  { label: 'A dependable toolkit', value: 3 },
  { label: 'A practical power source', value: 3 },
  { label: 'A safe transport option', value: 3 },
  { label: 'A useful communication system', value: 3 },
  { label: 'A quality materials pack', value: 3 },
  { label: 'A clever time-saving shortcut', value: 2 },
  { label: 'A contingency reserve', value: 2 },
  { label: 'A distinctive finishing touch', value: 2 },
] as const

const DEFAULT_OPTIONS: ArcadeSetupOptions = {
  playStyle: 'classic', durationSeconds: 60, roleCount: 1, phoneNarrator: true,
  antiItemsMode: false, readPromptsAloud: false, fuseSeconds: 10,
}

function pickOne<T>(items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('This game could not load a playable prompt. Retry generation and try again.')
  return items[secureRandomInteger(items.length)]!
}
function shuffleDeck(items: readonly ArcadeContent[]): ArcadeContent[] {
  const shuffled = secureShuffle(items)
  if (shuffled.length === 0) throw new RangeError('Select a content pack with at least one prompt.')
  return shuffled
}
function roundRoster(players: readonly Player[]) {
  return players.map(player => ({ id: player.id, name: player.name }))
}

/**
 * Build an offline party-game session. Every secret role, target, word order and
 * tie-break seed is generated with Web Crypto before the persisted game starts.
 */
export function createPartyArcadeSession(
  game: PartyArcadeGame,
  players: readonly Player[],
  sourceItems: readonly ArcadeContent[],
  setup: ArcadeSetupOptions = DEFAULT_OPTIONS,
): ArcadeSession {
  if (players.length < 2) throw new RangeError('Party games require at least two players.')
  if (players.length > 32) throw new RangeError('Party games support up to 32 players.')
  const playerIds = players.map(player => player.id)
  const normalizedNames = players.map(player => player.name.trim().normalize('NFKC').toLocaleLowerCase())
  if (playerIds.some(id => !id) || new Set(playerIds).size !== playerIds.length) throw new TypeError('Every player must have a unique, non-empty ID.')
  if (players.some(player => !player.name.trim()) || new Set(normalizedNames).size !== normalizedNames.length) throw new TypeError('Every player must have a unique, non-empty name.')
  if (setup.fuseSeconds !== undefined && !FUSE_CHOICES.includes(setup.fuseSeconds as typeof FUSE_CHOICES[number])) throw new RangeError('Fuse length must be 8, 10, 12 or 15 seconds.')
  if (setup.durationSeconds !== undefined && ![30, 45, 60, 90, 120].includes(setup.durationSeconds)) throw new RangeError('Round length must be 30, 45, 60, 90 or 120 seconds.')
  if (setup.roleCount !== undefined && (!Number.isInteger(setup.roleCount) || setup.roleCount < 1 || setup.roleCount > 3)) throw new RangeError('Hidden-team size must be between one and three.')
  if ((game === 'hot-bomb-duel' || game === 'qupid' || game === 'questions-for-love' || game === 'a-or-b') && players.length !== 2) {
    throw new RangeError(`${game} is designed for exactly two players.`)
  }
  if ((game === 'werewolf' || game === 'mafia') && players.length < 5) {
    throw new RangeError(`${game} requires at least five players.`)
  }
  if ((game === 'timer-impostor' || game === 'murder' || game === 'fake-story' || game === 'fact-or-fiction' || game === 'fake-it') && players.length < 3) {
    throw new RangeError(`${game} requires at least three players.`)
  }
  if (game === 'who-am-i' && players.length > 20) throw new RangeError('Who Am I supports up to 20 players with the bundled identity pack.')
  const contentlessGames = new Set<PartyArcadeGame>(['timer-impostor', 'werewolf', 'mafia', 'murder'])
  if (!contentlessGames.has(game) && sourceItems.length === 0) throw new RangeError('This game needs at least one bundled content item. Select an available pack.')
  if (game === 'fake-it' && sourceItems.some(item => !item.hints?.[0]?.trim())) throw new TypeError('Fake It content must include a secret answer in its metadata. Use Category | Secret word in a custom pack.')
  if (game === 'fact-or-fiction' && sourceItems.some(item => !['true', 'false'].includes(String(item.hints?.[0] ?? '').toLocaleLowerCase()))) throw new TypeError('Fact or Fiction content must include a true/false verdict. Use Statement | true or Statement | false in a custom pack.')
  if ((game === 'would-you-rather' || game === 'a-or-b') && sourceItems.some(item => { const options = item.text.split('||').map(value => value.trim()); return options.length !== 2 || !options[0] || !options[1] })) throw new TypeError(`${game} content must contain exactly two non-empty options separated by ||.`)
  const roster = roundRoster(players)
  const deck = sourceItems.length ? shuffleDeck(sourceItems) : []
  const common = {
    arcadeGame: game,
    playerRoster: roster,
    setupSnapshot: { ...DEFAULT_OPTIONS, ...setup },
    round: 1,
    createdAt: Date.now(),
  }

  if (game === 'timer-impostor') {
    if (players.length < 3) throw new RangeError('Timer Impostor requires at least three players.')
    const impostor = pickOne(players)
    const targetSeconds = 10 + secureRandomInteger(16)
    return { phase: 'private-reveal', data: {
      ...common, targetSeconds, impostorId: impostor.id, revealIndex: 0,
      attempts: [], playerOrder: secureShuffle(roster.map(player => player.id)), votes: {}, voteIndex: 0,
    } }
  }

  if (game === 'werewolf' || game === 'mafia') {
    if (players.length < 5) throw new RangeError(`${game === 'mafia' ? 'Mafia' : 'Werewolf'} requires at least five players.`)
    const maxBalancedHostiles = Math.max(1, Math.floor((players.length - 1) / 3))
    const hostileCount = Math.min(setup.roleCount, maxBalancedHostiles)
    const shuffledIds = secureShuffle(roster.map(player => player.id))
    const hostileIds = shuffledIds.slice(0, hostileCount)
    const roleByPlayerId = Object.fromEntries(roster.map(player => [player.id, hostileIds.includes(player.id) ? (game === 'mafia' ? 'Mafia' : 'Werewolf') : 'Villager']))
    return { phase: 'private-reveal', data: {
      ...common, roleByPlayerId, revealIndex: 0, revealOrder: secureShuffle(roster.map(player => player.id)),
      aliveIds: roster.map(player => player.id), night: 1, hostileCount, nightVictimId: null,
      nightVoterOrder: secureShuffle(hostileIds), nightVotes: {}, nightVoteIndex: 0,
      dayVotes: {}, voteIndex: 0, phoneNarrator: setup.phoneNarrator,
    } }
  }

  if (game === 'murder') {
    if (players.length < 3) throw new RangeError('Murder requires at least three players.')
    const murderer = pickOne(players)
    return { phase: 'private-reveal', data: {
      ...common, murdererId: murderer.id, revealIndex: 0, revealOrder: secureShuffle(roster.map(player => player.id)),
      aliveIds: roster.map(player => player.id), winkedPlayerIds: [], votes: {}, voteIndex: 0,
    } }
  }

  if (game === 'fake-story' || game === 'fact-or-fiction') {
    if (players.length < 3) throw new RangeError(`${game === 'fake-story' ? 'Fake Story' : 'Fact or Fiction'} requires at least three players.`)
    const prompt = pickOne(deck)
    return { phase: 'private-reveal', data: {
      ...common, prompt: prompt.text, promptId: prompt.id, promptTruth: String(prompt.hints?.[0] ?? '').toLocaleLowerCase() === 'true',
      secretPlayerId: pickOne(roster).id, revealIndex: 0, revealOrder: secureShuffle(roster.map(player => player.id)),
      votes: {}, voteIndex: 0, answers: [],
    } }
  }

  if (game === 'fake-it') {
    const prompt = pickOne(deck)
    const wordHolder = pickOne(roster)
    return { phase: 'private-reveal', data: {
      ...common, prompt: prompt.text, promptId: prompt.id,
      secretWord: prompt.hints?.[0] ?? '', wordHolderId: wordHolder.id,
      guessOrder: secureShuffle(roster.filter(player => player.id !== wordHolder.id).map(player => player.id)),
      guessIndex: 0, guesses: [],
    } }
  }

  if (game === 'hot-bomb' || game === 'hot-bomb-duel') {
    if (game === 'hot-bomb-duel' && players.length !== 2) throw new RangeError('Hot Bomb Duel requires exactly two players.')
    const category = pickOne(deck)
    const fuseSeconds = setup.fuseSeconds ?? FUSE_CHOICES[1]
    return { phase: 'playing', data: {
      ...common, category: category.text, categoryId: category.id, currentPlayerIndex: secureRandomInteger(players.length),
      fuseSeconds, endsAt: Date.now() + fuseSeconds * 1000, usedAnswers: [], explodedPlayerId: null,
      explosionCount: 0, lastAnswer: '', activePlayerIds: roster.map(player => player.id),
      strikes: Object.fromEntries(roster.map(player => [player.id, 0])), roundNotice: '',
    } }
  }

  if (game === 'whos-most-likely' || game === 'would-you-rather') {
    const prompt = deck[0]!
    const [optionA, optionB] = prompt.text.split('||').map(value => value.trim())
    return { phase: 'voting', data: {
      ...common, deck: deck.map(item => ({ id: item.id, text: item.text })), index: 0,
      prompt: game === 'would-you-rather' ? optionA ?? prompt.text : prompt.text,
      optionA: optionA ?? '', optionB: optionB ?? '', promptId: prompt.id,
      votes: {}, voterOrder: secureShuffle(roster.map(player => player.id)), voteIndex: 0, voteHistory: [],
    } }
  }

  if (game === 'wrong-answers-only') {
    const prompt = deck[0]!
    return { phase: 'answering', data: {
      ...common, deck: deck.map(item => ({ id: item.id, text: item.text })), index: 0,
      prompt: prompt.text, promptId: prompt.id,
      playerOrder: secureShuffle(roster.map(player => player.id)), answerIndex: 0, answers: [],
      readPromptsAloud: setup.readPromptsAloud, voteHistory: [],
    } }
  }

  if (game === 'tilt-it' || game === 'letterburg') {
    const words = deck.map(item => ({ id: item.id, text: item.text }))
    const teams = setup.playStyle === 'teams'
    return { phase: 'ready', data: {
      ...common, deck: words, index: 0, scoreA: 0, scoreB: 0, soloScores: {},
      currentTeam: 'A', teamAName: 'Team A', teamBName: 'Team B', teams,
      currentPlayerIndex: 0, currentPlayerId: roster[0]?.id ?? '', soloRoundIndex: 0,
      durationSeconds: setup.durationSeconds, endsAt: null, running: false,
      correct: 0, pass: 0,
    } }
  }

  if (game === 'discussion-starter' || game === 'qupid' || game === 'questions-for-love' || game === 'share-or-pass') {
    const prompts = deck.map(item => ({ id: item.id, text: item.text }))
    return { phase: 'prompt', data: {
      ...common, deck: prompts, index: 0, currentPlayerIndex: 0, responses: 0, skips: 0,
      currentPromptId: prompts[0]?.id ?? null, currentPrompt: prompts[0]?.text ?? '',
    } }
  }

  if (game === 'who-am-i') {
    const identities = shuffleDeck(deck).map(item => ({ id: item.id, text: item.text }))
    if (identities.length < players.length) throw new RangeError('Who Am I needs at least one unique identity per player. Select a larger pack.')
    const assignments = Object.fromEntries(roster.map((player, index) => [player.id, identities[index]!.text]))
    return { phase: 'questioning', data: {
      ...common, assignments, playerOrder: secureShuffle(roster.map(player => player.id)),
      currentPlayerIndex: 0, correctPlayers: [], skippedPlayers: [], guesses: 0,
    } }
  }

  if (game === 'ten-tangle') {
    const words = deck.slice(0, 10).map(item => {
      const letters = [...item.text.toLocaleUpperCase()].filter(char => /[A-Z]/.test(char))
      return { id: item.id, answer: item.text.toLocaleUpperCase(), scrambled: scrambleWord(letters.join('')) }
    })
    if (words.length < 10) throw new RangeError('Ten Tangle requires at least ten words in the selected packs.')
    return { phase: 'puzzle', data: { ...common, puzzles: words, answers: {}, solved: 0 } }
  }

  if (game === 'challenge-20') {
    const theme = pickOne(deck)
    const marketDefinition = CHALLENGE_MARKETS[theme.id] ?? GENERIC_CHALLENGE_MARKET
    const market = secureShuffle(marketDefinition.map((item, index) => ({ id: `lot-${String(index + 1).padStart(2, '0')}`, ...item })))
    return { phase: 'bidding', data: {
      ...common, theme: theme.text, themeId: theme.id, market, lotIndex: 0,
      budgets: Object.fromEntries(roster.map(player => [player.id, 20])),
      builds: Object.fromEntries(roster.map(player => [player.id, []])),
      lotBids: {}, bidderIndex: 0, bidOrder: secureShuffle(roster.map(player => player.id)),
      antiItemsMode: setup.antiItemsMode, auctionHistory: [],
    } }
  }

  if (game === 'a-or-b') {
    const prompt = pickOne(deck)
    const [optionA, optionB] = prompt.text.split('||').map(value => value.trim())
    if (!optionA || !optionB) throw new TypeError('A or B content must contain two options separated by ||.')
    const order = secureShuffle(roster.map(player => player.id))
    return { phase: 'choosing', data: {
      ...common, prompt: `${optionA} / ${optionB}`, optionA, optionB, chooserOrder: order,
      roundIndex: 0, chooserId: order[0], guesserId: order[1] ?? order[0],
      chosenOption: null, guessedOption: null, scoreByPlayer: {},
    } }
  }

  if (game === 'reverse-singing') {
    const prompt = pickOne(deck)
    return { phase: 'intro', data: {
      ...common, prompt: prompt.text, playStyle: setup.playStyle, durationSeconds: 5,
      recordings: [], currentPlayerIndex: 0, scoreByPlayer: {},
    } }
  }

  throw new TypeError(`No party-game implementation is registered for ${game}.`)
}

export function recordArcadeVote(
  votes: Record<string, string>, voterId: string, choice: string,
  allowedChoices: readonly string[],
): Record<string, string> {
  if (!voterId || !allowedChoices.includes(choice)) throw new TypeError('This vote is not valid for the current round.')
  if (Object.prototype.hasOwnProperty.call(votes, voterId)) throw new Error('This player has already voted.')
  return { ...votes, [voterId]: choice }
}

/** Require a return to the neutral band before accepting another tilt action. */
export function classifyTiltGesture(delta: number, armed: boolean): { action: 'correct' | 'pass' | null; armed: boolean } {
  if (!Number.isFinite(delta)) return { action: null, armed }
  const magnitude = Math.abs(delta)
  if (magnitude < 7) return { action: null, armed: true }
  if (!armed || magnitude < 14) return { action: null, armed }
  return { action: delta > 0 ? 'correct' : 'pass', armed: false }
}

export function scoreTiltCard(data: Record<string, any>, result: 'correct' | 'pass'): Record<string, any> {
  if (result !== 'correct' && result !== 'pass') throw new TypeError('Unknown card result.')
  const deck = Array.isArray(data.deck) ? data.deck as unknown[] : []
  const index = Number.isSafeInteger(data.index) ? data.index : 0
  if (index < 0 || index >= deck.length) throw new RangeError('The word deck is exhausted.')
  const currentTeam = data.currentTeam === 'B' ? 'B' : 'A'
  const soloScores = data.soloScores && typeof data.soloScores === 'object' ? data.soloScores as Record<string, number> : {}
  const next: Record<string, any> = { ...data, index: index + 1, correct: Number(data.correct ?? 0) + (result === 'correct' ? 1 : 0), pass: Number(data.pass ?? 0) + (result === 'pass' ? 1 : 0) }
  if (data.teams) {
    if (result === 'correct') next[currentTeam === 'A' ? 'scoreA' : 'scoreB'] = Number(next[currentTeam === 'A' ? 'scoreA' : 'scoreB'] ?? 0) + 1
  } else if (result === 'correct') {
    const playerId = String(data.currentPlayerId ?? '')
    if (playerId) next.soloScores = { ...soloScores, [playerId]: (soloScores[playerId] ?? 0) + 1 }
  }
  return next
}

export function settleAuctionLot(
  bids: Record<string, number>,
  budget: Record<string, number>,
  itemValue: number,
  antiItemsMode: boolean,
): { winnerId: string | null; cost: number; nextBudget: Record<string, number>; blocked: boolean } {
  const valid = Object.entries(bids).filter(([id, bid]) =>
    Number.isInteger(bid) && bid >= 0 && bid <= 20 && bid <= (budget[id] ?? 0),
  )
  if (antiItemsMode && itemValue < 3) {
    return { winnerId: null, cost: 0, nextBudget: { ...budget }, blocked: true }
  }
  if (valid.length === 0) return { winnerId: null, cost: 0, nextBudget: { ...budget }, blocked: false }
  valid.sort((a, b) => b[1] - a[1])
  const [winnerId, bid] = valid[0]!
  if (bid === 0) return { winnerId: null, cost: 0, nextBudget: { ...budget }, blocked: false }
  const cost = antiItemsMode ? bid : Math.max(1, bid)
  return {
    winnerId,
    cost,
    nextBudget: { ...budget, [winnerId]: (budget[winnerId] ?? 0) - cost },
    blocked: antiItemsMode && itemValue < 3,
  }
}

export function resolveHiddenTeamWinner(roleByPlayerId: Record<string, string>, aliveIds: readonly string[], hostileRole: string): 'hostile' | 'village' | null {
  const hostileAlive = aliveIds.filter(id => roleByPlayerId[id] === hostileRole).length
  const villageAlive = aliveIds.length - hostileAlive
  if (hostileAlive === 0) return 'village'
  if (hostileAlive >= villageAlive) return 'hostile'
  return null
}

export function scrambleWord(word: string, random: (exclusiveMax: number) => number = secureRandomInteger): string {
  const characters = [...word]
  if (characters.length < 2) return word
  // Retry a bounded number of times; a hostile or deterministic test RNG must
  // never recurse forever. A one-place rotation is the deterministic fallback.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = [...characters]
    for (let index = candidate.length - 1; index > 0; index -= 1) {
      const target = random(index + 1)
      ;[candidate[index], candidate[target]] = [candidate[target]!, candidate[index]!]
    }
    const scrambled = candidate.join('')
    if (scrambled !== word) return scrambled
  }
  return [...characters.slice(1), characters[0]].join('')
}

export function nextLivingPlayerIndex(aliveIds: readonly string[], currentIndex: number): number {
  if (aliveIds.length === 0) return 0
  return (currentIndex + 1) % aliveIds.length
}

export function formatAuctionBudget(value: number): string {
  return `$${Math.max(0, Math.min(20, Math.trunc(value)))}`
}
