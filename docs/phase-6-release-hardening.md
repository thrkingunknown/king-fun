# Phase 6 — Release hardening and acceptance plan

**Review date:** 2026-11-05  
**Status:** source-level release gates added; manual browser/device, live audit, hosting and recovery evidence still required.  
**Scope:** accessibility, performance, security/privacy, and release/recovery rehearsal. This phase does not redefine game mechanics. The original four titles remain the baseline; the 23 additional Party Arcade titles are covered by the separate `party-arcade-game-specs.md` and its browser/device acceptance gates.

## 1. Release gate summary

Phase 6 adds repeatable repository checks for deployment security headers, frontend privacy boundaries, accessibility implementation contracts, source-map suppression, dependency advisories, and production bundle budgets. The gates are part of `bun run check`:

1. `check:policy`
2. `check:release-contracts`
3. `lint`
4. `typecheck`
5. `test` (including `scripts/` release-contract tests)
6. `security:audit` (`bun audit --audit-level=moderate`)
7. `build` (Vite build followed by `check:build-budget`)

`bun audit` reads the root `bun.lock`, queries the registry advisory service, and exits non-zero when advisories at or above the configured severity remain. It does not assess license compatibility; that remains a separate release-review item. See the [Bun audit documentation](https://bun.com/docs/pm/cli/audit).

## 2. Accessibility review (WCAG 2.2 AA target)

### Source controls now enforced

- The document declares a language and viewport.
- The app provides a skip link to the main landmark and moves focus to the main landmark when the active screen changes.
- Keyboard focus is visibly outlined; forced-colour mode uses system highlight colors.
- Focused controls receive `scroll-margin-block` so sticky navigation is less likely to obscure them after keyboard navigation.
- Buttons and links in the app shell use a 44 CSS-pixel minimum block size as a design target. WCAG 2.2 AA Target Size (Minimum) is 24 × 24 CSS pixels, with defined exceptions; 44 × 44 is a stronger touch-target design target, not the AA minimum.
- System `prefers-reduced-motion` and the saved in-app reduce-motion setting suppress decorative motion and smooth scrolling.
- Critical setup, confirmation, and BYOK dialogs use native `<dialog>` with `showModal()`, accessible names/descriptions, Escape handling, and browser-managed modal focus behavior.
- Status feedback uses polite live regions. Generated content is rendered as text, not inserted as HTML.

### Manual acceptance — not yet performed

Run on the deployed Preview and local production build. Record browser/OS/assistive-technology versions, pass/fail, and screenshots or screen recordings for every failure.

| Test | Required exercise | Pass condition |
|---|---|---|
| Keyboard-only | Tab/Shift+Tab/Enter/Space/Escape through home, settings, each setup, each full game loop, history, dialogs and destructive actions | Every action has a keyboard path; order is logical; no keyboard trap; focus remains visible |
| Screen reader | NVDA + Firefox or Chrome on Windows; VoiceOver + Safari on iOS/macOS | Landmarks/headings/labels/state and game-status changes are announced; secret handoff content is understandable without leaking another player's role |
| Reflow | 320, 360, 390, 768, 1024 and 1440 CSS-pixel viewport widths; 200% text zoom and 400% browser zoom | No loss of required information/functionality or two-dimensional page scrolling except essential game visuals |
| Contrast | Both themes; normal, hover, focus, disabled, selected, warning and error states | Text and non-text contrast meet applicable WCAG 2.2 AA requirements |
| Pointer targets | All controls, especially icon buttons, player chips, prompt/report actions, modal actions and wheel controls | At least 24 × 24 CSS px or a documented WCAG 2.5.8 exception; aim for 44 × 44 where practical |
| Focus not obscured | Sticky header, sticky Imposter handoff button, wheel controls, mobile keyboard and open/closing dialogs | Focused control is not entirely hidden by author-created content |
| Motion | OS reduce-motion on/off and saved in-app reduce-motion on/off | Non-essential animations/transitions are suppressed; all actions remain available |
| Forced colors | Windows High Contrast / forced-colors mode | Focus, controls, selected state and boundaries remain discernible |

W3C references: [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/), [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), and [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow).

## 3. Performance review

### Automated transfer budgets

`scripts/check-build-budget.mjs` runs after the production Vite build. It measures actual emitted entry assets and all four original game chunks plus the seven Party Arcade controller-family chunks using gzip, validates the precache manifest, rejects production source maps, and scans the emitted client files for common provider/operator secret patterns.

| Asset class | Provisional hard ceiling |
|---|---:|
| Initial JavaScript | 150 KiB gzip |
| Initial CSS | 20 KiB gzip |
| Initial JavaScript + CSS | 170 KiB gzip |
| Each independently lazy-loaded game JS chunk | 12 KiB gzip |

These are guardrails chosen with headroom over the user-supplied 2026-11-05 production build evidence, not a substitute for real-device performance measurements. The earlier observed build reported 124.96 KiB initial JS gzip, 14.42 KiB CSS gzip (139.38 KiB combined), and game chunks of 3.82–6.26 KiB gzip. Re-measure the exact delivered archive after `bun run check`.

### Field and device acceptance — not yet performed

Test a representative mid-range Android phone, a lower-end Android device if available, a current iPhone, and desktop Chrome/Firefox/Safari. Capture Lighthouse/Web Vitals and CPU/network-throttled traces on the production build, not the Vite development server.

Recommended field targets at the 75th percentile are LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1. These are Google's current “good” Core Web Vitals thresholds; record mobile and desktop separately. They are targets, not observed KING-FUN measurements. See [Google's Core Web Vitals guidance](https://developers.google.com/search/docs/appearance/core-web-vitals).

Profile home-to-game navigation, first game entry, Imposter reveal/handoff, GuessUp countdown/card transitions, Truth-or-Dare wheel, I Have Never response progression, settings open/close, and session resume. Inspect long tasks, layout/paint, animation frame stability, main-thread work, memory growth over a 30-minute session, and cold/warm route loads. Change animations only when a trace demonstrates a measurable bottleneck.

## 4. Security and privacy review

### Automated/source-level controls

- Root `bun run check` includes `bun audit --audit-level=moderate`.
- The direct Elysia dependency floor is `^1.4.31`; the lockfile resolves Elysia 1.4.31. This is above the public Elysia 1.4.x patched versions documented for the URL-format ReDoS (1.4.26), cookie prototype pollution (1.4.27), multipart quadratic parse (1.4.29), and the September/October 2026 advisories fixed in 1.4.30. The lockfile audit remains authoritative for the entire dependency graph. References: [Elysia advisories](https://github.com/elysiajs/elysia/security/advisories), [Elysia 1.4.30 release](https://github.com/elysiajs/elysia/releases/tag/1.4.30), [GHSA-f45g-68q3-5w8x](https://github.com/advisories/GHSA-f45g-68q3-5w8x), [GHSA-8hq9-phh3-p2wp](https://github.com/advisories/GHSA-8hq9-phh3-p2wp), and [GHSA-9643-4qgh-g8mx](https://github.com/elysiajs/elysia/security/advisories/GHSA-9643-4qgh-g8mx).
- The browser bundle must not contain Cloudflare operator credentials, Upstash REST credentials, or Gemini server-side keys. Build output is scanned by the bundle-budget gate; the source contract also checks client source boundaries.
- Gemini/Groq BYOK values remain in tab memory only, require explicit consent, are sent only for user-triggered HTTPS generation, and are excluded from persisted preferences. Provider/operator keys are not accepted as Cloudflare client headers.
- AI provider content is treated as untrusted text; unknown properties and invalid output are rejected by the backend schema. No `dangerouslySetInnerHTML`, `.innerHTML` assignment, or `insertAdjacentHTML` is allowed in frontend source.
- Request bodies and provider responses are bounded. Fixed upstream URLs, provider allowlists, exact origin allowlists, HTTPS requirements, timeouts, safe errors, request limits, provider budgets, shared concurrency leases, and a production kill switch are implemented.
- Vercel response headers set CSP with same-origin-only scripts, no objects or framing, no external connections, same-origin workers, and secure transport. `style-src 'unsafe-inline'` remains solely because current React UI uses inline style attributes for geometry/progress; inline scripts and `eval` remain blocked. The root Vercel configuration also sets HSTS, nosniff, frame denial, Permissions Policy, COOP, and CORP. Cache headers keep the service worker revalidating and hashed assets immutable.
- Backend JSON responses set `no-store`, `nosniff`, `no-referrer`, frame denial, restricted Permissions Policy, COOP and CORP. No player/session/prompt/role/vote/history records are stored by the backend.

**Separate API origin:** the default deployment is same-origin `/api`. If `VITE_KING_FUN_API_URL` is set to a different HTTPS origin for production, update the exact production `connect-src` directive in `vercel.json` to include only that origin and include it in `FRONTEND_ORIGINS`. Do not use `*` or broad scheme wildcards. Otherwise CSP will correctly block the external API.

### Operator checks — not yet performed

- Run `bun audit --audit-level=moderate` from the root with registry access and retain the full report. Review all skipped/unmatched packages, not just the exit code.
- Review direct and transitive licenses and notices from installed package metadata; confirm compatibility with the chosen project license and include required notices in distribution. `bun audit` does not perform license review.
- Review outdated/deprecated package status. Do not run `bun update` as a substitute for a controlled upgrade review.
- In Vercel Preview, verify response headers in DevTools and use a CSP report/test path to identify legitimate blocked resources. Do not weaken `script-src` with inline/eval exceptions to silence errors.
- Use throwaway provider keys. Verify no BYOK key appears in browser storage, IndexedDB, backups, service-worker cache, Vercel logs, tracing, analytics, error telemetry or support exports. Revoke the throwaway keys afterwards.
- Exercise denied origins, missing Origin, malformed content type/body, oversized chunked body, invalid provider, client-supplied Cloudflare credentials, extra model/URL fields, provider 401/403/429/5xx, timeout, malformed JSON, refusal, truncation, duplicate/unsafe response, same-client bursts, cross-instance quotas, shared-store outage and kill switch.
- Confirm vendor-side billing caps/alerts directly. Request-count quotas in KING-FUN are not monetary caps.

## 5. Release and recovery rehearsal

Run this matrix in disposable browser profiles and a Vercel Preview before production. Export backups before testing destructive/reset/migration cases. Never clear a user's real browser storage to simulate failure.

| Test | Exercise | Required evidence |
|---|---|---|
| Clean install | Fresh profile, install PWA online, open all 27 selectable games once, close/reopen | Install/start screenshots, browser + OS versions |
| Offline first cached startup | After first full successful cache, disable network and reload home, deep link and all registered game journeys | Network offline state; no failed static asset requests; gameplay works from bundled packs |
| Lazy chunk precache | Install without visiting every game, go offline, open each game | Confirms each game chunk is in install precache, not just runtime cache |
| Service-worker upgrade | Install release N, deploy release N+1, reopen, verify waiting/activation/cache namespace cleanup | SW versions, cache names, console and network capture |
| Rollback | Deploy N+1 in Preview, roll back to N, reopen existing client and reload | No blank app; old/new hashed assets and active SW recover predictably |
| Data migration | Seed supported older snapshot version, launch new build, inspect IndexedDB and resume | Migration result and backup hashes; source snapshot kept until commit succeeds |
| Interrupted storage | Simulate quota/transaction failure in disposable profile during save/import | Honest memory-only warning; no falsely confirmed durable save; recovery/retry works |
| Backup and restore | Export complete backup; restore in another disposable profile; compare players/preferences/history/custom packs | JSON envelope, record counts and canonical data comparison |
| Multi-tab conflict | Modify the same active session in two tabs; save from stale tab | Explicit stale revision conflict; no silent overwrite |
| Release notes | Review game changes, known limitations, migrations, security notices, rollback build | Final release note and build identifier archived |

## 6. Current evidence and open gates

| Area | Source implementation / automated gates | External evidence | Status |
|---|---|---|---|
| Accessibility | Skip/main focus, focus visible, forced colors, reduced motion, native dialogs, live regions, target sizing, 62 Node release-contract checks | Keyboard/screen-reader/zoom/reflow/contrast/manual audit not supplied | In progress |
| Performance | Independent lazy chunks, gzip budgets, precache check, source-map exclusion, secret scan | Existing user build snapshot meets provisional numbers; current archive build + target device/Lighthouse traces not rerun | In progress |
| Security/privacy | Elysia floor, CSP/headers, same-origin API default, BYOK boundary, backend no-store/security headers, rate/budget controls, audit command in quality gate | Native `bun audit`, license/deprecation report, hosted header/key/log/abuse checks not supplied | In progress |
| Recovery/release | Automated SW/storage contract tests and release rehearsal procedure | Browser install/upgrade/rollback/offline/data migration/quota rehearsal not supplied | In progress |

**Do not mark Phase 6 complete** until these manual and operator evidence rows are filled in `verification.md`, all serious accessibility/security findings are resolved, native Bun checks pass on the exact release commit, and a Preview recovery rehearsal succeeds.

## 7. Visual finish and reusable component architecture — source update 2026-11-06

The UI architecture and component boundaries are documented in [`ui-architecture.md`](ui-architecture.md). The Truth or Dare `spin-wheel` mode already contains two separate stages in source: a persisted player wheel followed by a persisted Truth/Dare wheel. The distinction is intentional; all-together and roster-order modes do not randomly select an individual player.

This update adds a shared named SVG icon component and game-ID icon mapping, replaces text glyphs in primary game cards/navigation/setup/wheel controls, improves the theme switch affordance, adds broader light-theme surface and foreground overrides, and adds wheel visual hierarchy while preserving deterministic saved outcomes. This is source-level evidence only; it does not certify visual contrast, animation quality, or responsive behavior without browser testing.

The frontend manifest now includes Tailwind CSS 4, shadcn (Base UI preset), Lucide React, Radix UI, Motion, GSAP, and the requested optional UI/animation/graphics packages. shadcn initialization succeeded in the supplied Windows log and generated the Base UI button, local class utility, and `components.json`. The generated button and utility were placed under the existing `frontend/src/` source tree so the configured `@/` alias and established component layout remain consistent. The local `cn()` utility uses `clsx` + `tailwind-merge`; Vite and the app TypeScript project both resolve the configured `@/` alias. Package availability does not mean every library is integrated into gameplay: the existing first-party icon wrapper and CSS motion remain the current app-wide implementations, while optional engines should be imported by feature and lazy-loaded. MUI and Framer Motion are not dependencies. Storybook's obsolete v8 interactions addon was removed from the Storybook 10 dependency set.

The user's supplied Bun output reports that lint, both workspace typechecks, and 171 tests passed on the pre-fix dependency tree. The moderate advisory audit failed on older resolved transitive versions of esbuild, glob, and minimatch. The current lock now pins the corresponding dependency edges to patched releases using root Bun overrides; the exact frozen install and `bun audit` still require confirmation under Bun 1.4.4 because Bun is not available in this authoring runtime.

## Latest quality-gate triage — 2026-11-06

The user's latest Bun 1.4.4 run on the preceding source archive passed both workspace typechecks and reported 184/187 tests passing. It exposed three failing static release-contract tests and one duplicated frontend React Compiler warning. The current source now supplies explicit light-theme mode-card states, uses the registered History icon, checks the correct `document.documentElement.scrollWidth` expression, and serializes dnd-kit transforms without `CSS.Transform.toString`. The Node source/config audit passes 62 checks and a Chromium 144 light-theme smoke passes at 320, 390, 620, 768, 1024, and 1440 px. This is not a native full-pipeline pass: `bun run check`, the moderate advisory audit, production build/budget, and Playwright/axe suite must be rerun on the updated archive before Phase 6 can be signed off.

## Latest native-run follow-up — 2026-11-06

The next user-provided logs reported: one `react(immutability)` warning from mutating a local retry-frame variable in `CommandPalette`; a browser `number` versus Node `Timeout` ref typing error in `AppShell`; hidden provider identities at phone/tablet widths; and four home-art token labels below 4.5:1 contrast. The current source now stores animation-frame handles in refs, uses a numeric browser timeout ref, gives provider identity and compact switch separate explicit grid tracks, and renders the four tiny token labels in opaque white. The provider switch accessible name references visible provider and ON/OFF text; the E2E test asserts that relation. These are source fixes with targeted static/Chromium fixture checks, not a claim that the integrated native pipeline now passes.
