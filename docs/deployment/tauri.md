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

Frontend bootstrap/splash (`frontend/index.html` + `frontend/src/main.tsx` `.bootstrap-screen`) and logo assets in `frontend/public/` remain the UI source of truth. Tauri icons are in `src-tauri/icons/` (regenerate: `bun run tauri icon frontend/public/king-fun-logo-source.svg`).

## GitHub workflows

- **`.github/workflows/ci.yml`** — existing quality gates.
- **`.github/workflows/tauri-android.yml`** — Android build on push/PR/manual (`ubuntu-24.04`, Bun, Rust Android targets, JDK 21, Android SDK/NDK, `tauri android init` if missing, `tauri android build --ci`, artifact upload). Requires the `VITE_KING_FUN_API_URL` repository secret.
- **`.github/workflows/tauri-release.yml`** — manual `workflow_dispatch` Android release to GitHub Releases. It publishes Android APK/AAB artifacts via `softprops/action-gh-release`.

## Updater & signing

The base Tauri config keeps updater artifacts disabled. Android artifacts are attached to the GitHub Release; mobile updater behavior depends on Tauri/mobile support and your distribution model—validate before relying on in-app Android updates.

## Required GitHub config / secrets

| Name | Kind | Required now | Purpose |
|---|---|---|---|
| `VITE_KING_FUN_API_URL` | Repository secret (`secrets`) | Required for packaged builds/releases | Full hosted API base including `/api`, e.g. `https://<real>.vercel.app/api`. |
| `GITHUB_TOKEN` | Automatic secret | Yes for release publish | Release creation/upload (`permissions: contents: write`). Repo/org must allow Actions release writes. |
| Android keystore secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) | Secrets | Required for signed Play-distributable/release APK/AAB signing flow you choose | `tauri-release.yml` restores a keystore to `src-tauri/gen/android/keystore.properties` **only if `ANDROID_KEYSTORE_BASE64` is set and Android project is initialized**. You may also configure signing in `src-tauri/gen/android` per your release process; do not commit keystores/passwords. |

**Before first production release:** set `VITE_KING_FUN_API_URL`, configure Android signing, and confirm the hosted Vercel API supports the required routes and CORS/auth expectations (Tauri HTTP plugin avoids WebView CORS, but server-side policies still apply).

## Dependabot

`.github/dependabot.yml` runs weekly updates for Bun/npm manifests (`/`), Cargo (`/src-tauri`), and GitHub Actions (`/`). Review with normal quality gates.
## Android-first notes (current focus)

- `tauri-android.yml` builds Android on commits/PRs/manual and requires the `VITE_KING_FUN_API_URL` repository secret.
- `tauri-release.yml` publishes APK/AAB outputs to the GitHub Release.
- CI runs `bun run tauri android init --ci` when `src-tauri/gen/android` is missing. The generated Android project is ignored by git (`src-tauri/gen/`); review and commit Android project customizations only if you need stable manual Gradle/signing edits in-repo.
- Android release signing: workflow restores a keystore/properties when `ANDROID_KEYSTORE_BASE64` is present. For production Play/App distribution, configure the signing method you trust (keystore secrets, Play App Signing/upload key, or repo-managed Gradle config) and keep secrets out of git.
- Updater: Android in-app update behavior/distribution should be validated for your chosen channel (GitHub Releases/Play Store). Do not claim silent auto-update on Android without testing the target flow.

## Required config/secrets checklist (Android + Vercel API)

1. Set repository secret `VITE_KING_FUN_API_URL=https://<real-vercel-project>.vercel.app/api`.
2. Configure Android signing secrets if publishing signed APK/AAB artifacts.
3. Ensure GitHub Actions has `contents: write` allowed for release publishing (`GITHUB_TOKEN`).
4. Backend/CORS: Tauri HTTP plugin bypasses WebView CORS, but the Vercel API must still accept requests and enforce its own auth/rate limits. Verify `/api/v1/*` routes, HTTPS, and any origin checks for your deployment.
