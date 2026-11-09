import type { ReactNode, SVGProps } from 'react'
import {
  Accessibility,
  Activity,
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  AudioWaveform,
  BadgeCheck,
  BadgeQuestionMark,
  Ban,
  Bomb,
  BookOpen,
  CaseUpper,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CircleOff,
  Clock3,
  Cloud,
  Database,
  Dices,
  Dice5,
  Download,
  Drama,
  ExternalLink,
  FileText,
  Flag,
  Flame,
  Gamepad2,
  GitBranch,
  GripVertical,
  Hand,
  HatGlasses,
  Heart,
  HeartHandshake,
  History,
  Home,
  Info,
  Keyboard,
  KeyRound,
  Layers3,
  Laugh,
  LibraryBig,
  Lightbulb,
  ListOrdered,
  LockKeyhole,
  Menu,
  MessageCircleQuestion,
  MessagesSquare,
  Minus,
  Moon,
  MoonStar,
  MoreHorizontal,
  Music2,
  Orbit,
  Palette,
  Pause,
  Pencil,
  Play,
  Plus,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Save,
  Scale,
  ScanEye,
  Search,
  Settings2,
  ShieldCheck,
  Shuffle,
  SkipForward,
  Skull,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Split,
  Sun,
  Swords,
  Target,
  Timer,
  TimerReset,
  ThumbsUp,
  Trash2,
  Trophy,
  Upload,
  Users,
  VenetianMask,
  Vibrate,
  Vote,
  Volume2,
  Wallet,
  WandSparkles,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * Typed Lucide icon registry for product UI. Centralising names keeps stroke
 * weight, accessibility, and visual language consistent across screens.
 */
export type IconName =
  | 'accessibility' | 'activity' | 'alert-triangle' | 'archive' | 'arrow-down' | 'arrow-down-up'
  | 'arrow-left' | 'arrow-right' | 'arrow-up' | 'arrow-up-right' | 'audio-waveform'
  | 'badge-check' | 'badge-question-mark' | 'ban' | 'bomb' | 'book-open' | 'case-upper'
  | 'check' | 'check-circle' | 'chevron-down' | 'chevron-right' | 'circle-off' | 'help'
  | 'clock' | 'cloud' | 'database' | 'dices' | 'dice' | 'download' | 'drama' | 'external-link'
  | 'file-text' | 'flag' | 'flame' | 'gamepad' | 'git-branch' | 'github' | 'grip' | 'hand' | 'hat-glasses'
  | 'history' | 'heart' | 'heart-handshake' | 'home' | 'info' | 'keyboard'
  | 'laugh' | 'lightbulb' | 'list-ordered' | 'lock' | 'key' | 'layers' | 'library' | 'menu'
  | 'message-circle-question' | 'messages-square' | 'minus' | 'moon' | 'moon-star'
  | 'more' | 'music' | 'orbit' | 'palette' | 'pause' | 'edit' | 'play' | 'plus' | 'puzzle'
  | 'refresh' | 'rotate' | 'save' | 'scale' | 'scan-eye' | 'search' | 'settings'
  | 'shield-check' | 'shuffle' | 'skip-forward' | 'skull' | 'sliders' | 'smartphone' | 'sparkles' | 'split'
  | 'sun' | 'swords' | 'target' | 'timer' | 'timer-reset' | 'trash' | 'trophy'
  | 'thumbs-up' | 'upload' | 'users' | 'venetian-mask' | 'vibrate' | 'vote' | 'volume' | 'wallet' | 'wand-sparkles' | 'wifi' | 'x' | 'zap'

type Props = Omit<SVGProps<SVGSVGElement>, 'ref'> & { name: IconName; size?: number; strokeWidth?: number }

function GitHubMark({ size = 18, strokeWidth = 1.8, ...props }: Omit<Props, 'name'>): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

const ICONS: Partial<Record<IconName, LucideIcon>> = {
  accessibility: Accessibility,
  activity: Activity,
  'alert-triangle': AlertTriangle,
  archive: Archive,
  'arrow-down': ArrowDown,
  'arrow-down-up': ArrowDownUp,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  'arrow-up-right': ArrowUpRight,
  'audio-waveform': AudioWaveform,
  'badge-check': BadgeCheck,
  'badge-question-mark': BadgeQuestionMark,
  ban: Ban,
  bomb: Bomb,
  'book-open': BookOpen,
  'case-upper': CaseUpper,
  check: Check,
  'check-circle': CheckCircle2,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'circle-off': CircleOff,
  help: CircleHelp,
  clock: Clock3,
  cloud: Cloud,
  database: Database,
  dices: Dices,
  dice: Dice5,
  download: Download,
  drama: Drama,
  'external-link': ExternalLink,
  'file-text': FileText,
  flag: Flag,
  flame: Flame,
  gamepad: Gamepad2,
  'git-branch': GitBranch,
  grip: GripVertical,
  hand: Hand,
  'hat-glasses': HatGlasses,
  history: History,
  heart: Heart,
  'heart-handshake': HeartHandshake,
  home: Home,
  info: Info,
  keyboard: Keyboard,
  key: KeyRound,
  layers: Layers3,
  laugh: Laugh,
  library: LibraryBig,
  lightbulb: Lightbulb,
  'list-ordered': ListOrdered,
  lock: LockKeyhole,
  menu: Menu,
  'message-circle-question': MessageCircleQuestion,
  'messages-square': MessagesSquare,
  minus: Minus,
  moon: Moon,
  'moon-star': MoonStar,
  more: MoreHorizontal,
  music: Music2,
  orbit: Orbit,
  palette: Palette,
  pause: Pause,
  edit: Pencil,
  play: Play,
  plus: Plus,
  puzzle: Puzzle,
  refresh: RefreshCw,
  rotate: RotateCcw,
  save: Save,
  scale: Scale,
  'scan-eye': ScanEye,
  search: Search,
  settings: Settings2,
  'shield-check': ShieldCheck,
  shuffle: Shuffle,
  'skip-forward': SkipForward,
  skull: Skull,
  sliders: SlidersHorizontal,
  smartphone: Smartphone,
  sparkles: Sparkles,
  split: Split,
  sun: Sun,
  swords: Swords,
  target: Target,
  timer: Timer,
  'timer-reset': TimerReset,
  'thumbs-up': ThumbsUp,
  trash: Trash2,
  trophy: Trophy,
  upload: Upload,
  users: Users,
  'venetian-mask': VenetianMask,
  vibrate: Vibrate,
  vote: Vote,
  volume: Volume2,
  wallet: Wallet,
  'wand-sparkles': WandSparkles,
  wifi: Wifi,
  x: X,
  zap: Zap,
}

export function Icon({ name, size = 18, strokeWidth = 1.8, ...props }: Props) {
  if (name === 'github') return <>{GitHubMark({ size, strokeWidth, ...props })}</>
  const Component = ICONS[name]
  if (!Component) return null
  return <Component size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...(props as Record<string, unknown>)} />
}
