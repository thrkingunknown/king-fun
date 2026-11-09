## 2026-11-08 — Quality-run fixes and dependency preflight

### Fixed
- Removed both Oxlint unused-parameter warnings in Imposter domain tests by using zero-parameter deterministic random callbacks.
- Made the Imposter role-reveal browser test deterministic: it deselects every category except Animals, verifies exactly one category is selected, waits for the POST generation request, and asserts the category title/description against the actual request.
- Broadened the mock route matcher to `**/v1/content/generate` so it works with same-origin and configured API origins regardless of an additional `/api` path prefix.
- Changed the frontend E2E script from `bunx playwright` to the version-pinned workspace `playwright` binary. Added a root `bun run install:e2e-browser` command so Chromium installation uses the same pinned Playwright package.
- Added a dependency preflight to `bun run check`, `bun run test:e2e`, and browser installation. Missing workspace packages now produce the explicit `bun install --frozen-lockfile` instruction instead of misleading module-resolution diagnostics.
- Updated current README instructions and verification status to match the user-provided 2026-11-08 logs.

### Verification
- The user-provided log shows 154/154 release-contract checks passing, frontend lint with two warnings and zero errors, and backend lint clean. The current source removes those two warning sites.
- The same log shows frontend typecheck could not resolve Vite/Tailwind/plugin packages and Playwright could not resolve `@playwright/test`; the project archive intentionally does not include `node_modules`. The dependency preflight now identifies this setup condition before running the pipeline.
- The preceding browser attempt reported 19 passed / 1 failed. The current test removes the category-selection nondeterminism and explicitly waits for its mocked generation request. Playwright was not executable in this authoring environment because Bun, installed workspace dependencies, and Chromium are unavailable; no full pipeline or browser pass is claimed.
- `node scripts/check-release-contracts.mjs`: **157/157 checks passed** on this source revision. TypeScript 5.8.3 syntax-only transpilation parsed **115 TypeScript/TSX files with zero syntax diagnostics**; six repository JSON manifests/configs and the modified MJS scripts also parse. This does not replace strict TypeScript 7 project typechecking.

## 2026-11-08 — Imposter category-provider test regression fix

### User-provided failure
- `bun run check` stopped at the release-contract audit with the metadata-only Imposter bank contract failing. The updated archive has no `imposter-additional-words.ts`; however, extracting a ZIP over an older source directory does not remove obsolete files that are absent from the new archive. The added `bun run clean:legacy-imposter` command removes only that known obsolete file.
- `bun run test:e2e` reported 19/20 passing. The Imposter role-reveal test clicked Start before a local backend/provider was available; built-in categories correctly have no offline word bank, so the application did not create a reveal phase.

### Fix
- The role-reveal E2E now intercepts `/api/v1/content/generate`, returns five deterministic words with 20 hints each, and asserts the selected `Animals` title/description were sent. The test still exercises the real category selection, client request path, round creation, and private reveal control.
- Added a regression contract for the mocked category-scoped generation request and a one-purpose cleanup command for the legacy word bank.

### Verification status
- This authoring environment has no Bun installation or workspace `node_modules`; the Bun test/build/browser pipeline cannot be executed here. Run `bun run clean:legacy-imposter` once after overlaying the archive on an older checkout, then `bun run check` and `bun run test:e2e` on the updated source.

## 2026-11-07 — Latest ambient renderer lint/typecheck failure and correction

### User-provided exact-revision evidence before correction
- Repository policy and **117/117 release-contract checks passed**.
- Frontend Oxlint reported one React Compiler `react(immutability)` warning at `AmbientBackground.tsx` where the resize callback reassigned `width`; backend lint reported zero warnings/errors.
- Frontend TypeScript failed with TS18049 because the optional canvas lookup made `context` possibly null/undefined inside drawing callbacks. This prevented `bun run check` from reaching unit tests, `bun audit`, and production build.
- Playwright completed **20/20 tests passed** on that same pre-correction revision, including the all-added-controller smoke loop and the serious/critical axe scan.

### Source correction applied
- Extracted the canvas implementation into module-level `mountAmbientScene(canvas, paused)`. React now only owns the canvas ref and mounts/disposes the renderer from `useEffect`; dimensions, animation IDs, pointer/ripple coordinates, rotation and all other mutable state are renderer-local.
- Acquired the context only after checking the canvas ref, returned a no-op disposer when `getContext('2d')` returns `null`, and explicitly typed the narrowed context as `CanvasRenderingContext2D`. No lint suppression, type cast, optional chaining, or relaxed compiler setting was added.
- Added a release-contract and Bun regression assertion for the external renderer boundary and non-null context narrowing.

### Verification after source correction in this environment
- `node scripts/check-release-contracts.mjs`: **118/118 checks passed**.
- Isolated strict TypeScript 5.8.3 compilation of `AmbientBackground.tsx` with minimal React/JSX declarations: **passed**.
- Native Bun 1.4.4 Oxlint, full workspace TypeScript 7 check, Bun unit suite, `bun audit`, Vite production build and bundle-budget gate: **not run in this environment**. The global `tsc` available here is TypeScript 5.8.3, no Bun binary or workspace `node_modules` is present, and a file-level isolated compile is not a substitute for the workspace typecheck.
- Playwright/axe after this exact patch: **not rerun here**. The user-provided immediately preceding run passed 20/20.

**Release state:** the reported source warning and TypeScript errors are corrected and isolated checks pass. Do not mark the entire pipeline release-certified until the exact updated archive passes `bun run check` and `bun run test:e2e` with Bun 1.4.4.

# Latest verification — UI/UX refresh and interactive ambient scene (2026-11-07)

## Changes in this source revision

- Added `AmbientBackground.tsx`: 3D wire-sphere geometry projected into Canvas 2D, pointer parallax, nearby-node highlights, click/tap ripple feedback, 30fps frame cap, 1.35 DPR cap, and hidden-tab suspension. The canvas is decorative and never captures pointer input.
- Added header pause/resume control. System and saved in-app reduced-motion preferences pause the scene; the control is disabled while reduced motion is active.
- Added `visual-refresh.css` for a cohesive dark/light surface system, updated navigation and icon controls, cleaner game cards, upgraded preference switches, and restrained hover/active motion.
- Theme state remains persisted through the existing Save snapshot. IndexedDB-first bootstrap and AppShell both apply the saved document `data-theme` and matching browser theme-colour value; root/body surfaces and native colour-scheme follow it.
- Added four E2E cases and 4 new release-contract assertions. The theme test now exercises both switches and waits until IndexedDB stores the selected value before reloading; the ambient test confirms pointer events reach the scene, and separate tests cover system and in-app reduced-motion behavior. Latitude rings close and meridians remain open. NFR-UX-004 documents the scene boundary. No package dependencies or gameplay/domain/storage contracts changed.

## Verification performed

- `node scripts/check-release-contracts.mjs`: **113/113 passed** after the follow-up interaction-test and geometry corrections.
- Static source assertions confirm the scene's 3D projection helpers, pointer handlers, visibility handling, frame cap, reduced-motion state, and theme/ambient browser tests.

## Verification still required

- Bun 1.4.4 is not available in this authoring container. The exact source revision has not yet passed native Oxlint, TypeScript 7 semantic typecheck, Bun unit tests, dependency audit, Vite production build/real gzip budgets, or integrated Playwright/axe.
- Manually inspect the refreshed appearance at the documented viewport matrix, keyboard/screen-reader behavior, touch interactions, reduced-motion settings, theme persistence, and canvas GPU/battery cost on a physical phone.
- Do not mark this source revision release-certified until `bun run check` and `bun run test:e2e` pass on the exact archive.

---

# Latest verification — Reverse Singing microphone policy correction (2026-11-07)

## Source correction

- The hosted frontend's Vercel Permissions Policy now allows `microphone=(self)`, matching Reverse Singing's explicit, user-initiated `getUserMedia()` flow. Camera, geolocation, payment and USB remain disabled. Backend JSON response permissions remain restricted because the API does not need microphone access.
- The release-contract source audit and Bun security-header regression now fail if the hosted frontend blocks the same-origin microphone or enables unrelated camera/geolocation access.
- Current worker source and tests use `king-fun-shell-v8`; `frontend/README.md` and the current test inventory were reconciled to v8. Historical v5/v6/v7 notes below are retained as historical entries.

## Verification evidence and limits

- The user-provided pre-patch `bun run check` excerpt showed repository policy pass, 109/109 release contracts pass, zero Oxlint warnings/errors in both workspaces, and both TypeScript typechecks pass. The pasted output ended during unit-test output, before a final test summary, dependency audit or production build result.
- Post-patch source release-contract audit is checked with Node in this authoring environment. Bun 1.4.4 and installed workspace dependencies are unavailable here, so this does not claim a native post-patch `bun run check`, Vite build-budget pass, or Playwright/axe pass.
- Browser permission prompt, permission denial, actual recording, and audio-track cleanup still require browser/device acceptance.

---

# Latest verification — timer, provider layout, and contrast continuation (2026-11-06)

## Latest reported native failures and source corrections

The user's latest Bun 1.4.4 `check` log reported one React Compiler `immutability` warning in `CommandPalette.tsx` and a frontend TypeScript error assigning the browser timeout number to a Node `Timeout`-typed ref. The follow-up Playwright run passed 11/13; its two remaining failures were provider-name visibility at phone/tablet widths and axe contrast on the WHO/ACT/SPIN/EVER home-art labels.

The current source contains these corrections:
- `AppShell.tsx` stores the `window.setTimeout` handle in `useRef<number | null>`, matching the DOM `window.setTimeout`/`window.clearTimeout` API rather than Node's global timer type.
- `CommandPalette.tsx` stores both animation-frame handles in refs and cancels them in effect cleanup; no callback mutates a local variable captured after render.
- `SortableProviderRow.tsx` uses a direct accessible native `role="switch"` grid child, and provider identity has a separate flexible visible track. The obsolete duplicate provider-grid CSS block has been removed so one authoritative layout controls desktop/tablet/phone rules.
- `hero-motion.css` renders the four small labels in opaque white on the dark token cards.

## Verification performed in the current authoring environment

- `node scripts/check-release-contracts.mjs`: **82/82 checks passed** after consolidating the provider-row CSS; the output is saved as `king-fun-patch-contracts-latest.log` outside the source archive.
- TypeScript/TSX syntax transpilation through the globally installed TypeScript compiler: **94 files, zero syntax diagnostics**. This is a syntax pass, not semantic typechecking with the project's TypeScript 7 configuration.
- JavaScript/MJS syntax: every repository `.js` and `.mjs` file passed `node --check`.
- JSON parsing: **10 files, zero errors**.
- CSS parsing with `tinycss2`: **4 stylesheets, zero parse errors**.
- Chromium 144 fixture using the production `design-system.css` and `hero-motion.css`: dark and light modes, both stylesheet orders, and **320, 360, 375, 390, 620, 768, 1024, and 1440 CSS px**. Document width stayed within the viewport; both provider names remained visible; provider rows did not overflow; switches remained at least 44px high.
- The same Chromium fixture measured the four hero token labels at **13.10:1–13.68:1** contrast against their computed dark surfaces. This exceeds WCAG 2.2 SC 1.4.3's 4.5:1 minimum for normal text ([W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/#contrast-minimum); [W3C understanding document](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum)).
- Synthetic build-budget fixture: **passed**. It exercised entry/modulepreload accounting, recursive deferred AppShell/startup dependency graphs, and the four lazy-game chunk checks. It does not represent a real Vite production build or prove the actual gzip budgets.

## Verification still required on Bun 1.4.4

This authoring container does not have Bun or installed project dependencies. Therefore the exact current source has **not** been run through Oxlint, TypeScript 7 semantic typechecking, Bun unit tests, `bun audit`, the Vite production build and real gzip budget, or the integrated 13-test Playwright/axe suite. The user's previous 188/188 test and dependency-audit pass belongs to the preceding archive and remains historical evidence only. Do not call this revision release-verified until the user reruns `bun run check` and `bun run test:e2e` on this exact archive.

## User-provided Bun 1.4.4 baseline

The latest pasted log reports:

- Repository policy passed and release-contract audit passed 67 checks.
- Frontend and backend TypeScript semantic typechecks passed.
- Backend lint was clean. Frontend lint had one `react(refs)` warning at `SortableProviderRow.tsx` from spreading dnd-kit `attributes`.
- Bun test suite: 188 passed, 0 failed.
- `bun audit --audit-level=moderate`: no vulnerabilities across 889 packages.
- Vite emitted an entry bundle of 289.87 KiB gzip and initial JS+CSS of 306.89 KiB gzip, exceeding 150 KiB and 170 KiB limits respectively.
- Playwright: 9/13 passed and four failed: horizontal overflow at 320px (328px document), hidden Google Gemini provider name, keyboard command palette not opening, and four `label-content-name-mismatch` axe violations for game cards.
- The full `check` stopped at the post-build gzip budget gate. The separate E2E run also stopped with the four browser failures above.

## Remediation applied to current source

- Added per-card overflow containment for the decorative art halo, fixed the measured 320px overrun at its actual source.
- Made provider identity text explicitly visible and added E2E visibility measurements.
- Replaced the global hotkey listener with document-capture handling using `code`/key fallback, while guarding editable controls and IME/repeat events.
- Switched the command palette to the inline-SVG CoreIcon registry to avoid the large lazy feature-icon registry when opening quick actions.
- Removed `aria-labelledby` from home game cards; the visible button content now forms the accessible name, satisfying label-in-name without omitting the category, tagline, metric or action text.
- Moved storage bootstrap and AppShell behind asynchronous imports in `main.tsx`; the entry displays an accessible bootstrap state and a recoverable startup error state.
- Added a dependency-graph manifest and recursive gzip accounting for the complete deferred AppShell static-import graph (120 KiB) and the combined dynamic startup-import graph (160 KiB); the original entry/CSS budgets remain unchanged.
- Removed the dnd-kit sortable row and its render-time refs in favour of native drag/drop with explicit keyboard move buttons.
- Bumped the service-worker namespace to v6 and updated cache integration fixtures so prior installs activate the refreshed precache manifest and async application-shell chunk.

## Checks run in this environment

- `node scripts/check-release-contracts.mjs`: **77/77 passed**.
- Global TypeScript 5.8 TS/TSX transpilation: **94 files, zero syntax errors**. This is not a substitute for Bun's configured TypeScript 7 project typechecks.
- CSS parsing and Chromium fixture checks: **320, 360, 390, 620, 768, 1024, and 1440 px**; `documentElement.scrollWidth` equals viewport width at each size, provider name text is visible, and card art is clipped within its card.
- JavaScript build-budget and release-contract scripts pass Node syntax checks.
- Bun 1.4.4, workspace dependencies, Vite, Oxlint and Playwright project dependencies are unavailable in this execution container. Therefore the native lint/typecheck/test/audit/build and integrated E2E/axe suite for this latest revision are **not yet verified**.

## Required final user-machine verification

Run `bun install --frozen-lockfile`, `bun run check`, and `bun run test:e2e` on this exact archive. Inspect the updated report for the recursively measured deferred `AppShell` static-import graph and the total dynamic startup-import graph. Release sign-off requires zero Oxlint warnings, 188+ passing unit/contracts (including the added assertions), no moderate-or-higher audit findings, all browser tests passing, and no serious/critical axe violations.

---

# Verification update — latest 187-test triage (2026-11-06)

## User-provided Bun 1.4.4 result on the preceding archive

- Repository policy passed.
- Release-contract audit passed 58 checks.
- Frontend and backend semantic typechecks passed.
- Backend Oxlint passed with zero warnings/errors.
- Frontend Oxlint reported two instances of one `react(refs)` warning at `CSS.Transform.toString(sortable.transform)` in `SortableProviderRow.tsx`.
- Bun tests: 184 passed, 3 failed (187 total). Failures were the explicit light-theme mode-card selector contract, expected History icon name, and a stale static E2E assertion for `document.scrollWidth` although the actual Playwright test uses `document.documentElement.scrollWidth`.
- The root `check` stopped at tests; security audit and production build were not reached.

## Changes made after that run

- Added explicit light-mode mode-card default, hover, and selected styles.
- Switched the History nav icon from `archive` to `history`.
- Corrected the E2E source contract to check `document.documentElement.scrollWidth` (the actual and correct scroll metric already used by the browser test).
- Removed `CSS.Transform.toString` from the sortable row and preserved equivalent dnd-kit CSS translation/scaling through direct `translate3d`/`scaleX`/`scaleY` serialization.
- Extended Node release-contract coverage from 58 to 62 checks and strengthened the Bun contract test for the sortable transform implementation.

## Post-patch verification in this environment

- `node scripts/check-release-contracts.mjs`: PASS, 62/62.
- Chromium 144 light-theme computed-style smoke at 390×844: PASS; readable foreground/background/border values, distinct selected-state surface, supported `color-mix()`, no horizontal overflow, and no browser page errors.
- The exact workspace's dependencies and Bun 1.4.4 are not installed in this environment. A global TypeScript 5.8.3 compiler cannot resolve `vite/client` or `node` type declarations; this is an environment limitation and is not evidence of a project-source type error.
- Full Oxlint, TypeScript 7 semantic typecheck, Bun unit/contract tests, `bun audit`, Vite build/budget, and Playwright/axe E2E have **not** been rerun after the patches. These remain explicitly unverified until `bun install --frozen-lockfile` and `bun run check` pass on the delivered archive; install Chromium and run `bun run test:e2e` separately.

---

# Verification update — 2026-11-06 (frontend typecheck remediation)

## User-supplied run result

- Repository policy passed.
- Release-contract audit passed all 54 checks.
- Frontend Oxlint reported two React Compiler `refs` warnings in `SortableProviderRow.tsx`; backend lint reported zero warnings/errors.
- Frontend typecheck failed at `AppShell.tsx` (`exit` explicitly set to `undefined` with exact optional properties), `PlayerWheel.tsx` (`selectedId` could be `undefined`), and `SettingsScreen.tsx` (TanStack Query `queryFn` received a query context, not an `AbortSignal`). The test, security audit, and production build stages were not reached.

## Remediation applied

- The reduced-motion branch now omits the Motion `exit` prop using a conditional spread.
- Optional player selection is normalized to `null` before passing it to `SpinWheel`.
- The gateway query function now accepts TanStack Query's context and forwards `context.signal` to the backend status fetch.
- The sortable provider row derives its active visual state from `useDndContext().active?.id`, preserving the `is-dragging` class and focus/pointer sorting feedback without reading the ref-derived `useSortable().isDragging` value.

## Follow-up — sortable drag feedback preservation (2026-11-06)

- Replaced the initial warning workaround with `useDndContext().active?.id === provider`, so the row still receives its `is-dragging` class and accent/elevation styling while avoiding the React Compiler ref-access warning.
- Updated the Node release-contract and Bun regression assertions to require the DndContext state source, active-row comparison, visual class and absence of `sortable.isDragging`.
- Node 22 release-contract audit passes all 58 checks. CSS/TS syntax and the complete Bun quality pipeline remain subject to the environment limitations below.

## Current verification status

- The user's prior 54 release-contract checks passed before these final typecheck fixes. Four source regression contracts have since been added; the updated Node 22 audit passed all 58 checks.
- Global TypeScript 5.8.3 syntax transpilation passed for all frontend, backend and script `.ts`/`.tsx` sources. This is syntax-only evidence and does not replace semantic typechecking.
- A direct `tsc -b frontend/tsconfig.json` attempt remains blocked because this runtime has no installed workspace dependencies (`vite/client` and `node` type definitions are unavailable). Rerun `bun run check` on Bun 1.4.4. Until it completes, frontend/backend semantic typechecking, unit tests, dependency audit and production build remain unverified. Browser/device and hosted acceptance remain separately pending.

---

## Dependency and environment repair checkpoint — 2026-11-06

