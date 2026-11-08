# KING-FUN

![KING-FUN logo](docs/branding/king-fun-logo-source.svg)

KING-FUN is an original, free/open-source, local-first party-game PWA with 27 selectable game titles, including **Imposter**, **GuessUp**, **Truth or Dare**, **I Have Never**, social deduction, timed party games, conversation games, word puzzles, and couples modes. Most curated gameplay works without an account, AI key, paid service, or network connection after installation. Built-in Imposter categories generate their secret words and 20 word-specific hints through the AI provider pipeline when a round starts; locally authored/imported Imposter word packs remain available offline. The UI is mobile-first and responsive; local sessions, history, preferences, and custom packs are stored in IndexedDB.

## Current project baseline

- **Frontend:** React 19, Vite, TypeScript, accessible responsive UI, and installable offline PWA.
- **Backend:** Elysia + Bun public AI gateway in the root-level `backend/` workspace.
- **Workspace/toolchain:** Bun 1.4.4, one root `package.json`, two workspaces (`frontend/`, `backend/`), and one root `bun.lock`. Do not add npm, pnpm, Yarn, a second lockfile, or package-manager scripts from those tools.
- **Vercel deployment:** `frontend/` and `backend/` deploy as public Vercel Services; `/api` routes to the Elysia backend and `src-tauri/` is excluded.
- **Domain design:** framework-independent game rules, schemas, random selection, and persistence contracts remain in `frontend/src/domain/`.
- **Randomness:** Web Crypto with rejection-sampled integer selection. Committed game outcomes are durably persisted before reveal/animation when IndexedDB is available.
- **Startup loading:** The HTML entry is intentionally small; IndexedDB bootstrap and the React application shell load as async chunks while an accessible startup state is shown. The production budget measures the entry and deferred `AppShell` chunk separately.
- **Persistence:** IndexedDB is the primary durable store; localStorage holds only compact optional preferences and legacy migration data. BYOK secrets are memory-only.
- **Offline:** service-worker caching is restricted to KING-FUN's own static same-origin assets. Local content remains playable offline, with the explicit exception of metadata-only built-in Imposter categories, which generate their words through the provider pipeline when selected; manually authored/imported Imposter packs remain offline-capable.
- **UI/UX:** a Vercel/shadcn-influenced responsive design system, named SVG icons, synchronized persistent light/dark appearance, refined switches, subtle motion, and a pointer-reactive projected-3D ambient scene. The scene is optional, pointer-transparent, frame/DPR-capped, hidden-tab suspended, and disabled by reduced-motion preferences.
- **Accessibility:** semantic controls, keyboard operation, focus management, reduced-motion alternatives, and WCAG 2.2 AA as the target acceptance standard.

## Game scope

KING-FUN now exposes 27 selectable game titles. The four original implementations remain intact; 23 local-play additions use shared domain/session contracts and reusable presentation components.

**Original games:**
1. **Imposter:** local pass-and-play only. Classic, Mystics, and Chaos; private role reveals; hints; discussion; voting; Mr. White final guess; results. No online rooms or matchmaking.
2. **GuessUp:** local charades with packs/decks, editable teams, timed turns, Correct/Pass, scoring, handoff, and optional tilt/sound/haptics. Covers the report's Charades / Tilt It style family with dedicated Tilt It below.
3. **Truth or Dare:** All together, Spin the wheel, and One at a time; separate eight-sector Truth/Dare wheel, prompt, reactions, skip, replace, report, and opt-out.
4. **I Have Never:** All together, Spin the wheel, and One at a time; group responses, points/fingers/stories, reactions, skip, report, and exhaustion handling.

**Added local games:** Timer Impostor; Werewolf; Mafia; Murder; Fake It; Fake Story; Fact or Fiction; Wrong Answers Only (also Opposites Day); Hot Bomb; Hot Bomb Duel; Who's Most Likely; Would You Rather; Share or Pass; $20 Challenge; Tilt It; Letterburg; Discussion Starter; Who Am I?; Ten Tangle; Qupid; Questions for Love; A or B; and Reverse Singing. Setup options include Werewolf/Mafia phone narrator and hidden-team size, 8/10/12/15-second Hot Bomb fuse, Tilt It/Letterburg team or solo play and 30/45/60/90/120-second turns, Wrong Answers Only spoken prompts, $20 Challenge anti-items filter, and Reverse Singing Classic/Battle.

The additions are documented in [`docs/party-arcade-game-specs.md`](docs/party-arcade-game-specs.md). The report does not supply sufficient rules for Touchdown, Secret Suitcase or Comedy God; these are not shown as fake playable stubs. `Torment of Choice` is treated as overlapping the existing Would You Rather concept. Fake It implements the report's local secret-word and yes/no-question loop with a group-visible category cue and metadata-only answer; its broader reference-app rules remain uncertain. Qupid currently ships 10 original local prompts, not the reference's claimed 1,000+ questions.

