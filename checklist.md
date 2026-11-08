## 2026-11-06 — Continuation source checks

- [x] Use a numeric DOM timer ref for `window.setTimeout` in AppShell.
- [x] Store command-palette animation-frame IDs in effect refs and cancel both during cleanup.
- [x] Consolidate provider identity and compact switch into one authoritative responsive grid rule set.
- [x] Render small hero-token labels in opaque white and measure contrast in Chromium.
- [x] Re-run the 82-check release-contract audit, source syntax checks, CSS/JSON parsers, and targeted Chromium layout/contrast fixture.
- [ ] Re-run the exact Bun 1.4.4 full pipeline and integrated Playwright/axe suite before release.

# Project Acceptance and Release Checklist


## Latest native-check remediation (2026-11-06)

- [x] AppShell timeout ref uses the browser numeric timer ID type.
- [x] Command-palette RAF IDs are stored in effect refs and cleaned up.
- [x] Provider names and enabled switches occupy independent grid tracks.
- [x] Home hero token labels use an opaque high-contrast foreground.
- [ ] Re-run native Bun lint/typecheck/tests/security audit/build after these source changes.
- [ ] Re-run all 13 Playwright tests and axe scans on home, settings, and setup.

**Use:** Tick items only after verifying them against the code and evidence. Link evidence in `verification.md`.

## 0. Current implementation status (2026-11-05)

The user has confirmed that the Phase 5 corrected workspace builds and runs successfully on Bun 1.4.4. The latest user-supplied full check before the final fixture-only lint cleanup reported repository policy pass, frontend lint with zero warnings/errors, both workspace typechecks pass, 161 tests pass, and the frontend production build pass. The final archive removes the 16 unnecessary test-fixture escapes reported in that run. Phase 6 adds source-level release contracts, gzip/build-output checks, a native Bun advisory-audit gate, security response-header assertions, and a manual WCAG/performance/security/recovery rehearsal plan. Re-run `bun run check` on the exact Phase 6 archive; Phase 6 remains open until manual browser/device, advisory/license, hosted-provider and recovery evidence is recorded in `verification.md`.

The project contains four local game flows, IndexedDB/PWA infrastructure, and the Elysia gateway in the root `backend/` workspace. Do not conflate source/test completion with release sign-off. Built-in Mystery Who categories are metadata-only; their title and description are sent through provider-order generation and each generated word must have 20 distinct hints. Manually authored/imported packs remain the offline path. Troll Mode and elimination/faction win/tie mechanics remain intentionally unimplemented because the supplied report does not define them. See `todo.md` and `verification.md` for current evidence and remaining gates.

**Imposter scope:** Use the archived Mystery Who report as the local gameplay reference; ignore online mode. Its report-defined modes, role boundaries, hint behavior, timer, ballots, Mr. White threshold/guess, categories, packs, and word-history rules are represented in source. Do not invent Troll Mode or elimination/win/tie resolution rules that the report does not define.

## Latest release-gate status (2026-11-06)

The latest user-machine baseline had all 188 unit/contracts, semantic typechecks, and dependency audit passing, but one frontend lint warning, four browser E2E failures, and a failed 150/170 KiB entry gzip budget. Current source has fixes for all reported defects and separate gzip accounting for the deferred app shell. Do not mark final release gates complete until `bun run check` and `bun run test:e2e` pass on the exact current archive. Evidence is recorded in `verification.md`.

## 1. Product and scope

- [x] Four games are available from the portal: Imposter, GuessUp, Truth or Dare, and I Have Never. (`FR-PORTAL-001`)
- [x] All core mechanics use project-original implementations, branding, UI, and bundled content; final provenance/legal review remains a release activity. (`FR-CONTENT-005`)
- [x] Optional AI does not block ordinary curated/local-content gameplay; remote generation failure/offline operation preserve local content. (`FR-AI-001`)
- [x] Every game has setup, active play, end/result, restart, and safe exit states; browser walkthrough remains pending.

## 2. Bun-only toolchain and dependencies

- [x] Project setup, dependency management, scripts, CI, and CLI execution use Bun commands only. (`NFR-MAINT-002`)
- [x] One committed Bun lockfile exists; no npm/yarn/pnpm lockfiles or prohibited package-manager commands remain.
- [ ] All package/model/CLI choices (including optional React UI, motion, and icon libraries) have current maintenance, security, license, React/Bun compatibility, accessibility, and deprecation checks. (`NFR-MAINT-001`, `NFR-MAINT-005`)
- [x] CI uses a fixed supported Bun version and lockfile-frozen install mode.
- [x] No CI dependency floats on `latest`; upgrades are reviewed and lockfile changes are committed.
- [ ] Bun compatibility is proven for every CLI/tool executed by the project; any exception is explicitly approved.

## 3. Game mechanics and randomness

