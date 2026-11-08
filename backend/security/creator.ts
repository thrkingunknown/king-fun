import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 30
const encoder = new TextEncoder()

type CreatorClaims = { sub: 'king-fun-creator'; iat: number; exp: number; scope: 'kailas-ease-mode' }

function secret(env: NodeJS.ProcessEnv): string | null {
  const value = env.KING_FUN_CREATOR_SECRET?.trim()
  return value && value.length >= 24 && value.length <= 256 ? value : null
}

function signingKey(env: NodeJS.ProcessEnv): string | null {
  const value = env.KING_FUN_CREATOR_TOKEN_SECRET?.trim()
  return value && value.length >= 32 ? value : secret(env)
}

function signature(data: string, key: string): string {
  return createHmac('sha256', key).update(data).digest('base64url')
}

export function isCreatorUnlockConfigured(env: NodeJS.ProcessEnv): boolean {
  return Boolean(secret(env) && signingKey(env))
}

export function issueCreatorToken(env: NodeJS.ProcessEnv, candidate: string, now = Date.now()): string | null {
  const creatorSecret = secret(env)
  const key = signingKey(env)
  if (!creatorSecret || !key || typeof candidate !== 'string' || candidate.length > 256) return null
  const expected = createHmac('sha256', key).update(creatorSecret).digest()
  const supplied = createHmac('sha256', key).update(candidate).digest()
  if (!timingSafeEqual(expected, supplied)) return null
  const issued = Math.floor(now / 1000)
  const claims: CreatorClaims = { sub: 'king-fun-creator', iat: issued, exp: issued + TOKEN_LIFETIME_SECONDS, scope: 'kailas-ease-mode' }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const body = `kf1.${payload}`
  return `${body}.${signature(body, key)}`
}

export function verifyCreatorToken(env: NodeJS.ProcessEnv, token: string | null, now = Date.now()): boolean {
  const key = signingKey(env)
  if (!key || !token || token.length > 2048) return false
  const [version, payload, supplied, extra] = token.split('.')
  if (version !== 'kf1' || !payload || !supplied || extra !== undefined) return false
  const expected = Buffer.from(signature(`${version}.${payload}`, key))
  const actual = Buffer.from(supplied)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<CreatorClaims>
    const current = Math.floor(now / 1000)
    return claims.sub === 'king-fun-creator' && claims.scope === 'kailas-ease-mode'
      && Number.isSafeInteger(claims.iat) && Number.isSafeInteger(claims.exp)
      && Number(claims.iat) <= current + 60 && Number(claims.exp) > current && Number(claims.exp) > Number(claims.iat)
      && Number(claims.exp) - Number(claims.iat) <= TOKEN_LIFETIME_SECONDS
  } catch { return false }
}

export function constantTimeTokenDigest(value: string, stableSecret?: string): string {
  return createHmac('sha256', stableSecret || encoder.encode('king-fun-voter-v1')).update(value).digest('hex')
}
