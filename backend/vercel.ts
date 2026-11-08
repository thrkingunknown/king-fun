import { Elysia } from 'elysia'
import { handle } from './index.ts'

function stripPublicApiPrefix(request: Request): Request {
  const url = new URL(request.url)
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/'
  }
  return new Request(url, request)
}

const api = new Elysia({ name: 'king-fun-vercel-api' })
  .all('/*', ({ request }) => handle(stripPublicApiPrefix(request)))

export default api