- [x] Imposter role/word assignment is atomic, valid, and persisted before private reveal. (`FR-IMP-002`)
- [x] Imposter pass-and-play masking prevents accidental disclosure, including blur/visibility concealment and an accessible reveal control. (`FR-IMP-003`)
- [x] Imposter is local pass-and-play only (no online multiplayer) and supports 3–20 players. (`FR-IMP-001`)
- [x] Mystic count follows 3–5:1, 6–10:2, 11–15:3, 16–20:4 bands; mode-specific assignment preserves at least one Civilian. (`FR-IMP-005`)
- [x] Mystic hints, discussion-only timer, voting, Mr. White guess and results are implemented from the supplied report. (`FR-IMP-006` through `FR-IMP-011`)
- [x] Sequential ballots support exact Mystic-count selections, Skip Vote and self-voting. (`FR-IMP-009`)
- [!] Troll Mode effects are not described in the supplied report; do not invent them. (`FR-IMP-017`)
- [x] 30 category packs, multi-category selection, custom word/hint packs and JSON/TXT import/export are implemented. (`FR-IMP-012`, `FR-IMP-013`)
- [x] Last 10 normalized word values and stable IDs are excluded across categories; exhaustion is explicit. (`FR-IMP-014`)
- [x] Dark mode and Imposter setup preferences persist in the local save; round state and word history are included in the active snapshot/save. (`FR-IMP-015`)
- [x] Classic Imposter works with manually authored/imported local packs offline; built-in metadata-only categories generate words via the configured provider-order gateway. (`FR-IMP-015`, `FR-IMP-016`)
- [x] Classic excludes Mr. White; Mystics includes exactly one; Chaos uses the documented randomized chance. (`FR-IMP-004`)
- [x] No online-only feature is required for local Imposter play.
- [x] GuessUp works with Correct/Pass buttons without device sensors. (`FR-GUESS-003`)
- [x] Tilt permission is requested only after a user gesture; users can disable tilt, and unsupported/denied sensors fall back to touch. (`FR-GUESS-004`)
- [x] Truth or Dare player is selected before animation; persisted choice equals wheel result. (`FR-TD-002`)
- [x] Truth or Dare skip/replace/opt-out are available and penalty-free in the source flow. (`FR-TD-004`)
- [x] I Have Never supports neutral response methods and has no mandatory drinking mechanic. (`FR-NHIE-002`)
- [x] Production consequential selection uses Web Crypto, rejection sampling, and Fisher–Yates; not `Math.random()`. (`FR-CONTENT-003`)
- [x] Adaptive player/category windows and isolated per-game/category/item-kind content queues are implemented and have regression coverage. (`FR-CONTENT-003` through `FR-CONTENT-008`)
- [x] Committed role/prompt/wheel/deck/timer outcomes are stored in active snapshots; browser reload verification remains pending.

## 3A. Mystery Who report implementation status

- [x] Read and use the complete supplied local gameplay report; online mode excluded.
- [x] Classic / Mystics / Chaos modes and Civilian / Mystic / Mr. White role boundaries.
- [x] Banded Mystic counts, immediate press/key-down reveal with conceal-on-release, hints, discussion-only timer, sequential ballots, self-vote, skip, Mr. White threshold/guess, and results.
- [x] 30 general built-in category packs plus the 18+ After Dark pack, all metadata-only; category-first provider-order generation, custom word/hint packs, JSON/TXT import/export, and normalized global last-10 plus per-category exclusions.
- [x] No hardcoded built-in Imposter word or hint entries are shipped; generation schema requires exactly 20 distinct answer-safe hints per generated word.
- [!] Troll Mode effects and elimination/win rules are not described in the report; do not invent them.
- [x] Historical Phase 4 source snapshot had a 111-test compatibility check; this was superseded by the user-confirmed 161-test Bun run on the pre-Phase-6 Phase 5 archive. Phase 6 adds further scripts/tests and requires a fresh root `bun run check` on the exact Phase 6 archive.

## 4. Local storage and offline behavior

- [x] IndexedDB stores resumable sessions, history, and custom packs; localStorage is limited to compact non-secret AI provider preferences and one-time legacy migration data (never BYOK keys or player/game data). (`NFR-STOR-001`)
- [x] All persisted snapshot/custom-pack records are versioned and runtime validated; supported snapshot migration and rejection tests are added. (`NFR-STOR-002`)
- [x] Storage quota/private mode/unavailable storage have truthful memory-only fallback, export, retry, and explicit recovery UI. (`NFR-STOR-003`)
- [x] Multi-tab conflicts are detected and stale compare-and-swap commits cannot silently overwrite an active session. (`NFR-STOR-004`)
- [x] Service worker caches only the versioned app shell and validated same-origin static build assets; no user data or API responses. (`NFR-OFF-001`)
- [x] Offline asset strategy includes all lazy game chunks; AI remains unavailable with an explanation while bundled/custom local content remains usable. (`NFR-OFF-002`, `NFR-OFF-003`)
- [x] User can export/import a full backup and delete history/custom packs; imported backups are validated and restored atomically.

## 5. AI providers and security (source implemented; production verification pending)