The report also describes remote rooms, chat, premium packs and subscriptions; these remain outside the KING-FUN product requirements. Share or Shot is adapted as **Share or Pass**: no alcohol, penalty, forced disclosure or explanation for skipping. `$20 Challenge` uses local group judging to preserve offline operation. Hot Bomb uses an explicitly documented two-strike elimination house rule because the supplied report does not specify a strike threshold. Its anti-items filter is an explicitly documented KING-FUN interpretation because the reference describes paying to avoid bad items without giving the exact cost/flow.

The supplied Mystery Who report remains authoritative for documented local Imposter rules. Undefined Troll Mode, elimination, faction-win, tie and no-vote outcomes are not invented. All 30 report-named general Imposter categories and the 18+ After Dark category are retained as metadata-only packs. No Imposter words or hints are bundled. After the game selects a category, it sends that category's title and description through the configured provider-order pipeline to generate five secret words with exactly 20 distinct, answer-safe hints each. Manually authored/imported word packs remain local and offline-capable.

## AI generation and Phase 5

AI generation is optional across KING-FUN overall, but built-in Imposter categories require the provider pipeline at round start. The frontend sends a user-triggered generation request through the root-level Elysia gateway. Gemini and Groq are optional BYOK providers whose keys are held in tab memory and require an explicit consent acknowledgement. Cloudflare Workers AI is the final operator-managed provider; its account/token/model secrets are server-only. Provider order and enabled flags may persist; secrets must not. Built-in Imposter categories and API-created custom categories both pass their title and description as theme context to the provider-order pipeline. Generated words are scoped to the selected category ID and use the existing global/per-category anti-repeat queues.

The backend exposes only `/healthz`, `/v1/status`, and `/v1/content/generate` (under `/api` through the deployment adapter). It validates provider/task/schema boundaries, streams bounded request and response bodies, uses fixed upstream URLs, applies timeouts and safe errors, and does not persist game sessions. Production generation fails closed unless a shared HTTPS Redis-compatible REST limiter is configured. The shared limiter atomically enforces per-client minute limits, global/provider daily request caps, and global concurrency. These are request-count budgets, not guaranteed monetary spend caps; configure provider-side spending/usage alerts independently.

**Release state:** The user confirmed that the final Phase 5 archive worked on Bun 1.4.4. Their supplied run on the preceding build showed 161 tests passing, both workspace typechecks passing, and the frontend production build passing; the 16 test-fixture lint warnings were removed in the follow-up archive, and the user then confirmed the updated project worked. Phase 6 adds release-contract checks, explicit source-map suppression, gzip bundle budgets, a moderate-severity `bun audit` gate, and deployment/privacy checks. The exact Phase 6 archive still requires `bun run check` on the user's Bun 1.4.4 machine. Full screen-reader/device accessibility, field performance, dependency license review, hosted security/abuse tests, and release rollback/recovery rehearsal remain manual/operator acceptance gates. See [`docs/phase-6-release-hardening.md`](docs/phase-6-release-hardening.md) and `verification.md`.

## Phase 6 release hardening

The Phase 6 release gates are documented in [`docs/phase-6-release-hardening.md`](docs/phase-6-release-hardening.md). `bun run check` runs static accessibility/security contracts, lint, typecheck, tests, a moderate-severity dependency advisory audit, the production build, and measured gzip bundle/secret/source-map checks. Manual WCAG 2.2 AA, real-device performance, license review, hosted security, and rollback/offline recovery exercises remain required before a production release.

### Latest quality-run triage (2026-11-07)

The latest user-provided Bun 1.4.4 run passed 117/117 release contracts and the separate Playwright suite passed 20/20 tests. That `bun run check` stopped at frontend typecheck: Oxlint reported one React Compiler immutability warning in the ambient canvas renderer and TypeScript reported nullable-context errors (TS18049). The current source extracts the imperative canvas renderer into a module-level lifecycle function and explicitly narrows its 2D context; the release-contract audit now covers that boundary. Local static validation passes 118/118 contracts and an isolated strict TypeScript compile. Full workspace lint/typecheck, unit tests, dependency audit, production build/budget and the browser suite still require an exact-revision run under Bun 1.4.4. See `verification.md` for the precise evidence.

## Repository layout

```text
.
├── api/
│   └── [[...all]].ts        # Vercel Bun Function adapter -> backend/index.ts
├── backend/
│   ├── content/             # Request and provider-output validation
│   ├── providers/           # Gemini, Groq, Cloudflare adapters
│   ├── security/            # Bounded bodies, shared limiter, abuse controls
│   ├── tests/               # API/provider/schema tests
│   ├── dev.ts               # Local Bun HTTP server
│   └── index.ts             # Elysia application and route handler
├── frontend/
│   ├── public/              # PWA manifest, app icons, service worker
│   └── src/
│       ├── App.tsx          # Home page
│       ├── AppShell.tsx     # Navigation, state, persistence and start commits
│       ├── components/      # Reusable accessible UI and gameplay primitives
│       │   ├── ui/          # First-party UI + shadcn Base UI primitives
│       │   └── gameplay/    # Shared wheel, prompt and reaction primitives
│       ├── lib/             # Shared class-name utilities
│       ├── games/           # Original games plus lazy party-arcade controllers and reusable UI
│       ├── domain/          # Framework-independent rules and persistence
│       ├── content/         # Original bundled content
│       └── screens/         # Setup, history and settings
├── scripts/                 # Repository policy checks
├── docs/                    # Product, gameplay, provider and deployment docs
├── package.json             # Root Bun workspace and commands
├── bun.lock                 # Only package lockfile (root metadata corrected; dependency snapshots retained)
└── vercel.json              # Root deployment configuration
```

