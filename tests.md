
## 2026-11-07 — Ambient renderer compiler/type regression

- `AmbientBackground.tsx` keeps the React component limited to a ref and effect that mounts the module-level renderer. The renderer obtains a nullable 2D context once, explicitly narrows it to `CanvasRenderingContext2D`, and owns all mutable animation state outside component scope.
- The release-contract audit and `scripts/release-contracts.test.ts` require that lifecycle boundary and context narrowing. This prevents React Compiler immutability warnings and strict TS18049 nullability regressions from returning.
- The user's latest Playwright log records 20/20 browser tests passing, including the full additional-game controller smoke loop and axe scan; rerun after the exact source patch to retain that evidence for the final revision.

# Test Strategy and Test Catalogue

## Current continuation — 2026-11-06

- Regression contracts cover the browser timeout ref type, effect-managed command-palette RAF handles, provider identity/switch grid semantics, and high-contrast hero labels.
- A real Chromium CSS/DOM fixture verifies provider identity visibility, no horizontal overflow, 44px minimum switch height, and hero-label contrast in dark/light modes at 320–1440px across eight viewport widths.
- The build-budget script has a synthetic fixture covering entry/modulepreload and recursive deferred-import accounting. A real Vite build remains necessary to validate actual bundle sizes.
- Native Bun 1.4.4 lint, semantic typecheck, unit tests, audit, production build, and integrated Playwright/axe remain pending for this exact source revision.


## 2026-11-06 — Regression additions for current pipeline findings

- Verify `AppShell` timer refs use numeric browser timer IDs with DOM APIs under Node typings.
- Verify command-palette animation-frame IDs live in effect refs, both scheduled frames are cancelled during cleanup, and no local captured variable is reassigned after render.
- Verify provider names occupy a dedicated visible grid column, the provider switch is a direct accessible grid item, and compact provider rows remain non-overflowing at 390, 620, 768, and 1024 CSS px.
- Verify all four tiny animated home-token labels render at full opacity with a white foreground against dark token-card surfaces; retain full axe WCAG 2.1 AA scans of home, settings, and setup.

**Status:** The user's Bun 1.4.4 run on the Phase 5 screenshot-fix archive reported 161 passing tests across 23 files, both frontend/backend typechecks passing, and the frontend production build succeeding. That run reported 16 Oxlint `no-useless-escape` warnings in provider JSON fixtures; the subsequent fixture-only cleanup removes those redundant escapes without changing evaluated strings. Phase 6 adds release-contract tests under `scripts/`, security-header assertions, a native Bun advisory-audit gate, and a post-build gzip/precache/source-map/secret scan. The exact Phase 6 archive adds seven release-contract tests and security-header assertions; it still needs `bun install --frozen-lockfile` and `bun run check` on Bun 1.4.4. Browser/device acceptance, live provider calls, and hosted recovery checks still require operator environments. Built-in Imposter word banks are no longer bundled: every built-in category is metadata-only and generates through the ordered API pipeline with 20 distinct hints per generated word. Report-undefined Troll/elimination/win/tie mechanics remain open by design; see `todo.md` and `verification.md`. **Test runner baseline:** Bun test runner for unit/property/integration tests. Browser E2E tooling must pass a Bun compatibility spike before adoption. All install/run commands use Bun only.
**Test runner baseline:** Bun test runner for unit/property/integration tests. Browser E2E tooling must pass a Bun compatibility spike before adoption. All install/run commands use Bun only.

**Latest triage (2026-11-06):** The user's Bun 1.4.4 log on the prior revision showed 188/188 unit/contract tests, both TypeScript project checks, and the moderate-level security audit passing. It still had one frontend React Compiler refs warning, a failing initial-entry gzip budget, and 4/13 E2E failures (320px grid overflow, provider label visibility, Ctrl+K, and home-card label-in-name). The current source contains targeted fixes and extra Playwright/release-contract coverage. Native Bun and integrated Playwright/axe must be rerun against the exact updated archive; see `verification.md`.

## 1. Test layers

1. **Unit:** pure RNG, deck, schemas, reducers, transitions, scoring, deadline reconciliation, normalization, provider parameter validation.
2. **Property/model tests:** random selection bounds, no-repeat windows, legal state transitions, persistence round-trips, migration invariants.
3. **Component:** accessible controls, prompt cards, wheel presentation, reveal masking, sensor fallback, reduced motion.
4. **Integration:** IndexedDB repositories, service-worker cache strategy, Elysia API routes, provider mocks, offline fallback.
5. **Browser E2E:** full game journeys on mobile and desktop viewports, browser storage and reload behavior, multi-tab conflicts, keyboard/touch behavior.
6. **Visual regression:** portal/game setup/play/result states in agreed viewports; compare only stable, deterministic visual states.
7. **Accessibility:** automated axe-like checks only if selected tooling is verified and Bun-compatible; always include manual keyboard, screen reader, zoom/reflow, reduced-motion, and contrast checks.
8. **Security/abuse:** secrets, BYOK, input validation, output injection, CORS/CSP, rate limits, quotas, log redaction, cache behavior.
9. **Performance/resilience:** route bundle loading, animation profiles, constrained devices, offline startup, provider outage, storage exhaustion.

## 2. Test conventions

- Test names include stable IDs from this catalogue.
- Domain unit tests use deterministic injected RNGs; production RNG is separately tested against its Web Crypto source and bounded-integer implementation.
- Do not use statistical tests as proof of cryptographic quality. Code review verifies the CSPRNG source and rejection algorithm; statistical tests catch implementation defects only.
- Tests must not depend on live provider availability. Use mocks/contract fixtures for ordinary CI. Run opt-in live smoke tests using dedicated credentials and strict budget limits.
- All timers, clocks, and random sources used by domain logic must be injectable for deterministic testing.
- Every game action should have tests for valid transition, invalid transition, idempotency, persistence, and reload where applicable.
- Sanitized fixtures only. Never put real BYOK keys, actual personal disclosures, or real player names into tests or CI artifacts.

## 3. Unit and property test catalogue

### Setup and toolchain

- **TEST-SETUP-001:** architecture decision log includes current official documentation and support evidence for the framework/build/runtime.
- **TEST-SETUP-002:** every selected CLI/package runs through the chosen Bun workflow; unsupported tools block adoption.
- **TEST-SETUP-003:** clean checkout installs dependencies with Bun, builds, typechecks, and runs tests without generating any non-Bun lockfile.
- **TEST-SETUP-004:** the repository policy script fails on prohibited package-manager commands, non-Bun or duplicate lockfiles, an unpinned package manager, or missing Bun quality-gate commands in CI; the frozen install fails on lockfile drift.

### Core schemas and game state

- **TEST-CORE-001:** valid shared game session and content fixtures pass runtime validation.
- **TEST-CORE-002:** missing/invalid IDs, invalid enum values, invalid locale/version/phase, game-kind mismatch, duplicated player/pack IDs, invalid timestamps, and unbounded/non-JSON snapshot data are rejected.
- **TEST-CORE-003:** invalid game actions return a typed error and do not mutate prior state.
- **TEST-CORE-004:** serializing and restoring each game state preserves the exact current phase and committed outcome.

### Randomness and no-repeat

- **TEST-RNG-001:** bounded integer returns only values in `[0, n)` for all supported positive `n`; rejects invalid bounds.
- **TEST-RNG-002:** rejection sampling handles the modulo-bias boundary (use injected values at/above the acceptance limit and verify rejection).
- **TEST-RNG-003:** Fisher–Yates preserves length and multiset; no element is lost or duplicated.
- **TEST-RNG-004:** deterministic internal source produces reproducible test sequences; production adapter calls Web Crypto and production selection APIs do not accept caller-provided RNGs.
- **TEST-RNG-005:** distribution simulation for small domains is checked with a pre-defined statistical tolerance; this is a regression check, not a cryptographic certification.
- **TEST-RNG-006:** player exclusion window is 0 for n<4 and `max(1, Math.round((n / 2) - 1))` for n>=4; boundary cases 3, 4, 5, 6, 7, 8, 9, and 10 produce 0, 1, 2, 2, 3, 3, 4, and 4 respectively.
- **TEST-RNG-007:** the recent-player selector samples all eligible IDs over many injected test permutations; no hidden fixed-order bias exists.
- **TEST-RNG-008:** a content deck cycles through every unique stable ID once before reshuffling, except explicit pack filtering.
- **TEST-RNG-009:** empty/small pools trigger documented fallback without infinite retry or non-termination.

### Content

- **TEST-CONTENT-001:** content schema requires stable ID, locale, pack, category, suitability, provenance, and license metadata.
- **TEST-CONTENT-002:** canonical duplicate detection handles Unicode normalization, whitespace/case/punctuation rules without mutating display text; each game's selectable content pool has no canonical duplicates. Identical display text across different games is allowed because game pools are isolated and may legitimately reuse a word in different mechanics.
- **TEST-CONTENT-003:** a prompt from the wrong locale or suitability pack is never served.
- **TEST-CONTENT-004:** custom pack import rejects malformed, oversized, duplicate-ID, and unsupported content.

### Persistence

- **TEST-STOR-001:** IndexedDB commits a game action and restores the same snapshot after simulated process termination/reopen.
- **TEST-STOR-002:** IndexedDB transaction failure leaves no partially written session state.
- **TEST-STOR-003:** every stored record includes supported schema version and stable ID.
- **TEST-STOR-004:** localStorage contains only approved small preferences; no game secrets or BYOK data.
- **TEST-STOR-005:** quota/storage-unavailable errors produce a warning and a safe non-persistent mode where feasible.
- **TEST-STOR-006:** each supported previous schema migrates to the current schema without losing committed game outcomes.
- **TEST-STOR-007:** failed migration preserves the original record and presents recovery/export options.
- **TEST-STOR-008:** export/import preserves custom content and history with validation.
- **TEST-STOR-009:** delete history and delete a custom pack remove the intended records only.
- **TEST-STOR-010:** BroadcastChannel revision notification refreshes stale tabs.
- **TEST-STOR-011:** concurrent stale writes cannot silently overwrite a newer active session.