- [x] Settings exposes a reorderable Gemini/Groq list with Cloudflare Workers AI pinned as the last remote fallback. (`FR-AI-003`)
- [x] Gemini/Groq default disabled; keys are required before toggles unlock and saving a key does not auto-enable. (`FR-AI-004`)
- [x] Provider ordering supports keyboard move controls; Cloudflare has no gear or toggle. (`FR-AI-003`, `FR-AI-005`)
- [x] Provider preferences persist while BYOK secrets remain tab-memory-only and clear on reload/tab close. (`FR-AI-010`, `NFR-SEC-008`)
- [x] Key dialog requires explicit consent and discloses transit through the King-Fun gateway to the chosen provider. (`FR-AI-010`)
- [x] Root `backend/` Elysia + Bun workspace exposes liveness, readiness, and one-provider generation routes; `backend/vercel.ts` adapts `/api/*` through the Vercel backend service. (`FR-AI-009`)
- [x] Provider adapters exist for Gemini, Groq, and Cloudflare Workers AI; Cloudflare secrets are server-only and pinned last. (`FR-AI-005`)
- [x] Request schema/provider allowlists, streamed 12 KB request and 128 KB response bounds, timeouts, fixed HTTPS URLs, safe errors, canonical duplicate checks, and output constraints are implemented. (`FR-AI-007`, `FR-AI-012`)
- [x] Production exact-origin/HTTPS checks, global kill switch, shared atomic Redis-compatible per-client minute/global daily/provider daily/concurrency controls, HMAC address hashing, and fail-closed missing/unhealthy-store behavior are implemented. (`FR-AI-011`)
- [x] Local curated fallback uses secure random selection and excludes recent items; absence of eligible content is explicit. (`FR-AI-001`, `FR-AI-008`)
- [x] User verified `bun install` and `bun install --frozen-lockfile` with Bun 1.4.4 from the root; the corrected archive fixes Bun issue #47656's stale root-name metadata while preserving dependency snapshots.
- [ ] Run a clean `bun install --frozen-lockfile` and `bun run check` on the exact final source tree.
- [ ] Configure a Vercel project with repository root `.` and server-side production secrets; deploy a Preview and verify route behavior.
- [ ] Configure a healthy Upstash-compatible shared Redis REST store and test limits across distinct serverless instances.
- [ ] Configure provider-side budget/usage restrictions and alerts. Gateway request counters are not monetary spend caps.
- [ ] Use throwaway credentials to test provider authentication, quotas, failures, fallback, kill switch, log/trace redaction, and actual billing controls.
- [ ] Complete browser/device acceptance, including BYOK privacy/storage inspection and offline game behavior.

## 6. UX, responsive design, and accessibility

- [ ] Distinct visual identities exist for each game without inconsistent shared controls. (`FR-PORTAL-002`)
- [ ] Phone, tablet, desktop, landscape, and narrow viewport layouts are checked. (`FR-PORTAL-003`)
- [ ] Large text, zoom/reflow, safe areas, virtual keyboard, and browser chrome do not obscure key actions. (`NFR-UX-002`)
- [ ] Keyboard/touch access exists for every action. (`FR-PORTAL-005`)
- [ ] Visible focus, accessible names, labels, status announcements, logical focus order, and semantic controls are verified.
- [x] System and in-app reduced-motion preferences are implemented for CSS and JavaScript-driven transitions. (`NFR-A11Y-002`)
- [ ] Verify reduced-motion behavior in browser with OS preference changes and each game animation. (`NFR-A11Y-002`)
- [ ] Colour, sound, motion, and tilt are not the sole way to communicate or operate. (`NFR-A11Y-003`)
- [ ] WCAG 2.2 AA audit is complete; serious findings are resolved or formally risk-accepted. (`NFR-A11Y-001`)

## 7. Performance and quality

- [x] Each game's code is lazy-loaded behind a loading state and recoverable error boundary. (`NFR-PERF-001`)
- [ ] Production budgets are measured and documented for actual representative hardware/network conditions. (`NFR-PERF-003`)
- [ ] Animation profiles show no avoidable layout thrashing or persistent long tasks. (`NFR-PERF-002`)
- [ ] Unit, property, integration, E2E, migration, offline, and regression tests are passing.
- [ ] Dependency/security/license/deprecation scans are reviewed.
- [ ] Production build and deployment smoke tests pass.
- [ ] Backup/export and rollback/recovery procedures are exercised.

## 7A. Video-referenced gameplay experience (source implementation complete; manual acceptance pending)

- [x] Shared game shell uses focused full-screen mobile play surfaces, safe-area-aware persistent actions, grouped setup cards/sheets, stable oversized prompt/role content, phase focus and reduced-motion-aware transitions. (`FR-PLAY-001`, `FR-PLAY-009`)
- [x] Imposter private role card has complete 3D faces, per-role accent identity, hold-to-reveal, conceal-on-release/blur/visibility-loss, progress, accessible tap reveal, and explicit pass-phone action. (`FR-PLAY-007`)
- [x] Truth or Dare has pack selection, All together / Spin the wheel / One at a time modes, committed-before-spin roulette, Truth/Dare choice, prompt card, reactions, local report, and next/skip/opt-out. (`FR-PLAY-002`, `FR-PLAY-003`)
- [x] GuessUp has deck browser/filter chips, selected-pack tray, editable teams/player assignment, configurable duration/input, optional sound/vibration/music, 3-2-1 countdown, card, Correct/Pass feedback, deadline timer, handoff and result. (`FR-PLAY-004`)
- [x] I Have Never has All together / Spin the wheel / One at a time modes, statement card, neutral responses, reactions, progress, next, and separate skip. (`FR-PLAY-005`, `FR-PLAY-006`)
- [x] Wheel results are selected and persisted before animation begins. (`FR-PLAY-003`)
- [x] Reduced-motion alternatives preserve immediate selection/feedback for wheel, countdown, card flip, handoff, and result in source. (`FR-PLAY-008`)
- [x] No ads, subscriptions, premium banners, paid packs, copied reference content, or online Imposter mode are introduced.

