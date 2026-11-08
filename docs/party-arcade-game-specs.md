# Party Arcade expansion — gameplay specification

**Status:** Implemented in source; full Bun/Playwright acceptance remains outstanding.
**Date:** 2026-11-06
**Research basis:** user-supplied `deep-research-report.md`, checked against current official Social Gamebox App Store descriptions/update notes. This is an independent KING-FUN implementation, not a claim of exact source-app parity.

## Product rules retained

- All game sessions are local pass-and-play on one device. No remote rooms, matchmaking, persistent chat, accounts, subscriptions, IAP or premium locks are added.
- Bundled content is sufficient for offline gameplay. Game randomness uses Web Crypto and committed outcomes are saved before reveal/animation.
- Audio/motion/browser capabilities are optional and have touch/keyboard or manual fallbacks where appropriate.
- The original Imposter, GuessUp, Truth or Dare and I Have Never games retain their existing implementations.
- Player agency is preserved: Share or Pass has no penalty, alcohol or required disclosure.

## Catalogue

There are 27 selectable game IDs: the original four plus 23 additions. Opposites Day and Wrong Answers Only share one ruleset; Charades is covered by GuessUp; Spy is the historical name for Imposter.

| Selectable title | Players | Implemented loop and options |
|---|---:|---|
| Imposter | 3–20 | Existing Classic, Mystics and Chaos local hidden-role modes; see `docs/mystery-who-rules.md`. |
| GuessUp | 2–32 | Existing team charades, timed turns, optional tilt/touch input and score/handoff. |
| Truth or Dare | 2–32 | Existing All Together, Spin the Wheel and One at a Time modes. |
| I Have Never | 2–32 | Existing All Together, Spin the Wheel and One at a Time modes; Fingers, Points and Stories response styles. |
| Timer Impostor | 3–32 | One hidden impostor is not given the shared target time. Each player makes a silent-counting stop attempt; the group votes on the suspicious player. |
| Werewolf | 5–20 | Secret Werewolf/Villager roles; private hostile night ballot; day discussion and village vote; repeat until a faction terminal condition. Optional phone narrator uses speech synthesis. |
| Mafia | 5–20 | Same local state machine as Werewolf with Mafia/Villager role labels; optional phone narrator. |
| Murder | 3–20 | One secret murderer; group observes wink-based eliminations and records each victim manually; surviving players vote on the suspected murderer. No camera or facial-recognition permission is required. |
| Fake It | 3–32 | One player privately receives the secret word. The group sees a broad category/clue (not the answer), asks yes/no questions, and each other player gets one guess. The word-holder answers without saying the word. |
| Fake Story | 3–32 | Each player is assigned the true-story or invented-story role, shares a story on the selected starter, then the group votes for the invented story. |
| Fact or Fiction | 3–32 | A statement is shown, one player is assigned the deceptive role, and the group votes after the answering/discussion turn. Seeded true/false metadata supports result resolution. |
| Wrong Answers Only | 2–32 | Players submit intentionally incorrect answers; the group votes for the funniest/best wrong answer. Optional browser speech synthesis reads the prompt when available. Also presented as Opposites Day. |
| Hot Bomb | 2–32 | A category and fuse are selected; players enter valid, non-repeated answers and pass the device. Fuse options: 8, 10, 12 or 15 seconds. KING-FUN house rule: two explosions remove a player from the active rotation; the source report does not specify strike/elimination thresholds. |
| Hot Bomb Duel | Exactly 2 | Face-to-face two-player Hot Bomb variant, with the same configurable fuse and a head-to-head result. |
| Who's Most Likely | 2–32 | One prompt is displayed; players cast one private vote for a participant; results reveal the group distribution. |
| Would You Rather | 2–32 | Two scenarios separated by `||`; each player votes once for A or B; results show the room split. |
| Share or Pass | 2–32 | Optional low-pressure prompt round. A player may share or pass without penalty or explanation. Replaces the drinking-oriented Share or Shot concept. |
| $20 Challenge | 2–32 | Ten theme-specific lots; each player starts with $20 and makes sequential private sealed bids. Highest valid bid wins; winner pays their bid. Offline group judging is used instead of depending on an AI judge. Anti-items filter is an explicitly labelled KING-FUN house rule that removes value-2 lots without spending budgets. |
| Tilt It | 2–32 | Forehead-facing word guessing, timed turns, Correct/Pass scoring; optional device tilt down/up plus touch fallback. Play styles: two teams with scoreboard, or solo everyone-takes-a-turn with individual scores. |
| Letterburg | 2–32 | Family-friendly word/charades mode built on the same timed guessing engine, with a separate simple-word pack; team or solo options. |
| Discussion Starter | 2–32 | Rotating open-ended conversation cards with next, skip and session-completion controls. |
| Who Am I? | 2–20 | Each player receives a unique identity. During that player's turn, the identity stays visible to the group on the outward-facing screen while they ask yes/no questions; the group marks a correct guess or passes. |
| Ten Tangle | 2–32 | Ten shuffled anagrams are presented together; solve in any order, track attempts, or reveal remaining answers and finish. |
| Qupid | Exactly 2 | Local couples conversation prompt deck. The supplied report claims 1,000+ prompts in the reference app; KING-FUN currently ships 10 original prompts, not a 1,000-question replica. |
| Questions for Love | Exactly 2 | Rotating reflective relationship prompts, with pass/advance controls. |
| A or B | Exactly 2 | One partner chooses between two preferences; the other predicts the choice; rotate across the prompt deck and track correct predictions. |
| Reverse Singing | 2–32 | Record a short original sung/spoken line, reverse the audio, then imitate and reverse the reply back for comparison. Classic mode runs the imitate/review loop. Battle mode lets the group award one point to the first correct recognizer. Five-second clips are held in memory only. |

