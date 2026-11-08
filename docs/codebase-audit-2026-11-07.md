# KING-FUN implementation and gameplay audit

**Review date:** 2026-11-07  
**Scope:** application behaviour, gameplay state and transitions, content selection, storage, AI generation, Redis integration, moderation, security boundaries, and release wiring. Visual styling/layout review is intentionally excluded.  
**Review result:** the 18+ mode and associated content boundaries are implemented in source. Several gameplay and creator-flow corrections were made during this pass. This is a source-level and targeted-runtime audit, **not a production release sign-off**: the native Bun pipeline, live Redis scripts, and browser/device acceptance could not be run in this execution environment.

## 1. Executive summary

KING-FUN has a coherent local-first architecture: the browser owns players, active games, history, settings, and custom packs in IndexedDB; typed domain modules own most game rules and transitions; the Elysia backend is an optional gateway for AI generation, cache reads, feedback, and creator-only moderation. The 27-game registry and 23 added arcade session constructors are wired to their controllers. Bundled packs remain available without an AI key or network access.

The requested **18+ mode** is implemented as an explicit, off-by-default audience switch in Settings. Turning it on requires confirmation that every participant is 18 or older. Turning it off removes age-restricted content from selection and ends an active session marked as 18+. Generated content and cached pools are suitability-separated. A fresh backup import resets the 18+ opt-in and discards an active 18+ session.

The distinction between **database cache** and **live gameplay storage** is important:

- The AI gateway checks the Redis content vault before requesting a model response. A full validated pool can be returned without a provider call or provider quota use.
- Settings presents the returned batch for review. A player explicitly saves a selected batch as a local custom pack.
- Ordinary live game draws then use the local bundled/custom content catalogue. They do not make a Redis round-trip on every turn; this preserves offline play and avoids network-dependent gameplay.

The current AI generation surface supports four content families only: Imposter words/categories, GuessUp charades, Truth or Dare truths/dares, and I Have Never statements. The other 23 game IDs use their seeded/rules-based local controllers; they do not all have individual LLM prompt generators.

**Release status: not signed off.** The most important external gate is the current Gemini API contract: Google's March 23, 2026 additional terms say Gemini API clients must not be directed towards or likely to be accessed by under-18s, and say the API is for professional/business developer use, not consumer use. KING-FUN is currently an all-ages party-game application and still exposes Gemini as an optional provider for general content. The 18+ toggle does not solve that product-wide eligibility issue. See §8.

## 2. 18+ mode: implementation trace

| Layer | Implementation | Review result |
|---|---|---|
| Settings | `frontend/src/screens/SettingsScreen.tsx` | An “18+ mode” switch is present, defaults off, explains the audience boundary, and states that it is not identity/age verification. |
| Confirmation | `frontend/src/AppShell.tsx` | Enabling requires the “I confirm everyone is 18+” confirmation. Disabling an active age-restricted session returns the app to Home. |
| Persisted state | `frontend/src/types.ts` | `Save.adultMode` is boolean and defaults false. Normalization only treats literal `true` as enabled. |
| Backup import | `frontend/src/types.ts`, `frontend/src/AppShell.tsx` | Imported backups reset the flag to false and remove a currently active session marked adult. Adult-tagged custom packs may remain in the restored data, but are ineligible until the user opts in again. |
| Setup and gameplay | `frontend/src/screens/SetupScreen.tsx`, `frontend/src/domain/content/selection.ts`, `frontend/src/AppShell.tsx` | With mode off, only `general` (“all ages”) items/packs are visible/selectable. `teen`, `adult`, and unknown future suitability values are not eligible. Start-game checks repeat the suitability guard. |
| Manual packs/imports | `frontend/src/domain/shared/validation.ts`, `frontend/src/domain/storage/portal-storage.ts` | All-ages validation blocks sexual-topic vocabulary and high-risk intimate/identity/clothing-removal dares. Pack and item suitability must agree on save, restore and import. |
| Generation schema | `backend/content/schema.ts` | Adult requests require `adultMode: true` and `suitability: 'adult'`; an adult-mode request cannot ask for the general pool. |
| Provider route | `frontend/src/services/ai-providers.ts`, `backend/index.ts`, `backend/providers/generate.ts` | Adult requests are restricted to Groq. Gemini and Cloudflare are not used for adult generation. The model prompt requests edgy/dark/naughty adult themes but keeps the material non-graphic and bounded. |
| Vault identity | `backend/content/vault.ts`, `backend/content/schema.ts` | Cache pool keys, dedupe keys, content IDs and recent-item windows include suitability, preventing identical text in different pools from sharing identity or moderation state. |
| Vault read | `backend/content/vault.ts` | Cached items are served only when every corresponding moderation status can be read and is `approved`; missing or unavailable status data causes the pool read to fail closed. |