**Manual acceptance still open:** verify viewport widths 320/360/390/427/768/1024/1440px, landscape, zoom/reflow, screen-reader announcement order, touch/key release and focus loss, device-orientation permission/disable/neutral re-arm, reduced-motion preference changes, timer/prompt resume, and wheel interruption/reload. Source completion is not equivalent to WCAG/browser release sign-off.

## 7B. Queue and duplicate avoidance

- [x] Production player selection defaults to `playerRepeatWindow(n)` with 0 for n<4 and `max(1, round(n/2 - 1))` for n>=4; the active roulette uses a separate queue per game.
- [x] Imposter category cooldown uses 0 for k<2, 1 for 2<=k<4, and `max(1, round(k/2 - 1))` for k>=4; it relaxes only when every eligible category is cooling.
- [x] Local content histories are isolated by game/category/item-kind/locale; Imposter also preserves the report's global last-10 word exclusion.
- [x] Imposter word history and GuessUp/Truth/Dare/I Have Never recent-item histories are persisted locally; game snapshots keep per-round seen-item IDs / a finite shuffled deck.
- [ ] LLM request batching and generated-output near-duplicate validation await the secure AI gateway.
- [x] Empty/exhausted candidate pools show an explicit state; no silent repeat or infinite retry occurs.
- [ ] Official Bun tests and browser-level queue acceptance remain pending.

## 8. Documentation and release

- [x] `instructions.md`, `requirements.md`, `docs/gameplay-reference.md`, `docs/mystery-who-local-reference.md`, `docs/references/mystery-who-full-report.md`, `docs/ai-provider-routing.md`, `todo.md`, `tests.md`, `verification.md`, and this checklist are reconciled for current behavior and IDs.
- [x] `changelog.md` records the delivered source/documentation changes and distinguishes automated from manual verification.
- [x] Completed Phase 4 source items link to regression cases and current verification notes; manual acceptance items remain open.
- [ ] Known limitations, account-specific costs/limits, and residual risks are disclosed.
- [ ] Release version, compatibility notes, migration notes, and rollback plan are prepared.


## 7. Phase 2 persistence and offline acceptance (source implementation complete; real-browser verification pending)

- [x] IndexedDB v2 creates all five object stores and versioned records.
- [x] App state, active session, active round, and history update atomically.
- [x] History is capped at 100 records and 30 days.
- [x] Custom packs are schema-validated and persisted with per-pack revisions.
- [x] Legacy localStorage state migrates only once; source is retained if migration fails.
- [x] Version-1 snapshot migration increments revision and preserves the current state.
- [x] Storage quota/private-mode/database errors show a warning and never claim a durable save.
- [x] Two tabs detect newer revisions and stale writes cannot overwrite the latest state.
- [x] Backup export includes the current snapshot and custom packs; import validates and atomically restores the complete backup.
- [x] User can clear history and custom packs; explicit reset also repairs a corrupt store after confirmation.
- [x] Memory-only mode can export the live in-memory save; storage retry preserves in-memory custom packs.
- [x] Vite emits a production precache manifest and the service worker pre-caches HTML plus all exact hashed lazy JS/CSS/font/image assets.
- [x] Offline startup source coverage includes all four independently lazy-loaded game chunks; actual browser reload/game launch remains a manual acceptance test.
- [x] API/provider, external-origin, and non-GET requests are excluded from Cache Storage.
- [x] Service-worker upgrade removes only obsolete King-Fun cache namespaces and preserves unrelated caches; fetch fallback reads only the active King-Fun cache.
- [x] Runtime asset caching is bounded without evicting manifest-declared offline assets.
- [x] Historical Bun 1.4.2 evidence: policy, lint (0 warnings/errors), TypeScript, 102 tests and production build passed on its 102-test snapshot.
- [x] Later Bun 1.4.4 evidence: policy, both workspace typechecks, 161 tests and frontend production build passed on the Phase 5 screenshot-fix archive.
- [ ] Run `bun run check` on the exact Phase 6 archive; its audit and post-build budget gate are new and were not included in that earlier run.

**Automated source tests added:** save normalization, backup parsing/memory export, service-worker install/precache, cache cleanup, API/non-GET exclusion, runtime cache bounds, and offline navigation. Real browser lifecycle acceptance remains pending.

## Phase 2.1 acceptance

- [x] Home game tiles use the refreshed visual system and remain responsive.
- [x] Selecting a tile starts a color splash from its icon before setup appears.
- [x] Imposter role starts hidden on the card reverse; holding flips to the secret; release flips back.
- [x] Role reveal supports pointer/touch and keyboard controls.
- [ ] Verify interaction timing, touch behavior, and reduced-motion behavior in real browsers.


## Phase 2.2 — home/game component architecture (source implementation complete; acceptance pending)
- [x] `App.tsx` contains only the home-page component.
- [x] `AppShell.tsx` owns navigation and shared application state.
- [x] Each game is implemented in its own component under `src/games`.
- [x] Setup, history, and settings are separate screen components.
- [ ] Full Bun check on the final current source and manual browser/mobile checks pass.