### Offline and service worker

- **TEST-OFF-001:** app shell and curated game packs are available after a successful initial cache.
- **TEST-OFF-002:** offline reload restores portal and current local session.
- **TEST-OFF-003:** AI-dependent UI explains offline unavailability and falls back only to permitted curated packs.
- **TEST-OFF-004:** new release updates cached assets without mixing old HTML and new chunk versions.
- **TEST-OFF-005:** sensitive provider calls and BYOK headers/bodies are excluded from Cache API storage.

### Shared UI and accessibility

- **TEST-UI-001:** all 27 game cards and all four original game screens share typography, spacing, button semantics, focus style, and navigation patterns.
- **TEST-UI-002:** each game's theme is distinctive and text/control contrast remains sufficient.
- **TEST-UI-003:** controls have accessible names and roles; unlabeled controls fail the test.
- **TEST-UI-004:** focus order is logical and focus is managed when dialogs/screens open and close.
- **TEST-UI-005:** dynamic prompts/status updates are announced once without repeated disruptive announcements.
- **TEST-UI-006:** every primary task is completable by keyboard alone.
- **TEST-UI-007:** reduced-motion mode removes/reduces non-essential animation and preserves state clarity.
- **TEST-UI-008:** layouts support zoom/reflow, safe areas, long player names, and virtual keyboard without clipped actions.
- **TEST-UI-014:** any adopted third-party component/icon/motion package remains keyboard/touch accessible, respects reduced motion, preserves semantic labels/focus behavior, and does not move domain rules into the presentation dependency.

## 3A. Implemented Phase 1 test files

The current implementation adds `src/domain/shared/validation.test.ts`, `src/domain/random/random.test.ts`, and `src/domain/content/canonicalize.test.ts`. These cover contract parsing, Web Crypto adapter range checks, rejection sampling, Fisher–Yates, deterministic player selection, shuffled deck cycles, fallback/exhaustion, seed-pack metadata, and duplicate detection. The user confirmed that all Phase 0–1 checks passed locally on 2026-11-03; see `verification.md`. The original Mystery Who report is now archived in `docs/references/mystery-who-full-report.md`; report-derived local-domain tests are listed below and implemented in `src/domain/games/imposter.test.ts` / `imposter-pack.test.ts`. Browser/device cases remain pending.

## 4. Game-specific tests

### Imposter

- The shared startup overlay appears for every game Start path, displays the selected `GameMark`, respects reduced motion, and remains visible until the local session is ready. The Imposter generation E2E responds with NDJSON progress frames and asserts content-vault lookup, provider generation, validated-content save, and ready states are visible before gameplay.
- Backend route tests verify that `Accept: application/x-ndjson` streams ordered progress frames followed by a final status/body frame, while ordinary clients retain the existing JSON response contract.

- The role-reveal browser regression stubs `/api/v1/content/generate` with a schema-shaped five-word batch and asserts that the selected built-in category title/description reach the provider pipeline. This keeps the reveal test deterministic without restoring a bundled word bank or depending on a live provider/backend.

- **TEST-IMP-001:** valid player roster starts a round; invalid roster is rejected.
- **TEST-IMP-002:** civilian/special role counts match the configured ruleset.
- **TEST-IMP-003:** the secret word and role assignment are committed atomically before the first reveal.
- **TEST-IMP-004:** reload at setup/reveal/discussion/vote/result restores the same phase, word, roles, and votes.
- **TEST-IMP-005:** the report-defined Mr. White role receives category only (no secret word or hint) in Mystics/Chaos modes through every view model and rendered reveal state; Classic never assigns Mr. White.
- **TEST-IMP-006:** invalid/duplicate votes, tie, and resolution paths follow the configured ruleset.
- **TEST-IMP-007:** previous player's reveal is masked before the next player may continue.
- **TEST-IMP-008:** reveal is usable with keyboard, screen reader, and reduced motion.
- **TEST-IMP-009:** new round creates one new assignment; rerender/reload does not create another assignment.

### Imposter domain tests added in Phase 4.0

- Mystic-count boundaries: 3–5 players = 1; 6–10 = 2; 11–15 = 3; 16–20 = 4.
- Round factory rejects invalid player counts, duplicate IDs, malformed reveal orders, and empty secret words.
- Sequential voting accepts one final vote or Skip Vote per player, supports self-voting, rejects out-of-turn/duplicate/invalid votes, and distinguishes unique leader, tie, and no-vote outcomes.
- These tests cover the supplied report-defined local rules. They do not invent behavior the report leaves undefined, and they do not establish pixel-level UI parity with a separate application.

### Imposter — Mystery Who report-based local rule extensions

- **TEST-IMP-010:** player-count boundaries 2, 3, 5, 6, 10, 11, 15, 16, 20, and 21 are validated; only 3–20 starts.
- **TEST-IMP-011:** Mystic count is exactly 1 for 3–5, 2 for 6–10, 3 for 11–15, and 4 for 16–20; at least two non-Mystics remain.
- **TEST-IMP-012:** all report-defined local phases and settings are honored: setup, private reveal, discussion-only timer, optional voting, Mr. White threshold/guess, and results. Do not assert an undocumented faction win condition.
- **TEST-IMP-013:** one vote/Skip Vote decision is tracked per player; self-voting is accepted; duplicate/late/change attempts match the reference rules.
- **TEST-IMP-014:** tie and all-skip/no-vote ballots produce explicit tally states without inventing an elimination, faction victory, or winner rule not specified in the report.
- **TEST-IMP-015:** Troll Mode remains unimplemented/disabled until its effects are specified; the app does not imply that toggling it changes roles or game outcomes.
- **TEST-IMP-016:** all 30 report-named built-in categories plus the 18+ After Dark category are available as metadata-only packs; combined categories are filtered and one category is chosen before generation. The selected title/description are sent through the provider-order pipeline; generated content is validated for 20 distinct answer-safe hints. Manual custom word packs can be created, edited, selected, deleted, imported, and exported.
- **TEST-IMP-017:** the global last-10 selected-word history persists across reloads and applies across categories; stable-ID and normalized-text duplicates cannot bypass exclusion.
- **TEST-IMP-018:** when all words in a custom selection are in the last-10 history or otherwise exhausted, the game reports exhaustion and never silently repeats.
- **TEST-IMP-019:** dark-mode preference, custom categories, word history, and committed classic session state survive refresh/reopen when storage is available.
- **TEST-IMP-020:** provider-order generation for built-in categories sends the selected category title/description; provider failure, offline, quota, timeout, or schema failure produces a clear error and never silently substitutes another category's content. Manually authored/imported local word packs remain usable offline.
- **TEST-IMP-021:** classic game can start and complete offline after initial asset cache; no online service is required.
- **TEST-IMP-022:** private reveal never leaks a previous player's role/word to the next player, including back-navigation and reload paths.
- **TEST-IMP-023:** Classic never assigns Mr. White; Mystics assigns exactly one; Chaos applies 1–3 ordinary Mystics, 45% Mr. White chance at 4+ players, and always preserves a Civilian.
- **TEST-IMP-024:** restart/new-round behavior resets only the fields the reference resets and retains configured preferences/categories/history as specified.
- **TEST-IMP-025:** no online-only feature (lobby, host, network vote, chat/voice, matchmaking) is required or exposed in classic mode.

### Mystery Who report-derived local acceptance cases

- **TEST-IMP-046:** Classic contains only Civilians and ordinary Mystics; Mystics includes exactly one Mr. White plus the configured ordinary Mystic count; Chaos randomizes one to three ordinary Mystics, applies the reported 45% Mr. White chance only at four or more players, and preserves at least one Civilian.
- **TEST-IMP-047:** Civilian receives category + word; Mystic receives category + optional hint(s) but never the word; Mr. White receives category only. No role information leaks through hidden DOM/accessibility text, transitions, reload, or handoff.
- **TEST-IMP-048:** Mystic Hint off gives no Mystic hints; on supports shared or distinct hints. Mr. White never receives a hint. A hint that contains/reveals the secret answer is rejected by custom-pack validation.
- **TEST-IMP-049:** Discussion timer defaults to disabled with 180 seconds configured, accepts only 15–600 seconds at 15-second increments, and never times the reveal/voting/result phases. Expiry advances to voting when enabled, otherwise results.
- **TEST-IMP-050:** Voting is enabled by default; each player can submit exactly the ordinary Mystic count in unique valid targets or skip once; self-voting is allowed; duplicate, invalid, out-of-turn, or repeated submissions are rejected. Mr. White is excluded from the required target count.
- **TEST-IMP-051:** Mr. White's final-guess eligibility is evaluated only after all ballots and uses `ceil(total submitted target selections / 2)` received selections. Guess comparison trims, lowercases, collapses whitespace, then compares exactly (not fuzzy).
- **TEST-IMP-052:** Results expose secret word, category, roles, vote tally, Mystic hints, and guess outcome; hidden-voter mode omits voter identities but retains aggregate counts.
- **TEST-IMP-053:** Category is selected uniformly from eligible selected categories before selecting a word inside it; the persisted category label matches the chosen word's bank.
- **TEST-IMP-054:** Manual pack import/export supports JSON and TXT, name/emoji/description, multiple words, and 1–20 non-empty distinct hints per word; malformed/duplicate/answer-revealing entries are rejected.
- **TEST-IMP-055:** The rolling last-10 word exclusion applies globally across categories after trim/lowercase/whitespace normalization and cannot be bypassed by alternate stable IDs with canonical duplicate text. Exhaustion remains explicit; reset is user-confirmed.
- **TEST-IMP-056:** Catalogue audit verifies all 30 general category definitions plus the 18+ category are retained as metadata-only packs with stable IDs, titles and descriptions; no Imposter words/hints appear in bundled seed content. Generation-contract tests verify category metadata is sent through provider order and each generated word has exactly 20 distinct answer-safe hints.
- **TEST-IMP-057:** The app contains no Imposter online room, relay, host, chat/voice, matchmaking, remote role delivery, online voting, or reconnection prerequisite.

