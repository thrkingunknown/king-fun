import type { Game } from '../../types.ts'
import { Icon, type IconName } from './Icon.tsx'

/**
 * GameMark maps stable game IDs to Lucide icons. New modes must register here
 * instead of adding emoji or ad-hoc glyphs to product surfaces.
 */
const GAME_ICONS: Record<Game, IconName> = {
  imposter: 'venetian-mask',
  guessup: 'drama',
  'truth-or-dare': 'flame',
  'never-have-i-ever': 'hand',
  'timer-impostor': 'timer',
  werewolf: 'moon-star',
  mafia: 'hat-glasses',
  murder: 'skull',
  'fake-it': 'message-circle-question',
  'fake-story': 'book-open',
  'fact-or-fiction': 'scale',
  'wrong-answers-only': 'laugh',
  'hot-bomb': 'bomb',
  'hot-bomb-duel': 'swords',
  'whos-most-likely': 'vote',
  'would-you-rather': 'split',
  'share-or-pass': 'heart-handshake',
  'challenge-20': 'wallet',
  'tilt-it': 'smartphone',
  letterburg: 'case-upper',
  'discussion-starter': 'messages-square',
  'who-am-i': 'badge-question-mark',
  'ten-tangle': 'puzzle',
  qupid: 'heart-handshake',
  'questions-for-love': 'heart',
  'a-or-b': 'split',
  'reverse-singing': 'audio-waveform',
}

export function GameMark({ game, size = 24 }: { game: Game; size?: number }) {
  return <Icon name={GAME_ICONS[game]} size={size} strokeWidth={1.8} />
}