### Home hero animation (source implementation complete; viewport acceptance pending)
- [x] CSS-only game-token animation renders without network requests or audio permissions.
- [x] Desktop hero uses a two-column layout without overlap.
- [x] Mobile hero stacks copy and illustration without horizontal overflow.
- [x] Reduced-motion preference disables decorative animation.
- [ ] Verify the hero at the documented viewport/orientation matrix in real browsers.

## Phase 4.0 — Imposter provisional slice (historical snapshot; not the current acceptance status; see Phase 4 source-completion status above)

- [x] Domain enforces 3–20 players and the specified 1/2/3/4 Mystic-count bands.
- [x] Round creation validates unique players and a complete, unique reveal order.
- [x] Private role reveal remains concealed by default and hides on release/cancel.
- [x] Role card inner face uses a block formatting context so the 3D faces fill the full card instead of shrinking to text width.
- [x] Passing the phone is disabled until the current player has viewed their assigned role.
- [x] Voting progress is shown and vote resolution rejects incomplete/corrupted vote collections.
- [x] Voting is sequential and private; one final vote or skip is accepted per player.
- [x] Self-voting is supported; duplicate, out-of-turn, and invalid-target votes are rejected.
- [x] Results distinguish a unique leader, tie, and no-vote outcome without inventing elimination/win rules.
- [x] Imposter word selection excludes the rolling last ten stable IDs and reports exhaustion without silent repeats.
- [x] Historical Bun 1.4.2 run passed repository policy, zero-warning Oxlint, TypeScript, 102 tests and production build on the earlier 102-test snapshot.
- [x] Later Bun 1.4.4 run passed both workspace typechecks, 161 tests and frontend production build on the Phase 5 screenshot-fix archive (16 fixture-only lint warnings were subsequently removed).
- [ ] Run the complete Phase 6 pipeline, including new release-contract tests, native dependency audit and build-budget gate, on this exact archive.
- [ ] Verify refresh/resume, private handoff, keyboard/screen-reader behavior, and mobile/desktop voting in a browser.
- [x] Archive the full Mystery Who report and map its local rules to source and regression tests.
- [ ] Complete browser/device acceptance of all report-defined local phases and privacy boundaries.


## Phase 4.1 — multi-game vertical-slice improvements (historical snapshot; superseded by the current Phase 4 status above)

- [x] Imposter private reveal uses a full-size 3D card with a concealed default state and release-to-hide behavior.
- [x] Imposter handoff is gated until the player has viewed their role; vote progress and domain validation are explicit.
- [x] GuessUp deck is cryptographically shuffled at round creation; two teams are split alternately from roster order.
- [x] GuessUp persists scores, deck index, team assignment, and timer state; Team A hands off to Team B after its 60-second turn.
- [x] GuessUp timer tick/expiry logic is pure and unit-testable; expiry cannot silently begin the next team's round.
- [x] GuessUp presents a final winner/tie summary and retains manual Correct/Pass controls (no sensors required).
- [x] Truth or Dare exposes a penalty-free opt-out & pass-turn action and preserves turn/opt-out state.
- [x] I Have Never exposes an explicit Skip statement action and tracks skipped prompts separately from responses.
- [ ] Run full `bun run check` and verify timer/handoff/role reveal on desktop and touch browsers.
- [x] Implement report-defined local Mystery Who rules; online multiplayer excluded.
- [ ] Complete full Bun CI and browser/device acceptance.


## Phase 4.1.1 — gameplay hardening and bundled content (historical snapshot; superseded by the current Phase 4 status above)

- [x] Fix collapsed Imposter card geometry with block-level inner and face elements and explicit responsive sizing.
- [x] Conceal roles on pointer/key release and prevent phone handoff until the role has been viewed.
- [x] Fail closed on malformed Imposter state and reject saved vote-progress/cursor mismatches.
- [x] Reject invalid GuessUp IDs/results, duplicate team-round completion, and scoring after deck exhaustion.
- [x] Stop GuessUp from wrapping its deck and repeating cards within a round.
- [x] Expand local-only seed content and maintain unique stable IDs.
- [ ] Execute `bun run check` and browser validation at 320px/375px/427px/768px/1024px/1440px.
- [ ] Verify touch press/release, keyboard reveal, refresh/resume, timer drift, and all game end states.
- [ ] Verify report-defined Mystery Who behavior on desktop/mobile; leave report-undefined Troll/elimination/win/tie rules unimplemented pending a new authoritative specification.


## 2026-11-04 branding and dual-wheel acceptance

- [x] Official KING-FUN logo source added and used for app/PWA branding.
- [x] PWA display names, favicon and Apple touch icon use the official mark.
- [x] Player wheel selects the next player in Spin the wheel mode.
- [x] Separate Truth/Dare challenge wheel selects from four Truth and four Dare sectors.
- [x] Existing manual Truth/Dare buttons remain available and call their original prompt-selection path.
- [x] Wheel outcome is persisted before motion; selected prompt is drawn after landing.
- [ ] Final user-device visual acceptance on mobile and desktop.