The current automated domain test files cover the report-defined source behavior in TEST-IMP-046 through TEST-IMP-056. `TEST-IMP-058` adds the 1 MiB import-file guard. Provider/network/browser/device acceptance remains open. TEST-IMP-015 and the undefined resolution portions of TEST-IMP-014 remain blocked because the report does not define those rules, not because the reference report is missing.

### Phase 4 current-source follow-up tests

- **TEST-GUESS-028:** tilt hysteresis requires a neutral return before each action; the active orientation listener reads the latest scoring callback without re-registering on each timer/card render. Deterministic state logic is covered in `guessup-tilt.test.ts`; listener lifecycle remains browser acceptance.
- **TEST-GUESS-029:** the user can disable tilt after granting sensor permission, and touch Correct/Pass remains usable. Browser/manual acceptance.
- **TEST-PLAY-015:** prompt reports are validated, capped at 50 within an active game, and retained in completed local history (`types.test.ts`).
- **TEST-PLAY-016:** an active session uses its saved roster snapshot rather than later changes to the global player list (`types.test.ts`).
- **TEST-PLAY-017:** window blur/document visibility loss conceals Imposter role information; an accessible tap-to-show/hide control is available. Browser/manual privacy acceptance.
- **TEST-PLAY-018:** the visual wheel is hidden from assistive technology while an equivalent screen-reader roster and polite selection caption remain available. Browser/manual acceptance.

**Historical compatibility-harness result (pre-Phase-5 follow-up):** 144 tests passed / 0 failed in the Node 22/TypeScript compatibility harness; React-only `PlayerWheel.test.ts` and Elysia `routes.test.ts` were excluded because their dependencies were unavailable. This was superseded by the user's later Bun 1.4.4 run of 161 tests on the Phase 5 screenshot-fix archive. Neither historical result covers the new Phase 6 release-contract tests and budget/audit gates.

### GuessUp

- **TEST-GUESS-001:** teams and round settings validate before play.
- **TEST-GUESS-002:** deck shuffle contains all eligible items without duplicates before cycle exhaustion.
- **TEST-GUESS-003:** Correct advances exactly once and increments score exactly once.
- **TEST-GUESS-004:** Pass advances exactly once and follows configured scoring.
- **TEST-GUESS-005:** timer expiration commits one round-complete transition; reload reconciles remaining time.
- **TEST-GUESS-006:** button-only play completes a full game.
- **TEST-GUESS-007:** tilt permission requested only after explicit user gesture on a supported browser.
- **TEST-GUESS-008:** sensor denied/unsupported/unavailable does not block play.
- **TEST-GUESS-009:** duplicate/late sensor events do not cause duplicate score changes.

### Truth or Dare

- **TEST-TD-001:** player selector rejects an empty roster.
- **TEST-TD-002:** random player selection is committed before wheel animation starts.
- **TEST-TD-003:** wheel's final position maps to the stored selected player, including variable list size and long names.
- **TEST-TD-004:** reload during animation resumes to the same selected player.
- **TEST-TD-005:** truth/dare request returns a matching prompt category and suitability.
- **TEST-TD-006:** skip/replace/opt-out paths do not corrupt round state.
- **TEST-TD-007:** reduced-motion mode communicates the selected player without requiring wheel animation.
- **TEST-TD-008:** small roster, large roster, duplicate display names, and non-Latin names render distinctly.
- **TEST-TD-009:** no-repeat player behavior and exhausted-pool relaxation follow policy.

### I Have Never

- **TEST-NHIE-001:** a selected pack returns a prompt with matching locale/category/suitability.
- **TEST-NHIE-002:** skip advances to exactly one new prompt.
- **TEST-NHIE-003:** prompt cycle avoids repeats until the deck cycle is exhausted.
- **TEST-NHIE-004:** reload restores current prompt and response progress.
- **TEST-NHIE-005:** response method can change only at allowed phase boundaries.
- **TEST-NHIE-006:** neutral response convention is default and drinking is never required.
- **TEST-NHIE-007:** custom prompt pack validation prevents invalid IDs, oversized text, and duplicates.
- **TEST-NHIE-008:** user can delete custom prompt content and local history.

## 5. AI provider, Elysia API, and queue tests

- **TEST-AI-001:** provider model/endpoint verification records current official docs, account access, authentication, structured-output support, billing/quotas, and parameter bounds; stale/unknown model is blocked.
- **TEST-AI-002:** Elysia rejects malformed JSON, missing fields, unknown tasks/game-item pairs, unknown providers, unsupported locales, invalid category IDs, and oversized requests.
- **TEST-AI-003:** invalid origin/method/content type receives controlled rejection; exact CORS allowlist is enforced and CORS is not treated as authentication.
- **TEST-AI-004:** edge/IP rate limits, body/output limits, concurrency limits, deadlines, and provider budgets prevent uncontrolled spend.
- **TEST-AI-005:** timeouts, network failures, and transient 5xx use bounded retry/cooldown; 401/403/429/policy/validation errors do not enter infinite retry.
- **TEST-AI-006:** circuit breaker stops repeated calls after threshold and recovers after configured cooldown; kill switch prevents further Cloudflare AI spend.
- **TEST-AI-007:** Cloudflare Workers AI adapter uses server-side Account ID/token/model and validates the actual REST response shape; no secret is returned.
- **TEST-AI-008:** Gemini adapter uses a current official key-auth/request schema and validates its returned structured content.
- **TEST-AI-009:** Groq adapter uses the current official API endpoint/schema and validates its returned structured content.
- **TEST-AI-010:** every provider output is validated against runtime schema, count, lengths, locale, category, item kind, and suitability.
- **TEST-AI-011:** prompt injection, HTML/script, discriminatory, coercive, unsafe, and personally identifying outputs are rejected or neutralized.
- **TEST-AI-012:** BYOK consent explains that the key passes through the public King-Fun Elysia API and then to the chosen provider.
- **TEST-AI-013:** BYOK headers are redacted at Elysia, host, reverse-proxy, tracing, and exception boundaries; key does not appear in storage, backups, service worker, analytics, logs, or test output.
- **TEST-AI-014:** all-provider failure uses the relevant curated local queue; offline mode never blocks game play.
- **TEST-AI-015:** Gemini/Groq are disabled by default; their toggles are disabled without keys; key dialog opens from settings icon; saving a key unlocks but does not enable the provider.
- **TEST-AI-016:** Gemini/Groq rows can be drag-reordered; keyboard move buttons produce the same order; focus remains stable and screen reader receives the new priority.
- **TEST-AI-017:** Cloudflare Workers AI is pinned as the final row, always active, and has no toggle or settings icon.
- **TEST-AI-018:** provider order/enabled preferences persist; BYOK keys are memory-only and clear on reload, tab close, and explicit removal.
- **TEST-AI-019:** each generation call uses the enabled provider order captured at round start; changed settings apply to the next round.
- **TEST-AI-020:** a provider failure emits a safe snackbar with provider name/reason/next provider; raw response, prompt, key, and stack trace are absent.
- **TEST-AI-021:** invalid/revoked key maps to `AUTH_INVALID`, marks the provider `Needs attention`, and does not retry indefinitely.
- **TEST-AI-022:** each provider is attempted at most once per generation request; cancellation stops the chain and no duplicate snackbar is emitted.
- **TEST-AI-023:** Cloudflare GPT-OSS uses the documented `/ai/v1/chat/completions` endpoint, low reasoning effort, schema-constrained prompt, and validates `choices[0].message.content`.
- **TEST-AI-024:** Cloudflare native REST envelopes with an already-parsed `{ result: { response: { items } } }` object are accepted and validated rather than reported as empty text.
- **TEST-AI-025:** Gemini/Groq/Cloudflare empty or truncated responses return provider-specific safe diagnostics; output-limit failures recommend a smaller batch rather than a generic empty-response error.
- **TEST-AI-026:** Cloudflare compatible `{ result: { choices } }` response envelopes are normalized and schema-validated.
- **TEST-AI-027:** GPT-OSS Responses-style `output_text` and `output[].content[].text` payloads are extracted and schema-validated for compatibility during endpoint migration.
- **TEST-AI-028:** Cloudflare empty assistant content and explicit refusal map to safe actionable errors without exposing raw provider payloads.

### Elysia backend security/contract tests

- **TEST-BACKEND-001:** `GET /healthz` and `GET /v1/status` expose no secrets, account identifiers, model configuration, or environment values.
- **TEST-BACKEND-002:** `POST /v1/content/generate` accepts only allowlisted provider/game/item-kind pairs and never accepts arbitrary URLs, model IDs, system prompts, or token budgets.
- **TEST-BACKEND-003:** malformed/repeated/oversized requests receive typed safe error responses with bounded processing time.
- **TEST-BACKEND-004:** key and prompt redaction is verified by spying on every logger/error/tracing hook.
- **TEST-BACKEND-005:** Cloudflare credentials are read only from server environment secrets and absent from the browser bundle/source maps.
- **TEST-BACKEND-006:** multi-instance rate-limiting uses edge/shared enforcement; a process-local memory map is not treated as the production global limit.
- **TEST-BACKEND-007:** global spend cap and emergency kill switch stop Cloudflare requests when disabled/exhausted.
- **TEST-BACKEND-008:** no game state/player roster/history is persisted by the backend; no conventional DBMS is added.

### Queue tests