| Latest user-run Bun 1.4.4 install/trust | PASS (user-reported) | `bun install` added 810 packages; `bun install --frozen-lockfile` checked 813 installs with no changes. `bun pm untrusted` identified `@tsparticles/engine@4.5.2` and `protobufjs@7.6.6`; the user ran `bun pm trust --all`, and both lifecycle scripts completed. |
| Latest user-run release contracts | PASS (user-reported) | All 41 release-contract checks passed. |
| Latest user-run frontend lint | WARNING (user-reported) | 0 errors and one `react(only-export-components)` warning from exporting `buttonVariants` alongside `Button`; now addressed by moving variants to a separate module. |
| Latest user-run TypeScript 7 typecheck | FAILED, PATCHED IN THIS ARCHIVE | TypeScript 7.0.2 rejected `baseUrl` with TS5102 in `frontend/tsconfig.app.json`; removed `baseUrl` from both frontend root/app configs while preserving project-relative `@/*` paths. Native rerun is still required. |
| Latest TypeScript 7 config source check | PASS (static) | Both frontend configs parse and contain no `baseUrl`; `@/*` remains mapped to `./src/*`. The installed TypeScript 7.0.2 semantic check must be rerun locally. |
| Latest Fast Refresh lint-warning source fix | PASS (static) | `button.tsx` now exports only `Button`; the reusable CVA definition is in `button-variants.ts`. Oxlint rerun is required to confirm warning-free output. |
| Latest user-run tests, advisory audit and production build | NOT REACHED | The root `check` stopped at frontend typecheck, before tests, `bun audit`, and Vite build. |

| Check | Result | Evidence / limitation |
|---|---|---|
| User's pre-repair source checks | PASS (user-reported) | Pasted Bun 1.4.4 output reports 36 release-contract checks, 0 frontend/backend lint warnings or errors, both workspace typechecks passing, and 171 tests passing. |
| Current release-contract script | PASS (Node 22.16.0) | `node scripts/check-release-contracts.mjs` passed 41 checks after adding environment-template and shadcn alias regression checks. This is not a Bun test-runner result. |
| TypeScript syntax transpilation | PASS (TypeScript 5.8.3) | 89 `.ts`/`.tsx` files transpiled with 0 syntax diagnostics after splitting the shadcn button variants module. This is not semantic typechecking. |
| Workspace manifest/lock consistency | PASS (static) | All root/frontend/backend workspace dependency snapshots match their manifests; the original vulnerable esbuild, glob, and minimatch resolution labels no longer remain in the locked dependency paths. Bun's own frozen-lock verifier remains authoritative. |
| Repository policy | PASS (Node compatibility run) | The existing TypeScript policy script passed after a temporary Node-compatible replacement for Bun's `import.meta.dir`; the checked repository itself was not modified for this run. |
| User's initial frozen install | PASS (user-reported, before this archive's lock edits) | The pasted output reports `bun install` and `bun install --frozen-lockfile` completed without changes. This does not verify the dependency/lock updates in this archive. |
| shadcn initialization | PASS (user-reported) | The second `shadcn init` succeeded and generated the Base UI button, `components.json`, and CSS imports. The first two attempts failed because Tailwind/alias config was incomplete. |
| shadcn import helper | FIXED (source) | Removed the accidental `cn` package; the generated button imports `@/lib/utils` from the canonical `src/` tree, and the local helper uses `clsx` + `tailwind-merge`. |
| `@/` path alias | FIXED (source) | Configured both `frontend/tsconfig.app.json` and `frontend/vite.config.ts` to resolve `@/` from the canonical `frontend/src/` root. |
| Storybook version alignment | FIXED (manifest) | Removed the v8 `@storybook/addon-interactions` dependency from the Storybook 10.6 workspace. |
| Unused deprecated metrics package | FIXED (manifest) | Removed `prom-client`; no backend source import currently uses it. A replacement is not added until a metrics surface is implemented. |
| Dependency advisory resolutions | UPDATED (lock + root overrides) | Root overrides and lock resolutions pin esbuild 0.28.2, glob 14.0.4, and minimatch 11.0.5, above the patch floors for the findings in the supplied log. Native Bun advisory audit remains pending. |
| `.env.example` | RESTORED | Root template includes only blank credentials and keeps `AI_ENABLED=false`; no user secrets were present in the archive. |
| Native Bun frozen install, audit, full checks and build | PENDING | Bun 1.4.4 is unavailable in this authoring runtime. Rerun `bun install --frozen-lockfile` and `bun run check` on the delivered archive; do not treat the earlier log as verification of these edits. |

The latest user log identifies the two lifecycle scripts and records that both were explicitly trusted and executed with `bun pm trust --all`: `@tsparticles/engine@4.5.2` and `protobufjs@7.6.6`. No new packages or lockfile entries were introduced in the subsequent TypeScript/Fast Refresh repair.

## Phase 6 source checkpoint — 2026-11-05

This section is the current Phase 6 evidence register and supersedes older statements below that Phase 6 work had not started. Source-level changes are present in this archive, but the native Bun pipeline and all required manual/operator acceptance are still pending.

| Check | Result | Evidence / limitation |
|---|---|---|
| Release-contract audit | PASS (Node 22) | `node scripts/check-release-contracts.mjs` passed 33 source/configuration checks after the Phase 6 edits. This is not the Bun test runner. |
| WCAG source contracts | PASS (static checks only) | Skip link/main landmark, main focus transfer, focus visibility, forced-colours, focus scroll margin, reduced motion, native dialogs, live regions and 44px enhanced target-height design token are present. No axe/AT/browser audit is claimed. |
| Backend security response headers | SOURCE UPDATED | API responses now include no-store, nosniff, no-referrer, frame denial, Permissions Policy, COOP and CORP; regression assertions added. Bun test not yet run on this archive. |
| CSP and Vercel response headers | SOURCE CHECK PASS | Same-origin script/connect policy, no objects/framing, HSTS, nosniff, frame denial, Permissions Policy, COOP/CORP, worker and hashed asset cache rules are checked by the release-contract script. Preview header delivery remains unverified. |
| Dependency floor | SOURCE CHECK PASS | Backend manifest and lockfile require Elysia `^1.4.31` and resolve 1.4.31. Public Elysia 1.4.x advisories disclosed patched floors at 1.4.26, 1.4.27, 1.4.29 and 1.4.30; full workspace audit is the authoritative check. |
| Dependency advisory audit | CONFIGURED, NOT RUN | Root `check` now invokes `bun audit --audit-level=moderate`. Bun registry access is unavailable in this authoring environment. No clean audit is claimed. |
| License/deprecation review | PENDING | `bun audit` does not review licenses. Direct/transitive license and deprecation review plus notice aggregation must be performed before public distribution. |
| Build size/protection gate | IMPLEMENTED, REAL BUILD PENDING | Build gate measures actual gzip entry and lazy chunks, precache coverage, source maps and secret patterns. Production Vite source maps explicitly disabled. The user's earlier build log measured 124.96 KiB JS gzip, 14.42 KiB CSS gzip, 139.38 KiB combined and 3.82–6.26 KiB lazy chunks; this is the previous source snapshot, not a measurement of this Phase 6 archive. |
| Release-contract tests | ADDED, NOT RUN UNDER BUN | `scripts/release-contracts.test.ts` adds seven Bun tests and backend route tests assert security headers. `node scripts/check-release-contracts.mjs` passed 33 checks. |
| Full Bun 1.4.4 pipeline | PENDING | User confirmed the Phase 5 source archive passed; this Phase 6 archive adds release-contract tests, native advisory audit and a real-build budget gate and needs a fresh `bun install --frozen-lockfile` + `bun run check`. |
| Accessibility manual acceptance | PENDING | Keyboard, NVDA/VoiceOver, 200%/400% reflow, contrast, focus-not-obscured, touch target and system/in-app reduced-motion checks remain unperformed. |
| Performance/device acceptance | PENDING | No current archive Lighthouse/Web Vitals, CPU/network trace, memory profile or real-device animation trace is available. |
| Security/hosting acceptance | PENDING | Vercel Preview headers/CSP, exact origins, throwaway BYOK redaction, Upstash distributed abuse, operator billing limits and kill switch need operator credentials. |
| Release/recovery rehearsal | PENDING | Clean install, update/rollback, SW update, offline all-game start, migration, storage quota failure, backup/restore and multi-tab conflict require disposable browser profiles. |

### Phase 6 authoring-environment checks (2026-11-05)

- `node scripts/check-release-contracts.mjs`: PASS, 33 source/configuration checks.
- Node syntax checks for both `.mjs` release scripts: PASS.
- Global TypeScript 5.8.3 `transpileModule` syntax pass: 83 `.ts`/`.tsx` files, 0 syntax diagnostics. This is a syntax-only check, not workspace semantic typechecking.
- JSON configuration parsing: 9 JSON files passed; `bun.lock` parsed as JSONC after trailing-comma normalization.
- Markdown link scan: 16 Markdown documents, 0 broken relative links.
- `scripts/check-build-budget.mjs`: PASS against a disposable synthetic `frontend/dist` fixture containing all four expected lazy game chunks. This verifies budget-gate logic only; it is not a real Vite output size measurement.
- Bun/Oxlint/semantic typecheck/Bun tests/native advisory audit/real Vite build were not executable in this authoring environment because Bun and installed workspace dependencies are unavailable.

### Automated and external evidence distinction

- Static checks prove that source/configuration contains expected controls; they do not prove browser behavior or deployed response headers.
- The user-provided earlier Bun log (archived above) reported 161 tests passed, 0 failed, both workspace typechecks passed, and a successful Vite production build. The final lint-fixture cleanup was subsequently user-confirmed as working. Do not transfer these results to the new Phase 6 archive without rerunning it.
- Phase 6 remains **in progress** until `VERIFY-A11Y-002`, `VERIFY-PERF-002`, `VERIFY-SEC-001` and `VERIFY-RELEASE-001` contain actual manual/operator evidence and all serious findings are closed.

## User-reported Bun 1.4.4 run and final fixture cleanup — 2026-11-05

The user ran `bun run check` from the repository root on the screenshot-fix archive. The supplied terminal output confirms:

| Check | Result | Evidence |
|---|---|---|
| `check:policy` | PASS | Root Bun 1.4.4 workspace, single root lockfile, root backend, Bun-only CI. |
| Frontend Oxlint | PASS | 65 files; 0 warnings and 0 errors. |
| Backend Oxlint | PASS with warnings | 16 `no-useless-escape` warnings, all in JSON string fixtures in `backend/tests/providers.test.ts`; 0 errors. |
| Frontend TypeScript | PASS | `tsc -b` completed. |
| Backend TypeScript | PASS | `tsc -p tsconfig.json` completed. |
| Bun tests | PASS | 161 passed, 0 failed, 11,820 assertions across 23 files. |
| Frontend production build | PASS | Vite 8.3.5 built successfully. |

This archive removes the 16 redundant `\"` sequences from those single-quoted JSON fixture strings. Since JavaScript does not require escaping double quotes inside single-quoted strings, the resulting fixture values are unchanged. The current archive therefore addresses every warning visible in the supplied log. The native Oxlint and complete `bun run check` command still need to be rerun against this exact archive; no result from the earlier archive is represented as a run against this final change.

# Verification Plan and Evidence Register

## Current archive verification — 2026-11-05 (root-backend migration and Phase 5 source completion)

This section supersedes older Phase 5 location and package notes below. The gateway source now lives in root `backend/`; the frontend and backend are declared as root Bun workspaces; the Vercel adapter is `api/[[...all]].ts` and exports a Fetch handler; and the root `vercel.json` selects Bun Functions. The API slot type, strict provider-output field validation, untrusted prompt-data delimiters, Imposter roster fail-closed behavior, shared Redis request leases, and AI category metadata workflow were tightened/implemented in this archive.

| Check | Result | Evidence / limitation |
|---|---|---|
| Archive inventory and Markdown review | PASS | All 15 Markdown files and source files in the supplied archive were reviewed. |
| Root/backend/frontend path migration | PASS (source inspection) | No `frontend/server/` or `frontend/bun.lock`; backend sources and workspace manifest are under root `backend/`. |
| JSON manifests/config parsing | PASS (Node JSON.parse) | Root/frontend/backend manifests, tsconfigs, Vercel config and manifest JSON were parsed after the final source edits. |
| Vercel Bun runtime setting | PASS (official-doc check) | `vercel.json` uses the documented `bunVersion: "1.x"`; Vercel manages minor/patch versions while CI remains pinned to Bun 1.4.4. Preview compatibility remains pending. |
| TypeScript syntax transpilation | PASS (TypeScript 5.8.3) | Follow-up check covered 82 project `.ts`/`.tsx` files; zero syntax/transformation diagnostics. This is not a full project semantic check. |
| Bun 1.4.4 frozen install | PASS (user-reported) | User ran `bun install` and `bun install --frozen-lockfile` from repository root with Bun 1.4.4; both reported 90 installs checked and no changes. |
| Repository policy | PASS (user Bun 1.4.4 + Node reproduction) | User confirmed `bun run check:policy` passes on the corrected archive. The Bun 1.4.4 root-name workaround changes only `bun.lock.workspaces[""].name`; dependency snapshots match all three manifests. The policy script was also transpiled and run under Node against this follow-up tree: PASS. |
| Node/TypeScript compatibility tests | PASS: 144 / 144 | Ran Bun-style tests through Node 22 + the installed TypeScript transpiler and a `bun:test` compatibility shim. Excluded `PlayerWheel.test.ts` (React package unavailable) and `backend/tests/routes.test.ts` (Elysia package unavailable); this is not the Bun runner. |
| Targeted TypeScript semantic checks | PASS (limited) | Global TypeScript 5.8.3 checked the changed frontend AI-provider module using minimal project stubs and the full backend source using temporary Node/Elysia declaration shims. The shims are not a substitute for the pinned workspace typecheck with actual dependency types. |
| Native Oxlint / full workspace TypeScript / Bun tests / Vite build | PENDING | Bun, Oxlint, and workspace `node_modules` are unavailable in this authoring environment. The user-provided run showed warnings but no lint errors and then failed TypeScript; this archive addresses every reported warning/error. The complete native pipeline still needs rerunning. |
| Vercel Preview / shared limiter / provider smoke | BLOCKED | Requires Vercel and Redis-compatible service credentials, provider account keys, and operator configuration. |
| Browser/device, WCAG, offline, performance acceptance | OPEN | Requires real browsers/devices and evidence capture. |

The latest user-provided Bun 1.4.4 run confirmed frozen installation and repository policy passed, and lint completed with warnings/no errors. Frontend typecheck then failed with `TS2379` at three optional-signal fetch sites and `TS7053` for the `category` member in the curated fallback kind map. This follow-up archive fixes those issues and removes the logged lint warnings. Targeted checks after the fixes: 82-file TypeScript syntax transpilation (0 diagnostics), frontend AI-provider semantic check (temporary dependency stubs), full backend source semantic check (temporary Node/Elysia shims), repository policy check, and backend runtime schema/control-character smoke tests all passed. The exact Bun 1.4.4 `bun run check` has not yet been rerun on this follow-up archive.

The prior 102-test Bun run refers to an earlier snapshot. The 144-test Node/TypeScript compatibility run is the pre-screenshot-fix baseline and excluded the two dependency-bound test files listed above; it must not be represented as a Bun CI pass or as covering the new screenshot-fix tests. The screenshot follow-up has separate targeted Node smoke coverage for the updated provider adapter, with the added TEST-AI-026–028 cases still requiring the Bun test runner. No live deployment or monetary budget cap is claimed.


### Follow-up from user screenshots — theme contrast and provider response format

- Fixed `.hero h1` to use an explicit light foreground on its fixed dark hero background. This prevents `.app.light { --text: #1b1c20 }` from producing nearly-black text on the dark hero.
- Fixed `.resume-banner` primary text and strengthened its secondary text color so the saved-session action remains readable in either theme.
- Cloudflare now uses the official OpenAI-compatible Chat Completions endpoint for GPT-OSS. The request includes the task JSON Schema in the system prompt and uses low reasoning effort; the server continues to validate every returned item. This avoids depending on Workers AI JSON Mode for GPT-OSS, which is absent from the current published support matrix.
- The Cloudflare response parser accepts direct and wrapped `choices[].message.content` string/text-part arrays, GPT-OSS Responses-style `output_text` and `output[].content[].text` during endpoint migration, and the native REST structured-object envelope. Every format remains subject to strict generated-content validation. Empty, refused, and truncated results map to provider-specific safe errors.
- Added safe, actionable diagnostics for Gemini prompt blocks, Gemini/Groq output truncation, and empty content responses.
- Targeted Node 22 smoke tests passed for direct Cloudflare Chat Completions, wrapped `result.choices`, native structured-object output, GPT-OSS Responses-style `output_text` and output blocks, truncation diagnostics, Gemini text extraction, and Gemini safety-block diagnostics. TypeScript syntax transpilation passed for 80 source/test files; strict backend provider-module semantic checking passed with a minimal Node crypto declaration shim; CSS contrast assertions passed (hero title 16.16:1, resume title 14.41:1, resume subtitle 9.53:1, resume action 13.26:1). Full user-side Bun pipeline and live provider calls remain pending.

### Historical deployment note (before root backend migration)

- The earlier layout placed the Elysia server under the frontend package; that path was superseded by the current root `backend/` workspace.
- Vercel Bun Functions and the Elysia default-export contract remain the selected initial host pattern. The current runtime config uses `bunVersion: "1.x"`, not the earlier invalid `1.4.x` value; see `docs/phase-5-deployment.md`.
- Cloudflare Workers AI remains the final pinned provider fallback, with all operator credentials configured only as server-side secrets. Deployment, WAF/edge controls, usage budgets, and live provider tests still require operator access.

### Additional source coverage

- AI category metadata generation uses a dedicated response schema. Tests cover name/description/emoji validation, duplicate rejection, stable ASCII/non-Latin slug generation, strict Gemini schema required fields, and category metadata response parsing. Shared-store readiness now probes Lua `EVAL` permission.
- Settings now supports Imposter `Category metadata` generation, selection, editing, associated word generation, and saving the metadata plus words in one local custom pack. The category response schema requires name, description, and a pictographic emoji; deterministic ID generation also handles non-Latin category names. Stored content items retain the selected category ID for category filtering and no-repeat history.
- No curated/offline category-metadata fabrication was added. Existing bundled/manual category packs remain the offline path.
- The `144/144` compatibility result used Node 22's test runner, TypeScript's transpiler, and a small `bun:test` assertion shim. It is useful regression evidence, but it is not the pinned Bun 1.4.4 test command or Elysia route integration.


**Baseline:** 2026-11-04  
**Purpose:** Define how requirements are demonstrated. This is a plan, not a claim that verification has already been run. The full user-supplied Mystery Who report is archived at `docs/references/mystery-who-full-report.md`; earlier entries that say its local rules were unavailable are historical snapshots superseded by the report-based sections below. Online-mode details in that report are out of scope.

## 1. Evidence rules

For each verification activity, record:

- Verification ID and requirement/task IDs.
- Build commit and Bun version.
- Operating system, browser/version, viewport, and device class where relevant.
- Exact Bun command(s) used, or exact manual steps.
- Expected result and observed result.
- Pass/fail/blocked status, date, reviewer, and evidence link (CI run, screenshot, trace, report, or sanitized log).
- Known limitations and follow-up task IDs.

Never write “passed” based on code inspection alone. Do not include API keys, user prompts, player disclosures, or personal data in evidence artifacts.

## 2. Verification matrix