## KING-FUN brand and Truth/Dare dual-wheel delivery — 2026-11-04

- [x] Supplied crown-and-dice logo retained as original SVG source.
- [x] Exact `KING-FUN` product name used in header, page title and PWA metadata.
- [x] New transparent header/fav-icon assets and padded PWA install icons generated from the supplied logo.
- [x] Player/next-player wheel retained for the Spin the wheel mode.
- [x] Separate eight-sector Truth/Dare wheel rendered through the shared SpinWheel, with Web Crypto selection and persisted outcome before animation.
- [x] Existing manual Truth/Dare buttons retained as the alternative selection path.
- [ ] Browser/device visual and interaction acceptance.


## Phase 5 status — 2026-11-05

**Source implementation:** root backend migration, provider adapters, settings/consent UX, bounded request/response readers, shared Redis-compatible atomic rate and request-budget controls, fail-closed production readiness, Vercel adapter/configuration, environment template, and deployment runbook are implemented.

**Release acceptance:** not complete. Root lock regeneration is blocked by the unavailable Bun 1.4.4 runtime/registry; the policy script catches the stale workspace snapshot. Full Bun CI, production operator secrets, live shared-store and provider checks, deployment, vendor billing controls, and browser/device acceptance remain open. See `docs/phase-5-deployment.md` and `verification.md`.


## Phase 6 source checkpoint — 2026-11-05

- [x] Added automated release source-contract checks for CSP/security headers, Elysia security floor, strict root CI, BYOK/source privacy, native modal/skip/focus/reduced-motion contracts, and service-worker API-cache isolation.
- [x] Added build-budget gate for initial JS/CSS gzip, lazy game chunks, precache coverage, source-map exclusion and bundle secret-pattern scanning.
- [x] Added `bun audit --audit-level=moderate` to the root quality pipeline.
- [x] Explicitly disabled Vite production source maps; added backend COOP/CORP JSON response headers and regression assertions.
- [x] Documented release/recovery rehearsal, accessibility manual matrix and field-performance protocol in `docs/phase-6-release-hardening.md`.
- [ ] Run `bun install --frozen-lockfile` and `bun run check` on this exact Phase 6 archive with Bun 1.4.4, including native advisory audit and actual production build-budget measurement.
- [ ] Complete WCAG 2.2 AA manual keyboard/screen-reader/zoom/reflow/contrast/focus and target-size acceptance.
- [ ] Complete representative-device Lighthouse/Web Vitals, interaction and animation profiling.
- [ ] Complete package license/deprecation review and Vercel Preview CSP/CORS/key/log/abuse verification.
- [ ] Complete install/upgrade/rollback/offline/service-worker/storage-failure/multi-tab release rehearsal.

**Status:** Phase 6 source gates are implemented. Phase 6 is not signed off until all pending browser/device/operator evidence is recorded in `verification.md`.

## 2026-11-06 — Visual finish and component architecture

- [x] Shared named SVG icon component and stable game-ID icon mapping added; primary game cards, setup modes, pack cards, navigation, and wheel controls use named icons.
- [x] Truth or Dare player wheel → challenge wheel sequence reviewed in source and guarded by release-contract assertions. The player outcome is committed before the animation; manual Truth/Dare selection remains available.
- [x] Light-theme token and surface overrides expanded for hero, cards, resume banner, setup, controls, dialogs, prompt and wheel surfaces.
- [x] Shared theme toggle, wheel presentation, and icon component boundaries documented in `docs/ui-architecture.md`.
- [x] Reusable component responsibility/ownership comments added to new and modified components.
- [ ] Install and verify Lucide React/MUI/Radix/Framer Motion through Bun. Not done: no package installation was possible in the authoring environment; no invalid lockfile change was made.
- [ ] Real-browser visual review of light/dark themes, wheel animations, responsive layouts, keyboard, screen reader, and reduced motion.
- [ ] Full native Bun 1.4.4 `bun run check` on this exact source archive.

## 2026-11-06 UI/UX overhaul — source implementation delivered; browser acceptance pending

- [x] Shared 12-column responsive grid and explicit span utilities across library, setup, history, and settings.
- [x] Setup 7/5 desktop workspace split with full-width mobile/tablet stacking.
- [x] Central Lucide React registry and game icon mapping; replace visible action glyphs with icons.
- [x] Accessible named switches and consistent button variants.
- [x] Keyboard/pointer sortable AI provider ordering with move-up/down fallbacks.
- [x] Ctrl/Cmd+K command palette with text-input shortcut guard.
- [x] Motion transitions, list AutoAnimate, Sonner notifications, TanStack gateway status, validated player form, and dropzone pack import at feature boundaries.
- [x] Storybook controls catalogue and Playwright/axe browser suite added.
- [x] Property-based UI utility tests added with fast-check.
- [ ] Run `bun run check` against this exact archive on Bun 1.4.4 and confirm the transfer budgets.
- [ ] Run Playwright E2E in Chromium after `bunx playwright install chromium`.
- [ ] Manually inspect dark/light on phone, tablet, desktop, zoom, reduced motion, keyboard-only and assistive technology.
- [ ] Keep Pixi/Three/Rapier/Matter/Rive/Lottie and other heavy or feature-specific packages out of the initial route until a product interaction requires them.