## Local development

Use Bun **1.4.4** from the repository root. The root lock's stale workspace-name metadata has been corrected; verify the frozen install before running the checks:

```sh
bun install --frozen-lockfile
bun run dev
```

In a second terminal, copy the restored root environment template and run the API locally.

PowerShell:

```powershell
Copy-Item .env.example .env
bun run dev:backend
```

Bash / zsh:

```sh
cp .env.example .env
bun run dev:backend
```

The template contains no credentials and keeps `AI_ENABLED=false`. Add real server-side credentials only to your ignored local `.env` or deployment secret store. Never put provider or limiter secrets in `VITE_` variables.

For Bun's module hot reload instead of process restart, run `bun run dev:backend:hot` from the repository root. The backend binds to `127.0.0.1:3001` by default. AI generation remains disabled unless `AI_ENABLED=true` is deliberately set after configuring local test credentials and controls.

The Vite dev server proxies `/api` to `http://127.0.0.1:3001`. Root commands:

Reverse Singing microphone recording requires a secure context: `https://` or
`localhost`. A phone opening the Vite server through an `http://192.168.x.x`
address will not receive a microphone permission prompt; use an HTTPS
development tunnel/certificate or test from localhost on the computer.

```sh
bun run check:policy
bun run lint
bun run typecheck
bun run test
bun run build
bun run check
bunx playwright install chromium
bun run test:e2e
bun run storybook
bun run build:storybook
```

`bun run check` performs repository policy validation, release contracts, Oxlint, TypeScript project checks, frontend and backend Bun tests, a moderate-severity dependency advisory audit, a production Vite build, and measured transfer-budget checks. Install Chromium once with `bunx playwright install chromium`, then run `bun run test:e2e` for browser-level responsive and axe coverage. Run `bun run storybook` or `bun run build:storybook` to review the shared component catalogue. Configure local environment values by copying `.env.example` to `.env`; AI remains disabled by default.

## Project documents

- `requirements.md` — normative product, functional, security, architecture, and deployment requirements.
- `instructions.md` — contributor and coding-agent rules.
- `checklist.md`, `todo.md` — implementation status and backlog.
- `tests.md`, `verification.md` — executable test catalogue and evidence register.
- `docs/gameplay-reference.md` — gameplay-video analysis and target interaction loops.
- `docs/party-arcade-game-specs.md` — all added game loops, modes, options, source boundaries and acceptance gates.
- `docs/mystery-who-local-reference.md` and `docs/references/mystery-who-full-report.md` — local Imposter rules and source report.
- `docs/ai-provider-routing.md` — provider routing, privacy, limits, model policy, and queue behavior.
- `docs/phase-5-deployment.md` — Vercel, environment, shared limiter, and operator procedure.
- `changelog.md` — every code/configuration/documentation delivery entry.

## Phase completion

Phases 0–4 have substantial source implementation. Phase 5 gateway and hosting configuration are implemented in source, including the requested root `backend/` migration and shared distributed request controls. The user confirmed Bun 1.4.4 frozen installation succeeds; the stale root workspace-name metadata that made the repository policy fail has been corrected in this archive. The full post-fix Bun CI pipeline, external service configuration, deployment, and manual browser/device/accessibility/offline acceptance remain gates. See `verification.md` for exact evidence and limitations.

## UI architecture and visual system

The responsive layout, theme tokens, shared component ownership, interactive ambient scene, package adoption boundaries, wheel sequence, motion/accessibility rules, and browser test matrix are documented in [`docs/ui-architecture.md`](docs/ui-architecture.md). The interface uses a 12-column responsive grid, Lucide icon registry, Base UI/CVA button primitives, accessible switches, native drag/drop plus keyboard provider-order controls, a keyboard command palette, CSS-owned shell/home transitions, first-party toast feedback, AutoAnimate list feedback, validated forms, and Playwright/axe/Storybook coverage. Motion, Sonner, and dnd-kit remain installed in the dependency manifest but are not imported by the current application source after bundle and React Compiler cleanup. Pixi/Three/physics/Rive/Lottie and other heavy packages remain feature-scoped and are not loaded into the initial route. The Truth or Dare `Spin the wheel` mode intentionally runs player selection followed by a separate eight-sector Truth/Dare wheel (four Truth, four Dare); both reuse the shared `SpinWheel` presentation component while selection remains in domain/AppShell logic. `All together` and `One at a time` retain distinct semantics.

## Shared generated content and creator controls

The optional Redis content cache, community content voting/moderation, and hidden creator-only Kailas mode are documented in [`docs/content-vault-and-creator-mode.md`](docs/content-vault-and-creator-mode.md). Configure the separate `CONTENT_VAULT_*` and server-only `KING_FUN_CREATOR_*` variables in `.env`; the features remain unavailable until their respective backend configuration is present.
