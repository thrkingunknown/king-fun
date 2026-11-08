import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, test } from 'bun:test'

const WORKER_SOURCE = readFileSync(new URL('../../../public/sw.js', import.meta.url), 'utf8')
const ORIGIN = 'https://king-fun.test'

type CacheEntry = { readonly url: string; readonly response: Response }

class MemoryCache {
  private readonly entries = new Map<string, Response>()

  constructor(private readonly fetcher: (request: string | Request, init?: RequestInit) => Promise<Response>) {}

  private key(request: string | Request): string {
    return typeof request === 'string' ? new URL(request, ORIGIN).href : request.url
  }

  async add(request: string | Request): Promise<void> {
    const response = await this.fetcher(request)
    if (!response.ok) throw new Error(`Cache add failed: ${this.key(request)}`)
    await this.put(request, response)
  }

  async put(request: string | Request, response: Response): Promise<void> {
    this.entries.set(this.key(request), response.clone())
  }

  async match(request: string | Request): Promise<Response | undefined> {
    return this.entries.get(this.key(request))?.clone()
  }

  async keys(): Promise<CacheEntry[]> {
    return [...this.entries.entries()].map(([url, response]) => ({ url, response }))
  }

  async delete(request: string | Request): Promise<boolean> {
    return this.entries.delete(this.key(request))
  }
}

