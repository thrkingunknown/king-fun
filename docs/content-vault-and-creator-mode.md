# Content Vault, Community Quality and Creator Mode

## Redis configuration

Use a **separate Upstash Redis database** from the existing AI limiter. Configure:

- `CONTENT_VAULT_REST_URL`
- `CONTENT_VAULT_REST_TOKEN`
- `CONTENT_VAULT_KEY_PREFIX` (defaults to `king-fun:content:v1`)
- `CONTENT_VAULT_TTL_SECONDS` (defaults to 90 days)

The gateway validates requests first, then checks the content pool before consuming an AI generation slot. Pools are partitioned by game, item kind, category, locale and suitability. Generated items are validated before they are cached. Canonical IDs prevent duplicate additions, a short Redis lock reduces concurrent cache-miss stampedes, and cached items with quarantined/rejected/retired status are excluded. Cache failures fail open to the existing generation path; the PWA's bundled and IndexedDB content remains the offline fallback.

The existing `AI_LIMITER_REST_URL` and `AI_LIMITER_REST_TOKEN` remain dedicated to generation quotas and concurrency leases. Do not point the two services at the same database if you can provision a separate one; their prefixes are distinct regardless.

## Community quality

The Helpful and Not-a-good-fit reactions on Truth or Dare and I Have Never send anonymous content feedback. A browser-generated voter ID is stored locally; no player name is sent. Votes are idempotent per voter and content item. Three distinct negative votes quarantine an item and add it to the creator review queue. Quarantined, rejected and retired IDs are synchronized to clients and filtered from future local content selection. One negative vote never deletes content automatically.

The hidden creator review queue can approve, reject or retire quarantined content. The content record and vote history are retained in Redis for moderation context. The queue is bounded to the most recent 100 flagged IDs in a response.

## Hidden creator-only Kailas mode

Configure `KING_FUN_CREATOR_SECRET` with a random secret of at least 24 characters. Prefer also setting `KING_FUN_CREATOR_TOKEN_SECRET` to a separate random secret of at least 32 characters. These values are server-only; never use a `VITE_` prefix and never commit them.

The unlock surface is not advertised in the UI. It opens after nine quick presses on the KING-FUN brand mark. The creator key is verified by the backend, which issues a signed 30-day token. The token is stored locally on that device; to use the mode on another device, repeat the hidden unlock and enter the same creator key. Locking the profile removes that device's token. To revoke every device at once, rotate both `KING_FUN_CREATOR_SECRET` and `KING_FUN_CREATOR_TOKEN_SECRET`.

Creator access is **not** granted by the name `Kailas`. Only a valid signed creator token activates the override. Once unlocked, the easier-content selector applies only when the current individual recipient's normalized name is `Kailas` (case-insensitive). It chooses from the simplest third of the eligible content pool. Other players continue using the full eligible pool. All-together prompts remain shared and are not modified for one person. This currently applies to individual Truth or Dare and I Have Never turns; it does not rewrite game rules, roles, scores, or global difficulty settings.

A browser-delivered client can never make a secret feature literally impossible to reverse engineer. The important access control is the server-verified creator credential; the hidden gesture only keeps the entry point out of ordinary navigation.

## Deployment checklist

1. Provision a separate Upstash Redis database and set the content-vault URL/token.
2. Set the creator secret and independent token-signing secret in the backend deployment environment.
3. Keep `AI_ENABLED=false` until the provider and existing shared generation limiter are configured.
4. Verify `/v1/status` reports `contentVault: true` and `creatorUnlock: true`.
5. Unlock on one device, test the Kailas turn with another player in the same round, then repeat on a second device.
6. Submit three negative votes from distinct browser identities and verify the item enters the private review queue and is excluded from future draws.
7. Verify Redis downtime does not prevent local/bundled gameplay.
