# Gameplay and interaction reference

**Reviewed:** 2026-11-04  
**Status:** Product/UX target specification; implementation and parity are not implied.  
**Reference material:** Four user-supplied mobile screen recordings. The reference apps are used only to observe broad interaction patterns and gameplay sequencing. Do not copy their assets, branding, exact layouts, text, prompt libraries, or monetization.

## 1. Recordings reviewed

| File | Duration | Main game/flow observed | Observable details |
|---|---:|---|---|
| `285208.mp4` | 90.7 s | Imposter / social deduction | Classic setup, editable players, category picker, impostor count, timer, hint and Troll Mode controls, private role cards, hold-to-reveal, player handoff. |
| `285207.mp4` | 78.5 s | Truth or Dare / roulette prompt flow | Prompt-pack selection, wheel selection, Truth/Dare choice, animated player wheel, large prompt card, reactions, next-player action, report reasons, settings. |
| `285210.mp4` | 91.9 s | GuessUp / charades | Deck browser and filters, selected-pack tray, duration and input preferences, ready countdown, large prompt card, team mode and team setup. |
| `285209.mp4` | 71.6 s | I Have Never / group prompt modes | Pack selection, all-together / spin-wheel / one-at-a-time modes, player selection, prompt card, reaction controls, next prompt, wheel interaction. |

The recordings contain advertisements, premium promotions, locked packs, and branding. Those commercial elements are **not** part of this project's target. King-Fun remains free/open-source, uses original content, and does not add ads, paid unlocks, or premium tiers.

## 2. Shared gameplay presentation target

The games should feel like compact, tactile party apps rather than ordinary web forms:

- Use a focused, edge-to-edge play surface with strong game-specific color identity, legible player/prompt typography, deliberate contrast, and a clear primary action.
- Put configuration into grouped, scannable cards or bottom sheets. Keep the primary `Start` / `Play` action visually persistent near the bottom on mobile without covering content or safe areas.
- Use animated transitions to explain state changes: sheet slide-up, card flip/slide, wheel spin, short ready countdown, score feedback, player handoff, and result reveal.
- Commit random outcomes to domain state **before** starting an animation. The animation must visualise the committed result; it must never choose the result itself.
- Use transform/opacity-first animation and stable dimensions. Avoid layout shifts, clipping, tiny collapsed cards, and animations that delay an already-known result unnecessarily.
- Respect `prefers-reduced-motion`; every animated interaction must have a clear immediate/static equivalent.
- Use distinct, original motion and illustration. Similar interaction concepts are desired; tracing the reference UI or reusing its assets is prohibited.
- Sound, vibration, tilt, and device orientation are optional enhancements. Buttons and touch controls must always provide a complete fallback.

## 3. Imposter / Mystery Who local target flow

The complete user-supplied 977-line Mystery Who report is archived verbatim at [`references/mystery-who-full-report.md`](references/mystery-who-full-report.md); its extracted local contract is [`mystery-who-local-reference.md`](mystery-who-local-reference.md). The report is the current local gameplay source of truth. Ignore the report's online multiplayer sections.

### Setup

- 3–20 unique players.
- Choose one or more of the 30 built-in categories or locally created custom packs. The game selects an eligible category uniformly, then selects a word within it.
- Choose Classic (Civilians + Mystics), Mystics (adds exactly one Mr. White), or Chaos (randomized one to three Mystics and 45% Mr. White chance at 4+ players).
- Configure ordinary Mystic count using the player-count bands, Mystic hints on/off, same/different hints, discussion-only timer, voting on/off, and hidden-voter results.
- Custom categories have a name, emoji, description, and word lines in `Secret Word | Hint 1 | Hint 2 | ...` format (up to 20 hints); JSON/TXT import and export are supported. Import files are limited to 1 MiB and checked before their contents are read.

### Role information and private handoff

- Civilian sees category + secret word.
- Mystic sees category + indirect hint(s), but never the word.
- Mr. White sees category only; no word or hint.
- Reveal begins immediately on pointer/key press with no artificial hold timer. Release, pointer cancellation, focus loss, or key-up conceals the information. Handoff is gated until the current player has viewed and hidden their role.

### Discussion, voting, and result