The bundled 18+ seed area contains **48 adult-tagged entries** across the four supported content families. It includes vocabulary such as BDSM, Hentai, Penis, Vagina, Condom and Orgasm; awkward/adult dating and sexual-history truths; optional dares; and adult relationship statements. The requested virginity question is represented with an explicit comfort qualifier and pass/fictional-answer alternative. The lip-kiss dare requires a clear yes and supplies an air-kiss alternative. The “I am gay!” theatrical line is fictional and optional; the app must not assign a real player's orientation.

The adult generator instructions deliberately do **not** mean graphic pornography or coercive dares are supported. The prompt and server validator reject graphic sexual descriptions, sexual instructions/erotic roleplay, sexual content involving minors or ambiguous ages, coercion, non-consensual contact, abuse, identity harassment/outing, threats, self-harm, dangerous stunts, illegal instructions, and personal data. Physical-contact dares must ask first, proceed only after a clear yes, and offer a no-contact alternative. Intimate questions must permit a no-explanation pass.

### Safety boundary limitations

The switch is a **client-side self-attestation**, not age verification. The confirmation is useful for preventing accidental activation in a normal session, but the saved boolean is in browser-local state and an API caller can forge `adultMode: true`. There is no identity, age-proof, or server-issued age-eligibility token tied to a real person. Do not represent this switch as legal age assurance or as protection against a determined user.

The all-ages/adult text filters are conservative pattern checks plus prompt instructions and schema validation. They catch the known examples and several common euphemisms, but regular expressions do not understand meaning. Creative paraphrases, misspellings, images, context across multiple sentences, or model mistakes may escape. A validator pass is not a semantic safety certification. Keep explicit user reporting, moderation, a pass/skip mechanism, and provider review requirements.

## 3. AI and Redis content-vault flow

### Request path

1. Settings chooses a game/content type and derives suitability from the 18+ switch (`general` when off; `adult` when on).
2. `generateAiContent()` posts to `/v1/content/generate` over HTTPS. Adult requests route only to Groq.
3. Backend validates request shape, item-kind/game pairing, suitability, and the explicit adult-mode declaration.
4. If the content vault is configured, the gateway reads the Redis pool before consuming an LLM generation slot. It excludes recent/near-duplicate items and requires approved status for all returned items.
5. If the pool is too small, a short Redis generation lease coalesces concurrent misses. Only then does the gateway check operator AI enablement, provider key, and rate/budget/concurrency quota before calling the provider.
6. The response is structurally validated, content is deduplicated, and a best-effort pool write occurs. Vault write failure does not discard an otherwise valid response.
7. Settings renders the generated/cached batch. The user must press **Save as local custom pack** before those results become part of that device's gameplay catalogue.

### Confirmed strengths

- Adult content has separate pool keys, content IDs, dedupe indexes, and recent queues.
- Redis is configured with a separate credential namespace from AI abuse/rate-limit storage.
- Redis REST URLs require HTTPS and do not embed user/password credentials; requests use bounded timeouts and `no-store`.
- Generation locks reduce duplicate provider calls for the same cache miss.
- Cache hits bypass provider quota consumption intentionally because they do not invoke the model.
- Generated and user-authored content is rendered as text, not injected HTML.
- Redis failure is treated as an optimization failure for normal live play; bundled/custom local play remains available.

### Important data/flow caveats

