import { useEffect, useState } from 'react'
import type { ActiveGame, Player } from '../../types.ts'
import { recordArcadeVote } from '../../domain/games/party-arcade.ts'
import { secureShuffle } from '../../domain/random/secure-random.ts'
import { PartyActions, PartyButton, PartyCard, PartyMetric, PartyStage } from './PartyGameUI.tsx'

type Props = { active: ActiveGame; players: Player[]; patchActive: (phase: string, data: Record<string, any>) => void; finish: (title: string, detail: string) => void }
type PromptAnswer = { playerId: string; text: string }
type PromptResultRow = { id: string; label: string; votes: number }
type LocalPromptUi = { key: string; text: string; choice: string; wordRevealed: boolean }
const getName = (players: Player[], id: string) => players.find(player => player.id === id)?.name ?? 'Player'
const normalizeGuess = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLocaleLowerCase()
const tally = (votes: Record<string, string>) => Object.values(votes).reduce<Record<string, number>>((out, value) => { out[value] = (out[value] ?? 0) + 1; return out }, {})

/** Shared controllers for conversational, bluffing, polling and preference games. */
export function PromptArcadeGame({ active, players, patchActive, finish }: Props) {
  const d = active.data
  const roster: Player[] = Array.isArray(d.playerRoster) ? d.playerRoster : players
  const game = active.game
  const localViewKey = `${active.phase}:${Number(d.entryIndex ?? d.answerIndex ?? d.index ?? 0)}:${Number(d.voteIndex ?? 0)}:${Number(d.guessIndex ?? 0)}`
  const [localUi, setLocalUi] = useState<LocalPromptUi>({ key: '', text: '', choice: '', wordRevealed: false })
  const currentUi = localUi.key === localViewKey ? localUi : { key: localViewKey, text: '', choice: '', wordRevealed: false }
  const text = currentUi.text
  const choice = currentUi.choice
  const wordRevealed = currentUi.wordRevealed
  const updateUi = (patch: Partial<Omit<LocalPromptUi, 'key'>>) => setLocalUi(current => ({
    ...(current.key === localViewKey ? current : { key: localViewKey, text: '', choice: '', wordRevealed: false }),
    ...patch,
  }))
  const order: string[] = Array.isArray(d.playerOrder) ? d.playerOrder : roster.map(player => player.id)
  const index = Math.max(0, Number(d.entryIndex ?? d.answerIndex ?? d.index ?? 0))
  const turnId = order[index] ?? roster[0]?.id ?? ''
  const currentVotes: Record<string, string> = d.votes ?? {}
  const voterOrder: string[] = Array.isArray(d.voterOrder) ? d.voterOrder : roster.map(player => player.id)
  const voteIndex = Math.max(0, Number(d.voteIndex ?? 0))
  const voterId = voterOrder[voteIndex] ?? ''
  useEffect(() => {
    if (game !== 'wrong-answers-only' || !d.readPromptsAloud || active.phase !== 'answering' || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(String(d.prompt ?? '')))
    return () => window.speechSynthesis.cancel()
  }, [game, d.prompt, d.readPromptsAloud, active.phase])
  const setVote = (target: string) => {
    if (!voterId) return
    try {
      const allowed = target === 'skip' ? ['skip']
          : game === 'would-you-rather' ? ['A', 'B']
            : roster.map(player => player.id)
      const nextVotes = recordArcadeVote(currentVotes, voterId, target, allowed)
      if (voteIndex + 1 < voterOrder.length) patchActive(active.phase, { ...d, votes: nextVotes, voteIndex: voteIndex + 1 })
      else {
        const voteCounts = tally(nextVotes)
        const voteHistory = [...(d.voteHistory ?? []), { promptId: d.promptId, prompt: d.prompt, optionA: d.optionA, optionB: d.optionB, voteCounts }]
        patchActive('results', { ...d, votes: nextVotes, voteCounts, voteHistory })
      }
    } catch { /* Duplicate or invalid ballots are ignored; the saved ballot remains authoritative. */ }
  }

  if (game === 'fake-it' && active.phase === 'private-reveal') {
    const holderName = getName(roster, d.wordHolderId)
    return <PartyStage eyebrow="FAKE IT · SECRET WORD" title={`Pass the device to ${holderName}.`} subtitle="Only the word-holder should see the screen. The rest of the group will ask yes/no questions.">
      <PartyCard tone="accent">
        <p className="party-card-label">WORD HOLDER · PRIVATE REVEAL</p>
        {!wordRevealed
          ? <><h2>Ready to see the secret word?</h2><p>Keep the word hidden from everyone else. You may answer yes/no questions, but do not say the word itself.</p><PartyButton onClick={() => updateUi({ wordRevealed: true })}>Reveal secret word</PartyButton></>
          : <><h2 className="identity-card">{d.secretWord}</h2><p>Remember this word. Hide the screen before passing the device back to the group.</p><PartyButton onClick={() => patchActive('questioning', { ...d, questionRoundStartedAt: Date.now() })}>Hide word · start questions</PartyButton></>}
      </PartyCard>
    </PartyStage>
  }

  if (game === 'fake-it' && active.phase === 'questioning') {
    return <PartyStage eyebrow="FAKE IT · YES / NO" title="Question the word-holder." subtitle={`${getName(roster, d.wordHolderId)} knows the secret word. Ask clear questions that can be answered with yes or no.`}>
      <PartyCard tone="accent"><p className="party-card-label">CATEGORY</p><h2>{d.prompt}</h2><p>Ask as many yes/no questions as the group needs. The word-holder answers aloud without revealing the word. When everyone is ready, begin one private guess per player.</p><PartyMetric label="PLAYERS GUESSING" value={(d.guessOrder ?? []).length}/><PartyButton onClick={() => patchActive('guessing', { ...d, guessIndex: 0, guesses: [] })}>Start guesses</PartyButton></PartyCard>
    </PartyStage>
  }

  if (game === 'fake-it' && active.phase === 'guessing') {
    const guessOrder: string[] = d.guessOrder ?? []
    const guessIndex = Number(d.guessIndex ?? 0)
    const guesserId = guessOrder[guessIndex]
    const guesserName = getName(roster, guesserId ?? '')
    const guesses: Array<{ playerId: string; value: string; correct: boolean; skipped?: boolean }> = d.guesses ?? []
    const submitGuess = (skip = false) => {
      if (!guesserId || (!skip && !text.trim())) return
      const value = skip ? '' : text.trim().slice(0, 80)
      const correct = !skip && normalizeGuess(value) === normalizeGuess(String(d.secretWord ?? ''))
      const nextGuesses = [...guesses, { playerId: guesserId, value, correct, skipped: skip }]
      updateUi({ text: '' })
      const solvedBy = d.solvedBy ?? (correct ? guesserId : null)
      // Preserve one guess for every non-holder, even after an early correct guess.
      if (guessIndex + 1 >= guessOrder.length) {
        patchActive('results', { ...d, guesses: nextGuesses, solvedBy })
      } else {
        patchActive('guessing', { ...d, guesses: nextGuesses, guessIndex: guessIndex + 1, solvedBy })
      }
    }
    return <PartyStage eyebrow={`FAKE IT · GUESS ${guessIndex + 1} / ${guessOrder.length}`} title={`Make your guess, ${guesserName}.`} subtitle="The group has finished asking yes/no questions. Each player gets one guess; do not look at the word-holder's screen.">
      <PartyCard tone="accent"><p className="party-card-label">ONE GUESS EACH</p><label className="party-field-label" htmlFor="fake-it-guess">Your guess</label><input id="fake-it-guess" className="party-input" value={text} maxLength={80} onChange={event => updateUi({ text: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') submitGuess() }} autoComplete="off" placeholder="Name the secret word…"/><PartyButton onClick={() => submitGuess()} disabled={!text.trim()}>Lock guess</PartyButton><PartyButton variant="quiet" onClick={() => submitGuess(true)}>Pass this guess</PartyButton><p className="party-progress-note">{guesses.length} of {guessOrder.length} guesses recorded.</p></PartyCard>
    </PartyStage>
  }

  if (game === 'wrong-answers-only' && active.phase === 'answering') {
    const answers: PromptAnswer[] = Array.isArray(d.answers) ? d.answers : []
    const submit = () => {
      const value = text.trim().slice(0, 120)
      if (!value || !turnId) return
      const next = [...answers, { playerId: turnId, text: value }]
      updateUi({ text: '' })
      if (index + 1 < order.length) patchActive('answering', { ...d, answers: next, answerIndex: index + 1 })
      else patchActive('judging', { ...d, answers: next, votes: {}, voterOrder: secureShuffle(roster.map(player => player.id)), voteIndex: 0 })
    }
    return <PartyStage eyebrow="WRONG ANSWERS ONLY" title={`Your turn, ${getName(roster, turnId)}.`} subtitle="Give the funniest wrong answer you can. The obvious correct answer is not allowed."><PartyCard tone="accent"><p className="party-card-label">PROMPT</p><h2>{d.prompt}</h2><label className="party-field-label" htmlFor="wrong-answer">Your wrong answer</label><input id="wrong-answer" className="party-input" value={text} maxLength={120} onChange={event => updateUi({ text: event.target.value })} onKeyDown={event => { if (event.key === 'Enter') submit() }} /><PartyButton onClick={submit} disabled={!text.trim()}>Submit answer</PartyButton><p className="party-progress-note">PLAYER {index + 1} OF {order.length}</p></PartyCard></PartyStage>
  }

  if ((game === 'wrong-answers-only' && active.phase === 'judging') || active.phase === 'voting') {
    const answers: PromptAnswer[] = Array.isArray(d.answers) ? d.answers : []
    const question = game === 'wrong-answers-only' ? `Vote for the funniest answer, ${getName(roster, voterId)}.` : game === 'whos-most-likely' ? `Who is most likely, ${getName(roster, voterId)}?` : `Choose your preference, ${getName(roster, voterId)}.`
      const isLikely = game === 'whos-most-likely'
    const candidates = isLikely ? roster : []
    return <PartyStage eyebrow={game.replaceAll('-', ' ').toUpperCase()} title={question} subtitle={game === 'would-you-rather' ? `${d.optionA} or ${d.optionB}` : d.prompt}>
      <PartyCard tone="accent">
        {game === 'wrong-answers-only' ? answers.map((answer: any, i: number) => <button type="button" key={answer.playerId} className={`party-option${choice === answer.playerId ? ' is-selected' : ''}`} onClick={() => updateUi({ choice: answer.playerId })}><span>{String.fromCharCode(65 + i)}</span><strong>{getName(roster, answer.playerId)}:</strong> {answer.text}</button>)
          : isLikely ? candidates.filter(player => player.id !== voterId).map(player => <button type="button" className={`party-option${choice === player.id ? ' is-selected' : ''}`} key={player.id} onClick={() => updateUi({ choice: player.id })}><span>◎</span>{player.name}</button>)
            : <><button type="button" className={`party-option${choice === 'A' ? ' is-selected' : ''}`} onClick={() => updateUi({ choice: 'A' })}><span>A</span>{d.optionA || d.prompt}</button><button type="button" className={`party-option${choice === 'B' ? ' is-selected' : ''}`} onClick={() => updateUi({ choice: 'B' })}><span>B</span>{d.optionB}</button></>}
        <PartyButton onClick={() => setVote(choice)} disabled={!choice}>Submit private vote</PartyButton><p className="party-progress-note">VOTE {voteIndex + 1} OF {voterOrder.length}</p>
      </PartyCard>
    </PartyStage>
  }

  if (game === 'a-or-b' && active.phase === 'results') {
    const scores: Record<string, number> = d.scoreByPlayer ?? {}
    return <PartyStage eyebrow="A OR B · FINAL SCORE" title="How well do you know each other?" subtitle="The player with the most correct preference guesses leads the session."><PartyCard tone="accent">{roster.map(player => <div className="party-result-row" key={player.id}><span>{player.name}</span><strong>{scores[player.id] ?? 0} correct</strong></div>)}<PartyButton onClick={() => finish('A or B', 'Preference rounds completed.')}>Save result</PartyButton></PartyCard></PartyStage>
  }

  if (game === 'fake-it' && active.phase === 'results') {
    const guesses: Array<{ playerId: string; value: string; correct: boolean; skipped?: boolean }> = d.guesses ?? []
    const solvedBy = d.solvedBy ? getName(roster, d.solvedBy) : null
    return <PartyStage eyebrow="FAKE IT · REVEAL" title={solvedBy ? `${solvedBy} found the word.` : 'The word stayed hidden.'} subtitle={`The secret word was ${d.secretWord}.`}><PartyCard tone="accent"><p className="party-card-label">SECRET WORD</p><h2>{d.secretWord}</h2>{guesses.map(guess => <div className="party-result-row" key={guess.playerId}><span>{getName(roster, guess.playerId)}</span><strong>{guess.skipped ? 'Passed' : guess.correct ? 'Correct' : guess.value}</strong></div>)}<PartyButton onClick={() => finish('Fake It', `${solvedBy ?? 'No one'} guessed ${d.secretWord}.`)}>Save result</PartyButton></PartyCard></PartyStage>
  }

  if (active.phase === 'results' && ['wrong-answers-only', 'whos-most-likely', 'would-you-rather'].includes(game)) {
    const counts: Record<string, number> = d.voteCounts ?? {}
    const deck: Array<{ id: string; text: string }> = d.deck ?? []
    const nextIndex = Number(d.index ?? 0) + 1
    const hasNext = nextIndex < deck.length
    const completedRounds = (d.voteHistory ?? []).length
    const advancePrompt = () => {
      if (!hasNext) {
        finish(game.replaceAll('-', ' '), `${completedRounds} prompt rounds completed.`)
        return
      }
      const nextPrompt = deck[nextIndex]!
      const [optionA, optionB] = nextPrompt.text.split('||').map(value => value.trim())
      const nextData = {
        ...d, index: nextIndex, promptId: nextPrompt.id,
        prompt: game === 'would-you-rather' ? optionA ?? nextPrompt.text : nextPrompt.text,
        optionA: optionA ?? '', optionB: optionB ?? '',
        answers: [], answerIndex: 0, votes: {}, voteCounts: {},
        voterOrder: secureShuffle(roster.map(player => player.id)), voteIndex: 0,
      }
      patchActive(game === 'wrong-answers-only' ? 'answering' : 'voting', nextData)
    }
    const resultRows: PromptResultRow[] = game === 'wrong-answers-only'
      ? (d.answers ?? []).map((answer: { playerId: string; text: string }) => ({ id: answer.playerId, label: `${getName(roster, answer.playerId)}: ${answer.text}`, votes: counts[answer.playerId] ?? 0 }))
      : Object.entries(counts).map(([target, count]) => ({
          id: target,
          label: game === 'whos-most-likely' ? getName(roster, target) : target === 'A' ? d.optionA : d.optionB,
          votes: Number(count),
        }))
    resultRows.sort((a, b) => b.votes - a.votes)
    const roundTitle = game === 'wrong-answers-only' ? 'The funniest answer wins.' : game === 'whos-most-likely' ? 'The group has chosen.' : 'The room has picked a side.'
    return <PartyStage eyebrow={`${game.replaceAll('-', ' ').toUpperCase()} · ROUND ${Number(d.index ?? 0) + 1} / ${deck.length}`} title={roundTitle} subtitle="Every ballot is locked. Review this round, then continue through the remaining prompt deck."><PartyCard tone="accent">{resultRows.map((row, index) => <div className="party-result-row" key={row.id}><span>{index + 1}. {row.label}</span><strong>{row.votes} vote{row.votes === 1 ? '' : 's'}</strong></div>)}<PartyActions><PartyButton onClick={advancePrompt}>{hasNext ? 'Next prompt' : 'Save session'}</PartyButton><PartyButton variant="quiet" onClick={() => finish(game.replaceAll('-', ' '), `${completedRounds} prompt rounds completed.`)}>End session</PartyButton></PartyActions><p className="party-progress-note">{completedRounds} of {deck.length} prompt rounds completed.</p></PartyCard></PartyStage>
  }

  if (game === 'a-or-b' && active.phase === 'results') {
    const scores: Record<string, number> = d.scoreByPlayer ?? {}
    const ranked = roster.map(player => ({ player, score: Number(scores[player.id] ?? 0) })).sort((left, right) => right.score - left.score || left.player.name.localeCompare(right.player.name))
    const topScore = ranked[0]?.score ?? 0
    const winners = ranked.filter(row => row.score === topScore)
    return <PartyStage eyebrow="A OR B · FINAL RESULTS" title={winners.length === 1 ? `${winners[0]!.player.name} knows the group best.` : 'It is a shared result.'} subtitle="Every player has been the chooser once. Correct predictions are ranked below."><PartyCard tone="accent"><div className="party-result-list">{ranked.map((row, index) => <div key={row.player.id}><span>{index + 1}. {row.player.name}</span><strong>{row.score} point{row.score === 1 ? '' : 's'}</strong></div>)}</div><PartyButton onClick={() => finish('A or B', `${winners.map(row => row.player.name).join(', ')} · ${topScore} correct predictions.`)}>Save standings</PartyButton></PartyCard></PartyStage>
  }

  if (active.phase === 'results') {
    return <PartyStage eyebrow="ROUND RESULTS" title="The room has spoken." subtitle="The tallies below are calculated from the locked ballots."><PartyCard tone="accent">{Object.entries((d.voteCounts ?? {}) as Record<string, number>).sort((a, b) => Number(b[1]) - Number(a[1])).map(([target, count]) => <div className="party-result-row" key={target}><span>{game === 'fake-it' ? getName(roster, target) : target}</span><strong>{Number(count)} vote{Number(count) === 1 ? '' : 's'}</strong></div>)}<PartyButton onClick={() => finish(game.replaceAll('-', ' '), 'Round completed.')}>Finish round</PartyButton></PartyCard></PartyStage>
  }

  if (game === 'a-or-b') {
    const chooser = getName(roster, d.chooserId)
    const guesser = getName(roster, d.guesserId)
    const orderIds: string[] = d.chooserOrder ?? roster.map(player => player.id)
    const currentScore = d.scoreByPlayer ?? {}
    if (active.phase === 'choosing') return <PartyStage eyebrow="A OR B · SECRET CHOICE" title={`${chooser}, choose privately.`} subtitle="Pick the option you prefer. Don't let the guesser see it."><PartyCard tone="accent"><button className={`party-option${choice === 'A' ? ' is-selected' : ''}`} onClick={() => updateUi({ choice: 'A' })}>A · {d.optionA}</button><button className={`party-option${choice === 'B' ? ' is-selected' : ''}`} onClick={() => updateUi({ choice: 'B' })}>B · {d.optionB}</button><PartyButton onClick={() => { if (choice) { patchActive('guessing', { ...d, chosenOption: choice }); updateUi({ choice: '' }) } }} disabled={!choice}>Lock preference</PartyButton></PartyCard></PartyStage>
    if (active.phase === 'guessing') return <PartyStage eyebrow="A OR B · MAKE THE GUESS" title={`${guesser}, what did ${chooser} choose?`} subtitle={`${d.optionA} or ${d.optionB}`}><PartyCard><button className={`party-option${choice === 'A' ? ' is-selected' : ''}`} onClick={() => updateUi({ choice: 'A' })}>A · {d.optionA}</button><button className={`party-option${choice === 'B' ? ' is-selected' : ''}`} onClick={() => updateUi({ choice: 'B' })}>B · {d.optionB}</button><PartyButton onClick={() => { if (choice) { const correct = choice === d.chosenOption; patchActive('round-result', { ...d, guessedOption: choice, correct, scoreByPlayer: { ...currentScore, [d.guesserId]: (currentScore[d.guesserId] ?? 0) + (correct ? 1 : 0) } }); updateUi({ choice: '' }) } }} disabled={!choice}>Lock guess</PartyButton></PartyCard></PartyStage>
    if (active.phase === 'round-result') return <PartyStage eyebrow="A OR B · REVEAL" title={d.correct ? 'You know each other.' : 'Not quite.'} subtitle={`${chooser} chose ${d.chosenOption === 'A' ? d.optionA : d.optionB}. ${guesser} guessed ${d.guessedOption === 'A' ? d.optionA : d.optionB}.`}><PartyCard><PartyMetric label="CORRECT GUESSES" value={currentScore[d.guesserId] ?? 0}/><PartyButton onClick={() => { const next = Number(d.roundIndex ?? 0) + 1; if (next >= orderIds.length) patchActive('results', d); else { const chooserId = orderIds[next]!; patchActive('choosing', { ...d, roundIndex: next, chooserId, guesserId: orderIds[(next + 1) % orderIds.length]!, chosenOption: null, guessedOption: null, correct: false }) } }}>Next pair</PartyButton><PartyButton variant="quiet" onClick={() => finish('A or B', 'Session ended.')}>End game</PartyButton></PartyCard></PartyStage>
  }

  if (['share-or-pass', 'discussion-starter', 'qupid', 'questions-for-love'].includes(game)) {
    const deck = d.deck ?? []
    if (active.phase === 'complete' || Number(d.index ?? 0) >= deck.length) return <PartyStage eyebrow="SESSION COMPLETE" title="All prompts played." subtitle="The group has finished the selected conversation deck."><PartyCard><PartyMetric label="PROMPTS" value={deck.length}/><PartyMetric label="SHARED" value={d.responses ?? 0}/><PartyMetric label="PASSED" value={d.skips ?? 0}/><PartyButton onClick={() => finish(game.replaceAll('-', ' '), 'Prompt deck completed.')}>Save session</PartyButton></PartyCard></PartyStage>
    const prompt = deck[Number(d.index ?? 0)]?.text ?? d.currentPrompt ?? 'No more prompts.'
    const player = roster[Number(d.currentPlayerIndex ?? 0) % roster.length]
    return <PartyStage eyebrow={game.replaceAll('-', ' ').toUpperCase()} title={game === 'share-or-pass' ? `${player?.name}: share or pass?` : 'A prompt for the group.'} subtitle={game === 'qupid' || game === 'questions-for-love' ? 'A two-person conversation. There is no score and no required answer.' : 'Take turns. Listen without interrupting.'}><PartyCard tone="accent"><p className="party-card-label">PROMPT {Number(d.index ?? 0) + 1} / {deck.length}</p><h2>{prompt}</h2>{game === 'share-or-pass' && <p className="party-help">Passing is always valid. No penalty and no explanation required.</p>}<PartyActions><PartyButton onClick={() => { const nextIndex = Number(d.index ?? 0) + 1; if (nextIndex >= deck.length) patchActive('complete', { ...d, index: nextIndex }); else patchActive('prompt', { ...d, index: nextIndex, currentPlayerIndex: (Number(d.currentPlayerIndex ?? 0) + 1) % roster.length, responses: Number(d.responses ?? 0) + 1 }) }}>{game === 'share-or-pass' ? 'I shared' : 'Next prompt'}</PartyButton>{game === 'share-or-pass' && <PartyButton variant="secondary" onClick={() => { const nextIndex = Number(d.index ?? 0) + 1; patchActive(nextIndex >= deck.length ? 'complete' : 'prompt', { ...d, index: nextIndex, currentPlayerIndex: (Number(d.currentPlayerIndex ?? 0) + 1) % roster.length, skips: Number(d.skips ?? 0) + 1 }) }}>Pass</PartyButton>}</PartyActions><p className="party-progress-note">{Number(d.responses ?? 0)} shared · {Number(d.skips ?? 0)} passed</p></PartyCard></PartyStage>
  }

  if (active.phase === 'complete' || d.index >= (d.deck?.length ?? Infinity)) return <PartyStage eyebrow="SESSION COMPLETE" title="That's a wrap." subtitle="All selected prompts have been played."><PartyCard><PartyMetric label="RESPONSES" value={d.responses ?? 0}/><PartyMetric label="PASSES" value={d.skips ?? 0}/><PartyButton onClick={() => finish(game.replaceAll('-', ' '), 'Prompt deck completed.')}>Save session</PartyButton></PartyCard></PartyStage>
  return <PartyStage eyebrow={game.replaceAll('-', ' ').toUpperCase()} title="Ready to play?" subtitle="Pass the device and follow the prompt."><PartyButton onClick={() => finish('Session ended', 'The session was ended early.')}>End game</PartyButton></PartyStage>
}
