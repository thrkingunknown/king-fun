> **Historical baseline note (2026-11-06):** This document records the original four-game project state and earlier decisions. The current scope is expanded to 27 selectable local games; use `README.md`, `requirements.md` and `docs/party-arcade-game-specs.md` for the current catalogue and implementation contract.

# KING-FUN — Project decisions and implementation handoff
## Latest source remediation — 2026-11-06

- Fixed the latest native TypeScript error by typing the AppShell timeout ref as a browser `number`, matching `window.setTimeout`/`window.clearTimeout` even with Node timer declarations present.
- Fixed the CommandPalette React Compiler immutability warning by keeping both animation-frame IDs in effect-owned refs and cancelling both on cleanup.
- Rebuilt the editable provider rows as a four-track responsive grid with a direct accessible switch, visible identity track, native draggable handle/drop target, and explicit keyboard reorder actions.
- Changed the tiny home-art token labels to opaque white and verified 13.10:1–13.68:1 contrast against the four previously reported axe backgrounds.
- The user's last reported native run before this patch had 188/188 unit tests, both TypeScript projects, the 78-check source audit, and dependency audit passing; production bundle budget and four browser cases were still failing. The subsequent E2E log reported 11/13 passing with provider identity and contrast remaining. Source fixes are applied, but the latest exact archive still needs a native `bun run check` and `bun run test:e2e`.

## Current dependency update — 2026-11-06

- Frontend ecosystem installed and shadcn Base UI generated; package availability does not mean every package is imported by current game screens.
- Removed the stale `cn` and deprecated unused `prom-client` dependencies, and removed Storybook v8 interactions addon from Storybook 10.
- Corrected shadcn `cn()` helper and Vite/TypeScript `@/` alias.
- Dependency advisory lock resolutions updated; exact Bun audit rerun pending.
- Root `.env.example` restored with secrets blank and AI disabled.


**Last reconciled:** 2026-11-06

**Latest quality-gate triage — 2026-11-06:** The user's Bun 1.4.4 run on the preceding archive passed repository policy, the 58-check release audit, and both workspace typechecks; 184/187 tests passed. Three remaining failures were stale/missing source contracts (explicit light mode-card styling, History icon mapping, and E2E document scroll-width assertion), while frontend lint still reported the sortable transform helper warning. These are patched in the current source: explicit light mode-card states, the named History icon, a corrected `document.documentElement.scrollWidth` assertion, and helper-free dnd-kit transform string generation. Node release-contract audit now passes 62 checks; Chromium light-mode smoke passes at six viewport widths. The full Bun 1.4.4 test/audit/build pipeline and Playwright E2E still require a rerun on this updated archive. See `verification.md` for exact scope and limits.


This document is a concise implementation handoff. `requirements.md` and `instructions.md` are normative; `checklist.md`, `todo.md`, `tests.md`, and `verification.md` track work and evidence. The latest user-provided archive is the implementation baseline.

## Product and architecture

- KING-FUN is an original, free/open-source, local-first, mobile-first party-game PWA with 27 selectable games: the original Imposter, GuessUp, Truth or Dare, and I Have Never, plus 23 additional local-play games. The original four implementations remain protected.
- Imposter is local pass-and-play only. No online multiplayer, rooms, matchmaking, or server-side game sessions are in scope.
- Frontend: React 19, Vite, TypeScript, offline PWA. Backend: Elysia + Bun. Domain rules remain independent of React/storage/provider SDKs.
- Repository is now a root Bun workspace with packages `@king-fun/frontend` at `frontend/` and `@king-fun/backend` at `backend/`. The Vercel Elysia service entrypoint is `backend/vercel.ts`; the deployment config and package scripts are at repository root. Exactly one root `bun.lock` is intended.
- Bun 1.4.4 is pinned; no npm/pnpm/Yarn or nested lockfile is permitted.
- IndexedDB is the primary durable store. localStorage is only for compact preferences and legacy migration. The service worker caches same-origin static assets only.
- Web Crypto and unbiased integer sampling are used for game outcomes. A new game now constructs a complete next snapshot, including game data and recent queues, and commits it before switching to reveal/play. Imposter's role/hint shuffle uses integer selection and an active-round roster snapshot.