- Redis does not currently supply each live turn. The ordinary game engine selects from the browser's local catalogue. A user retrieves Redis content by using the Settings generator, then saves the returned batch into a local custom pack. This is intentional for offline-first gameplay, but it should not be described as automatic live database draws.
- A newly validated generated batch is written with Redis status `approved` using `SET ... NX` before a separate human review. Settings then presents the result for local review/save, but another client with the matching request can retrieve the pool before that person reviews it. “Approved” here currently means it passed the automated schema/pattern validation, not that a moderator reviewed it. This is a meaningful moderation-semantics gap if human approval is intended.
- Cache-hit requests run before the generation quota and provider-key check. That prevents repeated LLM spend, but cache reads themselves are not currently protected by a separate strict per-client read quota. Public cache contents could be scraped by a client that can reproduce an allowed API request. Content is not private user data, but read abuse deserves a dedicated low-cost limiter.
- If the user has no network access or Redis is not configured, Settings may fall back to bundled curated content for matching categories. Adult fallback content is drawn only from adult-tagged bundled entries. Some generation categories, such as generated category metadata, have no offline generator fallback.

## 4. Content validation, storage and moderation

- `parseContentItem()` checks game/content-kind compatibility, required IDs, text size, locale, suitability, tags and provenance. It rejects adult-topic text and hints unless the item is adult-tagged.
- `parseContentPack()` validates pack metadata, supported game ID, suitability and bounded content-ID lists.
- `saveCustomPack()` and `validateStoredCustomPackRecord()` verify that every item belongs to the pack's game, pack ID, content IDs and exact suitability. The same consistency is checked on restore/import.
- Backup import uses a fresh all-ages default and cannot carry an adult-mode opt-in to a different device.
- Community voting is rate-limited. Votes are HMAC-keyed, and automated quarantine requires negative votes from three distinct network-address digests, rather than trusting a browser-generated voter ID alone.
- Raw client network addresses are not stored in the vote keys; the digest uses the configured secret. The creator-only queue exposes quarantined items and supports Approve, Reject and Retire.
- A final moderation decision removes the item from the moderation queue. Quarantined/rejected/retired items are excluded from vault reads; app instances also maintain an in-memory blocked-ID set.

### Moderation and network limitations

- Browser `loadBlockedContentIds()` currently treats a failed/offline status lookup as an empty result so offline gameplay can continue. The blocked-ID cache is in memory, not a durable local moderation snapshot. After a reload while offline, a previously quarantined local item can therefore reappear until the server status sync succeeds. This is a known offline moderation-consistency gap.
- The anti-quorum uses network address digests, so people sharing a NAT/public IP count as one network for automatic quarantine. This is conservative against one person minting many IDs, but may undercount real independent users.
- `getClientAddress()` trusts Cloudflare/Vercel edge headers based on their presence. Production must guarantee the deployed ingress overwrites/strips caller-supplied copies of those headers; otherwise a direct caller could forge edge-looking headers and weaken per-network vote/rate limits. Confirm this at the hosting edge before relying on the IP quorum as an abuse boundary.
- Creator credentials and 30-day creator tokens are device-local. A device that is shared or left unlocked can expose the private creator panel to another user who can access that browser profile. Revoke/lock creator access on shared devices.

## 5. Gameplay implementation review

The app registers **27 distinct game IDs**. Four original controllers remain separate lazy-loaded modules. The 23 added titles route through the Party Arcade controller boundary and split into seven feature families. A source-level/Node smoke test constructed valid initial sessions for all 23 arcade titles and successfully passed those snapshots through the shared session validator. This verifies launch wiring and initial shape, not every later transition or visual/browser behavior.

