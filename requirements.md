# Product and Engineering Requirements

**Baseline date:** 2026-11-04  
**Status:** Updated specification baseline after review of four user-supplied gameplay recordings. Gameplay fidelity and AI/backend requirements are normative targets; implementation is not asserted complete. The supplied Mystery Who local gameplay report is normative for Imposter; its online-mode details are excluded.  
**Normative language:** MUST = mandatory; SHOULD = recommended unless a documented exception exists; MAY = optional.

## 1. Product scope

Deliver a polished, original, mobile-first web portal containing Imposter, GuessUp, Truth or Dare, and I Have Never. The portal MUST support modern mobile and desktop browsers, local pass-and-play, resumable sessions, and offline core gameplay. AI-assisted generation is optional overall; the built-in metadata-only Imposter categories are the explicit exception and require the provider pipeline, while manually authored/imported Imposter word packs remain offline-capable. The project is free/open-source: no advertisements, paid tiers, premium locks, or mandatory accounts. There is no conventional DBMS or server-side game-history store.

The games are inspired by broad mechanics in public references, not copied assets, source code, branding, screen designs, wording, or content banks.

## 2. Functional requirements

### 2.1 Portal and shared experience

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-PORTAL-001 | The portal MUST expose every registered game with clear setup entry points. | All 27 selectable games are reachable from the portal; no dead-end cards; route refresh works. |
| FR-PORTAL-002 | The UI MUST use one shared design system with a distinct visual identity per game. | Shared typography/spacing/control patterns; each game is distinguishable without relying on colour alone. |
| FR-PORTAL-003 | The experience MUST be mobile-first and responsive. | Tested at narrow phone, wide phone, tablet, laptop, and desktop widths; no unintended horizontal overflow or clipped primary controls. |
| FR-PORTAL-004 | The user MUST be able to change motion/sound preferences and access settings. | Preferences persist locally; reduced-motion preference is respected. |
| FR-PORTAL-005 | Interactive elements MUST support keyboard and touch. | Every game can be completed without tilt, hover, or audio. |

### 2.2 Imposter — Mystery Who local rules