## Mode-specific details and boundaries

### Timer Impostor

The target is selected once using Web Crypto. It is privately revealed only to non-impostors. The impostor sees no target. Players make individual timing attempts; the game transitions to a vote rather than judging timing accuracy itself. This follows the report's described bluff-detection loop without inventing a secret numeric scoring formula.

### Werewolf and Mafia

The hidden hostile faction is capped at `floor((players - 1) / 3)` with a minimum of one, and the setup control exposes only legal counts. Hostile players vote privately during night. A tie yields no night victim rather than a fabricated tie-break. The day vote is private. The faction terminal condition is hostile parity or elimination of all hostiles. The narrator is optional and uses local browser speech synthesis; if speech synthesis is unavailable, phase text remains visible.

The report does not specify expanded special roles, role powers or a complete balancing matrix. Those are intentionally not invented in this build; the implemented role set is the documented basic hostile/villager foundation. Each completed night ballot resets its cursor and generates a fresh private ballot order for the next day/night cycle.

### Murder

The game asks the group to observe wink-based actions and manually record who was eliminated. It does not attempt to detect winks using a camera. The report describes the social mechanic, not a camera feature, and the manual method avoids requesting unnecessary sensitive permissions.

### Fake It and Fake Story

Fake It follows the report's described secret-word loop: one word-holder sees the answer privately, the group asks yes/no questions aloud, and every other player may submit one guess. The bundled category/clue is shown to the group while the verified secret-word answer remains in content metadata; seed tests prevent a cue that simply repeats the answer or gives away the answer as a trivia question. The report notes that this title's wider rules are uncertain, so no extra scoring or lying roles are invented. The visible category cue is a KING-FUN usability aid for the yes/no question loop. Fake Story assigns one player to invent a believable story while the others tell true stories for the group to identify.

### $20 Challenge

The challenge includes ten tailored lots for each of ten bundled themes (pirate ship, home cinema, road trip, picnic, fantasy football team, study setup, survival cabin, music festival, beach day and tiny dream city). Each player starts at $20. The offline judging ballot is local and excludes self-votes; ties are resolved by total awarded item value, with an exact tie reported as shared. Custom user-created themes receive a neutral ten-lot market instead of inheriting a theme-specific pirate market. The source's AI judge is not invoked in this offline implementation.

Anti-items mechanics are not fully documented by the source beyond “pay so you don't get the bad items.” Because the report does not specify the amount or voting flow, KING-FUN uses an explicit house rule: automatically filter lots valued below 3, with no player budget deducted. This must not be described as exact reference-app parity.

### Reverse Singing

The current official listing describes recording a line, hearing it backwards, and recreating it; Battle awards a point to the first correct guesser. The app uses `getUserMedia`, `MediaRecorder` and Web Audio only after user interaction. Recordings never leave the browser and are cleared on reload. A browser without recording support displays an actionable fallback/error, rather than silently substituting an unimplemented mode.

## Data and implementation architecture

- Typed game IDs, setup options and session snapshots live in the shared frontend types/domain contracts.
- `domain/games/party-arcade.ts` creates sessions and owns reusable pure transition helpers (votes, scoring, auction settlement, faction terminal resolution, word scrambling).
- `games/PartyArcadeGame.tsx` is the lazy-loaded controller boundary. Feature-specific components are split by interaction family: social deduction, prompt/voting, timed fuse, tilt guessing, auction, word puzzles and recording-based audio.
- `games/party/PartyGameUI.tsx` provides reusable stage, card, action, player and metric primitives.
- Bundled prompt/word/theme content is in `content/seed.ts`; Fake It answers and Fact or Fiction verdicts are stored as hints/metadata, not re-parsed from display text.
- `domain/shared/validation.ts` recognizes the new `party-prompt` content kind, game IDs and persisted phase names.
- New sessions snapshot setup options and participant roster so resumed games do not inherit a later roster/settings change.

## Explicitly not implemented

The source report marks or describes the following as unknown, inferred or lacking rules: Touchdown, Secret Suitcase, Comedy God, Torment of Choice beyond its presumed overlap with Would You Rather, and any other named experience without a playable rule description. `Torment of Choice` is treated as conceptually overlapping the existing Would You Rather title, not as a separate duplicate game. The report's online room codes, remote play, chat, subscriptions, premium/IAP, matchmaking, analytics and social profiles are not imported into KING-FUN.

## Verification gates

1. `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build` and root `bun run check` on Bun 1.4.4.
2. Add Playwright flows for all 23 added game routes, setup option persistence, private role reveal, voting completion, browser reload/resume, audio permission denial, microphone unsupported state and motion permission denial.
3. Real-device tests for tilt sensor orientation, device audio playback/recording, background timer behaviour and offline PWA startup.
4. Keyboard/screen-reader tests for every private reveal, prompt, vote, text entry, score and result.


### Setup and content-selection refinements

Timer Impostor, Werewolf, Mafia and Murder are mechanics-only games. Their setup does not require an unused guide-content selection; role distribution and phase state are generated locally by the domain constructor. Other additions require at least one eligible item from a selected pack. Fake It content uses `Category or clue | Secret word`; the group sees only the category/clue during questions, while the answer remains structured metadata.