| Game/controller area | Review notes |
|---|---|
| Imposter (`ImposterGame.tsx`, `domain/games/imposter.ts`, `imposter-pack.ts`) | Supports 3–20 players, custom category import/export, Classic/Mystics/Chaos modes, private role reveal/hide and handoff, hint configuration, timer/vote options and hidden voter results. Reveal begins on input and conceals on release/cancel/focus loss. Custom import is bounded and validated. **Known content limitation:** bundled category hints are shared category-level hints; they are not 20 individually authored hints per word. Some reference-rule details (including full Troll Mode/elimination/tie semantics) are explicitly not specified, so exact parity is not claimed. |
| GuessUp (`GuessUpGame.tsx`, `domain/games/guessup.ts`, `guessup-tilt.ts`) | Team assignment, timed rounds, Correct/Pass scoring, turn expiry/handoff, score snapshot and touch fallback are present. Tilt is an optional enhancement and requires permission; touch remains available. Must still be exercised on real device orientation APIs. |
| Truth or Dare (`TruthOrDareGame.tsx`, `truth-or-dare-wheel.ts`) | Player selection and the separate eight-sector Truth/Dare wheel commit their outcomes before animation. The wheel is evenly divided 4/4. Spin-wheel mode selects the player first; all-together and one-at-a-time preserve their own roster semantics. Skip/pass/report routes do not require an alcohol penalty. |
| I Have Never (`NeverHaveIEverGame.tsx`, `never-have-i-ever.ts`) | All-together, spin-wheel and one-at-a-time modes are distinct. Group mode tracks each player's response before advancing; response styles are fingers, points or stories. Skip remains separate from response and alcohol is not required. |
| Timer Impostor, Werewolf, Mafia, Murder, Fake Story, Fact or Fiction (`SocialDeductionGame.tsx`) | Local private-role handoffs, day/night or answer/vote stages, ballots and faction/result transitions are handled by explicit session state. Werewolf/Mafia reset private night-ballot cursors between cycles. Murder is manually observed/recorded; no camera or facial-recognition permission is used. Expanded special roles are not implemented because the reference rules do not define them. |
| Fake It, Wrong Answers Only, Who's Most Likely, Would You Rather, Share or Pass, Discussion Starter, Who Am I?, Qupid, Questions for Love, A or B (`PromptArcadeGame.tsx`) | Prompt, answer, vote and reveal loops share the prompt controller but maintain mode-specific phase data. Fake It keeps secret answers separate from public cues. Poll loops preserve deck position and round vote history. A-or-B stores each chooser/guesser result and now has a dedicated final per-player standings/tie screen rather than falling through to generic poll output. Share or Pass has no penalty. Qupid currently ships 10 original prompts, not the reference report's much larger claimed library. |
| Hot Bomb / Hot Bomb Duel (`HotBombGame.tsx`) | Timed fuse, no-repeat answer checks, player progression, strikes/elimination and two-player Duel variant exist. The “two explosions eliminate a player” rule is a documented KING-FUN house rule because the source did not specify a strike threshold. Deadline commits are based on scheduled timestamps, and round/variant changes are included in timer effect dependencies. |
| $20 Challenge (`Challenge20Game.tsx`) | Ten-lot auctions, player budgets, private bid collection, deterministic settlement/tie handling, and judging that excludes a player's own vote are represented. The AI judge in the reference source is not implemented; group/local judging is used. “Anti-items” is a labeled house rule, not claimed as exact reference parity. |
| Tilt It (`TiltItGame.tsx`, `party-arcade.ts`) | Timed forehead guessing, Correct/Pass and touch fallback are present. **Fixed in this pass:** tilt now requires return to a neutral band before another gesture scores; a sustained tilt cannot repeatedly score. Device calibration/permission/orientation still needs real-device verification. |
| Letterburg and Ten Tangle (`WordArcadeGame.tsx`, `party-arcade.ts`) | Separate simple-word guessing and ten-anagram puzzle loops use seeded content, tracked attempts and completion/reveal state. |
| Reverse Singing (`ReverseSingingGame.tsx`) | Microphone access is requested only after user interaction. Five-second audio is kept in browser memory; no upload or backup is performed. Recording support and permission denial must still be tested on browsers/devices. |

### Additional gameplay corrections included in this archive

- A-or-B final results now render per-player prediction standings and ties.
- Tilt It requires a neutral return before another sensor-triggered scoring action.
- The creator moderation queue now loads on authenticated creator state even after the unlock dialog closes; previously its fetch condition depended on the dialog remaining open, which could make an unlocked creator appear to have an empty queue.
- Truth/Dare player-specific prompts (including the creator-only Kailas easier slice) are selected after the current player is known. The Kailas override applies only to an individually named Kailas turn after server-verified creator unlock; it does not alter shared or other players' turns.

## 6. App architecture, state and release wiring

