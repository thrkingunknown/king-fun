import { useCallback, useEffect, useRef, useState } from 'react'
import { useClockNow } from './useClockNow.ts'
import type { ActiveGame, Player } from '../../types.ts'
import { classifyTiltGesture, scoreTiltCard } from '../../domain/games/party-arcade.ts'
import { PartyActions, PartyButton, PartyCard, PartyMetric, PartyStage } from './PartyGameUI.tsx'

type Props = { active: ActiveGame; players: Player[]; patchActive: (phase: string, data: Record<string, any>) => void; finish: (title: string, detail: string) => void }
type MotionPermissionWindow = Window & { DeviceOrientationEvent?: typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> } }

/** Heads-up guessing with persistent deadline, accessible touch controls and optional tilt controls. */
export function TiltItGame({ active, players, patchActive, finish }: Props) {
  const d = active.data
  const deck: Array<{ id: string; text: string }> = d.deck ?? []
  const index = Number(d.index ?? 0)
  const now = useClockNow(active.phase === 'playing' && Boolean(d.running))
  const [motion, setMotion] = useState(false)
  const [motionState, setMotionState] = useState('Touch controls are ready.')
  const [calibration, setCalibration] = useState<number | null>(null)
  const lastTiltAt = useRef(0)
  const tiltArmed = useRef(true)
  const current = deck[index]
  const durationSeconds = Number(d.durationSeconds ?? 60)
  const initialClockValue = Number(d.endsAt ?? 0) - durationSeconds * 1000
  const remaining = d.endsAt ? Math.max(0, (Number(d.endsAt) - (now || initialClockValue)) / 1000) : durationSeconds


  const record = useCallback((result: 'correct' | 'pass') => {
    if (active.phase !== 'playing' || !d.running || (d.endsAt && Date.now() >= Number(d.endsAt))) return
    try {
      const next = scoreTiltCard(d, result)
      if (Number(next.index) >= deck.length) { setMotion(false); patchActive('round-results', { ...next, running: false, endsAt: null, endedAt: Date.now(), endReason: 'deck' }) }
      else patchActive('playing', next)
    } catch { patchActive('round-results', d) }
  }, [active.phase, d, deck.length, patchActive])

  const stopRound = useCallback((reason = 'time') => {
    patchActive('round-results', { ...d, running: false, endsAt: null, endedAt: Date.now(), endReason: reason })
    setMotion(false)
  }, [d, patchActive])

  useEffect(() => {
    if (!d.running || !d.endsAt || active.phase !== 'playing') return
    const timeout = window.setTimeout(() => stopRound('time'), Math.max(0, Number(d.endsAt) - Date.now()))
    return () => window.clearTimeout(timeout)
  }, [d.running, d.endsAt, active.phase, stopRound])

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (!motion || calibration === null || event.beta === null) return
    const delta = event.beta - calibration
    const gesture = classifyTiltGesture(delta, tiltArmed.current)
    tiltArmed.current = gesture.armed
    if (!gesture.action) return
    // Consume the gesture even during the debounce window. Holding the phone
    // at an angle cannot queue a delayed action when the window expires.
    const nowAt = Date.now()
    if (nowAt - lastTiltAt.current < 700) return
    lastTiltAt.current = nowAt
    setMotionState(gesture.action === 'correct' ? 'Tilt down detected · correct' : 'Tilt up detected · pass')
    record(gesture.action)
  }, [motion, calibration, record])

  useEffect(() => {
    if (!motion) return
    window.addEventListener('deviceorientation', handleOrientation)
    return () => window.removeEventListener('deviceorientation', handleOrientation)
  }, [motion, handleOrientation])

  const enableMotion = async () => {
    try {
      const orientation = (window as MotionPermissionWindow).DeviceOrientationEvent
      if (orientation?.requestPermission) {
        const permission = await orientation.requestPermission()
        if (permission !== 'granted') { setMotionState('Motion permission was not granted. Use the touch controls.'); return }
      }
      setCalibration(null)
      tiltArmed.current = true
      const calibrate = (event: DeviceOrientationEvent) => {
        if (event.beta === null) return
        setCalibration(event.beta)
        setMotion(true)
        setMotionState('Motion controls enabled. Tilt down for correct; tilt up to pass.')
        window.removeEventListener('deviceorientation', calibrate)
      }
      window.addEventListener('deviceorientation', calibrate)
      setMotionState('Hold the phone upright to calibrate…')
    } catch {
      setMotionState('Motion sensors are unavailable. Use the touch controls.')
    }
  }

  const rosterPlayer = (index: number): Player | undefined => (d.playerRoster ?? players)[index]
  const begin = () => patchActive('playing', { ...d, running: true, endsAt: Date.now() + Number(d.durationSeconds ?? 60) * 1000, currentPlayerId: d.currentPlayerId ?? d.playerRoster?.[0]?.id ?? players[0]?.id })
  const nextRound = () => {
    if (d.teams) {
      const currentTeam = d.currentTeam === 'A' ? 'B' : 'A'
      patchActive('ready', { ...d, currentTeam, index: 0, correct: 0, pass: 0, endsAt: null, running: false })
      return
    }
    const soloIndex = Number(d.soloRoundIndex ?? 0)
    const nextIndex = soloIndex + 1
    const nextPlayer = rosterPlayer(nextIndex)
    if (nextPlayer) {
      patchActive('ready', { ...d, soloRoundIndex: nextIndex, currentPlayerIndex: nextIndex, currentPlayerId: nextPlayer.id, index: 0, correct: 0, pass: 0, endsAt: null, running: false })
      return
    }
    const scores: Record<string, number> = d.soloScores ?? {}
    const summary = (d.playerRoster ?? players).map((player: Player) => `${player.name}: ${scores[player.id] ?? 0}`).join(' · ')
    finish(active.game, `Solo turns complete. ${summary}`)
  }

  if (active.phase === 'round-results' || !current && active.phase !== 'ready') return <PartyStage eyebrow="TILT IT · ROUND COMPLETE" title="Time. Count the score." subtitle="Correct answers score one point. Passing skips the word without a point."><PartyCard tone="accent"><PartyActions><PartyMetric label="CORRECT" value={d.correct ?? 0}/><PartyMetric label="PASSED" value={d.pass ?? 0}/>{d.teams ? <><PartyMetric label="TEAM A" value={d.scoreA ?? 0}/><PartyMetric label="TEAM B" value={d.scoreB ?? 0}/></> : <div className="party-result-list">{(d.playerRoster ?? players).map((player: Player) => <div key={player.id}><span>{player.name}</span><strong>{d.soloScores?.[player.id] ?? 0} pts</strong></div>)}</div>}</PartyActions><PartyButton onClick={nextRound}>{d.teams ? `Start ${d.currentTeam === 'A' ? 'Team B' : 'Team A'} turn` : Number(d.soloRoundIndex ?? 0) + 1 < (d.playerRoster ?? players).length ? `Next player: ${(d.playerRoster ?? players)[Number(d.soloRoundIndex ?? 0) + 1]?.name ?? 'Player'}` : 'Save solo standings'}</PartyButton>{d.teams && <PartyButton variant="quiet" onClick={() => finish(active.game, `Team A ${d.scoreA ?? 0} · Team B ${d.scoreB ?? 0}`)}>Finish match & save score</PartyButton>}</PartyCard></PartyStage>

  if (active.phase === 'ready') return <PartyStage eyebrow={`${active.game === 'letterburg' ? 'LETTERBURG' : 'TILT IT'} · READY`} title={d.teams ? `${d.currentTeam === 'A' ? d.teamAName : d.teamBName} is up.` : `${(d.playerRoster ?? players)[Number(d.soloRoundIndex ?? 0)]?.name ?? 'Player'} is up.`} subtitle="Hold the phone against your forehead with the screen facing the group. The group gives clues; the player tilts to score or pass. Solo mode gives every player an individual timed turn."><PartyCard tone="accent"><PartyMetric label="ROUND LENGTH" value={`${d.durationSeconds}s`}/><PartyMetric label="WORDS" value={deck.length}/>{d.teams && <PartyMetric label="SCORE" value={`${d.scoreA ?? 0} — ${d.scoreB ?? 0}`}/>}<PartyButton onClick={begin}>Start round</PartyButton><p className="party-help">You can use the on-screen buttons instead of motion controls.</p></PartyCard></PartyStage>

  return <PartyStage eyebrow="TILT IT · HEADS-UP" title={current?.text ?? 'Deck complete'} subtitle="Show the word to everyone except the guesser. Tilt down when correct; tilt up to pass."><PartyCard tone={remaining < 6 ? 'warning' : 'accent'}><div className="tilt-clock" role="timer">{remaining.toFixed(1)}<small>s</small></div><h2 className="tilt-word">{current?.text}</h2><div className="tilt-progress"><span style={{ width: `${Math.min(100, (index / Math.max(deck.length, 1)) * 100)}%` }}/></div><PartyActions><PartyButton onClick={() => record('correct')}>Correct · tilt down</PartyButton><PartyButton variant="secondary" onClick={() => record('pass')}>Pass · tilt up</PartyButton></PartyActions><p className="party-progress-note">{index + 1} / {deck.length} · {d.correct ?? 0} correct</p><div className="party-motion-control"><button type="button" onClick={enableMotion} disabled={motion}>{motion ? 'Motion enabled' : 'Enable tilt controls'}</button><span role="status">{motionState}</span></div><PartyButton variant="quiet" onClick={() => stopRound('manual')}>End turn</PartyButton></PartyCard></PartyStage>
}
