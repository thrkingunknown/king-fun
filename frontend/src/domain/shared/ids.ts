/** Branded IDs prevent accidental cross-domain identifier mixing at compile time. */
export type OpaqueId<Kind extends string> = string & { readonly __kind: Kind }

export type SessionId = OpaqueId<'SessionId'>
export type PlayerId = OpaqueId<'PlayerId'>
export type ContentId = OpaqueId<'ContentId'>
export type PackId = OpaqueId<'PackId'>

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i

export function isStableId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

export function asSessionId(value: string): SessionId {
  assertId(value, 'session')
  return value as SessionId
}

export function asPlayerId(value: string): PlayerId {
  assertId(value, 'player')
  return value as PlayerId
}

export function asContentId(value: string): ContentId {
  assertId(value, 'content')
  return value as ContentId
}

export function asPackId(value: string): PackId {
  assertId(value, 'pack')
  return value as PackId
}

export function createOpaqueId<Kind extends string>(prefix: string): OpaqueId<Kind> {
  assertId(prefix, 'prefix')
  const secureCrypto = globalThis.crypto
  if (!secureCrypto?.randomUUID) {
    throw new Error('A cryptographically secure random UUID source is required.')
  }
  return `${prefix}:${secureCrypto.randomUUID()}` as OpaqueId<Kind>
}

function assertId(value: string, label: string): void {
  if (!isStableId(value)) {
    throw new TypeError(`Invalid ${label} ID.`)
  }
}