- **PWA/browser state:** `frontend/src/types.ts`, `frontend/src/domain/storage/portal-storage.ts`, and the service-worker modules validate and persist local state, custom packs and game snapshots. Imports are normalized separately from ordinary saves. Session data includes a round-owned roster so a later edit to the global player list does not silently replace the participants of a resumed game.
- **Game state:** classic game logic is in pure domain helpers; Party Arcade state/transition helpers live in `frontend/src/domain/games/party-arcade.ts`. Controllers are split by interaction family and lazy-loaded through the shell boundary.
- **Randomness:** the app uses Web Crypto-backed selection/shuffling helpers where game outcomes are committed; animations visualize already-selected state rather than deciding winners.
- **Backend:** `backend/index.ts` exposes health/status, creator unlock/verify, content generate, feedback, content status and creator moderation routes. Request body limits, origin checks, HTTPS handling, safe errors and no-store responses are present.
- **AI provider secrets:** browser provider keys stay in tab memory and are sent only in a user-triggered HTTPS request. Cloudflare operator credentials remain on the server. `.env.example` has blank secrets; no `.env` secret file was found in this extracted project.
- **Deployment:** root checks include source policy, release contracts, lint, type-check, unit tests, dependency audit and production build/budget. Vercel headers include CSP/HSTS/nosniff/frame restrictions and a Permissions Policy that preserves same-origin microphone for Reverse Singing while disabling unrelated sensors.

## 7. Verification actually run in this environment

| Check | Result | What it proves / does not prove |
|---|---|---|
| `node scripts/check-release-contracts.mjs` | **147/147 passed** | Source-level implementation contracts, including the new 18+ pack filtering, reviewed-save flow and creator moderation queue lifecycle. Not a full runtime integration test. |
| Node 22 native TypeScript transpile audit | **110 TS/TSX/MTS/CTS files transpiled; 0 syntax diagnostics** | Syntax/transpilation only; not full TypeScript type checking. |
| `node --check` over repository `.mjs` files | **Passed** | JavaScript module syntax. |
| Targeted domain smoke (`node --experimental-strip-types /tmp/kingfun-domain-smoke.mjs`) | **Passed** | Constructed initial sessions for all 23 added arcade games, validated the snapshot shapes, confirmed 27 registered games and that 48 adult-tagged seeded items are excluded when 18+ is off. |
| Native Bun checks | **Not run** | Bun is not installed in this execution environment. |
| Frontend/backend dependency-backed lint/typecheck/unit tests | **Not run** | Workspace dependencies are not installed; `frontend/node_modules` is only a small placeholder directory. |
| Production build and bundle budgets | **Not run** | Requires Bun and installed frontend packages. |
| Playwright/axe browser tests | **Not run** | Requires installed dependencies and browser binaries. |
| Redis Lua integration | **Not run** | No Redis CLI/server or configured live vault credentials are available. The Lua scripts were source-reviewed only. |
| Live provider requests | **Not run** | No live Groq/Gemini/Cloudflare keys were used. |
| Hosted edge/header/proxy verification | **Not run** | Requires the actual deployment host/preview environment. |

The repository contains 27 test/spec files, including backend route/schema/security tests, content/selection tests, game-domain tests, storage/service-worker tests and Playwright UI/axe tests. Their existence is not a claim that they passed in this run.

## 8. External research and release blockers

### P0 — Gemini API client eligibility mismatch

Google's current [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) are effective March 23, 2026. They state:

- A developer must be 18 or older to use the APIs.
- The API cannot be used as part of a website/application/service directed towards or likely to be accessed by people under 18.
- Google AI Studio and Gemini API use is for developers building with Google AI models for professional/business purposes, not consumer use.

KING-FUN currently has all-ages general content and its Settings provider list still offers Gemini for general requests. A separate 18+ toggle for adult content does not make the entire all-ages app ineligible for under-18 access. This should be treated as a **release blocker for Gemini use in the current product** unless the application/provider arrangement is changed to satisfy Google's terms. Remove/disable Gemini for this product or obtain a clearly applicable approved arrangement before enabling that integration in a release. Source: Google, [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms), particularly “Age Requirements” and “Use Restrictions”.

### P1 — Groq customer and content-use eligibility must be confirmed

