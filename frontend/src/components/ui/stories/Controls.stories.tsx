import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from '../button.tsx'
import { ToggleSwitch } from '../ToggleSwitch.tsx'
import { StatusPanel } from '../StatusPanel.tsx'
import { ProgressBar } from '../ProgressBar.tsx'
import { EmptyState } from '../EmptyState.tsx'
import { ChoiceButton } from '../ChoiceButton.tsx'
import { Icon } from '../Icon.tsx'

const meta = { title: 'KING-FUN/Controls', component: Button, parameters: { layout: 'padded' } } satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>

export const ButtonSystem: Story = {
  render: () => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
    <Button>Start game <Icon name="arrow-up-right" size={15} /></Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="destructive">Delete</Button>
    <Button size="icon" variant="outline" aria-label="Open settings"><Icon name="settings" /></Button>
  </div>,
}

export const Switches: Story = {
  render: function SwitchStory() {
    const [sound, setSound] = useState(false)
    const [motion, setMotion] = useState(true)
    return <div style={{ width: 'min(100%, 520px)', display: 'grid', gap: 8, padding: 20, border: '1px solid var(--kf-line)', borderRadius: 16, background: 'var(--kf-panel)' }}>
      <ToggleSwitch label="Sound effects" description="Short feedback during game actions." checked={sound} onCheckedChange={setSound} />
      <ToggleSwitch label="Motion effects" description="Small transitions, card reveals and feedback." checked={motion} onCheckedChange={setMotion} />
    </div>
  },
}

export const Feedback: Story = {
  render: () => <div style={{ display: 'grid', gap: 12, width: 'min(100%, 560px)' }}>
    <StatusPanel tone="success" title="Saved locally" message="Your player list and preferences are stored on this device." />
    <StatusPanel tone="warning" title="Connection unavailable" message="Remote generation is unavailable. Local packs remain playable." actionLabel="Retry" onAction={() => undefined} />
    <ProgressBar value={7} max={10} label="Round progress" valueText="7 of 10" />
    <ChoiceButton onClick={() => undefined} icon={<Icon name="shuffle" />}>Spin for a player</ChoiceButton>
    <EmptyState title="No sessions yet" description="Complete a round to start your private local archive." icon={<Icon name="archive" size={22} />} />
  </div>,
}
