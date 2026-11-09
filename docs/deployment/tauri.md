# Tauri packaging and releases (Android focus)

This repository includes Tauri v2 scaffolding in `src-tauri/` and uses the existing frontend (`frontend/`) as the web UI. Current focus: **Android mobile only**.

## Local prerequisites

- **Bun 1.4.4** (repo-pinned). Install deps from repo root: `bun install --frozen-lockfile`.
- **Rust toolchain** (stable) with Cargo. `src-tauri/Cargo.toml` sets `rust-version = "1.90"`.
- **Android toolchain** (for Android builds): Android Studio / SDK, NDK, platform/build-tools, JDK 21, and Android Rust targets:
  - `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`

## API URL / Vercel placeholder (required for packaged app)

The frontend defaults to same-origin `/api` for web/PWA. A packaged Tauri/WebView origin is not your Vercel origin, so set the **full remote API base including `/api`**:

```env
VITE_KING_FUN_API_URL=https://YOUR_PROJECT.vercel.app/api
```

The app appends `/v1/...` paths (status, content generation, creator, feedback/moderation). Keep the `/api` suffix.

- **`.env.example`** includes this Vercel placeholder.
- **CI/release workflows** require the `VITE_KING_FUN_API_URL` repository secret to contain the real deployed HTTPS API URL (including `/api`) before building packaged production apps.

## HTTPS / Tauri transport behavior

- `frontend/src/services/ai-providers.ts` and `frontend/src/services/creator-access.ts` use Tauri-aware secure-transport checks: in Tauri, the **remote API URL** must be `https:` (localhost/loopback allowed for local dev); in web, existing browser+API HTTPS rules apply.
- API calls are routed through `frontend/src/services/api-transport.ts` (`apiFetch`): browser uses `fetch`; Tauri uses `@tauri-apps/plugin-http` (Rust-backed, not subject to WebView CORS; still constrained by the capability URL allowlist).
- Tauri HTTP allowlist is configured in `src-tauri/capabilities/default.json` (`http:default`) for Vercel API hosts plus localhost dev URLs. The packaged app still requires `VITE_KING_FUN_API_URL` to target the intended production host.

## Local commands

From repository root:

- `bun run tauri:android:init` — generate `src-tauri/gen/android/` if needed (requires Android SDK/NDK/JDK).
- `bun run tauri:android:dev` — Android dev (device/emulator + toolchain required).
- `bun run tauri:android:build` — Android CI-style build.
- For a locally signed release, run `bun run tauri android init --ci`, generate icons as below, then set the four `ANDROID_*` variables in your shell and run `bun run scripts/configure-android-release-signing.mjs` before `bun run tauri:android:build`. Do not commit the generated keystore or `keystore.properties`.

Frontend bootstrap/splash (`frontend/index.html` + `frontend/src/main.tsx` `.bootstrap-screen`) and logo assets in `frontend/public/` remain the UI source of truth. Tauri icons are in `src-tauri/icons/` (regenerate: `bun run tauri icon frontend/public/king-fun-logo-source.svg`).

## GitHub workflows

- **`.github/workflows/ci.yml`** — existing quality gates.
- **`.github/workflows/tauri-android.yml`** — Android CI build on push/PR/manual (`ubuntu-24.04`, Bun, Rust Android targets, JDK 21, Android SDK/NDK, `tauri android init` if missing, branded icon generation, `tauri android build --ci`, artifact upload). Its artifact is labelled `tauri-android-ci-unsigned`; it is a build diagnostic, not an installable release. Requires the `VITE_KING_FUN_API_URL` repository secret.
- **`.github/workflows/tauri-release.yml`** — manual `workflow_dispatch` Android release to GitHub Releases. It requires and validates all Android signing secrets, configures Gradle release signing, regenerates branded launcher icons, verifies APK/AAB signatures, and publishes only signed app artifacts.

## Android signing and branded launcher icons

The release workflow requires all four Android signing secrets and fails before building if any are missing or invalid:

- `ANDROID_KEYSTORE_BASE64` — base64-encoded Java keystore file (JKS or PKCS12).
- `ANDROID_KEYSTORE_PASSWORD` — keystore password.
- `ANDROID_KEY_ALIAS` — alias of the signing key inside the keystore.
- `ANDROID_KEY_PASSWORD` — password for that key; it may differ from the keystore password.

`tauri-release.yml` invokes `scripts/configure-android-release-signing.mjs`. The script validates the decoded keystore, alias, store password, and private-key password with `keytool` (including a temporary CSR operation that is deleted immediately afterward), writes a runner-private `src-tauri/gen/android/keystore.properties`, and patches the generated `app/build.gradle.kts` so the **release** build type uses the configured release signing key. The debug build type is left unchanged. The signing step is unconditional: it does not silently skip when a step-local environment variable is unavailable. Secrets and keystore files are never committed or printed.

