import { useState } from 'react'
import type { ActiveGame, Player } from '../../types.ts'
import { PartyButton, PartyCard, PartyMetric, PartyStage } from './PartyGameUI.tsx'

type Props = { active: ActiveGame; players: Player[]; patchActive: (phase: string, data: Record<string, any>) => void; finish: (title: string, detail: string) => void }
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLocaleLowerCase()
const playerName = (players: Player[], id: string) => players.find(player => player.id === id)?.name ?? 'Player'

/** Local identity guessing and ten-word puzzle controllers. */
export function WordArcadeGame({ active, players, patchActive, finish }: Props) {
  const d = active.data
  const roster: Player[] = Array.isArray(d.playerRoster) ? d.playerRoster : players
  const [feedback, setFeedback] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  if (active.game === 'who-am-i') {
    const order: string[] = d.playerOrder ?? roster.map(player => player.id)
    const playerIndex = Number(d.currentPlayerIndex ?? 0)
    const currentId = order[playerIndex]
    const currentPlayer = playerName(roster, currentId ?? '')
    const identity = (currentId ? d.assignments?.[currentId] : undefined) ?? 'Unknown identity'
    if (active.phase === 'questioning') {
      const advance = (solved: boolean) => {
        const nextCorrect = solved ? [...(d.correctPlayers ?? []), currentId] : [...(d.correctPlayers ?? [])]
        const nextSkipped = solved ? [...(d.skippedPlayers ?? [])] : [...(d.skippedPlayers ?? []), currentId]
        const nextIndex = playerIndex + 1
        patchActive(nextIndex >= order.length ? 'results' : 'questioning', {
          ...d, currentPlayerIndex: nextIndex, correctPlayers: nextCorrect, skippedPlayers: nextSkipped,
        })
      }
      return <PartyStage eyebrow={`WHO AM I? · PLAYER ${playerIndex + 1} / ${order.length}`} title={`${currentPlayer}, who are you?`} subtitle="Keep the screen facing the group. Everyone else can see the identity; the active player should not.">
        <PartyCard tone="accent" className="identity-forehead-card"><p className="party-card-label">SHOW THIS IDENTITY TO THE GROUP</p><h2 className="identity-card">{identity}</h2><p className="party-help">Place the phone against the active player's forehead or hold it facing the group. The group gives clues and answers yes/no questions. Tap when the player guesses correctly, or pass the identity.</p><PartyButton onClick={() => advance(true)}>They guessed it</PartyButton><PartyButton variant="quiet" onClick={() => advance(false)}>Pass identity</PartyButton><p className="party-progress-note">{(d.correctPlayers ?? []).length} solved · {(d.skippedPlayers ?? []).length} passed</p></PartyCard>
      </PartyStage>
    }
    if (active.phase === 'results') return <PartyStage eyebrow="WHO AM I? · RESULTS" title="The identity round is complete." subtitle="Every player had a chance to guess their assigned identity."><PartyCard tone="accent"><PartyMetric label="IDENTITIES GUESSED" value={(d.correctPlayers ?? []).length}/><PartyMetric label="IDENTITIES PASSED" value={(d.skippedPlayers ?? []).length}/>{order.map(id => <div className="party-result-row" key={id}><span>{playerName(roster, id)}</span><strong>{d.assignments?.[id]}</strong></div>)}<PartyButton onClick={() => finish('Who Am I?', `${(d.correctPlayers ?? []).length} of ${order.length} identities guessed.`)}>Save result</PartyButton></PartyCard></PartyStage>
  }

  if (active.game === 'ten-tangle') {
    const puzzles: Array<{ id: string; answer: string; scrambled: string }> = d.puzzles ?? []
    const answers: Record<string, string> = d.answers ?? {}
    const solvedCount = Object.keys(answers).length
    const attempts = Number(d.attempts ?? 0)
    const submit = (puzzle: { id: string; answer: string }) => {
      const value = String(drafts[puzzle.id] ?? '').trim()
      if (!value || answers[puzzle.id]) return
      if (normalize(value) === normalize(puzzle.answer)) {
        const nextAnswers = { ...answers, [puzzle.id]: value }
        setDrafts(current => { const next = { ...current }; delete next[puzzle.id]; return next })
        const nextSolved = Object.keys(nextAnswers).length
        setFeedback('Correct. Word solved.')
        patchActive(nextSolved >= puzzles.length ? 'results' : 'puzzle', { ...d, answers: nextAnswers, attempts: attempts + 1, solved: nextSolved })
      } else {
        setFeedback('Not quite. Check the letter order and try again.')
        patchActive('puzzle', { ...d, attempts: attempts + 1 })
      }
    }
    const revealRemaining = () => patchActive('results', { ...d, revealed: true, solved: solvedCount })
    if (active.phase === 'results' || solvedCount >= puzzles.length) return <PartyStage eyebrow="TEN TANGLE · COMPLETE" title="The word set is complete." subtitle="All ten anagrams have been solved or revealed."><PartyCard tone="accent"><PartyMetric label="SOLVED" value={`${solvedCount} / ${puzzles.length}`}/><PartyMetric label="ATTEMPTS" value={attempts}/>{puzzles.map(puzzle => <div className="party-result-row" key={puzzle.id}><span>{puzzle.scrambled.split('').join(' ')}{answers[puzzle.id] ? ' · solved' : ' · skipped'}</span><strong>{puzzle.answer}</strong></div>)}<PartyButton onClick={() => finish('Ten Tangle', `${solvedCount} of ${puzzles.length} words solved in ${attempts} attempts.`)}>Save result</PartyButton></PartyCard></PartyStage>
    return <PartyStage eyebrow={`TEN TANGLE · ${solvedCount} / ${puzzles.length} SOLVED`} title="Untangle the ten-word set." subtitle="Solve the scrambled words in any order. Spaces and punctuation are ignored when checking answers."><PartyCard tone="accent"><div className="tangle-puzzle-grid">{puzzles.map((puzzle, i) => <div className={`tangle-puzzle${answers[puzzle.id] ? ' is-solved' : ''}`} key={puzzle.id}><p className="party-card-label">WORD {String(i + 1).padStart(2, '0')}</p><h2 className="tangle-letters" aria-label={`Scrambled word: ${puzzle.scrambled.split('').join(' ')}`}>{puzzle.scrambled.split('').join(' ')}</h2>{answers[puzzle.id] ? <p className="party-notice" role="status">Solved</p> : <><label className="party-field-label" htmlFor={`tangle-${puzzle.id}`}>Your answer</label><input id={`tangle-${puzzle.id}`} className="party-input" value={drafts[puzzle.id] ?? ''} onChange={event => setDrafts(current => ({ ...current, [puzzle.id]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') submit(puzzle) }} autoComplete="off"/><PartyButton variant="secondary" onClick={() => submit(puzzle)} disabled={!String(drafts[puzzle.id] ?? '').trim()}>Check word</PartyButton></>}</div>)}</div><p className="party-progress-note">{solvedCount} solved · {attempts} attempts</p>{feedback && <p className="party-notice" role="status">{feedback}</p>}<PartyButton variant="quiet" onClick={revealRemaining}>Reveal remaining answers & finish</PartyButton></PartyCard></PartyStage>
  }

  return <PartyStage eyebrow="WORD GAME" title="Ready to play?" subtitle="This game module is not available for the current session state."><PartyButton onClick={() => finish(active.game, 'Session ended.')}>Finish</PartyButton></PartyStage>
}