The complete user-supplied Mystery Who report is the local gameplay source of truth; online multiplayer is excluded. Detailed rules and known gaps are in [Section 4](#4-mystery-who-local-gameplay-reference). The full report is archived verbatim in [`docs/references/mystery-who-full-report.md`](docs/references/mystery-who-full-report.md), and its local-only extraction is maintained in [`docs/mystery-who-local-reference.md`](docs/mystery-who-local-reference.md). Built-in Imposter categories are metadata-only. Their title and description are passed to the AI provider-order pipeline at round start; no static Imposter answer or hint bank is bundled. Locally authored/imported custom word packs remain available offline.

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-IMP-001 | Support a unique local roster of 3–20 players. | Invalid rosters cannot start; names are non-empty and case-insensitively unique. |
| FR-IMP-002 | Assign word and roles once per round using Web Crypto. | Roles/word are committed before reveal; refresh does not reroll. |
| FR-IMP-003 | Support private pass-and-play reveal. | Reveal begins on pointer/key press without an artificial hold timer; conceal on release/cancel/focus loss and gate phone handoff. |
| FR-IMP-004 | Implement Classic, Mystics, and Chaos modes. | Classic has no Mr. White; Mystics has exactly one; Chaos follows report's random count/chance. |
| FR-IMP-005 | Enforce ordinary Mystic count bands. | 3–5:1; 6–10:2; 11–15:3; 16–20:4, preserving a Civilian. |
| FR-IMP-006 | Enforce role information boundaries. | Civilian gets category + word; Mystic category + optional hints; Mr. White category only. |
| FR-IMP-007 | Configure Mystic hints. | Off/on; same/different hints. |
| FR-IMP-008 | Configure discussion-only timer. | Off by default; 15–600 s in 15 s steps; 180 s default. |
| FR-IMP-009 | Support sequential multi-target voting. | Exactly ordinary Mystic count; self-vote and skip allowed; duplicates/invalid targets rejected. |
| FR-IMP-010 | Implement Mr. White final guess. | Threshold evaluated after all ballots; normalized exact comparison. |
| FR-IMP-011 | Present round results and voter visibility. | Word/category/roles/tally/hints/guess outcome; hidden-voter mode hides voter identities. |
| FR-IMP-012 | Support all 30 report-named built-in categories plus the existing 18+ category, with combined category selection. | Select one category uniformly before generation; pass its title and description to `generateAiContent` through the configured provider-order pipeline; generate five words with exactly 20 distinct, answer-safe hints each. No built-in Imposter word/hint entries are bundled. |
| FR-IMP-013 | Support local custom packs/categories. | Name, emoji, description, word + 1–20 hints, JSON/TXT import/export, CRUD; reject files larger than 1 MiB before reading/parsing. |
| FR-IMP-014 | Enforce global rolling last-10 word exclusion. | Compare stable IDs and normalized text; never silently repeat. |
| FR-IMP-015 | Preserve local preferences, round state, and offline play. | Theme/settings/session/history restore locally; manually authored/imported Imposter packs remain playable offline. Built-in metadata-only categories require an internet connection and an available provider/content-vault result when starting a round. |
| FR-IMP-016 | Optional AI content generation. | Elysia/Bun gateway, provider adapters, session-only BYOK UI, and local fallback are present in source; deployment and full verification remain open. |
| FR-IMP-017 | Do not invent undefined Mystery Who rules. | Troll Mode effects and elimination/win/tie transitions remain open until documented. |


### 2.3 GuessUp

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-GUESS-001 | The game MUST support team/round setup and a shuffled content deck. | Invalid teams/round settings are blocked; deck order is persisted. |
| FR-GUESS-002 | The active card MUST be readable at arm's length on a mobile display. | Manual usability test confirms legibility at normal holding distance. |
| FR-GUESS-003 | Correct and Pass controls MUST always be available. | Game is fully playable without device sensors. |
| FR-GUESS-004 | Tilt gestures MAY provide Correct/Pass shortcuts where supported. | Permission is requested only after user action; unsupported/denied sensor access degrades to buttons; users can disable tilt at any time; each action requires return to neutral before another tilt action. |
| FR-GUESS-005 | Timers and scores MUST be idempotent under repeated events. | Duplicate rapid taps do not double-score; reload reconciles the remaining timer. |

### 2.4 Truth or Dare

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-TD-001 | The game MUST configure/select eligible players and prompt packs. | Empty player list or empty pack cannot start. |
| FR-TD-002 | The selected player MUST be determined before wheel animation. | Stored winner and final wheel pointer agree; reload resumes same outcome. |
| FR-TD-003 | The game MUST present truth/dare choices and a prompt. | Prompt category/suitability match selected pack and ruleset. |
| FR-TD-004 | Players MUST be able to skip, replace, or opt out. | These actions are visible and never penalized by default. |

### 2.5 I Have Never

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-NHIE-001 | The game MUST support prompt packs and a response convention. | Pack and response method are selected before play. |
| FR-NHIE-002 | The game MUST support neutral response methods such as points, fingers, or reactions. | Drinking is not the default or required mechanic. |
| FR-NHIE-003 | The game MUST allow prompts to be skipped. | Skip advances safely without corrupting history or counters. |
| FR-NHIE-004 | The game SHOULD support optional custom packs. | Custom content is validated, locally persisted, editable, and deletable. |

### 2.6 Shared content and duplicate avoidance

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-CONTENT-001 | Every content item MUST have a stable ID, locale, pack, category, item kind, suitability, and provenance/license metadata. | Schema validation rejects missing required metadata. |
| FR-CONTENT-002 | Curated content MUST use shuffled stable-ID cycles and MUST NOT repeat within the current round. | Each eligible ID appears once per cycle; exhaustion is explicit and no silent wrap occurs mid-round. |
| FR-CONTENT-003 | Player selection MUST use the adaptive recent-player exclusion window defined in `docs/ai-provider-routing.md`. | For n >= 4, window = `max(1, round((n / 2) - 1))`; selection is uniform among eligible players. |
| FR-CONTENT-004 | Category selection MUST use an independent recent-category FIFO per game and the formula in `docs/ai-provider-routing.md`. | Category history for one game never changes another game's queue; exhausted filtering relaxes oldest-first only when required. |
| FR-CONTENT-005 | Every game/category/item-kind/locale combination MUST have its own recent-content queue. | Selection history and canonical duplicate rejection are scoped to the applicable game pool; exact/canonical duplicates within a game and current-round repeats are rejected, while the same display word may appear in a different game with independent mechanics/history. |
| FR-CONTENT-006 | Imposter MUST retain the source-parity last-10 word exclusion while adding category-aware generation exclusions. | The most recent 10 selected words are excluded globally across categories; the report confirms this scope. Compare normalized text and stable IDs; never silently relax the exclusion. |
| FR-CONTENT-007 | Reference-app prompts, word banks, artwork, sounds, branding, and layouts MUST NOT be scraped or copied. | Original content and assets have provenance; human review is part of release verification. |
| FR-CONTENT-008 | AI generation requests MUST receive the recent-item exclusions for the requested game/category/item kind only. | Request payload contains the correct queue and does not include player names, roles, votes, private words, or unrelated game queues. |

### 2.7 AI content generation and provider routing

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-AI-001 | AI generation MUST remain optional for the app overall; built-in Imposter categories are the explicit exception and always generate through the provider-order pipeline. | All other offline-capable content remains usable without AI; Imposter can be played offline with locally authored/imported word packs, while metadata-only built-in/API categories require connectivity and provider availability. |
| FR-AI-002 | Provider calls MUST pass through provider adapters behind a provider-neutral contract. | Game/domain modules import no provider SDK or vendor endpoint. |
| FR-AI-003 | The Settings screen MUST provide a drag-reorderable provider list with Gemini, Groq, and Cloudflare Workers AI in that default order. | Gemini and Groq can be reordered; Cloudflare is visibly pinned at the final position. |
| FR-AI-004 | Gemini and Groq MUST be disabled by default and require a user-entered API key before their toggle is enabled. | No-key switch is greyed out/disabled; settings icon opens a key dialog; saving a key unlocks but does not auto-enable the provider. |
| FR-AI-005 | Cloudflare Workers AI MUST be the always-active final fallback row, with no settings icon or toggle. | It is pinned at the bottom and uses server-side deployment credentials only. If backend/credential is unavailable, the app falls back to local content with an error snackbar. |
| FR-AI-006 | The active provider order MUST be snapshotted at round start and tried sequentially. | Each failed provider yields a safe snackbar before the next provider is attempted; provider order changes apply to the next round. Removed keys are immediately excluded. |
| FR-AI-007 | AI output MUST be runtime-validated before display or persistence. | Invalid schema, unsafe text, duplicate content, wrong locale/category, or insufficient output is rejected and triggers bounded fallback. |
| FR-AI-008 | Provider/model failures MUST produce useful safe error reasons and an optional curated-content fallback. | No raw provider payload, key, full prompt, or stack trace is displayed. Each provider is attempted at most once per generation request. |
| FR-AI-009 | The app MUST use a public Elysia + Bun API service as the provider gateway. | Backend source is in the root `backend/` Bun workspace; `backend/vercel.ts` is the Vercel Services entrypoint. Root package configuration owns both workspaces and the one root `bun.lock`. |
| FR-AI-010 | BYOK activation MUST disclose that the key passes through the public King-Fun API service and then to the selected provider. | Explicit consent is shown; Gemini/Groq keys are request-memory-only and cleared on reload/tab close; they are not persisted or logged. |
| FR-AI-011 | The public API MUST validate payloads/providers and enforce abuse/cost controls. | HTTPS, exact CORS allowlist, streamed body/output bounds, timeouts, shared-store per-client/global/provider request caps, concurrency, secret-handling tests, and an emergency AI kill switch are implemented in source; production billing controls and deployed-instance verification remain required. |
| FR-AI-012 | The model MUST receive only the recent queue for the requested game/category/item kind and be instructed to avoid repeats. | A batch of five original items is requested; app/server validation—not the prompt alone—enforces uniqueness and schema. |
| FR-AI-013 | Provider/model IDs and generation parameters MUST be revalidated against current official docs before deployment. | No volatile model ID, quota, price, or free-tier promise is hardcoded in UI or requirements. |


### 2.8 Video-derived gameplay and animation requirements

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-PLAY-001 | Each game MUST use a focused, mobile-first play surface with a distinct original visual identity and oversized primary prompt/role content. | Cards are readable at normal phone holding distance, fit without clipping, and adapt to desktop widths. |
| FR-PLAY-002 | Truth or Dare MUST support All together, Spin the wheel, and One at a time modes. | Mode-specific player selection and prompt sequencing work; the wheel result is committed before animation begins. |
| FR-PLAY-003 | Truth or Dare MUST include an animated roulette, explicit Truth/Dare selection, prompt card, next/replace/skip/opt-out, reactions, and a structured report action. | The challenge wheel has eight equal radial sectors (four Truth and four Dare); animation lands on the persisted outcome; every action is idempotent and accessible without motion. |
| FR-PLAY-004 | GuessUp MUST include a deck browser/filter, selected-deck summary, editable teams, configurable duration, a 3-2-1 ready countdown, high-legibility prompt cards, Correct/Pass, turn handoff, and result. | Complete button-only round is playable; duplicate inputs cannot double-score; timer expiry commits once. |
| FR-PLAY-005 | I Have Never MUST support All together, Spin the wheel, and One at a time modes. | Active player/response flow matches the selected mode; skip is separate from response. |
| FR-PLAY-006 | I Have Never MUST present a large statement card, optional reactions, next prompt, progress, and neutral response conventions. | Fingers/points/self-report are supported; alcohol is never required or default. |
| FR-PLAY-007 | Imposter private reveal MUST use a full-size color-coded 3D card with press-and-hold reveal, conceal-on-release, and explicit pass-phone handoff. | Card faces fill the card, never collapse/clip, and the next player cannot see private information before handoff. |
| FR-PLAY-008 | Shared transitions MUST include reduced-motion/static equivalents. | Wheel, countdown, card flip, team handoff, and result remain understandable with reduced motion enabled. |
| FR-PLAY-009 | Game setup SHOULD use grouped settings, compact pack/category pickers, and a persistent mobile primary action. | Actions remain visible and safe-area-aware without overlapping controls or the keyboard. |

### 2.9 Anti-repeat queue policy

The queue functions, capacities, queue keys, fallback behavior, and category-specific LLM context are normative as detailed in `docs/ai-provider-routing.md`. Queue state MUST be persisted locally, isolated by game/category/item kind/locale, and never uploaded as server-side game history. For n players (n >= 4), the player exclusion queue capacity is Math.round((n / 2) - 1); for k selected categories (k >= 4), the category exclusion queue capacity uses the same formula. The 2–3-category case uses a one-category cooldown. Content histories use independent game/category/item-kind/locale queues and per-round seen sets. The player selector now defaults to the adaptive window; production selection is scoped per game. Deterministic test helpers accept an explicit window for boundary/property tests.

## 3. Non-functional requirements

### 3.1 Privacy and security

| ID | Requirement | Acceptance criteria |
|---|---|---|
| NFR-SEC-001 | No project-owned API secret may be present in client bundles or source maps. | Automated secret scan plus bundle inspection finds no provider secret. |
| NFR-SEC-002 | BYOK keys MUST NOT be written to localStorage, IndexedDB, Cache API, logs, analytics, traces, or error telemetry. | Instrumented tests inspect all persistence/logging boundaries. |
| NFR-SEC-003 | AI output MUST be treated as untrusted text. | HTML/script injection payloads are escaped/rejected; generated HTML is never rendered. |
| NFR-SEC-004 | Public Elysia API routes MUST validate origin, input size, provider/task allowlists, and request schema. | Malformed and unauthorized calls receive controlled errors. |
| NFR-SEC-005 | Rate limiting and cost controls MUST prevent uncontrolled provider spend. | Tests cover request bursts, per-key/IP limits, and circuit breaker behavior. |
| NFR-SEC-006 | Game state MUST remain client-local. | Network inspection confirms no game session/roster is transmitted except explicitly approved minimal generation parameters. |
| NFR-SEC-007 | The public AI API MUST NOT be an unrestricted proxy. | Server-side provider/task allowlists, limits, CORS, edge rate controls, budget caps, safe errors, and kill switch are verified. |
| NFR-SEC-008 | BYOK keys MUST remain request-scoped and memory-only. | Keys are cleared on reload/tab close/removal and are absent from all browser/server persistence, backups, service-worker caches, and logs. |

### 3.2 Persistence and offline

| ID | Requirement | Acceptance criteria |
|---|---|---|
| NFR-STOR-001 | IndexedDB MUST store resumable sessions, history, and custom content. | State survives refresh/reopen when browser storage remains available. |
| NFR-STOR-002 | Stored records MUST have versioned schemas and migrations. | Current and prior supported schema fixtures migrate correctly. |
| NFR-STOR-003 | The app MUST handle quota failure, blocked storage, and private browsing gracefully. | User receives a clear warning and can continue in non-persistent mode where feasible. |
| NFR-STOR-004 | Multi-tab updates MUST detect stale revisions. | A stale writer cannot silently overwrite a newer active session. |
| NFR-STOR-005 | Users MUST be able to export/import a complete local backup. | Export contains a validated snapshot and custom packs; import validates before confirmation and restores atomically using revision compare-and-swap. |
| NFR-STOR-006 | Storage failure MUST degrade honestly and recover safely. | Current-session memory fallback remains usable; export works without IndexedDB; retry atomically reconciles in-memory pack additions and deletions; destructive force-reset requires explicit confirmation. |
| NFR-STOR-007 | Recovery MUST reconcile the complete in-memory custom-pack set, including deletions, atomically. | After storage retry, the durable pack set exactly matches the current tab's collection; interrupted replacement leaves the previous set intact. |
| NFR-OFF-001 | Static assets and bundled game content MUST support offline startup after first successful cache. | Offline reload opens the portal and core games. |
| NFR-OFF-002 | AI functionality MUST degrade gracefully offline. | AI is disabled with an explanation; curated content is available. |
| NFR-OFF-003 | The first successful production cache MUST include all lazy-loaded game chunks. | Vite emits a same-origin precache manifest; installation validates and caches every listed runtime asset; offline launch works without first opening each game online. |
| NFR-OFF-004 | Runtime cache reads MUST be isolated to King-Fun's own cache namespace. | A URL cached by another same-origin app is never returned as a King-Fun asset; offline fallback consults only the active King-Fun cache. |

### 3.3 Accessibility and UX

| ID | Requirement | Acceptance criteria |
|---|---|---|
| NFR-A11Y-001 | Target WCAG 2.2 AA. | Automated and manual accessibility audit is recorded; critical/serious issues are resolved. |
| NFR-A11Y-002 | Reduced-motion preference MUST be respected. | All non-essential motion is removed/reduced under system setting and in-app setting. |
| NFR-A11Y-003 | Sensor, colour, sound, and animation MUST NOT be the only way to operate or understand a game. | Keyboard/touch/text alternatives exist for all actions. |
| NFR-A11Y-004 | Focus, modal, and status behavior MUST be understandable to assistive technology. | Semantic landmarks, skip navigation, focus-visible styles, modal focus containment/restoration, live status/error announcements, and screen-change focus are present and browser-tested. |
| NFR-UX-001 | The portal MUST use an original cohesive design system and distinct game identities. | Visual review approves all registered game journeys. |
| NFR-UX-002 | The UI MUST support zoom/reflow and safe-area insets. | Test device rotations, enlarged text, mobile browser chrome, and virtual keyboard. |
| NFR-UX-003 | App theme and motion preferences MUST be applied consistently. | Saved theme updates the document color scheme/browser theme color; both the header and Settings controls stay synchronized and restore the saved value after reload; system and in-app reduced-motion choices suppress non-essential motion. |
| NFR-UX-004 | Decorative ambient graphics MUST be interactive without obstructing gameplay, input, or accessibility. | The projected-3D scene responds to pointer/touch position and background presses, provides a pause control, caps rendering at 30fps and 1.35 DPR, suspends in hidden tabs, and pauses under system or saved reduced-motion preferences; it must never capture pointers or own game state. |

### 3.4 Performance and maintainability

| ID | Requirement | Acceptance criteria |
|---|---|---|
| NFR-PERF-001 | Each game MUST be lazy-loadable independently. | Build analysis confirms unused game chunks are not loaded on initial route. |
| NFR-PERF-002 | Animation MUST avoid unnecessary layout/paint work. | Profiling shows transform/opacity-first transitions and no persistent long tasks during normal play. |
| NFR-PERF-003 | Performance budgets MUST be measured on representative target devices before being frozen. | Baseline includes initial transfer, JS execution, interaction latency, and animation profiling. |

**Phase 6 release guardrails (provisional, not a substitute for NFR-PERF-003 device evidence):** the production gate limits initial JS to 150 KiB gzip, initial CSS to 20 KiB gzip, combined initial JS+CSS to 170 KiB gzip, and each independently lazy-loaded game JS chunk to 12 KiB gzip. Budgets are provisional until mid-range/low-end device and field measurements are recorded.
| NFR-MAINT-001 | Dependencies and tools MUST be actively maintained and non-deprecated at selection time. | Dependency decision log has official source, version, license, compatibility, and review date. |
| NFR-MAINT-002 | Bun MUST be the only package manager and project command runner. | Repository has one Bun lockfile; scripts/CI use Bun; no npm/npx/pnpm/yarn commands. |
| NFR-MAINT-003 | Provider interfaces MUST remain replaceable. | Domain/game code contains no provider-specific types or endpoint strings. |
| NFR-MAINT-004 | Frontend and public API MUST use the same root Bun workspace lockfile. | Frontend and backend are separate root workspaces using exactly one root `bun.lock`; there is no nested lockfile or second package manager. |
| NFR-MAINT-005 | UI/UX, accessible component, motion, and icon libraries MAY be added when they materially improve the experience. | Each package is maintained, licensed, React 19/Vite/Bun-compatible, accessibility-reviewed, bundle-reviewed, and managed with Bun in the single lockfile. |

## 4. Mystery Who local gameplay reference

The complete user-supplied `MYSTERY WHO? — Game Architecture, Gameplay & Feature Analysis Report` is archived at [`docs/references/mystery-who-full-report.md`](docs/references/mystery-who-full-report.md) and supersedes earlier uncertainty about local rules. Implement its local modes and settings; ignore its online multiplayer sections.

### Confirmed local behavior

The full 30-category list and report-derived defaults are recorded in [`docs/mystery-who-local-reference.md`](docs/mystery-who-local-reference.md). The summary is intentionally limited to local play.

- 3–20 players; unique local player names.
- Modes: Classic (Civilians + Mystics, no Mr. White); Mystics (same plus exactly one Mr. White); Chaos (randomized 1–3 Mystics and 45% Mr. White chance from four players, preserving at least one Civilian).
- Ordinary Mystic count bands: 3–5: 1; 6–10: 2; 11–15: 3; 16–20: 4, constrained to preserve a Civilian.
- Civilian receives category + secret word; Mystic receives category + optional indirect hint(s); Mr. White receives category only.
- Mystic hints can be disabled; when enabled, Mystics can share one hint or receive different hints.
- Sequential private reveal starts immediately on press, conceals on release/cancel/focus loss, and uses an explicit phone handoff.
- Discussion timer is optional, applies only to discussion, ranges 15–600 seconds in 15-second increments, and defaults to 180 seconds (disabled by default).
- Voting is enabled by default. Each player submits a sequential ballot selecting exactly the ordinary Mystic count, or skips; self-voting is allowed and duplicate/invalid targets are rejected.
- After all ballots, Mr. White gets one final guess if they receive at least half of all submitted vote selections, rounded up. Guess comparison trims, lowercases, collapses whitespace, then compares exactly.
- Results reveal word, category, roles, vote tally, Mystic hints, and Mr. White guess outcome. Hidden-voter mode hides voter identities.
- 30 built-in categories; multiple categories can be selected and combined. Select a category uniformly from the eligible selected categories, then select a word from that category; display the selected word's category.
- Manual custom packs support name, emoji, description, word + 1–20 hints, JSON/TXT import/export, and local create/edit/delete.
- The last 10 words are excluded across categories after trim/lowercase/whitespace normalization. Exhaustion is explicit; never silently repeat.

### Explicitly undefined in the supplied report

The report does not define Troll Mode effects, civilian/mystic elimination and win conditions, or tie/no-vote gameplay transitions beyond tallying. Do not infer these from generic social-deduction conventions. Keep them open until a more detailed authoritative specification is supplied.

### Exclusions

Do not implement online rooms/lobbies, host migration, network synchronization, remote role delivery, online voting, chat, voice, matchmaking, or reconnect behavior as part of this local implementation. The report includes these for completeness, but the King-Fun owner explicitly said to disregard the online-mode material.

### Content-volume gap

The archived report's static audit describes 30 categories, 60 words per category (1,800 total), and 20 hints per entry; that is reference-source evidence, not a requirement to ship a static word bank. KING-FUN retains all 30 general category definitions plus its 18+ After Dark category as metadata-only packs. At round start, category selection happens first and the selected title/description are passed through the configured provider-order pipeline to generate five words, each with exactly 20 distinct 1–2-word hints. The server validates hint count, uniqueness and answer safety. No built-in Imposter answer or hint entries are shipped. Manual local packs remain available as the offline alternative.


## 5. AI provider routing, backend, and queue specification

The owner-approved provider and queue design is specified in [`docs/ai-provider-routing.md`](docs/ai-provider-routing.md). It supersedes the earlier single-provider dropdown and direct-Worker UI concept.

- Default order: Gemini (off; key required), Groq (off; key required), Cloudflare Workers AI (always on, pinned last, no gear/toggle).
- Gemini/Groq are reorderable. Their settings icon opens a key dialog; the toggle becomes available only after a key is entered and remains off until explicitly enabled.
- Enabled providers are attempted in saved order, with a safe snackbar for every fallback. Cloudflare Workers AI is always the final configured remote provider; curated local content is the final offline/exhaustion fallback.
- API gateway: public Elysia + Bun service in root `backend/`, managed as a separate workspace with the frontend under one root Bun workspace and root `bun.lock`. The service calls Cloudflare Workers AI through its REST API using server-only account/token/model configuration. It proxies user BYOK keys only for the request and never persists or logs them.
- The backend is public, not trusted. CORS is not authentication; exact origins, edge rate controls, payload validation, per-client limits, concurrency/time/token budgets, secret redaction, and a global kill switch are mandatory.
- Player anti-repeat for n >= 4: `max(1, Math.round((n / 2) - 1))`; category anti-repeat uses the same formula for k >= 4 and a one-category cooldown for k = 2–3. The full functions are in the linked design document.
- Content queues are separate by game/category/item kind/locale. Imposter retains its last-10 parity restriction; GuessUp, Truth, Dare, and I Have Never each use 20 recent items per category queue. Current-round items are never repeated.
- Each LLM request receives only the relevant game/category queue and asks for a batch of five new original items. Output is still schema-checked, deduplicated, suitability-checked, and bounded by application code.

### Volatile vendor settings

Provider model IDs, endpoint versions, authentication formats, quotas, billing, context/output limits, and structured-output support MUST be rechecked before implementation and release. Do not copy historical model IDs into production configuration without current official verification. Free/open-source King-Fun does not imply free or unlimited third-party AI usage.

Current official references (reviewed 2026-11-04):

- Elysia is a TypeScript backend framework optimized for Bun: <https://elysiajs.com/quick-start>.
- Cloudflare Workers AI REST API requires an Account ID and API token; model execution is through the account AI run API: <https://developers.cloudflare.com/workers-ai/get-started/rest-api/> and <https://developers.cloudflare.com/api/resources/ai/methods/run/>.
- Cloudflare Workers AI rate limits are documented separately and can change: <https://developers.cloudflare.com/workers-ai/platform/limits/>.
- Gemini key authentication and current key types: <https://ai.google.dev/gemini-api/docs/generate-content/api-key>.
- Gemini content generation and structured output: <https://ai.google.dev/api/generate-content>.
- Groq request schema and text-generation reference: <https://console.groq.com/docs/api-reference> and <https://console.groq.com/docs/text-chat>.

## 6. Proposed performance budget process

Do not claim universal frame-rate or load-time guarantees. First establish a baseline using a reproducible production build, representative mid-range/low-end devices, and realistic mobile network profiles. Then set project budgets for:

- Initial route transfer size and JavaScript parse/execute time.
- Per-game lazy chunk size.
- Core Web Vitals and interaction responsiveness.
- Long tasks during animations and transitions.
- Offline cache size and update payload.

Every budget MUST specify measurement tool, device/profile, route, cold/warm cache condition, and acceptance threshold. Budgets are enforced in CI where reliable and by documented manual testing otherwise.

## 7. Out of scope unless approved

- Native iOS/Android applications.
- User accounts, cloud sync, multiplayer networking across devices, server-side game rooms, or a conventional DBMS.
- Uploading/storing user game history remotely.
- Copying reference game assets, source, branding, layouts, or prompt datasets.
- Mandatory AI content generation; core gameplay must work without it.
- Guaranteed free AI usage, unlimited quotas, or promised provider uptime.

## 8. Decision log

Decisions below define the initial implementation baseline. Revisit them only with an explicit change record and an impact review.

| ID | Decision | Initial implementation choice | Status / revisit trigger |
|---|---|---|---|
| DEC-001 | Frontend framework/build | Retain the supplied React 19 + Vite 8 + TypeScript 7 project. Keep the domain framework-independent. | **Selected.** Revisit only for a documented compatibility or product requirement. |
| DEC-002 | Package manager/runtime | Bun only; stable Bun 1.4.4 pinned in CI and `packageManager`. One committed `bun.lock`; CI uses `bun install --frozen-lockfile`. | **Selected.** Recheck current stable release during planned toolchain updates. |
| DEC-003 | UI state architecture | Reducers and framework-independent game state machines first. No global state library until measured complexity justifies one. | **Selected.** Revisit after first game vertical slice. |
| DEC-004 | Test runner | Bun's built-in test runner for domain/unit/integration tests. | **Selected.** Browser E2E runner intentionally deferred until user-facing routes exist; run a Bun-compatibility spike before adding one. |
| DEC-005 | BYOK transport | Explicit-consent, request-only forwarding through the public Elysia + Bun API; key held in browser session memory and request memory only, excluded from all persistence/logging. | **Implemented in source:** explicit acknowledgement before key save, request-only key forwarding, memory-only lifetime, and storage exclusion. Browser storage inspection and deployed log-redaction verification remain pending. |
| DEC-006 | Content rating | Seed packs are general-audience only. Teen/adult suitability values remain schema capabilities, not permission to ship unrated or adult packs. | **Selected.** Revisit adult/age-gated content only after owner approval and policy review. |
| DEC-007 | Player anti-repeat (legacy) | Initial implementation used a fixed last-three player exclusion window. | **Superseded by DEC-013.** The production selector now defaults to the adaptive per-game formula. Deterministic source helpers retain explicit-window arguments for tests. |
| DEC-008 | Local history retention | Phase 2 default: retain at most 100 sessions and no more than 30 days, whichever limit is reached first; offer user-controlled clear/export. | **Selected initial default.** Revisit during storage UX implementation if the retention controls require a different policy. |
| DEC-009 | Content repeat policy | Stable-ID shuffled deck cycles; every eligible ID appears once before a new cycle. Changed pack/filter creates a new cycle; empty pool is a typed error, never an unbounded retry. | **Selected.** Revisit only if a game-specific rule requires weighted or constrained content. |
| DEC-010 | Local persistence and offline | IndexedDB v2 with app-state/session/round/history/custom-pack stores; bounded schema-validated records; atomic commits/backup restore; monotonic revision compare-and-swap; BroadcastChannel conflict notices; memory fallback/retry/explicit recovery; Vite-generated complete lazy-asset precache manifest and versioned service-worker cache. | **Implemented in source; Bun and real-browser durability/offline verification pending.** localStorage is limited to compact non-secret AI provider ordering/enabled preferences and one-time legacy migration data; provider keys, player/session data, and game history remain out of localStorage. No server DBMS or cloud-synced history. |
| DEC-011 | Provider settings and fallback | Gemini/Groq are optional BYOK rows, off until a key is entered and explicitly enabled; both are drag-reorderable. Cloudflare Workers AI is always active and pinned last, with no settings icon/toggle. Each round snapshots enabled order; fallback errors are snackbars; local content is the final fallback. | **Implemented in source:** provider list, consent/key dialog, keyboard reorder controls, pinned Cloudflare fallback, fallback/cooldown handling, and local curated fallback. Bun and browser verification remain pending. See `docs/ai-provider-routing.md`. |
| DEC-012 | Public AI backend | Elysia + Bun public API service lives in the root `backend/` workspace; `frontend/` and `backend/` are root workspaces sharing one root `bun.lock`. Cloudflare Workers AI credentials stay server-side; user BYOK is request-memory-only. | **Implemented in source, not deployed.** Root `backend/` workspace, Vercel adapter, shared Redis-compatible request limiter, request/provider budgets, concurrency cap, and fail-closed production readiness are present. Operator secrets, billing controls, and live hosting configuration remain external release gates. |
| DEC-013 | Adaptive player/category queue | For n >= 4, player/category anti-repeat window is `max(1, Math.round((n / 2) - 1))`; for 2–3 selected categories, use a one-category cooldown. Each queue is isolated per game. | **Implemented in local source; full queue/browser verification pending.** Exact formulas and examples are in `docs/ai-provider-routing.md`. |
| DEC-014 | Per-game content queues | Imposter retains the last-10 constraint; GuessUp, Truth, Dare, and I Have Never use separate 20-item queues per game/category/item-kind/locale plus a per-round seen set. | **Approved initial defaults.** Revisit only with playtesting evidence; never silently repeat. |
| DEC-015 | Gameplay motion reference | Use user-supplied recordings as interaction/animation references for setup cards, roulette, countdown, private role cards, prompt cards, reactions, report, and handoff. Keep all artwork, copy, branding, and content original; no ads/premium locks/online Imposter. | **Approved specification; see `docs/gameplay-reference.md`.** |
| DEC-016 | UI/UX and icon packages | Third-party UI primitives, component libraries, motion packages, and icon packs are allowed when they meet maintenance, license, React 19, Vite, Bun, accessibility, and bundle-size requirements. | **Owner-approved.** Use Bun only; libraries stay in the presentation layer and do not own game rules. No additional package was justified for Phase 2/3; native dialog/forms and the existing primitives remain smaller and accessible. |
| DEC-017 | Motion and browser theme preferences | Persist system/reduced motion choice and synchronize light/dark theme to the document root, color-scheme, and browser theme-color metadata. | **Implemented in source; system/device/browser behavior requires acceptance testing.** |

**Implementation baseline checked 2026-11-03:** Bun 1.4.4, Vite 8, `@vitejs/plugin-react` 6, React Compiler's documented Vite preset integration, TypeScript 7.0.2, Oxlint, and Bun's native test runner. Official documentation and release links are recorded in `instructions.md`. Existing dependency versions are retained from the supplied lockfile; this implementation adds no runtime or development package.



## Branding and Truth/Dare wheel clarification (2026-11-04)

- Product display name and PWA identity are exactly `KING-FUN`; use the supplied crown-and-dice mark from `docs/branding/king-fun-logo-source.svg`.
- Truth or Dare in Spin the wheel mode must use two distinct committed roulette decisions in sequence: player/next player first, then Truth versus Dare.
- The Truth/Dare choice wheel must not replace or disable the existing manual Truth and Dare buttons.
- All wheel outcomes are chosen with Web Crypto and committed to the active session before the animation.


## Truth or Dare dual-wheel requirement — 2026-11-04

- In `Spin the wheel` mode, the player/next-player wheel is the first decision. Its result must be saved before motion and the pointer must land on the saved player.
- The Truth/Dare wheel is a separate second decision. It has eight equal sectors (four `TRUTH`, four `DARE`), commits the result before motion, and draws a matching prompt only after the landing animation finishes. Player and challenge wheels reuse the shared presentation-only `SpinWheel` component, with labels aligned to each sector radius.
- All together and One at a time retain their player semantics but still show the Truth/Dare wheel.
- Keep the existing manual Truth and Dare buttons below the second wheel; they remain a fully functional alternative and must not be silently replaced by wheel-only selection.
- Respect reduced-motion settings and announce the wheel outcome accessibly.


## Phase 5 implementation status — 2026-11-05

The AI settings UX, session-memory BYOK with an explicit consent acknowledgement, provider order/enabled preference storage, Gemini/Groq adapters, pinned Cloudflare fallback, generated-content validation, per-game/category recent-item exclusions, cooldown/fallback handling, and local curated fallback are implemented in source. The Elysia API has moved into the root `backend/` workspace; `backend/vercel.ts` provides the Vercel Services entrypoint. The root Bun workspace contains `@king-fun/frontend` and `@king-fun/backend`.

Backend source enforces 12 KB streamed request and 128 KB streamed upstream-response limits, fixed provider HTTPS endpoints, bounded timeouts, safe errors, exact CORS/HTTPS checks, validated provider/task boundaries, a global kill switch, and a Redis-compatible REST limiter using atomic Lua for per-client minute, global/provider daily request caps, and global concurrency. Imposter category metadata can be generated with a dedicated strict schema, reviewed in Settings, selected as a category, and persisted with its generated word pack. Production fails closed when the shared limiter is absent or unhealthy. Request-count budgets are not monetary spend caps; provider-side billing/usage controls are required.

**Release status: incomplete.** The user verified with Bun 1.4.4 that both normal and frozen root installs succeed. The only lockfile discrepancy was the stale root `name` field retained by Bun after a root rename (Bun issue #47656); the corrected archive sets it to `king-fun` without changing dependency versions, and all root/frontend/backend dependency snapshots match their manifests. The user subsequently ran the full check: frozen install and repository policy passed, lint completed with non-fatal warnings, and frontend typecheck exposed optional-signal and category-kind narrowing errors. This follow-up source fixes those errors and the lint warnings; the native full pipeline must be rerun on this exact archive. Vercel deployment, operator secrets, provider billing/usage settings, external abuse tests, live provider tests, and browser/device acceptance remain unverified. The current metadata-only Imposter category pipeline and provider-generated 20-hint contract still require exact-revision verification. See `todo.md`, `checklist.md`, and `verification.md`.

### DEC-017 — Reusable UI, themes, iconography, and motion

- UI components must be reusable across existing and future game modes. Presentation components must not own game rules, random selection, or persistence.
- Both light and dark themes are first-class product modes. Every app surface, including setup, game cards, dialogs, controls, and wheel states, must use readable theme-aware tokens.
- Interface iconography uses consistent named outline SVG icons rather than emoji. User-authored pack metadata may retain its legacy emoji field for import/export compatibility, but it is not used as a decorative interface icon.
- Motion must communicate state and interaction, honor reduced-motion preferences, and never alter a game outcome. The shell may render a decorative projected-3D ambient canvas with pointer parallax and background tap ripples; it must be pointer-transparent, frame/DPR-capped, hidden-tab suspended, pauseable, and disabled by reduced-motion preferences. The Truth or Dare spin-wheel mode selects and persists a player before running the separate Truth/Dare wheel.
- External UI libraries may be added only through Bun after verifying current maintenance, license, React 19 compatibility, accessibility, and bundle impact. Do not commit manifest changes without a matching regenerated `bun.lock`.

## DEC-018 — 2026-11-06 responsive UI system and component adoption

- The application shell, library, setup, settings, history, and shared game controls use one responsive 12-column CSS Grid system with explicit span utilities and defined mobile collapse behavior. Setup retains a 7/5 desktop configuration/summary split and collapses to stacked full-width sections at 800px and below.
- Lucide React is the source icon set, accessed through the typed `Icon` and `GameMark` wrappers. Do not introduce Unicode glyphs or emoji as visible controls. Existing emoji fields remain only for content metadata compatibility.
- Shared button variants are based on Base UI + CVA + `clsx`/`tailwind-merge`; switches expose correct switch semantics and names; provider order is keyboard/pointer sortable with explicit up/down controls; command palette supports Ctrl/Cmd+K.
- The active runtime boundaries are CSS-owned shell/home transitions, first-party toast feedback, AutoAnimate, cmdk, native provider drag/drop plus keyboard reorder buttons, TanStack Query, React Hook Form/Zod, React Dropzone, date-fns, and Playwright/axe/Storybook. Motion, Sonner, and dnd-kit remain installed but are not imported by current app source after initial-bundle and React Compiler cleanup. Installed or future libraries must not own game rules, secure randomness, content selection, persistence, or secret state; heavy features remain dynamically imported.
- Graphics, physics, Rive/Lottie, and alternate animation engines remain feature-scoped and lazy. Installing a package does not require a static import in the initial bundle.
- Browser acceptance includes 320–1440px grid/reflow/overflow checks, setup form interaction, theme switching, command palette keyboard flow, and serious/critical axe scans for primary screens. Human screen-reader, contrast, touch, zoom, and real-device inspection are still required.

---

## 2.10 Product scope expansion — Party Arcade (2026-11-06)

The original four-game baseline above remains normative for those games. The product scope is expanded to 27 selectable titles: the original four plus 23 offline local-play games. This expansion does not authorize accounts, online rooms, matchmaking, subscriptions, IAP, premium locks, public chat, or social profiles.

### FR-ARCADE-001 — Catalogue

The home/catalogue MUST expose playable entries for Timer Impostor, Werewolf, Mafia, Murder, Fake It, Fake Story, Fact or Fiction, Wrong Answers Only / Opposites Day, Hot Bomb, Hot Bomb Duel, Who's Most Likely, Would You Rather, Share or Pass, $20 Challenge, Tilt It, Letterburg, Discussion Starter, Who Am I?, Ten Tangle, Qupid, Questions for Love, A or B, and Reverse Singing. Charades and Spy remain aliases/coverage of GuessUp and Imposter respectively, not duplicate implementations.

### FR-ARCADE-002 — Common session contract

Every added game MUST have a real playable controller, typed game ID, bounded setup options, domain-owned initial state, persisted roster/setup snapshot, explicit terminal/finish path, and bundled offline content wherever content is required. Empty content MUST fail setup safely rather than launch a dead screen. Game randomness MUST use Web Crypto. UI animation MUST not determine the committed gameplay outcome.

### FR-ARCADE-003 — Social deduction

- Timer Impostor MUST privately reveal a shared target time to non-impostors and exclude it from the impostor's reveal; players submit individual timing attempts before a group accusation vote.
- Werewolf and Mafia MUST privately assign hostile/villager roles, run night and day phases, collect hostile night votes and village day votes, and terminate only at a defined faction condition. Hostile-team size MUST be bounded by player count. Phone narrator is optional and must retain visible text when speech synthesis is unavailable.
- Murder MUST assign one secret murderer, support manual recording of wink eliminations, and provide a final suspect vote. It MUST NOT require camera access or attempt facial recognition.
- Fake Story and Fact or Fiction MUST privately assign the deceptive role, collect the round and allow a group vote/results resolution.
- Fake It MUST deal one secret word privately to a word-holder, show the group a broad category/clue (not the answer), allow yes/no questions, and give each other player one guess. The word-holder must not expose the word before the results phase.

### FR-ARCADE-004 — Timed, prompt and voting games

- Hot Bomb MUST use a selected category, configurable 8/10/12/15-second fuse, active player order, non-repeating answers and explicit elimination/result state. Hot Bomb Duel MUST enforce exactly two players.
- Tilt It and Letterburg MUST support teams with separate scores and solo individual rotation, configurable 30/45/60/90/120-second turns, motion controls where available, and persistent touch Correct/Pass controls.
- Who's Most Likely and Would You Rather MUST accept one vote per player, prevent repeat voting, and reveal group tallies.
- Wrong Answers Only MUST collect answers and allow group judging; optional read-aloud must degrade gracefully without speech synthesis.
- Share or Pass MUST allow penalty-free skip and MUST NOT introduce alcohol, forced disclosure or a drinking penalty.
- Discussion Starter, Qupid and Questions for Love MUST provide a complete prompt progression with pass/advance and finish controls.

### FR-ARCADE-005 — Other games

- `$20 Challenge` MUST provide ten theme-specific auction lots, $20 starting budget per player, private sequential sealed bids, bid validation, build assignment, standings and an offline judging path. It MUST not require an AI service to complete a game.
- Who Am I? MUST deal unique identities to players and keep the current identity visible to the group during forehead play. The group answers yes/no questions and marks the identity solved or passes to the next player.
- Ten Tangle MUST provide ten simultaneously visible anagrams, allow any-order solving, track attempts and allow finish/reveal of remaining solutions.
- A or B MUST support the exactly-two-player partner prediction loop.
- Reverse Singing MUST support classic reversed-audio imitation and Battle first-correct scoring. Microphone use MUST follow explicit user interaction, expose permission/unsupported states, stop tracks, and keep clips in browser memory only; no recording may be uploaded or backed up.

### FR-ARCADE-006 — Setup options

Setup MUST enforce game-specific player bounds and expose relevant options: hidden-team count and phone narrator for Werewolf/Mafia; fuse length for Hot Bomb variants; Team/Solo and turn length for Tilt It/Letterburg; read-aloud for Wrong Answers Only; anti-items filter for `$20 Challenge`; Classic/Battle for Reverse Singing. Every setup choice MUST be captured in the active session snapshot.

### FR-ARCADE-007 — Content and source boundaries

Seed content MUST be original, license/provenance-tagged and offline. Fake It real answers and Fact or Fiction verdicts MUST be structured metadata, not extracted heuristically from display text. The report's claim of 1,000+ Qupid prompts is not reproduced; the included count MUST be described accurately. The exact paid Anti-items cost/flow is unspecified by the supplied report; KING-FUN's filter is a named local house rule and MUST NOT claim exact parity.

### FR-ARCADE-008 — Undefined reference titles

The report does not define playable rules for Touchdown, Secret Suitcase and Comedy God, and identifies other entries as inferred. These MUST NOT be presented as implemented game loops until a sourced ruleset is available. Torment of Choice is treated as an overlapping Would You Rather concept, not a duplicate card.

### NFR-ARCADE-001 — Quality

All additions MUST remain local-first and offline-capable, preserve the React/domain/storage/provider separation, use accessible semantic controls, include reduced-motion/touch/keyboard alternatives, avoid unnecessary device permissions, and have domain tests for state creation, constraints, scoring/voting and terminal conditions. Full Bun type/lint/test/build and Playwright/axe acceptance are required before release sign-off.

### FR-ARCADE-009 — Per-family demand loading

The application MUST lazy-load the selected arcade controller family. Entering one added game MUST NOT statically import every other arcade controller; build-budget checks MUST cover all seven controller-family chunks.


- **FR-ARCADE-010 — Mechanics-only setup:** Timer Impostor, Werewolf, Mafia and Murder MUST be startable without selecting or maintaining an unused content pack. Their roles, target time and phase rules are generated by the domain session constructor.
- **FR-ARCADE-011 — Fake It cue integrity:** Bundled and custom Fake It entries MUST expose a category/clue to the question group while keeping the answer in metadata; starter content MUST NOT reveal the answer in the displayed clue.
