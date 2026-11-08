import { useLayoutEffect, useRef } from 'react'
import { Command } from 'cmdk'
import type { Game, GameDefinition } from '../../types.ts'
import { GameMark } from './GameMark.tsx'
import { Icon } from './CoreIcon.tsx'

type Props = {
  open: boolean
  games: readonly GameDefinition[]
  canResume: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (screen: 'home' | 'history' | 'settings') => void
  onLaunch: (game: Game, source: HTMLElement) => void
  onResume: () => void
}

/** Keyboard-first navigation and game launcher, backed by cmdk and a native modal. */
export function CommandPalette({ open, games, canResume, onOpenChange, onNavigate, onLaunch, onResume }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const focusFrameRef = useRef<number | null>(null)
  const retryFrameRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
      const focusSearch = () => {
        const input = searchInputRef.current
        if (dialog.open && input?.isConnected) input.focus({ preventScroll: true })
      }
      // Focus immediately after entering the top layer, then retry once after
      // the browser completes its native dialog focus-placement pass.
      focusSearch()
      focusFrameRef.current = window.requestAnimationFrame(() => {
        focusSearch()
        retryFrameRef.current = window.requestAnimationFrame(focusSearch)
      })
    } else if (dialog.open) {
      dialog.close()
    }
    return () => {
      if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current)
      if (retryFrameRef.current !== null) window.cancelAnimationFrame(retryFrameRef.current)
      focusFrameRef.current = null
      retryFrameRef.current = null
    }
  }, [open])

  const run = (action: () => void) => {
    onOpenChange(false)
    action()
  }

  return <dialog
    ref={dialogRef}
    className="command-palette"
    aria-label="Quick actions"
    onCancel={event => { event.preventDefault(); onOpenChange(false) }}
    onClick={event => { if (event.target === event.currentTarget) onOpenChange(false) }}
  >
    <Command label="Quick actions" loop>
      <div className="command-search"><Icon name="search" size={18} /><Command.Input ref={searchInputRef} placeholder="Jump to a game or screen…" /><kbd>ESC</kbd></div>
      <Command.List>
        <Command.Empty>No matching games or actions.</Command.Empty>
        <Command.Group heading="Navigate">
          <Command.Item onSelect={() => run(() => onNavigate('home'))}><Icon name="gamepad" size={17} /> Play library <kbd>G</kbd></Command.Item>
          <Command.Item onSelect={() => run(() => onNavigate('history'))}><Icon name="history" size={17} /> Game history</Command.Item>
          <Command.Item onSelect={() => run(() => onNavigate('settings'))}><Icon name="settings" size={17} /> Settings</Command.Item>
          {canResume && <Command.Item onSelect={() => run(onResume)}><Icon name="history" size={17} /> Resume current session</Command.Item>}
        </Command.Group>
        <Command.Separator />
        <Command.Group heading="Start a game">
          {games.map(game => <Command.Item key={game.id} value={`${game.name} ${game.tagline}`} onSelect={() => run(() => onLaunch(game.id, dialogRef.current ?? document.body))}><GameMark game={game.id} size={17} /> <span>{game.name}</span><small>{game.tagline}</small></Command.Item>)}
        </Command.Group>
      </Command.List>
      <div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Select</span><span><kbd>Ctrl</kbd> + <kbd>K</kbd> Open anytime</span></div>
    </Command>
  </dialog>
}