- Discussion timer is optional, defaults to off / 180 seconds, ranges 15–600 seconds in 15-second steps, and applies only to discussion. Expiry advances to voting or results according to the voting setting.
- Voting is sequential. Each voter selects exactly the configured ordinary Mystic count, may select themselves, or may skip. Duplicate and invalid targets are rejected.
- After all ballots, Mr. White receives a final guess if their received selections are at least half of all submitted selections, rounded up. The normalized comparison trims, lowercases, collapses whitespace, then compares exactly.
- Results expose the word, category, role roster, tally, Mystic hints, and Mr. White guess result. Hidden-voter mode suppresses voter identities.

### Explicitly open

The report does not define Troll Mode effects, civilian/mystic elimination and win rules, or full tie/no-vote victory transitions. Do not invent these. Current source content has 1,800 answers across 30 categories (60/category), meeting the reported answer count. Each answer currently has four shared category-safe hints, not 20 word-specific hints; further clue authoring requires semantic review rather than generic filler.


## 4. Truth or Dare target flow

### Pack and mode selection

1. Present original prompt packs with title, short description, content count, locale, and suitability label.
2. Support the three observed player modes as separate choices:
   - **All together:** present the prompt to the group without selecting one player first.
   - **Spin the wheel:** select one eligible player using an animated roulette wheel.
   - **One at a time:** advance through the roster in a clear turn order.
3. Keep a selected-pack summary and a prominent `Play` action visible on mobile.

### Roulette and prompt interaction

1. Commit and persist the selected player before the wheel starts moving.
2. Animate a convincing player-wheel spin with acceleration, sustained rotation, and a decelerating landing. The pointer and highlighted wheel segment must finish on the committed player. This first wheel appears in `Spin the wheel` mode and selects the current/next player.
3. Respect reduced motion by showing the selected player immediately with a short non-motion confirmation.
4. Show a separate eight-sector Truth/Dare wheel with four `TRUTH` and four `DARE` sectors. Its outcome is selected and committed before motion; the pointer must land on the selected sector. Reuse the shared `SpinWheel` presentation component used by player selection and align each label with its sector radius.
5. Keep the existing large manual `TRUTH` and `DARE` buttons available beneath the second wheel as an alternative; choosing manually must continue to use the normal prompt-selection path.
6. For All together and One at a time modes, retain their player-selection semantics and show the Truth/Dare wheel without forcing an extra player-wheel spin.
7. Present the prompt on a large, high-contrast card. Include next/replace/skip and a penalty-free opt-out.
8. Offer simple reactions (for example, helpful/not-helpful or a heart) without exposing or uploading private reactions by default.
9. Add a prompt report affordance with structured reasons: offensive/unsafe content, spelling/grammar, wrong category, or not actually a dare/truth. Reports must not silently upload player names or game history.
10. Animate the next-player transition and make the current turn/progress obvious.

## 5. GuessUp target flow

### Deck selection and configuration

1. Provide a deck browser with filter chips (for example, All, Packs, Popular, Kids) and an original pack grid/list. Do not add an Adults category unless the project owner separately approves age-gated content and its policy.
2. Allow multiple decks/categories to be selected. Show the selected count and selected decks in a compact tray.
3. Provide team setup: editable team names, player assignment, and an obvious way to balance or manually move players.
4. Provide round duration (60 seconds as the reference default; make it configurable), sound/vibration preferences, and input mode. Tilt/inverted tilt may be optional; touch Correct/Pass buttons remain mandatory.
5. Keep all settings local and usable without an AI provider.

### Round loop

1. Show a short `Get ready` countdown (3–2–1) before the first card.
2. Present one large, arm's-length-readable charades word/phrase at a time.
3. Provide immediate Correct and Pass actions with clear, distinct feedback and one score mutation per accepted action.
4. Optionally map device tilt to Correct/Pass only after explicit sensor permission. The visible buttons remain available throughout; tilt can be disabled, and the device must return to the neutral band before another tilt action.
5. Show remaining time, card/deck progress, active player/team, and team scores without crowding the prompt.
6. End the turn exactly once on timer expiry; show a clear handoff between teams, then a result/winner/tie screen and replay action.
7. Include a report action for malformed/offensive/misclassified prompts; reporting must not interrupt or double-advance the round.

## 6. I Have Never target flow

### Pack and mode selection

