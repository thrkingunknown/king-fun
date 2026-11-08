const CACHE_PREFIX = 'king-fun-shell-'
const CACHE_NAME = 'king-fun-shell-v8'
const MAX_RUNTIME_ASSETS = 80
const MAX_PRECACHE_ASSETS = 300
const APP_SHELL_URL = new URL('/', self.location.origin).href
const PRECACHE_MANIFEST_URL = new URL('/precache-manifest.json', self.location.origin).href
const ASSET_PATTERN = /\.(?:js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|avif)$/i

function isApprovedAssetPath(value) {
  try {
    const url = new URL(value, self.location.origin)
    return url.origin === self.location.origin
      && url.pathname.startsWith('/assets/')
      && ASSET_PATTERN.test(url.pathname)
  } catch {
    return false
  }
}

async function cacheRuntimeAsset(cache, request, response) {
  if (!response || !response.ok || response.type === 'opaque') return
  await cache.put(request, response)
  const keys = await cache.keys()
  const manifestResponse = await cache.match(PRECACHE_MANIFEST_URL)
  const manifestPaths = manifestResponse ? new Set(await manifestResponse.json()) : new Set()
  const runtimeKeys = keys.filter((key) => {
    const path = new URL(key.url).pathname
    return path.startsWith('/assets/') && !manifestPaths.has(path)
  })
  const excess = runtimeKeys.length - MAX_RUNTIME_ASSETS
  if (excess > 0) {
    await Promise.all(runtimeKeys.slice(0, excess).map((key) => cache.delete(key)))
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const shellResponse = await fetch(APP_SHELL_URL, { cache: 'no-store' })
    if (!shellResponse.ok) throw new Error('Unable to pre-cache the application shell.')
    const shellHtml = await shellResponse.clone().text()
    await cache.put(APP_SHELL_URL, shellResponse)

    const manifestResponse = await fetch(PRECACHE_MANIFEST_URL, { cache: 'no-store' })
    if (!manifestResponse.ok) throw new Error('Unable to load the production precache manifest.')
    const manifestValue = await manifestResponse.clone().json()
    if (!Array.isArray(manifestValue) || manifestValue.length > MAX_PRECACHE_ASSETS
      || manifestValue.some((path) => typeof path !== 'string' || !isApprovedAssetPath(path))) {
      throw new Error('The production precache manifest contains invalid or unsupported asset paths.')
    }
    await cache.put(PRECACHE_MANIFEST_URL, manifestResponse)
    await cache.add(new URL('/manifest.webmanifest', self.location.origin).href)
    await Promise.all([
      '/king-fun-logo-192.png',
      '/king-fun-logo-512.png',
      '/king-fun-app-icon-192.png',
      '/king-fun-app-icon-512.png',
    ].map(path => cache.add(new URL(path, self.location.origin).href)))

    // Include the entry assets parsed from HTML and every lazy chunk/font/image
    // emitted by Vite. This makes game screens usable after the first cached visit.
    const htmlPaths = [...shellHtml.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
      .map((match) => match[1])
    const assetPaths = [...new Set([...htmlPaths, ...manifestValue])]
      .filter((path) => isApprovedAssetPath(path))
      .map((path) => new URL(path, self.location.origin).href)
    if (assetPaths.length > MAX_PRECACHE_ASSETS) throw new Error('The application emits too many offline assets.')
    await Promise.all(assetPaths.map(async (assetUrl) => {
      const response = await fetch(assetUrl, { cache: 'no-store' })
      if (!response.ok || response.type === 'opaque') throw new Error(`Unable to cache required offline asset: ${assetUrl}`)
      await cache.put(assetUrl, response)
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Never cache API/provider requests, even if a provider is proxied same-origin.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok && response.type !== 'opaque') {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(APP_SHELL_URL, response.clone())
        }
        return response
      } catch {
        const cache = await caches.open(CACHE_NAME)
        return (await cache.match(APP_SHELL_URL)) || Response.error()
      }
    })())
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok && response.type !== 'opaque') {
        await cacheRuntimeAsset(cache, request, response.clone())
      }
      return response
    })())
  }
})