- **TEST-QUEUE-001:** adaptive player window produces 0, 1, 2, 2, 3, 3, 4, and 4 for player counts 3–10 and clamps to eligible player count.
- **TEST-QUEUE-002:** category window returns 0 for k<2, 1 for k=2/3, then `max(1, round(k / 2 - 1))` for k>=4; examples 4→1, 5→2, 6→2, 7→3, 8→3.
- **TEST-QUEUE-003:** player/category queues are isolated per game; selection in one game does not alter another game's history.
- **TEST-QUEUE-004:** content queues are isolated by game/category/item-kind/locale; Truth never shares a queue with Dare, and no game shares a queue with another game.
- **TEST-QUEUE-005:** content capacities are Imposter 10, GuessUp 20, Truth 20, Dare 20, and I Have Never 20; queue size and FIFO eviction are correct.
- **TEST-QUEUE-006:** each round's seen set prevents repeats even after an item leaves the rolling recent queue.
- **TEST-QUEUE-007:** LLM request includes only its current game/category/item-kind/locale queue plus required Imposter last-10 exclusions; player names, roles, votes, secrets, and unrelated queues are absent.
- **TEST-QUEUE-008:** request asks for five items; model-returned IDs are ignored; server/client assigns stable IDs/fingerprints.
- **TEST-QUEUE-009:** exact canonical duplicates and configured obvious near-duplicates are rejected; rejected items do not advance queues.
- **TEST-QUEUE-010:** duplicate-only, too-short, invalid-schema, unsafe, wrong-category, and wrong-locale provider output falls through to the next provider.
- **TEST-QUEUE-011:** if curated/remote content is exhausted, the game shows an explicit exhausted state and never silently wraps/repeats.
- **TEST-QUEUE-012:** category queue updates only when a category is committed to content, not when the category browser is opened.


- **TEST-QUEUE-013:** production player-selection entry points calculate the adaptive window from the current eligible player count; no code path silently retains the legacy default of three.
- **TEST-QUEUE-014:** each content category owns an independent recent-item FIFO within each game; selecting/serving a category in one game does not modify the same-named category in another game.
- **TEST-QUEUE-015:** an LLM generation request includes only the recent items from its exact `(gameId, categoryId, itemKind, locale)` queue, including the correct cap and stable IDs/text needed for comparison.
- **TEST-QUEUE-016:** rejected provider output, a provider fallback, a retry, or a cancelled request does not append unshown items to the recent queue. Only content actually committed for play advances the queue.
- **TEST-QUEUE-017:** category selection FIFO capacity follows the adaptive formula and is updated only when a category is committed to a played/generated item.

## 6. Release, security, and performance tests

- **TEST-REL-001 — Accessibility:** source-level release contracts verify document language/viewport, skip link/main landmark, screen-change focus, focus-visible/forced-colour behavior, focus scroll margin, 44px enhanced target design token, reduced-motion modes, native dialogs and live regions. Manual keyboard-only, NVDA/VoiceOver, focus visibility, contrast, target sizing, 200%/400% zoom and 320px reflow tests must be completed on the whole app; attach browser/AT versions and evidence.
- **TEST-REL-002 — Performance:** `scripts/check-build-budget.mjs` measures gzip of actual entry JS/CSS and four independently lazy game chunks, verifies all game chunks are in the offline precache manifest, rejects source maps and scans emitted assets for common provider/operator secret patterns. Provisional limits: 150 KiB initial JS, 20 KiB initial CSS, 170 KiB combined initial transfer, and 12 KiB per game chunk. Manual cold/warm device profiling, LCP/INP/CLS, long tasks, interactions, memory and animation traces remain required.
- **TEST-REL-003 — Security/privacy:** static contracts verify CSP and response headers, root audit/workflow wiring, Elysia dependency floor, frontend secret boundaries, BYOK module-memory storage, no generated HTML injection, and service-worker API cache exclusion. The root pipeline runs `bun audit --audit-level=moderate`. Manual/operator checks must review audit output/skipped packages, dependency licenses/deprecation, exact production CORS/CSP, vendor spend controls, key/log redaction, and deployed abuse controls.
- **TEST-REL-004 — Release/recovery:** automated IndexedDB, migration, revision, service-worker and precache contracts remain part of the existing suite. Manual rehearsal must cover clean PWA install, first-cache offline start, offline loading of all lazy game chunks, SW update, rollback, supported data migrations, quota/transaction failure, backup restore, multi-tab conflict and release notes.

**Phase 6 source tests added:** `scripts/release-contracts.test.ts` covers deployment CSP/cache headers, Elysia floor, accessibility source contracts, no client secret/HTML injection, and build budget/secret scan wiring. `backend/tests/routes.test.ts` additionally asserts JSON API security headers. These automated tests do not replace the manual checks listed above.

## 7. Example Bun test patterns

The actual implementation should adapt these patterns to the project's test runner version and runtime. They are illustrative, not a substitute for the production random module.

```ts
import { describe, expect, test } from "bun:test";

function createSequenceRng(values: number[]) {
  let index = 0;
  return {
    nextUint32() {
      if (index >= values.length) throw new Error("test RNG sequence exhausted");
      return values[index++] >>> 0;
    },
  };
}

describe("bounded integer selection", () => {
  test("returns values in range", () => {
    const rng = createSequenceRng([0, 1, 2, 3, 4, 5]);
    // Inject the RNG into the pure bounded-integer implementation.
    for (let i = 0; i < 6; i++) {
      const result = getRandomIntFromSource(5, rng);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(5);
    }
  });
});

describe("game state", () => {
  test("restores the committed outcome instead of reselecting", () => {
    const snapshot = makeTruthOrDareSnapshot({ selectedPlayerId: "player-2" });
    const restored = restoreSnapshot(snapshot);
    expect(restored.selectedPlayerId).toBe("player-2");
  });
});
```

## 8. Bun command conventions

Only use commands supported by the selected Bun version. The following are project-level conventions; scripts must exist before they are invoked:

```sh
bun install
bun test
bun run typecheck
bun run lint
bun run build
bun run test:coverage
bun run worker:dev
```

Use `bun add -d <package>` to add a verified test/build tool. Use `bunx <tool>` only after verifying that the tool runs under Bun and pinning it where possible. Do not use `npm`, `npx`, `pnpm`, `yarn`, or `node` commands.


## Phase 2 implementation test additions

- **TEST-STOR-006A:** schema-v1 snapshots migrate to schema v2 while retaining the source revision and fallback defaults.
- **TEST-STOR-007A:** malformed, negative-revision, and future-version records are rejected rather than overwritten.
- **TEST-STOR-010A:** stale revision conflicts are represented as explicit typed errors.
- **TEST-STOR-011A:** the browser integration must confirm BroadcastChannel notification and compare-and-swap rejection across two tabs.
- **TEST-OFF-001A:** service worker caches the app shell and same-origin hashed assets after a successful online visit.
- **TEST-OFF-002A:** offline navigation falls back to the cached app shell.
- **TEST-OFF-003A:** `/api` and `/api/*` requests and all non-GET requests are never cached.
- **TEST-OFF-004A:** activation removes only older King-Fun cache namespaces and preserves unrelated origin caches.
- **TEST-OFF-005A:** offline game startup continues to use bundled content without invoking AI providers.

**Current executable additions:** `portal-storage.test.ts` covers TEST-STOR-003, TEST-STOR-006A, TEST-STOR-007A, and TEST-STOR-010A. IndexedDB transaction behavior and service-worker lifecycle remain browser verification items; they are not represented as passing unit tests.

## Phase 2.1 manual interaction coverage

- [ ] Launch each game from its home tile and confirm the splash originates at that tile's icon.
- [ ] Confirm setup opens after the splash and that each game uses its own accent color.
- [ ] On Imposter, verify the role is not visible before press-and-hold.
- [ ] Hold the role card and verify the 3D flip reveals the correct civilian word or Mystic role.
- [ ] Release, cancel, or move off the card and verify the secret conceals again.
- [ ] Verify keyboard Space/Enter reveal and conceal behavior.
- [ ] Verify reduced-motion preference disables long transitions.


## Phase 2.2 manual UI verification
- Confirm `App.tsx` is only the home-page component and `AppShell.tsx` is the shell/controller.
- Start and complete one round of each separately extracted game.
- Confirm Imposter's hold-to-reveal card still hides on release, cancellation, and keyboard key-up.
- Test next/previous, volume, track-end behavior, and responsive layout on mobile and desktop.


### Home hero motion
- Confirm the hero illustration renders four game tokens and a central die without external API requests.
- Confirm the hero stacks at mobile widths and does not overflow horizontally.
- Confirm `prefers-reduced-motion: reduce` disables decorative motion.


## Phase 3 UI verification cases (manual/browser pending)
- [ ] `TEST-UI-001`: Verify header, hero, and game grid at 320px, 360px, 390px, 768px, 1024px, and 1440px widths without horizontal overflow.
- [ ] `TEST-UI-002`: Verify game cards are reachable and activatable using Tab, Enter, and Space with visible focus.
- [ ] `TEST-UI-003`: Verify skip-to-content link appears on keyboard focus and moves focus to the content region.
- [ ] `TEST-UI-004`: Verify toast messages are announced once by a screen reader.
- [ ] `TEST-UI-005`: Verify inputs and controls remain usable at 200% zoom and touch targets remain practical.
- [ ] `TEST-UI-006`: Verify light and dark themes preserve text/control contrast.
- [ ] `TEST-UI-007`: Verify reduced-motion preference disables non-essential animation.
- [ ] `TEST-UI-008`: Verify portrait/landscape, mobile browser chrome, and safe-area insets.


## Phase 3.1 shared component tests

- **TEST-UI-009:** `progressPercent` clamps values to 0–100 and safely handles non-finite inputs and invalid maxima.
- **TEST-UI-010:** `formatDuration` formats zero, sub-minute, minute-boundary, multi-minute, and negative values consistently.
- **TEST-UI-011:** Confirm dialog opens modally, exposes its labelled title/description, closes on Escape/cancel, and restores focus to the invoking control.
- **TEST-UI-012:** Destructive confirmation actions cannot execute until explicit confirmation; cancel and Escape leave stored data unchanged.
- **TEST-UI-013:** Shared status, empty, prompt, choice, timer, and progress components expose the expected semantic roles and labels.

