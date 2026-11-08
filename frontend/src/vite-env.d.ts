/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KING_FUN_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }
}
