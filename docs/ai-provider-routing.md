# AI provider routing, BYOK settings, and anti-repeat queues

**Reviewed/specification date:** 2026-11-05  
**Status:** Provider routing, Elysia gateway, settings UX, root `backend/` workspace, bounded streaming readers, shared Redis-compatible atomic limits, and fail-closed production policy are implemented in source. The user confirmed the Bun 1.4.4 Phase 5 screenshot-fix run passed both workspace typechecks, 161 tests and the frontend build; a following fixture-only cleanup removes its 16 Oxlint warnings. Phase 6 adds the release-contract, security-audit, and production artifact-budget gates, which require a fresh full root check on the exact Phase 6 archive. Provider credentials, external billing controls, deployment, and browser/device acceptance remain open. This is not a production-ready deployment.  
**Scope:** Optional content generation for Imposter, GuessUp, Truth or Dare, and I Have Never. Core games must work without API access.

## Imposter generation requirements from the Mystery Who report

The archived Mystery Who report (`references/mystery-who-full-report.md`) describes three content sources for a round: bundled local word banks, manual custom packs, and optional AI-generated content. It also describes AI-defined categories with a category name, emoji, generation instructions, and source type; a new round may ask the model for a fresh secret word and hints. This feature is optional and must never become a prerequisite for starting or completing a local round.

For King-Fun, AI-generated Imposter content MUST use the same provider-neutral Elysia + Bun gateway and fallback chain defined in this document. Validate the generated category/word/hint structure, reject duplicate or answer-revealing hints, apply the global report-required last-10 word exclusion, and keep the round playable with bundled/manual local content whenever a request fails or the device is offline. Do not copy the report's historical Gemini/Groq model IDs or its direct-key assumption into production configuration; model IDs, endpoints, and auth mechanics require a fresh provider review.

## 1. Provider list and settings UI

The Settings screen must replace the current single-provider select/endpoint input with one sortable provider list. This UI is a provider-priority editor, not a list of arbitrary endpoints. The public King-Fun API gateway is the Elysia service described below; Cloudflare Workers AI is the final model provider called by that service.

### Default order and state

1. **Gemini** — first row, disabled by default, no key configured by default.
2. **Groq** — second row, disabled by default, no key configured by default.
3. **Cloudflare Workers AI** — pinned final row, always logically enabled, no toggle, no settings/gear icon.

Gemini and Groq rows contain a native draggable handle, a visible provider name/status in its own flexible grid track, settings/test/reorder actions, and a compact direct grid-item `role="switch"` control. The switch's accessible name references the same visible provider name plus its visible ON/OFF state; it is not wrapped in the generic preference-row layout, which must not impose a minimum width that hides provider identity on phones.

- Without a saved/in-memory key, each Gemini/Groq toggle is visibly disabled/greyed out and cannot be activated.
- The settings icon remains usable. It opens a modal/popover that allows the user to enter, replace, test, or remove that provider's API key.
- Saving a valid key unlocks the toggle; saving a key does **not** silently enable that provider. The user explicitly turns it on.
- A disabled provider is skipped by the fallback chain even when its key exists.
- Gemini and Groq remain reorderable whether enabled or disabled. Their saved order determines priority among enabled providers.
- Cloudflare Workers AI is part of the list visually but is fixed/pinned at the bottom. It cannot be disabled, configured, or dragged above Gemini/Groq. “Pinned at the bottom” means it is not draggable; only Gemini and Groq are movable. If the public Elysia gateway or its Cloudflare credentials are unavailable, the app reports the failure and uses local content; it does not pretend Cloudflare is reachable.
- Provide accessible keyboard alternatives to drag-and-drop (Move up / Move down buttons), focus retention, and a screen-reader announcement after reordering.
- Persist provider order and enabled preferences locally. Provider secrets must not be included in ordinary app snapshots, backup exports, game sessions, logs, or service-worker caches.