**Execution note:** `ui-utils.test.ts` has been added for TEST-UI-009 and TEST-UI-010. The Bun test runner was unavailable in the authoring environment, so these tests are added but not claimed as executed. TEST-UI-011 through TEST-UI-013 require browser/assistive-technology verification.

### Phase 4.0 — Mystery Who report-based local domain tests

- **TEST-IMP-026:** role allocation matches the Mystic-count bands at 3, 5, 6, 10, 11, 15, 16, and 20 players.
- **TEST-IMP-027:** round creation rejects invalid player counts, duplicate player IDs, malformed reveal orders, and blank words.
- **TEST-IMP-028:** sequential private voting permits one final vote or skip per player, including self-voting; out-of-turn, duplicate, and invalid-target votes are rejected.
- **TEST-IMP-029:** vote tally distinguishes a unique leader, a tie, and an all-skip/no-vote round.
- **TEST-IMP-030:** Imposter word selection excludes the last ten stable IDs, rejects duplicate content IDs/invalid random indexes, and reports exhaustion without fallback repeats.

`src/domain/games/imposter.test.ts` contains executable report-derived domain cases for modes, roles, hints, timers, ballots, Mr. White, category selection, and word history. `src/domain/games/imposter-pack.test.ts` covers pack parsing/validation. Bun execution and browser/device acceptance must be recorded separately; the full report is now available, but the report itself leaves several special mechanics undefined.


### Phase 4.1 — Imposter reveal/voting regression cases

- **TEST-IMP-031:** On desktop and mobile, the role card face fills the complete control (no inline-span shrink-to-content); card back and front remain the same dimensions.
- **TEST-IMP-032:** The card starts concealed; pointer/touch hold flips to the assigned role; pointer release/cancel/lost capture/blur flips it back.
- **TEST-IMP-033:** The handoff button stays disabled until the current player has viewed their role; every subsequent player begins with a concealed card.
- **TEST-IMP-034:** Keyboard Space/Enter reveals only while held and conceals on key-up/blur.
- **TEST-IMP-035:** Voting progress equals committed votes plus skips; incomplete, malformed, duplicate, unknown-player, and invalid-target vote collections cannot resolve.
- **TEST-IMP-036:** A complete vote round produces exactly one of unique leader, tie, or no-vote outcomes.

`imposter.test.ts` contains unit tests for the domain portions of TEST-IMP-035/036. Browser interaction checks TEST-IMP-031–034 still require execution on desktop and touch devices.


### Phase 4.1 — additional game-slice tests

- **TEST-GUESS-010:** GuessUp round creation rejects fewer than two players, an empty deck, blank names, and duplicate player names.
- **TEST-GUESS-011:** GuessUp splits players alternately into two non-empty teams and starts Team A with a 60-second round.
- **TEST-GUESS-012:** Correct increments the current team's score and global correct count; Pass advances the card and increments the pass count only.
- **TEST-GUESS-013:** Team A handoff enters a non-running team-break state; Team B starts with a fresh 60-second timer; Team B completion ends the round.
- **TEST-GUESS-014:** Each timer tick decrements exactly one second; expiry transitions Team A to team-break and Team B to complete without auto-starting another team.
- **TEST-TD-018:** Opting out returns to player selection, increments the opt-out counter, and does not impose a penalty.
- **TEST-NHIE-017:** Skipping a statement advances the prompt and increments skipped count without incrementing responses.

`domain/games/guessup.test.ts` contains the GuessUp domain tests. They are added but not executed with Bun in this environment. The Truth or Dare and I Have Never controls require browser interaction checks.


### Phase 4.2 domain regression coverage added

- **TEST-CONTENT-006:** canonical duplicate IDs/text are removed; recent and current-round IDs are strict exclusions; exhausted pools return empty; recent FIFO updates and capacity are validated (`domain/content/selection.test.ts`).
- **TEST-GUESS-027:** explicit team IDs/names and supported duration are validated; deadlines reconcile correctly after delayed/background execution (`domain/games/guessup.test.ts`).
- **TEST-NHIE-018:** each player can record only one valid response; unknown players/types are rejected; points apply only to affirmative point-mode responses (`domain/games/never-have-i-ever.test.ts`).
- **TEST-PLAY-014:** selected wheel segment geometry lands its centre under the fixed pointer across all segments and resumes from a non-zero rotation (`components/gameplay/PlayerWheel.test.ts`).

Historical note: the user-provided full Bun run passed a previous 102-test snapshot; a later Node 22 compatibility harness passed 144 tests but excluded React-only and Elysia route tests. Both were superseded by the later user-provided 161-test Bun 1.4.4 Phase 5 run. The Phase 6 exact-archive run remains pending and must be recorded separately. Browser/device cases remain pending.

### Phase 4.1.1 regression cases

- **TEST-IMP-037:** Reject an Imposter snapshot when the voter cursor differs from the number of submitted votes plus skips.
- **TEST-IMP-038:** Invalid/missing reveal data must not expose the civilian word and must not enable phone handoff.
- **TEST-GUESS-015:** GuessUp rejects empty/duplicate player IDs and unknown card-result values.
- **TEST-GUESS-016:** GuessUp rejects scoring after the deck has been exhausted; the UI disables Correct/Pass and offers a manual team-turn end.
- **TEST-GUESS-017:** A completed GuessUp team round cannot be ended a second time.
- **TEST-CONTENT-005:** Bundled content IDs remain unique across all games, pack references resolve, and the baseline minimum content counts are met.

The new assertions are included in `imposter.test.ts`, `imposter-pack.test.ts`, `guessup.test.ts`, and `content/seed.test.ts`. For this archive, all three test files were run through a small Node compatibility harness (16 passed / 0 failed); this is not a substitute for running the Bun test runner. Content-ID verification and domain smoke checks also passed. Full Bun/project and UI cases still require the project environment.


## Phase 4.2 — video-referenced gameplay and interaction tests (implementation present; execution pending)

### Shared interaction

The following test cases describe acceptance criteria. The source changes for the shared wheel, report dialog, reactions, countdown, and responsive actions are present; they remain unchecked until the test runner/browser evidence is recorded.

- **TEST-PLAY-001:** play surfaces remain responsive with safe-area-aware primary actions at 320/360/390/427/768/1024/1440px; no clipped cards or horizontal overflow.
- **TEST-PLAY-002:** prompt/role card faces occupy the full card bounds at all supported viewports; text never overflows or collapses to inline width.
- **TEST-PLAY-003:** reduced-motion mode replaces wheel/countdown/card/handoff/result animation with immediate, understandable state feedback.
- **TEST-PLAY-004:** wheel outcome is committed/persisted before animation; all random wheel choices use Web Crypto and the final pointer/highlight maps to the selected player.
- **TEST-PLAY-005:** wheel interruption/reload resumes the same stored selection and does not re-roll.
- **TEST-PLAY-006:** countdown progresses 3–2–1 once; cancellation/exit cannot start the round twice.
- **TEST-PLAY-007:** report modal reason selection and optional text are validated; reporting never advances or scores the round.
- **TEST-PLAY-008:** reaction controls are keyboard/touch accessible and do not expose another player's private response.
- **TEST-PLAY-009:** animations use transform/opacity-first changes and do not alter layout dimensions during transitions.


- **TEST-PLAY-010:** each video-derived game flow can be completed end-to-end using only accessible touch/keyboard controls; no reference monetization or online-only feature is introduced.
- **TEST-PLAY-011:** setup pack/category selection, selected-count summaries, and primary action remain consistent when selections are added/removed/reordered.
- **TEST-PLAY-012:** prompt report submission (each supported reason) retains the current game phase and prompt; it never changes scores, response counts, wheel selection, or prompt index.
- **TEST-PLAY-013:** optional sound, original synthesized music, vibration, and sensor settings can be disabled/denied without blocking any game action.

### Imposter UX

- **TEST-IMP-039:** setup roster/category/settings editor validates additions, removals, limits, category changes, and source-verified option defaults.
- **TEST-IMP-040:** private role card displays one current player and correct progress, with all role information concealed before hold.
- **TEST-IMP-041:** pointer down flips to front; pointer up/cancel/lost capture/blur conceals; next-player remains disabled until a valid reveal was seen.
- **TEST-IMP-042:** role card uses explicit full-card geometry, no collapsed inline faces, and no clipped text at mobile/desktop viewport sizes.
- **TEST-IMP-043:** player handoff masks the previous role and does not render the next role until explicit confirmation.
- **TEST-IMP-044:** hint/timer behavior matches the report; Troll Mode has no inferred effects and remains disabled/unimplemented until specified.
- **TEST-IMP-045:** keyboard and screen-reader operation provides the same privacy/handoff state as touch operation.

### Truth or Dare UX

- **TEST-TD-010:** All together / Spin the wheel / One at a time are distinct and produce the correct mode-specific sequence.
- **TEST-TD-011:** selected pack list, content counts, categories, and active prompt remain consistent across setup and play.
- **TEST-TD-012:** selected wheel player is committed before motion and wheel lands on that player.
- **TEST-TD-013:** Truth/Dare choice requests matching item kind/category only.
- **TEST-TD-014:** replace/skip/opt-out advances once and does not add penalty or corrupt next-player state.
- **TEST-TD-015:** reactions do not leak private information or create an unrequested remote write.
- **TEST-TD-016:** report reasons include unsafe/offensive, spelling/grammar, wrong category, and not actually truth/dare.
- **TEST-TD-017:** next-player/next-prompt transition respects reduced motion and restores on reload.

### GuessUp UX