| Verification ID | Scope | Requirement coverage | Method / exit condition |
|---|---|---|---|
| VERIFY-SETUP-001 | Architecture and tool compatibility | NFR-MAINT-001, NFR-MAINT-002 | Official-source review, dependency decision log, Bun CLI compatibility proof. |
| VERIFY-SETUP-002 | Project bootstrap | FR-PORTAL-001, NFR-MAINT-002 | Clean checkout + Bun install + build + test; one Bun lockfile only. |
| VERIFY-SETUP-003 | CI gates | NFR-MAINT-001, NFR-MAINT-002 | CI runs on pinned Bun; repository policy, frozen-lockfile install, lint, typecheck, tests, and production build must pass. Dependency/secret/license audits are not yet wired into CI. |
| VERIFY-CORE-001 | Contracts and transitions | FR-IMP-002, FR-GUESS-001, FR-TD-002, FR-NHIE-001 | Runtime schema validation and state-machine transition tests. |
| VERIFY-RNG-001 | Cryptographic RNG | FR-CONTENT-003 | Code inspection + unit/property tests for rejection sampling and bounded integer. |
| VERIFY-RNG-002 | No-repeat policy | FR-CONTENT-002 to FR-CONTENT-004 | Exhaustive small-pool/property tests and larger simulation; fallback behavior observed. |
| VERIFY-CONTENT-001 | Content integrity and rights | FR-CONTENT-001, FR-CONTENT-005 | Metadata audit, canonical duplicate scan, provenance/license review. |
| VERIFY-STOR-001 | IndexedDB durability | NFR-STOR-001 | Start game, commit actions, refresh/reopen, confirm exact snapshot restoration. |
| VERIFY-STOR-002 | Migration/recovery | NFR-STOR-002 | Migrate fixtures from each supported prior version; corrupted data recovery preserves source. |
| VERIFY-STOR-003 | Multi-tab | NFR-STOR-004 | Two tabs modify one session; stale revision is detected and surfaced. |
| VERIFY-OFF-001 | Offline/PWA | NFR-OFF-001, NFR-OFF-002 | First cache online, go offline, reload, play from curated packs, verify AI disabled gracefully. |
| VERIFY-UI-001 | Shared design system | FR-PORTAL-002, NFR-UX-001 | Visual review across four games; consistent interaction primitives and differentiated identity. |
| VERIFY-A11Y-001 | Component accessibility | NFR-A11Y-001 to NFR-A11Y-003 | Automated audit + keyboard, screen reader, zoom, contrast, reduced-motion manual checks. |
| VERIFY-A11Y-002 | Release accessibility | NFR-A11Y-001 | Whole-app WCAG 2.2 AA review; findings triaged and evidence attached. |
| VERIFY-PERF-001 | UI animation | NFR-PERF-002 | Profile representative animations on mid-range/low-end devices and CPU throttling. |
| VERIFY-PERF-002 | Production performance | NFR-PERF-001, NFR-PERF-003 | Build analysis, cold/warm network runs, route/chunk budgets, interaction latency. |
| VERIFY-IMP-001 | Mystery Who local rules | FR-IMP-001 to FR-IMP-011, FR-IMP-017 | Domain tests for modes, role allocation, hints, timer defaults, ballots, Mr. White threshold/guess, and explicitly undefined rules. |
| VERIFY-IMP-002 | Imposter UX | FR-IMP-003 | Observe private handoff in portrait/landscape and with screen-reader/keyboard use. |
| VERIFY-IMP-003 | Imposter categories and word history | FR-IMP-012 to FR-IMP-014 | 30 category packs, uniform category-first selection, custom-pack import/export, normalized last-10 history, duplicate and exhaustion tests. |
| VERIFY-IMP-004 | Imposter persistence and offline | FR-IMP-015, FR-IMP-016 | Dark-mode/settings/session persistence, offline full-round, and Gemini-to-local-fallback tests. |
| VERIFY-IMP-005 | Mystery Who report-based implementation | Supplied local gameplay report | Targeted domain/content tests and source review; browser/device acceptance remains pending. |
| VERIFY-GUESS-001 | GuessUp logic | FR-GUESS-001, FR-GUESS-005 | Deck, score, timer, duplicate event, and reload tests. |
| VERIFY-GUESS-002 | GuessUp controls | FR-GUESS-002 to FR-GUESS-004 | Manual sensor available/denied/unsupported tests; button-only completion. |
| VERIFY-TD-001 | Truth or Dare logic | FR-TD-001 to FR-TD-004 | Player choice persisted before animation; skip/replace/opt-out tests. |
| VERIFY-TD-002 | Wheel UX | FR-TD-002 | Verify selected player matches pointer; test reduced motion and variable roster. |
| VERIFY-NHIE-001 | I Have Never logic | FR-NHIE-001 to FR-NHIE-004 | Prompt cycle, response, skip, custom pack, and resume tests. |
| VERIFY-NHIE-002 | I Have Never UX | FR-NHIE-002 | Confirm neutral play is default; no mandatory alcohol-related action. |
| VERIFY-PLAY-001 | Video-derived gameplay UX | FR-PLAY-001 to FR-PLAY-009 | Complete visual/interaction walkthrough for all four recordings' target flows; responsive/reduced-motion/accessibility acceptance. |
| VERIFY-QUEUE-001 | Adaptive no-repeat queues | FR-CONTENT-003 to FR-CONTENT-008 | Formula unit tests, per-game/category isolation, LLM request payload audit, exhaustion/duplicate tests. |
| VERIFY-BACKEND-001 | Public Elysia API deployment | FR-AI-009 to FR-AI-013; NFR-SEC-007/008 | Deployment smoke, secrets/log redaction, CORS/abuse/rate/budget controls, kill switch, provider fallback. |

| VERIFY-AI-001 | Provider currency | FR-AI-003, FR-AI-008 | Current official docs/account console for IDs, API method, price, quotas, regions, params. |
| VERIFY-AI-002 | Elysia API security and reliability | FR-AI-009, FR-AI-011, NFR-SEC-004, NFR-SEC-005 | CORS/schema/size/rate-limit tests, timeout/retry/circuit breaker/budget tests. |
| VERIFY-AI-003 | Adapter/schema/safety | FR-AI-002, FR-AI-004 | Mock provider contract tests; adversarial/invalid outputs rejected. |
| VERIFY-AI-004 | BYOK UX/fallback | FR-AI-001, FR-AI-006, FR-AI-008, FR-AI-010, NFR-SEC-008 | Provider reorder/toggle/key modal, consent, request-only key handling, log redaction, snackbar fallback, offline fallback. |
| VERIFY-SEC-001 | Security review | NFR-SEC-001 to NFR-SEC-006 | Secret scan, bundle inspection, CSP/CORS review, abuse cases, storage/log audit. |
| VERIFY-RELEASE-001 | Release rehearsal | NFR-STOR-002, NFR-OFF-001, NFR-MAINT-001 | Clean install, update, rollback, SW cache update, offline resume, migration rehearsal. |

### Mystery Who local rules evidence matrix

| Parity item | Behavior specified by supplied report | Remaining verification / open question | Linked requirements/tests |
|---|---|---|---|
| Mode and roster | 3–20 players; Classic / Mystics / Chaos | Browser acceptance of setup boundaries | FR-IMP-001, FR-IMP-004; TEST-IMP-010 |
| Mystic assignment | 3–5: 1; 6–10: 2; 11–15: 3; 16–20: 4; preserve a Civilian | Full device/browser round matrix | FR-IMP-005, FR-IMP-006; TEST-IMP-011 |
| Reveal and private handoff | Immediate reveal on pointer/key down with a 260 ms flip; conceal on release/cancel/focus loss/hidden tab; gated next-player handoff | Touch, keyboard, screen-reader and interruption acceptance | FR-IMP-003; TEST-IMP-022 |
| Hints and clue flow | Optional; same or different hints; Mr. White receives none | Report describes 20 hints/entry; current bundle has four shared category-safe hints per answer. Word-specific hint authoring and QA remain open | FR-IMP-006/007; TEST-IMP-048 |
| Timer and discussion | Off by default; 180 s default; 15–600 s in 15 s steps; discussion only | Browser timer/expiry/resume acceptance | FR-IMP-008; TEST-IMP-012 |
| Voting | Sequential ballot selects exactly ordinary Mystic count; skip/self-vote; duplicates rejected | Browser handoff and invalid-action acceptance | FR-IMP-009; TEST-IMP-013 |
| Resolution | Mr. White threshold after all ballots; one normalized exact-word guess; results expose roles/tally | Civilian/Mystic elimination/win rules and detailed tie/no-vote transitions are not defined by report | FR-IMP-010/011/017; TEST-IMP-014 |
| Troll Mode | Mentioned in a reference recording, not specified in the report | Effects and activation rules unknown; do not implement without details | FR-IMP-017; TEST-IMP-015 |
| Categories | 30 named categories; multiple selected categories are combined; category selected before word | Current source has 1,800 answers (60/category); semantic suitability/clue QA remains | FR-IMP-012/013; TEST-IMP-053/056 |
| Word repetition | Last 10 normalized words excluded globally across categories; no silent repeat | Browser persistence/exhaustion acceptance | FR-IMP-014; TEST-IMP-017/018 |
| Persistence/offline | Local preferences/content/history and offline bundled content | Browser offline and reload/resume acceptance | FR-IMP-015; TEST-IMP-019/021 |
| AI content | Optional generated categories/words/hints with local fallback | Not implemented; use the approved secure Elysia/Bun provider gateway; historical model IDs in the report are not production defaults | FR-IMP-016; TEST-IMP-020 |
| Special roles | Classic: no Mr. White; Mystics: exactly one; Chaos: 45% chance at 4+ players | Browser role privacy and final-guess acceptance | FR-IMP-004/006/010; TEST-IMP-023 |
| Online-only features | Explicitly excluded | Ensure none are prerequisites or accidentally included | TEST-IMP-025 |

**Rules status:** The supplied report resolves the local game modes, roles, reveal, timer, voting, Mr. White threshold, categories, custom packs, and word-history behavior. Source-level implementation and domain regression tests are present; full Bun CI and browser/device acceptance remain pending. Troll Mode effects and elimination/win/tie details remain open because the report does not define them. UI/UX may use suitable third-party libraries, but documented gameplay behavior and privacy boundaries may not be changed.

### Phase 0–1 execution record (2026-11-03)

The user explicitly confirmed: **“all checks passed correctly.”** Record this as a user-reported PASS for the completed Phase 0–1 foundation checks. The user did not provide raw command output, CI URLs, exact OS/browser versions, or Bun version in this turn, so those details are intentionally not fabricated.

| ID | Evidence recorded | Result | Remaining note |
|---|---|---|---|
| VERIFY-SETUP-001 | User confirmation that Phase 0 checks passed; architecture and Bun-only policy are documented. | PASS (user-confirmed) | Attach CI/command evidence if available during release audit. |
| VERIFY-SETUP-002 | User confirmation that Phase 0 checks passed; package manifest, Bun lockfile, scripts, and TypeScript configuration are present. | PASS (user-confirmed) | Exact runtime/version details not supplied. |
| VERIFY-SETUP-003 | User confirmation that Phase 0 checks passed; CI workflow and repository policy checks are present. | PASS (user-confirmed) | Hosted CI URL not supplied. |
| VERIFY-CORE-001 | User confirmation that Phase 1 checks passed; contracts and runtime validators are present. | PASS (user-confirmed) | Report-derived Imposter state-machine tests were subsequently added; see `tests.md` and the Phase 4 evidence below. |
| VERIFY-RNG-001 | User confirmation that Phase 1 checks passed; Web Crypto rejection sampling and Fisher–Yates are present. | PASS (user-confirmed) | Browser matrix verification remains part of release testing. |
| VERIFY-RNG-002 | User confirmation that Phase 1 checks passed; player selection and deck-cycle logic are present. | PASS (user-confirmed) | The subsequently supplied report confirms a global rolling last-10 word exclusion across categories; see the report-based requirements and tests. |
| VERIFY-CONTENT-001 | User confirmation that Phase 1 checks passed; seed catalogue and canonicalization are present. | PASS (user-confirmed) | Report-based content count and duplicate audits were added later; human semantic clue-quality review remains pending. |


## 3. Test environment matrix

Record actual version numbers when running tests; do not write “latest” as the test environment.

| Dimension | Minimum coverage |
|---|---|
| Mobile browser | Current supported iOS Safari and Android Chrome at test time. |
| Desktop browser | Current supported Chromium-based browser, Firefox, and Safari/WebKit where available. |
| Viewports | Small phone, large phone, tablet portrait/landscape, laptop, desktop. |
| Device performance | Representative mid-range phone and a constrained/low-end profile. |
| Network | Online broadband, mobile/slow profile, offline, intermittent failure. |
| Storage | Normal, quota nearly full, blocked/unavailable, private browsing where testable. |
| Motion | Default motion and `prefers-reduced-motion`. |
| Input | Touch, keyboard, mouse; sensor available, denied, and unsupported. |

## 4. Manual game scripts

### 4.1 Imposter — VERIFY-IMP-001 / VERIFY-IMP-002

1. Configure the smallest permitted roster and start a round.
2. Confirm Civilian receives category + word, Mystic receives category + optional hint(s), and Mr. White receives category only (Mystics mode/Chaos only).
3. Reload after assignment but before the first reveal. Confirm the same assignments remain.
4. Reveal each player with the pass-and-play handoff. Confirm prior private content is masked before the next reveal.
5. Submit ballots with exactly the ordinary Mystic count; test self-vote, Skip Vote, duplicate/invalid targets, Mr. White threshold after all ballots, and normalized final guess.
6. Complete the round, review the result, and start the next round. Confirm a new valid assignment occurs only then.

### 4.1A Mystery Who report-based local flow — VERIFY-IMP-001 / VERIFY-IMP-003 / VERIFY-IMP-004

1. Configure 3, 5, 6, 10, 11, 15, 16, and 20 players; verify ordinary Mystic counts 1, 1, 2, 2, 3, 3, 4, and 4, preserving at least one Civilian. Confirm 2 and 21 are rejected.
2. Test Classic (no Mr. White), Mystics (exactly one Mr. White), and Chaos (one to three Mystics; 45% Mr. White chance at four or more players).
3. Verify Civilian category + word, Mystic category + optional hints, and Mr. White category only. Test hints disabled, same hint, and different hints.
4. Press each reveal and confirm the flip begins immediately; release early, release after reveal, cancel pointer, lose focus, and test keyboard handoff. Prior private information must be masked before next player.
5. Test discussion timer off by default, 180-second default, 15–600 second bounds and 15-second increments. Confirm it starts only on discussion and advances to voting or results on expiry.
6. Test multi-target ballot count, self-voting, skip, duplicate targets, invalid targets, out-of-turn voting, and incomplete ballot sets.
7. After all ballots, verify Mr. White threshold is ceil(total submitted target selections / 2), then test one final normalized exact-word guess.
8. Verify result word/category/roles/tally/hints/guess outcome; hidden-voter mode must suppress voter identity while retaining roles and tallies.
9. Select multiple built-in/custom categories; verify uniform category-first selection, then word selection within category. Verify custom category name/emoji/description, word + hints, JSON/TXT import/export, and CRUD.
10. Select at least 11 distinct words across rounds; verify last-10 normalized exclusion across categories. Exhaust a small custom pool and confirm explicit exhaustion rather than silent repetition.
11. Reload/close/reopen during every phase; confirm roles, word, ballots, timer deadline, settings, and history restore locally. Cache the app and complete a full round offline.
12. Troll Mode effects and civilian/mystic elimination/win rules are not specified in the supplied report; do not implement or test invented behavior. Optional AI category generation remains pending the secure provider gateway.
13. Confirm no online lobby, host, chat/voice, matchmaking, or synchronized voting dependency exists.

### 4.2 GuessUp — VERIFY-GUESS-001 / VERIFY-GUESS-002

1. Configure teams and a short round.
2. Complete a round using only Correct/Pass buttons.
3. Rapidly tap Correct twice and confirm one score event is committed.
4. Test tilt permission on a supported device; deny permission and repeat using buttons.
5. Reload during a round and verify current card, deck position, score, and remaining time reconciliation.

### 4.3 Truth or Dare — VERIFY-TD-001 / VERIFY-TD-002

1. Start with a small and then a large roster; include long player names.
2. Confirm the selection is written to state before the wheel begins animating.
3. Reload during the wheel animation; verify it resumes to the same selected player.
4. Select truth and dare paths, skip/replace a prompt, and opt out.
5. Enable reduced motion and verify selection remains clear without a long animation.

### 4.4 I Have Never — VERIFY-NHIE-001 / VERIFY-NHIE-002

1. Start a curated pack using the neutral default response method.
2. Answer/advance several prompts; skip one prompt.
3. Reload mid-round and verify current prompt and progress.
4. Create a custom pack, validate its items, reopen it, edit it, and delete it.
5. Confirm no action requires alcohol consumption or disclosure of sensitive information.

## 5. Security and privacy verification

- Inspect production browser bundle and source maps for provider keys, tokens, and secrets.
- Instrument the app to detect writes to localStorage, IndexedDB, Cache API, logs, telemetry, and traces; enter a dummy BYOK key and confirm it appears nowhere persistent or observable.
- Confirm Elysia API request logs redact BYOK authorization/provider-key headers and do not include raw prompt/response bodies.
- Send malformed JSON, oversized input, wrong task IDs, unexpected model IDs, bad origin, script/HTML payloads, and repeated bursts. Confirm controlled rejection and no reflected unsafe output.
- Simulate provider 401, 403, 429, 5xx, timeout, malformed JSON, empty output, and invalid schema. Confirm bounded behavior and curated fallback only according to user preference.
- Verify CSP and CORS are narrow and justified. CORS is not authentication; do not rely on CORS alone to protect the public Elysia API routes.
- Inspect service-worker cache keys and contents. No BYOK, provider request, private game state, or authenticated response may be cached.
- Review dependency advisories, licenses, maintenance state, and deprecation notices at release time.

## 6. Performance verification

1. Build production assets using the documented Bun script.
2. Record route and chunk sizes, compression, and initial request waterfall.
3. Test first visit and repeat visit with a cold and warm cache.
4. Profile card reveal, GuessUp card transition, Truth-or-Dare wheel, and prompt changes.
5. Repeat on a representative mid-range/low-end device and with CPU/network throttling.
6. Record long tasks, dropped frames, input delay, layout shifts, and memory behavior.
7. Reduce decorative work or split code where measurements exceed the agreed budget.

Do not claim a universal 60 FPS result. Record device, browser, test conditions, observed result, and the project's threshold.

## 7. Verification record template

Copy this block for every verification run:

```text
Verification ID:
Requirement IDs:
Task IDs:
Commit:
Date/time:
Bun version/revision:
OS:
Browser/device/viewport:
Network/storage/motion/input conditions:
Commands or manual steps:
Expected result:
Observed result:
Status: PASS | FAIL | BLOCKED | NOT RUN
Evidence links:
Defects/follow-up task IDs:
Reviewer:
```

## 8. Current baseline research notes

The provider/backend review was refreshed on 2026-11-04. This is an architecture check, not an implementation or account-access verification. Recheck before deployment.

- Elysia describes itself as a TypeScript backend framework optimized for Bun and supports Web Standard request/response integration: <https://elysiajs.com/quick-start>.
- Cloudflare Workers AI's REST guide requires an Account ID and API token. The model-run API is `POST /accounts/{account_id}/ai/run/{model_name}`; model IDs and token permissions still need a deployment-time check: <https://developers.cloudflare.com/workers-ai/get-started/rest-api/> and <https://developers.cloudflare.com/api/resources/ai/methods/run/>.
- Cloudflare publishes task/model rate limits separately; quotas and billing must be checked against the deployment account: <https://developers.cloudflare.com/workers-ai/platform/limits/>.
- Gemini's API-key documentation describes standard and authorization key types and the current key transition; use the selected API's official current authentication guidance: <https://ai.google.dev/gemini-api/docs/generate-content/api-key>.
- Gemini content generation and structured-output schema support are described in the API reference: <https://ai.google.dev/api/generate-content>.
- Groq's API reference currently documents the chat-completions endpoint and schema: <https://console.groq.com/docs/api-reference> and <https://console.groq.com/docs/text-chat>.
- No model ID, billing assumption, or free-tier claim is locked by this documentation-only update. Provider-specific availability, free quotas, costs, region, limits, and parameter support are NOT VERIFIED for the project account.


## 9. Follow-up verification — App.tsx strict TypeScript fixes

- **Input evidence:** user-provided `bun run check` output dated 2026-11-03.
- **Changes:** removed unused `roundClock` state; copied `result.recentPlayerIds` with `[...result.recentPlayerIds]` to satisfy the mutable `string[]` persistence contract; removed the unused player-list map index.
- **Expected result:** the three reported TypeScript diagnostics (`TS6198`, `TS4104`, `TS6133`) are addressed in source.
- **Local verification status:** BLOCKED. This execution environment has no Bun executable and the extracted `node_modules` directory contains no installed packages/binaries. A fallback global `tsc -b` could not resolve `vite/client` or `node` type definitions. No claim is made that lint, tests, or build pass.
- **Required next step:** run `bun install --frozen-lockfile` and `bun run check` in the user's Bun 1.4.4 environment; record the complete output and resolve any remaining diagnostics.


## Phase 2 implementation status (2026-11-03)

Code now provides IndexedDB database version 2 and snapshot schema version 2, a version-1 snapshot migration, atomic snapshot/session/round/history writes, revision compare-and-swap, BroadcastChannel conflict notification, custom-pack storage APIs, backup export, and a service-worker shell/asset cache. The implementation is awaiting user-run Bun checks and browser integration verification.

