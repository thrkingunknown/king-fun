import { Icon, type IconName } from '../ui/Icon.tsx'

type Reaction = 'heart' | 'helpful' | 'not-helpful'
type Props = { value: Reaction | null; onChange: (value: Reaction | null) => void }

const REACTIONS: readonly { value: Reaction; label: string; icon: IconName }[] = [
  { value: 'heart', label: 'Love this prompt', icon: 'heart' },
  { value: 'helpful', label: 'Good prompt', icon: 'thumbs-up' },
  { value: 'not-helpful', label: 'Not a good fit', icon: 'minus' },
]

/** Player reactions are stored locally; Helpful/Not-a-good-fit also submit anonymous shared content-quality votes. */
export function ReactionBar({ value, onChange }: Props) {
  return <div className="reaction-bar" role="group" aria-label="Prompt reaction and community quality vote">
    <span className="reaction-title">YOUR REACTION</span>
    <div className="reaction-actions">
      {REACTIONS.map(item => <button
        type="button"
        key={item.value}
        aria-label={item.label}
        aria-pressed={value === item.value}
        className={value === item.value ? 'is-selected' : ''}
        onClick={() => onChange(value === item.value ? null : item.value)}
      ><Icon name={item.icon} size={17} strokeWidth={1.9} /></button>)}
    </div>
    <small>Good prompt / Not a good fit votes improve shared content quality.</small>
  </div>
}