## 2026-11-06 — Gameplay response and visual fixes

- [x] Player and Truth/Dare wheels use the same reusable `SpinWheel` renderer.
- [x] Truth/Dare challenge wheel contains four Truth and four Dare sectors; labels are enlarged and radial.
- [x] Imposter role reveal starts on pointer/key down without a deliberate hold timer and conceals on release/cancel/focus loss.
- [x] GuessUp team labels are separated; setup summary/copy reduced; custom-pack guidance is game-specific.
- [x] Settings/provider rows and modal surfaces are constrained to responsive viewport/card widths in source.
- [ ] Run native Bun pipeline, new Playwright tests, light/dark visual review and device acceptance.

## 2026-11-06 — Latest native test failure remediation

- [x] Added explicit light-theme mode-card default/hover/selected styling.
- [x] Aligned History navigation with the named `history` SVG icon.
- [x] Corrected the E2E overflow-source contract to assert the actual `document.documentElement.scrollWidth` metric.
- [x] Removed the sortable transform helper call implicated by the React Compiler warning while preserving the dnd-kit transform and drag state.
- [x] Expanded the Node release-contract audit to 62 passing checks and added regression assertions.
- [ ] Rerun the complete Bun 1.4.4 `bun run check` after these fixes; the reported prior run stopped before security audit/build.
- [ ] Rerun Playwright/axe E2E in Chromium and complete manual UI/accessibility acceptance.


## 2026-11-06 — Latest Chromium diagnostics remediation

- [x] Remove ref-derived dnd-kit transition reads; keep row transform movement with CSS-owned transition.
- [x] Focus command search after modal activation.
- [x] Make visible labels part of computed accessible button names (brand, game cards, command shortcut).
- [x] Increase subtle-text contrast for dark and light themes.
- [x] Stabilize the 320 px grid E2E against local-state hydration.
- [x] Fix exact provider-name locators and root/workspace E2E command contract.
- [ ] Re-run Bun lint/typecheck/tests/security audit/build and integrated Playwright/axe suite on the delivered revision.


## Latest E2E remediation — 2026-11-06

- [x] Command-palette focus occurs as soon as its native modal opens, with one post-open retry.
- [x] Game-card and brand accessible names are tied to visible text; command shortcut text precedes its hidden explanation.
- [x] Grid E2E checks the active grid at every measured viewport.
- [ ] Re-run all 187 Bun tests, lint, typechecks, dependency audit, production build, and all 13 Playwright tests on Bun 1.4.4.
- [ ] Review axe output on home, settings and setup after the full browser suite.

- [x] Tie game-card and brand accessible names to visible text; provide the game tagline as a separate description.
- [x] Put the visible `CTRL K` shortcut text first in the quick-action accessible name.
- [x] Focus the command input in a layout effect immediately after opening the native dialog and retry after a frame.
- [x] Scope responsive-grid metrics to the same live Playwright locator after each resize.


## 2026-11-06 — Screenshot-driven visual regression fixes
- [x] Move the theme glyph with the switch thumb in dark and light themes.
- [x] Harden topbar flex sizing and compact navigation on narrow viewports.
- [x] Keep command, theme and brand controls from forcing horizontal overflow at 320–620px.
- [x] Add tablet hero-grid constraints and intrinsic-width guards.
- [ ] Run Playwright at 320/360/390/400/620/768/1024/1440px with pinned Bun dependencies.
- [ ] Verify theme switch pointer, keyboard and screen-reader behaviour in both themes.

## 2026-11-06 — Social Gamebox report scope review
- [x] Read the supplied report and classify documented vs inferred mechanics.
- [x] Record candidate additions and unresolved/out-of-scope entries in `todo.md`.
- [ ] Do not add placeholder cards for titles whose gameplay is unclear.

## 2026-11-06 — Party Arcade expansion implementation

- [x] Expand the typed game catalogue from four to 27 selectable titles (23 additions; aliases do not duplicate games).
- [x] Add setup validation and options for player counts, hostiles, narrator, fuse, team/solo, duration, read-aloud, anti-items and Reverse Singing Battle.
- [x] Add content packs for all new prompt/word games; structured Fake It answers and Fact or Fiction verdict metadata.
- [x] Add local domain session creation with Web Crypto for every added game.
- [x] Add reusable presentation components and feature-specific game controllers.
- [x] Add Timer Impostor, Werewolf, Mafia, Murder, Fake It, Fake Story, Fact or Fiction, Wrong Answers Only/Opposites Day, Hot Bomb, Hot Bomb Duel, Who's Most Likely, Would You Rather, Share or Pass, $20 Challenge, Tilt It, Letterburg, Discussion Starter, Who Am I, Ten Tangle, Qupid, Questions for Love, A or B and Reverse Singing.
- [x] Preserve the four original games, local-only architecture and pressure-free participation policy.
- [x] Add `$20 Challenge` theme-specific lots and explicit local anti-items interpretation.
- [x] Add Reverse Singing Classic/Battle with explicit microphone permission, local-only memory clips and cleanup.
- [x] Allow same-origin microphone access in the hosted frontend Permissions Policy while keeping camera/geolocation disabled; protect the header with release-contract regressions.
- [x] Add domain/content tests and comprehensive game specification document.
- [ ] Run the full Bun 1.4.4 lint, semantic typecheck, unit suite, dependency audit and Vite build on this exact tree.
- [ ] Implement and run integrated Playwright/axe flows for all new game families, permissions, refresh/resume, reduced motion and mobile widths.
- [ ] Complete real-device validation for sensor orientation, microphone/AudioContext differences, timers in background tabs and offline PWA restart.