**Required browser exercise before marking Phase 2 complete:**
1. Open the app online, start a game, advance several actions, refresh, and verify the exact phase/data is restored.
2. Close and reopen the browser; verify players, history, preferences, and active session remain.
3. In DevTools Application → IndexedDB, inspect `appState`, `sessions`, `rounds`, `history`, and `customPacks`; confirm schema version and monotonically increasing revisions.
4. Open two tabs. Commit a state change in tab A, then attempt a stale state change in tab B. Tab B must display a conflict and must not overwrite tab A.
5. Simulate quota/storage denial and blocked database access. The app must display a warning and must not claim the save is durable.
6. With the app cached once, switch DevTools Network to Offline and reload. Confirm app shell and all four curated games remain usable.
7. Confirm no `/api` request or non-GET request appears in Cache Storage.
8. Deploy/update a new service-worker cache version and confirm old King-Fun caches are removed without deleting unrelated caches.

**Current evidence:** implementation is present in source; runtime/browser outcomes are NOT RUN. The previous Phase 1 command output is user-supplied evidence only and does not verify these new changes.

## Phase 2.1 — UI/interaction verification status

Implementation is present in source. The Bun pipeline and real-browser/device checks have not yet been run for this milestone. Verify the home-to-setup splash, Imposter hold-to-reveal card, keyboard fallback, and reduced-motion behavior on desktop and touch devices.


## 10. Phase 2.2 — home player and game component split
- Source-level structure: `App.tsx` is the HomePage component; `AppShell.tsx` owns navigation, shared state, and persistence.
- Game implementations are separated into `games/ImposterGame.tsx`, `GuessUpGame.tsx`, `TruthOrDareGame.tsx`, and `NeverHaveIEverGame.tsx`. Setup/history/settings are separate screen components.


## Phase 2.3 — Remove external music integration

- Removed the Free To Use API integration and vinyl player component/styles.
- Added a local CSS-only animated game-night illustration with four game tokens orbiting a glowing die.
- Rebuilt hero layout rules around a two-column desktop composition and a stacked mobile composition.
- Added reduced-motion handling; the illustration makes no network requests and requires no audio permissions.
- Static source checks and archive integrity are the only validations performed for this phase; full Bun checks and browser/device tests remain pending.

## Phase 2.3.1 — Header navigation and theme control

- Updated the header to use icon-only History and Settings controls, with accessible names and a history-count badge.
- Rebuilt the theme switch as a centered, non-shrinking circular control with animated SVG sun/moon glyphs.
- Added mobile and narrow-mobile sizing rules for the brand, navigation spacing, and controls.
- Static source review: pending final archive validation.
- Bun lint/typecheck/test/build: not run in this environment; run `bun run check` in `frontend`.
- Browser viewport/device testing: not run in this environment.


## Phase 3.0 — UI foundation source verification
- Added the standard `mobile-web-app-capable` metadata while retaining the Apple-specific meta tag.
- Confirmed home game tiles use native `<button>` elements instead of custom button-role articles.
- Confirmed skip navigation, focusable main-content target, polite toast live region, shared design tokens, and reduced-motion/contrast media preferences are present.
- Not verified: Bun lint/typecheck/tests/build, keyboard-only browser exercise, screen-reader behavior, viewport/orientation matrix, and low-end-device performance.


## Phase 3.1 — Shared UI component implementation evidence

- Added `ConfirmDialog` backed by native `<dialog>.showModal()`. Native modal semantics provide browser focus containment and restoration; Escape is handled as a cancel action, and backdrop clicks dismiss without invoking the destructive action.
- Replaced all remaining `window.confirm()` calls in `AppShell.tsx` with the shared dialog for game exit, history deletion, custom-pack deletion, and local-data reset.
- Added and integrated `ProgressBar`, `CountdownDisplay`, `ChoiceButton`, `PromptCard`, `EmptyState`, and `StatusPanel`.
- Added `ui-utils.test.ts` with cases for progress clamping and duration formatting. Tests were not executed in this environment because Bun and project dependencies were unavailable.
- `tsc -b` was attempted with global TypeScript 5.8.3; it stopped before project checking because `vite/client` and `node` type definitions are unavailable without the project install.
- Still required: `bun install --frozen-lockfile`, `bun run check`, browser test matrix at 320/360/390/768/1024/1440px, keyboard-only dialog/focus checks, screen-reader checks, 200% zoom, orientation/safe-area checks, and low-end-device animation profiling.

**Phase 3 status:** implementation complete; release verification pending. No browser, screen-reader, performance, or full Bun pipeline pass is claimed.


### Phase 3.0.1 follow-up
- Fixed the reported missing `formatDuration` import in `GuessUpGame.tsx`. The symbol is exported by `components/ui/ui-utils.ts`. Re-run `bun run check` to verify the complete pipeline.


## Phase 4.0 evidence — provisional Imposter slice (historical pre-report snapshot)

- **Status at the time:** IMPLEMENTED / EXECUTION PENDING / REFERENCE NOT YET SUPPLIED. Superseded by the report-based local rules matrix and 2026-11-04 report implementation records below.
- **Changes inspected:** `domain/games/imposter.ts`, its Bun test file, `games/ImposterGame.tsx`, and Imposter initialization in `AppShell.tsx`.
- **Implemented behavior:** 3–20 player validation; 1/2/3/4 Mystic bands; one reveal-order entry per player; private role handoff; one sequential vote or skip per player; self-voting; invalid/duplicate/out-of-turn rejection; unique-leader/tie/no-vote tally; rolling last-10 exclusion for the shipped Imposter word pool with an explicit exhausted state.
- **Not verified:** Bun lint/typecheck/tests/build, IndexedDB refresh/resume behavior, multi-tab races, screen-reader behavior, and browser/device interaction.
- **Historical blocker:** The report had not yet been supplied when this entry was recorded. It was subsequently received and archived at `docs/references/mystery-who-full-report.md`. The report now defines local modes/roles, hints, timer, voting, Mr. White threshold, categories, custom packs, and repeat history. Troll Mode and elimination/win/tie victory rules remain undefined by that report.


## Phase 4.0.1 patch verification
- Confirmed `currentPlayerId` is checked before indexing `data.roles`.
- Confirmed an absent role renders `UNAVAILABLE`, disables the reveal button, and does not disclose `data.word`.
- Full Bun lint/typecheck/test/build remains pending in the project environment.


## Phase 4.1 — Imposter reveal and voting hardening

- Fixed the broken role-card geometry: `.role-card-inner` is now block-level with explicit full-width/full-height sizing, so positioned 3D faces use the whole card instead of collapsing to the inline span's text width.
- Rebuilt the reveal card CSS with fixed aspect behavior, responsive desktop/mobile dimensions, matching card-face geometry, and a stable 3D transform context.
- Added an explicit viewed-before-handoff gate; each player must reveal their role once before the pass-phone action is enabled. Release, pointer cancel, lost pointer capture, keyboard key-up, and blur conceal the role again.
- Added screen-reader state announcements and hides the inactive card face from the accessibility tree.
- Added private-vote progress and a selected-player confirmation action.
- Hardened vote-state validation for unknown/duplicate voters, overlap between votes and skips, invalid targets, invalid voter indexes, and incomplete voting before resolution.
- Category label now derives from the selected content item's category ID instead of always being hardcoded to `Everyday`.
- Added Bun domain tests for vote progress, invalid/corrupt snapshots, and incomplete resolution.
- Not run in this environment: `bun run check`, browser interaction on real/touch devices, screen-reader verification, refresh/resume tests. CSS syntax and TSX syntax checks are performed separately and recorded with the release artifact.
- This is a historical pre-report note. The supplied report now defines local special roles, hints, timer, and category behavior; Troll Mode and elimination/win/tie resolution remain undefined and must not be invented.


## Phase 4.1 — multi-game slice extension

- Added `domain/games/guessup.ts` with validated two-team round creation, alternating roster split, Correct/Pass scoring, Team A-to-Team B handoff, and terminal round transition.
- GuessUp now shuffles the bundled word deck at round creation and persists team rosters, scores, deck position, remaining seconds, and active team in the existing local active snapshot. Team assignment is automatic/alternating by roster order in this slice; an editable team-assignment setup remains open.
- GuessUp timer expiry transitions Team A to a handoff screen and Team B to a final winner/tie screen. Tilt/sensor controls are not implemented; buttons remain the supported fallback.
- Truth or Dare now has a penalty-free opt-out that returns to player selection. The Next turn action preserves the turn/opt-out counters instead of dropping them.
- I Have Never now separates explicit statement skips from response counts and states that no drinking or penalty is required.
- Added `guessup.test.ts`; domain smoke tests are performed as part of this authoring validation, but the Bun runner is not available.
- Full `bun run check`, browser test, offline resume verification, screen-reader checks, and touch-device timing have not been executed.


## Phase 4.1.1 — authoring validation

- Fixed the screenshot-reported Imposter card collapse: the card uses a block-level inner wrapper and full-size block-level faces inside a responsive fixed-size button. The previous inline-span shrink-to-content cause is removed.
- Added safe fallbacks for missing Imposter order/role/vote/skip/word values. Invalid vote progress is displayed as a blocking integrity error; the component does not continue the vote flow.
- Vote-domain validation now requires `voter === votes.length + skip.length` in addition to unique participant IDs and valid targets.
- GuessUp rejects duplicate/empty player IDs, invalid result values, scores beyond the end of the current deck, and repeated completion. Deck exhaustion no longer wraps within a team's turn; Team B restarts the same shuffled sequence from card one for a fair comparison.
- Expanded built-in prompt pools with original local entries and unique stable IDs.
- Authoring validation: all 41 TS/TSX files passed TypeScript syntax transpilation; strict standalone typecheck of Imposter/GuessUp domain modules and their test files passed; all 3 CSS files parsed with PostCSS; Imposter and GuessUp domain test files were executed through a Node compatibility harness (16 passed / 0 failed; this is not the Bun runner); separate domain runtime smoke checks passed; all 122 bundled content IDs are unique and pack references resolve; `content/seed.test.ts` now guards those conditions and minimum pool sizes. Current pool counts are 30 Imposter / 48 GuessUp / 12 Truth / 12 Dare / 20 I Have Never.
- Not executed: `bun run check`, full application build, interactive browser tests, real touch-device role reveal, keyboard/screen-reader verification, and IndexedDB refresh/resume. Do not treat syntax/domain checks as a full project pass.


## 10. User-supplied gameplay-video review — 2026-11-04

The four recordings were opened and reviewed as visual interaction references. Their durations and observed flows are recorded below. They are not source-code/rules evidence for hidden mechanics.

| Reference | Duration | Review outcome | Implementation status |
|---|---:|---|---|
| `285208.mp4` — Imposter | 90.7 s | Setup cards, roster editor, category picker, impostor count, timer/hint/Troll Mode controls, and colorful hold-to-reveal private role cards with player handoff observed. | Interaction target documented; report-defined Mystery Who local rules have since been captured; browser UX/privacy acceptance remains pending. |
| `285207.mp4` — Truth or Dare | 78.5 s | Pack selection, player roulette, Truth/Dare selection, full-size prompt card, reactions, report dialog, next-player sequence and settings observed. | Source implementation present for pack modes, roulette, prompt/reaction/report flow; browser/device acceptance pending. |
| `285210.mp4` — GuessUp | 91.9 s | Deck filters/selection, duration/input settings, team mode/setup, ready countdown, prompt card and timed charades flow observed. | Source implementation present for deck browser, editable teams, ready/countdown and timed charades; browser/device acceptance pending. |
| `285209.mp4` — I Have Never | 71.6 s | All-together, wheel and one-at-a-time modes; player selection, large statement prompt, reactions and next/skip flow observed. | Source implementation present for the three modes, responses, reactions and next/skip flow; browser/device acceptance pending. |

The recordings show monetization, ads, premium banners, and online options. These are explicitly excluded by the King-Fun product decisions. The target is feature/interaction inspiration, not a pixel-level or asset-level clone. The full written design is `docs/gameplay-reference.md`.

## 10A. Adaptive player-queue migration status

The approved player-window policy has changed from the historical fixed last-three exclusion to the adaptive formula `n >= 4 ? max(1, Math.round((n / 2) - 1)) : 0`. The inspected source `frontend/src/domain/random/selection.ts` still declares `recentWindow = 3`, and `frontend/src/domain/random/random.test.ts` still contains a fixed-three behavior test. Therefore the formula is documented and test-planned, but **not implemented in the current source baseline**. `TASK-AI-005` must update the selector API/call sites and tests before `VERIFY-QUEUE-001` can pass.

## 11. Provider routing, backend, and queues — specification review

**Status:** DOCUMENTED / NOT IMPLEMENTED / NOT DEPLOYED.

- Provider order target: Gemini (off/key-required), Groq (off/key-required), Cloudflare Workers AI (always active, pinned last, no gear/toggle).
- Gemini/Groq rows are drag-reorderable; key-entry modal unlocks the toggle but does not enable it. BYOK keys are session-memory only and passed through the public Elysia API for one request.
- Public backend target: Elysia + Bun under `backend/`, sharing the existing frontend package and single Bun lockfile. No conventional DBMS and no server-side game state.
- Cloudflare Workers AI uses server-only Account ID/API token/model config. The public endpoint requires exact CORS, edge/IP rate limiting, budgets, output/time/body/concurrency limits, structured errors, log redaction, and a kill switch.
- Fallback target: active providers are attempted in the round-snapshotted user order; every failed attempt is surfaced as a safe snackbar; Cloudflare runs last; local content is the offline fallback.
- Queue target: player/category formulas and per-game/category/item-kind/locale content windows are in `docs/ai-provider-routing.md`; LLM gets only the matching exclusion queue and is asked for five new items. Application validation remains authoritative.
- No source code or hosted backend was changed in this documentation update. No API credential, endpoint, provider model, or cost has been verified for the project's account.

### Manual verification to execute after implementation

1. Enter dummy keys and confirm no key value appears in app state snapshots, IndexedDB, localStorage, backups, service-worker caches, server logs, reverse-proxy logs, traces, or error responses.
2. Confirm Gemini/Groq start disabled; toggles are disabled with no key; settings icon opens the key dialog; saving unlocks but does not enable; removing a key disables immediately.
3. Drag Gemini and Groq through every ordering; confirm keyboard Move up/Move down produces the same list order and Cloudflare remains pinned last.
4. Begin a round with Gemini enabled before Groq, then change provider order mid-round; confirm active-round order remains frozen and next round uses the changed order.
5. Simulate Gemini 401, 429, timeout, 5xx, malformed JSON, unsafe output, and duplicates; confirm a safe snackbar and transition to Groq, then Cloudflare, then local pack where necessary.
6. Make Cloudflare backend unavailable and confirm UI does not claim it succeeded; curated local content remains playable.
7. Send malformed, oversized, wrong-provider, wrong-task, arbitrary-model, and arbitrary-URL requests directly to the public API; all must be rejected without provider execution.
8. Simulate rate spikes, multiple API instances, budget exhaustion, and kill switch; verify edge-level controls, not just process-local limits.
9. Verify player/category formulas for 3–10 players/categories and confirm each game's queues are independent.
10. Inspect every LLM request fixture and confirm it contains only relevant game/category/item-kind/locale queue data, no player names or secret game state, and asks for five novel items.
11. Verify exact/canonical duplicate and current-round duplicate rejection even if the LLM ignores its exclusion instruction.
12. Confirm Imposter's last-10-word rule remains effective and its history scope is not changed without Mystery Who source evidence.



## Phase 4.2 — source implementation review and authoring checks (2026-11-04)

- **Status:** REPORT-DEFINED LOCAL RULES IMPLEMENTED IN SOURCE / TARGETED CHECKS RECORDED / BUN AND BROWSER ACCEPTANCE PENDING / REPORT-UNDEFINED MECHANICS HELD OPEN.
- **Code review:** inspected the game setup and active loops for all four games, app-shell state transitions/persistence wiring, game-specific domain modules, content selection, wheel geometry, prompt reporting/reactions, responsive CSS, and new test sources.
- **Implemented source:** GuessUp editable team names/assignments, configurable 30/45/60/90/120-second rounds, 3–2–1 readiness, deadline-based timer reconciliation, Correct/Pass scoring, team handoff and result, optional original synthesized background music/SFX/vibration/tilt; Truth or Dare and I Have Never each have All together / Spin the wheel / One at a time modes, local pack/suitability selection, wheel persistence/landing, prompt/response flows, reactions, skip/replace/opt-out where applicable, and explicit exhaustion; player roster and custom pack CRUD; local prompt reports; strict recent/current-round content exclusion; Imposter reveal masking and pass-phone gating.
- **Syntax checks:** all current `.ts`/`.tsx` source and test files were transpiled with the globally installed TypeScript transpiler without syntax diagnostics. This is a syntax parse only, not a semantic typecheck.
- **Style checks:** `frontend/src/App.css` and `frontend/src/index.css` parsed with PostCSS without syntax errors.
- **Domain typecheck:** a targeted strict TypeScript check passed for the new/changed framework-independent Phase 4 domain modules and their focused tests (including exact optional properties and unchecked-index checks). This does not cover the full React/Vite application.
- **Domain smoke checks:** Node 22 type-stripping smoke tests passed for GuessUp explicit team assignment, deadline reconciliation/expiry, scoring and team transition; strict content deduplication/exclusion/FIFO history; I Have Never response validation/points; and roulette segment landing geometry. These are focused smoke checks, not the Bun test suite.
- **Bun toolchain:** `bun run check` was **not run** because Bun and the project dependencies are not installed in this authoring environment. `oxlint` is also unavailable. `tsc -b` was attempted but cannot resolve `vite/client` and `node` type packages without installing the frozen project dependencies; no full semantic typecheck is claimed.
- **Browser/device:** no interactive browser was available for mobile/desktop flows, reload/resume, IndexedDB quota/transaction faults, touch, keyboard, screen reader, device-orientation permission, synthesized audio playback, or `prefers-reduced-motion`. These remain pending.
- **Mystery Who local rules:** The supplied report resolves modes, role boundaries, hint/timer/voting settings, Mr. White threshold, categories, custom packs and repeat-history behavior. Source implementation and targeted tests are present. Troll Mode effects and civilian/mystic elimination/win/tie transitions remain undefined by the report; full Bun and browser/device acceptance remain pending.
- **Scope:** Phase 5 AI/provider backend and adaptive player/category queues were not implemented in this Phase 4 pass; Phase 6 release hardening remains out of scope.

| ID | Evidence recorded | Result | Remaining note |
|---|---|---|---|
| VERIFY-PLAY-001 | Source review of responsive play surfaces, mode flows, roulette, report/reaction, countdown, content exhaustion, and reduced-motion CSS; syntax/domain smoke checks. | PARTIAL | Browser/device, accessibility, reload/resume, and full test-runner evidence remain pending. |
| VERIFY-GUESS-003 | Source review plus Node smoke tests for team validation, configured deadlines, expiry, scoring, and handoff. | PARTIAL | Bun tests, audio/sensor permission, and browser timer/resume acceptance remain pending. |
| VERIFY-TD-003 | Source review of setup, pack filters, modes, saved wheel outcome, prompt flows, and report/reaction actions. | PENDING | Bun and browser interaction/reload/reduced-motion acceptance not run. |
| VERIFY-NHIE-003 | Source review and Node smoke test for one-response-per-player validation, neutral methods, private response display, and points. | PARTIAL | Bun and browser group-flow, wheel-resume, and persistence acceptance not run. |
| VERIFY-IMP-001 | 20 Imposter domain tests, 3 seed tests, 3 canonicalization tests, source review of modes/roles/hints/timer/ballots/Mr. White results. | PARTIAL | Full Bun CI and browser/device acceptance pending; Troll Mode and unspecified elimination/win/tie rules remain open. |

## 2026-11-04 — Phase 4 build-log remediation

### User-provided failure evidence
- The uploaded `bun run check` log showed repository policy passing.
- Oxlint reported 14 warnings and 0 lint errors. The reported diagnostics covered an unused/re-exported roulette helper in `PlayerWheel`, render-time ref access in `PlayerWheel` and `GuessUpGame`, synchronous state updates in effects in `SetupScreen` and `GuessUpGame`, a React Compiler memoization warning in `AppShell`, impure `Date.now()` render expressions in `AppShell`, and incomplete effect dependencies.
- TypeScript then stopped with `TS6133` for the unused `wheelAngleForPlayer` import in `PlayerWheel.tsx`; tests and the production build were not reached by that run.

### Source remediation
- Removed the unused roulette import and the mixed component/helper export; the domain helper remains in `domain/games/roulette.ts` and existing tests import it from there.
- Replaced the wheel's render-time ref state with the `durationMs` prop.
- Derived selected/valid pack IDs and effective player-team assignments without synchronizing duplicate state in effects. GuessUp settings now update through controlled persisted preferences.
- Moved the GuessUp tilt handler ref write into an effect and derived tilt activation from the saved input mode.
- Moved wheel remaining-time calculation out of JSX render into an effect-backed duration state, and corrected the wheel and ready-countdown effect dependency lists.
- Corrected the over-escaped asset path in `public/sw.js`; the previous regex literal was invalid JavaScript and would prevent service-worker installation.