Groq's [Services Agreement](https://console.groq.com/docs/legal/services-agreement), last modified June 22, 2026, says its Cloud Services/AI Model Services are not for consumer use and the customer accessing them must be 18 or older. It also expressly describes API integration into a Customer Application and availability to End Users through that app, while placing responsibility for applicable obligations on the customer. Groq's [Acceptable Use & Responsible AI Policy](https://console.groq.com/docs/legal/ai-policy), effective October 15, 2025, prohibits illegal, offensive, invasive, discriminatory, dangerous or harmful purposes and specifies additional disallowed sexual/abuse-related categories. The fact that a prompt is labelled “18+” does not automatically establish provider approval. Confirm the intended party-game use, adult non-graphic content, and customer-app audience with the provider/account terms before production use. Do not design prompts to bypass provider safeguards.

### P1 — The 18+ toggle is not an age gate

For a genuine age-restricted release, a local checkbox and client-provided `adultMode` field are insufficient to establish the age of a device user or every participant. A determined user can call the API directly with the field set. A production age-control design needs a properly assessed age-assurance flow, a server-enforced eligibility token/session, clear jurisdiction/audience decisions, and a privacy/data-minimization plan. That is outside the scope of this code-only switch.

### P1 — Automated content filtering is not semantic moderation

The backend rejects known explicit/coercive/minor-related patterns and prompts the model with clear restrictions, but no text-pattern system can guarantee that all generated results are safe. The Redis vault currently calls newly validated outputs `approved` automatically. If “approved” is intended to mean human review, this needs to be changed to a pending state and a creator approval workflow before shared retrieval. Otherwise document `approved` as “passed automated validation” and retain the reporting/quarantine layer.

### P2 — Offline moderation sync can be stale

The client keeps blocked content IDs in memory. Failed/offline status fetches do not persist a last-known moderation snapshot, so a previously flagged item can reappear after a fresh offline reload. Consider persisting a signed/versioned last-known blocklist locally and refreshing it when online; also define how stale the snapshot may be.

### P2 — Cache-read scraping and edge-IP trust

Generation cache hits intentionally bypass LLM quotas, but the cache-read route does not have a separate read quota. Add a modest per-network cache-read limiter to deter scraping without charging the expensive generation budget. Verify the deployment host sanitizes `cf-ray`, `cf-connecting-ip`, `x-vercel-id`, and `x-forwarded-for`; the anti-quorum's distinct-network rule depends on trusted edge values, not caller-controlled headers.

### P2 — Game rules/spec parity is not complete by design

Several new games include documented house rules or deliberately limited scope: no expanded Werewolf/Mafia special roles, manual Murder observation rather than camera detection, two-strike Hot Bomb elimination, local judging rather than an AI judge for $20 Challenge, a limited Qupid deck, and unspecified Imposter Troll/elimination/tie details. These should remain clearly documented rather than marketed as exact parity with the external source material.

## 9. Prioritized next steps before production

1. Resolve Gemini eligibility for the all-ages product; confirm Groq's intended use and account terms for the 18+ generation path.
2. Decide whether the 18+ switch is merely a casual party-session confirmation or must meet a formal age-gating requirement. If the latter, implement a server-verifiable age-eligibility system before public release.
3. Decide whether cached generated content is automatically approved by automated validation or must be manually approved by the creator; align status names and retrieval with that decision.
4. Persist and refresh last-known moderation blocks for offline reloads; define an expiry/staleness policy.
5. Add a separate cache-read quota and verify trusted proxy headers in the deployed edge environment.
6. Under Bun 1.4.4 with frozen dependencies, run the complete `bun run check` pipeline, security audit, production build/budget and Playwright/axe suite. Retain the full logs.
7. Run the browser/device acceptance plan in `docs/phase-6-release-hardening.md` and `docs/party-arcade-game-specs.md`, including private reveal, complete voting/round loops, audio/tilt permission denial, offline install/startup, backup/restore, multi-tab conflicts and service-worker upgrade/rollback.

**Bottom line:** 18+ content has a distinct opt-in, content pool, backend schema and local gameplay filter. All-ages mode excludes age-restricted content from setup, selection, import-created packs and generation requests. The source-level/game-launch checks pass. The app is not yet production-approved until the provider eligibility, age-assurance expectations, semantic moderation policy, live Redis behaviour and full Bun/browser release gates are resolved.