## 2026-11-06 — Party Arcade verification gates

- [x] Expand the catalogue to 27 selectable titles while retaining the original four games.
- [x] Split the added controllers into seven demand-loaded interaction families; add build-budget patterns for each.
- [x] Update home E2E expectations to 27 cards and add Fake It / Who Am I flow coverage.
- [ ] Run the native Bun/Playwright/axe pipeline and inspect all 27 game journeys in Chromium.
- [ ] Confirm tilt beta-axis direction on physical iOS and Android devices.

- [x] Verify Fake It clue/answer separation in the bundled content test catalogue.
- [x] Allow mechanics-only deduction games to launch without unused prompt-pack dependencies.


## 2026-11-06 — Party Arcade final pass
- [x] Remove stale four-experience home copy; show the actual current catalogue count.
- [x] Add neutral market fallback for user-created $20 Challenge themes.
- [x] Normalize custom Fact or Fiction verdict metadata.
- [x] Reset night-ballot cursor during repeated Werewolf/Mafia cycles.
- [x] Add release-contract, domain and 23-controller browser smoke coverage.
- [ ] Run pinned Bun 1.4.4 workspace checks and integrated browser/axe suite before release certification.


## 2026-11-07 — Current lint/type/E2E remediation

- [x] Fix the reported `exactOptionalPropertyTypes` hints argument.
- [x] Type the extensible Tilt It score state and the prompt result-row/count structures.
- [x] Guard undefined player IDs in auction and identity-map indexing.
- [x] Remove unused Word Arcade/Tilt It state and fix the childless night-phase stage.
- [x] Move countdown wall-clock reads to a cached external store.
- [x] Remove state-reset effects from prompt and social deduction controllers.
- [x] Stabilize Hot Bomb and $20 Challenge memo fallbacks and effect dependencies.
- [x] Update the Would You Rather selector/voter-count test and player-roster test synchronization.
- [ ] Run `bun run lint` with Bun 1.4.4 and installed workspace dependencies.
- [ ] Run `bun run typecheck` with TypeScript 7 and installed workspace dependencies.
- [ ] Run `bun run test`, `bun audit`, `bun run build`, and the full Playwright/axe suite.


## 2026-11-07 — UI/UX visual refresh

- [x] Add a no-dependency projected-3D ambient scene with pointer parallax, proximity highlights, orbiting nodes, and tap ripples.
- [x] Cap the renderer at 30fps and 1.35 device-pixel ratio; suspend it on hidden tabs and pause it for system/in-app reduced motion.
- [x] Add an accessible pause/resume control and maintain a decorative, pointer-transparent canvas.
- [x] Refresh the header, icon controls, theme switch, preference switches, buttons, game cards, surfaces, and dark/light home presentation.
- [x] Preserve the existing IndexedDB-backed theme preference and document theme-color updates.
- [x] Add release-contract assertions and Playwright coverage for synchronized/persisted header and Settings theme controls, ambient pointer input, pause/resume, and system/in-app reduced motion.
- [x] Specify NFR-UX-004 for scene input boundaries, frame/DPR limits, hidden-tab suspension, and reduced-motion behavior.
- [ ] Run Bun 1.4.4 `check` and Playwright/axe on this exact source revision; manually inspect 320px, 390px, tablet, desktop, keyboard, and touch behavior.


## 2026-11-07 — Latest user-run check triage

- [x] Remove React Compiler immutability warning from ambient-scene cleanup without suppressing lint.
- [x] Scope canonical duplicate checks to each game's own content selection pool.
- [x] Update bundled pack coverage assertion to match all 27 registered games and retain all 30 general Imposter category packs plus the 18+ pack.
- [x] Synchronize Playwright setup transition and loaded player roster before the first player-count snapshot.
- [x] Add Node release-contract and Bun regression coverage for all identified failures.
- [ ] Rerun `bun run check` on Bun 1.4.4 and confirm zero lint warnings, all unit tests passing, security audit passing, and production build budgets passing.
- [ ] Rerun all Playwright/axe tests and confirm all 20 tests pass on the exact updated source.


## 2026-11-07 — Ambient renderer TS/lint remediation

- [x] Move mutable canvas renderer state and callbacks into a module-level imperative lifecycle function rather than the React component/effect scope.
- [x] Explicitly narrow `HTMLCanvasElement.getContext('2d')` before use in drawing callbacks.
- [x] Add source and Bun regression assertions for the renderer boundary and context type.
- [ ] Rerun native Bun 1.4.4 `check` on the exact updated tree; require zero frontend/backend lint warnings, both workspace typechecks, all unit tests, security audit, Vite build and artifact-budget checks to pass.
- [ ] Rerun all 20 Playwright/axe tests on the exact updated tree. The prior user log passed 20/20 before this source-only renderer lifecycle change.