### BYOK key lifetime

The existing privacy decision is retained: Gemini/Groq keys are session-memory only. They are held in client memory while the app is open, forwarded over HTTPS to the Elysia backend only for a user-triggered generation request, and are cleared on reload/tab close or explicit removal. Consequently, after a reload the Gemini/Groq rows return to a key-not-configured state and their toggles are disabled until the user enters the key again. Do not quietly persist keys in localStorage, IndexedDB, Cache API, or an exported backup. If the owner later requests remembered keys, that requires a separate threat-model decision and explicit opt-in design.

The key dialog must explain that the key passes through the King-Fun public API server and then to the chosen provider. Mask the value by default; reveal is opt-in. Never echo the complete key in the UI after save. All server/proxy logs must redact the key header.

## 2. Fallback order and per-round behavior

At round start, snapshot the enabled provider order into the active round:

```text
[enabled Gemini/Groq rows in user-defined order, Cloudflare Workers AI]
```

Cloudflare is always appended last. The snapshot keeps one round deterministic when a user reorders settings mid-game; edits apply to the next round. An API key removal is an immediate security override: the removed provider is skipped even if it appears in the active-round snapshot.

For each generation request:

1. Try the first eligible provider in the round's snapshotted order.
2. If it times out, is rate-limited, returns 5xx/network failure, returns malformed/empty/invalid-schema output, or produces only duplicate/unsafe items, reject that attempt and try the next provider.
3. Show a brief snackbar naming the provider and safe reason, for example: `Gemini rate limit (429) — trying Groq.` Do not show raw provider response bodies, request prompts, keys, or stack traces.
4. Skip a provider during its cooldown after repeated transient failures. Invalid/revoked credentials (401/403) should mark that provider `Needs attention` and skip it until the key is replaced or the next explicit test succeeds.
5. Never loop indefinitely. Each provider is attempted at most once per generation request; retry policy is bounded and cancellation stops the chain.
6. If every remote provider fails, use a non-repeating local curated item when available and show `AI unavailable — using local pack` with the final safe reason. If no eligible content remains, show a proper exhausted state and offer category/pack change; never repeat silently.

The snackbar is feedback for the user, not a log sink. It must not include the user's key, full prompt, player names, or private game state.

## 3. Public Elysia backend (source implemented; deployment verification pending)

Use **Elysia + Bun** for the public API service. Elysia is selected over Fastify/Express because the project is Bun-only and Elysia is optimized for Bun while supporting Web Standard request/response integration. The service is a publicly hosted King-Fun backend/API gateway; it is not a Cloudflare Worker runtime. Cloudflare Workers AI is an upstream inference provider called by this Elysia service. The root Bun workspace contains `frontend/` and `backend/`; root `package.json` owns workspace configuration and the only lockfile is root `bun.lock`. Never create a nested lockfile or a separate backend package manager.

Current structure:

```text
.
  backend/vercel.ts       # Vercel Elysia service entrypoint
  backend/
    index.ts              # Elysia app and Web Request handler
    dev.ts                # Local Bun server
    providers/generate.ts # Provider-specific adapters
    content/schema.ts     # Strict request/output validation
    security/             # Streaming body limits and shared abuse controls
    tests/                # Elysia routes, schemas, adapters
    package.json          # @king-fun/backend workspace (Elysia dependency)
  frontend/
    src/                  # React app, games, domain, content, screens
    public/               # PWA manifest, service worker, static assets
    package.json          # @king-fun/frontend workspace
  package.json            # Root workspace/tooling/scripts
  bun.lock                # One root lockfile only
  vercel.json             # Root-level deployment configuration
```

### Public API routes

- `GET /healthz`: liveness only; no secrets, account IDs, provider keys, or internal configuration values in the response.
- `GET /v1/status`: non-sensitive readiness status (`available`, `degraded`, `unavailable`) and supported task kinds only. Do not reveal provider credentials, account identifiers, or hidden deployment settings.
- `POST /v1/content/generate`: one provider attempt per request. The frontend owns the ordered fallback sequence so it can show each fallback snackbar.