### Verification performed after remediation
- **TypeScript/TSX syntax:** all 50 source and test `.ts`/`.tsx` files transpiled with the globally installed TypeScript transpiler with 0 syntax/transpile diagnostics.
- **Service worker / CSS syntax:** `node --check public/sw.js` passes; PostCSS successfully parsed `App.css`, `index.css`, and `hero-motion.css`.
- **Semantic typecheck:** attempted `tsc -b`; it could not resolve `vite/client` and `node` type definitions because the project dependencies are not installed in this environment. No full semantic typecheck is claimed.
- **Oxlint / Bun tests / Vite build:** not rerun because Bun, Oxlint, Vite, and the project dependency installation are unavailable in this environment. The user-provided log is the pre-fix result, not evidence of a post-fix lint pass.
- **Browser/device:** not run. Wheel restore timing, setup interactions, device orientation, touch/keyboard access, reduced motion, and mobile/desktop layouts still require manual browser validation.

## 2026-11-04 — Zero-warning follow-up (user-provided 2-warning run)

- **Input evidence:** the latest user-supplied `bun run check` output reports repository policy passing, 2 Oxlint warnings and 0 lint errors, `tsc -b` passing, 58 tests passing (656 assertions), and the Vite production build passing. The only remaining diagnostics in that run are the unstable `markCard` effect dependency in `GuessUpGame.tsx` and React Compiler's `preserve-manual-memoization` warning for `patchActive` in `AppShell.tsx`.
- **Source changes:** `playFeedback` and `markCard` are now memoized with their actual data dependencies; the tilt event listener directly uses the current `markCard` callback and declares it as an effect dependency, removing the callback-ref synchronization effect. The active-session update logic is extracted into the pure `patchActiveSave` helper and `patchActive` explicitly declares the stable `setSave` setter dependency.
- **Local validation:** source assertions confirm the stale `markCardRef` bridge is removed, the tilt effect tracks `markCard`, and the active-session callback uses the extracted helper with its setter dependency. Global `tsc -b` was attempted but cannot resolve `vite/client` or `node` definitions without project dependencies.
- **Not claimed:** no post-edit Oxlint run or full `bun run check` was possible in this environment because Bun/Oxlint and project dependencies are not installed, and external package downloads are unavailable. Therefore zero warnings are the implementation target, not a newly observed tool result. The user should run `bun run check` with the repository's pinned Bun toolchain to confirm the post-edit result.

## 2026-11-04 — Final React Compiler warning remediation

- The latest user-provided `bun run check` log showed exactly one remaining Oxlint warning: `react(preserve-manual-memoization)` on the manually memoized `patchActive` callback in `AppShell.tsx`. The same run completed TypeScript checking, all 58 tests (656 assertions), and the production build successfully.
- Removed the manual `useCallback` from `patchActive` and moved the wheel/countdown effects to functional state updates using the pure `patchActiveSave` helper. Added active-snapshot identity checks to prevent stale timer callbacks from modifying a different session.
- Post-edit Oxlint, TypeScript, tests, and Vite build have not been executed in this environment; this entry records the source change, not a passing verification claim. Re-run `bun run check` with the repository's pinned Bun toolchain to confirm the warning is gone and all gates remain green.


## 2026-11-04 — Mystery Who report implementation

- **Source of truth:** Read the complete user-provided Mystery Who report. Its local rules supersede earlier uncertainty; online-mode material was intentionally excluded.
- **Implemented:** Classic/Mystics/Chaos; Civilian/Mystic/Mr. White role boundaries; Mystic count bands; 650 ms press-and-hold reveal and handoff; hint enabled/same/different settings; discussion-only timer; voting enable/disable; sequential multi-target ballots, self-vote, skip and validation; Mr. White threshold after all ballots and normalized exact guess; results with roles/tally/hints/hidden-voter behavior; 30 category packs with uniform category-first selection; emoji-enabled custom word/hint packs and JSON/TXT import/export; persisted Imposter preferences; normalized last-10 word and stable-ID exclusion.
- **Content gap:** 600 curated word entries across 30 category packs with four category-level hints per word. The report specifies 60 entries/category (1,800 total); this remains open for human content curation.
- **Unspecified source behavior:** Troll Mode effects, civilian/mystic elimination and win conditions, and detailed tie/no-vote transitions are not defined in the report and remain explicitly unimplemented.
- **Targeted checks executed:** strict standalone TypeScript typecheck passed for domain/content/contracts; a temporary React declaration shim allowed a structural frontend typecheck (not official project typecheck); all 51 TS/TSX files passed syntax transpilation; Node 22 compatibility harness executed 20 Imposter domain tests, 3 seed tests, and 3 canonicalization tests (26 passed); CSS parsed; service worker syntax passed; canonical duplicate scan reports zero duplicates.
- **Not run:** Bun/Oxlint/full `bun run check`, Vite production build, and real browser/device acceptance. Bun and project dependencies are not installed in this authoring environment. No full CI pass is claimed.


## 2026-11-04 — Mystery Who local implementation hardening (historical intermediate source snapshot; superseded)

- Read the complete user-supplied Mystery Who report; the report-derived local rules are persisted in `docs/mystery-who-local-reference.md`. The report's online mode was excluded.
- Hardened local game creation: unique normalized player names, 3–20 roster bound, Mystic band validation, Chaos role constraints, validated RNG, and no-answer-leaking Mystic hints.
- Hardened voting: valid 3–20 saved roster, exactly the configured number of unique targets, legacy single-target compatibility only for one-Mystic rounds, sequential turn-order snapshots, explicit skip integrity, and validated Mr. White threshold calculations.
- Added adaptive category cooldown selection with oldest/FIFO category handling; it may relax only if every eligible category is cooling down. Global last-10 stable-ID and normalized-text exclusions remain hard exclusions. Per-category word history is also enforced. Category history now moves a reused category to the newest position when cooldown is relaxed.
- Added custom-pack parser/validator coverage: 2–100 unique secret words; 1–20 distinct non-empty hints; 240-character bounds; no hint may equal the answer; JSON/TXT import validation. Setup copy explains the exact word/hint format.
- Expanded the bundled content to 1,800 concrete answers (60 per each of 30 categories). A project canonicalization scan initially detected Doormat/Door mat; one entry was replaced with Door chain. The final canonical duplicate scan reports zero duplicate answer strings.
- **Executed:** Node 22 compatibility harness for `imposter.test.ts`, `imposter-pack.test.ts`, `seed.test.ts`, and `random.test.ts`: 28 passed / 0 failed. Standalone strict TypeScript check passed for Imposter domain, pack parser, adaptive selection, seed, and category files. TypeScript transpilation scan passed for all 55 `.ts`/`.tsx` source/test files with 0 syntax diagnostics.
- **Not executed:** `bun run check`, Oxlint, full Bun test suite, Vite production build, Playwright/browser, mobile device, screen-reader, or offline-refresh acceptance. Bun and installed frontend dependencies are not available in this authoring container. Do not describe this snapshot as CI-passing.
- **Known content gap:** each bundled answer currently receives four shared category-safe hints. Custom packs support the report's 1–20 hints per answer. Twenty distinct, word-specific hints for every built-in answer require further human content authoring/QA; no generic filler hints were generated.
- **Known feature gap:** optional AI category generation/provider routing remains separate Phase 5 work per `docs/ai-provider-routing.md`; it must use the server-side Elysia/Bun gateway rather than browser-exposed credentials. Troll Mode effects and faction elimination/win rules remain undefined by the report and are intentionally not guessed.


## 2026-11-04 — Mystery Who continuation: current source snapshot

- **Content:** 30 built-in Imposter category packs, 60 entries each, 1,800 total unique answers. Seed tests now validate all four game IDs and all 30 Imposter packs; a canonicalizer check finds no duplicate answer text. Bundled content still provides four shared category-safe hints per answer, not 20 word-specific hints.
- **Rules:** local report-based roles/modes/count bands, hint privacy, 650 ms press/hold reveal, discussion-only clock, multi-target sequential ballots, skip/self-vote, validated Mr. White threshold and exact normalized guess, result disclosure/hidden-voter mode. Online mode is excluded.
- **Integrity:** normalized unique player names; reject answer-revealing hints including punctuation/phrase matches; validate custom JSON/TXT packs (2–100 words, 1–20 distinct nonempty hints, bounded text); reject malformed, out-of-turn, wrong-size, duplicate-target and unknown-player ballots; reject invalid saved vote cursors. Runtime hint validation also caps clues at 20, canonicalizes duplicates, and catches the answer token sequence embedded in longer hints.
- **Queues:** adaptive player window used by production roulette; Imposter category cooldown and FIFO; strict global normalized last-10 word exclusion and per-category histories; other games retain per-game/category/kind/locale recent queues and per-round seen/finite deck handling.
- **Settings UX:** removed controls that implied an AI provider/endpoint was connected when no gateway exists. Settings now state that AI generation is unavailable and no keys are requested/stored. The gateway itself remains separate Phase 5 work.
- **Executed:** Node 22 `bun:test` compatibility harness for every `.test.ts` file: **86 passed / 0 failed**; strict standalone TypeScript check for Imposter domain/parser/selection/seed/shared contracts; TypeScript syntax transpilation for all 54 TS/TSX source files (0 diagnostics); PostCSS parse for `App.css`, `index.css`, `hero-motion.css`; `node --check public/sw.js`.
- **Not executed:** actual Bun runner, Oxlint, whole-project `tsc -b`, Vite production build, Playwright/browser, mobile device, keyboard/screen-reader, and offline-refresh acceptance. Bun and the project's dependencies are unavailable here. Do not treat the compatibility harness or syntax scan as a substitute for `bun run check`.
- **Open:** AI backend/provider adapters and model fallback; word-specific twenty-hint authoring per built-in answer; human content-quality review; report-undefined Troll/elimination/win rules; and official Bun/browser acceptance.


## 2026-11-04 — Full Mystery Who report archived and project documents synchronized

- **Source reviewed:** the complete user-supplied 977-line `MYSTERY WHO? Game Architecture, Gameplay & Feature Analysis Report`, package `mystery-whos`, version 1.0.1.
- **Archived:** verbatim copy added at `docs/references/mystery-who-full-report.md`; the concise local-only extraction is `docs/mystery-who-local-reference.md`.
- **Scope decision:** the report's online rooms, online player limits, host/relay architecture, remote role delivery, online voting, reconnection, and chat/voice material are explicitly excluded from King-Fun. Only local pass-and-play rules inform Imposter.
- **Documents synchronized:** `README.md`, `instructions.md`, `requirements.md`, `todo.md`, `checklist.md`, `tests.md`, `verification.md`, `changelog.md`, `docs/gameplay-reference.md`, `docs/ai-provider-routing.md`, and `frontend/README.md`.
- **Rule details captured:** Civilian/Mystic/Mr. White information boundaries; Classic/Mystics/Chaos; roster and Mystic-count bands; Chaos 45% Mr. White chance at 4+ players; hint on/off and shared/distinct hints; 650 ms press-and-hold reveal; discussion-only timer defaults/range; exact multi-target sequential voting; Mr. White threshold and normalized exact guess; results/voter privacy; 30 named categories; manual/AI custom categories; and global last-10 word exclusion.
- **Open items retained:** 20 distinct word-specific hints per built-in answer (current content has four shared category-safe hints); semantic answer/clue quality review; optional AI generation through the approved secure backend; browser/device acceptance; and mechanics the report does not define (Troll Mode, faction elimination/win, and tie/no-vote victory resolution).
- **UI/UX dependency policy:** documented owner permission for Bun-managed React component/accessibility libraries, motion packages, and icon packs, subject to maintenance, license, React/Vite/Bun compatibility, accessibility, and bundle review.
- **Repository repair:** restored `tests.md` from the clean project test catalogue after detecting repeated status text had expanded the working copy to 34 MB.
- **Verification performed in this documentation pass:** Markdown files and the archived report were inspected; report archive content was copied verbatim. No application source code was changed and no Bun test/build/lint command was run as part of this documentation update.


## 2026-11-04 — Latest user build-log remediation

| Reported diagnostic | Remediation | Post-fix tool result |
|---|---|---|
| `imposter.test.ts`: 3 unused `max` callback parameters | Use `() => 0` deterministic index providers | Oxlint not rerun locally |
| `AppShell.tsx`: `imposterPreferences` explicitly assigned `undefined` | Normalize setup; conditionally spread optional save property | Semantic typecheck not rerun locally |
| `AppShell.tsx`: optional config fields passed as explicit `undefined` | Pass a complete normalized `ImposterSetup` to the round factory | Semantic typecheck not rerun locally |
| `ImposterGame.tsx`: `setupSnapshot` missing from `ImposterRoundState` | Type the app-level metadata as an optional intersection at the UI boundary | Semantic typecheck not rerun locally |

The supplied run reports 3 lint warnings, 0 lint errors, then 4 TypeScript errors; tests and production build were not reached. Source changes address each listed diagnostic without relaxing compiler settings. A post-fix `bun run check` remains required to establish a clean lint, typecheck, test, and build result.

### Additional local validation for this remediation
- Global TypeScript transpilation: **54 TS/TSX files, 0 syntax diagnostics**.
- Standalone strict TypeScript regression check passed for the exact changed type patterns (`GameSetup` preference normalization, full `ImposterOptions`, and conditional writes to optional `Save` properties) with `strict` and `exactOptionalPropertyTypes` enabled.
- A full project `tsc -b` command was attempted but stops at missing `vite/client` and `node` type definitions. No project-wide typecheck, Oxlint, Bun test, or Vite build pass is claimed.


## 2026-11-04 — Phase 2/3 persistence, PWA, and UI completion pass

### Source changes
- Added bounded normalization for imported/restored application saves: player IDs/names, recent queues, 30-day/100-entry history, active JSON state, GuessUp/Imposter preference ranges, theme, and motion preference are validated before entering runtime state.
- Hardened IndexedDB snapshot shape/timestamp/revision/schema validation; added backup envelope validation, bounded custom-pack count/content totals, duplicate ID checks, memory-only export, atomic restore across the five stores, and an explicit post-confirmation force-reset path for corrupt/unreadable storage.
- Storage failures now switch the app to truthful memory-only mode. Users can continue the current tab, export its live state, retry persistence without discarding in-memory custom packs, and deliberately reset corrupt data only after confirmation.
- Legacy `localStorage` is read only for the `party-portal-v1` migration and removed only after the IndexedDB source of truth is available.
- Vite now emits `precache-manifest.json` for every hashed runtime JS/CSS/font/image asset. At the Phase 2/3 final baseline, service worker v4 validated the manifest and pre-cached lazy game chunks, limited additional runtime caching without evicting precached assets, excluded API/external/non-GET requests, supported offline navigation fallback, and removed only stale King-Fun cache versions. The later KING-FUN branding update bumped the current worker to v5 and pre-caches all logo derivatives.
- Phase 3 polish includes system/in-app reduced motion, root theme/color-scheme/theme-color synchronization, 100dvh sizing, 44px narrow-screen header targets, forced-colors focus styling, dynamic page titles, focus-on-screen-change, semantic main labeling, lazy-loaded game components, and a recoverable screen error boundary. External font requests have been removed; system font stacks keep the UI available offline.
- No additional UI package was added: native HTML/dialog and the current shared primitives met the audited needs without adding bundle weight or another runtime dependency. The owner-approved package policy remains in effect for future justified additions.

### Automated/static validation actually performed in this environment
- `public/sw.js` passed `node --check`.
- Node 22 VM-based service-worker integration smoke passed: precache manifest and lazy chunks; cache version cleanup; unrelated cache preservation; API and non-GET exclusion; runtime cache bound; offline navigation fallback.
- Global TypeScript transpilation parsed **57 TS/TSX files with zero syntax diagnostics**.
- CSS parsing and complete project semantic typecheck/Bun/Oxlint/Vite build have not been executed because Bun, Oxlint, Vite, React, and the project dependency installation are unavailable in this environment. Do not treat syntax transpilation as semantic typechecking.

### Outstanding acceptance (not claimed as passed)
- Bun 1.4.4 `bun run check` on a clean frozen-lockfile install.
- Real IndexedDB tests for migration, quota/storage denial, blocked open, atomic rollback, backup round trip, force-reset recovery, and two-tab race/conflict behavior.
- Real production browser test of first-install precache and offline launch of each lazy-loaded game, service-worker update lifecycle, and deep-link navigation.
- Keyboard-only dialog/focus checks, screen reader announcement and modal focus tests, WCAG 2.2 AA review, 200% zoom, 320–1440px viewport/orientation/safe-area matrix, forced-colors, and OS/in-app reduced-motion behavior.
- Representative low/mid-range device performance profiling and a measured production chunk/asset budget.

**Phase status:** Phase 2 and Phase 3 source implementations are complete to the extent testable in this environment. Their browser/device/assistive-technology and full Bun CI exit criteria remain pending; no release sign-off is claimed.


## 2026-11-04 — Phase 2/3 recovery and cache-isolation hardening

- Changed memory-only storage retry from individual custom-pack upserts to a single validated read-write replacement transaction. The persisted custom-pack set now exactly matches the in-memory set, so packs deleted during an outage do not reappear after recovery. The full collection is bounded to 200 packs / 5,000 content items and duplicate IDs are rejected before opening IndexedDB.
- Hardened confirmed erase: normal revision-CAS reset waits for queued writes; on a storage failure it switches to an explicit recovery path, attempts the confirmed force-reset, clears the visible in-memory state, and reports clearly if durable erasure remains impossible. A genuine multi-tab revision conflict is not force-overwritten.
- Scoped service-worker static asset and offline-shell reads to the active `king-fun-shell-v4` cache instead of global `caches.match()`. Same-origin cache entries owned by another app cannot be served to King-Fun. Updated service-worker regression fixtures to v4 and added a cross-cache isolation test.
- Corrected the duplicate section number in `instructions.md` so correctness/privacy/security is §2.6 after the new §2.4 persistence and §2.5 accessibility policies.

### Executed checks after these changes
- Global TypeScript 5.8 transpilation parsed **58 TS/TSX files** (including `vite.config.ts`) with zero syntax diagnostics. This is syntax parsing, not the TypeScript 7 project typecheck.
- PostCSS parsed all **3 application CSS files** successfully.
- `node --check frontend/public/sw.js` passed.
- A targeted strict TypeScript 5.8 check passed for `portal-storage.ts` and its shared validation/contract/ID dependencies with `--strict` and DOM/ES2023 libraries.
- A Node 22 compatibility runner executed the changed save-normalization, storage-contract/backup and service-worker test files: **21 passed, 0 failed**. This is not Bun's test runner and does not replace `bun test`.
- A separate Node 22 VM-based service-worker integration smoke passed: manifest and lazy chunk precache, v4 namespace cleanup, unrelated-cache preservation, API/external/non-GET exclusion, runtime-cache bound, unrelated-cache isolation, and offline navigation fallback.
- All **13 Markdown documents** passed the relative-link check; required Phase 2/3 requirement/test/changelog markers were checked after the final documentation updates.

Bun, Oxlint, the installed project dependencies, Vite, and real browser storage/device/assistive-technology verification remain unavailable in this environment. The full project pipeline and IndexedDB/browser acceptance matrix are not claimed as passed.


## 2026-11-04 — ScreenErrorBoundary TS4114 remediation

### User-reported pre-fix pipeline
- Repository policy: passed.
- Oxlint: **0 warnings, 0 errors**.
- TypeScript: three TS4114 errors in `frontend/src/components/ui/ScreenErrorBoundary.tsx`: `state`, `componentDidCatch`, and `render` override members of `React.Component` without `override`.
- Tests/build were not reached because typecheck failed.

### Change
- Added `override` to the three reported members. This is the exact type-safety correction required by the configured `noImplicitOverride` check.
- No rule, compiler option, test, or warning check was disabled. No runtime behavior changed.

### Verification status
- Static source assertions confirm all three inherited members now carry `override`.
- A full post-fix `bun run check` has not been executed in this authoring environment. Run the complete command after extracting this archive to confirm TypeScript, all tests, and the production build.

## 2026-11-04 — Phase 4 final source pass and incremental hardening

