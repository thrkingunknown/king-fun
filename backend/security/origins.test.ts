import { describe, expect, test } from 'bun:test'
import { parseAllowedOrigins } from './origins.ts'

describe('gateway origin allowlist', () => {
  test('production requires explicitly configured exact HTTPS origins', () => {
    expect([...parseAllowedOrigins(undefined, true)]).toEqual([])
    expect([...parseAllowedOrigins('https://king-fun.example, http://localhost:5173', true)]).toEqual(['https://king-fun.example'])
  })

  test('rejects wildcards, paths, credentials, queries, fragments and malformed entries', () => {
    const origins = parseAllowedOrigins('https://good.example, https://bad.example/path, https://user:pass@auth.example, https://query.example/?x=1, https://fragment.example/#x, *, not a url', true)
    expect([...origins]).toEqual(['https://good.example'])
  })

  test('development defaults to localhost and permits explicitly configured HTTPS origins', () => {
    expect([...parseAllowedOrigins(undefined, false)]).toEqual(['http://localhost:5173', 'http://127.0.0.1:5173'])
    expect([...parseAllowedOrigins('http://localhost:5173, http://evil.example, https://preview.example', false)]).toEqual(['http://localhost:5173', 'https://preview.example'])
  })

  test('production accepts inferred Vercel deployment origins alongside explicit origins', () => {
    expect([...parseAllowedOrigins(undefined, true, ['https://king-fun-fun.vercel.app', 'https://king-fun-preview.vercel.app'])]).toEqual([
      'https://king-fun-fun.vercel.app',
      'https://king-fun-preview.vercel.app',
    ])
  })
})