The request body must be a small, versioned schema containing only necessary content-generation data. It is streamed and capped at 12 KB before JSON parsing; `Content-Length` is an early check, not the sole enforcement.

```json
{
  "schemaVersion": 1,
  "requestId": "opaque-random-id",
  "game": "truth-or-dare",
  "itemKind": "truth",
  "categoryId": "icebreakers",
  "locale": "en",
  "suitability": "general",
  "count": 5,
  "playerCount": 6,
  "recentItems": ["recent category-specific prompt text"]
}
```

Allowed `game` and `itemKind` pairs are a closed server-side allowlist. The client must never supply an arbitrary upstream URL, arbitrary model ID, system prompt, token budget, or tool configuration. Model IDs and provider endpoints are server-side deployment config. The server generates stable item IDs/fingerprints; model-generated IDs are ignored. Client-supplied category identifiers and recent text are treated as untrusted data in the model prompt, not as instructions.

Provider selection is carried in a validated header/field (`gemini`, `groq`, or `cloudflare-workers-ai`). For Gemini/Groq, the session-memory key is sent in a dedicated HTTPS header, for example `X-Provider-Key`. The Elysia logger, reverse proxy, hosting logs, error monitor, and tracing layer must redact this header. The backend forwards the key only to the requested provider, never writes it to storage, and clears references when the request completes. Cloudflare requests do not accept a client key.

### Cloudflare Workers AI adapter

The Elysia service calls Cloudflare's documented OpenAI-compatible Chat Completions endpoint using server-side environment secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_AI_MODEL`

The request URL is `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1/chat/completions`. The default `@cf/openai/gpt-oss-20b` is sent as the request model. The system message includes the exact task-specific JSON Schema and instructs the model to return only a JSON object; the backend then parses and validates the result against the application contract before returning any content. GPT-OSS uses `reasoning_effort: low` to reserve more of the completion budget for the requested content. Imposter word batches receive a 6,000-token default ceiling; other tasks use 4,000, with the configured `AI_MAX_OUTPUT_TOKENS` still capped at 6,000.

The adapter intentionally does not rely on Workers AI JSON Mode for GPT-OSS: Cloudflare's published JSON Mode support matrix does not list `@cf/openai/gpt-oss-20b`. This avoids assuming a model capability that the published matrix does not claim. The response parser accepts OpenAI Chat Completions `choices[0].message.content` as a string or text-part array, including compatible `result.choices` / `data.choices` wrappers. It also accepts GPT-OSS Responses-style `output_text` / `output[].content[].text` during endpoint migration, and retains compatibility with the native REST `{ result: { response: object } }` structured-object envelope. All extracted values still pass the same strict application schema/content validator; parser compatibility does not bypass validation. A null/empty result or truncated output produces a provider-specific, actionable safe error rather than an ambiguous empty-content failure.

The API token must have only the required Workers AI permissions. Current Cloudflare documentation identifies the Account ID and API token as required; re-check least-privilege permissions during deployment. These values never appear in Vite environment variables, browser bundles, client settings, responses, or logs.

The Cloudflare row is always the final automatic provider. It uses the deployment's model setting; the model ID must be rechecked against the current official catalogue before release. Cloudflare pricing/quotas are not assumed to be free or unlimited.

### Public endpoint protections

Implemented source controls:

- HTTPS and exact allowed origins are required for production generation. CORS is not treated as authentication.
- JSON content type is required; request bodies are streamed and capped at 12 KB. Provider responses are streamed and capped at 128 KB.
- Provider IDs and game/item-kind pairs are allowlisted; client model IDs, upstream URLs, arbitrary prompt overrides, and client Cloudflare credentials are rejected.
- Provider calls use fixed HTTPS endpoints, redirect rejection, bounded timeouts, response validation, and safe structured errors.
- Production fails closed unless `AI_LIMITER_REST_URL` and `AI_LIMITER_REST_TOKEN` configure a healthy shared HTTPS Redis-compatible REST store. The shared Lua script atomically enforces per-client minute, global daily, provider daily, and global concurrency caps across serverless instances. The per-client key is a deterministic HMAC of the trusted edge address with the shared limiter token, so distinct instances share the same client bucket without storing raw IPs.
- Local development uses bounded process-local counters only. Arbitrary `X-Forwarded-For` is not trusted: the address is accepted only with the platform edge markers used by Vercel or Cloudflare.
- The global `AI_ENABLED` kill switch defaults off. `/v1/status` performs a production shared-store ping and reports unavailable when it is not ready. Concurrency slots are awaited on release; if a release cannot reach Redis, a 120-second lease TTL is the recovery bound.
- Provider-side usage/billing alerts remain mandatory. Gateway daily caps count requests, not tokens or currency; they are not monetary spending guarantees. Configure actual provider budget controls separately.
- The gateway never persists game sessions/player data and never exposes a generic URL proxy. Authenticated provider/API traffic is `no-store` and excluded from service-worker caching.

A public endpoint can be called outside the official UI. CORS and client-side limits do not stop scripts/curl. The shared limiter, provider-side billing/usage controls, exact origin list, and emergency disable switch are release blockers until verified in the deployed environment.

## 4. Provider adapters and error model

Each adapter exposes the same provider-neutral contract and returns normalized content items or a typed safe error. The adapter owns URL, authentication header, request format, model ID, and response parsing. Game components must not know provider names.

Suggested safe error codes:

- `NETWORK_ERROR`
- `TIMEOUT`
- `RATE_LIMITED`
- `AUTH_INVALID`
- `PROVIDER_UNAVAILABLE`
- `MODEL_UNAVAILABLE`
- `INVALID_RESPONSE`
- `SCHEMA_REJECTED`
- `DUPLICATE_ONLY`
- `CONTENT_REJECTED`
- `BUDGET_EXHAUSTED`
- `REQUEST_CANCELLED`

A provider error response returned to the browser contains only `code`, a short safe `message`, and `retryable`; never raw upstream JSON or credential data.

## 5. Anti-repeat queues

Queues are local to the browser and persist with the game's local data. They are not shared between devices or uploaded as game history. Every queue is isolated by `gameId`; content queues are additionally isolated by `categoryId`, `itemKind`, and `locale`:

```text
player:<gameId>
category:<gameId>
content:<gameId>:<categoryId>:<itemKind>:<locale>
```

Do not use one global content queue across games. A Truth prompt must not consume the GuessUp queue or the Dare queue. Within one game, category A and category B have independent histories.

### Player anti-repeat window

For `n` eligible players:

```ts
playerWindow(n) = n >= 4 ? Math.max(1, Math.round((n / 2) - 1)) : 0
```

Use exactly JavaScript `Math.round` semantics. Store the most recently selected player IDs in a FIFO queue per game. Exclude those IDs while selecting the next player. Example windows: 4 players → 1, 5 → 2, 6 → 2, 7 → 3, 8 → 3, 9 → 4, 10 → 4. With fewer than 4 eligible players, this new formula is not applied. If roster changes, discard IDs that are no longer eligible. Randomly select uniformly from the remaining eligible set using the Web Crypto selector.


### Current source status (2026-11-05)

The production `selectPlayerNoRepeat()` API now defaults to `playerRepeatWindow(playerIds.length)` and uses the approved adaptive formula. Its deterministic `selectPlayerNoRepeatFromSource()` seam accepts an explicit window for reproducible property tests. The production Truth or Dare / I Have Never roulette call site uses the adaptive default. `random.test.ts` covers the 3–10 player boundary table and eligible-pool sampling. Official Bun execution and browser-level queue verification still need to be performed; the local Node compatibility harness is not a substitute for the Bun pipeline.