- **TEST-GUESS-018:** deck filters and selection tray reflect selected packs and item counts; removing a pack removes its eligible items.
- **TEST-GUESS-019:** editable teams support add/remove/rename/move-player and validate non-empty active teams.
- **TEST-GUESS-020:** 3-2-1 ready countdown begins one timer exactly once and cannot double-start on repeated taps.
- **TEST-GUESS-021:** prompt card is readable at arm's length; Correct/Pass controls remain visible and responsive.
- **TEST-GUESS-022:** tilt permission requires a user gesture and denial/unsupported device uses button controls without blocking play.
- **TEST-GUESS-023:** timer expiry, score feedback, team handoff, and end result each commit once and survive refresh.
- **TEST-GUESS-024:** report prompt action does not change score or card index.
- **TEST-GUESS-025:** both teams use fair comparable shuffled deck order and no card repeats within a team turn.
- **TEST-GUESS-026:** game end shows correct score/winner/tie and replay resets only round-scoped state.

### I Have Never UX

- **TEST-NHIE-009:** All together / Spin the wheel / One at a time are distinct and respect their response/turn behavior.
- **TEST-NHIE-010:** wheel mode commits spotlight player before animation and resumes the same player after reload.
- **TEST-NHIE-011:** one-at-a-time mode advances roster once per prompt/round according to the selected convention.
- **TEST-NHIE-012:** statement card supports large readable text and category label without clipping.
- **TEST-NHIE-013:** response methods are neutral; no drinking or penalty is required.
- **TEST-NHIE-014:** reaction is independent from response/skip counters.
- **TEST-NHIE-015:** skip advances exactly one statement and increments only the skip counter.
- **TEST-NHIE-016:** next prompt and player transitions respect reduced motion and persist correctly.



### Latest Phase 4 hardening cases

- **TEST-IMP-058:** custom Imposter import files are checked against a 1 MiB maximum before `File.text()` reads the contents; invalid, negative, non-finite, and over-limit sizes are rejected. Automated domain test: `imposter-pack.test.ts`.
- **TEST-GUESS-028:** the device-orientation listener is not reattached on every score/timer render; it calls the latest scoring callback via an effect-updated ref, and tilt cannot repeat until neutral re-arming. The deterministic hysteresis logic is covered by `guessup-tilt.test.ts`; listener lifecycle remains browser acceptance.
- **TEST-GUESS-029:** tilt can be explicitly disabled after permission is granted; Correct/Pass touch buttons remain available. Browser/manual acceptance.
- **TEST-PLAY-015:** local prompt reports are capped at 50 in a live session and retained in completed local history; test coverage in `types.test.ts`.
- **TEST-PLAY-016:** active round roster is snapshotted; subsequent global roster edits do not change the current game roster; test coverage in `types.test.ts`.
- **TEST-PLAY-017:** role reveal is concealed on window blur and document visibility loss; assistive-technology reveal has an explicit tap-to-show/hide alternative. Browser/manual privacy acceptance.
- **TEST-PLAY-018:** the decorative wheel is hidden from the accessibility tree while an equivalent screen-reader player list and polite outcome caption remain available. Browser/manual acceptance.

## Phase 2.4 — storage hardening and offline precache test coverage

- **TEST-STOR-012:** `normalizeSave` removes malformed/duplicate players, bounds recent queues/history, validates the active JSON payload, and normalizes theme/motion/game preferences.
- **TEST-STOR-013:** backup parser requires the King-Fun format and supported schema, validates export/snapshot timestamps, rejects oversized/duplicate custom-pack content, and returns normalized state.
- **TEST-STOR-014:** memory-only backup export serializes the current in-memory snapshot and current custom packs without reading stale IndexedDB state.
- **TEST-STOR-016 (browser/integration):** interrupt a custom-pack reconciliation transaction and verify rollback; after memory-only create/edit/delete actions, retry and verify the durable set exactly matches the current tab. Source-level validation also rejects over-limit collections before database access.
- **TEST-STOR-015 (browser):** explicit force-reset clears a corrupt snapshot and all King-Fun object stores only after user confirmation; normal reset retains revision compare-and-swap.
- **TEST-OFF-006:** worker installation validates the Vite precache manifest and caches every manifest-declared same-origin hashed asset, including lazy game chunks.
- **TEST-OFF-007:** runtime caching stays within its configured bound without evicting assets declared in the precache manifest.
- **TEST-OFF-010:** a missing King-Fun asset never resolves from another same-origin application's cache; navigation fallback also reads only the active King-Fun cache.
- **TEST-OFF-008 (browser):** after one online install, disable network and launch each of the four previously unopened lazy-loaded game screens.
- **TEST-OFF-009 (browser):** update to a new worker/cache version while offline/online and verify old King-Fun cache cleanup and unrelated cache preservation.

**Current source tests:** `types.test.ts`, `portal-storage.test.ts`, and `service-worker.test.ts` contain the automated cases above. `service-worker.test.ts` targets the current cache version v8 and covers unrelated-cache isolation plus all four KING-FUN logo assets. The service-worker integration smoke was independently executed with Node 22's VM/Cache API test doubles; Bun test execution remains pending in this environment.


## Branding and dual-wheel regression cases

- [x] Two-, four-, and eight-segment wheel geometry places every sector centre beneath the fixed top pointer.
- [x] Wheel geometry continues forward from an existing angle and validates invalid segment bounds.
- [x] Service-worker install caches the KING-FUN 192px and 512px logo assets under cache namespace v8.
- [ ] Browser integration test: player wheel -> challenge wheel -> prompt across reload and offline resume.


## KING-FUN logo and Truth/Dare dual-wheel checks — 2026-11-04

- [x] All eight Truth/Dare sectors land at the fixed top pointer from an existing rotation.
- [x] Segment index maps deterministically to the exact `truth` / `dare` prompt kind and rejects invalid indexes.
- [x] Source integration keeps the first player wheel for Spin the wheel mode, then runs the eight-sector Truth/Dare wheel and draws the selected prompt after landing.
- [x] Source integration keeps both original manual Truth and Dare handlers below the second wheel.
- [x] Service worker pre-caches transparent header marks and padded PWA app icons.
- [ ] Full UI interaction test: spin player -> spin challenge -> correct prompt appears after the second landing.
- [ ] Manual Truth and Dare buttons each continue to produce the selected prompt without starting the challenge wheel.
- [ ] Device/browser visual acceptance for logo, both wheel sizes, reduced motion and screen-reader announcements.


## Phase 5 AI gateway tests added — 2026-11-05

- `backend/tests/schema.test.ts`: accepts bounded supported requests; rejects unsupported game/kind, oversized count, malformed category/request ID and excessive recent exclusions; verifies server-side stable IDs, canonical duplicate/recent-item exclusion, malformed/empty provider output, 20-hint requirements, and strict category name/description/emoji validation with stable category slugs.
- `backend/tests/routes.test.ts`: checks liveness/status privacy, exact origin rejection, content-type rejection, malformed JSON, client Cloudflare-key rejection, and arbitrary model/URL field rejection.
- `backend/tests/providers.test.ts`: covers Gemini/Groq response parsing, strict Gemini category-metadata schema and generated slug, Cloudflare configuration guards, direct/wrapped Chat Completions, native JSON objects, Responses-style text output, truncation and safe provider error handling.
- `backend/security/body.test.ts`: tests chunked request bytes under/over ceiling, malformed UTF-8, and bounded streamed provider responses.
- `backend/security/limits.test.ts`: tests trusted Vercel/Cloudflare edge address extraction, stable keyed HMAC hashes, malformed shared store configuration, local per-address limits, idempotent release, and fail-closed production behavior without shared store.
- The exact Bun runner, Elysia route execution, mocked upstream integration, and semantic TypeScript/Oxlint/build pipeline still require lock regeneration and Bun 1.4.4. Live provider integration and cross-instance shared-store behavior require operator infrastructure and credentials.


## 2026-11-05 — TypeScript/lint regression fixes

- `backend/security/strings.test.ts`: verifies ordinary Unicode text is accepted and C0/DEL control characters are rejected by the shared validator.
- `backend/tests/schema.test.ts`: verifies control characters are rejected from recent-item exclusions at the API request boundary.
- Frontend compile regression: provider API fetch helpers use `AbortSignal | null` rather than passing `undefined` to an exact-optional `RequestInit.signal`; curated fallback narrows `category` before indexing the non-category item-kind map.
- GuessUp background music sequence uses elapsed monotonic time for note selection rather than a mutable counter in an interval closure.
- Backend content/provider credential validation calls the shared control-character helper, preserving the prior rejection boundaries while avoiding false-positive lint warnings for intentional control-character checks.
- Historical Phase 5 note: full Bun execution was pending at that checkpoint. The user later confirmed a 161-test Bun 1.4.4 run on a subsequent Phase 5 archive; the new Phase 6 checks still require an exact-archive run.



## Phase 6 release hardening tests — 2026-11-05

- `scripts/release-contracts.test.ts`: seven Bun tests cover CSP/security headers, service-worker versus immutable-asset cache lifetimes, Elysia patched dependency floor, accessible skip/main/focus/reduced-motion/native-dialog semantics, frontend BYOK/operator-secret/raw-HTML boundaries, source-map and touch-target configuration, and build-budget/secret-scan script presence.
- `backend/tests/routes.test.ts`: API responses assert `no-store`, `nosniff`, `no-referrer`, frame denial, restricted Permissions Policy, COOP and CORP.
- `scripts/check-release-contracts.mjs`: 33 deterministic source/config checks are part of the root quality pipeline.
- `scripts/check-build-budget.mjs`: after Vite build, measures gzip entry JS/CSS and each lazy game chunk; confirms all four game chunks are precached; rejects emitted source maps and source-map references; scans emitted client assets for common provider/operator secrets.
- Root `check` includes native `bun audit --audit-level=moderate`. Registry access is required; do not interpret a missing audit result as a clean audit.
- Manual assistive-technology, production performance, hosted security, license/deprecation and release/recovery rehearsal cases are tracked in `docs/phase-6-release-hardening.md`.

## 2026-11-06 — UI finish regression contracts

