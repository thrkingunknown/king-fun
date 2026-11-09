# KING-FUN frontend

React 19 + Vite + TypeScript frontend workspace for the free/open-source KING-FUN local party-game PWA. This package is managed from the repository-root Bun workspace; all installation, lint, typecheck, test, and build commands should be run from the repository root.

## Current frontend features

- Home-page component in `src/App.tsx`; application shell, navigation and persistence in `src/AppShell.tsx`.
- Separate components for Imposter, GuessUp, Truth or Dare, and I Have Never.
- Local-first game state and IndexedDB persistence; all games except the built-in Imposter category path can use bundled/local content without an API. Manually authored/imported Imposter word packs remain playable offline.
- Shared accessible UI primitives, responsive Vercel/shadcn-influenced design tokens, named SVG icons, polished switches, persistent light/dark appearance, reduced-motion support, subtle component motion, and a CSS-only home hero illustration.
- A pointer-reactive projected-3D ambient canvas with orbital nodes and tap ripples; it is pointer-transparent, capped at 30fps/1.35 DPR, suspended on hidden tabs, and paused by system/in-app reduced-motion preferences.
- Phase 4 source implementation is complete for the specified local game loops: Truth or Dare and I Have Never have all three player modes, committed roulette, pack filters, reactions and local reports; GuessUp has editable teams, configurable deadline turns, 3-2-1 countdown, optional sound/haptics/tilt with touch fallback, scoring and handoff; Imposter implements the supplied Mystery Who local rules (Classic/Mystics/Chaos, role boundaries, private reveal, hints, discussion timer, multi-target voting, Mr. White final guess, all 30 report-named categories plus 18+ After Dark, validated custom pack import/export, cooldown and global last-10 protection). Built-in category packs contain metadata only and generate one word with 20 distinct hints per game start through the provider-order API; the shared vault accumulates validated words across rounds; manual custom packs remain playable offline. Online Imposter and report-undefined Troll/elimination/win/tie rules remain excluded. The user later confirmed a Bun 1.4.4 run on the Phase 5 screenshot-fix archive with both workspace typechecks, 161 tests, and the production frontend build passing; the final fixture-only lint cleanup removes its 16 no-useless-escape warnings. Phase 6 adds release-contract tests, security-header hardening, a native `bun audit` gate, source-map exclusion, and post-build gzip/secret/precache checks. Run the full root `bun run check` on the exact Phase 6 archive and complete the manual browser/device/operator acceptance before release. See `../docs/phase-6-release-hardening.md`, `../todo.md` and `../verification.md`.

## Project references

The Imposter local rules are derived from the full Mystery Who report at [`../docs/references/mystery-who-full-report.md`](../docs/references/mystery-who-full-report.md) and extracted in [`../docs/mystery-who-local-reference.md`](../docs/mystery-who-local-reference.md). The report's online mode is excluded. Root-level `requirements.md`, `instructions.md`, `todo.md`, `tests.md`, `checklist.md`, and `verification.md` define the current product contract. `../docs/project-chat-summary.md` records the major user decisions and phase history.

The frontend dependency toolkit now includes Tailwind CSS 4, shadcn configured for Base UI, Lucide React, Radix UI, Motion/GSAP, and optional interaction, graphics, physics, audio, state, data, and testing libraries. They are available to use, not blanket-integrated into every screen. Keep expensive renderers and animation engines feature-scoped and lazy-loaded; follow the accessibility, reduced-motion, offline, and licensing rules in root `instructions.md` §2.3 and `../docs/ui-architecture.md`.

## Commands

```sh
# From repository root after dependency/override updates
bun install --frozen-lockfile
bun run clean:legacy-imposter
bun run dev
bun run check
bun run build
bun run install:e2e-browser
bun run test:e2e
bun run preview
```

## Backend and AI integration

The Elysia + Bun API is no longer inside this package. It lives in the sibling root `../backend/` workspace, with `../backend/vercel.ts` as its Vercel Services entrypoint. The frontend Vite dev server proxies `/api` to `http://127.0.0.1:3001`; launch it from the root with `bun run dev:backend`.

Phase 5 source includes Gemini/Groq/Cloudflare Workers AI adapters, strict schema validation, bounded streaming requests/responses, safe errors, session-only BYOK, explicit key-transit consent, provider priority, local curated fallback where a matching local pool exists, and shared Redis-compatible production limits. Built-in Imposter category generation has no seeded word fallback by design. Provider keys stay in tab memory; only provider order/enabled flags persist. Cloudflare/Redis credentials remain server-only.

**Release gate:** the current dependency and advisory-override edits must pass `bun install --frozen-lockfile` and the full `bun run check` on Bun 1.4.4. The supplied log predates these edits. Deployment, operator secrets/billing controls, external tests, and browser/device acceptance remain outstanding. See `../docs/phase-5-deployment.md` and `../verification.md`.

For full product requirements and implementation status, read the repository-level `README.md`, `requirements.md`, `instructions.md`, `todo.md`, `tests.md`, `checklist.md`, and `verification.md`.


## Phase 2/3 implementation notes

- IndexedDB v2 is the durable persistence source for app state, sessions, history, and content packs. `localStorage` holds only compact, non-secret AI provider ordering/enabled preferences and the one-time legacy migration source; provider keys, session data, and player data are not stored there. Backups are JSON envelopes containing the normalized save snapshot and validated custom packs; imports require explicit confirmation and restore atomically.
- When IndexedDB is unavailable, the app remains usable in memory-only mode, exposes a warning, supports in-memory backup export, and offers retry/recovery. Do not present memory-only state as saved.
- The production Vite plugin emits `precache-manifest.json` containing hashed JS/CSS/font/image outputs, including lazy-loaded game chunks. Service worker v8 validates same-origin paths and precaches them before activation.
- Browser acceptance remains required for real IndexedDB, quota/private browsing, two-tab conflicts, offline first install/reload/update, keyboard/screen-reader, zoom/reflow, forced colors, motion, and device performance. See the repository-root `verification.md`.


## Branding

The product name is **KING-FUN**. The official crown-and-dice logo source lives at `../docs/branding/king-fun-logo-source.svg`; transparent 192px/512px PNGs are used for the header and favicon; padded brand-background 192px/512px PNGs are used for the Apple touch icon and PWA manifest.

The shared component and design-system contract is maintained in [`../docs/ui-architecture.md`](../docs/ui-architecture.md). Add reusable UI primitives under `src/components/ui/` and shared gameplay primitives under `src/components/gameplay/`; keep random selection, persistence, and game rules in `src/domain/` and the application orchestration layer.
