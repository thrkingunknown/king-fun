# Social Gamebox report — KING-FUN implementation assessment

**Source:** user-supplied `deep-research-report.md` (189 lines; reviewed 2026-11-06).

## Scope distinction
The report describes Social Gamebox, not a KING-FUN specification. It lists 30+ titles and marks some rules as inferred or unclear. It also describes online rooms, subscriptions, premium content, age onboarding and chat. Those product decisions conflict with KING-FUN's local-first/no-account/no-paywall requirements and must not be imported automatically.

## Mechanics already represented
| Report concept | KING-FUN implementation |
|---|---|
| Impostor / Spy hidden-role word game | Imposter / Mystery Who |
| Truth or Dare | Truth or Dare |
| Never Have I Ever | I Have Never |
| Charades / Heads-Up clue-giving | GuessUp, including optional tilt input |
| Pass-and-play | All 27 local games |
| Team timed guessing | GuessUp |
| Local prompt packs and no-repeat handling | Existing content/storage architecture |
| Player selection wheel / group turns | Truth or Dare and I Have Never |

## Additional documented games now implemented
- Timer Impostor: secret target time, group counts aloud, identify the player who misrepresented their stop.
- Werewolf / Mafia: night/day role phases and voting; phone-narrator mode is mentioned in update notes.
- Murder: hidden wink-based eliminator and group detection.
- Fake Story: each player tells a story; group identifies the fabricated one.
- Fact or Fiction: true/false statement round with one assigned liar.
- Opposites Day / Wrong Answers Only: answer prompts with intentionally incorrect responses.
- Hot Bomb / Hot Bomb Duel: timed category naming and pass-the-device loop; Duel is two-player.
- Who's Most Likely: group poll on a prompt.
- Would You Rather: group poll between two scenarios.
- Tilt It: timed forehead-facing guessing with tilt-to-correct / tilt-to-skip; teams or solo.
- Charades: act-out guessing.
- Who Am I?: identity guessing through yes/no clues.
- Ten Tangle: unscramble ten mixed words.
- Qupid: two-player relationship/conversation prompt deck. KING-FUN uses 10 original prompts; it does not reproduce the report's claimed 1,000+ item library.
- Questions for Love: rotating reflective relationship prompts for two players.
- A or B: one partner selects a preference between two options and the other predicts it; roles rotate.
- Reverse Singing: the report names the title in update notes; the recording/reverse/recreate loop is grounded in the currently documented official game description, not the attached report alone.

## Underspecified or inferred titles
Do not fabricate rules for Touchdown, Secret Suitcase or Comedy God; the report does not give a playable ruleset for these. Torment of Choice is described only as presumed to resemble Would You Rather, so KING-FUN treats it as an overlapping concept rather than a separate title. Fake It is only loosely described by the report; KING-FUN implements the narrow, explicitly stated private-word / yes-no-question / group-guess loop and does not claim complete reference-app parity.

## Explicit exclusions unless requirements change
- Online room codes, remote play, chat and matchmaking.
- Subscriptions, IAP, premium packs and paywalls.
- Alcohol-based Share or Shot mechanics; KING-FUN provides a no-pressure Share or Pass alternative instead.
- Unspecified age onboarding/U18 gating.

## Engineering approach for approved additions
1. Typed domain state machine independent of React.
2. Web Crypto selection and committed outcomes before reveal/animation.
3. Bounded validated bundled packs and explicit exhaustion behaviour.
4. Reusable setup/player-roster and shared interaction components.
5. Persisted resumable state with migration/normalization tests.
6. Unit/property tests for transitions and edge cases.
7. Keyboard/touch/reduced-motion support and browser acceptance.
8. Changelog, requirements, test catalogue, checklist and verification updates.

A generic prompt screen or non-functional catalogue tile does not count as implementation.