- `TEST-UI-ICON-001`: named SVG icon wrapper and game-ID icon mapping are used by primary navigation, game cards, and setup surfaces.
- `TEST-TD-WHEEL-001`: Truth or Dare `spin-wheel` mode renders the saved-roster player wheel before the independent Truth/Dare challenge wheel; player selection is persisted before animation.
- `TEST-THEME-LIGHT-001`: light theme defines semantic raised/surface tokens and explicit readable overrides for legacy dark surfaces, mode cards, and player wheel.
- `TEST-MOTION-REDUCE-001`: existing system/user reduced-motion contracts continue to suppress decorative animation; verify in browser with OS preference and in-app setting.

The first three tests are source-contract checks in `scripts/release-contracts.test.ts` and `scripts/check-release-contracts.mjs`. Browser-based theme, motion, and assistive-technology acceptance remains manual and is not marked passed by these source checks.

## UI system and browser regression coverage (2026-11-06)

- `frontend/src/components/ui/ui-utils.test.ts`: direct examples plus fast-check properties (500 generated cases each) for bounded progress and canonical duration formatting.
- `scripts/release-contracts.test.ts`: 12-column layout, desktop setup split/mobile collapse, switch semantics, native HTML provider drag/drop plus keyboard reorder controls, command palette, Playwright/axe test presence, and theme/focus contracts.
- `frontend/e2e/ui.spec.ts`: Playwright tests for the 27-game library, 320/360/390/620/768/1024/1440px overflow/reflow, setup player addition and invalid input, the deterministic Animals-only Imposter LLM request and private role-card press/release interaction, accessible light-theme switch, Ctrl+K command palette navigation, mode-selection and provider-order keyboard controls, and serious/critical axe scans on home, settings, and setup.
- `frontend/src/components/ui/stories/Controls.stories.tsx`: reviewable button/switch/status/progress/choice/empty-state components. Storybook configuration lives in `frontend/.storybook/`.

Commands from the repository root (Bun 1.4.4):

```powershell
bun run check
bun run install:e2e-browser
bun run test:e2e
bun run storybook
bun run build:storybook
```

Browser suites are separate from the fast unit/domain suite. Keep CI deterministic and run visual/device/manual screen-reader acceptance separately; axe does not replace human accessibility testing.

## 2026-11-06 shared wheel and reveal regression cases

- [x] Domain test covers pointer landing geometry for every sector of two-, four-, and eight-sector wheels.
- [x] Domain test asserts exactly four Truth and four Dare outcomes and validates every sector index.
- [x] Playwright test asserts the Truth/Dare challenge wheel exposes eight sectors after player selection.
- [x] Playwright test asserts Imposter role reveal begins within 350 ms of pointer down and conceals on release.
- [ ] Run the added browser tests in the Bun/Playwright environment; source assertions are not browser execution evidence.
- Added Playwright cases also cover radial label spacing/type size, viewport-bounded custom-pack dialog, responsive settings/provider rows, and separated GuessUp team labels.
- Authoring smoke checks: 54 Node release-contract checks passed; 14 touched TypeScript/TSX files parsed; App.css and design-system.css parsed with zero CSS errors; Node runtime checked all eight selection-to-pointer mappings. Headless Chromium with production CSS and representative DOM markup checked centered modal sizing, provider/settings overflow at four phone/tablet widths, and radial wheel labels in bounds at 390/1440 px. This is not app-integrated Playwright evidence. Bun tests and the actual app E2E suite remain unexecuted.

## 2026-11-06 — Frontend typecheck regression fixes

- `AppShell.tsx`: reduced-motion navigation omits Motion's optional `exit` prop rather than supplying `undefined`; covered by the strict `exactOptionalPropertyTypes` frontend build check.
- `PlayerWheel.tsx`: absent selection IDs are normalized to `null` before entering the shared `SpinWheel` contract.
- `SettingsScreen.tsx`: gateway status uses TanStack Query's `{ signal }` query context and forwards its `AbortSignal` to the fetch service; the returned status/task payload remains inferred from the service result.
- `SortableProviderRow.tsx`: rendering derives the active row from `useDndContext().active?.id`, preserving the `is-dragging` visual class without reading `useSortable().isDragging`, removing the React Compiler ref-access warning without changing sorting sensors, listeners, transforms, or keyboard operation.
- Added four Node release-contract assertions and a Bun regression test for the optional Motion prop, normalized wheel selection ID, TanStack Query signal forwarding and sortable-row render-state boundary. The Node 22 release-contract audit passed all 58 contracts. Required verification: run `bun run check` on Bun 1.4.4, then `bun run test:e2e`; the supplied run had stopped at frontend semantic typechecking, so later stages have no evidence yet.



## 2026-11-06 native provider ordering migration (supersedes the earlier dnd-kit regression note)

- `SortableProviderRow` uses a native draggable handle, row-level drop target, and explicit Move up / Move down buttons. Settings owns the active provider ID and persisted ordering. The row contains no dnd-kit hooks, listeners, attributes, transform helpers, or ref-derived drag state.
- The compact enabled control is a direct grid item with `role="switch"`, `aria-checked`, and an accessible name referencing the visible provider name and visible ON/OFF state. It must remain at least 44px high, while the provider identity remains visible at phone/tablet widths.
- The regression contract checks the native drag/drop and keyboard affordances and rejects reintroducing dnd-kit ref access in this component.

## 2026-11-06 — Latest native-run failure triage

The user's latest Bun 1.4.4 run (on the preceding 58-contract archive) reported 184 passing tests and three failing release-contract tests. Repository policy and both workspace typechecks passed. Frontend Oxlint reported two instances of the same `react(refs)` warning at `CSS.Transform.toString(sortable.transform)`; backend lint was clean. The test runner stopped before security audit and production build.

The three failure causes and source corrections are:

- **Light theme:** added explicit `.app.light .mode-card`, `:hover`, and `.is-selected` styles using the shared semantic theme tokens.
- **History icon:** switched the History nav item to the registered `history` icon; the previous `archive` icon was a valid SVG but did not match the contract's semantic icon mapping.
- **Browser overflow contract:** the Playwright test correctly measures `document.documentElement.scrollWidth`; corrected the stale static contract assertion that searched for `document.scrollWidth`.
- **Sortable warning:** replaced `CSS.Transform.toString` with equivalent direct `translate3d`/`scaleX`/`scaleY` serialization, preserving transforms and DndContext active drag feedback while removing the helper call implicated by Oxlint.

Regression coverage now checks these details. The Node release-contract audit passes 62 checks. Chromium 144 computed-style smoke passes at 390×844. These do not replace rerunning the full Bun test suite, Oxlint, semantic typechecks, dependency audit, production build, and Playwright E2E on the updated archive.


## 2026-11-06 Chromium regression remediation

- [x] Command palette modal opens first, then moves focus to the search input on the next animation frame.
- [x] Keyboard provider-order assertions use exact text to avoid matching the provider's enabled-switch label.
- [x] Home axe scan uses native visible text for brand/game button names and includes the visible `CTRL K` shortcut in the command trigger's accessible name.
- [x] Dark/light subtle text tokens are raised above WCAG AA minimum for the surfaces used by the shortcut key.
- [x] Responsive grid E2E waits for the app's asynchronous local-state bootstrap before checking columns/card bounds.
- [x] Root/workspace E2E script contract checks the root delegation and the frontend Playwright command separately.
- [ ] Rerun `bun run check` and all 13 Playwright cases on Bun 1.4.4/Chromium.


## Follow-up E2E and accessibility regression coverage — 2026-11-06

- Home cards must expose their visible game heading as the accessible name and their tagline as the accessible description.
- Brand and command-trigger accessible names retain their visible text; `CTRL K` is placed first in the command-trigger name.
- Command-palette search receives focus in the modal layout effect and after one animation-frame retry.
- Responsive-grid E2E revalidates the grid, four cards, and CSS `display:grid` after every viewport resize before measuring overflow and card bounds.
- The prior user log recorded 186/187 fast tests and 9/13 E2E tests; all reported causes have source changes, but require a fresh native run to confirm.

- Follow-up refinement: the grid test now measures the same re-resolved `.game-grid-v2` locator after each resize, asserts `display:grid`, and reads its own child card rectangles; the home test asserts the visible `Imposter` heading is the button's accessible name.

## Startup bundle budgets

The production budget check consumes `asset-dependency-manifest.json` and follows recursive static imports from `AppShell` and each dynamic startup root. It must enforce the 120 KiB gzip AppShell graph budget and the 160 KiB gzip total deferred-startup graph budget, in addition to the existing initial-transfer and per-game chunk limits. Add a regression contract whenever the Vite output graph or budget algorithm changes.


## 2026-11-06 — Regression coverage for final reported failures

- Service worker cache namespace test now checks the prefix plus version declaration; the installation integration test continues to verify the resulting `king-fun-shell-v7` cache is created and populated.
- Provider responsive E2E explicitly waits for the home route, lazy Settings list, and exactly two Gemini/Groq rows before collecting viewport metrics. It still requires both provider identities to have visible non-zero boxes and both rows to fit their own width.
- Accessibility E2E explicitly requires an enabled home primary CTA and opaque-white hero-token labels before running axe. Axe must still return no serious or critical violations on home, settings and setup.
- Release-contract tests protect the always-available primary CTA fallback, dark/light high-contrast CTA colours, opaque hero-token label colour, and provider-list readiness wait.


## Final responsive/provider and contrast regressions — 2026-11-06

- Service worker must declare the explicit cache constant `king-fun-shell-v7`; installation tests must create and populate that exact runtime cache.
- Regular provider rows must expose `.provider-name` within the identity grid area at 390, 620, 768 and 1024 CSS px; each row must fit its container and the document must not overflow.
- Pinned Cloudflare provider identity uses the same visible name element with a distinct server-side area.
- Home entrance animations must not animate opacity on screen/card text surfaces.
- Dark/light CTA colours and hero-token labels are asserted before home axe scans; no serious or critical accessibility violations are permitted on home, settings and setup.
- Run `bun run check` and `bun run test:e2e` after applying the archive; static source checks do not replace native verification.


## v7 final regression controls — 2026-11-06