### User-provided full Bun verification (previous 102-test snapshot)
- The user supplied a complete `bun run check` log with Bun 1.4.2.
- Repository policy passed.
- Oxlint reported **0 warnings and 0 errors** across 59 files.
- `tsc -b` passed.
- Bun tests passed: **102 passed, 0 failed**, 11,673 expectations across 14 files.
- `vite build` passed (61 modules transformed).

### Changes after that user-provided run
- GuessUp device-orientation listener now remains attached across countdown/card/timer rerenders and invokes the latest scoring callback through an effect-updated ref. It does not repeatedly re-register on each second/card update.
- Tilt controls now expose an explicit enable/disable toggle. Touch Correct/Pass remains complete and always available; the neutral-band hysteresis remains required before each sensor action.
- Mystery Who JSON/TXT file imports are rejected above 1 MiB before `File.text()` is called. A new domain test covers boundary and invalid byte lengths.
- Prompt reports remain bounded to 50 during the active game, are retained in local completed history, and do not advance/score; game roster snapshots remain isolated from later global roster changes.
- Reconciled Phase 4 docs/checklist/backlog to mark source-delivered behavior separately from remaining manual acceptance and report-defined content/spec gaps.

### Current-source verification in this authoring environment
- TypeScript transpile syntax check: **60 TS/TSX files, 0 syntax/transpile diagnostics**.
- Node 22 compatibility harness executed the current source test files: **111 passed, 0 failed**. This is a compatibility runner/shim, not the official Bun test runner.
- `node --check frontend/public/sw.js`: passed.
- The complete user-provided Bun run proves the previous 102-test snapshot passed, but the latest added import-size test and final tilt-control changes were not rerun through Bun here. Re-run `bun run check` on the exact final archive.

### Phase 4 source status and residual acceptance
- Source implementation is complete for all defined local game flows and report-defined Mystery Who rules. Evidence and case links are maintained in `todo.md`, `checklist.md`, and `tests.md`.
- Browser/device acceptance remains pending: 320–1440px viewport matrix, landscape/safe-area/virtual keyboard, keyboard-only and screen-reader operation, private reveal on touch/cancel/blur/visibility loss, reduced-motion, wheel interruption/reload, timer resume, actual orientation permission/disable behavior, audio/haptics fallback, and full-round end-to-end tests.
- Mystery Who bundled content remains 1,800 answers/30 categories with four shared category-safe hints per answer. Twenty distinct word-specific hints per answer and human semantic review remain an authoring task; no generic filler has been added.
- Troll Mode behavior and elimination/faction victory/tie/no-vote rules remain unimplemented because the supplied Mystery Who report does not specify them. Optional AI generation remains Phase 5 and online play remains excluded.

| ID | Evidence recorded | Result | Remaining note |
|---|---|---|---|
| VERIFY-PLAY-001 | Source walkthrough and current regression suite, including 111 Node compatibility tests; requirements and UI behavior reconciled. | PARTIAL | Full Bun rerun of current source plus browser/accessibility/device acceptance. |
| VERIFY-GUESS-003 | GuessUp domain tests and tilt hysteresis tests run in Node compatibility harness; listener lifecycle and disable control reviewed in source. | PARTIAL | Bun rerun, actual sensor permission/device scenarios, and refresh/timer browser acceptance. |
| VERIFY-TD-003 | Source and domain coverage for modes, roulette geometry, prompt actions, report/reaction state. | PARTIAL | Bun rerun, reload/animation/long-name responsive browser acceptance. |
| VERIFY-NHIE-003 | Source/domain coverage for group response integrity, neutral modes, points, skip, and saved state. | PARTIAL | Bun rerun and real-browser flow/privacy acceptance. |
| VERIFY-IMP-005 | Report-derived rules, 1,800-entry/30-category catalogue, custom pack parser and repeat protection covered by current source and domain tests. | PARTIAL | Bun rerun, browser privacy/handoff/offline acceptance, and the 20-word-specific-hints content-authoring gap. |




### Final archive integrity checks
- All 13 Markdown files were scanned for broken relative links: 0 found.
- The archived Mystery Who reference SHA-256 matches the supplied report exactly.
- The current project uses one Bun lockfile (`bun.lock`); no secondary package-manager lockfile is included.
- Historical Phase 4.0/4.1 checklist snapshots are labeled as historical; current Phase 4 status is maintained in the current Phase 4 section.


## 2026-11-04 branding and dual Truth/Dare wheel update

Source-level checks added: generic two-segment roulette geometry tests; service-worker cache assertions for all four supplied-logo derivatives; manifest/index metadata updated to KING-FUN; worker cache namespace bumped to v5. The player and Truth/Dare spin outcomes are committed before CSS animation. The manual Truth/Dare choice path remains wired to the original callbacks. Node 22 static/geometry smoke checks, TypeScript/TSX syntax transpilation, CSS parsing, service-worker syntax and PWA asset assertions passed for this update. A fresh full Bun pipeline and physical-device visual acceptance have not yet been executed.


## 2026-11-04 — KING-FUN logo and Truth/Dare wheels

- The user-supplied SVG is preserved byte-for-byte at `docs/branding/king-fun-logo-source.svg`. Header/favicon use optimized transparent PNGs; PWA/app manifest and Apple touch icon use 192px and 512px padded-background PNGs. The service-worker namespace is v5 and pre-caches all four logo derivatives.
- Truth/Dare now presents a separate two-segment challenge wheel in the choice phase. The player wheel remains the first decision in Spin the wheel mode. The existing manual buttons remain available and invoke the prior direct-choice path.
- Roulette geometry and Truth/Dare index mapping have deterministic tests. Node 22 geometry smoke checks passed; full Bun/Oxlint/typecheck/build and a real-browser interaction run were not available in this environment.


## Phase 5 verification status — 2026-11-05

Source files and deployment configuration have been added, but the complete verification gate is **not passed**. The user verified `bun install --frozen-lockfile` on Bun 1.4.4. The previous policy failure was the stale root workspace name metadata caused by Bun issue #47656; the corrected archive changes that metadata only, with all workspace dependency snapshots retained. The post-fix Oxlint, semantic TypeScript, Bun tests, and production build must still be run. Live Gemini/Groq/Cloudflare calls, Vercel deployment, Cloudflare edge rate limits, usage alerts, and secret-redaction behavior require operator credentials/account access and remain unverified. Do not advertise Phase 5 as production-ready until these gates pass.


### Phase 5 authoring-environment checks — 2026-11-05