1. Present original statement packs and category filters with a selected-pack summary.
2. Support the observed modes:
   - **All together:** the statement is shown to the group and everyone responds simultaneously using the selected neutral convention.
   - **Spin the wheel:** a player is selected for the spotlight/story prompt using the animated player wheel.
   - **One at a time:** each player receives the statement in roster order, with the active player clearly identified.
3. Response conventions are configurable and neutral: fingers, points, or self-reported reactions/stories. Alcohol consumption is never required or presented as the default.

### Prompt loop

1. Present a large statement card with a clear category/pack label.
2. Provide response controls or an explicit `Next` action according to the chosen mode.
3. Provide reaction controls as optional, private/local feedback; do not expose another player's response without consent.
4. Provide `Skip` as a separate action from a response. A skip advances once and increments only the skip counter.
5. Show prompt progress and animate the next statement/player transition without making the user wait through unnecessary motion.


## 7. Motion choreography and interaction quality

The recordings are the source for the *type* and sequence of interactions, not for copying exact timings, artwork, layout coordinates, or brand styling. The implementation should use the following state-led motion patterns:

| Interaction | Target choreography | State and accessibility rule |
|---|---|---|
| Setup navigation | Selected pack/category cards respond immediately; the next setup/play surface enters with a short slide/fade or sheet transition. | Selection is committed before navigation; motion can be skipped under reduced-motion. |
| Imposter private role | Large role card has a distinct reverse, flips in 3D while held, reveals the assigned role/word, and flips shut on release. Role-specific accents distinguish roles. | The secret is not in the visible/accessibility tree while closed; cancellation/focus loss conceals it; handoff is explicit. |
| Player roulette | Wheel visibly accelerates, rotates, decelerates, and settles under a fixed pointer; winner/highlight is revealed after the stop. | Winner is selected and persisted before motion; the animation is never the random-selection mechanism. |
| Truth/Dare choice | Truth and Dare appear as separate large, high-contrast choices; selected type is visually confirmed before the prompt card enters. | Choice is a committed state, not inferred from animation. A skip/opt-out route stays available. |
| GuessUp ready/game | Short 3–2–1 countdown, prompt card enters at a stable readable size, Correct/Pass gives immediate differentiated feedback, timer and team score remain visible, and team handoff/result has a clear transition. | Countdown can only start one timer; Correct/Pass is idempotent; accessible buttons remain usable without sensors or sound. |
| I Have Never prompt | Statement card enters as the focus of the screen; response/reaction controls sit in a stable action area; next/skip transitions to a fresh statement. | Response, reaction, and skip are separate state changes; skip never counts as a response. |
| Prompt report | Report opens as a focused modal/sheet with reason choices and an optional short note; submission returns to the same prompt/turn. | Reporting never advances the prompt, awards points, or uploads player/session data. |

Animation should feel deliberate and tactile: use spring-like easing only where it clarifies a physical action (wheel, card, score feedback), short opacity/transform transitions for ordinary navigation, and no continuous motion that competes with reading. Do not invent arbitrary wait periods. A state change should be immediate in the domain layer even if its visual transition is still running.

### Sound, vibration, and sensor options

GuessUp may expose per-game music/SFX, vibration, and input-mode preferences because these settings are visible in the reference flow. They are optional, off or conservative by default, persisted locally, and must not block play when unsupported or denied. No copyrighted reference audio is copied. Truth or Dare and I Have Never may use subtle optional feedback, but all actions must remain clear without sound or vibration.

## 8. Explicit non-goals from the recordings

- No copied advertising, subscription prompts, upsell banners, locked premium packs, ratings prompts, or third-party branding.
- No copied prompt text, deck names, artwork, icons, illustrations, or sound effects.
- No forced adult content, alcohol consumption, risky dares, or sensitive personal disclosure.
- No online mode for Imposter classic parity. Any future cross-device multiplayer must be a separate, explicitly approved project scope.

## Truth or Dare wheel sequence — implementation note (2026-11-06)

The `Spin the wheel` setup mode is a two-stage flow, not a single combined roulette: the player wheel chooses the current player first; after the saved player selection lands, the Truth/Dare wheel chooses the challenge type. The player and challenge outcomes are persisted before their respective animations. The `All together` mode targets the group, and `One at a time` advances in roster order. See [`ui-architecture.md`](ui-architecture.md) for component ownership and extension rules.
