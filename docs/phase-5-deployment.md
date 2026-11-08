# Phase 5 deployment and operator runbook

**Architecture:** root Bun workspace, `frontend/` Vite service, and `backend/` Elysia service deployed through Vercel Services. `src-tauri/` is not deployed to Vercel.

**Release state (2026-11-05):** deployment configuration and gateway source are implemented. The user confirmed Bun 1.4.4 frozen install and repository policy pass, then supplied a full run where both workspace typechecks, 161 tests, and the frontend production build passed. A subsequent archive removes the 16 Oxlint `no-useless-escape` warnings in provider test fixtures without changing their runtime string values. The Phase 6 root check now also includes release-contract tests, bundle-budget checks, and `bun audit --audit-level=moderate`; run it on the exact Phase 6 archive before release. No live deployment, provider credentials, billing controls, or hosted recovery rehearsal have been configured by this work. For local development, `bun run dev:backend` uses process watch/restart; `bun run dev:backend:hot` uses Bun hot module reload.

## 1. Deployment topology

Use one Vercel project with two public services: the Vite frontend at `/` and the Elysia backend at `/api/*`. This keeps the browser and gateway same-origin by default, avoids a cross-origin BYOK transport, and avoids exposing a separate API hostname. The backend service entrypoint accepts both the public `/api` prefix and the path after Vercel service rewriting before delegating to the canonical prefix-free backend app. No service binding is required because the browser calls the backend through the public same-origin rewrite and the backend calls only external providers and data services. `src-tauri/` is intentionally excluded from the Vercel service list. See [Vercel Services](https://vercel.com/docs/services) and [Elysia on Vercel](https://vercel.com/docs/frameworks/backend/elysia).

Repository settings:

| Setting | Value |
|---|---|
| Root Directory | `.` (repository root) |
| Framework preset | Other / Vite-compatible |
| Install Command | `bun install --frozen-lockfile` |
| Build Command | `bun run build` |
| Output Directory | `frontend/dist` |
| Function runtime | Bun `1.x` managed by Vercel; local/CI toolchain pinned to 1.4.4 |
| API entrypoint | `backend/vercel.ts` |

Do not set Vercel's Root Directory to `frontend/`; that would exclude the sibling `backend/`, root workspace manifest, root lockfile, and root API adapter. Do not deploy the frontend as one project and the Elysia gateway as another unless the owner approves a separate-origin architecture and updates CORS/API-origin policy.

## 2. AI category authoring and content persistence

Imposter category generation is a distinct metadata task (`game=imposter`, `itemKind=category`). The provider must return a short category name, a one-sentence description, and an optional representative emoji. The backend rejects unknown fields, missing/oversized descriptions, unsafe values, and duplicate/canonically equivalent names; it derives a stable slug from the name rather than trusting a provider-supplied ID. Category suggestions are not silently saved: a user selects one, reviews/edits its metadata, generates word entries for the selected category ID, reviews each answer and its 20 hints, then saves the metadata and content together as one local custom pack. The selected category ID is retained on the stored content items so category filtering and recent-content queues remain consistent. Category metadata has no curated offline fallback; offline play remains available through existing built-in/manual packs.

## 3. Required lock and CI gate

The workspace root owns `package.json`; workspaces are named `@king-fun/frontend` and `@king-fun/backend`. There must be exactly one lockfile at repository root. The root lock contains all three current workspace snapshots, including Elysia. Bun 1.4.4 may retain a renamed root package's old `name` label after a no-op install; this is tracked as Bun issue #47656. The corrected archive updates only `workspaces[""].name` to `king-fun`. Dependency maps were checked against all three manifests.

From the repository root, verify the corrected lock with Bun 1.4.4:

```sh
bun --version
# Must print 1.4.4
bun install --frozen-lockfile
bun run check
```

The corrected archive updates only the root workspace name metadata affected by Bun issue #47656; dependency versions and integrity hashes are unchanged. Verify a clean checkout with:

```sh
bun install --frozen-lockfile
bun run check
```

Do not delete the lockfile or change dependency versions to work around policy. The root display-name correction is a documented workaround for Bun issue #47656; it does not alter the resolved package graph. Do not replace frozen installs with unlocked installs in CI or Vercel. The GitHub Actions workflow installs Bun 1.4.4, runs frozen installation, and executes the root check script.

## 4. Environment variables

Copy `.env.example` to `.env` for local development. Never commit `.env`; never use `VITE_` for provider or limiter secrets. In Vercel, configure server-side variables for Production and any explicitly approved Preview environment.

| Variable | Purpose | Production guidance |
|---|---|---|
| `AI_ENABLED` | Operator kill switch | Keep `false` until all controls and tests pass; then set `true` intentionally |
| `FRONTEND_ORIGINS` | Exact allowed browser origins | Required in production; comma-separated exact `https://` origins; no wildcard, path, query, or fragment |
| `AI_LIMITER_REST_URL` | Shared Redis-compatible REST endpoint | HTTPS only; use an Upstash Redis REST database or compatible provider supporting atomic `EVAL` |
| `AI_LIMITER_REST_TOKEN` | Shared limiter authorization | Secret, least privilege, server-only; never log or expose to Vite |
| `AI_LIMITER_KEY_PREFIX` | Namespace for shared counters | Keep environment-specific (for example `king-fun:prod:ai:v1`) |
| `AI_RATE_LIMIT_PER_MINUTE` | Per-client admission limit | Positive integer; default 12; hard code maximum 120 |
| `AI_DAILY_REQUEST_LIMIT` | Global daily gateway request cap | Positive integer; default 250; hard code maximum 100,000 |
| `AI_GEMINI_DAILY_REQUEST_LIMIT` | Per-provider daily Gemini cap | Positive integer; defaults to global cap |
| `AI_GROQ_DAILY_REQUEST_LIMIT` | Per-provider daily Groq cap | Positive integer; defaults to global cap |
| `AI_CLOUDFLARE_DAILY_REQUEST_LIMIT` | Per-provider Cloudflare cap | Positive integer; defaults to global cap |
| `AI_MAX_CONCURRENT_REQUESTS` | Global active-generation cap | Positive integer; default 4; hard code maximum 32 |
| `AI_MAX_OUTPUT_TOKENS` | Provider output ceiling | Omit for task-aware defaults (4,000 generally; 6,000 for Imposter word/hint batches); explicit values apply to every task; hard code maximum 6,000 |
| `AI_PROVIDER_TIMEOUT_MS` | Per-provider timeout | Default 30,000 ms; hard code maximum 45,000 ms |
| `GEMINI_MODEL` | Gemini model identifier | Server-side only; verify model availability/quotas before enabling |
| `GROQ_MODEL` | Groq model identifier | Server-side only; verify model availability/quotas before enabling |
| `CLOUDFLARE_AI_MODEL` | Cloudflare model identifier | Server-side only; fixed allowlisted model syntax |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account | Server-side secret configuration |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI token | Least-privilege token; server-side only |
| `VITE_KING_FUN_API_URL` | Optional separate API origin | Leave blank for same-origin `/api`; never place secrets here |

When `AI_MAX_OUTPUT_TOKENS` is omitted, the backend selects 4,000 by default and 6,000 for Imposter word/hint batches; an explicit operator value is a global ceiling for every task. The shared limiter sends Redis `EVAL` commands via the REST endpoint using an HTTPS POST JSON command body; it performs atomic per-client minute, global daily, provider daily, and concurrency admission. Quotas are checked before any counters are incremented, so rejected requests do not consume daily budget. Global concurrency uses one ZSET lease per request, Redis server time, and a 90-second per-request expiry; normal completion removes only its own lease, while a terminated function leaves a bounded stale lease that expires without erasing other active requests. Daily/minute quota counters are intentionally not refunded after provider failure or cancellation because an upstream attempt may already have been charged. Upstash documents JSON-array command bodies and Lua `EVAL` support in its [REST API guide](https://upstash.com/docs/redis/features/restapi) and [EVAL reference](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval). Address keys are HMAC-hashed with the shared limiter token so they remain consistent across serverless instances without storing raw IP addresses.

**Fail-closed behavior:** in `NODE_ENV=production`, generation returns unavailable unless both the shared limiter configuration is syntactically valid and the store is healthy. Production also has no implicit localhost CORS allowlist: `FRONTEND_ORIGINS` must explicitly contain one or more exact HTTPS origins; insecure, wildcard, path-bearing, or malformed entries are ignored. Local development can use bounded per-process counters without a Redis service. `/v1/status` performs a store health check in production and reports `unavailable` when it cannot reach the shared store.

The daily controls count admitted generation requests, not exact tokens or currency. They are not a monetary spend cap. Configure provider-side budgets/usage alerts and billing restrictions independently. The operator must monitor actual spend; never describe request caps as a guarantee against provider charges.

### Model identifier register (reviewed 2026-11-05)

The `.env.example` defaults are set to currently documented model IDs:

| Provider | Default model ID | Source / operational note |
|---|---|---|
| Google Gemini | `gemini-3.8-flash` | Stable model; structured outputs are supported. Confirm project quota and billing in Google AI Studio. |
| Groq | `openai/gpt-oss-120b` | Model page documents JSON Schema mode. Confirm model access and project rate limits in the Groq console. |
| Cloudflare Workers AI | `@cf/openai/gpt-oss-20b` | Uses the OpenAI-compatible `/ai/v1/chat/completions` endpoint; schema is included in the system prompt and validated server-side because GPT-OSS is not in the published JSON Mode support matrix. Confirm account availability and applicable usage billing. |

These checks confirm published model identifiers only. They do not establish that a particular operator account has quota, free-tier eligibility, approved billing, or sufficient spending controls. Recheck the provider catalogue before enabling traffic.

Sources: [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Groq GPT-OSS 120B](https://console.groq.com/docs/model/openai/gpt-oss-120b), [Cloudflare GPT-OSS 20B](https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/), [Cloudflare OpenAI-compatible endpoints](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/), and [Cloudflare JSON Mode support matrix](https://developers.cloudflare.com/workers-ai/features/json-mode/).

## 5. Provider and privacy configuration

- `AI_ENABLED` defaults to `false`. Keep it disabled until HTTPS, exact origin allowlists, the shared limiter, per-provider caps, Cloudflare least-privilege credentials, usage alerts, and external tests are complete.
- Gemini/Groq BYOK API keys are entered by the user with an explicit consent acknowledgement. The app keeps them in JavaScript tab memory and sends them only on a user-triggered HTTPS request in `X-Provider-Key`. They are not persisted in localStorage, IndexedDB, snapshots, backups, logs, or service-worker caches.
- Cloudflare Account ID, API token, model identifier, and limiter token belong only in server-side environment variables. Never prefix them with `VITE_`.
- The backend does not persist player names, game sessions, prompts, generated batches, votes, roles, or history. Do not add request-body logging, tracing payload capture, or provider response logging.
- The exact CORS list must include the production origin. Add Preview origins only when needed, explicitly, and remove temporary origins after testing. CORS is not authentication or a substitute for the shared limits.

## 6. Local development

After the root lock is repaired and dependencies are installed:

Terminal 1 (frontend):

```sh
bun run dev
```

Terminal 2 (gateway):

```sh
bun run dev:backend
```

The Vite dev server proxies `/api` to `http://127.0.0.1:3001` and strips the prefix. Local gateway mode uses bounded per-process counters when `NODE_ENV` is not `production`; AI generation still remains disabled until `AI_ENABLED=true` is set in `.env`. Never use real production secrets in an untrusted local environment.

## 7. Deployment smoke test

After lock regeneration and the full quality pipeline pass, deploy a Preview first. Keep `AI_ENABLED=false` initially. Check:

1. `GET /api/healthz` returns only `{ "status": "ok" }`.
2. `GET /api/v1/status` exposes only readiness and the supported task list; in production it reports unavailable if the shared limiter is absent or unhealthy.
3. A disallowed `Origin`, non-JSON body, extra request properties, invalid provider, oversized streamed body, and client-supplied Cloudflare key are rejected.
4. A valid request is rejected while the operator kill switch is off.
5. With the limiter enabled, test concurrent requests, same-client minute caps, global daily caps, provider daily caps, and release after success, provider error, timeout, and client cancellation. Confirm counters are shared across distinct function instances.
6. Verify Gemini/Groq BYOK key headers do not appear in Vercel logs, error trackers, tracing, analytics, or browser storage. Use throwaway test keys.
7. Verify provider timeout, 401/403, 429, malformed output, duplicate output, local fallback, and no-content-exhaustion states.
8. Confirm actual vendor quotas, billing, spending alerts, and provider-side restrictions in each operator account.
9. Check offline install/refresh/game loading and ensure `/api` requests and non-GET requests are never cached by the service worker.

Only then enable `AI_ENABLED=true` for the intended environment. Re-test the emergency kill switch and remove temporary test keys/origins.

## 8. Routes

| Public route | Purpose |
|---|---|
| `GET /api/healthz` | Liveness only |
| `GET /api/v1/status` | Non-sensitive readiness and supported task identifiers |
| `POST /api/v1/content/generate` | One validated provider attempt; client orchestrates Gemini → Groq → Cloudflare → local curated fallback |

No general-purpose URL proxy, server-side game session API, online Imposter room, or database service is part of this deployment.