function createWorker() {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>()
  const cacheMap = new Map<string, MemoryCache>()
  const oldCache = new MemoryCache(async () => new Response('old'))
  cacheMap.set('king-fun-shell-v2', oldCache)
  cacheMap.set('another-app-cache', new MemoryCache(async () => new Response('keep')))
  let offline = false
  const requests: string[] = []
  const fetcher = async (request: string | Request, _init?: RequestInit): Promise<Response> => {
    const url = typeof request === 'string' ? new URL(request, ORIGIN).href : request.url
    requests.push(url)
    if (offline) throw new TypeError('Network unavailable')
    if (url === `${ORIGIN}/`) {
      return new Response('<html><head><link rel="stylesheet" href="/assets/app-123.css"></head><body><script type="module" src="/assets/app-123.js"></script></body></html>', {
        headers: { 'content-type': 'text/html' },
      })
    }
    if (url === `${ORIGIN}/precache-manifest.json`) {
      return new Response(JSON.stringify(['/assets/app-123.js', '/assets/app-123.css', '/assets/imposter-lazy.js', '/assets/guessup-lazy.js']), {
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(`asset:${url}`, { status: 200 })
  }
  const cacheStorage = {
    open: async (name: string) => {
      let cache = cacheMap.get(name)
      if (!cache) { cache = new MemoryCache(fetcher); cacheMap.set(name, cache) }
      return cache
    },
    keys: async () => [...cacheMap.keys()],
    delete: async (name: string) => cacheMap.delete(name),
    match: async (request: string | Request) => {
      for (const cache of cacheMap.values()) {
        const response = await cache.match(request)
        if (response) return response
      }
      return undefined
    },
  }
  const workerSelf = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: (event: Record<string, unknown>) => void) => listeners.set(type, listener),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  }
  runInNewContext(WORKER_SOURCE, {
    self: workerSelf,
    caches: cacheStorage,
    fetch: fetcher,
    URL,
    Response,
    Promise,
  })
  return {
    listeners,
    cacheMap,
    requests,
    setOffline(value: boolean) { offline = value },
  }
}

async function dispatch(worker: ReturnType<typeof createWorker>, type: string, values: Record<string, unknown> = {}) {
  const listener = worker.listeners.get(type)
  if (!listener) throw new Error(`Worker has no ${type} listener.`)
  let waitUntil: Promise<unknown> | undefined
  let responsePromise: Promise<Response> | undefined
  listener({
    ...values,
    waitUntil(promise: Promise<unknown>) { waitUntil = promise },
    respondWith(promise: Promise<Response>) { responsePromise = promise },
  })
  if (waitUntil) await waitUntil
  return responsePromise ? responsePromise : undefined
}

describe('service worker offline and cache boundaries', () => {
  test('bumps the cache namespace when the emitted shell graph changes', () => {
    expect(WORKER_SOURCE).toContain("const CACHE_PREFIX = 'king-fun-shell-'")
    expect(WORKER_SOURCE).toContain("const CACHE_NAME = 'king-fun-shell-v8'")
  })

  test('precaches the app shell and exact Vite-hashed runtime assets', async () => {
    const worker = createWorker()
    await dispatch(worker, 'install')
    const cache = worker.cacheMap.get('king-fun-shell-v8')
    expect(cache).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/`)).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/assets/app-123.js`)).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/assets/app-123.css`)).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/assets/imposter-lazy.js`)).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/assets/guessup-lazy.js`)).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/precache-manifest.json`)).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/manifest.webmanifest`)).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/king-fun-logo-192.png`)).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/king-fun-logo-512.png`)).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/king-fun-app-icon-192.png`)).toBeDefined()
    expect(await cache?.match(`${ORIGIN}/king-fun-app-icon-512.png`)).toBeDefined()
  })

  test('activation removes only stale King-Fun caches', async () => {
    const worker = createWorker()
    await dispatch(worker, 'activate')
    expect(worker.cacheMap.has('king-fun-shell-v2')).toBe(false)
    expect(worker.cacheMap.has('another-app-cache')).toBe(true)
  })

  test('does not intercept API requests, external requests, or non-GET requests', async () => {
    const worker = createWorker()
    await dispatch(worker, 'install')
    const api = await dispatch(worker, 'fetch', { request: { method: 'GET', url: `${ORIGIN}/api/llm`, mode: 'cors' } })
    const post = await dispatch(worker, 'fetch', { request: { method: 'POST', url: `${ORIGIN}/assets/submit`, mode: 'cors' } })
    const external = await dispatch(worker, 'fetch', { request: { method: 'GET', url: 'https://provider.test/v1', mode: 'cors' } })
    expect(api).toBeUndefined()
    expect(post).toBeUndefined()
    expect(external).toBeUndefined()
  })


  test('does not read responses from unrelated origin caches', async () => {
    const worker = createWorker()
    await dispatch(worker, 'install')
    const unrelated = worker.cacheMap.get('another-app-cache')!
    await unrelated.put(`${ORIGIN}/assets/not-in-king-fun.js`, new Response('unrelated app response'))
    worker.setOffline(true)
    let rejected = false
    try {
      await dispatch(worker, 'fetch', {
        request: { method: 'GET', url: `${ORIGIN}/assets/not-in-king-fun.js`, mode: 'same-origin' },
      })
    } catch {
      rejected = true
    }
    expect(rejected).toBe(true)
  })

  test('bounds the runtime hashed-asset cache to the configured maximum', async () => {
    const worker = createWorker()
    await dispatch(worker, 'install')
    for (let index = 0; index < 85; index += 1) {
      await dispatch(worker, 'fetch', { request: { method: 'GET', url: `${ORIGIN}/assets/runtime-${index}.js`, mode: 'same-origin' } })
    }
    const cache = worker.cacheMap.get('king-fun-shell-v8')
    const precached = new Set(['/assets/app-123.js', '/assets/app-123.css', '/assets/imposter-lazy.js', '/assets/guessup-lazy.js'])
    const assetKeys = (await cache?.keys() ?? []).filter(key => new URL(key.url).pathname.startsWith('/assets/'))
    const runtimeCount = assetKeys.filter(key => !precached.has(new URL(key.url).pathname)).length
    expect(runtimeCount).toBeLessThanOrEqual(80)
  })

  test('uses cached hashed assets and falls back to the shell for offline navigation', async () => {
    const worker = createWorker()
    await dispatch(worker, 'install')
    const cachedAsset = await dispatch(worker, 'fetch', { request: { method: 'GET', url: `${ORIGIN}/assets/app-123.js`, mode: 'same-origin' } })
    expect(await cachedAsset?.text()).toContain('asset:')
    worker.setOffline(true)
    const navigation = await dispatch(worker, 'fetch', { request: { method: 'GET', url: `${ORIGIN}/some/deep/link`, mode: 'navigate' } })
    expect(await navigation?.text()).toContain('<html>')
  })
})