After `tauri android init`, both Android workflows run:

```sh
bun run tauri icon frontend/public/king-fun-logo-source.svg
```

This regenerates the KING-FUN crown-and-dice launcher artwork (the same app mark used by `frontend/public/king-fun-app-icon-512.png`) inside `src-tauri/gen/android/app/src/main/res/mipmap-*`. The source icon files under `src-tauri/icons/` alone are not a substitute for updating the generated Android Studio project after initialization. The workflow verifies standard, round, and adaptive foreground icon resources across mdpi, hdpi, xhdpi, xxhdpi, and xxxhdpi densities.

Before publishing, the release workflow verifies each release APK with Android `apksigner` and each final app AAB with `jarsigner`. It also extracts the configured keystore certificate fingerprint and requires every package signature to match that exact certificate; a debug-signed package or a package signed with another key is rejected. It stages only verified signed release APKs and final release AABs. Unsigned APKs and intermediary bundles are excluded. When rerunning a tag, the workflow removes old APK/AAB assets from that release before adding the newly verified files, so the previous unsigned APK cannot remain beside the fixed package. The workflow fails rather than publishing a release if no signed APK or signed AAB is produced.

The base Tauri config keeps updater artifacts disabled. Android artifacts are attached to the GitHub Release; mobile updater behavior depends on Tauri/mobile support and your distribution model—validate before relying on in-app Android updates.

## Required GitHub config / secrets

| Name | Kind | Required now | Purpose |
|---|---|---|---|
| `VITE_KING_FUN_API_URL` | Repository secret (`secrets`) | Required for packaged builds/releases | Full hosted API base including `/api`, e.g. `https://<real>.vercel.app/api`. |
| `GITHUB_TOKEN` | Automatic secret | Yes for release publish | Release creation/upload (`permissions: contents: write`). Repo/org must allow Actions release writes. |
| `ANDROID_KEYSTORE_BASE64` | Repository secret (`secrets`) | Required for GitHub Android releases | Base64-encoded Java keystore; validated with `keytool` before the release build. |
| `ANDROID_KEYSTORE_PASSWORD` | Repository secret (`secrets`) | Required for GitHub Android releases | Keystore/container password. |
| `ANDROID_KEY_ALIAS` | Repository secret (`secrets`) | Required for GitHub Android releases | Key alias inside the keystore. |
| `ANDROID_KEY_PASSWORD` | Repository secret (`secrets`) | Required for GitHub Android releases | Private-key password; supports a value different from the keystore password. |

**Before first production release:** set `VITE_KING_FUN_API_URL`, configure Android signing, and confirm the hosted Vercel API supports the required routes and CORS/auth expectations (Tauri HTTP plugin avoids WebView CORS, but server-side policies still apply).

## Dependabot

`.github/dependabot.yml` runs weekly updates for Bun/npm manifests (`/`), Cargo (`/src-tauri`), and GitHub Actions (`/`). Review with normal quality gates.
## Android-first notes (current focus)

- `tauri-android.yml` builds Android on commits/PRs/manual, regenerates branded launcher assets, and uploads an explicitly unsigned CI artifact named `tauri-android-ci-unsigned`; this artifact is not intended for installation.
- `tauri-release.yml` requires Android signing secrets, rebuilds branded launcher assets, verifies signed APK/AAB output, and publishes only validated installable release artifacts.
- CI runs `bun run tauri android init --ci` when `src-tauri/gen/android` is missing. The generated Android project is ignored by git (`src-tauri/gen/`); review and commit Android project customizations only if you need stable manual Gradle/signing edits in-repo.
- Android release signing is mandatory in `tauri-release.yml`; the release cannot proceed with missing/invalid secrets and cannot publish unsigned APK/AAB artifacts. Preserve the same keystore for every update of an already distributed app, because Android requires update signatures to match.
- Android launcher icon generation runs after `tauri android init` in both Android workflows, using the canonical `frontend/public/king-fun-logo-source.svg` asset.
- Updater: Android in-app update behavior/distribution should be validated for your chosen channel (GitHub Releases/Play Store). Do not claim silent auto-update on Android without testing the target flow.

## Required config/secrets checklist (Android + Vercel API)

1. Set repository secret `VITE_KING_FUN_API_URL=https://<real-vercel-project>.vercel.app/api`.
2. Set all four Android signing secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) before dispatching a release. Keep the same signing key for all future updates.
3. Ensure GitHub Actions has `contents: write` allowed for release publishing (`GITHUB_TOKEN`).
4. Backend/CORS: Tauri HTTP plugin bypasses WebView CORS, but the Vercel API must still accept requests and enforce its own auth/rate limits. Verify `/api/v1/*` routes, HTTPS, and any origin checks for your deployment.