### Category anti-repeat window

Let `k` be the number of distinct categories selected for the current game setup:

```ts
categoryWindow(k) =
  k < 2 ? 0 :
  k < 4 ? 1 :
  Math.max(1, Math.round((k / 2) - 1))
```

Maintain a separate recent-category FIFO queue for each game. Do not select a category found in that game's active recent window when another selected category is available. The queue is updated only after a category is actually committed to a generated/selected item, not merely when the user opens a category menu. If a category selection changes, prune history entries no longer in the selected set.

### Content queues by game/category

Use a recent-item FIFO plus a per-round `seen` set. The FIFO is a cross-round freshness buffer; the per-round `seen` set is the hard guarantee that an item cannot repeat during the active round even after it ages out of the FIFO. Exact duplicate and canonicalized-text checks are mandatory. A near-duplicate check should reject obvious rephrasings/templates with only superficial substitutions; do not claim semantic uniqueness that has not been measured.

| Game/item kind | Recent history capacity | Queue key details |
|---|---:|---|
| Imposter word | 10, plus the existing source-parity last-10 global word rule until the reference clarifies its scope | per selected category + locale; never relax the confirmed last-10 exclusion silently |
| GuessUp charade | 20 | per category + locale |
| Truth prompt | 20 | per category + `truth` + locale |
| Dare prompt | 20 | per category + `dare` + locale |
| I Have Never statement | 20 | per category + locale |

Within a single round/session, do not repeat a displayed item even if its older history entry has fallen out of the rolling queue. When local shuffled content is exhausted, request fresh content or show an explicit exhausted state. Never wrap a deck silently in the middle of a round.

### LLM prompt contract

For every request, send only the relevant game's category-specific recent queue (plus the Imposter global last-10 exclusions where required), current `game`, `itemKind`, `categoryId`, `locale`, suitability, requested count, and minimal game constraints. Do not send player names, roles, votes, private words, session history, or other categories' queue contents.

Ask the model to return a small batch of **5** original items in strict JSON, avoiding every recent item and close paraphrase supplied. The model instruction is advisory, not a correctness boundary: server/client validation must still enforce schema, count, lengths, category, suitability, canonical duplicates, and recent-history exclusion. Assign IDs/fingerprints outside the model. Accept only validated new items. Rejected/duplicate output does not advance any recent queue.

If the batch contains fewer than required valid items, the app may fall through to the next provider using the same exclusion set. Do not re-add the same rejected text to the next provider's queue; include it in the request-local blocked set for that generation attempt.

## 6. Model selection and cost policy

Do not hardcode a model name in the UI. The backend selects a currently supported model per provider from deployment configuration. Before a release, re-check official model availability, structured-output support, authentication, quotas, pricing, context/output limits, and supported generation parameters. A provider's availability in a catalogue does not mean the user's account has access or free quota.

The free/open-source status of King-Fun does not make Gemini, Groq, or Cloudflare inference free. Users are responsible for BYOK-provider charges under their own accounts; the project operator is responsible for the public Cloudflare backend's account/budget. The UI must not advertise a provider as unlimited or guaranteed free.

## 7. Official references to re-check before implementation/release

- Elysia quick start and Bun optimization: <https://elysiajs.com/quick-start>.
- Cloudflare Workers AI Chat Completions endpoint and GPT-OSS model: <https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/> and <https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/>. Cloudflare JSON Mode supported models: <https://developers.cloudflare.com/workers-ai/features/json-mode/>.
- Cloudflare Workers AI limits: <https://developers.cloudflare.com/workers-ai/platform/limits/>.
- Gemini API key authentication: <https://ai.google.dev/gemini-api/docs/generate-content/api-key>.
- Gemini structured content generation: <https://ai.google.dev/api/generate-content>.
- Groq API reference and chat/text generation: <https://console.groq.com/docs/api-reference> and <https://console.groq.com/docs/text-chat>.