## Phase history and current implementation

### Phases 0–3 — architecture, domain, persistence, offline, shared UI

- Shared contracts, domain state machines, secure randomness, content selection, local packs, IndexedDB snapshots/migrations, backup/recovery, stale-tab conflict detection, PWA precache, service-worker cache isolation, accessible primitives, responsive shell, themes, and reduced motion are implemented in source.
- Browser integration acceptance remains required for IndexedDB failures, refresh/recovery, two tabs, offline installation/deep links, accessibility, and representative devices.

### Phase 4 — four local games

- Imposter has Classic/Mystics/Chaos, Civilian/Mystic/Mr. White, private reveal, hints, discussion, voting, skip, Mr. White guess, results, custom packs, category-first selection, and global last-10 exclusions. Report-undefined Troll/elimination/faction-win/tie mechanics remain intentionally absent.
- GuessUp has editable teams/decks, timed rounds, Correct/Pass, scoring, handoff, optional tilt/audio/haptics, and local reports.
- Truth or Dare has all three player modes, separate player and Truth/Dare wheels, manual choice, reactions, replace/skip/opt-out/report.
- I Have Never has all three player modes, neutral response methods, group responses, points/fingers/stories, skip, reactions, and reports.
- All 30 general Imposter categories plus the 18+ After Dark category remain available as metadata-only packs. No built-in Imposter words/hints are bundled; category-first rounds pass the selected title/description through provider order and generate exactly one secret word per game start with exactly 20 distinct answer-safe hints, regardless of provider; the shared vault accumulates validated words across sessions. Manual local packs remain the offline path.

### Phase 5 — AI provider gateway and hosting

- Gemini and Groq are optional BYOK providers; key state is tab-memory only. The Settings dialog requires an explicit consent acknowledgement and explains that a key travels through the King-Fun gateway to the chosen vendor. Provider order/enabled settings persist; secrets do not.
- Cloudflare Workers AI is pinned as the last remote provider, with Account ID/token/model held in server-side environment variables.
- Backend routes: `/healthz`, `/v1/status`, and `/v1/content/generate`; root API adapter exposes them under `/api`. The request contains only the required task/category/locale/suitability/count/recent queue; no player names or private game state are sent.
- Backend adapters use fixed HTTPS endpoints, request/response streaming bounds, safe schemas and errors, timeouts, output validation and stable IDs. Client fallback tries each selected provider once, then uses matching local curated content if available.
- Production uses a shared Redis-compatible REST Lua limiter for per-client minute, global daily, provider daily, and global concurrent request caps. Per-client keys use deterministic HMAC across serverless instances. Production fails closed when the shared store is missing or unhealthy. Local development uses bounded process counters. These are request-count controls, not monetary spend caps; provider billing controls remain necessary.
- Vercel is selected as the initial one-origin host. The root project uses Vercel Services with `frontend/` public at `/` and `backend/` public at `/api/*`; `src-tauri/` is excluded. The backend service uses `backend/vercel.ts` and the frontend service emits `dist`. Preview smoke testing is still required before production.

## Security and product invariants

- Local gameplay state, rules, role assignment, voting and persistence remain device-local. The explicit content exception is the built-in metadata-only Imposter catalogue, which requires provider-order generation; manually authored/imported Imposter word packs and the other local content pools remain playable offline.
- No BYOK/provider/Redis/Cloudflare secret may enter `VITE_` variables, localStorage, IndexedDB, backups, service-worker cache, logs, analytics, traces, or game snapshots.
- No server-side game-state database, online Imposter, arbitrary URL proxy, or player-history upload.
- Keep exact CORS origins, HTTPS production requests, bounded streamed input/output, concurrency/rate/request caps, kill switch, safe errors, and provider-side billing alerts. CORS is not authentication.
- Do not claim request quotas are monetary spend caps. Verify actual account billing/alerts with the provider operator.
- Update `changelog.md` for every source/config/documentation change. Do not invent undocumented game rules.

