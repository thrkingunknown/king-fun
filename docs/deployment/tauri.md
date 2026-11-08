# Tauri packaging and releases (Android focus)

This repository includes Tauri v2 scaffolding in `src-tauri/` and uses the existing frontend (`frontend/`) as the web UI. Current focus: **Android mobile only** (desktop workflows remain available/manual where useful).

## Local prerequisites

- **Bun 1.4.4** (repo-pinned). Install deps from repo root: `bun install --frozen-lockfile`.
- **Rust toolchain** (stable) with Cargo. `src-tauri/Cargo.toml` sets `rust-version = "1.90"`.
- **Android toolchain** (for Android builds): Android Studio / SDK, NDK, platform/build-tools, JDK 21, and Android Rust targets:
  - `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
- **Desktop builds (optional):** WebView2 + MSVC Build Tools on Windows, Xcode CLT on macOS, WebKitGTK/AppIndicator/librsvg/patchelf on Linux.

## API URL / Vercel placeholder (required for packaged app)

The frontend defaults to same-origin `/api` for web/PWA. A packaged Tauri/WebView origin is not your Vercel origin, so set the **full remote API base including `/api`**:

```env
VITE_KING_FUN_API_URL=https://YOUR_PROJECT.vercel.app/api
```

The app appends `/v1/...` paths (status, content generation, creator, feedback/moderation). Keep the `/api` suffix.

- **`.env.example`** includes this Vercel placeholder.
- **CI/release workflows** require `vars.VITE_KING_FUN_API_URL` to contain the real deployed HTTPS API URL (including `/api`) before building packaged production apps.

## HTTPS / Tauri transport behavior

- `frontend/src/services/ai-providers.ts` and `frontend/src/services/creator-access.ts` use Tauri-aware secure-transport checks: in Tauri, the **remote API URL** must be `https:` (localhost/loopback allowed for local dev); in web, existing browser+API HTTPS rules apply.
- API calls are routed through `frontend/src/services/api-transport.ts` (`apiFetch`): browser uses `fetch`; Tauri uses `@tauri-apps/plugin-http` (Rust-backed, not subject to WebView CORS; still constrained by the capability URL allowlist).
- Tauri HTTP allowlist is configured in `src-tauri/capabilities/default.json` (`http:default`) for Vercel API hosts plus localhost dev URLs. The packaged app still requires `VITE_KING_FUN_API_URL` to target the intended production host.

## Local commands

From repository root:

- `bun run tauri:dev` — desktop dev (optional).
- `bun run tauri:android:init` — generate `src-tauri/gen/android/` if needed (requires Android SDK/NDK/JDK).
- `bun run tauri:android:dev` — Android dev (device/emulator + toolchain required).
- `bun run tauri:android:build` — Android CI-style build.
- `bun run tauri:build` — desktop build (optional).

Frontend bootstrap/splash (`frontend/index.html` + `frontend/src/main.tsx` `.bootstrap-screen`) and logo assets in `frontend/public/` remain the UI source of truth. Tauri icons are in `src-tauri/icons/` (regenerate: `bun run tauri icon frontend/public/king-fun-logo-source.svg`).

## GitHub workflows

- **`.github/workflows/ci.yml`** — existing quality gates.
- **`.github/workflows/tauri-build.yml`** — desktop builds on push/PR/manual (Ubuntu/macOS/Windows), artifact upload only.
- **`.github/workflows/tauri-android.yml`** — Android build on push/PR/manual (`ubuntu-24.04`, Bun, Rust Android targets, JDK 21, Android SDK/NDK, `tauri android init` if missing, `tauri android build --ci`, artifact upload). Requires `vars.VITE_KING_FUN_API_URL`.
- **`.github/workflows/tauri-release.yml`** — manual `workflow_dispatch` release to GitHub Releases. **Default is Android-only** (`android_only=true`); set `android_only=false` to also run desktop release jobs. Uses `tauri-apps/tauri-action` for desktop (when enabled) and publishes Android APK/AAB artifacts via `softprops/action-gh-release`.

## Updater & signing

The base Tauri config keeps updater artifacts disabled until a release is explicitly configured. The desktop release workflow validates `TAURI_UPDATER_PUBLIC_KEY`, generates `src-tauri/tauri.release.conf.json`, and passes it with `--config`; the overlay points to GitHub Release updater metadata and enables signed updater artifacts. Android artifacts are attached to the GitHub Release; mobile updater behavior depends on Tauri/mobile support and your distribution model—validate before relying on in-app Android updates.

## Required GitHub config / secrets

| Name | Kind | Required now | Purpose |
|---|---|---|---|
| `VITE_KING_FUN_API_URL` | Repository variable (`vars`) | Required for packaged builds/releases | Full hosted API base including `/api`, e.g. `https://<real>.vercel.app/api`. |
| `GITHUB_TOKEN` | Automatic secret | Yes for release publish | Release creation/upload (`permissions: contents: write`). Repo/org must allow Actions release writes. |
| `TAURI_SIGNING_PRIVATE_KEY` | Secret | Required for real updater/signing flow | Tauri updater signing private key (from `tauri signer generate`). Do not commit. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Secret | If key is password-protected | Password for the updater signing key. |
| `TAURI_UPDATER_PUBLIC_KEY` | Repository variable (`vars`) | Required for desktop updater releases | Matching public key used by the release-time Tauri updater config; keep the private key in secrets. |
| Android keystore secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) | Secrets | Required for signed Play-distributable/release APK/AAB signing flow you choose | `tauri-release.yml` restores a keystore to `src-tauri/gen/android/keystore.properties` **only if `ANDROID_KEYSTORE_BASE64` is set and Android project is initialized**. You may also configure signing in `src-tauri/gen/android` per your release process; do not commit keystores/passwords. |
| Apple/Windows signing/notarization secrets | Secrets | Only if enabling desktop signing | Not configured by default. |

