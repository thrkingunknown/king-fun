import { Elysia } from 'elysia'
import { handle } from '../backend/index.ts'

/**
 * Keep Vercel's function entrypoint an Elysia application. The backend's
 * canonical routes stay prefix-free so local Bun development can expose them
 * directly; this adapter strips only the public /api prefix.
 */
const api = new Elysia({ name: 'king-fun-vercel-api' })
  .all('/api', ({ request }) => handle(request))
  .all('/api/*', ({ request }) => handle(request))

export default api