## Verification and release blockers

- Historical evidence: a prior user-provided Bun run passed a 102-test snapshot; a Node 22 compatibility harness later passed 144 tests with two dependency-bound files excluded. The user subsequently supplied a Bun 1.4.4 Phase 5 run with 161 tests, both workspace typechecks, and the production frontend build passing. Phase 6 introduces additional source/release tests and requires its own exact-archive run; see `verification.md`.
- The user later verified on Bun 1.4.4 that root `bun install` and `bun install --frozen-lockfile` both succeed. The remaining policy failure was caused by Bun issue #47656: after a root package rename, Bun can retain the old root `name` label in `bun.lock` even though the dependency snapshots are current and frozen installation passes. The corrected archive updates only `workspaces[""].name` to `king-fun`; it preserves pinned dependency versions. The complete post-fix Bun check still needs to be run.
- No Vercel account, Upstash database/token, Gemini/Groq test keys, Cloudflare operator credentials, deployed service, provider billing controls, or actual production logs were available. None were configured or tested.
- Manual browser/device acceptance remains open: touch, keyboard, screen reader, reduced motion, 320px/reflow, IndexedDB persistence/recovery, offline install/resume, timers, tilt, and roulette.
- Phase 5 source work has advanced; release acceptance is not passed. Phase 4 word-specific-hint curation remains incomplete; AI category metadata generation/selection and generated-pack persistence are implemented in source.

## Immediate next steps

1. From repository root, run `bun install --frozen-lockfile` and then `bun run check`; the root lock metadata workaround is already applied in the corrected archive.
2. Resolve all lint/type/test/build diagnostics without weakening checks.
3. Configure Vercel with root directory `.`, exact origins, shared Upstash-compatible REST limiter, Cloudflare server credentials, AI kill switch initially off, and provider usage/billing restrictions.
4. Verify Preview routes and shared limiter behavior across multiple function instances with throwaway provider keys; inspect logs/traces for secret leakage.
5. Complete browser/device/accessibility/offline acceptance and verify runtime Imposter category prompt quality/provider failure handling before release.

- On 2026-11-05 the user supplied the first full root `bun run check` log on Bun 1.4.4: frozen install and repository policy passed; Oxlint emitted one React immutability warning plus six intentional control-regex warnings; frontend typecheck failed at three `RequestInit.signal` call sites (`TS2379`) and the non-category fallback map (`TS7053`). The follow-up source fixes use `signal ?? null`, stable item-kind narrowing, elapsed-time music sequencing, and a shared control-character validator with tests. Full native rerun is still pending.

## 2026-11-06 — UI finish follow-up

- The current Phase 6 archive already contained the Truth or Dare player wheel and separate Truth/Dare wheel. The `spin-wheel` mode persists a player result before animation, then persists the challenge result before its animation. The implementation was reviewed and guarded with additional source contracts.
- Added shared named SVG `Icon`/`GameMark` components and updated primary app chrome, home cards, setup selectors, pack cards, and wheel controls to use them. Legacy pack emoji metadata remains only for backwards-compatible import/export; it is no longer used as the pack-card icon.
- Expanded light-theme styles and documented reusable component ownership, theme requirements, motion/accessibility rules, and future-mode extension in `docs/ui-architecture.md`.
- Historical note from the 2026-11-05 UI pass (superseded by the 2026-11-06 dependency update at the top of this document): external UI packages were not added in that earlier archive because Bun/registry access was unavailable. The user subsequently installed Tailwind 4, shadcn/Base UI, Lucide React, Radix UI, Motion/GSAP, and optional visual/interaction packages with Bun 1.4.4. The generated shadcn primitives were moved into the existing `frontend/src/components/ui/` and `frontend/src/lib/` structure. MUI and Framer Motion remain intentionally absent.
