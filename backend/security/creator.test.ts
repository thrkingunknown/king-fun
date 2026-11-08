import { describe, expect, test } from 'bun:test'
import { isCreatorUnlockConfigured, issueCreatorToken, verifyCreatorToken } from './creator.ts'

const env = {
  KING_FUN_CREATOR_SECRET: 'a-long-random-creator-secret-for-tests-only',
  KING_FUN_CREATOR_TOKEN_SECRET: 'a-separate-token-signing-secret-that-is-long-enough',
} as NodeJS.ProcessEnv

describe('hidden creator access tokens', () => {
  test('issues a signed, expiring token only for the configured creator secret', () => {
    const now = 1_800_000_000_000
    const token = issueCreatorToken(env, env.KING_FUN_CREATOR_SECRET!, now)
    expect(token).toBeTruthy()
    expect(verifyCreatorToken(env, token!, now + 1_000)).toBe(true)
    expect(verifyCreatorToken(env, token!, now + 31 * 24 * 60 * 60 * 1000)).toBe(false)
    expect(issueCreatorToken(env, 'wrong-secret', now)).toBeNull()
  })
  test('rejects modified tokens and remains disabled without a strong configured secret', () => {
    const token = issueCreatorToken(env, env.KING_FUN_CREATOR_SECRET!)!
    expect(verifyCreatorToken(env, `${token}x`)).toBe(false)
    expect(isCreatorUnlockConfigured(env)).toBe(true)
    expect(isCreatorUnlockConfigured({ KING_FUN_CREATOR_SECRET: 'short' } as NodeJS.ProcessEnv)).toBe(false)
  })
})