**Before first production release:** set `VITE_KING_FUN_API_URL`, set `TAURI_UPDATER_PUBLIC_KEY`, configure matching `TAURI_SIGNING_PRIVATE_KEY` secrets, configure Android signing, and confirm the hosted Vercel API supports the required routes and CORS/auth expectations (Tauri HTTP plugin avoids WebView CORS, but server-side policies still apply).

## Dependabot

`.github/dependabot.yml` runs weekly updates for Bun/npm manifests (`/`), Cargo (`/src-tauri`), and GitHub Actions (`/`). Review with normal quality gates.
## Android-first notes (current focus)

- `tauri-android.yml` builds Android on commits/PRs/manual and requires `vars.VITE_KING_FUN_API_URL`.
- `tauri-release.yml` defaults `android_only=true` for manual releases and publishes APK/AAB outputs to the GitHub Release. Set `android_only=false` only when you intentionally want desktop release jobs too.
- CI runs `bun run tauri android init --ci` when `src-tauri/gen/android` is missing. The generated Android project is ignored by git (`src-tauri/gen/`); review and commit Android project customizations only if you need stable manual Gradle/signing edits in-repo.
- Android release signing: workflow restores a keystore/properties when `ANDROID_KEYSTORE_BASE64` is present. For production Play/App distribution, configure the signing method you trust (keystore secrets, Play App Signing/upload key, or repo-managed Gradle config) and keep secrets out of git.
- Updater: desktop release builds use a generated `plugins.updater` overlay and GitHub Release metadata. Tauri’s desktop updater is mature; Android in-app update behavior/distribution should be validated for your chosen channel (GitHub Releases/Play Store). Do not claim silent auto-update on Android without testing the target flow.

## Required config/secrets checklist (Android + Vercel API)

1. Set repo variable `VITE_KING_FUN_API_URL=https://<real-vercel-project>.vercel.app/api`.
2. Set repo variable `TAURI_UPDATER_PUBLIC_KEY` to the public half of the updater key pair.
3. Generate updater keys: `bun run tauri signer generate -w <private-key-path>`. Store the **private key** as `TAURI_SIGNING_PRIVATE_KEY` (+ optional `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) in GitHub secrets.
5. Android signing secrets (if publishing signed release artifacts): `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
6. Ensure GitHub Actions has `contents: write` allowed for release publishing (`GITHUB_TOKEN`).
7. Backend/CORS: Tauri HTTP plugin bypasses WebView CORS, but the Vercel API must still accept requests and enforce its own auth/rate limits. Verify `/api/v1/*` routes, HTTPS, and any origin checks for your deployment.
