import { useEffect, useRef, useState } from 'react'
import type { GameViewProps } from './game-props.ts'
import { getImposterVoteProgress, recordImposterBallot, resolveImposterVotes, skipImposterVote, mrWhiteReachedThreshold, mrWhiteGuessWins } from '../domain/games/imposter.ts'
import type { ImposterRole, ImposterRoundState } from '../domain/games/imposter.ts'
import type { GameSetup } from '../types.ts'
import { ProgressBar } from '../components/ui/ProgressBar.tsx'
import { Icon } from '../components/ui/Icon.tsx'
import { useGamePhaseFocus } from '../components/gameplay/useGamePhaseFocus.ts'

type Props = Pick<GameViewProps, 'active' | 'players' | 'patchActive' | 'finish' | 'startGame'>

export function ImposterGame({ active, players, patchActive, finish, startGame }: Props) {
  const [roleRevealed, setRoleRevealed] = useState(false)
  const [roleViewed, setRoleViewed] = useState(false)
  const [selectedTargets, setSelectedTargets] = useState<string[]>([])
  const [guess, setGuess] = useState('')
  const [voteError, setVoteError] = useState('')
  const data = active.data as unknown as ImposterRoundState & { readonly setupSnapshot?: GameSetup; readonly playerRoster?: typeof players }
  const savedRoster = Array.isArray(data.playerRoster)
    ? data.playerRoster.filter(player => player && typeof player.id === 'string' && typeof player.name === 'string')
    : []
  // If a roster snapshot exists, never substitute the editable global roster.
  // A malformed/empty snapshot should fail closed rather than remap secret roles.
  const roundPlayers = Array.isArray(data.playerRoster) ? savedRoster : players
  const order = Array.isArray(data.order) ? data.order : []
  const roles = (data.roles && typeof data.roles === 'object' ? data.roles : {}) as Readonly<Record<string, ImposterRole>>
  const votes = (data.votes && typeof data.votes === 'object' ? data.votes : {}) as Readonly<Record<string, string | readonly string[]>>
  const skippedPlayers = Array.isArray(data.skip) ? data.skip : []
  const revealIndex = Number.isInteger(data.reveal) ? data.reveal : 0
  useGamePhaseFocus(`${active.phase}:${revealIndex}:${Number.isInteger(data.voter) ? data.voter : 0}`)
  const voterIndex = Number.isInteger(data.voter) ? data.voter : 0
  const requiredVotes = Number.isInteger(data.mysticCount) && data.mysticCount > 0 ? data.mysticCount : Math.max(1, Object.values(roles).filter(role => role === 'Mystic').length)
  const votingEnabled = data.votingEnabled !== false
  const secretWord = typeof data.word === 'string' ? data.word.trim() : ''
  const currentPlayerId = order[revealIndex]
  const currentPlayer = currentPlayerId === undefined ? undefined : roundPlayers.find(player => player.id === currentPlayerId)
  const currentRole = currentPlayerId === undefined ? undefined : roles[currentPlayerId]
  // Role identity is reflected in visual styling only while the card is open;
  // the concealed card's DOM/class list must not disclose the assigned role.
  const roleAccentClass = roleRevealed && currentRole ? `is-role-${currentRole.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}` : ''
  const revealIsValid = currentPlayer !== undefined && (currentRole === 'Mystic' || currentRole === 'Civilian' || currentRole === 'Mr. White') && Boolean(secretWord)
  const canPassPhone = roleViewed && !roleRevealed
  // Fail closed for partially migrated or malformed saves. Never fall through to the word.
  const revealedSecret = currentRole === 'Mystic' ? 'MYSTIC' : currentRole === 'Mr. White' ? 'MR. WHITE' : currentRole === 'Civilian' ? secretWord : 'UNAVAILABLE'
  const revealedHintRaw = currentRole === 'Mystic' ? (data.hints?.[currentPlayerId ?? ''] ?? null) : null
  const revealedHint = revealedHintRaw ? revealedHintRaw.trim().split(/\s+/).slice(0, 2).join(' ') : null
  const revealDescription = currentRole === 'Mystic'
    ? 'You do not know the secret word. Listen carefully and blend in.'
    : currentRole === 'Mr. White' ? 'You know only the category. Listen carefully and try to infer the secret word.'
    : currentRole === 'Civilian'
      ? 'Keep this word secret. Give clues without making it too obvious.'
      : 'This role could not be loaded. Do not reveal a word.'

  // Reveal on pointer/key down. A long-press timer made the card feel unresponsive.
  const beginRevealHold = () => {
    setRoleViewed(true)
    setRoleRevealed(true)
  }
  const endRevealHold = () => setRoleRevealed(false)
  const toggleAccessibleReveal = () => {
    if (roleRevealed) {
      setRoleRevealed(false)
      return
    }
    // Assistive-technology users control the reveal duration themselves.
    // The secret still auto-conceals when the tab/window loses visibility.
    setRoleViewed(true)
    setRoleRevealed(true)
  }

  useEffect(() => {
    const concealForFocusLoss = () => {
      setRoleRevealed(false)
    }
    const concealWhenHidden = () => {
      if (document.visibilityState !== 'visible') concealForFocusLoss()
    }
    window.addEventListener('blur', concealForFocusLoss)
    document.addEventListener('visibilitychange', concealWhenHidden)
    return () => {
      window.removeEventListener('blur', concealForFocusLoss)
      document.removeEventListener('visibilitychange', concealWhenHidden)
    }
  }, [])

  const nextPlayer = () => {
    if (!revealIsValid || !canPassPhone) return
    setRoleRevealed(false)
    setRoleViewed(false)
    if (revealIndex + 1 >= order.length) patchActive('discussion', { ...data, reveal: order.length, discussionEndsAt: data.discussionTimerEnabled ? Date.now() + data.discussionSeconds * 1000 : null })
    else patchActive('reveal', { ...data, reveal: revealIndex + 1 })
  }

  const currentVoterId = order[voterIndex]
  const currentVoter = currentVoterId === undefined ? undefined : roundPlayers.find(player => player.id === currentVoterId)
  const requiredVoteLabel = `${requiredVotes} suspected player${requiredVotes === 1 ? '' : 's'}`
  let voteProgress = { total: order.length, completed: 0, votes: Object.keys(votes).length, skipped: skippedPlayers.length, remaining: order.length }
  let voteIntegrityError = ''
  try { voteProgress = getImposterVoteProgress(data) } catch (error) { voteIntegrityError = error instanceof Error ? error.message : 'The saved vote state is invalid.' }

  const commitVote = (next: ImposterRoundState) => {
    setSelectedTargets([])
    setVoteError('')
    if (next.voter === next.order.length) {
      if (mrWhiteReachedThreshold(next)) { patchActive('mr-white-guess', next as unknown as Record<string, any>); return }
      try {
        patchActive('resolved', { ...next, outcome: resolveImposterVotes(next) } as unknown as Record<string, any>)
      } catch (error) {
        setVoteError(error instanceof Error ? error.message : 'The vote could not be resolved.')
      }
    } else {
      patchActive('voting', next as unknown as Record<string, any>)
    }
  }

  const submitVote = () => {
    if (!currentVoterId || selectedTargets.length !== requiredVotes) return
    try {
      commitVote(recordImposterBallot({ ...data, mysticCount: requiredVotes }, currentVoterId, selectedTargets))
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : 'Vote could not be recorded.')
    }
  }

  const skipVote = () => {
    if (!currentVoterId) return
    try {
      commitVote(skipImposterVote(data, currentVoterId))
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : 'Vote could not be skipped.')
    }
  }

  return <div className="game-stage imposter-stage">
    {active.phase === 'reveal' ? <>
      <span className="eyebrow">PRIVATE ROLE REVEAL · {Math.min(revealIndex + 1, order.length)}/{order.length}</span>
      <h1 className="page-title">Pass the phone<br />to <em>{currentPlayer?.name ?? 'the next player'}.</em></h1>
      <p className="reveal-instruction" id="role-reveal-instructions">Hold to reveal. Release to hide.</p>
      {revealIsValid ? <>
        <button
          type="button"
          id="imposter-role-reveal"
          className={`role-card${roleRevealed ? ` is-revealed ${roleAccentClass}` : ''}`}
          aria-label="Secret role card. Press and hold to reveal; release to hide."
          aria-pressed={roleRevealed}
          aria-describedby="role-reveal-instructions"
          onPointerDown={event => {
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            beginRevealHold()
          }}
          onPointerUp={endRevealHold}
          onPointerCancel={endRevealHold}
          onLostPointerCapture={endRevealHold}
          onBlur={endRevealHold}
          onContextMenu={event => event.preventDefault()}
          onKeyDown={event => {
            if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
              event.preventDefault()
              beginRevealHold()
            }
          }}
          onKeyUp={event => {
            if (event.code === 'Space' || event.code === 'Enter') endRevealHold()
          }}
        >
          <div className="role-card-inner">
            <div className="role-card-face role-card-back" aria-hidden={roleRevealed}>
              <span className="role-card-mark" aria-hidden="true"><Icon name="sparkles" size={25} /></span>
              <span className="role-card-back-title">YOUR TURN</span>
              <span className="role-card-hint">PRESS & HOLD</span>
              <span className="role-card-lock" aria-hidden="true"><Icon name="lock" size={19} /></span>
            </div>
            <div className="role-card-face role-card-front" aria-hidden={!roleRevealed}>
              {roleRevealed && <>
                <span className="eyebrow">YOUR SECRET IS</span>
                <span className="eyebrow role-card-category">CATEGORY · {data.category}</span>
                <span className="role-card-secret">{revealedSecret}</span>
                {currentRole === 'Mystic' && revealedHint ? <span className="role-card-hint-badge" aria-label={`Hint: ${revealedHint}`}>HINT · {revealedHint}</span> : null}
                <span className="role-card-description">{revealDescription}</span>
                <span className="role-card-footer">RELEASE TO HIDE</span>
              </>}
            </div>
          </div>
        </button>
        <button type="button" className="role-accessible-toggle" onClick={toggleAccessibleReveal} aria-controls="imposter-role-reveal" aria-pressed={roleRevealed}>
          {roleRevealed ? 'Hide role now' : 'Show role · tap to hide'}
        </button>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {roleRevealed ? `Your role is ${revealedSecret}. ${revealedHint ? `Hint: ${revealedHint}. ` : ''}${revealDescription}` : 'Your role is hidden.'}
        </span>
        <p className={`reveal-handoff-hint${roleViewed ? ' is-ready' : ''}`}>
          {!roleViewed ? 'Hold the card to view your role before passing the phone.' : roleRevealed ? 'Release the card to hide your role before passing the phone.' : 'Role hidden. You can now pass the phone.'}
        </p>
        <button className="primary pass-button" disabled={!canPassPhone} onClick={nextPlayer}>
          {revealIndex + 1 >= order.length ? 'Everyone is ready — start discussion' : 'Hide & pass phone'} <Icon name="arrow-right" size={16} />
        </button>
      </> : <div className="secret-card" role="alert">
        <h2>Role data unavailable</h2>
        <p>This saved round is incomplete. The secret word has been kept hidden. Exit the round and start a new one.</p>
      </div>}
    </> : active.phase === 'discussion' ? <>
      <span className="eyebrow">DISCUSSION PHASE · {roundPlayers.length} PLAYERS</span>
      <h1 className="page-title">Talk it<br /><em>out.</em></h1>
      <p className="lead">Take turns sharing a clue. Keep it subtle, listen carefully, and decide who does not know the word.</p>
      <div className="discussion-summary">
        <span><strong>{roundPlayers.length}</strong> players</span>
        <span><strong>{Object.values(roles).filter(role => role === 'Mystic').length}</strong> Mystics</span>
        <span><strong>{data.category || 'Everyday'}</strong> category</span>
      </div>
      {data.discussionTimerEnabled === true && <DiscussionClock seconds={data.discussionSeconds} deadline={data.discussionEndsAt ?? null} onExpire={() => patchActive(votingEnabled ? 'voting' : 'resolved', votingEnabled ? { ...data, votingEnabled, voter: 0, votes: {}, skip: [] } : { ...data, outcome: { kind: 'no-votes', counts: {}, leaders: [] } })} />}
      <p className="muted">{data.discussionTimerEnabled ? 'The timer applies only to discussion.' : 'Move to the next phase when the group is ready.'}</p>
      <button className="primary" onClick={() => patchActive(votingEnabled ? 'voting' : 'resolved', votingEnabled ? { ...data, votingEnabled, voter: 0, votes: {}, skip: [] } : { ...data, outcome: { kind: 'no-votes', counts: {}, leaders: [] } })}>{votingEnabled ? 'Move to voting' : 'Reveal results'} <Icon name="arrow-right" size={16} /></button>
    </> : active.phase === 'voting' ? <>
      <span className="eyebrow">PRIVATE VOTE · PLAYER {Math.min(voterIndex + 1, order.length)} OF {order.length}</span>
      <h1 className="page-title">Hand the phone<br />to <em>{currentVoter?.name ?? 'the next voter'}.</em></h1>
      <p className="lead">Select exactly {requiredVoteLabel}. You may vote for yourself. Your ballot is private and final.</p>
      <ProgressBar className="imposter-vote-progress" value={voteProgress.completed} max={voteProgress.total} label="Votes submitted" valueText={`${voteProgress.completed} of ${voteProgress.total} players have voted or skipped`} />
      {(voteError || voteIntegrityError) && <p className="form-error" role="alert">{voteError || voteIntegrityError}</p>}
      {!currentVoterId || !currentVoter || Boolean(voteIntegrityError) ? <div className="secret-card" role="alert"><h2>Voting handoff unavailable</h2><p>{voteIntegrityError || 'The current voter could not be found in this saved round. Exit and restart the round to continue safely.'}</p></div> : <>
        <div className="vote-list" role="group" aria-label={`Choose ${requiredVotes} suspected players for ${currentVoter.name}'s ballot`}>
          {roundPlayers.map(player => <button type="button" className={`vote-row vote-choice${selectedTargets.includes(player.id) ? ' is-selected' : ''}`} key={player.id} aria-pressed={selectedTargets.includes(player.id)} onClick={() => { setSelectedTargets(current => current.includes(player.id) ? current.filter(id => id !== player.id) : current.length < requiredVotes ? [...current, player.id] : current); setVoteError('') }}>
            <b>{player.name}</b><span className="vote-choice-status">{selectedTargets.includes(player.id) ? <><Icon name="check-circle" size={14} /> Selected</> : 'Select'}</span>
          </button>)}
        </div>
        <button className="primary" disabled={selectedTargets.length !== requiredVotes} onClick={submitVote}>
          {selectedTargets.length === requiredVotes ? `Confirm ${selectedTargets.length} vote${selectedTargets.length === 1 ? '' : 's'}` : `Select ${requiredVotes - selectedTargets.length} more`} <Icon name="arrow-right" size={16} />
        </button>
        <button className="text-button skip-vote-button" onClick={skipVote}>Skip this vote</button>
      </>}
      <p className="muted vote-progress-copy">{voteProgress.votes} votes cast · {voteProgress.skipped} skipped · {voteProgress.remaining} remaining</p>
    </> : active.phase === 'mr-white-guess' ? <div className="secret-card">
      <span className="eyebrow">MR. WHITE FINAL GUESS</span><h2>Hand the phone to {roundPlayers.find(player => player.id === data.mrWhiteId)?.name ?? 'Mr. White'}.</h2><p>Only Mr. White should enter the final answer.</p><h2>One chance.</h2><p>Enter the exact secret word. Capitalization and repeated spaces do not matter.</p>
      <label className="duration-setting">Your guess<input value={guess} onChange={event => setGuess(event.target.value)} autoComplete="off" /></label>
      <button className="primary" disabled={!guess.trim()} onClick={() => patchActive('resolved', { ...data, mrWhiteGuess: guess, mrWhiteCorrect: mrWhiteGuessWins(data, guess), outcome: resolveImposterVotes({ ...data, voter: data.order.length, skip: [...data.skip, ...data.order.slice(data.voter).filter(id => !data.votes[id] && !data.skip.includes(id))], votes: data.votes }) })}>Submit final guess</button>
    </div> : <div className="secret-card imposter-results">
      <span className="eyebrow">ROUND RESULTS</span>
      <h2>{data.mrWhiteCorrect ? 'Mr. White wins!' : data.mrWhiteGuess ? 'Mr. White guessed incorrectly.' : data.outcome?.kind === 'tie' ? 'It’s a tie.' : data.outcome?.kind === 'no-votes' ? 'No votes cast.' : 'Votes are in.'}</h2>
      <p>Secret word: <strong className="result-secret">{secretWord || 'Unavailable'}</strong></p>
      <div className="result-votes">
        {data.hiddenVoter !== false ? <><p>Voter identities hidden · {Object.keys(votes).length} ballots · {skippedPlayers.length} skips</p>{roundPlayers.map(player => <p key={player.id}><strong>{player.name}</strong> — {roles[player.id] ?? 'Unknown role'} · {data.outcome?.counts[player.id] ?? 0} votes received</p>)}</> : roundPlayers.map(player => <p key={player.id}>
          <strong>{player.name}</strong> — {roles[player.id] ?? 'Unknown role'}
          {votes[player.id] ? ` · voted for ${(Array.isArray(votes[player.id]) ? votes[player.id] as readonly string[] : [votes[player.id] as string]).map(id => roundPlayers.find(target => target.id === id)?.name ?? 'unknown').join(', ')}` : skippedPlayers.includes(player.id) ? ' · skipped' : ' · no vote recorded'}
          {data.outcome?.counts[player.id] ? ` · ${data.outcome.counts[player.id]} vote${data.outcome.counts[player.id] === 1 ? '' : 's'} received` : ''}
        </p>)}
      </div>
      {data.outcome?.kind === 'single-leader' && <p>Most votes: <strong>{roundPlayers.find(player => player.id === data.outcome?.leaders[0])?.name ?? 'Unknown'}</strong></p>}
      {data.outcome?.kind === 'tie' && <p>Tied players: <strong>{data.outcome.leaders.map(id => roundPlayers.find(player => player.id === id)?.name ?? id).join(', ')}</strong></p>}
      {Object.entries(data.hints ?? {}).filter(([, hint]) => Boolean(hint)).map(([id, hint]) => <p key={id}>{roundPlayers.find(player => player.id === id)?.name}: Mystic hint — {hint}</p>)}
      <p className="muted">{data.mrWhiteGuess ? `Mr. White guessed: ${data.mrWhiteGuess}` : 'Round roles and vote totals are revealed.'}</p>
      <button className="primary" onClick={() => finish('Imposter round completed', `Word: ${secretWord || 'unavailable'}; result: ${data.outcome?.kind ?? 'unresolved'}`)}>Finish round</button>
      <button className="text-button" onClick={() => { finish('Imposter round completed', `Word: ${secretWord || 'unavailable'}; result: ${data.outcome?.kind ?? 'unresolved'}`); startGame(data.setupSnapshot) }}>Play another round</button>
    </div>}
  </div>
}

function DiscussionClock({ seconds, deadline, onExpire }: { seconds: number; deadline: number | null; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds)
  const callback = useRef(onExpire)
  const fired = useRef(false)
  useEffect(() => { callback.current = onExpire }, [onExpire])
  useEffect(() => {
    const target = deadline ?? Date.now() + seconds * 1000
    const tick = () => {
      const next = Math.max(0, Math.ceil((target - Date.now()) / 1000))
      setRemaining(next)
      if (next === 0 && !fired.current) { fired.current = true; callback.current() }
    }
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [deadline, seconds])
  return <div className="discussion-clock" role="timer" aria-live="off">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')} remaining</div>
}