## Phase 5 implementation notes (2026-11-05)

The Elysia service lives in root `backend/`, with `backend/vercel.ts` as its Vercel Services entrypoint. The root Bun workspace contains `@king-fun/frontend` and `@king-fun/backend`. The dev frontend proxies `/api` to the local backend on `127.0.0.1:3001`; Vercel deploys the frontend and backend as separate services and routes `/api/*` to the backend. `src-tauri/` is not deployed to Vercel.

Source includes `/healthz`, `/v1/status`, and `/v1/content/generate`; fixed Gemini, Groq, and Cloudflare Workers AI adapters; strict request and provider-output validation; 12 KB streamed request and 128 KB streamed response ceilings; HTTPS/origin/content-type/provider checks; safe errors; provider timeouts; and session-memory BYOK. The key dialog requires an explicit consent acknowledgement before saving a key and explains the gateway/provider transit. Provider preferences only are persisted. Cloudflare credentials are server-only. Curated local fallback is used when remote generation fails and matching unused local content exists.

Production abuse controls use an Upstash-compatible Redis REST store and atomic Lua script. A deterministic HMAC address key is shared across serverless instances. Counters include per-client/minute, global/day, provider/day, and global concurrency. Production generation fails closed if the shared store is missing or unavailable; status readiness executes a non-mutating Lua `EVAL` capability probe, not merely `PING`, so a token without script permissions is not reported ready. Local development may use process-local bounded counters. These request-count caps do not cap monetary spend; provider-side billing alerts/caps remain required.

Imposter generated-word output is rejected unless every word has exactly 20 canonically distinct hints with no exact answer-token sequence. This automated rule is not semantic proof that a hint cannot reveal an answer; human review remains necessary. AI category metadata generation is implemented: the gateway accepts `imposter:category`, returns strict records requiring a valid name, description, and representative emoji; the server derives stable ASCII category slugs (including deterministic hashes for non-Latin names) and rejects malformed, duplicate, or unsupported metadata. Settings lets the user choose a suggestion, author/edit its metadata, generate word content for that ID, and save the metadata and words together as a local custom pack. Local fallback does not fabricate category metadata; category suggestions require an enabled remote provider.

The user verified with Bun 1.4.4 that `bun install` and `bun install --frozen-lockfile` both succeed at the repository root. The policy failure was a root-name metadata mismatch caused by Bun issue #47656: Bun can retain the pre-migration root name in `workspaces[""]` even after accepting the lock as frozen. The corrected archive changes only that name from `frontend` to `king-fun`; root/frontend/backend dependency snapshots (including Elysia) already match their manifests. Vercel deployment, operator secrets, provider billing controls, external abuse tests, the full Bun check rerun after the latest TypeScript/lint corrections, and browser/device acceptance remain release gates.

Official deployment/limiter references reviewed 2026-11-05: [Vercel Bun Functions](https://vercel.com/docs/functions/runtimes/bun), [Bun workspace filters](https://bun.com/docs/pm/filter), [Upstash REST API](https://upstash.com/docs/redis/features/restapi), and [Upstash EVAL](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval).


## Model identifiers reviewed 2026-11-05

The shipped environment template defaults to `gemini-3.8-flash`, `openai/gpt-oss-120b`, and `@cf/openai/gpt-oss-20b` for Gemini, Groq, and Cloudflare Workers AI respectively. These identifiers were checked against the providers' published model catalogues on 2026-11-05. This is not evidence of account-level quota, billing eligibility, or spending limits; recheck those settings in the operator consoles before enabling production traffic.

References: [Gemini model catalogue](https://ai.google.dev/gemini-api/docs/models), [Groq GPT-OSS 120B](https://console.groq.com/docs/model/openai/gpt-oss-120b), [Cloudflare GPT-OSS 20B](https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/).
