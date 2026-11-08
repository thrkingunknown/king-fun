# Mystery Who — local gameplay reference

**Source:** User-supplied *MYSTERY WHO? — Game Architecture, Gameplay & Feature Analysis Report*, package `mystery-whos`, version 1.0.1, archived verbatim at [`references/mystery-who-full-report.md`](references/mystery-who-full-report.md).
**Scope:** Local, single-device pass-and-play only. The supplied report's online multiplayer sections are retained in the archive for provenance but are not King-Fun requirements and must not be implemented as part of this game.
**Authority:** This document extracts the report's local rules. Where the report is silent, the implementation must not invent a rule.

## 1. Roles and information boundaries

| Role | Information received | Objective |
|---|---|---|
| Civilian | Selected category and secret word | Identify the Mystics without giving away the word |
| Mystic | Selected category and optional indirect hint(s), never the secret word | Blend in and infer the word from discussion |
| Mr. White | Selected category only; never the word or a hint | Avoid detection and potentially guess the secret word |

Mr. White is an additional role, not an ordinary Mystic. The configured Mystic count and every voting selection count refer to ordinary Mystics; Mr. White is excluded from that count.

## 2. Game modes

- **Classic:** Civilians and Mystics only. Mr. White is not assigned. The ordinary Mystic count is configurable within the player-count constraints.
- **Mystics:** Configurable ordinary Mystic count plus exactly one Mr. White.
- **Chaos:** Randomized one to three ordinary Mystics each round; a 45% chance of exactly one Mr. White when there are at least four players; always retain at least one Civilian. The exact randomized count must be generated for each new round.

### Local roster and ordinary Mystic count

| Local players | Ordinary Mystics |
|---:|---:|
| 3–5 | 1 |
| 6–10 | 2 |
| 11–15 | 3 |
| 16–20 | 4 |

Local play supports 3–20 uniquely named players. A role distribution is invalid if it leaves no Civilian. Mystics mode must also reserve one player for Mr. White.

## 3. Local configuration

The report identifies these settings:

- Player names and roster size (3–20).
- One or more selected categories.
- Mode: Classic, Mystics, or Chaos.
- Ordinary Mystic count.
- Mystic Hint on/off.
- Same Mystic Hint on/off (when there are multiple Mystics and hints are enabled).
- Discussion timer on/off and duration.
- Voting on/off.
- Hidden Voter on/off for results.
- Theme preference.

The report's recorded baseline values are Classic mode, one ordinary Mystic, Mystic Hint on, Same Mystic Hint off, timer disabled with 180 seconds configured, voting enabled, hidden voter enabled, System theme, and Gemini selected with empty Gemini/Groq key fields. The AI provider/default model/key fields are historical report settings, not King-Fun provider requirements; use the approved provider order and server-side gateway in `ai-provider-routing.md`. If a King-Fun gameplay UI default is intentionally changed, record the decision and keep game rules/acceptance criteria unchanged.

## 4. Category, word, and hint generation

1. Select one category at random from the selected/eligible categories.
2. Select a secret word from that category.
3. Store the selected category and word as part of the committed round state before reveal.
4. The report describes three possible content sources: bundled local word banks, manually created custom packs, and AI-generated content. King-Fun core gameplay must remain usable from local bundled/custom content without AI or a network connection.
5. The category is visible to every role. Only Civilians receive the word. Mystics receive indirect hint(s) only when hints are enabled. Mr. White receives neither word nor hint.

When multiple Mystics exist and hints are enabled, they may receive either the same hint or different hints. If hinting is disabled, ordinary Mystics receive no hint. Mr. White never receives a hint.

### Built-in categories named by the report

1. Animals
2. Fruit
3. Food & Drinks
4. Objects
5. Celebrities
6. Cities
7. Countries
8. Body & Health
9. Brands
10. Hollywood
11. Games
12. Locations
13. Film & TV
14. Anime
15. Professions
16. School
17. Sports
18. Football
19. Fantasy
20. Fashion & Clothes
21. Technology
22. Traveling
23. World & Places
24. Summer
25. Music
26. Jobs & Crafts
27. Daily Life
28. Adults Only
29. Superheroes
30. Weather & Nature

### Reported content audit and current project gap

The report's static audit states 30 built-in categories, 1,800 word entries (60 per category), and 20 hints per entry (36,000 hint entries, with 531 unique hint strings). It warns that some entries are generic category-related terms rather than suitable secret answers and that some hints are semantically mismatched to their words. A passing count/duplicate audit does not prove clue quality.

The current King-Fun bundled catalogue contains 1,800 concrete answers (60 per category), with four shared category-safe hints per answer. It does **not** yet contain 20 distinct, word-specific hints for every answer. Curating and reviewing those hints is an open content-quality task; do not pad the catalogue with generic or misleading clues.

## 5. Manual and AI custom categories

### Manual local packs

A manual pack stores a name, emoji, and multiple secret words. Each word has 1–20 non-empty hints. King-Fun's parser additionally validates the supported pack metadata, unique words, bounded text, and hint/answer separation. Supported interchange formats:

