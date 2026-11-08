import { isTauri } from '@tauri-apps/api/core'

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch(input, init as never)
  }
  return fetch(input, init)
}
