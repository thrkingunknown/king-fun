import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/ui/Icon.tsx'
import { ProgressBar } from '../components/ui/ProgressBar.tsx'
import { CountdownDisplay } from '../components/ui/CountdownDisplay.tsx'
import { formatDuration } from '../components/ui/ui-utils.ts'
import { PromptReportDialog, type PromptReportReason } from '../components/gameplay/PromptReportDialog.tsx'
import { useGamePhaseFocus } from '../components/gameplay/useGamePhaseFocus.ts'
import type { GameViewProps } from './game-props.ts'
import { endGuessUpTeamRound, prepareGuessUpTeamB, scoreGuessUpCard } from '../domain/games/guessup.ts'
import { transitionGuessUpTilt } from '../domain/games/guessup-tilt.ts'
import type { GuessUpRoundState } from '../domain/games/guessup.ts'

type Props = Pick<GameViewProps, 'active' | 'players' | 'patchActive' | 'finish'> & {
  restart: () => void
  reportPrompt: (reason: PromptReportReason, note: string, contentId: string | null) => void
}

export function GuessUpGame({ active, players, patchActive, finish, restart, reportPrompt }: Props) {
  const data = active.data
  const round = data as unknown as GuessUpRoundState
  const teamBDeckActive = data.activeTeam === 'B' && Array.isArray(data.deckB) && data.deckB.length > 0
  const deck = teamBDeckActive ? data.deckB as string[] : (Array.isArray(data.deck) ? data.deck as string[] : [])
  const rawIndex = teamBDeckActive ? (data.indexB ?? data.index) : data.index
  const cardIndex = Number.isInteger(rawIndex) ? Math.max(0, Number(rawIndex)) : 0
  const hasCard = deck.length > 0 && cardIndex < deck.length
  const currentCard = hasCard ? deck[cardIndex]! : 'The selected deck is exhausted. Finish the turn or choose another deck next time.'
  const teamAPlayers = Array.isArray(data.teamAPlayers) ? data.teamAPlayers as string[] : players.filter((_, index) => index % 2 === 0).map(player => player.name)
  const teamBPlayers = Array.isArray(data.teamBPlayers) ? data.teamBPlayers as string[] : players.filter((_, index) => index % 2 === 1).map(player => player.name)
  const [reportOpen, setReportOpen] = useState(false)
  const [lastAction, setLastAction] = useState<'correct' | 'pass' | null>(null)
  const [tiltEnabled, setTiltEnabled] = useState(false)
  const [tiltStatus, setTiltStatus] = useState('Tilt is off. Touch controls remain available.')
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [musicStatus, setMusicStatus] = useState('')
  const musicContextRef = useRef<AudioContext | null>(null)
  const musicTimerRef = useRef<number | null>(null)
  const scoredActionRef = useRef<string | null>(null)
  const tiltArmedRef = useRef(false)
  const markCardRef = useRef<(result: 'correct' | 'pass') => void>(() => undefined)
  const durationSeconds = Number.isInteger(data.durationSeconds) ? Number(data.durationSeconds) : 60
  const teamAName = typeof data.teamAName === 'string' ? data.teamAName : 'Team A'
  const teamBName = typeof data.teamBName === 'string' ? data.teamBName : 'Team B'
  const activeTeamName = data.activeTeam === 'B' ? teamBName : teamAName
  const playFeedback = useCallback((result: 'correct' | 'pass') => {
    if (data.soundEnabled && typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined') {
      try {
        const audio = new window.AudioContext()
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(result === 'correct' ? 660 : 260, audio.currentTime)
        gain.gain.setValueAtTime(0.035, audio.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.12)
        oscillator.connect(gain)
        gain.connect(audio.destination)
        oscillator.start()
        oscillator.stop(audio.currentTime + 0.12)
        oscillator.onended = () => { void audio.close() }
      } catch {
        // Audio is optional; unavailable audio never blocks a score action.
      }
    }
    if (data.vibrationEnabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(result === 'correct' ? 35 : [15, 28, 15]) } catch { /* Optional haptics. */ }
    }
  }, [data.soundEnabled, data.vibrationEnabled])
  const stopMusic = () => {
    if (musicTimerRef.current !== null) window.clearInterval(musicTimerRef.current)
    musicTimerRef.current = null
    const context = musicContextRef.current
    musicContextRef.current = null
    if (context && context.state !== 'closed') void context.close()
    setMusicPlaying(false)
    setMusicStatus('Music stopped.')
  }
  const startMusic = async () => {
    if (musicContextRef.current || typeof window === 'undefined' || typeof window.AudioContext === 'undefined') {
      if (typeof window !== 'undefined' && typeof window.AudioContext === 'undefined') setMusicStatus('Background music is unavailable in this browser.')
      return
    }
    try {
      const context = new window.AudioContext()
      musicContextRef.current = context
      const master = context.createGain()
      master.gain.setValueAtTime(0.035, context.currentTime)
      master.connect(context.destination)
      await context.resume()
      const notes = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46]
      const sequenceStartedAt = performance.now()
      const playNote = () => {
        if (context.state !== 'running') return
        const at = context.currentTime
        const step = Math.floor((performance.now() - sequenceStartedAt) / 260)
        const oscillator = context.createOscillator()
        const envelope = context.createGain()
        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(notes[step % notes.length]!, at)
        envelope.gain.setValueAtTime(0.0001, at)
        envelope.gain.exponentialRampToValueAtTime(0.7, at + 0.025)
        envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
        oscillator.connect(envelope)
        envelope.connect(master)
        oscillator.start(at)
        oscillator.stop(at + 0.24)
      }
      if (context.state !== 'running') throw new Error('Audio context did not resume.')
      playNote()
      musicTimerRef.current = window.setInterval(playNote, 260)
      setMusicPlaying(true)
      setMusicStatus('Original background loop is playing.')
    } catch {
      const context = musicContextRef.current
      musicContextRef.current = null
      if (context && context.state !== 'closed') void context.close()
      setMusicStatus('Could not start background music. Game controls remain available.')
    }
  }
  const musicControl = data.musicEnabled ? <div className="guess-music-control"><button type="button" className="secondary-action" onClick={() => musicPlaying ? stopMusic() : void startMusic()}>{musicPlaying ? 'Stop music' : 'Play background music'}</button><small role="status">{musicStatus || 'Optional original synthesized music · off until started'}</small></div> : null

  useEffect(() => () => {
    if (musicTimerRef.current !== null) window.clearInterval(musicTimerRef.current)
    const context = musicContextRef.current
    musicContextRef.current = null
    if (context && context.state !== 'closed') void context.close()
  }, [])

  const finishTeamRound = () => {
    if (!round.running) return
    const transition = endGuessUpTeamRound(round)
    patchActive(transition.phase, transition.state as unknown as Record<string, any>)
  }
  const nextTeam = () => {
    if (active.phase !== 'team-break') return
    const prepared = prepareGuessUpTeamB(round)
    patchActive('ready', {
      ...data,
      ...prepared,
      countdown: 3,
      running: false,
      endsAt: null,
      seconds: prepared.durationSeconds ?? Number(data.durationSeconds ?? 60),
      deck: Array.isArray(data.deck) ? data.deck : prepared.deck,
      deckB: Array.isArray(data.deckB) && data.deckB.length ? data.deckB : prepared.deckB,
      deckIds: data.deckIds,
      deckBIds: data.deckBIds,
      deckItemIds: data.deckItemIds,
      deckBItemIds: data.deckBItemIds,
      roundId: data.roundId,
      reports: data.reports ?? [],
      soundEnabled: data.soundEnabled,
      musicEnabled: data.musicEnabled,
      vibrationEnabled: data.vibrationEnabled,
      inputMode: data.inputMode,
      packIds: data.packIds,
      playerRoster: data.playerRoster,
      index: prepared.index,
      indexB: prepared.indexB ?? 0,
      activeTeam: 'B',
    })
  }
  const markCard = useCallback((result: 'correct' | 'pass') => {
    const liveRound = active.data as unknown as GuessUpRoundState
    const teamBDeck = active.data.activeTeam === 'B' && Array.isArray(active.data.deckB) && active.data.deckB.length
    const liveIndex = teamBDeck ? Number(active.data.indexB ?? 0) : Number(active.data.index ?? 0)
    const liveDeck = teamBDeck ? active.data.deckB as string[] : (Array.isArray(active.data.deck) ? active.data.deck as string[] : [])
    const liveHasCard = liveDeck.length > 0 && liveIndex < liveDeck.length
    const actionKey = `${String(active.data.roundId ?? 'round')}:${liveRound.activeTeam}:${liveIndex}`
    const deadlineReached = Number.isFinite(liveRound.endsAt) && Date.now() >= Number(liveRound.endsAt)
    if (!liveHasCard || !liveRound.running || liveRound.seconds <= 0 || deadlineReached || scoredActionRef.current === actionKey) return
    scoredActionRef.current = actionKey
    try {
      const next = scoreGuessUpCard(liveRound, result)
      setLastAction(result)
      playFeedback(result)
      patchActive('playing', { ...active.data, ...next } as unknown as Record<string, any>)
    } catch {
      scoredActionRef.current = null
    }
  }, [active.data, patchActive, playFeedback])
  useEffect(() => {
    markCardRef.current = markCard
  }, [markCard])

  const finishDetails = `${teamAName} ${data.teamA} · ${teamBName} ${data.teamB} · ${data.correct} correct · ${data.pass} passed`
  const deckItemIds = teamBDeckActive && Array.isArray(data.deckBItemIds) ? data.deckBItemIds as string[] : (Array.isArray(data.deckItemIds) ? data.deckItemIds as string[] : [])
  const promptId = deckItemIds[cardIndex] ?? null
  const reportsCount = Array.isArray(data.reports) ? data.reports.length : 0
  useGamePhaseFocus(active.phase)
  const tiltActive = tiltEnabled && data.inputMode === 'tilt' && active.phase === 'playing'

  useEffect(() => {
    if (!tiltActive) {
      // A fresh turn must begin from neutral; remaining tilted through a handoff
      // must never score the next team's first card automatically.
      tiltArmedRef.current = false
      return
    }
    const onOrientation = (event: DeviceOrientationEvent) => {
      const transition = transitionGuessUpTilt(event.gamma, tiltArmedRef.current)
      tiltArmedRef.current = transition.armed
      if (transition.action) markCardRef.current(transition.action)
    }
    const disarm = () => { tiltArmedRef.current = false }
    const disarmWhenHidden = () => { if (document.visibilityState !== 'visible') disarm() }
    window.addEventListener('deviceorientation', onOrientation, true)
    window.addEventListener('blur', disarm)
    document.addEventListener('visibilitychange', disarmWhenHidden)
    return () => {
      window.removeEventListener('deviceorientation', onOrientation, true)
      window.removeEventListener('blur', disarm)
      document.removeEventListener('visibilitychange', disarmWhenHidden)
    }
  }, [tiltActive])

  const enableTilt = async () => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setTiltStatus('Tilt is not supported here. Use the touch buttons instead.')
      return
    }
    try {
      const orientationConstructor = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      const permission = orientationConstructor.requestPermission ? await orientationConstructor.requestPermission() : 'granted'
      if (permission !== 'granted') {
        setTiltStatus('Motion permission was not granted. Touch buttons remain available.')
        return
      }
      tiltArmedRef.current = false
      setTiltEnabled(true)
      setTiltStatus('Tilt enabled · right = correct, left = pass. Return to centre between cards.')
    } catch {
      setTiltStatus('Tilt permission is unavailable or was denied. Touch buttons remain available.')
    }
  }

  const toggleTilt = () => {
    if (tiltEnabled) {
      tiltArmedRef.current = false
      setTiltEnabled(false)
      setTiltStatus('Tilt is off. Touch controls remain available.')
      return
    }
    void enableTilt()
  }

  if (active.phase === 'ready') return <div className="game-stage guess-stage guess-ready-stage">
    <span className="eyebrow">GET READY · {activeTeamName.toUpperCase()}</span>
    <h1 className="page-title">Eyes up.<br /><em>Hands ready.</em></h1>
    <div className="ready-countdown" aria-live="assertive" aria-atomic="true">{data.countdown ?? 3}</div>
    {musicControl}
    <p className="lead">{activeTeamName}: your {durationSeconds}-second round begins now.</p>
    <div className="guess-team-scores"><div><span>{teamAName.toUpperCase()}</span><strong>{data.teamA}</strong><small>{teamAPlayers.join(' · ')}</small></div><div><span>{teamBName.toUpperCase()}</span><strong>{data.teamB}</strong><small>{teamBPlayers.join(' · ')}</small></div></div>
  </div>

  if (active.phase === 'team-break') return <div className="game-stage guess-stage guess-team-break">
    <span className="eyebrow">{teamAName.toUpperCase()} ROUND COMPLETE</span>
    <h1 className="page-title">Pass the<br /><em>headband.</em></h1>
    <p className="lead">{teamAName} scored {data.teamA}. Pass the phone to {teamBName} for a separate deck and a fresh {durationSeconds}-second turn.</p>
    <div className="guess-team-scores"><div><span>{teamAName.toUpperCase()}</span><strong>{data.teamA}</strong><small>{teamAPlayers.join(' · ')}</small></div><div><span>{teamBName.toUpperCase()}</span><strong>{data.teamB}</strong><small>{teamBPlayers.join(' · ')}</small></div></div>
    {musicControl}
    <button className="primary" onClick={nextTeam}>Get {teamBName} ready <Icon name="arrow-right" size={15} /></button>
    <button className="text-button" onClick={() => finish('GuessUp round ended early', finishDetails)}>End game now</button>
  </div>

  if (active.phase === 'complete') return <div className="game-stage guess-stage">
    <span className="eyebrow">BOTH TEAMS HAVE PLAYED</span>
    <h1 className="page-title">Time's<br /><em>up!</em></h1>
    <div className="secret-card guess-results">
      <div className="guess-team-scores"><div><span>{teamAName.toUpperCase()}</span><strong>{data.teamA}</strong><small>{teamAPlayers.join(' · ')}</small></div><div><span>{teamBName.toUpperCase()}</span><strong>{data.teamB}</strong><small>{teamBPlayers.join(' · ')}</small></div></div>
      {musicControl}
      <h2>{data.teamA === data.teamB ? 'It’s a tie!' : data.teamA > data.teamB ? `${teamAName} wins!` : `${teamBName} wins!`}</h2>
      <p>{data.correct} correct cards · {data.pass} passed cards · {reportsCount} local reports.</p>
      <div className="result-actions"><button className="primary" onClick={() => finish('GuessUp round completed', finishDetails)}>Save result</button><button className="secondary-action" onClick={restart}>Play again <Icon name="rotate" size={15} /></button></div>
    </div>
  </div>

  return <div className="game-stage guess-stage">
    <h1 className="sr-only">GuessUp · {activeTeamName}'s turn</h1>
    <div className="score-row"><span>{teamAName.toUpperCase()} <strong>{data.teamA}</strong></span><CountdownDisplay className="guess-countdown" seconds={data.seconds} label="Round time remaining" /><span>{teamBName.toUpperCase()} <strong>{data.teamB}</strong></span></div>
    <ProgressBar className="guess-progress" value={data.seconds} max={durationSeconds} label="Round time remaining" valueText={`${formatDuration(data.seconds)} remaining`} />
    <span className="eyebrow">{activeTeamName.toUpperCase()} · MAKE THEM GUESS</span>
    {musicControl}
    <div className="guess-team-line"><span><b>{teamAName.toUpperCase()}</b>{teamAPlayers.length ? ` · ${teamAPlayers.join(', ')}` : ''}</span><span><b>{teamBName.toUpperCase()}</b>{teamBPlayers.length ? ` · ${teamBPlayers.join(', ')}` : ''}</span></div>
    <div className="guess-card-counter">CARD {Math.min(cardIndex + 1, deck.length)} / {deck.length}</div>
    <div className={`guess-word${hasCard ? '' : ' is-exhausted'}`} aria-live="polite" aria-atomic="true">{currentCard}</div>
    <div className="guess-controls">
      <button disabled={!hasCard || !data.running} onClick={() => markCard('pass')}><Icon name="skip-forward" size={15} /> PASS</button>
      <button className="correct-btn" disabled={!hasCard || !data.running} onClick={() => markCard('correct')}><Icon name="check-circle" size={15} /> GOT IT</button>
    </div>
    {data.inputMode === 'tilt' && <div className="tilt-controls"><button type="button" className="secondary-action" aria-pressed={tiltEnabled} onClick={toggleTilt}>{tiltEnabled ? 'Disable tilt controls' : 'Enable tilt controls'}</button><small role="status">{tiltStatus}</small></div>}
    <p className="guess-action-feedback" role="status" aria-live="polite">{lastAction === 'correct' ? 'Correct — point added.' : lastAction === 'pass' ? 'Passed — next card.' : `${data.correct} correct · ${data.pass} passed across both teams`}</p>
    {!hasCard && <p className="muted" role="status">No cards will repeat in this round. Finish the current team's turn to move on.</p>}
    <div className="guess-secondary-actions"><button className="text-button" disabled={!data.running} onClick={() => setReportOpen(true)}>Report this card</button><button className="text-button" disabled={!data.running} onClick={finishTeamRound}>End this team's round</button></div>
    <PromptReportDialog game="guessup" open={reportOpen} onClose={() => setReportOpen(false)} onSubmit={(reason, note) => { reportPrompt(reason, note, promptId); setReportOpen(false) }} />
  </div>
}
