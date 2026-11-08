import { useEffect, useRef, useState } from 'react'
import type { ActiveGame, Player } from '../../types.ts'
import { PartyButton, PartyCard, PartyMetric, PartyStage } from './PartyGameUI.tsx'

type Props = { active: ActiveGame; players: Player[]; patchActive: (phase: string, data: Record<string, any>) => void; finish: (title: string, detail: string) => void }
type RecordingStatus = 'idle' | 'recording-original' | 'recording-reply' | 'processing' | 'ready-reply' | 'ready-review' | 'ready-battle' | 'battle-result' | 'error'

/**
 * Reverse Singing uses a short, in-memory microphone take. Classic play asks a
 * second player to imitate the reversed line; Battle play awards one point to
 * the first player the group confirms recognised the line. No audio is uploaded
 * or serialized into the local save.
 */
export function ReverseSingingGame({ active, players, patchActive, finish }: Props) {
  const d = active.data
  const roster: Player[] = Array.isArray(d.playerRoster) ? d.playerRoster : players
  const isBattle = d.setupSnapshot?.playStyle === 'battle'
  const playerIndex = Number(d.currentPlayerIndex ?? 0)
  const activePlayer = roster[playerIndex % Math.max(1, roster.length)]
  const [status, setStatus] = useState<RecordingStatus>(() => isBattle && d.lastWinnerId ? 'battle-result' : 'idle')
  const [message, setMessage] = useState('Record a short vocal line, listen to it backwards, then take the next challenge.')
  const [seconds, setSeconds] = useState(5)
  const [winnerId, setWinnerId] = useState<string | null>(d.lastWinnerId ?? null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const contextRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number | null>(null)
  const originalRef = useRef<AudioBuffer | null>(null)
  const reversedRef = useRef<AudioBuffer | null>(null)
  const replyRef = useRef<AudioBuffer | null>(null)

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    const recorder = recorderRef.current
    if (recorder?.state === 'recording') {
      // Unmount must not let the recorder's asynchronous onstop handler update
      // a component that is no longer on screen.
      recorder.onstop = null
      recorder.onerror = null
      recorder.stop()
    }
    streamRef.current?.getTracks().forEach(track => track.stop())
    void contextRef.current?.close()
  }, [])

  const getContext = () => {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) throw new Error('Web Audio is not supported in this browser.')
    contextRef.current ??= new AudioContextClass()
    return contextRef.current
  }

  const reverseBuffer = (buffer: AudioBuffer) => {
    const reversed = getContext().createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const source = buffer.getChannelData(channel)
      const destination = reversed.getChannelData(channel)
      for (let index = 0; index < source.length; index += 1) destination[index] = source[source.length - 1 - index]!
    }
    return reversed
  }

  const playBuffer = async (buffer: AudioBuffer) => {
    const context = getContext()
    if (context.state === 'suspended') await context.resume()
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start()
  }

  const recordingMimeType = () => {
    if (typeof MediaRecorder.isTypeSupported !== 'function') return ''
    return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
      .find(type => MediaRecorder.isTypeSupported(type)) ?? ''
  }

  const microphoneError = (error: unknown) => {
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return 'Microphone access was denied. Allow microphone access for this site in the browser or device settings, then try again.'
      }
      if (error.name === 'NotFoundError') return 'No microphone was found. Connect a microphone and try again.'
      if (error.name === 'NotReadableError') return 'The microphone is busy in another app. Close it there and try again.'
      if (error.name === 'SecurityError') return 'Microphone access requires HTTPS or localhost. Open the app on a secure URL and try again.'
    }
    return error instanceof Error ? error.message : 'Microphone access was unavailable.'
  }

  const startRecording = async (kind: 'original' | 'reply') => {
    let stream: MediaStream | undefined
    try {
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        throw new Error('Microphone access requires HTTPS or localhost. On a phone, open the app using an HTTPS URL.')
      }
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not expose microphone access. Use a current HTTPS browser.')
      if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot record audio. Use a current HTTPS browser.')
      // Request the stream directly from the user gesture. Some mobile browsers
      // revoke the gesture when an AudioContext is resumed before permission.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const activeStream = stream
      streamRef.current = activeStream
      const audioContext = getContext()
      if (audioContext.state === 'suspended') await audioContext.resume()
      chunksRef.current = []
      const mimeType = recordingMimeType()
      const recorder = mimeType ? new MediaRecorder(activeStream, { mimeType }) : new MediaRecorder(activeStream)
      recorderRef.current = recorder
      recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      recorder.onerror = () => {
        activeStream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setStatus('error')
        setMessage('The microphone recording failed. Check browser permission and try again.')
      }
      recorder.onstop = async () => {
        try {
          setStatus('processing')
          activeStream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' })
          if (blob.size === 0) throw new Error('The recording was empty. Try again and speak closer to the microphone.')
          const buffer = await getContext().decodeAudioData(await blob.arrayBuffer())
          if (kind === 'original') {
            originalRef.current = buffer
            reversedRef.current = reverseBuffer(buffer)
            if (isBattle) {
              setStatus('ready-battle')
              setMessage('The reversed line is ready. Replay it for the group, then award the point to the first correct guess.')
            } else {
              setStatus('ready-reply')
              setMessage('Replay the reversed original for the next player, then record an imitation of the backwards sound.')
            }
          } else {
            replyRef.current = reverseBuffer(buffer)
            setStatus('ready-review')
            setMessage('Your imitation is now reversed back to normal. Play it for the group and compare it with the original.')
          }
        } catch (error) {
          setStatus('error')
          setMessage(error instanceof Error ? error.message : 'The recording could not be decoded.')
        }
      }
      recorder.start(250)
      setStatus(kind === 'original' ? 'recording-original' : 'recording-reply')
      setSeconds(5)
      setMessage(kind === 'original' ? `${activePlayer?.name ?? 'Player'}: sing or speak a short original line for five seconds.` : `${activePlayer?.name ?? 'Next player'}: imitate the reversed sound for five seconds.`)
      timerRef.current = window.setInterval(() => setSeconds(value => {
        if (value <= 1) {
          if (timerRef.current !== null) window.clearInterval(timerRef.current)
          timerRef.current = null
          if (recorder.state === 'recording') recorder.stop()
          return 0
        }
        return value - 1
      }), 1000)
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop())
      streamRef.current?.getTracks().forEach(track => track.stop())
      streamRef.current = null
      setStatus('error')
      setMessage(microphoneError(error))
    }
  }

  const stopNow = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  const awardBattlePoint = (playerId: string) => {
    if (!playerId || playerId === activePlayer?.id || winnerId) return
    const battleScores: Record<string, number> = d.battleScores ?? {}
    const nextScores = { ...battleScores, [playerId]: Number(battleScores[playerId] ?? 0) + 1 }
    setWinnerId(playerId)
    setStatus('battle-result')
    patchActive('intro', { ...d, battleScores: nextScores, lastWinnerId: playerId })
  }

  const nextChallenge = () => {
    const nextIndex = playerIndex + 1
    if (nextIndex >= roster.length) {
      const scores: Record<string, number> = d.battleScores ?? {}
      const summary = roster.map(player => `${player.name}: ${scores[player.id] ?? 0}`).join(' · ')
      finish('Reverse Singing Battle', `Final score — ${summary}`)
      return
    }
    originalRef.current = null
    reversedRef.current = null
    replyRef.current = null
    setWinnerId(null)
    setStatus('idle')
    setMessage(`${roster[nextIndex]?.name ?? 'Next player'} is up. Record a short original line.`)
    patchActive('intro', { ...d, currentPlayerIndex: nextIndex, lastWinnerId: null, battleRoundIndex: nextIndex })
  }

  const finishClassicTurn = () => {
    const nextIndex = playerIndex + 1
    if (nextIndex >= roster.length) {
      finish('Reverse Singing', 'Every player completed a reverse-playback challenge.')
      return
    }
    originalRef.current = null
    reversedRef.current = null
    replyRef.current = null
    setStatus('idle')
    setMessage(`Next player: ${roster[nextIndex]?.name ?? 'Player'}. Record a new short original line.`)
    patchActive('intro', { ...d, currentPlayerIndex: nextIndex })
  }

  const scores: Record<string, number> = d.battleScores ?? {}
  const scoreRows = roster.map(player => ({ player, score: Number(scores[player.id] ?? 0) })).sort((a, b) => b.score - a.score)
  const eligibleGuessers = roster.filter(player => player.id !== activePlayer?.id)

  return <PartyStage eyebrow={`REVERSE SINGING · ${isBattle ? 'BATTLE' : 'PASS & PLAY'}`} title={isBattle ? 'Recognise the reversed line first.' : 'Can you sing it backwards?'} subtitle="Record a short line, hear the reversed audio, then follow the selected play style. Microphone access is optional and local-only.">
    <PartyCard tone="accent">
      <p className="party-card-label">CURRENT SINGER · {activePlayer?.name ?? 'Group'}</p>
      <h2>{status === 'recording-original' ? 'Record the original' : status === 'recording-reply' ? 'Imitate the reversed sound' : status === 'ready-review' ? 'Review the reversed imitation' : status === 'ready-battle' ? 'Who recognised it first?' : status === 'battle-result' ? `${roster.find(player => player.id === winnerId)?.name ?? 'A player'} scores.` : 'Reverse-playback challenge'}</h2>
      {status !== 'error' && <p>{message}</p>}
      {(status === 'recording-original' || status === 'recording-reply') && <div className="reverse-recording-time" role="timer">{seconds}<small>s remaining</small></div>}
      {status === 'idle' && <PartyButton onClick={() => { void startRecording('original') }}>Allow microphone · record original</PartyButton>}
      {(status === 'recording-original' || status === 'recording-reply') && <PartyButton variant="danger" onClick={stopNow}>Stop recording</PartyButton>}
      {status === 'ready-reply' && <>
        <PartyButton variant="secondary" onClick={() => reversedRef.current && void playBuffer(reversedRef.current)}>Play reversed original</PartyButton>
        <PartyButton onClick={() => { void startRecording('reply') }}>Record backwards imitation</PartyButton>
      </>}
      {status === 'ready-battle' && <>
        <PartyButton variant="secondary" onClick={() => reversedRef.current && void playBuffer(reversedRef.current)}>Replay reversed line</PartyButton>
        <p className="party-card-label">FIRST CORRECT GUESS</p>
        <div className="party-choice-grid">{eligibleGuessers.map(player => <button type="button" key={player.id} onClick={() => awardBattlePoint(player.id)}>{player.name}</button>)}</div>
      </>}
      {status === 'battle-result' && <>
        <PartyMetric label="POINTS THIS ROUND" value="1"/>
        <div className="party-result-list">{scoreRows.map(row => <div key={row.player.id}><span>{row.player.name}</span><strong>{row.score} pts</strong></div>)}</div>
        <PartyButton onClick={nextChallenge}>{playerIndex + 1 < roster.length ? 'Next singer' : 'Finish battle'}</PartyButton>
      </>}
      {status === 'ready-review' && <>
        <PartyButton onClick={() => replyRef.current && void playBuffer(replyRef.current)}>Play reversed imitation</PartyButton>
        <PartyButton variant="secondary" onClick={() => originalRef.current && void playBuffer(originalRef.current)}>Play original</PartyButton>
        <PartyButton onClick={finishClassicTurn}>Next player</PartyButton>
      </>}
      {status === 'processing' && <p role="status">Processing the recording…</p>}
      {status === 'error' && <><p role="alert" className="party-inline-error">{message}</p><PartyButton onClick={() => { setStatus('idle'); setMessage('Try again, or finish the round.') }}>Try again</PartyButton></>}
      {isBattle && <div className="party-result-list">{scoreRows.map(row => <div key={row.player.id}><span>{row.player.name}</span><strong>{row.score} pts</strong></div>)}</div>}
      <p className="party-help">Microphone audio stays in browser memory and is not uploaded or included in backup files. Reloading the page clears the clips. The group confirms who guessed first.</p>
    </PartyCard>
  </PartyStage>
}