- **TXT:** `Secret Word | Hint 1 | Hint 2 | Hint 3` (additional hint columns are supported up to the configured limit).
- **JSON:** structured pack metadata and word/hint entries.

Users can create, edit, delete, import, and export local packs. Manual packs are local content and must remain usable without AI credentials.

### AI categories (future integration)

The report describes AI categories with a category name, emoji, generation instructions, and source type. For a new round, the AI generates a fresh secret word and hints. This is an optional capability and requires internet access. King-Fun has not shipped the provider UI/API for this feature; implementation must follow the approved secure Elysia + Bun gateway and provider rules in [`ai-provider-routing.md`](ai-provider-routing.md). Do not copy the report's historical model IDs or expose provider secrets in browser code.

## 6. Private reveal and handoff

- Local play is pass-and-play on one device.
- Players view their assignments one at a time.
- The role/reveal control requires a press-and-hold of approximately **650 ms**.
- **KING-FUN implementation override (2026-11-06):** the user-requested UI behavior removes that artificial delay. Reveal starts on pointer/key press, then conceals on release/cancel/focus loss. The source report’s original timing remains documented here as reference provenance only.
- Releasing the control conceals the information again.
- The next player must not proceed until the current player has successfully viewed their information and completed the conceal/handoff flow.
- The revealed view contains the player's name, assigned role, allowed word/hint information, and category.
- A later player must never be able to see the previous player's private information after handoff.

## 7. Discussion timer

- Timer applies to the **discussion phase only**, not the whole round.
- It is off by default; the recorded duration default is 180 seconds.
- Range: 15–600 seconds, in 15-second increments.
- On expiry, proceed to voting when voting is enabled; otherwise proceed to results.

## 8. Voting and Mr. White's final guess

- Voting is enabled by default but can be disabled.
- Voting is sequential and private: every player gets one ballot in turn.
- A ballot selects exactly the configured number of **ordinary Mystics**, or the player skips the ballot.
- The required selection count is based on ordinary Mystics; Mr. White is not counted.
- Self-voting is allowed. Duplicate targets, invalid targets, out-of-turn ballots, and duplicate submissions are rejected.
- After all ballots are submitted, Mr. White gets a final guess only if Mr. White has received at least half of all submitted vote selections, rounded up (ceiling of half the total submitted target selections).
- King-FUN applies a minimum threshold of one selection. If every player skips or otherwise submits no target selection, the threshold is not met and no final guess is offered. The reference report does not spell out the zero-selection case; this is the conservative local interpretation, not a faction/tie victory rule.
- The guess comparison trims surrounding whitespace, lowercases, collapses repeated whitespace, and then compares the normalized answer exactly. It is not fuzzy matching.
- If voting is disabled, discussion proceeds directly to results and there is no Mr. White vote-threshold trigger.

## 9. Results and voter visibility

The results expose the secret word, category, assigned roles, vote tally/results, Mystic hints, and Mr. White's guess outcome when applicable. With Hidden Voter enabled, voter identities are omitted while aggregate counts/tallies remain visible. Do not leak hidden voter names in result presentation or stored client-facing result objects unnecessarily.

## 10. Repeat protection

The report stores the most recent ten secret words and normalizes by trimming, lowercasing, and collapsing whitespace. The exclusion applies across categories. King-Fun also compares stable content IDs and canonicalized display text as a stricter duplicate guard. The last-10 word exclusion is a hard rule: never silently relax it. If a selected pack/category has no eligible word, show a clear exhaustion state and offer an explicit history reset or a different category/pack. The project may additionally maintain per-category queues, but those queues must not weaken the global last-10 rule.

## 11. Explicitly undefined — do not invent

The report does **not** specify:

- What Troll Mode changes or how it affects roles, information, or round flow.
- Civilian/Mystic elimination mechanics.
- Faction victory conditions or round winner resolution.
- Detailed special resolution rules for ties, all-skip/no-vote, or tied top targets.

The implementation may validate votes and display tally, tie, or no-vote states. It must not imply an unsupported elimination or faction-win rule. These mechanics remain blocked pending a more detailed authoritative specification.

## 12. Online-mode exclusion

The archived report also describes online rooms, hosts, relays, WebSockets, reconnection, and online voting. Those details are intentionally **not** part of King-Fun's Imposter requirements. Do not implement online rooms, matchmaking, remote private-role delivery, network voting, host migration, chat, voice, or reconnection as part of this local game. Any future cross-device multiplayer requires a separate explicit product-scope decision.

## 13. Related project documents

- Full source report: [`references/mystery-who-full-report.md`](references/mystery-who-full-report.md).
- Product requirements: [`../requirements.md`](../requirements.md), FR-IMP-001 through FR-IMP-017.
- Implementation backlog: [`../todo.md`](../todo.md), EPIC-IMP.
- Test catalogue: [`../tests.md`](../tests.md), TEST-IMP cases.
- Evidence register: [`../verification.md`](../verification.md), VERIFY-IMP cases.
