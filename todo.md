## 2026-11-07 — UI/UX refresh verification

- [ ] Run `bun run check` with Bun 1.4.4 against the visual-refresh source; resolve lint, TypeScript, unit, audit, build, or transfer-budget regressions.
- [ ] Run `bun run test:e2e`; verify synchronized theme controls/persistence, ambient pointer response/pause-resume, system and in-app reduced-motion behavior, and all existing game journeys.
- [ ] Manually inspect the refreshed dark and light appearances at 320, 390, 620, 768, 1024, and 1440 CSS px; test keyboard focus, touch targets, screen readers, and low-power/mobile GPU behavior.
- [ ] Validate visual contrast of the light-theme hero, game cards, header controls, and new ambient scene with integrated axe and browser-computed colours.

# Implementation Backlog


## Current patch follow-up (2026-11-06)

- [ ] Run `bun run check` with Bun 1.4.4 after the latest timer, palette, provider-row, and contrast fixes.
- [ ] Run `bun run test:e2e`; all 13 responsive, game interaction, settings, keyboard, and axe tests must pass.
- [ ] Confirm emitted gzip transfer budgets and recursive deferred-shell/startup budgets in the actual Vite build.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` complete with evidence · `[!]` blocked  
**Rule:** No item may be marked complete until its linked tests pass and evidence is recorded in `verification.md`.

## Latest release verification (2026-11-06)

- [ ] Re-run Bun 1.4.4 frozen install, root checks, unit/contracts, dependency audit and production build after the bootstrap code-split and browser fixes.
- [ ] Confirm the recursive deferred `AppShell` static-import graph is within 120 KiB gzip, the combined deferred startup graph is within 160 KiB gzip, and the initial entry remains within the unchanged 150/170 KiB gates.
- [ ] Re-run all Playwright/axe tests and verify 320px overflow, provider-label visibility, keyboard command palette, and home-card label-in-name.
- [ ] Confirm Oxlint reports zero frontend warnings after the native provider drag/drop migration and effect-owned command-palette animation-frame cleanup.

## Phase 0 — Decisions, repository, and engineering baseline

### EPIC-SETUP — Repository and toolchain

- [x] **TASK-SETUP-001 — Confirm architecture decisions.** React + Vite + TypeScript retained; Bun 1.4.4 pinned; reducer-first state; Bun native tests; request-only BYOK design through the planned public Elysia API; general-audience-only seed packs; the adaptive per-game player/category anti-repeat policy; 30-day/100-session history default; shuffled content cycles. See `requirements.md` DEC-001 through DEC-009.
  - [x] Record choices, alternatives, risks, and revisit triggers.
  - [x] Verify official docs/releases for the existing framework/build/compiler/linter and current Bun workflow.
  - [x] Complete Bun compatibility/install checks (user-confirmed).
  - [x] **Tests:** `TEST-SETUP-001`, `TEST-SETUP-002` (user-confirmed pass).
  - [x] **Verification:** `VERIFY-SETUP-001` (user-confirmed pass; details recorded in `verification.md`).
- [x] **TASK-SETUP-002 — Bootstrap Bun project.** Keep the supplied React/Vite project, add strict TypeScript defaults, exact script entry points, and the Bun version declaration without adding a second package manager.
  - [x] Add `typecheck`, `test`, `check:policy`, and aggregate `check` scripts.
  - [x] Preserve the existing `bun.lock`; no new packages were added.
  - [x] Run frozen install, typecheck, lint, tests, and production build locally (user-confirmed pass).
  - [x] **Tests:** `TEST-SETUP-003` (user-confirmed pass).
  - [x] **Verification:** `VERIFY-SETUP-002` (user-confirmed pass).
- [x] **TASK-SETUP-003 — CI quality gates.** Add a GitHub Actions workflow pinned to fixed action releases and Bun 1.4.4.
  - [x] Repository policy, lint, typecheck, Bun tests, and production build gates are configured; user confirmed the Phase 0–1 checks passed.
  - [ ] Add automated dependency advisory/license/deprecation review after selecting and verifying a Bun-compatible audit tool; do not add an unverified CLI.
  - [x] **Tests:** `TEST-SETUP-004` (user-confirmed pass).
  - [x] **Verification:** `VERIFY-SETUP-003` (user-confirmed pass).

## Phase 1 — Shared domain foundations

### EPIC-CORE — Domain contracts, RNG, and content

- [x] **TASK-CORE-001 — Define shared domain schemas.** Implement branded IDs, versioned session/snapshot/action contracts, content/pack metadata, and runtime parsers in `frontend/src/domain/shared/`.
  - [x] Define game-specific snapshot phase unions and bounded JSON state.
  - [x] Validate IDs, enums, timestamps, cross-game snapshot consistency, player uniqueness, content provenance, pack members, and action-specific fields.
  - [x] **Tests:** `TEST-CORE-001`, `TEST-CORE-002` (user-confirmed pass). `TEST-CORE-003` and `TEST-CORE-004` remain for reducers/persistence.
  - [x] **Verification:** `VERIFY-CORE-001` (user-confirmed pass).
- [x] **TASK-CORE-002 — Implement production RNG adapter.** Implement a Web Crypto 53-bit source, rejection sampling through `Number.MAX_SAFE_INTEGER`, and Fisher–Yates in `frontend/src/domain/random/`.
  - [x] Expose no caller-injected RNG on production selection APIs; keep deterministic source seams internal to the module for tests.
  - [x] Cover invalid bounds, rejection boundary, large bounds, multiset preservation, repeatability, and a broad distribution regression simulation.
  - [x] **Tests:** `TEST-RNG-001` through `TEST-RNG-005` (user-confirmed pass).
  - [x] **Verification:** `VERIFY-RNG-001` (user-confirmed pass).
- [x] **TASK-CORE-003 — Implement no-repeat selection and shuffled content cycles.** The historical fixed last-three-player exclusion has been superseded by DEC-013; the production selector now defaults to the adaptive per-game window. Deterministic source helpers retain explicit windows for tests.
  - [x] Historical behavior: exclude recent IDs only when an alternative player is eligible; reject empty/duplicate source pools instead of retrying indefinitely. This does not satisfy the new adaptive formula until migrated.
  - [x] Re-shuffle only after a deck cycle is exhausted or the available content set changes.
  - [x] **Tests:** `TEST-RNG-006` through `TEST-RNG-009` (user-confirmed pass).
  - [x] **Verification:** `VERIFY-RNG-002` (user-confirmed pass).
- [x] **TASK-CORE-004 — Create original content model and seed packs.** Add general-audience English seed packs with project-original provenance and explicit license metadata for all four game IDs.
  - [x] Include stable IDs, locale, kind, category, suitability, pack membership, creator, source, and license metadata.
  - [x] Add Unicode-aware canonicalization and duplicate detection without changing display text.
  - [x] **Tests:** `TEST-CONTENT-001` through `TEST-CONTENT-004` covered to the Phase 1 foundation scope (user-confirmed pass); custom import tests remain for the later import feature.
  - [x] **Verification:** `VERIFY-CONTENT-001` (user-confirmed pass; full human content/legal review remains a release task).

## Phase 2 — Persistence and offline-first behavior

### EPIC-STORAGE — Local state durability

- [x] **TASK-STOR-001 — Build IndexedDB repository.** Versioned IndexedDB repository and resilient persistence UX implemented; browser integration/quota tests still need execution.
  - [x] Persist app snapshots, active sessions, active rounds, bounded history, and validated custom packs in dedicated object stores.
  - [x] Store schema version, updated timestamp, and monotonic revision; commit snapshot/session/round/history in one read-write transaction.
  - [x] Integrate IndexedDB as the app's primary persistence layer; legacy localStorage snapshot is imported and removed only after successful commit.
  - [x] Keep localStorage out of routine game-state writes.
  - [x] Add bounded snapshot/state normalization, blocked-open handling, and explicit memory-only fallback/retry.
  - [ ] Execute browser tests for refresh/reopen, quota failure, and atomic transaction failure.
  - [x] **Tests added:** schema, migration, state normalization, backup parser, and service-worker contracts; browser IndexedDB behavior still needs integration verification.
  - [ ] **Verification:** `VERIFY-STOR-001`.
- [x] **TASK-STOR-002 — Add migrations and recovery.** Version-1 snapshot migration, full backup import/export, validation, and explicit corrupt-storage reset are implemented; browser recovery fixtures still need execution.
  - [x] Define schema v1 → v2 migration and reject unknown future schema versions.
  - [x] Preserve legacy localStorage source until the IndexedDB migration transaction succeeds.
  - [x] Add full snapshot/custom-pack JSON export and import with envelope/schema/ID/timestamp/aggregate-size validation, destructive confirmation, and atomic restore.
  - [x] Add memory-only backup export, storage retry that atomically reconciles the complete in-memory custom-pack set (including deletions), and explicit force-reset after confirmation for corrupt/unreadable stores.
  - [ ] Execute browser corrupted-record/quota recovery fixtures.
  - [x] **Tests added:** migration/rejection/backup tests; IndexedDB recovery browser tests remain open.
  - [ ] **Verification:** `VERIFY-STOR-002`.
- [x] **TASK-STOR-003 — Resolve multi-tab conflicts.** Revision compare-and-swap and conflict notification implemented; two-browser-tab exercise remains.
  - [x] Broadcast revision updates with `BroadcastChannel`.
  - [x] Prevent silent stale writes with revision checks inside the IndexedDB read-write transaction.
  - [x] Surface conflict state and offer an explicit reload-latest action.
  - [ ] Execute simultaneous-tab race and stale-writer tests.
  - [x] **Tests added:** stale-revision error contract; `TEST-STOR-010` and `TEST-STOR-011` require multi-tab browser verification.
  - [ ] **Verification:** `VERIFY-STOR-003`.
- [x] **TASK-OFF-001 — Add service worker and offline cache.** Vite-generated precache manifest and versioned worker now cover every hashed runtime asset, including independently lazy-loaded game chunks.
  - [x] Pre-cache production HTML, manifest, icon, and every validated same-origin hashed JS/CSS/font/image asset on install.
  - [x] Define versioned cache activation, old King-Fun namespace cleanup, and offline navigation fallback.
  - [x] Exclude API/provider requests, external origins, and all non-GET requests from caching.
  - [x] Restrict cache reads/writes to the active King-Fun cache; never read another same-origin app's entries.
  - [x] Bound additional runtime hashed assets without evicting manifest-declared precache assets.
  - [ ] Execute offline first-load/reload, deep-link, and service-worker update tests in a real browser.
  - [x] **Tests added:** service-worker lifecycle/cache-boundary contract coverage, including isolation from unrelated same-origin caches; browser offline acceptance remains pending.
  - [ ] **Verification:** `VERIFY-OFF-001`.

## Phase 3 — Shared UI and visual system

### EPIC-UI — Responsive, accessible UI foundation

**Dependency policy:** Bun-managed React UI/component, accessibility, motion, and icon libraries are allowed when maintained, licensed, React 19/Vite/Bun-compatible, accessible, and justified. See `instructions.md` §2.3 and `requirements.md` DEC-016.

- [x] **TASK-UI-001 — Build design tokens and app shell.** Shared responsive shell, design tokens, root theme synchronization, semantic landmarks, skip navigation, and screen focus management are implemented; viewport/browser validation remains.
  - [x] Define typography, spacing, surfaces, borders, focus, shadows, and motion tokens.
  - [x] Implement responsive portal navigation and game landing cards; retain four distinct game identities.
  - [x] Keep home, setup, play, history, and settings within the shared responsive shell.
  - [ ] **Tests:** `TEST-UI-001`, `TEST-UI-002` require browser/device execution.
  - [ ] **Verification:** `VERIFY-UI-001` requires the viewport matrix and keyboard exercise.
- [x] **TASK-UI-002 — Build accessible shared components.** Native modal confirmation, shared status/empty/prompt/choice/timer/progress primitives, and lazy-screen error recovery are implemented; assistive-technology verification remains.
  - [x] Add native modal confirmation dialog with Escape/backdrop dismissal and browser-managed focus containment/restoration.
  - [x] Add reusable progress bar, countdown display, choice button, prompt card, empty state, and status/error panel.
  - [x] Integrate confirmation dialogs for leaving games and destructive history/data actions.
  - [x] Integrate shared progress/timer/prompt/choice/empty/status components into game and portal screens.
  - [x] Add unit coverage for progress clamping and duration formatting (`ui-utils.test.ts`).
  - [ ] **Tests:** `TEST-UI-003` through `TEST-UI-006` require browser and screen-reader execution.
  - [ ] **Verification:** `VERIFY-A11Y-001` requires manual accessibility review.
- [x] **TASK-UI-003 — Motion and responsive behavior.** System and in-app reduced motion, dynamic viewport sizing, safe-area-aware actions, 44 px navigation controls, forced-colors focus styling, and responsive layouts are implemented; real-device profiling remains.
  - [x] Use restrained transform/opacity transitions for shared controls and preserve reduced-motion overrides.
  - [x] Respect safe-area viewport sizing and narrow-screen layouts in the existing shell.
  - [x] Keep decorative hero motion CSS-only and network-independent.
  - [ ] **Tests:** `TEST-UI-007`, `TEST-UI-008` require browser/device execution.
  - [ ] **Verification:** `VERIFY-PERF-001` requires profiling on a mid-range/low-end device.

**Phase 2 implementation status:** Source implementation complete to the scope defined above. Full Bun CI, real IndexedDB quota/migration/two-tab tests, and real-browser offline update/reload acceptance remain pending.

**Phase 3 implementation status:** Source implementation complete. Phase exit verification is not signed off until `bun run check` and the documented viewport, keyboard, screen-reader, zoom, orientation, forced-colors, and reduced-motion checks have evidence in `verification.md`.

## Phase 4 — Game vertical slices (source implementation complete for specified local rules)

### EPIC-IMP — Imposter (Mystery Who local implementation)

**Reference:** Full user report in `docs/references/mystery-who-full-report.md`; local-only extraction in `docs/mystery-who-local-reference.md`. Online multiplayer material is excluded.

- [x] **TASK-IMP-000 — Capture the local reference.** The complete user-supplied report is archived verbatim; local requirements are extracted and online play excluded.
- [x] **TASK-IMP-001 — Implement report-defined local rules and state transitions.**
  - [x] Classic / Mystics / Chaos distributions, player bands, Civilian preservation, and Civilian / Mystic / Mr. White information boundaries.
  - [x] Web Crypto role ordering, committed assignments before reveal, immediate press/key-down reveal, conceal-on-release/cancel/blur/visibility loss, accessible tap-to-reveal alternative, and gated phone handoff.
  - [x] Mystic hints on/off and same/different distribution; malformed, duplicate, excessive, and answer-revealing hints are rejected.
  - [x] Discussion-only timer (off/180s default; 15–600s, 15s steps) and optional voting.
  - [x] Sequential exact-count ballots, self-vote, skip, duplicate/invalid/out-of-turn rejection, vote-integrity checks, hidden-voter presentation, Mr. White threshold after all ballots, and normalized exact final guess.
  - [x] Results expose the source-defined word/category/roles/tallies/hints/guess outcome without inventing elimination or faction victory rules.
  - [ ] Browser refresh/resume, touch, keyboard, screen-reader, and private-handoff acceptance.
  - [!] Troll Mode effects and faction elimination/win/tie rules are not specified by the report; do not invent them.
- [~] **TASK-IMP-002 — Implement content, custom packs, and repeat protection.**
  - [x] 30 built-in categories with 60 concrete answers each (1,800 total); canonical duplicate checks pass.
  - [x] Uniform category-first selection, adaptive category cooldown, global normalized last-10 word exclusion, per-category recent-item exclusion, and explicit exhaustion/reset.
  - [x] Custom category CRUD and JSON/TXT import/export; 2–100 unique words, 1–20 distinct hints per word, metadata and answer-revealing hint validation; imports are limited to 1 MiB before file reading.
  - [~] Bundled answers currently use four shared category-safe hints per answer rather than 20 distinct word-specific hints. Curating and human-reviewing 36,000 relevant clues remains open; do not pad with generic or misleading hints.
  - [ ] Browser persistence/exhaustion acceptance.
- [x] **TASK-IMP-003 — Local persistence and offline behavior.** Preferences, committed role/word/vote state, history, word history, custom packs, and player/category queues use the IndexedDB-backed save and the offline bundled content path. Browser reload/offline acceptance remains open.
- [x] **TASK-IMP-004 — Optional AI category metadata generation.** Category suggestions use the secure Elysia/Bun provider gateway; selecting a suggestion, generating word content, and saving it as a named/emoji/description custom category pack are implemented. No browser-side provider key or direct client-to-provider request.
- [x] **TASK-IMP-005 — Setup/reveal/vote/result UX.** Source implementation includes responsive setup, private role card, accessible reveal alternative, focus/visibility concealment, private ballots, progress, and results. Manual device acceptance remains open.

### EPIC-GUESS — GuessUp

- [x] **TASK-GUESS-001 — Implement GuessUp state machine.** Two explicit teams, editable names/assignments, balancing, selected decks, 30/45/60/90/120-second duration, shuffled fair deck, 3–2–1 ready phase, deadline timer, idempotent Correct/Pass scoring, Team A/Team B handoff, completion, replay, and exhaustion are implemented with domain tests.
- [x] **TASK-GUESS-002 — Build GuessUp controls and screen.** High-legibility card, always-available Correct/Pass buttons, optional permission-gated tilt with neutral re-arm and explicit enable/disable, audio/SFX/vibration opt-ins, status feedback, team scores/rosters, report flow, and result screens are implemented.
- [ ] Verify refresh/resume, real-device timing, sensor permission/unsupported/denied/disable paths, and touch legibility in browsers.

### EPIC-TD — Truth or Dare

- [x] **TASK-TD-001 — Implement selection and prompt flow.** All together / Spin the wheel / One at a time, selected player committed before wheel animation, mode-specific progression, Truth/Dare prompt-kind selection, prompt replacement, skip, penalty-free opt-out, and explicit exhaustion are implemented.
- [x] **TASK-TD-002 — Build wheel and prompt UX.** Responsive player wheel, stored outcome/angle/deadline, reduced-motion resolution, prompt card, local reactions, bounded local reports, and persistent progress/state are implemented.
- [ ] Verify variable rosters/long names, reload during spin, reduced-motion and browser interaction in real devices.

### EPIC-NHIE — I Have Never

- [x] **TASK-NHIE-001 — Implement prompt cycle and responses.** All together / Spin the wheel / One at a time, selected/custom packs, neutral Fingers/Points/Stories conventions, one response per player in group mode, separate skip tracking, per-round progress, and persisted prompt/player/response state are implemented.
- [x] **TASK-NHIE-002 — Build I Have Never UX.** Large statement card, response controls, private group response display, reactions, local reports, next/skip, and explicit exhaustion/end states are implemented.
- [ ] Verify group response privacy, wheel restore, keyboard/screen-reader use, and full game completion on browsers/devices.

### EPIC-PLAY-UX — Shared gameplay system

- [x] Shared focused play surfaces, responsive setup cards, safe-area-aware mobile primary actions, large prompt/role content, progress and status feedback, phase focus management, reduced-motion alternatives, and persistent game actions.
- [x] Reusable player roulette commits its selection before animation, computes a correct pointer landing, and restores from persisted angle/deadline; visual wheel is hidden from AT with a separate roster list and live result caption.
- [x] Structured prompt reports cover supported issue reasons and bounded notes; reports remain on-device in game history, are capped at 50 per active game, and do not score or advance. Reactions remain local and do not reveal another player's private response.
- [x] Game roster snapshots prevent later global roster edits from changing the player list for an active round.
- [x] GuessUp tilt sensor listener stays attached across countdown/card ticks, reads the latest score callback through an effect-updated ref, requires neutral re-arming, and can be disabled without losing touch controls.
- [ ] Browser acceptance at phone/tablet/desktop sizes for focus, motion, screen reader, keyboard/touch, safe areas, no overflow, timer restore, and wheel interruption.

**Phase 4 source status:** All four game flows and all report-defined local Mystery Who mechanics are implemented in source with domain/UI regression coverage. New rounds stage content/recent-queue updates and commit complete active-game snapshots before entering reveal/play; Imposter stores a round-specific roster and uses integer-source Fisher–Yates role/hint shuffling. The user subsequently supplied a Bun 1.4.4 Phase 5 run with both workspace typechecks, 161 tests and the production frontend build passing; the following fixture-only cleanup removes its 16 lint warnings. Phase 6 adds additional release checks and requires its own exact-archive pipeline run. Phase 4 is not a release sign-off until browser/device/privacy/accessibility acceptance is recorded. The 20-word-specific-hints-per-answer curation remains open; Troll Mode and elimination/faction win/tie rules remain blocked because the report does not define them. Phase 5 AI category metadata and generated-pack persistence are implemented in source; provider deployment and release acceptance remain open.

## Phase 5 — AI providers and public Elysia backend

### EPIC-AI — Optional AI-assisted content and public API

**Source implementation completed for the defined Phase 5 gateway scope; production/release acceptance remains open.** The Elysia application now lives in root `backend/`, and the root Bun workspace owns the frontend and backend packages. The root lockfile workspace snapshots now match the root, frontend, and backend manifests, including the backend Elysia dependency. The root workspace name was corrected after the Bun 1.4.4 rename-metadata issue.

- [x] **TASK-AI-001 — Research provider integration contracts and deployment runtime.** Current official Gemini, Groq, Cloudflare Workers AI, Bun workspace, Vercel Bun Runtime, and Upstash REST/EVAL references were reviewed on 2026-11-05. Model IDs are configuration values, not UI constants. Recheck the vendor console/model catalogue, exact account quotas, billing, and model retirement immediately before enabling production traffic. Actual account-specific quota/spend verification requires operator access.
- [x] **TASK-AI-002 — Implement root Elysia + Bun API workspace.**
  - [x] Move server source from `frontend/server/` to root `backend/`; give it its own `@king-fun/backend` workspace manifest while retaining one root workspace lockfile.
  - [x] Add liveness, non-sensitive readiness, and one-provider generation routes; add root Vercel adapter at `api/[[...all]].ts`.
  - [x] Enforce strict request schema, provider/game-kind allowlists, fixed upstream URLs, exact CORS/HTTPS checks, 12 KB streamed request ceiling, 128 KB streamed provider-response ceiling, and no-store headers.
  - [x] Keep BYOK and Cloudflare credentials out of storage/logs; reject client-supplied Cloudflare secrets.
  - [x] Add Elysia route/schema/provider tests and request/response stream-boundary tests.
- [x] **TASK-AI-003 — Implement provider adapters and fallback contract.**
  - [x] Implement Gemini/Groq structured-output adapters and a Cloudflare GPT-OSS Chat Completions adapter with schema-constrained prompts plus strict server validation, server-configured models, fixed HTTPS destinations, redirect rejection, timeout bounds, normalized errors, and server-generated IDs.
  - [x] Validate exact output count, length, text encoding, canonical duplicates, near duplicates, recent exclusions, game/kind, hints and answer-token leakage.
  - [x] Add client provider fallback, cooldowns, cancellation, and non-repeating local curated fallback.
  - [x] Reject invalid/undersized provider responses rather than silently returning partial content.
- [x] **TASK-AI-004 — Implement provider settings UX and BYOK privacy.**
  - [x] Sortable Gemini/Groq rows with keyboard move actions; Cloudflare is pinned last and has no gear/toggle.
  - [x] Gemini/Groq default off; a key unlocks but does not enable the provider. Explicit consent is required before saving; the dialog explains gateway and upstream transit.
  - [x] Only provider order/enabled preferences persist; keys remain in module memory and clear on reload/tab close/removal.
  - [x] Provider connection tests, key removal, safe status/fallback messages, and saving validated generated batches as local custom packs.
- [~] **TASK-AI-005 — Implement adaptive queues and model content contracts.**
  - [x] Adaptive player/category windows, separate recent queues by game/category/kind/locale, Imposter global last-10 exclusion, and per-round no-repeat paths are implemented.
  - [x] Send only the relevant recent items and current request constraints; output validation is enforced in application code.
  - [x] Add category metadata generation and authoring UX; validate category names/descriptions/emoji, select a suggestion, generate its word batch, and persist the category metadata and category ID with the local custom pack. Category filtering/recent queues use the persisted category ID.
  - [ ] Complete the 20 distinct word-specific hints per bundled Imposter answer (36,000 clues) with human semantic review; do not use generic filler.
- [~] **TASK-AI-006 — Deploy and operate the public backend.**
  - [x] Select Vercel Bun Functions as initial deployment target; root project config and deployment runbook are present.
  - [x] Add shared Upstash-compatible Redis REST Lua controls for per-client/minute, global/day, per-provider/day, and global concurrent requests. Client IPs are HMAC-hashed consistently across instances. Production generation fails closed if the shared store is missing/unhealthy; local development uses bounded process-local counters.
  - [x] Add environment template, AI kill switch, provider request caps, model settings and server-only Cloudflare credentials.
  - [x] User verified the root lock with Bun 1.4.4 using both normal and frozen installs. Corrected the stale root workspace name metadata caused by Bun issue #47656; dependency snapshots already matched all manifests.
  - [ ] Pass clean `bun install --frozen-lockfile` and root `bun run check` in CI.
  - [ ] Configure Vercel root directory `.` and server-side secrets; deploy Preview and verify `/api/healthz` and `/api/v1/status`.
  - [ ] Configure actual provider-side billing/spending controls and alerts. Gateway request caps are not money caps.
  - [ ] Run distributed abuse/rate/concurrency, key-redaction, provider auth/timeout/quota/fallback, and kill-switch tests against deployed infrastructure using throwaway credentials.

**Phase 5 source exit:** implemented and user-confirmed working on Bun 1.4.4. The user supplied a later complete pipeline log showing policy, typechecks, 161 tests and production build passing; the follow-up removes its 16 test-fixture lint warnings, and the user then confirmed the updated project worked. Vercel deployment, provider/operator configuration, billing controls, distributed abuse tests and browser/device acceptance remain external Phase 5 release gates. Phase 6 now adds further release hardening; see `docs/phase-6-release-hardening.md`.

## Phase 6 — Release hardening

### EPIC-RELEASE — Quality, security, and release readiness

**Phase 6 status:** source-level release controls and operator procedures are implemented; manual browser/device/hosting acceptance is still in progress. See `docs/phase-6-release-hardening.md`.

- [~] **TASK-REL-001 — Accessibility audit.**
  - [x] Add automated release contracts for document metadata, skip/main landmarks, screen-change focus, visible focus/forced colors, focus scroll margin, motion preferences, native modal dialogs, live status regions and enhanced target-size design token.
  - [ ] Run full manual keyboard, screen-reader, contrast, target-size, focus-not-obscured, 320px/400% reflow and reduced-motion checks; resolve serious findings and document accepted minor findings.
  - [x] Add `TEST-REL-001` source-contract coverage.
  - [ ] **Verification:** `VERIFY-A11Y-002` (manual evidence pending).
- [~] **TASK-REL-002 — Performance audit.**
  - [x] Add post-build gzip budget and secret/source-map scan for initial JS/CSS and four lazy game chunks; assert each is precached.
  - [x] Set production Vite `sourcemap: false` explicitly.
  - [ ] Measure exact current build and cold/warm interactions on representative Android/iOS/desktop devices; profile reveal, spinner, card, timer and wheel animations before changing them.
  - [x] Add `TEST-REL-002` release-budget gate.
  - [ ] **Verification:** `VERIFY-PERF-002` (current archive build/device traces pending).
- [~] **TASK-REL-003 — Security/privacy audit.**
  - [x] Add strict CSP/security header source contracts and backend COOP/CORP/no-store response headers.
  - [x] Add `bun audit --audit-level=moderate` to `bun run check`; set Elysia dependency floor and lock snapshot to `^1.4.31` / 1.4.31.
  - [x] Verify source-level BYOK memory-only storage, client/server secret separation, no generated HTML insertion and service-worker API exclusion with automated contracts.
  - [ ] Run native advisory audit and review licenses/notices/deprecations; test production CSP/CORS, logs/key redaction, provider billing and distributed abuse controls in Preview with throwaway credentials.
  - [x] Add `TEST-REL-003` automated release-contract coverage and route-header assertions.
  - [ ] **Verification:** `VERIFY-SEC-001` (native audit and hosted checks pending).
- [~] **TASK-REL-004 — Release and recovery rehearsal.**
  - [x] Write explicit clean-install, offline-first-cache, lazy chunk, SW upgrade, rollback, migration, quota/transaction failure, backup/restore and multi-tab rehearsal steps.
  - [x] Retain automated IndexedDB/migration/revision/service-worker contract tests in the root suite.
  - [ ] Execute the release rehearsal in disposable browser profiles and archive evidence/release notes.
  - [x] Add `TEST-REL-004` manual release-rehearsal matrix.
  - [ ] **Verification:** `VERIFY-RELEASE-001` (manual rehearsal pending).

## Definition of done (all tasks)

A task is done only when its code is reviewed, linked tests pass, manual verification is recorded where required, accessibility/security implications are considered, docs are updated, and the relevant acceptance criteria in `requirements.md` are met. A generated implementation or a passing typecheck alone is not sufficient.

## Phase 2.1 — UI and interaction refinement

- [x] Replace the initial visual styling with a more deliberate, restrained design system.
- [x] Add icon-origin expanding color transition when launching a game from the home lineup.
- [x] Add a 3D press-and-hold Imposter role reveal card that conceals on release.
- [x] Support keyboard interaction and reduced-motion preferences for the new interactions.
- [ ] Run the complete Bun check pipeline.
- [ ] Verify splash timing and role-card interaction on desktop and mobile browsers.


## Phase 2.2 follow-up
- [ ] Run `bun run check` after the home/game component split.
- [ ] Verify keyboard and touch operation of all extracted game components.


- [ ] Browser-test the CSS-only home hero animation at 320px, 375px, 427px, 768px, 1024px, and desktop widths.


**Phase 4.1 status (historical implementation snapshot):** The Imposter reveal/vote slice is repaired and hardened; GuessUp has an alternating two-team round flow; Truth or Dare has an explicit opt-out; I Have Never has a separate skip counter. The subsequently supplied Mystery Who report now defines the local Imposter parity contract and is archived in `docs/references/mystery-who-full-report.md`; report-defined implementation is tracked in `EPIC-IMP` above. Full browser validation remains open.


**Phase 4.1.1 additions:**
- [x] Repair the Imposter card's collapsed inline-face layout and set stable responsive 3D face geometry.
- [x] Fail closed on malformed saved Imposter reveal/vote snapshots and mismatched vote cursor/progress.
- [x] Prevent GuessUp within-team deck wraparound repeats and reject scores after exhaustion.
- [x] Display GuessUp card position and a clear exhausted-deck state.
- [x] Expand offline seed pools for Imposter, GuessUp, Truth or Dare, and I Have Never with stable unique content IDs.
- [ ] Run Bun typecheck/tests/build and browser-test the complete phase on desktop/touch devices.
- [x] Archive and implement the supplied local Mystery Who report; its online multiplayer sections are explicitly excluded.
- [ ] Complete the 20-distinct-word-specific-hints-per-answer curation and semantic review.
- [ ] Keep Troll Mode, elimination/faction win rules, and undefined tie/no-vote victory transitions blocked until the owner supplies an authoritative specification.


## Phase 4.2 — Video-referenced gameplay UX and complete game loops (source implementation complete; acceptance pending)

Reference flows are documented in `docs/gameplay-reference.md`. Original copy, content, visuals, and synthesized audio are used. No reference art, proprietary content, monetization, or online-only feature is copied.

### Source implementation delivered

- [x] Shared responsive play surfaces, safe-area-aware primary actions, oversized prompt/role content, phase focus, progress/status feedback, and reduced-motion alternatives.
- [x] Player roulette commits the selected outcome to the active snapshot before animation, computes pointer landing geometry, persists angle/deadline, restores after reload, and resolves promptly for reduced motion. The decorative wheel is hidden from assistive technology with an equivalent screen-reader roster and live result.
- [x] GuessUp includes team setup, editable team assignment, balance action, duration presets, ready countdown, deadline timer, idempotent scoring, deck fairness/exhaustion, handoff, results, audio/SFX/vibration opt-ins, and permission-gated tilt. Tilt can be disabled; the sensor listener is stable across timer/card re-renders and touch buttons remain available.
- [x] Truth or Dare includes pack/suitability selection, all three player modes, stored roulette result, Truth/Dare selection, reactions, structured reports, replace, skip, penalty-free opt-out, and explicit exhaustion.
- [x] I Have Never includes all three player modes, selectable/custom packs, neutral response styles, private per-player group responses, points, reactions, separate skip tracking, local reports, progress, and exhaustion.
- [x] Reports are bounded to 50 per game, retain the prompt/phase and do not score/advance; report text explicitly says data stays on this device and requests no personal information.
- [x] Saved round roster is immutable with respect to later edits to the global player list.
- [x] Imposter's report-defined local loop is implemented; online mode excluded, and report-undefined rules remain unimplemented.
- [ ] Browser verification for touch/keyboard/screen reader, reduced motion, safe areas, variable rosters, reload/resume, focus, timer/sensor behavior, and narrow viewport overflow.
- [x] Historical Phase 4 test snapshots were superseded by the user-confirmed Phase 5 Bun 1.4.4 run (161 tests, both workspace typechecks and frontend build passed). Phase 6 adds more checks and requires a fresh run on the exact Phase 6 archive.
- [~] Built-in Mystery Who answer bank has 1,800 answers across 30 categories, but only four shared category-safe hints per answer. The 20 distinct word-specific hints/answer and semantic review require content authoring.
- [!] Troll Mode and elimination/faction win/tie rules are not defined in the report; do not infer them.
- [→ Phase 5] Optional AI content generation requires the approved secure Elysia/Bun provider gateway.

**Phase 4 exit status:** Source implementation is complete for the defined local gameplay requirements across all four games. External acceptance remains open for browser/device, accessibility, privacy, offline-resume, and sensor scenarios. Content authoring and report-unspecified mechanics remain explicitly blocked/out of scope. Phase 5 AI gateway remains separate.



## Branding / Truth or Dare wheel follow-up

- [ ] Run the new build on a physical mobile device and desktop browser to visually confirm logo sizing, player-wheel readability at 2–32 players, and both wheel landings.
- [ ] Confirm reduced-motion behaviour and screen-reader announcement of Truth/Dare wheel outcomes on target devices.


## Branding and Truth/Dare wheels — remaining acceptance

- [ ] Run `bun run check` on the exact updated archive.
- [ ] Test both roulette stages on small/large screens and check segment landing visually.
- [ ] Verify reduced-motion, keyboard and screen-reader flows for both wheels.
- [ ] Verify manual Truth/Dare buttons still select their matching prompt without spinning.


## Phase 5 implementation update — 2026-11-05

- [x] Added Elysia + Bun gateway source with `/healthz`, `/v1/status`, and `/v1/content/generate`.
- [x] Added provider adapters for Gemini, Groq, and Cloudflare Workers AI with server-side model configuration and normalized safe errors.
- [x] Added bounded request schema, item canonicalization/deduplication, server-generated IDs, output limits, request timeout, no-store responses, exact-origin CORS, and a per-instance rate guard.
- [x] Added session-memory BYOK settings, provider order/enabled preferences (only preferences persist), provider tests, fallback attempts, cooldowns, and local custom-pack saving for generated batches.
- [x] Added Vercel Bun/Elysia deployment config and operator deployment guide.
- [x] Confirmed the existing root lock contains matching frontend/backend snapshots and Elysia; user verified frozen installation with Bun 1.4.4. Corrected only the stale root workspace name metadata (Bun issue #47656).
- [ ] Run the pinned full Bun check after the latest TypeScript/lint source corrections.
- [ ] Configure Vercel project and operator-owned Cloudflare credentials; no credentials were supplied and no deployment was performed.
- [ ] Configure global edge rate limiting/WAF, usage alerts, and test production abuse controls.
- [ ] Verify live provider availability, account quota, pricing, and output semantics with real credentials.

**Phase 5 status:** Core source implementation is complete for the defined gateway scope and the user confirmed the Phase 5 screenshot-fix archive passed both workspace typechecks, 161 tests, and the production frontend build on Bun 1.4.4. The later fixture-only cleanup removes the 16 Oxlint warnings. Production deployment, live secrets, provider-side billing controls, hosted edge controls, and live provider integration remain operator gates. Phase 6 adds further automated and manual release checks; run the exact Phase 6 root pipeline before tagging.

## 2026-11-06 — Visual finish, theme coverage, and reusable UI

- [x] **TASK-UI-FINISH-001 — Shared named icon system.** Added `components/ui/Icon.tsx` and `GameMark.tsx`; primary navigation, game cards, setup mode selectors, pack cards, and roulette controls use named outline SVG icons rather than decorative emoji/glyphs. User-authored legacy pack emoji metadata remains available for import/export compatibility but is no longer rendered as the pack-card icon.
- [x] **TASK-UI-FINISH-002 — Truth or Dare dual-wheel contract.** `PlayerWheel` and `TruthDareWheel` are adapters over the shared `SpinWheel` presentation primitive. `spin-wheel` mode runs player selection first, then the eight-sector Truth/Dare wheel. Outcomes and angles remain owned by AppShell/domain logic and are persisted before animation; no presentation component selects outcomes.
- [x] **TASK-UI-FINISH-003 — Light-theme surface pass.** Expanded light-theme tokens and explicit overrides for hero, game cards, resume banner, setup surfaces, controls, dialogs, prompt surfaces, wheel, and status banners. Added a tactile compact theme control.
- [x] **TASK-UI-FINISH-004 — Reusable component documentation.** Added responsibility/ownership comments to the new shared icon components and updated wheel/game components. Added `docs/ui-architecture.md` defining boundaries for future modes.
- [x] **TASK-UI-FINISH-005 — Motion and wheel visual polish.** Added layered wheel rings, clearer pointer/hub hierarchy, and restrained spin-state feedback while preserving CSS animation, saved outcome, and reduced-motion behavior.
- [x] **TASK-UI-FINISH-006 — Dependency ecosystem and shadcn setup.** Installed the requested frontend UI, animation, interaction, graphics, physics, state, data, testing, and monitoring packages through the Bun workspace; initialized shadcn with the Base UI preset; restored the local `cn()` helper using `clsx` + `tailwind-merge`; and configured the `@/` alias for Vite and the app TypeScript project. Package availability is not the same as app-wide adoption: keep heavy libraries feature-scoped and lazy-loaded. MUI and Framer Motion were not added. The corrected lock and full Bun audit/check still require the native 1.4.4 rerun.
- [ ] **TASK-UI-FINISH-007 — Visual acceptance.** Test both themes across home/setup/play/history/settings/dialogs, the two Truth or Dare wheels, and 320px/400px/tablet/desktop viewports. Check keyboard focus, reduced motion, touch target, screen reader announcement, and contrast. Automated source contracts are not a substitute.
- [ ] **TASK-UI-FINISH-008 — Native pipeline.** Run `bun install --frozen-lockfile` and `bun run check` on the exact archive using Bun 1.4.4. This environment cannot run Bun.

**Scope reconciliation:** Truth or Dare's player wheel was already implemented in the Phase 4 dual-wheel work. The present task verifies and preserves that behavior rather than claiming it was newly added. The light-theme source coverage is expanded; final browser-level appearance remains unverified. Phase 6 release and manual accessibility/security/recovery gates remain open as recorded in `verification.md`.

## UI system adoption follow-up — 2026-11-06

- [x] Apply the 12-column responsive design system to shared shell, library, setup, settings, and history.
- [x] Standardize iconography through Lucide React registry and replace game action glyphs.
- [x] Establish shared toggle, button, status, progress, choice and empty-state controls.
- [x] Install the requested UI ecosystem through Bun and adopt the focused runtime boundaries: AutoAnimate, cmdk, React Hook Form/Zod, React Dropzone, TanStack Query and date-fns. Motion, Sonner and dnd-kit remain manifest dependencies but are intentionally not imported by current app source; CSS transitions, first-party toast feedback and native drag/drop are used instead.
- [x] Add fast-check properties, Storybook component stories, Playwright responsive flows and axe scans.
- [ ] Run native Bun quality pipeline and production CSS/JS budget on the delivered archive.
- [ ] Execute Playwright E2E and inspect browser screenshots at the target width/theme matrix.
- [ ] Complete manual WCAG 2.2 AA review with keyboard, screen reader, forced-colors, zoom, touch, and reduced-motion validation.
- [ ] Adopt Pixi/Three/physics/audio/vector animation libraries only as separately scoped game features; do not load them into the main application bundle.


## 2026-11-06 — Shared wheel and visual response follow-up

- [x] **UI-FIX-001 — Reusable wheel renderer.** Player and Truth/Dare adapters share `SpinWheel`; labels are radial and responsive.
- [x] **UI-FIX-002 — Eight-sector Truth/Dare wheel.** Four Truth and four Dare sectors use a shared eight-entry domain contract, secure selection and matching pointer geometry.
- [x] **UI-FIX-003 — Imposter reveal response.** Removed the delayed hold timer; reveal state begins on press, with faster flip and existing conceal-on-release/interruption controls.
- [x] **UI-FIX-004 — Visual cleanup.** Corrected GuessUp team roster markup, compacted setup text/summary, made pack instructions game-specific, and constrained provider/dialog surfaces.
- [ ] **UI-FIX-005 — Visual acceptance.** Run the new Playwright tests, inspect all four gameplay screens and dialogs in both themes, and verify radial labels, touch behavior and responsive overflow at 320–1687px.

## 2026-11-06 — Latest test and warning remediation

- [x] Fixed the three release-contract test failures from the latest user Bun 1.4.4 log (light-theme mode card, History icon, stale document scroll-width assertion).
- [x] Removed the sortable transform helper call responsible for the remaining React Compiler `refs` warning while preserving drag transforms and active-row feedback.
- [x] Extended the Node release-contract audit to 62 checks; the audit passes in the authoring environment.
- [ ] Rerun `bun run check` on the exact updated archive with Bun 1.4.4. The previous user run reported 184/187 tests passing and did not reach security audit or production build.
- [ ] Run `bun run test:e2e` and manual browser/device/assistive-technology acceptance after the native pipeline passes.


## Latest Chromium follow-up (2026-11-06)

- [ ] Confirm final zero-warning Oxlint run after changing sortable transition ownership.
- [ ] Confirm fast test suite, security audit and production transfer budget after the latest accessibility/focus fixes.
- [ ] Confirm all 13 Playwright tests and axe scans pass on desktop/mobile Chromium.
- [ ] Manual keyboard/screen-reader/forced-colors acceptance remains required even when axe is clean.


## Latest browser and lint follow-up — 2026-11-06

- [ ] Re-run the full Bun 1.4.4 quality pipeline after command focus, accessible-name, grid-resize and sortable-transition patches.
- [ ] Re-run Playwright and verify the home, settings and setup axe scans; check that the responsive grid retains four visible cards at 320–1440 px.
- [ ] Perform keyboard-only provider reorder and command-palette interaction in a real browser, then test touch, screen reader, forced-colours, 200%/400% zoom and reduced motion.

## Release follow-up verification

- [ ] Run `bun run check` on the follow-up archive and confirm initial JS gzip ≤150 KiB and JS+CSS gzip ≤170 KiB without raising budgets.
- [ ] Run `bun run test:e2e`; require all 13 tests to pass at 320px–1440px and axe to report no serious/critical violations on Home, Settings, and Setup.
- [ ] Confirm Oxlint has zero warnings, including React Compiler ref diagnostics.


## Native rerun after 2026-11-06 diagnostics remediation

- Run the complete pinned Bun 1.4.4 quality pipeline and confirm zero Oxlint warnings, semantic type errors, unit-test failures, audit findings, Vite warnings, and transfer-budget violations.
- Run all 13 Playwright tests and axe scans after the latest provider layout, keyboard shortcut, responsive overflow and game-card accessible-name changes.
- If any build-budget gate still fails, inspect a Rolldown visualizer report and split the identified remaining heavy module; do not raise the release budgets to mask transfer size.


## 2026-11-06 — Social Gamebox report integration review
- [x] Implement the documented local-play scope expansion beyond the original four games; see `docs/party-arcade-game-specs.md`. Entries with unclear/inferred rules remain deferred.
- [x] Implement described mechanics as separate playable modules; Fake It and anti-items are labelled KING-FUN variants where source details are uncertain.
- [x] Implement Timer Impostor, Hot Bomb, Hot Bomb Duel, Fake Story, Fact or Fiction, Opposites Day / Wrong Answers Only, Who's Most Likely, Would You Rather, Tilt It, Who Am I, Reverse Singing and Ten Tangle, plus other described local games.
- [x] Replace Share or Shot with pressure-free Share or Pass; no alcohol or forced disclosure.
- [x] Keep online rooms, matchmaking and chat out of scope; Imposter remains local-only.
- [ ] Keep responsive-header visual regression coverage current at 320, 360, 390, 400, 620, 768 and desktop widths.


## 2026-11-06 — Party Arcade expansion follow-up
- [ ] Run native Bun 1.4.4 tests, lint and semantic typecheck; authoring environment does not include Bun/dependencies.
- [ ] Add full integrated browser coverage for every added game flow and accessibility state.
- [ ] Verify real-device motion sensor and local microphone/audio behaviour.
- [ ] Expand Qupid and other prompt packs if a larger original content set is required; current Qupid pack intentionally contains 10 original prompts, not the reference's claimed 1,000+.
- [ ] Resolve full reference-specific Mafia/Werewolf special-role sets only with a reliable ruleset; current local implementation covers core hostile/villager play.
- [ ] Revisit anti-items only if the exact pay-to-avoid price/interaction can be verified; current KING-FUN rule filters value-2 lots without budget deduction.

- [x] Remove irrelevant prompt-pack prerequisites from mechanics-only Timer Impostor, Werewolf, Mafia and Murder setup.
- [x] Correct Fake It starter content to show a broad category cue rather than a trivia question that leaks the answer.


## 2026-11-06 — Party Arcade release gate
- [x] Implement all report-supported local games/variants as 23 additional controllers, while preserving the original four.
- [x] Add seven lazy controller families, 60 content packs and local seeded prompts/word lists.
- [x] Keep undocumented titles out of the launchable catalogue rather than invent mechanics.
- [x] Add all-controller Playwright launch coverage and domain-level session-construction tests.
- [ ] Execute Bun 1.4.4 typecheck/lint/unit/build/audit and full Playwright/axe tests in the pinned runtime.
- [ ] Complete real-device motion/audio, accessibility, background-timer and offline-resume acceptance.


## 2026-11-07 — Latest full-check triage

- [x] **TASK-QA-TRIAGE-001 — Ambient renderer lint:** remove the effect cleanup lifetime flag and rely on cancellation of the pending RAF plus listener teardown; do not suppress the React Compiler rule.
- [x] **TASK-QA-TRIAGE-002 — Seed duplicate semantics:** validate canonical uniqueness inside each game's complete selection pool rather than across unrelated game IDs; cross-game reuse remains permitted by `FR-CONTENT-005`.
- [x] **TASK-QA-TRIAGE-003 — Expanded game pack coverage:** validate the exact 27-game pack registry and retain the dedicated 30-category Imposter assertion.
- [x] **TASK-QA-TRIAGE-004 — Playwright roster readiness:** wait for the delayed setup transition and loaded roster before taking the initial player-chip count.
- [ ] **TASK-QA-TRIAGE-005 — Exact-revision native verification:** rerun `bun run check` and `bun run test:e2e` with Bun 1.4.4; only close this task after lint has zero warnings, all unit tests pass, security audit/build budgets pass, and all browser/axe tests pass.


## 2026-11-07 — Remaining exact-revision verification

- [ ] Run the pinned Bun 1.4.4 root `bun run check` against the latest ambient-renderer lifecycle patch. The previous user log stopped at frontend typecheck with a React Compiler warning and TS18049 context errors; source changes now address both.
- [ ] Run `bun run test:e2e` against the latest patch. The immediately preceding user-provided run passed all 20 tests, including accessibility scan and every-added-controller smoke test.
- [ ] Confirm the full security audit and production Vite/gzip budgets; these stages were not reached by the supplied `check` log.