- TypeScript/TSX syntax transpilation: 73 files, 0 syntax diagnostics (TypeScript transpile-only check; not semantic typechecking).
- AI request/output schema smoke: 5 assertions passed.
- Imposter word-hint validation smoke: 3 assertions passed (exactly 20 distinct hints and answer-substring rejection).
- Gemini/Groq adapter mock smoke: 2 successful parsing cases; Cloudflare missing-credential guard passed.
- Markdown relative links: 14 files, 0 broken links.
- `package.json`, `vercel.json`, and `.env.example` parse/structure checks passed.
- Full `bun run check` was **not run** in the authoring environment. The user later confirmed that Bun 1.4.4 accepts both normal and frozen installs. Bun retained the old root workspace name despite the dependency snapshots matching; this is a reproduced upstream issue (#47656). The corrected archive manually updates only that metadata field. Run `bun install --frozen-lockfile` and `bun run check` against this corrected archive.


### User-run Bun 1.4.4 verification and follow-up fixes — 2026-11-05

The user executed the corrected root-workspace archive on Windows with Bun 1.4.4. Observed results:

- `bun install --frozen-lockfile`: PASS.
- `bun run check:policy`: PASS; output confirmed the root Bun 1.4.4 workspace, one root lockfile, root backend, and Bun-only CI.
- Frontend/backend Oxlint: completed with warnings and no errors. Warnings were the mutable GuessUp music-step counter and intentional control-character regexes in backend request/content validation.
- Frontend TypeScript project check: FAIL with `TS2379` for optional `AbortSignal | undefined` passed to exact-optional `RequestInit.signal` at the status, provider-test, and generation fetches, plus `TS7053` for indexing the non-category kind map with `AiItemKind` (which also includes `category`).

Follow-up source corrections in this archive:

- Use `signal: signal ?? null` at all three fetch sites.
- Narrow the item-kind through a stable local binding before indexing the non-category map; retain the explicit no-offline-category error.
- Derive the GuessUp synthesized note index from monotonic elapsed time, removing the mutable closure counter.
- Use a shared `hasControlCharacters` utility in backend input/output/credential validation instead of the lint-flagged regexes. Add direct unit tests and a request-schema regression case.

**Status: FIX APPLIED, TARGETED CHECKS PASSED, NATIVE RERUN PENDING.** This authoring environment has Node 22 and global TypeScript 5.8.3 but does not have Bun, Oxlint, installed workspace dependencies, or registry DNS. The fixes have not been represented as a passed native Bun typecheck/lint/test/build run. Rerun, from the extracted repository root on Bun 1.4.4: `bun install --frozen-lockfile` followed by `bun run check`.

## 2026-11-06 — UI finish and reusable component source review

### Source changes

- Added `frontend/src/components/ui/Icon.tsx` and `GameMark.tsx` as shared named SVG primitives and game-ID icon mapping.
- Updated primary home/navigation/setup/pack/wheel surfaces to use named icons rather than decorative glyphs or emoji. Legacy pack emoji remains in the data schema/import/export for backward compatibility and is not rendered as a pack icon.
- Expanded `.app.light` theme tokens and overrides for fixed-color hero, game cards, resume banner, setup, dialogs, controls, prompt and wheel surfaces. Added compact theme-toggle track styling.
- Reviewed existing Truth or Dare player/challenge wheel flow. `spin-wheel` mode already renders `PlayerWheel` for player selection, persists the selected player and rotation before animation, then presents the separate `TruthDareWheel` for challenge selection. `all-together` and `one-at-a-time` intentionally retain their own semantics.
- Added release-contract assertions for the two-stage wheel, light-theme tokens/surfaces, and named icon usage. Added `docs/ui-architecture.md` and reconciled README, requirements, instructions, todo, checklist, tests, changelog, and Phase 6 runbook.

### Validation performed in this environment

- ZIP extracted and source tree inspected from the latest Phase 6 archive.
- Release-contract audit: **36 checks passed** (Node execution of the plain `.mjs` source audit).
- TypeScript/TSX syntax transpilation: **68 files, 0 syntax diagnostics** using global TypeScript 5.8.3; this is not semantic typechecking.
- JavaScript syntax checks passed for both release scripts and the service worker.
- Nine JSON/configuration files parsed; 17 Markdown files scanned with zero broken relative links.
- `bun` is not installed in this authoring container; npm registry DNS is unavailable. No new third-party dependencies were added and `package.json`/`bun.lock` dependency snapshots were not changed.
- The project currently has no Lucide React, MUI, Radix, or Framer Motion dependency. The present implementation uses a small first-party SVG icon component and CSS motion. This is not represented as an integration of those external libraries.
- Automated source-contract and TypeScript syntax checks are to be recorded below only after execution. No visual/browser, screen-reader, or device acceptance is claimed.

### Acceptance still required

- Run `bun install --frozen-lockfile` and `bun run check` with Bun 1.4.4 on the exact archive.
- Visually inspect light/dark theme on home, setup, gameplay, history, settings, dialogs, and both Truth or Dare wheels at 320px, 400px, tablet, and desktop sizes.
- Verify player wheel → challenge wheel → prompt sequence, turn progression, refresh/resume, and reduced-motion behavior in a real browser.
- Verify keyboard, screen reader live announcements, forced colors, zoom/reflow, and contrast.
- If Lucide React/MUI/Radix/Framer Motion are still required, install via Bun in a network-enabled environment, regenerate the single `bun.lock`, and re-run the native checks and bundle budget.

## 2026-11-06 — Initial CSS transfer budget follow-up

- User-confirmed previous pipeline: repository policy and all 43 release-contract checks passed; frontend/backend lint had 0 warnings/errors; frontend/backend TypeScript checks passed; 177 tests passed; `bun audit --audit-level=moderate` reported no vulnerabilities.
- The production build then failed only because initial stylesheet gzip measured 20.36 KiB, exceeding the unchanged 20 KiB CSS budget by 0.36 KiB.
- Removed the unused `tw-animate-css` and Geist font CSS imports and restored a system UI font stack for Tailwind's `font-sans` token. These changes target unused utility CSS and font-face declarations rather than increasing the release budget.
- Added source-level release-contract and Bun regression checks for those initial-CSS exclusions. Re-run `bun run check` with Bun 1.4.4 to verify the actual generated CSS gzip and full production budget gate.

## UI/UX redesign authoring checks — 2026-11-06

The latest user-provided pre-redesign baseline confirmed on Bun 1.4.4: repository policy and 44 release contracts passed; frontend/backend lint and typechecks passed; 178 tests passed; `bun audit --audit-level=moderate` reported no vulnerabilities; production build passed with 19.64 KiB CSS gzip, 123.02 KiB entry JS gzip, and 142.65 KiB initial JS+CSS gzip. This is evidence for the pre-redesign archive, not this UI-overhaul archive.

The redesign adds the responsive 12-column layout, shared Lucide/control system, sortable provider rows, command palette, Motion transitions, list animation, feature-scoped form/dropzone/query/date dependencies, Storybook component stories, fast-check properties, and Playwright/axe browser tests. Release-contract source checks currently report 48 checks passed in this authoring environment. The archive still requires native Bun 1.4.4 lint/typecheck/tests/audit/build and browser E2E on the delivered source. CI is configured to install Chromium and run the Playwright/axe suite after the root quality pipeline. This container does not provide Bun or the project's installed workspace dependencies, so no post-redesign native pipeline or measured CSS/JS bundle result is claimed.

Run from the extracted repository root:

```powershell
bun install --frozen-lockfile
bun run check
bunx playwright install chromium
bun run test:e2e
bun run storybook
```

Manual acceptance remains required for contrast, keyboard-only completion, screen readers, forced-colors mode, 200%/400% zoom, touch targets, reduced motion, light/dark appearance and all game flows. Heavy canvas/3D/physics packages are installed as optional future tools; they are intentionally not statically imported into the application shell.

## Responsive UI/UX overhaul — 2026-11-06

The redesign source includes a 12-column responsive grid, 7/5 desktop setup layout, shared icon registry, accessible switch primitives, Base UI button variants, semantic status/dialog components, command palette, keyboard/pointer provider reordering, responsive E2E coverage, axe checks, Storybook control stories, and fast-check property tests.

Source-level validation completed in the authoring environment: 48 release-contract checks; TypeScript/TSX transpile syntax; JavaScript syntax; CSS parse; JSON parse; local Markdown links; icon registry usage. The user supplied a prior native Bun 1.4.4 baseline with 178 passing tests, clean lint/typechecks/audit, and successful production build (CSS 19.64 KiB gzip). That baseline predates this UI overhaul. Native Bun semantic typecheck, lint, unit tests, audit, production build-budget measurement, Playwright, axe and visual browser review for this revision remain to be run.


## 2026-11-06 — Shared wheel and visual response update

- Replaced duplicated player/challenge wheel presentation with `SpinWheel`; adapters provide segment data and labels while domain/AppShell code retains selection, persistence and timing.
- Truth or Dare now defines eight equal alternating sectors: four Truth and four Dare. The selection index and pointer geometry use the same eight-entry domain constant.
- Labels are placed on each segment's radial axis and scaled up; sector separators, shared hub and pointer are rendered by the same component. Player selection and Truth/Dare selection both reuse it.
- Imposter no longer waits 650 ms before reveal. Pointer/key down updates reveal state immediately; the 260 ms CSS flip begins immediately and conceal-on-release/cancel/focus-loss/visibility-loss remains.
- Fixed GuessUp team-list markup/layout, tightened setup copy, removed the redundant selected-pack summary, corrected pack-editor helper text by game, constrained settings provider rows and generation inputs, and bounded modal dimensions to the viewport.
- Added source tests for all 8 wheel sectors plus Playwright tests for eight-sector rendering and immediate Imposter reveal.
- **Authoring-environment checks:** Node release-contract audit passed 54 checks; TypeScript/TSX syntax transpilation passed for 14 touched source/test files; both modified CSS files parsed with zero errors; direct Node geometry smoke test verified all eight sectors map to their declared Truth/Dare outcome and land under the fixed pointer; headless Chromium CSS smoke checks verified a centered, viewport-bounded custom-pack dialog; no settings/provider overflow at 390, 620, 768, and 1024 px; and 8 radial wheel labels at 390/1440 px with at least 13 px type, all within the wheel bounds. These were isolated CSS/component-markup smoke checks, not the integrated React browser suite.
- **Execution status: native/browser NOT RUN.** Bun and workspace dependencies are not installed, so native lint/typecheck/unit tests, Playwright, production build and visual browser/device review remain pending. These source/syntax/geometry checks are not a full application test pass.


## 2026-11-06 — Latest user-provided browser diagnostics and remediation

The supplied Bun 1.4.4 run showed: release contracts 62 passed; frontend lint had one `react(refs)` warning in `SortableProviderRow`; backend lint had none; frontend/backend typechecks passed; fast suite 186 passed / 1 failed. The single fast-test failure was a stale test expectation that looked for `playwright test` in the root workspace script, while the root intentionally delegates to `@king-fun/frontend test:e2e`.

The supplied integrated Playwright run completed 13 tests with 9 passed / 4 failed:
- 320 px grid metric ran before the asynchronously initialized grid was present.
- Provider test text locator was ambiguous because it matched both `Google Gemini` and `Google Gemini enabled`.
- Command palette did not move focus into the input after programmatic `showModal()`.
- Home axe scan found a dark command-shortcut color contrast result (4.23:1 against the expected 4.5:1) and WCAG 2.5.3 label-in-name violations on brand, command trigger and four game-card buttons.

Source remediation has been applied: grid hydration wait, exact text locators, command focus scheduled after modal opening, visible-text-derived button names, shortcut screen-reader name retaining `CTRL K`, higher dark/light subtle tokens, dnd-kit transition passed as `null` with CSS-owned transition, and corrected root/workspace E2E script contract. New regression coverage was added to the release-contract script and Bun tests.

**Verification status for this revision:** not yet executed with Bun in this authoring environment (no Bun binary/network package install available). Node release-contract audit and source/syntax checks must be run before packaging. Do not claim the 13-test browser suite or final `bun run check` passes until a Bun 1.4.4 run confirms it.


## Follow-up source remediation — 2026-11-06

The latest user run exposed one stale fast-test contract, one ref-derived dnd-kit transition warning, and four Playwright failures (responsive grid measurement, ambiguous provider text locator, command-palette focus, and home axe violations). Source changes now correct the root/workspace E2E command assertion, set dnd-kit transition to `null` with a CSS-owned transform transition, make provider text locators exact, revalidate grid DOM/CSS after each viewport resize, move command focus into a layout effect with an animation-frame retry, raise subtle text contrast tokens, and associate brand/game controls with visible text. The home axe defects were based on WCAG label-in-name and contrast failures; a new browser run is still required to confirm settings/setup scans and all E2E cases.

**Not verified:** Bun unit suite, Oxlint warning-free result, TypeScript semantic typecheck, dependency audit, production build, Playwright/axe after these latest edits. The prior log shows semantic typechecks passed, 186/187 tests and 9/13 E2E cases; it is historical evidence for the earlier source, not a pass for this revision.

The final source refinement strengthened game-card accessible names with explicit `aria-labelledby`/`aria-describedby`, ordered the command shortcut's visible label before its hidden explanation, and moved modal focus handling to `useLayoutEffect` with immediate and next-frame focus. The grid E2E now measures via the locator itself after each breakpoint. These changes have passed the source-level audit/syntax/config checks in this authoring environment; the full Bun 1.4.4 / Chromium suite remains to be rerun on the user's machine.

## 2026-11-06 follow-up (latest user Bun 1.4.4 log)

- Baseline from the supplied run: policy and 67 release contracts passed; frontend lint had one React Compiler warning; both typechecks passed; 188 tests passed; Bun audit found no moderate-or-higher vulnerabilities.
- Production build failed the existing transfer budget: 289.87 KiB initial JS gzip vs 150 KiB, and 306.89 KiB combined JS/CSS vs 170 KiB.
- Playwright baseline: 9/13 passed; failures were 320px horizontal overflow, hidden provider name, command-palette keyboard opening, and four serious label-content-name mismatch violations.
- Follow-up source changes: split non-home screens/dialogs into lazy chunks, removed eager Motion and moved the Settings query provider behind its lazy boundary; replaced dnd-kit sortable props that triggered the remaining lint warning; fixed the narrow header, provider row identity track, label-in-name markup, and shortcut hydration wait.
- **Native verification of this follow-up archive is pending.** The authoring container does not have Bun or installed workspace dependencies, so no claim is made that the new release budget, lint, or Playwright suite has passed.
- Preserved the play-screen render path inside the outer lazy-screen Suspense boundary after separating setup/history/settings.
- Updated the bundle budget audit to include every HTML `modulepreload` JS asset, preventing a false pass from merely moving entry dependencies into preloaded chunks.


## 2026-11-06 — Latest native Bun run and remediation scope

The user-supplied Bun 1.4.4 run established: 188/188 unit/release tests passed, both TypeScript project checks passed, and `bun audit --audit-level=moderate` reported no vulnerabilities. Remaining reported defects were one Oxlint React Compiler refs warning, four of thirteen Playwright failures, and initial JS transfer budget failures (289.87 KiB gzip JS; 306.89 KiB JS+CSS). The source changes in this archive address those findings, but this authoring environment does not have the Bun workspace dependencies installed; full Bun lint/typecheck/tests/audit/Vite build/Playwright must be rerun on the updated archive. Do not treat source-level/static checks as native release evidence.

## 2026-11-06 — Timer, palette, provider identity, and contrast follow-up

### Source changes
- `AppShell.tsx`: `toastTimerRef` is `number | null`, matching browser `window.setTimeout` and `window.clearTimeout` rather than Node's `Timeout` object.
- `CommandPalette.tsx`: initial and retry RAF handles are stored in `useRef<number | null>` and both cancelled during effect cleanup; no local `let` variable is mutated from the callback.
- `SortableProviderRow.tsx`: native HTML drag/drop and explicit keyboard reorder buttons remain the provider-order mechanism. The enabled switch is a direct row-grid child with an accessible name referencing the visible provider name and ON/OFF label. Provider identity has a reserved flexible column.
- `design-system.css`: the provider grid is explicitly defined at desktop, tablet, and phone widths; the switch retains a 44px touch target.
- `hero-motion.css`: small WHO/ACT/SPIN/EVER labels are opaque white. Calculated contrast against the previous four axe backgrounds ranges from 13.10:1 to 13.68:1, exceeding the 4.5:1 normal-text WCAG AA threshold.

### Targeted verification in the authoring environment
- Node release-contract audit: 82/82 passed after adding four checks for browser timer typing, effect-owned RAF cleanup, provider identity/switch semantics, and hero-token contrast.
- Chromium 144 with production `design-system.css` and representative provider-row markup: 320, 360, 390, 620, 768, 1024, and 1440px; no horizontal overflow, provider names visible, rows fit their containers, switches at least 44px high, and switch accessible names match the visible provider plus ON/OFF state. This is a focused CSS/DOM fixture, not integrated application E2E.
- TypeScript/TSX transpile syntax: 93 files, zero syntax diagnostics. PostCSS: 4 stylesheets parsed. Node syntax: 2 JS/MJS files passed. JSON parse: 9 files valid.

### Verification still required
The user-provided native log before this patch had 188/188 unit/release tests, both TypeScript projects, and `bun audit --audit-level=moderate` passing, but `bun run check` stopped at one Oxlint warning and one AppShell timer type error. A separate E2E run had 11/13 passing; the two failures were hidden provider identity and hero-token contrast. The current source patches those causes, but this exact source revision has not yet been run through Bun 1.4.4 Oxlint, semantic TypeScript, all Bun tests, `bun audit`, Vite production build and gzip budget, or the full Playwright/axe suite. Run `bun run check` and `bun run test:e2e` on this exact archive before release.


## 2026-11-06 — Follow-up to the 82-contract native run

### User-provided evidence
- `bun run check` reached the test stage with 82/82 release contracts, 0 frontend lint warnings/errors, 0 backend lint warnings/errors, and both TypeScript workspace checks passing.
- 194/195 unit tests passed. The single failure was the service-worker test expecting the flattened string `king-fun-shell-v6` in source even though the worker intentionally composes it from `CACHE_PREFIX` and `v6`; the runtime cache expectation was already `king-fun-shell-v6`.
- `bun run test:e2e` reported 11/13 passing. The settings provider test measured before its lazy-loaded screen/list had rendered, returning zero provider rows. The axe scan found four hero token labels and the home CTA below the 4.5:1 normal-text threshold.

### Source remediation
- Updated the service-worker source assertion to match the prefix/version declaration and retained the runtime cache-name assertion.
- Removed the invalid disabled state from the fixed-registry home CTA, added the fixed Imposter fallback, and defined explicit high-contrast theme colours.
- Forced the four hero token labels to opaque white through a high-specificity selector loaded with the design system.
- Added a readiness wait for the lazy Settings provider list and row count before responsive measurements; added CTA/token assertions before the axe scan.
- Added source-level regression contracts for these exact fixes.

### Not yet verified
- Bun 1.4.4 semantic typecheck/lint/test/audit/build and the full Playwright/axe run have not been rerun against this patched source in the authoring environment. Run `bun run check` and `bun run test:e2e` in the project workspace before release sign-off.


## 2026-11-06 — Latest provider/contrast/cache remediation

- Source-level changes now include an explicit `king-fun-shell-v7` constant, one authoritative provider grid-area layout with `.provider-name`, non-fading text-safe entrance motion, theme-specific accessible CTA colours, and opaque hero-token labels.
- Provider Playwright waits for the actual Gemini and Groq names before measuring; axe checks wait for Settings and setup lazy content.
- **Native verification still required:** Bun 1.4.4 lint, TypeScript semantic checks, unit tests, security audit, production build-budget checks, and the complete 13-test Playwright/axe suite have not been rerun on this exact source revision in the authoring environment.


## 2026-11-06 — Continuation after v7 cache/provider/contrast run

### Source corrections
- Service worker declares the exact literal `king-fun-shell-v7`; the unit test and runtime cache assertions use the same name. The older v6 wording above is historical and superseded.
- The pinned Cloudflare fallback is outside the two-item Gemini/Groq sortable list and is a separate labelled group. Both regular identities and the pinned identity use visible `.provider-name` content in an explicit responsive grid area.
- The provider switch is a direct row-grid child with a 44px target; the provider test waits for the lazy settings list and checks actual name boxes, row width and document width.
- Hero-token labels are opaque white in both `hero-motion.css` and the app design-system override. CTA colours are explicit in dark and light themes; screen/card entrance keyframes are transform-only and no longer duplicated.

### Focused verification available in the authoring environment
- Node release-contract audit: 83/83 checks pass after the service-worker v7, provider-grid and final hero contrast updates. The new Bun unit regression for unique transform-only keyframes is source-updated but still needs native execution.
- Chromium CSS/DOM fixture: provider identities visible, provider rows fit, document has no horizontal overflow, and switches are 44px high at 320, 360, 375, 390, 620, 768, 1024 and 1440px in dark/light fixture modes.
- Computed dark CTA contrast: 13.02:1; light CTA contrast: 5.72:1. Hero token text contrast against their calculated backgrounds: 13.10:1–13.68:1. The CTA foreground/background transition is disabled so a theme switch cannot pass through low-contrast interpolated colours.
- These are focused CSS/DOM checks, not the integrated React/Playwright/axe suite.

### Native checks still required
The supplied Bun run showed clean Oxlint and both TypeScript checks, but one unit test failed because it expected the flattened v6 cache string while the service-worker source used a prefix/template. The current source now uses the explicit v7 literal and has aligned tests. The supplied Playwright run showed 11/13 passing, with remaining provider identity visibility and home contrast failures addressed in source and regression coverage. Rerun `bun run check` and `bun run test:e2e` on this exact archive; actual Vite bundle-budget, security audit, and all axe screens must be confirmed there before release certification.

## 2026-11-06 — Final cache/provider/contrast follow-up

### Source-level checks performed on the current working tree
- `node scripts/check-release-contracts.mjs`: **83/83 checks passed**.
- Chromium CSS/DOM fixture using the current `App.css`, `design-system.css`, and `hero-motion.css`: tested 320, 360, 375, 390, 620, 768, 1024, and 1440 CSS px in both dark and light themes (16 combinations). Every run had document `scrollWidth === clientWidth`; Gemini, Groq and pinned Cloudflare provider names had visible, non-zero boxes; each sortable provider row fit its own width; the provider switches remained 44px tall.
- Computed foreground/background contrast from Chromium: dark primary CTA **13.02:1**; light primary CTA **5.72:1**; hero token labels WHO/ACT/SPIN/EVER **13.07:1–13.71:1**.
- Service-worker source now declares `const CACHE_NAME = 'king-fun-shell-v7'`; the worker unit test, test cache map, release-contract assertion and deployment docs reference v7.
- ZIP source excludes the local fixture and does not include `.env`, dependency folders, generated `dist`, or test-result artifacts.

### Verification boundary
The Chromium check above is a targeted stylesheet/DOM fixture, not the integrated React app or the axe Playwright test. The authoring container has Node and system Chromium but does not have Bun 1.4.4 or the workspace dependencies; therefore the following have **not** been rerun on this exact source archive: Oxlint, semantic TypeScript workspace checks, the Bun unit suite, `bun audit`, Vite production build and recursive gzip budgets, or the complete 13-test Playwright/axe suite. The user-provided preceding run had 194/195 unit tests and 11/13 E2E tests passing; this revision addresses its stale v6 service-worker assertion and two reported browser failures, but a green native release is not claimed until those commands pass on this archive.

## 2026-11-06 — Party Arcade expansion verification (authoring environment)

### Checks completed
- TypeScript/TSX syntax transpilation using the installed TypeScript compiler: **86 files parsed, zero syntax diagnostics**. This is syntax-only, not semantic typechecking.
- Node 22 runtime smoke against actual `SEEDED_CONTENT`: **23/23 additional game session factories created** with game-appropriate player counts, and **23/23 initial snapshots accepted** by the persisted-session validator.
- Seed inventory: **2,154 content items across 60 packs** (original 4 preserved plus new arcade packs); all 10 Fake It items contain true-answer metadata; all 10 Fact or Fiction items contain `true`/`false` verdict metadata.
- `node scripts/check-release-contracts.mjs`: **83/83 checks passed**. These existing contracts validate the repository's prior architecture/security/accessibility policy; they are not a replacement for game-specific browser testing.
- Domain tests were expanded to cover all session factories, empty content, duplicate player identities, fuse bounds, one-vote constraints, team/solo Tilt scoring, auction bids/anti-items filtering, faction victory, bounded scrambling and player rotation. The tests use `bun:test` and have not been executed in this environment.

### Not completed / not claimed
- Bun 1.4.4 is unavailable here, and the workspace dependencies are not installed. `bun run lint`, semantic `bun run typecheck`, the full Bun unit suite, `bun audit`, Vite production build/bundle budget and `bun run check` have not been run on this exact tree.
- Integrated Playwright/axe coverage for the new game controllers, private reveals, voting, reload/resume, timers, sensors, microphone permission and mobile game layouts has not been run.
- Real Android/iOS browser behaviour for DeviceOrientation, MediaRecorder, Web Audio, speech synthesis, background timers and offline service-worker recovery requires device acceptance.
- The source report contains underspecified/inferred titles, and the expanded app intentionally does not add fabricated games for them.

### Release decision
Implementation source and domain/content smoke checks are complete for the 23 added game entries. This archive is **not release-certified** until the native Bun pipeline and integrated browser/device acceptance gates above pass.

- Follow-up UX/domain refinement: Fake It now uses a private word-holder plus yes/no questions and one guess per other player; Who Am I now keeps the identity visible on the facing screen for forehead play. Added regression tests for both constructors. Syntax and runtime smoke must be re-run after this refinement.

- Current catalogue copy now describes Fake It as a private secret-word / yes-no question game and Who Am I as forehead-facing identity play.

- Tilt It gesture labels and motion event mapping now match the report's down-to-submit / up-to-skip interaction. Device-specific beta-axis direction still needs physical-device confirmation.

- Follow-up review: Fake It prompts now show broad category/clue cues while retaining the answer in metadata; test added to prevent direct answer leakage. Rule-only games can launch without a prompt pack. Tilt It rejects late events and disables motion at deck exhaustion. Re-run syntax and runtime verification after these refinements.


## 2026-11-06 — Party Arcade final verification update

The latest source includes 27 selectable games total (four original games and 23 additions), routed through seven independently lazy-loaded controller families. Source verification after the final domain/UI fixes:

- `node scripts/check-release-contracts.mjs`: **97/97 checks passed** on the final source tree.
- Global TypeScript compiler `transpileModule`: 87 TS/TSX files parsed with zero syntax diagnostics. This is not semantic typechecking.
- Node 22 experimental TypeScript stripping: all 23 new session constructors generated valid initial session snapshots accepted by `parseGameSession` using the actual seed catalogue.
- Content inventory: 2,154 records across 60 packs; 10 Fake It secret-word items and 10 Fact or Fiction metadata items.
- The source includes a Playwright pass over all 23 new controllers and responsive layout checks over all 27 cards. These tests were authored but were not executed in this environment.

**Not verified here:** Bun 1.4.4 is absent and workspace dependencies are not installed. Oxlint, semantic TS project references, Bun unit/property tests, `bun audit`, Vite production build, recursive gzip budget, Playwright and axe have not been executed on this exact tree. DeviceOrientation, MediaRecorder, Web Audio, speech synthesis, storage quota, PWA offline, and screen-reader behaviour require integrated browser and real-device acceptance. This archive must not be represented as release-certified until those checks pass.


## 2026-11-07 — Type, lint and browser-test remediation

### Changes made
The user-supplied native log was used as the defect list. The TypeScript fixes cover the optional `hints` property under exact optional types, dynamic Tilt It score fields, guarded bidder IDs, prompt result row inference, React child requirements and optional Who Am I assignment indexing. The lint fixes cover all 17 warnings shown in that log: impure render-time clock initialization, unstable memo fallbacks, a missing game dependency, effect-driven transient-state resets, unused declarations, and the Tilt It deadline transition. The two reported E2E failures were traced to incorrect test assumptions/synchronization; the tests now use the rendered choice controls and visible voter count, and wait for actual roster updates.

### Checks executed in this environment
- TypeScript `transpileModule` syntax inspection: **87 TS/TSX files, zero syntax diagnostics**.
- `node scripts/check-release-contracts.mjs`: **109/109 static release-contract assertions passed**.
- Root, frontend and backend `package.json` JSON parsing: passed.

### Checks not executable here
This runtime does not contain Bun 1.4.4, workspace `node_modules`, Oxlint, Vite or the Playwright project dependencies. Attempting `tsc -b` stops before project type analysis because `vite/client` and the Node type definitions are missing. Network DNS is unavailable, so the dependencies cannot be installed in this environment. Consequently the following are **not claimed as passing after the fixes**: Bun/TypeScript semantic typecheck, Oxlint zero-warning run, Bun unit/property tests, `bun audit`, production Vite build/bundle budget, and integrated Playwright/axe execution.

### Required user-side confirmation
From the project root with Bun 1.4.4, run `bun install --frozen-lockfile`, then `bun run check` and `bun run test:e2e`. The source and regression contracts now target each defect present in the supplied log; any new output should be treated as a fresh defect report rather than assumed resolved.


# Verification update — 2026-11-07 (latest user-provided failure log and remediation)

## User-provided Bun 1.4.4 evidence before this patch

- Repository policy passed.
- Release-contract audit passed 113/113 checks.
- Frontend Oxlint: 1 React Compiler `react(immutability)` warning in `AmbientBackground.tsx`; backend lint: 0 warnings/errors.
- Frontend and backend TypeScript project checks passed.
- Unit tests: 213 passed, 2 failed out of 215. The failures were (1) the seeded canonical-duplicate test comparing unrelated game pools globally and (2) a stale four-game pack-count assertion after the catalogue grew to 27 games.
- Playwright: 19 passed, 1 failed out of 20. The all-games controller smoke loop counted player chips immediately after clicking a game card, before the intentional home-to-setup transition had rendered the setup roster; the first count could therefore be zero and become four after the add action resolved.
- `bun run check` stopped at the unit-test stage; dependency audit and production build were not reached. The separate E2E command completed with the single failure above.

## Remediation applied to this source tree

- Removed the mutable `disposed` flag from the ambient renderer. A scheduled animation frame cannot run concurrently with effect cleanup on the browser main thread; cleanup cancels the outstanding frame and unregisters every listener.
- Changed the seeded catalogue duplicate assertion to compare the full selectable pool within each game ID. The duplicate detector still normalizes Unicode/case/punctuation and catches real duplicates within one game. Reuse between different games is allowed and remains isolated by `gameId` in the selection path.
- Changed shared seed validation to assert that the set of seeded pack game IDs exactly equals the registered `GAME_IDS` list, rather than expecting only four game IDs. The 30 Imposter category packs are still asserted independently.
- Added Playwright waits for the setup workspace and first visible player chip before taking the initial `locator.count()` snapshot. Existing retrying assertions remain around every add/remove mutation.
- Added release-contract and Bun regression tests for the fixes.

## Post-patch verification in this authoring environment

- Node 22 TypeScript-strip runtime: the bundled content module loads 2,154 content items and 60 packs across all 27 game IDs.
- Node 22 runtime: no canonical duplicate exists within any individual game's complete content pool; the 26 reported global collisions are cross-game reuse, not same-game duplicates.
- Static source assertions confirm the cleanup no longer contains the mutable lifetime flag and the E2E wait appears before the first roster count.
- Native Bun 1.4.4 lint/typecheck/unit/audit/build and integrated Playwright/axe have not been rerun in this authoring environment. No post-fix full-pipeline pass is claimed.

## Remaining exact-revision release gate

Run `bun install --frozen-lockfile`, `bun run check`, and `bun run test:e2e` on this exact tree. The release gate is zero Oxlint warnings, all unit/contract tests passing, no moderate-or-higher dependency audit findings, successful production build and unchanged gzip budgets, all 20 Playwright tests passing, and no serious/critical axe violations.


# Latest verification — Imposter built-in category generation change (2026-11-08)

## Source changes

- Removed the static Imposter answer/hint catalogue from the source tree. `imposter-categories.ts` now contains metadata only; all 30 general report-named categories and the 18+ After Dark category remain, with stable pack IDs, names, descriptions and suitability. The unused `imposter-additional-words.ts` source was deleted.
- Seed generation creates empty default Imposter category packs and no Imposter `ContentItem` entries.
- Starting a built-in Imposter round chooses a selected category using the existing category cooldown, then sends that category's ID, title and description through `generateAiContent` with `game: imposter`, `itemKind: word`, and the normal configured provider order. Five words are requested per round. The global last-10 word exclusion and the category/item-kind queue are retained.
- Setup treats metadata-only Imposter packs as deferred AI categories, displays `AI-GENERATED ON PLAY`, and permits the round to start. Manually authored/imported local word packs remain available without network access.
- The backend generation prompt now requests exactly 20 distinct hints per word, matching `validateGeneratedItems`'s enforced schema.
- Seed, shared-contract and Imposter category-selection tests were updated. Current documentation now records the report's 1,800-entry figure as historical source material rather than shipped KING-FUN content.

## Verification performed in this authoring environment

- `node scripts/check-release-contracts.mjs`: **153/153 checks passed**, including metadata-only built-in categories, mandatory provider-order generation, category title/description payloads, exact 20-hint validation and Settings-side metadata resolution for Imposter word generation.
- TypeScript/TSX transpilation syntax check: **112 files, zero syntax diagnostics**. Node syntax checks passed for repository `.js`/`.mjs` scripts. JSON parse check: **14 files, zero errors**.
- Bun 1.4.4 and workspace dependencies are not installed in this authoring environment. The exact revision has not been verified with native lint, semantic typechecks, Bun unit tests, `bun audit`, Vite production build/gzip budget, or Playwright/axe. Do not claim full release verification until these pass on the exact archive.

## Acceptance notes

- Built-in Imposter categories intentionally require internet/provider availability when no content-vault result is available. This is the requested tradeoff for removing hardcoded answer banks.
- Manual local word packs are the offline play path. Provider/network failure must fail clearly and must not fall back to a different category's answers.
- This change does not add online multiplayer, server-side game sessions, player-name transmission, or changes to documented Imposter rules.


## 2026-11-08 — Follow-up from the user's latest quality log

### Fixes applied
- The source archive omitted `.env.example` because hidden root files were excluded during packaging. The updated archive explicitly includes this allowlisted, secret-free template.
- `scripts/check-release-contracts.mjs` now checks existence before reading `.env.example`, so an archive or checkout missing that file receives a clear failed contract rather than terminating with `ENOENT`.
- The Imposter role-reveal test no longer searches for the exact hardcoded text `Animals`. It waits for lazy catalogue hydration, confirms the 30 all-ages built-in categories are present while the 18+ category remains gated, chooses the first displayed category while deselecting the rest, and verifies the generated-content request carries that category's displayed name and non-empty description.
- Updated static release contracts and Bun regression tests to cover both corrections.

### Verification boundary
- Node release-contract audit and syntax/configuration checks are run on the updated source before packaging.
- This authoring runtime has no Bun executable, installed workspace dependencies, or Playwright browser package, so a native `bun run check` and `bun run test:e2e` pass cannot be claimed here. The user's latest log is the evidence for 19/20 browser tests passing before this fix; the updated E2E must be rerun in the Bun workspace.

## Final source/archive checks for the 2026-11-08 follow-up

- `node scripts/check-release-contracts.mjs`: **158/158 passed** in the source workspace and again after extracting the final ZIP into a clean directory.
- TypeScript/TSX syntax-only parse: **117 files, zero syntax diagnostics** using the globally available TypeScript transpiler. This is syntax validation, not the strict workspace typecheck.
- Repository `.mjs` syntax checks passed; all **13 JSON files** parsed successfully.
- ZIP integrity passed. Root `.env.example` is present in the archive; `.env`, signing keys, dependency folders and generated build/test output are excluded.
- Negative-path check: temporarily removing `.env.example` makes the release audit report the named environment-template contract failure (and dependent environment-config check) with exit code 1; it no longer crashes with an uncaught `ENOENT`.
- Bun 1.4.4, workspace dependencies, Playwright and Chromium are unavailable in this authoring runtime. The integrated `bun run check` and `bun run test:e2e` were therefore not executed here. The user's previous run reported 19/20 E2E tests passing before this latest correction; the updated test still needs native execution in the user's Bun workspace.


# Verification update — Imposter selected-category nullability (2026-11-08)

## User-provided failure

- The user's Bun 1.4.4 run passed repository policy, 158 release contracts, and both frontend/backend Oxlint (zero warnings/errors), then failed frontend typecheck at `AppShell.tsx:656` because `selectImposterCategory()` returns `string | null` and the selected category history expected `string[]`.

## Fix applied

- `AppShell.tsx` now explicitly handles a null category-selection result before category lookup and round creation. The guard also narrows the value before it is appended to `recent['category:imposter']`.
- Category pack lookup compares `String(pack.id)` with the narrowed selected ID, matching the string-based selector contract.
- Added a release-contract check for the guard and its ordering relative to recent-category history storage.

## Verification in this authoring runtime

- Node release-contract audit: **159/159 passed** after the fix.
- Bun and workspace dependencies are not installed in this authoring runtime. The full strict TypeScript project check, Bun tests, dependency audit, production build, and Playwright suite have not been rerun here; run them against this exact archive.


# Verification update — live game-start loading experience (2026-11-08)

## Implemented

- Added `GameLoadingOverlay` to the single `startGame` path, covering all 27 games and Imposter restart. It uses the selected game's `GameMark`, a CSS orbit/pulse/progress animation, accessible live status text, and system/saved reduced-motion support.
- Startup stages cover lazy local seed loading, content availability/moderation filtering, local rule preparation, initial Never Have I Ever prompt selection, durable session commit, and game-ready/error states. Local-only starts do not claim to contact the backend or an AI provider.
- Startup generation calls pass the progress reporter to `generateAiContent`. It reports real provider skips, provider attempts, fallback order, local fallback and content-ready events.
- The gateway supports opt-in `Accept: application/x-ndjson` progress streaming while preserving JSON for existing clients. It emits backend acceptance, content-vault check/hit/miss/wait/busy/unavailable/skipped, provider starting/generated/failed, confirmed vault-save success/failure and content-ready events.
- E2E coverage supplies schema-shaped NDJSON progress frames and asserts the overlay displays the actual vault/provider/save/ready lifecycle. Backend route coverage verifies NDJSON framing and the final response envelope.

## Verification boundary

- Static source and syntax checks are to be rerun after the final archive is assembled.
- This authoring runtime has no Bun executable or installed workspace dependencies, so native Bun lint/typecheck/unit tests, `bun audit`, Vite production build and Playwright/axe cannot be executed here. Do not treat this change as fully release-verified until those commands pass on the exact archive.

## Additional loading-overlay coverage

- Extended the 23-added-game browser launch sweep to assert the shared overlay for every Start action and to verify that Timer Impostor does not display a fabricated provider call.
- Added an I Have Never browser assertion for opening-statement readiness during startup.
- Changed accessibility live updates to announce only the current stage; the history remains readable but is not re-announced on every event.

## Final static verification — live game-start loading UI

- Node release-contract audit: **170/170 passed** in the working tree.
- TypeScript/TSX syntax-only transpilation: **114 files, zero diagnostics** (global TypeScript; this is not semantic project typechecking).
- MJS syntax checks and repository JSON parsing: rerun after the final source edits.
- Playwright E2E was expanded to cover every added controller launch, I Have Never opening-prompt readiness, streamed provider/vault lifecycle, and no fabricated provider status for rules-only startup. The browser suite has **not** been executed in this authoring runtime.
- Bun typecheck, unit tests, security audit and production build have **not** been executed in this authoring runtime because Bun and workspace dependencies are unavailable.

- Added confirmed `vault-saved` and `vault-save-failed` progress stages; save activity is omitted when the vault is not configured and for live provider tests.


## 2026-11-08 — Android release signing and launcher icon remediation

- Inspected the supplied GitHub Release screenshot: its APK asset was named `app-universal-release-unsigned.apk`. The installer reported `INSTALL_PARSE_FAILED_NO_CERTIFICATES`, consistent with the APK containing no Android signing certificate.
- Source audit identified the workflow defect: the restore step tested `env.ANDROID_KEYSTORE_BASE64` in its `if` expression even though that variable was only declared in the same step's `env` block. The condition therefore did not see the step-local secret. The step also wrote properties but did not configure Gradle's generated release `signingConfigs` / `buildTypes.release.signingConfig`, which Tauri's Android signing guide requires.
- Added `scripts/configure-android-release-signing.mjs`: requires all four signing secrets, validates the decoded keystore and alias with `keytool`, writes a private `keystore.properties`, and idempotently configures Gradle release signing with separate store/key passwords. Debug signing is not modified.
- Both Android workflows now run `tauri icon frontend/public/king-fun-logo-source.svg` after project initialization and verify all mipmap density resources. This updates `src-tauri/gen/android/app/src/main/res/` rather than relying on unused icon files under `src-tauri/icons/android/`.
- The release workflow verifies APK signatures with `apksigner`, AAB signatures with `jarsigner`, compares every artifact certificate fingerprint with the configured keystore certificate, stages only release-signed app artifacts, excludes unsigned APK/intermediary bundle outputs, deletes stale APK/AAB files on an existing tag before republishing, and fails closed if signed app outputs are missing. Regular CI artifacts are explicitly named `tauri-android-ci-unsigned`.
- Local verification: the signing script passed twice against a throwaway test JKS keystore and generated Gradle template, demonstrating store-password/alias/private-key-password validation, separate passwords, release-only signing configuration, and idempotency. A signed JAR smoke test verified that the release workflow’s `jarsigner` output check recognizes genuinely signed artifacts. `node scripts/check-release-contracts.mjs`: 180/180 passed. No real GitHub secrets were accessed; Android runner build, signature verification of produced artifacts, and physical-device installation remain to be verified in GitHub Actions.

## 2026-11-09 — Backend dev entry-point correction

- Fixed `backend/dev.ts` to import `{ app }` as a named export.
- Exported the configured Elysia instance from `backend/index.ts`; the Vercel handler continues to use the same instance.
- Added a release-contract check for the named import/export relationship.
- Static verification in this environment: release-contract and syntax checks are run against the updated source. The full Bun typecheck, backend tests, audit and production build must still be executed in the pinned Bun workspace.

## 2026-11-09 — E2E fixes from latest Playwright run

- Fixed missing accessible name on `.game-loading-layer`.
- Fixed the I Have Never test to choose One at a time; default spin-wheel mode correctly defers prompt generation until after a player is selected.
- Added a deterministic mocked generation response for the opening statement.
- Expanded visible startup history from six to twelve entries and added a short final-state handoff so vault-save and provider events can be read.
- Added three release-contract checks for these regressions.


## Cloudflare Workers AI timeout investigation (2026-11-09)

- Source trace: the screenshot's `Provider request timed out.` message is emitted by the backend provider adapter when its upstream fetch hits the server-side abort deadline (or Cloudflare returns HTTP 408/504). The provider request is made from the backend, not from the Android device.
- The same backend adapter serves Android PWA, Tauri Android, and desktop web. The client transports differ, but the selected Cloudflare provider uses the same server-side URL, credentials, request format, and provider timeout. A platform-only diagnosis is therefore not supported by this source trace.
- Ordinary generation is cache-first: a Windows success can be a content-vault hit and may not prove a live Workers AI call. The provider connection-test header bypasses the vault, but its built-in test payload is a single Truth-or-Dare item and is not equivalent to the five-word/twenty-hint Imposter batch.
- Narrow source fix: give Workers AI its own 52-second upstream deadline (still below the configured Vercel 60-second function maximum), cap only Imposter word batches at 3,072 output tokens, and set Cloudflare's documented top-level `options.rejectIfBusy` to fail fast on capacity queues. Gemini/Groq and all frontend/game flows remain unchanged.
- Local verification: direct Node TypeScript-stripping smoke test passed for Cloudflare payload options, Imposter and non-Imposter token budgets, schema validation, and timeout isolation; release-contract audit exited 0. Full Bun tests, a live same-payload provider comparison, production deployment latency, and Android browser/Tauri device acceptance were not available in this runtime.


## 2026-11-09 — Imposter role-reveal E2E failure triage

- User-provided Playwright run: 20 tests passed; the role-reveal case failed at the final `Content ready from` assertion because `.game-loading-layer` had already been unmounted. The failure occurred before the role-card press/release assertions and does not demonstrate a defect in the reveal interaction.
- Root cause: the test read historical startup messages sequentially from a transient overlay after game startup. The production flow intentionally clears the overlay after the game-ready handoff, so a slow test runner can lose the locator between assertions.
- Source correction: observe overlay text mutations during startup, then assert the captured vault/provider/save/content-ready history after the role card appears. The Node release-contract audit and Bun regression-contract test were updated to guard this handoff behavior. Production UI timing, game behavior, and provider integrations are unchanged.
- Verification boundary: Bun and Playwright are not installed in this authoring environment, so the focused E2E and full browser suite must be rerun on the user's Bun workspace.


## 2026-11-09 — Cloudflare timeout follow-up from cross-platform reproduction

- User supplied a Windows browser Network capture showing repeated five-second `provider-waiting` frames followed by the same timeout. The CSP-blocked `https://vercel.live/next-live/feedback/feedback.js` console message is unrelated: it is a separate development feedback script and does not block the `/v1/content/generate` request.
- The cross-platform capture confirms the failure is at the shared backend-to-Cloudflare inference boundary, not a Tauri or Android HTTP transport bug. The backend heartbeat stream remains connected while the provider request is pending.
- Reduced only Cloudflare Imposter requests from five words (100 hints) to one word (20 hints), because the start flow consumes only one secret word. Cloudflare Imposter output is now capped at 1,024 tokens. Gemini and Groq still receive five words, and other Cloudflare games are unchanged.
- Added regression coverage for provider-specific request counts and updated the Cloudflare Imposter token-budget assertion.
- Not yet live-verified: the next acceptance test must prove a fresh Cloudflare inference (not a vault hit) completes within the backend deadline on desktop and Android using the same API deployment.

## 2026-11-09 — Imposter generation batch normalized across every provider

- Changed normal Imposter round startup from `count: 5` to `count: 1` in the shared frontend request, so Gemini, Groq, and Cloudflare all receive only the one secret word actually consumed by that round. Each generated word retains its exact 20-hint contract.
- Added a backend `normalizeGenerationInput` boundary normalization so older clients that still submit `count: 5` are reduced to `count: 1` before any provider adapter is called. The behavior is provider-independent; non-Imposter game batch sizes are unchanged.
- The shared content vault still merges a newly validated item with its existing pool, so it can build a larger reusable category pool gradually across successful starts.
- Updated the role-reveal E2E fixture to return one word and assert request `count: 1`; updated provider tests to cover the backend normalization and non-Imposter preservation.
- `node scripts/check-release-contracts.mjs`: **185/185 passed**. TypeScript syntax transpilation reported zero diagnostics for the five modified TS/TSX files. A direct Node TypeScript-stripping smoke test confirmed Imposter `count: 5` normalizes to `1` regardless of provider and non-Imposter `count: 5` remains `5`.
- Exact-revision Bun unit tests, Playwright, production build, and live inference for Gemini/Groq/Cloudflare remain to be run. This source change does not claim live provider success.


## 2026-11-09 — GuessUp and short-batch generation optimization

- Source changes: GuessUp requests five items explicitly (matching the client/server maximum), no longer sends player names/count/current-turn identities in generation requests; the backend also ignores legacy player fields in prompts, and reuses a shuffled Team A AI-generated deck for Team B when no separate local Team B deck exists. This removes a second serial provider call in the worst-case AI-only startup path; independent local decks and the Team-B-only AI-fill path remain intact.
- Cloudflare output ceilings: 1,024 tokens for one-item Imposter and five-item GuessUp charades; 2,048 tokens for five-item Party Arcade prompt batches. Longer Truth/Dare/statement responses retain the configured limit. Gemini/Groq provider parameters are unchanged.
- Added unit-source coverage for deck reuse, privacy, output ceilings, and static release-contract checks.
- Verification limitation: Bun 1.4.4 and workspace dependencies are not installed in this authoring runtime. The Bun typecheck, lint, unit tests, release-contract script, production build, and Playwright suite have not been run here. The source is ready for verification in the project's pinned Bun environment; live model latency still requires deployed uncached provider requests.


## 2026-11-09 — User-reported frontend lint warning

- User-provided Oxlint output: frontend lint completed with 0 errors and one `react-hooks(exhaustive-deps)` warning for unnecessary dependency `save.players` in the `draw` callback at `AppShell.tsx:496`.
- Source correction: removed only `save.players` from that callback dependency array. Inspection confirms `draw` does not read `save.players`; roster checks and snapshots remain in game-start code, and per-player content selection receives `playerName` explicitly.
- The user's pasted output does not include the backend lint result. This authoring environment does not have Bun/workspace dependencies, so native frontend/backend Oxlint reruns and the full Bun check are not claimed. Re-run `bun run --filter @king-fun/frontend lint && bun run --filter @king-fun/backend lint` on this archive.


## 2026-11-09 — Cloudflare GPT-OSS output-limit follow-up

- User's latest Windows Network/console screenshot shows the provider is no longer primarily timing out: the API returns the explicit safe error mapped from OpenAI `finish_reason: "length"` — the model exhausted its configured completion token budget before the content batch was complete. The CSP feedback script and Permissions-Policy warnings remain unrelated.
- Root cause in the then-current source: Cloudflare Imposter generation was hard-capped at 1,024 tokens even though the selected default is GPT-OSS 20B, a reasoning model. This budget could be consumed by model reasoning before the final one-word/20-hint JSON was completed. The Imposter prompt also contained contradictory instructions: it required the secret word in `text` but said to generate nothing except hints, and duplicated the same hint guidance several times.
- Raised only the Cloudflare one-word Imposter ceiling to 4,096 tokens (using a fixed backend-owned task budget); rewrote its prompt as one compact, consistent contract; removed irrelevant Imposter hint guidance from all non-Imposter prompts; and raised Cloudflare GuessUp/Party Arcade short-batch ceilings to 2,048/3,072 respectively. Gemini/Groq parameters, timeouts, provider order, game rules and batch sizes remain unchanged.
- Updated provider tests to assert the new budgets and non-contradictory prompt. Official Cloudflare model/API documentation confirms GPT-OSS 20B is a reasoning model with low/medium/high reasoning modes, and documents `max_tokens` as the generation budget. See [GPT-OSS 20B](https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/) and [OpenAI-compatible endpoints](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/).
- Verification boundary: no Bun executable/workspace dependencies or live Cloudflare credentials are available in this authoring runtime. The targeted source assertions and static package checks remain pending local execution; a deployed uncached Imposter test is still required to confirm the model completes under the 52-second gateway deadline. Output budgets are fixed in backend code; no `AI_MAX_OUTPUT_TOKENS` deployment setting exists or is required.


## 2026-11-09 — Cloudflare GPT-OSS completion budget follow-up

- Screenshot diagnosis: the displayed generic `Reduce the batch size` truncation message is the pre-fix error string; current source reports a Cloudflare-specific message including the exact completion budget. This is evidence the screenshot came from a backend deployment predating the provider-specific diagnostic.
- Removed restrictive per-game Cloudflare output caps. GPT-OSS now receives the full configured task allowance (6,000 tokens for Imposter; 4,000 default for other requests), with fixed backend-owned task budgets.
- Confirmed Cloudflare documents GPT-OSS 20B as a reasoning model and `max_tokens` as its generation limit; Cloudflare's OpenAI-compatible docs also document the Chat Completions route and `rejectIfBusy`. Sources: https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/ and https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/.
- Added regression coverage for output budget, explicit global override, exact budget in truncation diagnostics, and non-empty partial JSON returned with `finish_reason: length`.
- Bun is unavailable in this authoring runtime; native lint/typecheck/unit/release-contract tests and a deployed uncached Cloudflare generation remain unverified.


## 2026-11-09 — Provider output-budget and backend lint correction

- Removed the unsupported `AI_MAX_OUTPUT_TOKENS` setting from the provider environment type and runtime calculation. `.env.example` never declared this setting; Cloudflare output budgets are now explicitly fixed in backend code (6,000 tokens for Imposter word/hints; 4,000 for other requests).
- Removed the misleading suggestion that operators should configure a nonexistent Vercel environment variable. Updated deployment/provider documentation and regression expectations accordingly.
- Rewrote the Cloudflare truncation test's mocked `fetch` callback as a block-bodied async function. This resolves the Oxlint parser error at `backend/tests/providers.test.ts:99` without changing the test's intended `finish_reason: 'length'` scenario.
- Verification: TypeScript transpile syntax checks passed for the modified provider adapter and provider tests; static release-contract audit passed 189/189. Native Oxlint and Bun tests could not be run in this runtime because Bun/workspace dependencies are unavailable; rerun the user's exact lint command locally.


## 2026-11-09 — Follow-up from user Bun check output

- User-provided run: both frontend and backend typechecks passed; frontend lint passed clean; backend lint completed with six `no-useless-escape` warnings in the partial JSON fixture; 249 of 250 unit tests passed.
- The only unit failure was an exact diagnostic-message mismatch: implementation emitted `6000` without a thousands separator and omitted a space after the sentence period, while the test expected `6,000` and the correctly separated sentence.
- Fixed the backend diagnostic to format numeric token budgets using `toLocaleString('en-US')` and preserve sentence spacing. Removed unnecessary quote escapes in the partial JSON fixture.
- This runtime has no Bun executable or installed workspace dependencies, so native Oxlint and Bun tests cannot be rerun here. The exact command to rerun is `bun run check`; expected focused changes are zero backend lint warnings and the previously failing truncation test passing.


## 2026-11-09 — Final correction from the 249/250 user Bun run

- The attached run reported 249/250 passing tests. The one failure was the Cloudflare `finish_reason: 'length'` diagnostic: the actual error string had `6000` rather than `6,000` and concatenated the next sentence without a separating space. Backend Oxlint also reported six `no-useless-escape` warnings for the intentionally partial JSON fixture.
- The diagnostic now uses a locale-formatted token count and joins two complete sentence fragments using an explicit single-space separator. The test retains an exact expected-message assertion.
- Rewrote the partial JSON fixture as a template literal, eliminating quote-escape warnings.
- Verified the provider adapter by invoking it with a mocked Cloudflare `finish_reason: 'length'` response under Node's TypeScript stripping: the thrown `SafeProviderError` is `INVALID_RESPONSE` and its message exactly matches the regression expectation, including `6,000` and the sentence separator.
- Native Bun/Oxlint and the full test suite still need to be rerun on the user's Windows workspace; Bun is not installed in this authoring runtime.
