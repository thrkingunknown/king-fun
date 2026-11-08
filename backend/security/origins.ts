/** Build an exact CORS origin allowlist. Production never inherits local origins. */
export function parseAllowedOrigins(value: string | undefined, production: boolean, inferredOrigins: readonly string[] = []): ReadonlySet<string> {
  const source = [value ?? (production ? '' : 'http://localhost:5173,http://127.0.0.1:5173'), ...inferredOrigins].join(',')
  const origins = new Set<string>()
  for (const candidate of source.split(',').map(origin => origin.trim()).filter(Boolean)) {
    try {
      const parsed = new URL(candidate)
      const isExactOrigin = parsed.origin === candidate
        && !parsed.username
        && !parsed.password
        && parsed.pathname === '/'
        && !parsed.search
        && !parsed.hash
      if (!isExactOrigin) continue
      if (production ? parsed.protocol === 'https:' : parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname))) {
        origins.add(candidate)
      }
    } catch {
      // Invalid and non-origin URLs are intentionally ignored.
    }
  }
  return origins
}
