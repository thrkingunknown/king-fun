import { useEffect, useMemo, useState } from 'react'
import { useClockNow } from './useClockNow.ts'
import type { ActiveGame, Player } from '../../types.ts'
import { recordArcadeVote, resolveHiddenTeamWinner } from '../../domain/games/party-arcade.ts'
import { secureShuffle } from '../../domain/random/secure-random.ts'
import { PartyButton, PartyCard, PartyMetric, PartyStage } from './PartyGameUI.tsx'

type Props = { active: ActiveGame; players: Player[]; patchActive: (phase: string, data: Record<string, any>) => void; finish: (title: string, detail: string) => void }
const playerName = (roster: Player[], id: string) => roster.find(player => player.id === id)?.name ?? 'Unknown player'
const EMPTY_ROLE_MAP: Record<string, string> = Object.freeze({})
type LocalDeductionUi = { key: string; revealed: boolean; selectedTarget: string; selectedVictim: string; selectedVote: string }

const speak = (message: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(message))
}

export function SocialDeductionGame({ active, players, patchActive, finish }: Props) {
  const data = active.data
  const roster: Player[] = Array.isArray(data.playerRoster) ? data.playerRoster : players
  const game = active.game
  const clockNow = useClockNow(active.phase === 'attempts')
  const idOrder: string[] = Array.isArray(data.revealOrder) ? data.revealOrder : Array.isArray(data.playerOrder) ? data.playerOrder : roster.map(player => player.id)
  const revealIndex = Math.max(0, Number(data.revealIndex ?? 0))
  const currentRevealId = idOrder[revealIndex]
  const currentRevealName = playerName(roster, currentRevealId ?? '')
  const aliveIds: string[] = useMemo(() => Array.isArray(data.aliveIds) ? data.aliveIds : roster.map(player => player.id), [data.aliveIds, roster])
  const alivePlayers = roster.filter(player => aliveIds.includes(player.id))
  const roleByPlayerId: Record<string, string> = data.roleByPlayerId ?? EMPTY_ROLE_MAP
  const hostileRole = game === 'mafia' ? 'Mafia' : 'Werewolf'
  const currentRole = game === 'werewolf' || game === 'mafia' ? roleByPlayerId[currentRevealId ?? ''] : null
  const votingGame = game === 'timer-impostor' || game === 'murder' || game === 'fake-story' || game === 'fact-or-fiction'
  const voterOrder: string[] = Array.isArray(data.voterOrder) ? data.voterOrder : alivePlayers.map(player => player.id)
  const voteIndex = Math.max(0, Number(data.voteIndex ?? 0))
  const currentVoterId = voterOrder[voteIndex]
  const currentVoterName = playerName(roster, currentVoterId ?? '')
  const votes: Record<string, string> = data.votes ?? {}
  // Include the night counter: Mafia/Werewolf reuse the same `night` and
  // `voting` phases each round, so phase/index alone could retain a prior
  // hidden-team target or village ballot after the next cycle begins.
  const localViewKey = `${active.phase}:${Number(data.night ?? 1)}:${revealIndex}:${voteIndex}:${Number(data.nightVoteIndex ?? 0)}:${Number(data.answerIndex ?? 0)}:${Number(data.round ?? 1)}`
  const [localUi, setLocalUi] = useState<LocalDeductionUi>({ key: '', revealed: false, selectedTarget: '', selectedVictim: '', selectedVote: '' })
  const currentUi = localUi.key === localViewKey
    ? localUi
    : { key: localViewKey, revealed: false, selectedTarget: '', selectedVictim: '', selectedVote: '' }
  const { revealed, selectedTarget, selectedVictim, selectedVote } = currentUi
  const updateUi = (patch: Partial<Omit<LocalDeductionUi, 'key'>>) => setLocalUi(current => ({
    ...(current.key === localViewKey ? current : { key: localViewKey, revealed: false, selectedTarget: '', selectedVictim: '', selectedVote: '' }),
    ...patch,
  }))

  useEffect(() => {
    if (game !== 'murder' || active.phase !== 'investigation') return
    const eligibleVictims = aliveIds.filter(id => id !== data.murdererId)
    if (eligibleVictims.length === 0) patchActive('results', { ...data, winner: 'murderer', correct: false, voteResult: 'No witnesses remain.' })
  }, [game, active.phase, aliveIds, data, patchActive])

  useEffect(() => {
    if ((game !== 'werewolf' && game !== 'mafia') || active.phase !== 'night') return
    const hostileIds = aliveIds.filter(id => roleByPlayerId[id] === hostileRole)
    const validVoters = (data.nightVoterOrder ?? hostileIds).filter((id: string) => hostileIds.includes(id))
    const validTargets = aliveIds.filter(id => !hostileIds.includes(id))
    if (validVoters.length > 0 && validTargets.length > 0) return
    const winner = resolveHiddenTeamWinner(roleByPlayerId, aliveIds, hostileRole)
    patchActive(winner ? 'complete' : 'day', { ...data, winner, nightVictimId: null, nightVoteResult: 'no-target' })
  }, [game, active.phase, aliveIds, data, patchActive, roleByPlayerId, hostileRole])


  const advanceReveal = () => {
    if (revealIndex + 1 >= idOrder.length) {
      if (game === 'timer-impostor') patchActive('attempts', { ...data, attempts: [], attemptIndex: 0, attemptStartedAt: null })
      else if (game === 'werewolf' || game === 'mafia') {
        patchActive('night', { ...data, revealIndex: 0, nightVictimId: null, votes: {}, voteIndex: 0 })
        if (data.phoneNarrator) speak('The village is going to sleep. The hidden team may choose one player.')
      } else if (game === 'murder') patchActive('investigation', { ...data, revealIndex: 0 })
      else patchActive(game === 'fake-story' ? 'storytelling' : 'answering', { ...data, revealIndex: 0, answerIndex: 0 })
    } else patchActive('private-reveal', { ...data, revealIndex: revealIndex + 1 })
  }

  const submitVote = () => {
    if (!selectedVote || !currentVoterId) return
    const nextVotes = recordArcadeVote(votes, currentVoterId, selectedVote, [...alivePlayers.map(player => player.id), 'skip'])
    const nextIndex = voteIndex + 1
    if (nextIndex < voterOrder.length) {
      patchActive(active.phase, { ...data, votes: nextVotes, voteIndex: nextIndex })
      return
    }
    if (game === 'werewolf' || game === 'mafia') {
      const voteCountsNext = Object.entries(nextVotes).reduce<Record<string, number>>((result, [, target]) => {
        if (target !== 'skip') result[target] = (result[target] ?? 0) + 1
        return result
      }, {})
      const highest = Math.max(0, ...Object.values(voteCountsNext))
      const nextLeaders = Object.entries(voteCountsNext).filter(([, count]) => count === highest && highest > 0).map(([id]) => id)
      const eliminatedId = nextLeaders.length === 1 ? nextLeaders[0] : null
      const nextAlive = eliminatedId ? aliveIds.filter(id => id !== eliminatedId) : aliveIds
      const winner = resolveHiddenTeamWinner(roleByPlayerId, nextAlive, hostileRole)
      const nextData = { ...data, votes: nextVotes, aliveIds: nextAlive, lastVotedOutId: eliminatedId, voteResult: nextLeaders.length > 1 ? 'tie' : eliminatedId ? 'eliminated' : 'skip', voteIndex: 0, nightVictimId: null, dayVotes: nextVotes, night: Number(data.night ?? 1) + 1 }
      if (winner) patchActive('complete', { ...nextData, winner })
      else { const livingHostiles = nextAlive.filter(id => roleByPlayerId[id] === hostileRole); patchActive('night', { ...nextData, votes: {}, dayVotes: {}, nightVotes: {}, nightVoteIndex: 0, nightVoterOrder: secureShuffle(livingHostiles) }) }
      return
    }
    const finalCounts = voteCountsNextFor(nextVotes)
    const highest = Math.max(0, ...Object.values(finalCounts))
    const finalLeaders = Object.entries(finalCounts).filter(([, count]) => count === highest && highest > 0).map(([id]) => id)
    const finalLeader = finalLeaders.length === 1 ? finalLeaders[0] : null
    const correctId = game === 'timer-impostor' ? data.impostorId : game === 'murder' ? data.murdererId : data.secretPlayerId
    const correct = finalLeader === correctId
    if (game === 'murder' && !correct && aliveIds.length > 2) {
      patchActive('investigation', { ...data, votes: {}, voteIndex: 0, voterOrder: [], voteResult: 'The murderer was not identified. Another wink round begins.', round: Number(data.round ?? 1) + 1 })
      return
    }
    patchActive('results', { ...data, votes: nextVotes, correct, winner: game === 'murder' && !correct ? 'murderer' : null, voteCounts: finalCounts, voteResult: finalLeader ? playerName(roster, finalLeader) : 'No clear majority' })
  }

  function voteCountsNextFor(nextVotes: Record<string, string>) {
    return Object.entries(nextVotes).reduce<Record<string, number>>((result, [, target]) => {
      if (target !== 'skip') result[target] = (result[target] ?? 0) + 1
      return result
    }, {})
  }

  if (active.phase === 'private-reveal') {
    if (!currentRevealId) return <PartyStage eyebrow="PRIVATE DEAL" title="Roles dealt" subtitle="The round is ready."><PartyButton onClick={() => advanceReveal()}>Continue</PartyButton></PartyStage>
    const role = game === 'werewolf' || game === 'mafia'
      ? currentRole
      : game === 'murder' ? (currentRevealId === data.murdererId ? 'Murderer' : 'Witness')
        : game === 'timer-impostor' ? (currentRevealId === data.impostorId ? 'Impostor · no target time' : `Target time · ${data.targetSeconds} seconds`)
          : game === 'fake-story' ? (currentRevealId === data.secretPlayerId ? 'Invent a believable story' : 'Tell a true story')
            : (currentRevealId === data.secretPlayerId ? 'You are the impostor. Say the opposite.' : `The statement is ${data.promptTruth ? 'TRUE' : 'FALSE'}. Answer honestly.`)
    const instruction = game === 'werewolf' || game === 'mafia'
      ? currentRole === hostileRole ? 'Remember your team. At night, your team chooses one living villager.' : 'You are on the village side. Observe carefully and discuss during the day.'
      : game === 'murder' ? currentRevealId === data.murdererId ? 'Secretly wink at other players to eliminate them. Do not reveal your role.' : 'Watch the room. If the murderer winks at you, report it during the investigation.'
        : game === 'timer-impostor' ? currentRevealId === data.impostorId ? 'You do not know the target time. Make a convincing attempt and blend in.' : 'Memorise the target. You will individually stop a timer as close to this duration as possible.'
          : game === 'fake-story' ? currentRevealId === data.secretPlayerId ? 'Invent a plausible story that fits the same prompt.' : 'Tell a real story that fits the prompt.'
            : currentRevealId === data.secretPlayerId ? 'Your job is to lie about this statement. Avoid being identified.' : 'Remember the factual verdict and state it confidently.'
    return <PartyStage eyebrow="PASS THE DEVICE · PRIVATE REVEAL" title={`Hand it to ${currentRevealName}.`} subtitle="Only this player should look at the next card.">
      <PartyCard tone="accent" className="private-role-card">
        <p className="party-card-label">{currentRevealName.toUpperCase()} · PRIVATE ROLE</p>
        {!revealed ? <><h2>Ready to see your role?</h2><p>Make sure the rest of the group cannot see the screen.</p><PartyButton onClick={() => updateUi({ revealed: true })}>Reveal privately</PartyButton></> : <><h2>{role}</h2><p>{instruction}</p><PartyButton onClick={advanceReveal}>Hide & pass device</PartyButton></>}
      </PartyCard>
      <div className="party-progress-note">PLAYER {revealIndex + 1} OF {idOrder.length}</div>
    </PartyStage>
  }

  if (game === 'timer-impostor' && active.phase === 'attempts') {
    const order: string[] = data.playerOrder ?? roster.map(player => player.id)
    const attemptIndex = Number(data.attemptIndex ?? 0)
    const currentId = order[attemptIndex]
    const currentName = playerName(roster, currentId ?? '')
    const attempts: Array<{ playerId: string; seconds: number }> = data.attempts ?? []
    const startAt = Number.isFinite(data.attemptStartedAt) ? Number(data.attemptStartedAt) : null
    const elapsed = startAt ? Math.max(0, (clockNow - startAt) / 1000) : 0
    const stopAttempt = () => {
      if (!currentId || !startAt) return
      const next = [...attempts, { playerId: currentId, seconds: Math.round((Date.now() - startAt) / 100) / 10 }]
      if (attemptIndex + 1 >= order.length) patchActive('voting', { ...data, attempts: next, attemptStartedAt: null, voterOrder: secureShuffle(roster.map(player => player.id)), voteIndex: 0, votes: {} })
      else patchActive('attempts', { ...data, attempts: next, attemptIndex: attemptIndex + 1, attemptStartedAt: null })
    }
    return <PartyStage eyebrow="TIMER IMPOSTOR · SILENT COUNT" title={startAt ? 'Stop when you think time is up.' : `Your turn, ${currentName}.`} subtitle="Each player makes one private attempt. Do not say the target out loud.">
      <PartyCard tone="accent"><p className="party-card-label">ATTEMPT {attemptIndex + 1} / {order.length}</p><h2 className="party-clock">{elapsed.toFixed(1)}<small>s</small></h2><p>{startAt ? 'Count silently. Stop when you believe the secret time has passed.' : 'Pass the device to the next player before starting your clock.'}</p>
        {!startAt ? <PartyButton onClick={() => { const now = Date.now(); patchActive('attempts', { ...data, attemptStartedAt: now }) }}>Start my clock</PartyButton> : <PartyButton variant="danger" onClick={stopAttempt}>Stop clock</PartyButton>}
      </PartyCard>
      <p className="party-progress-note">{attempts.length} of {order.length} attempts recorded.</p>
    </PartyStage>
  }

  if ((game === 'werewolf' || game === 'mafia') && active.phase === 'night') {
    const hostileIds = aliveIds.filter(id => roleByPlayerId[id] === hostileRole)
    const nightOrder: string[] = (data.nightVoterOrder ?? hostileIds).filter((id: string) => hostileIds.includes(id))
    const nightVotes: Record<string, string> = data.nightVotes ?? {}
    const nightIndex = Number(data.nightVoteIndex ?? 0)
    const nightVoterId = nightOrder[nightIndex]
    const nightVoterName = playerName(roster, nightVoterId ?? '')
    const candidates = alivePlayers.filter(player => !hostileIds.includes(player.id))
    const confirmNight = () => {
      if (!nightVoterId || !selectedTarget || !candidates.some(player => player.id === selectedTarget)) return
      let nextVotes: Record<string, string>
      try { nextVotes = recordArcadeVote(nightVotes, nightVoterId, selectedTarget, candidates.map(player => player.id)) } catch { return }
      if (nightIndex + 1 < nightOrder.length) {
        patchActive('night', { ...data, nightVotes: nextVotes, nightVoteIndex: nightIndex + 1 })
        return
      }
      const counts = Object.values(nextVotes).reduce<Record<string, number>>((out, id) => { out[id] = (out[id] ?? 0) + 1; return out }, {})
      const highest = Math.max(0, ...Object.values(counts))
      const leaders = Object.entries(counts).filter(([, count]) => count === highest && highest > 0).map(([id]) => id)
      const victimId = leaders.length === 1 ? leaders[0] : null
      const victim = victimId ? playerName(roster, victimId) : null
      const nextAlive = victimId ? aliveIds.filter(id => id !== victimId) : aliveIds
      const winner = resolveHiddenTeamWinner(roleByPlayerId, nextAlive, hostileRole)
      const nextData = { ...data, aliveIds: nextAlive, nightVictimId: victimId, nightVictimName: victim, nightVotes: nextVotes, nightVoteResult: victimId ? 'eliminated' : 'tie', nightVoteIndex: 0, votes: {}, voteIndex: 0 }
      if (winner) patchActive('complete', { ...nextData, winner })
      else patchActive('day', nextData)
      if (data.phoneNarrator) speak(victim ? `Morning. ${victim} was found out of the game. The village may discuss.` : 'Morning. The hidden team could not agree. No one was eliminated.')
    }
    if (!nightVoterId || candidates.length === 0) {
      return <PartyStage eyebrow="NIGHT PHASE" title="The night has ended." subtitle="There are no eligible targets remaining."><PartyCard><p className="party-help">The phase will resolve from the saved living-player state.</p></PartyCard></PartyStage>
    }
    return <PartyStage eyebrow={`${game === 'mafia' ? 'MAFIA' : 'WEREWOLF'} · NIGHT ${data.night}`} title={`Pass the device to ${nightVoterName}.`} subtitle={data.phoneNarrator ? 'The phone is narrating this phase. Only the hidden team should see this private ballot.' : 'The moderator should pass the device privately to each living hidden-team member.'}>
      <PartyCard tone="warning"><p className="party-card-label">HIDDEN TEAM · PRIVATE BALLOT {nightIndex + 1} / {nightOrder.length}</p><h2>Choose one living player.</h2><p>Do not select a member of your own team. The hidden team must agree on one target; a tie means no night elimination.</p>
        <div className="party-choice-grid">{candidates.map(player => <button key={player.id} type="button" className={selectedTarget === player.id ? 'is-selected' : ''} onClick={() => updateUi({ selectedTarget: player.id })}>{player.name}</button>)}</div>
        <PartyButton onClick={confirmNight} disabled={!selectedTarget}>Lock private night vote</PartyButton>
      </PartyCard>
      <p className="party-progress-note">{aliveIds.length} players remain · {nightVotes && Object.keys(nightVotes).length} hidden-team ballots recorded</p>
    </PartyStage>
  }

  if ((game === 'werewolf' || game === 'mafia') && active.phase === 'day') {
    const victim = data.nightVictimId ? playerName(roster, data.nightVictimId) : null
    return <PartyStage eyebrow={`MORNING · NIGHT ${data.night}`} title={victim ? `${victim} did not survive.` : 'The night passed quietly.'} subtitle="The village may now discuss what happened and choose who to vote out.">
      <PartyCard><p>{victim ? 'The eliminated player is out of the voting roster. They may observe but cannot vote.' : 'No one was eliminated this night.'}</p><PartyMetric label="ALIVE" value={aliveIds.length} /><PartyButton onClick={() => patchActive('voting', { ...data, votes: {}, voteIndex: 0, voterOrder: secureShuffle(aliveIds) })}>Start village vote</PartyButton></PartyCard>
    </PartyStage>
  }

  if (active.phase === 'investigation' && game === 'murder') {
    const candidates = alivePlayers.filter(player => player.id !== data.murdererId)
    return <PartyStage eyebrow="MURDER · INVESTIGATION" title="Someone has been winked out." subtitle="The eliminated player should identify themselves honestly. The group then votes on the murderer.">
      <PartyCard><h2>Who was winked at?</h2><div className="party-choice-grid">{candidates.map(player => <button type="button" key={player.id} className={selectedVictim === player.id ? 'is-selected' : ''} onClick={() => updateUi({ selectedVictim: player.id })}>{player.name}</button>)}</div><PartyButton onClick={() => patchActive('voting', { ...data, winkedPlayerIds: [...(data.winkedPlayerIds ?? []), selectedVictim], aliveIds: aliveIds.filter(id => id !== selectedVictim), votes: {}, voteIndex: 0, voterOrder: secureShuffle(aliveIds.filter(id => id !== selectedVictim)) })} disabled={!selectedVictim}>Confirm eliminated player</PartyButton></PartyCard>
    </PartyStage>
  }

  if (active.phase === 'storytelling' || active.phase === 'answering') {
    const order: string[] = data.revealOrder ?? roster.map(player => player.id)
    const index = Number(data.answerIndex ?? 0)
    const turnId = order[index]
    const next = () => {
      if (index + 1 >= order.length) patchActive('voting', { ...data, answerIndex: index + 1, votes: {}, voteIndex: 0, voterOrder: secureShuffle(roster.map(player => player.id)) })
      else patchActive(active.phase, { ...data, answerIndex: index + 1 })
    }
    return <PartyStage eyebrow={game === 'fake-story' ? 'FAKE STORY' : 'FACT OR FICTION'} title={game === 'fake-story' ? 'Tell your version.' : 'State your verdict.'} subtitle={data.prompt}>
      <PartyCard><p className="party-card-label">{playerName(roster, turnId ?? '')} · YOUR TURN</p><h2>{game === 'fake-story' ? 'Share your story with the group.' : 'Say whether the statement is true or false.'}</h2><p>{game === 'fake-story' ? 'Everyone except one player received the same instruction to tell a true story.' : 'One player has been privately instructed to lie. Listen for inconsistencies.'}</p><PartyButton onClick={next}>{index + 1 >= order.length ? 'Move to the vote' : 'Next player'}</PartyButton></PartyCard>
      <p className="party-progress-note">PLAYER {index + 1} OF {order.length}</p>
    </PartyStage>
  }

  if (active.phase === 'voting' && (votingGame || game === 'werewolf' || game === 'mafia')) {
    const candidates = game === 'werewolf' || game === 'mafia' || game === 'murder' ? alivePlayers : roster
    const choices = candidates.filter(player => player.id !== currentVoterId)
    return <PartyStage eyebrow="PRIVATE VOTE · PASS THE DEVICE" title={`Your vote, ${currentVoterName}.`} subtitle="Choose one suspect. Other players should not see your selection.">
      <PartyCard tone="accent"><p className="party-card-label">VOTER {voteIndex + 1} / {voterOrder.length}</p><div className="party-choice-grid">{choices.map(player => <button type="button" key={player.id} className={selectedVote === player.id ? 'is-selected' : ''} onClick={() => updateUi({ selectedVote: player.id })}>{player.name}</button>)}</div><PartyButton variant="secondary" onClick={() => updateUi({ selectedVote: 'skip' })}>Skip vote</PartyButton><PartyButton onClick={submitVote} disabled={!selectedVote}>Submit private vote</PartyButton></PartyCard>
    </PartyStage>
  }

  if (active.phase === 'results' || active.phase === 'complete') {
    const winner = data.winner === 'hostile' ? `${hostileRole} win` : data.winner === 'village' ? 'The village wins' : null
    const hiddenId = game === 'timer-impostor' ? data.impostorId : game === 'murder' ? data.murdererId : data.secretPlayerId
    const hiddenName = playerName(roster, hiddenId)
    const title = game === 'werewolf' || game === 'mafia' ? winner ?? 'Round complete'
      : game === 'timer-impostor' ? (data.correct ? 'The impostor was caught.' : 'The impostor slipped through.')
        : game === 'murder' ? (data.correct ? 'The murderer was identified.' : data.winner === 'murderer' ? 'The murderer survived every accusation.' : 'The murderer escaped the vote.')
          : (data.correct ? 'The group found the faker.' : 'The faker fooled the group.')
    const attempts: Array<{ playerId: string; seconds: number }> = data.attempts ?? []
    return <PartyStage eyebrow={game === 'murder' ? `MURDER · ROUND ${data.round ?? 1}` : 'CASE CLOSED'} title={title} subtitle={game === 'werewolf' || game === 'mafia' ? 'All roles are revealed below.' : `The hidden role was ${hiddenName}.`}>
      <PartyCard tone={data.correct || winner === 'The village wins' ? 'accent' : 'warning'}><p className="party-card-label">FINAL REVEAL</p>{game === 'werewolf' || game === 'mafia' ? roster.map(player => <div className="party-result-row" key={player.id}><span>{player.name}</span><strong>{roleByPlayerId[player.id]}</strong></div>) : <h2>{hiddenName}</h2>}<p>{game === 'timer-impostor' ? `The target time was ${data.targetSeconds} seconds.` : game === 'fact-or-fiction' ? `The statement was ${data.promptTruth ? 'true' : 'false'}.` : game === 'fake-story' ? 'The group heard one invented story.' : ''}</p>
        {attempts.length > 0 && <div className="party-result-list">{attempts.map(item => <div key={item.playerId}><span>{playerName(roster, item.playerId)}</span><strong>{item.seconds.toFixed(1)}s</strong></div>)}</div>}
        <PartyButton onClick={() => finish(`${game} completed`, `${title} · hidden role: ${hiddenName}`)}>Save result</PartyButton>
      </PartyCard>
    </PartyStage>
  }

  return <PartyStage eyebrow="SOCIAL DEDUCTION" title="Round state saved." subtitle="Continue the current phase or exit to resume later."><PartyButton onClick={() => finish('Game ended', `Ended during ${active.phase}.`)}>End game</PartyButton></PartyStage>
}
