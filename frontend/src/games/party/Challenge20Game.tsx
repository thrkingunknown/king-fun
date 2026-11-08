import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActiveGame, Player } from '../../types.ts'
import { formatAuctionBudget, settleAuctionLot } from '../../domain/games/party-arcade.ts'
import { recordArcadeVote } from '../../domain/games/party-arcade.ts'
import { secureShuffle } from '../../domain/random/secure-random.ts'
import { PartyActions, PartyButton, PartyCard, PartyMetric, PartyStage } from './PartyGameUI.tsx'

type Props = { active: ActiveGame; players: Player[]; patchActive: (phase: string, data: Record<string, any>) => void; finish: (title: string, detail: string) => void }

const EMPTY_BUDGETS: Record<string, number> = Object.freeze({})
const EMPTY_BUILDS: Record<string, Array<{ lotId: string; label: string; value: number; cost: number }>> = Object.freeze({})
const nameFor = (roster: Player[], id: string) => roster.find(player => player.id === id)?.name ?? 'Player'

/** Ten-lot, $20 sealed-bid draft. Offline judging is a transparent group ballot. */
export function Challenge20Game({ active, players, patchActive, finish }: Props) {
  const d = active.data
  const roster: Player[] = Array.isArray(d.playerRoster) ? d.playerRoster : players
  const market: Array<{ id: string; label: string; value: number }> = d.market ?? []
  const lotIndex = Number(d.lotIndex ?? 0)
  const lot = market[lotIndex]
  const bidOrder: string[] = d.bidOrder ?? roster.map(player => player.id)
  const bidderIndex = Number(d.bidderIndex ?? 0)
  const bidderId = bidOrder[bidderIndex]
  const [bid, setBid] = useState('0')
  const budgets: Record<string, number> = d.budgets ?? EMPTY_BUDGETS
  const builds: Record<string, Array<{ lotId: string; label: string; value: number; cost: number }>> = d.builds ?? EMPTY_BUILDS
  const bids: Record<string, number> = d.lotBids ?? {}
  const votes: Record<string, string> = d.judgeVotes ?? {}
  const judgeOrder: string[] = d.judgeOrder ?? roster.map(player => player.id)
  const judgeIndex = Number(d.judgeIndex ?? 0)
  const judgeId = judgeOrder[judgeIndex]
  const judgeViewKey = `${active.phase}:${judgeId ?? 'none'}:${judgeIndex}`
  const [selectedBuildState, setSelectedBuildState] = useState({ key: '', value: '' })
  const selectedBuild = selectedBuildState.key === judgeViewKey ? selectedBuildState.value : ''
  const setSelectedBuild = (value: string) => setSelectedBuildState({ key: judgeViewKey, value })
  const bidderBudget = bidderId ? Number(budgets[bidderId] ?? 0) : 0
  const skippedLotRef = useRef<string | null>(null)
  useEffect(() => {
    if (active.phase !== 'bidding' || !lot || !d.antiItemsMode || lot.value >= 3) return
    if (skippedLotRef.current === lot.id) return
    skippedLotRef.current = lot.id
    const history = [...(d.auctionHistory ?? []), { ...lot, bids: {}, winnerId: null, cost: 0, skipped: true }]
    const nextLot = lotIndex + 1
    const nextData = { ...d, lotIndex: nextLot, lotBids: {}, bidderIndex: 0, auctionHistory: history, bidOrder: secureShuffle(roster.map(player => player.id)) }
    if (nextLot >= market.length) patchActive('judging', { ...nextData, judgeOrder: secureShuffle(roster.map(player => player.id)), judgeIndex: 0, judgeVotes: {} })
    else patchActive('bidding', nextData)
  }, [active.phase, lot, d, d.antiItemsMode, d.auctionHistory, lotIndex, market.length, patchActive, roster])
  const standings = useMemo(() => roster.map(player => ({
    player,
    spent: 20 - Number(budgets[player.id] ?? 20),
    value: (builds[player.id] ?? []).reduce((sum, item) => sum + item.value, 0),
    count: (builds[player.id] ?? []).length,
  })).sort((a, b) => b.value - a.value || b.count - a.count), [roster, budgets, builds])

  const placeBid = () => {
    if (!bidderId || !lot) return
    const amount = Number(bid)
    if (!Number.isInteger(amount) || amount < 0 || amount > bidderBudget) return
    const nextBids = { ...bids, [bidderId]: amount }
    setBid('0')
    if (bidderIndex + 1 < bidOrder.length) patchActive('bidding', { ...d, lotBids: nextBids, bidderIndex: bidderIndex + 1 })
    else {
      const result = settleAuctionLot(nextBids, budgets, lot.value, Boolean(d.antiItemsMode))
      const nextBuilds = { ...builds }
      if (result.winnerId) nextBuilds[result.winnerId] = [...(nextBuilds[result.winnerId] ?? []), { lotId: lot.id, label: lot.label, value: lot.value, cost: result.cost }]
      const nextBudgets = result.nextBudget
      const history = [...(d.auctionHistory ?? []), { ...lot, bids: nextBids, winnerId: result.winnerId, cost: result.cost, skipped: result.blocked }]
      const nextLot = lotIndex + 1
      if (nextLot >= market.length) patchActive('judging', { ...d, lotBids: {}, bidderIndex: 0, budgets: nextBudgets, builds: nextBuilds, auctionHistory: history, judgeOrder: secureShuffle(roster.map(player => player.id)), judgeIndex: 0, judgeVotes: {} })
      else patchActive('bidding', { ...d, lotIndex: nextLot, lotBids: {}, bidderIndex: 0, budgets: nextBudgets, builds: nextBuilds, auctionHistory: history, bidOrder: secureShuffle(roster.map(player => player.id)) })
    }
  }


  if (active.phase === 'bidding' && lot && d.antiItemsMode && lot.value < 3) return <PartyStage eyebrow="$20 CHALLENGE · ANTI-ITEMS" title="Filtering this lot." subtitle="Anti-items mode skips low-value lots without spending anyone's budget."><PartyCard><p className="party-help">This lot is excluded by the selected anti-items rule.</p></PartyCard></PartyStage>

  if (active.phase === 'bidding' && lot) return <PartyStage eyebrow={`$20 CHALLENGE · LOT ${lotIndex + 1} / ${market.length}`} title={`Build the best ${d.theme}.`} subtitle="Each player has a $20 budget. Bid privately; the highest valid bid wins the lot. Equal bids go to the player earlier in the shuffled bidding order."><PartyCard tone="accent"><p className="party-card-label">CURRENT LOT</p><h2>{lot.label}</h2><PartyActions><PartyMetric label="YOUR BUDGET" value={formatAuctionBudget(bidderBudget)}/><PartyMetric label="ITEM VALUE" value={lot.value}/></PartyActions><p className="party-help">Pass the device to {nameFor(roster, bidderId ?? '')}. Other players should not see the bid.</p><label className="party-field-label" htmlFor="auction-bid">{nameFor(roster, bidderId ?? '')} · bid ($0–{bidderBudget})</label><input id="auction-bid" className="party-input" inputMode="numeric" type="number" min={0} max={bidderBudget} step={1} value={bid} onChange={event => setBid(event.target.value)}/><PartyButton onClick={placeBid} disabled={!bidderId || !Number.isInteger(Number(bid)) || Number(bid) < 0 || Number(bid) > bidderBudget}>Lock bid</PartyButton><p className="party-progress-note">BID {bidderIndex + 1} OF {bidOrder.length}</p></PartyCard><div className="party-budget-grid">{roster.map(player => <div key={player.id}><span>{player.name}</span><strong>{formatAuctionBudget(budgets[player.id] ?? 20)}</strong></div>)}</div></PartyStage>

  if (active.phase === 'judging') {
    return <PartyStage eyebrow="$20 CHALLENGE · GROUP JUDGE" title={`Who built the best ${d.theme}?`} subtitle="The auction is complete. Review the other builds and cast one private vote. This local group-judging option works offline; ties are resolved by total build value."><PartyCard tone="accent">{roster.filter(player => player.id !== judgeId).map(player => <div className={`party-build-card${selectedBuild === player.id ? ' is-selected' : ''}`} key={player.id}><button type="button" className="party-build-choice" onClick={() => setSelectedBuild(player.id)}><strong>{player.name}</strong><span>{(builds[player.id] ?? []).length} items · value {(builds[player.id] ?? []).reduce((sum: number, item: any) => sum + item.value, 0)}</span></button>{(builds[player.id] ?? []).map((item: any) => <p key={item.lotId}>{item.label} <small>(${item.cost} bid)</small></p>)}{(builds[player.id] ?? []).length === 0 && <p className="party-help">No items won.</p>}</div>)}<PartyButton onClick={() => { if (!selectedBuild) return; const nextVotes = recordArcadeVote(votes, judgeId ?? '', selectedBuild, roster.filter(player => player.id !== judgeId).map(player => player.id)); if (judgeIndex + 1 < judgeOrder.length) patchActive('judging', { ...d, judgeVotes: nextVotes, judgeIndex: judgeIndex + 1 }); else patchActive('results', { ...d, judgeVotes: nextVotes }) }} disabled={!selectedBuild}>Vote for {nameFor(roster, judgeId ?? '')}</PartyButton><p className="party-progress-note">JUDGE {judgeIndex + 1} OF {judgeOrder.length}</p></PartyCard></PartyStage>
  }

  if (active.phase === 'results') {
    const totals = Object.values(votes).reduce<Record<string, number>>((out, id) => { out[id] = (out[id] ?? 0) + 1; return out }, {})
    // A tied ballot is resolved by total build value only. If both remain tied,
    // report a shared result rather than silently favouring roster order.
    const ranked = [...standings].sort((a, b) => (totals[b.player.id] ?? 0) - (totals[a.player.id] ?? 0) || b.value - a.value)
    const first = ranked[0]
    const second = ranked[1]
    const isTie = Boolean(first && second && (totals[first.player.id] ?? 0) === (totals[second.player.id] ?? 0) && first.value === second.value)
    const winner = isTie ? null : first?.player
    return <PartyStage eyebrow="$20 CHALLENGE · FINAL BUILD" title={isTie ? 'The challenge is tied.' : winner ? `${winner.name} takes the challenge.` : 'The auction is complete.'} subtitle={`Theme: ${d.theme}. The group ballot decides the winner; total build value breaks a voting tie. Exact ties are shared.`}><PartyCard tone="accent"><div className="party-result-list">{ranked.map((row, i) => <div key={row.player.id}><span>{i + 1}. {row.player.name} · {row.count} items · ${row.spent} spent · value ${row.value}</span><strong>{totals[row.player.id] ?? 0} votes</strong></div>)}</div><PartyButton onClick={() => finish('$20 Challenge', `${winner?.name ?? (isTie ? 'A shared tie' : 'No winner')} — ${d.theme}.`)}>Save result</PartyButton></PartyCard></PartyStage>
  }

  return <PartyStage eyebrow="$20 CHALLENGE" title="Auction complete." subtitle="All ten lots have been resolved."><PartyButton onClick={() => finish('$20 Challenge', 'Auction ended.')}>Finish</PartyButton></PartyStage>
}