- Service-worker source, unit fixture and runtime cache all require `king-fun-shell-v7`.
- Exactly one `kf-screen-enter` and one `kf-card-enter` keyframe definition may exist; both remain transform-only (no opacity fade).
- Hero-token labels must be opaque white in both their feature stylesheet and design-system override; CTA colours must remain explicit for dark and light themes.
- Settings provider priority list must contain exactly Gemini and Groq; pinned Cloudflare is a separate labelled group. At phone/tablet widths, names remain visible, rows fit, and switch targets remain at least 44px.
- These contracts complement but do not replace native Bun tests and Playwright/axe execution.
- Home-theme transitions must not tween the primary CTA foreground/background or composite the hero-token text through parent opacity/filter effects; the fixed dark/light colour pairs remain unchanged.

---

## Party Arcade expansion — added domain and content coverage (2026-11-06)

### `frontend/src/domain/games/party-arcade.test.ts`

The new test catalogue covers:
- One-vote-per-player enforcement and rejection of invalid options.
- Team and solo Tilt It scoring; pass advances without awarding points; exhausted decks cannot score.
- `$20 Challenge` over-budget rejection, deterministic first-in-bid-order tie behaviour and anti-items lot filtering without budget spend.
- Werewolf/Mafia faction victory only at terminal parity/elimination states.
- Bounded anagram scrambling and deterministic fallback; living-player cursor wraparound.
- Session creation for all 23 added selectable games using actual seeded data and game-specific player counts.
- Empty content rejection, duplicate roster rejection and invalid fuse-option rejection.

### `frontend/src/content/seed.test.ts`

Additional tests assert that every added game has a pack and seeded items, all Fake It entries have a structured true-answer hint, and all Fact or Fiction entries have structured true/false metadata. The original four-game, Mystery Who catalogue and hint safety tests remain.

### Required browser acceptance (not claimed as complete)

Add integrated Playwright/axe coverage for each game family and all phase transitions: private role reveals, hidden votes, tied ballots, timer expiry, fuse explosion, tilt permission denied/unavailable, microphone denied/unsupported, audio cleanup, auction budget edge cases, resume after reload, 320px layout and reduced-motion. Native Bun tests and semantic typechecks must be run on Bun 1.4.4; current authoring environment does not include Bun or the workspace dependencies.


### Cache/version regression

The service-worker shell cache is now `king-fun-shell-v8` because the application and lazy game-module graph changed. Source, cache tests, release-contract checks and the emitted worker must agree on v8 after a fresh production build.

## Party Arcade expansion regression coverage (2026-11-06)

- `party-arcade.test.ts` verifies legal unique ballots; hidden-faction terminal conditions; team/solo Tilt score transitions; bounded anagram shuffling; player rotation; budget-safe sealed bid settlement; all 23 added session constructors and persisted snapshot phases; and unique private deals for Fake It / Who Am I; Fake It clue/answer separation and metadata-only answers.
- `seed.test.ts` verifies each added game has valid content, Fake It category cues do not disclose their secret answers, all Fake It secret words and Fact or Fiction verdict metadata are present, and seeded packs respect the content schema.
- `ui.spec.ts` verifies the 27-card catalogue; sequential launch of all 23 added game controllers with their player-count constraints; Fake It secret reveal/question/guess path; Who Am I forehead-facing identity loop; multi-prompt Would You Rather; and the existing core navigation, setup, game, responsive and axe acceptance cases.
- `check-build-budget.mjs` measures all four original lazy game chunks and all seven lazy Party Arcade controller families with explicit gzip ceilings.
- These test sources require the pinned Bun 1.4.4 workspace and Chromium Playwright dependencies; authoring-container smoke checks are documented separately in `verification.md`.


## 2026-11-07 — Lint/type/E2E regression coverage

- Add release-contract assertions for shared cached clocks, turn-keyed transient UI state, stable memo inputs, exact optional content metadata, typed Tilt It score transitions, prompt result typing and corrected browser-test selectors/synchronization.
- Update the 23-controller Playwright smoke loop to wait for each committed player roster change and allow five minutes for all controller launches.
- Update Would You Rather E2E to read its actual `VOTE n OF m` counter and interact with the actual `.party-option` controls. The UI has no `.party-choice-grid` wrapper for this game and the default roster has three players, not four.
- Native execution of Bun tests and Playwright remains pending in this environment; the code and contract sources are updated, but passing post-fix browser execution is not claimed.

- Added static regression contracts for Hot Bomb draft isolation between holders and Werewolf/Mafia ballot isolation across repeated night/day cycles.


## 2026-11-07 — Reverse Singing microphone policy regression

- Vercel's document Permissions Policy must allow `microphone=(self)` so Reverse Singing can request microphone access after an explicit user action. Camera and geolocation remain disabled.
- `scripts/check-release-contracts.mjs` and `scripts/release-contracts.test.ts` assert the same-origin microphone allowance and preserve the unrelated-permission restrictions.
- A green source audit confirms configuration consistency; real-browser permission prompt/denial and device recording cleanup remain part of manual acceptance.


## 2026-11-07 — Visual refresh and ambient 3D regression coverage

- `scripts/check-release-contracts.mjs` and `scripts/release-contracts.test.ts` assert projected 3D geometry, pointer movement/down handling, visibility suspension, capped animation cadence, accessible controls, and reduced-motion fallback.
- `frontend/e2e/ui.spec.ts` verifies that the header and Settings appearance switches stay synchronized, update the active app/document theme, wait for the IndexedDB snapshot to commit before reload, and restore the saved theme, including the native `color-scheme` and browser theme-colour meta tag. It also checks that pointer input reaches the ambient renderer and that it can be paused/resumed through a named control.
- Separate reduced-motion E2E cases verify that both the operating-system preference and the saved in-app `Reduce motion` preference pause the renderer and disable the manual animation control.
- These checks are source coverage only until Bun 1.4.4 Playwright/axe execution is completed on the exact release candidate.


## 2026-11-07 — Latest lint, seeded-content and setup E2E triage

- Remove the mutable `disposed` closure flag from `AmbientBackground`; effect cleanup cancels the sole scheduled animation frame and unregisters listeners, avoiding the React Compiler immutability warning without suppressing lint.
- Scope the seeded canonical-duplicate assertion to each game's complete content pool. The previous global assertion incorrectly treated valid cross-game reuse (for example, a word in Letterburg and the Imposter word bank) as a duplicate. The duplicate detector itself remains strict within each game pool.
- Update shared seed-contract validation to compare seeded pack game IDs against the complete `GAME_IDS` registry (27 games), rather than the obsolete four-game expectation; retain the 30 Imposter category-pack assertion.
- Fix the all-games Playwright smoke loop by waiting for the delayed `.setup-workspace` transition and first persisted player chip before calling the immediate `locator.count()` snapshot. Continue to assert each add/remove mutation with retrying `toHaveCount` assertions.
- Add release-contract and Bun regression assertions for the renderer cleanup, per-game duplicate scope, full game-pack coverage, and setup-roster readiness. Native rerun evidence is required before marking these tests green.


## 2026-11-08 — Environment archive and Imposter catalogue regression coverage

- The release-contract audit verifies `.env.example` exists and is safe, but now handles an absent file as an ordinary failed contract instead of an uncaught filesystem exception.
- The Imposter browser test waits for the lazily loaded category list, confirms at least the 31 built-in categories are present, selects one category deterministically, mocks the content-generation response using the request category ID, and verifies the selected title and non-empty description are transmitted.
- The browser test does not hardcode a particular built-in category title or description, so catalogue copy changes cannot break an unrelated private role-reveal interaction test.

- The 23-game controller launch sweep asserts that every Start action shows the shared loading overlay and checks that the local rules-only Timer Impostor path does not claim an AI provider is running. I Have Never separately verifies that its first statement is prepared before gameplay opens. Only the current startup stage is announced as a live region; the event history is not re-announced on every update.

- Generation progress must not claim a vault write when the vault is disabled or during a live provider connection test; configured writes report a distinct confirmed-save or save-failed event. A failed optional cache write does not discard valid generated content.


## Android release packaging acceptance

- **TEST-ANDROID-SIGN-001:** Missing any Android keystore secret fails the release signing step before Gradle builds; no unsigned release is published.
- **TEST-ANDROID-SIGN-002:** The generated keystore is opened with the configured store password and alias; the release Gradle variant uses the configured key password/store password, while debug configuration remains unchanged.
- **TEST-ANDROID-SIGN-003:** Running the signing configurator twice is idempotent and does not duplicate the Gradle signing block.
- **TEST-ANDROID-SIGN-004:** Every published release APK passes `apksigner verify`; every published final release app AAB passes `jarsigner -verify`; each artifact certificate fingerprint matches the configured release keystore; unsigned APKs and intermediary AABs are not staged.
- **TEST-ANDROID-SIGN-005:** Rerunning an existing release tag deletes prior APK/AAB assets before upload so unsigned or incorrectly signed artifacts from an earlier run cannot remain downloadable beside the verified packages.
- **TEST-ANDROID-ICON-001:** After `tauri android init`, `tauri icon frontend/public/king-fun-logo-source.svg` refreshes `ic_launcher.png`, `ic_launcher_round.png`, and `ic_launcher_foreground.png` for mdpi, hdpi, xhdpi, xxhdpi, and xxxhdpi.
- **TEST-ANDROID-DEVICE-001:** Install the signed release APK on a physical device; confirm install succeeds, launcher/app-info icons use KING-FUN artwork, and a later release signed with the same key updates the installed package.

## Startup overlay regressions (2026-11-09)

- The shared overlay must expose `aria-label="Starting {game name}"`, `role=region`, and its busy state.
- The overlay retains up to twelve startup events, including confirmed content-vault writes, until the final handoff.
- I Have Never startup tests must select One at a time when asserting an opening statement before gameplay. Spin-wheel mode intentionally defers prompt selection until a player is selected.
- I Have Never provider generation is mocked with a deterministic, schema-shaped response; tests do not depend on a live provider.
