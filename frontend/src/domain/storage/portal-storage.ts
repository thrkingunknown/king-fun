import type { ContentItem, ContentPack } from '../shared/contracts.ts'
import { isJsonValue, parseContentItem, parseContentPack } from '../shared/validation.ts'

export const DATABASE_NAME = 'king-fun-local'
export const DATABASE_VERSION = 2
export const SNAPSHOT_SCHEMA_VERSION = 2
export const LEGACY_STORAGE_KEY = 'party-portal-v1'

const STORE_NAMES = ['appState', 'sessions', 'rounds', 'history', 'customPacks'] as const
type StoreName = (typeof STORE_NAMES)[number]

export interface SnapshotRecord<T> {
  readonly key: 'current'
  readonly schemaVersion: number
  readonly revision: number
  readonly updatedAt: number
  readonly value: T
}

export type StorageStatus =
  | { readonly kind: 'ready'; readonly message: string }
  | { readonly kind: 'warning'; readonly message: string }
  | { readonly kind: 'conflict'; readonly message: string; readonly remoteRevision: number }

const STATUS_READY: StorageStatus = { kind: 'ready', message: 'Saved on this device.' }
let status: StorageStatus = STATUS_READY
const statusListeners = new Set<() => void>()
let revisionSender: BroadcastChannel | null = null

export function getStorageStatus(): StorageStatus {
  return status
}

export function subscribeStorageStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

export function publishStorageStatus(next: StorageStatus): void {
  status = next
  for (const listener of statusListeners) listener()
}

export class StorageConflictError extends Error {
  readonly remoteRevision: number

  constructor(remoteRevision: number) {
    super(`A newer save exists in another tab (revision ${remoteRevision}).`)
    this.remoteRevision = remoteRevision
    this.name = 'StorageConflictError'
  }
}

export function migrateSnapshot<T>(record: SnapshotRecord<unknown>, fallback: T): SnapshotRecord<T> {
  if (!isRecord(record) || record.key !== 'current') throw new TypeError('Stored snapshot has an invalid key or shape.')
  if (!Number.isSafeInteger(record.revision) || record.revision < 0) {
    throw new TypeError('Stored snapshot has an invalid revision.')
  }
  if (!Number.isSafeInteger(record.schemaVersion) || record.schemaVersion > SNAPSHOT_SCHEMA_VERSION || record.schemaVersion < 1) {
    throw new TypeError(`Unsupported snapshot schema version: ${record.schemaVersion}`)
  }
  if (!Number.isSafeInteger(record.updatedAt) || record.updatedAt < 0) {
    throw new TypeError('Stored snapshot has an invalid update timestamp.')
  }
  if (!isRecord(record.value) || !isJsonValue(record.value)) {
    throw new TypeError('Stored snapshot is malformed or exceeds the supported data bounds.')
  }
  if (record.schemaVersion === SNAPSHOT_SCHEMA_VERSION) {
    return record as SnapshotRecord<T>
  }
  // Version 1 stored the portal state as a plain object. Version 2 keeps the
  // same state shape but records the schema explicitly and validates its root.
  return {
    key: 'current',
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    revision: record.revision,
    updatedAt: record.updatedAt,
    value: { ...fallback as object, ...record.value } as T,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

export function openPortalDatabase(factory?: IDBFactory): Promise<IDBDatabase> {
  const selectedFactory = factory ?? (typeof indexedDB !== 'undefined' ? indexedDB : undefined)
  if (!selectedFactory) return Promise.reject(new Error('IndexedDB is not available in this browser.'))
  return new Promise((resolve, reject) => {
    const request = selectedFactory.open(DATABASE_NAME, DATABASE_VERSION)
    let settled = false
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          const options: IDBObjectStoreParameters = { keyPath: name === 'appState' ? 'key' : 'id' }
          db.createObjectStore(name, options)
        }
      }
      const history = request.transaction?.objectStore('history')
      if (history && !history.indexNames.contains('at')) history.createIndex('at', 'at', { unique: false })
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      if (settled) { db.close(); return }
      settled = true
      resolve(db)
    }
    request.onerror = () => {
      if (settled) return
      settled = true
      reject(request.error ?? new Error('Unable to open local database.'))
    }
    request.onblocked = () => {
      if (settled) return
      settled = true
      reject(new Error('Database upgrade is blocked by another open tab. Close older King-Fun tabs and retry.'))
    }
  })
}

export async function readPortalSnapshot<T>(
  fallback: T,
  factory?: IDBFactory,
): Promise<{ readonly value: T | null; readonly revision: number }> {
  const db = await openPortalDatabase(factory)
  try {
    const tx = db.transaction('appState', 'readonly')
    const done = transactionDone(tx)
    const raw = await requestResult(tx.objectStore('appState').get('current')) as SnapshotRecord<unknown> | undefined
    await done
    if (!raw) return { value: null, revision: 0 }
    const migrated = migrateSnapshot(raw, fallback)
    const revision = migrated.schemaVersion !== raw.schemaVersion
      ? await commitPortalSnapshot(migrated.value, raw.revision, factory)
      : migrated.revision
    return { value: migrated.value, revision }
  } finally {
    db.close()
  }
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted.'))
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'))
  })
}

export async function commitPortalSnapshot<T>(
  value: T,
  expectedRevision: number,
  factory?: IDBFactory,
): Promise<number> {
  if (!isJsonValue(value) || !isRecord(value)) throw new TypeError('Only bounded plain JSON application state can be saved.')
  const db = await openPortalDatabase(factory)
  try {
    const tx = db.transaction([...STORE_NAMES], 'readwrite')
    const appState = tx.objectStore('appState')
    let conflict: StorageConflictError | null = null
    const currentRequest = appState.get('current')
    currentRequest.onsuccess = () => {
      const current = currentRequest.result as SnapshotRecord<unknown> | undefined
      const actualRevision = current?.revision ?? 0
      if (actualRevision !== expectedRevision) {
        conflict = new StorageConflictError(actualRevision)
        tx.abort()
        return
      }
      const revision = actualRevision + 1
      appState.put({
        key: 'current',
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        revision,
        updatedAt: Date.now(),
        value,
      } satisfies SnapshotRecord<T>)

      const snapshot = value as { active?: { game: string; phase: string; data: unknown } | null; history?: readonly { id: string; at: number }[] }
      const sessions = tx.objectStore('sessions')
      const rounds = tx.objectStore('rounds')
      if (snapshot.active) {
        sessions.put({ id: 'active', schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision, game: snapshot.active.game, phase: snapshot.active.phase })
        rounds.put({ id: 'active', schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision, value: snapshot.active })
      } else {
        sessions.delete('active')
        rounds.delete('active')
      }

      const history = tx.objectStore('history')
      history.clear()
      const historyCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      const historyNow = Date.now()
      for (const item of (snapshot.history ?? []).filter((entry) => Number.isSafeInteger(entry.at) && entry.at >= historyCutoff && entry.at <= historyNow + 5 * 60_000).slice(0, 100)) {
        history.put({ ...item, schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision })
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(conflict ?? tx.error ?? new Error('IndexedDB transaction aborted.'))
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed.'))
    })
    return expectedRevision + 1
  } finally {
    db.close()
  }
}

export async function resetPortalDatabase<T>(
  value: T,
  expectedRevision: number,
  factory?: IDBFactory,
): Promise<number> {
  if (!isJsonValue(value) || !isRecord(value)) throw new TypeError('Only bounded plain JSON application state can be saved.')
  const db = await openPortalDatabase(factory)
  try {
    const tx = db.transaction([...STORE_NAMES], 'readwrite')
    const appState = tx.objectStore('appState')
    let conflict: StorageConflictError | null = null
    const currentRequest = appState.get('current')
    currentRequest.onsuccess = () => {
      const current = currentRequest.result as SnapshotRecord<unknown> | undefined
      const actualRevision = current?.revision ?? 0
      if (actualRevision !== expectedRevision) {
        conflict = new StorageConflictError(actualRevision)
        tx.abort()
        return
      }
      const revision = actualRevision + 1
      appState.put({
        key: 'current',
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        revision,
        updatedAt: Date.now(),
        value,
      } satisfies SnapshotRecord<T>)
      tx.objectStore('sessions').clear()
      tx.objectStore('rounds').clear()
      tx.objectStore('history').clear()
      tx.objectStore('customPacks').clear()
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(conflict ?? tx.error ?? new Error('IndexedDB reset transaction aborted.'))
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB reset transaction failed.'))
    })
    return expectedRevision + 1
  } finally {
    db.close()
  }
}

/** Force-reset all King-Fun stores after explicit user confirmation. This is
 * reserved for recovery from an unreadable/corrupt snapshot or memory-only mode;
 * normal erasure must use resetPortalDatabase's revision compare-and-swap. */
export async function forceResetPortalDatabase<T>(
  value: T,
  factory?: IDBFactory,
): Promise<number> {
  if (!isJsonValue(value) || !isRecord(value)) throw new TypeError('Only bounded plain JSON application state can be saved.')
  const db = await openPortalDatabase(factory)
  try {
    const tx = db.transaction([...STORE_NAMES], 'readwrite')
    const appState = tx.objectStore('appState')
    const currentRequest = appState.get('current')
    let revision = 1
    currentRequest.onsuccess = () => {
      const current = currentRequest.result as Partial<SnapshotRecord<unknown>> | undefined
      if (current && Number.isSafeInteger(current.revision) && Number(current.revision) >= 0) {
        revision = Number(current.revision) + 1
      }
      for (const name of STORE_NAMES) tx.objectStore(name).clear()
      appState.put({ key: 'current', schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision, updatedAt: Date.now(), value } satisfies SnapshotRecord<T>)
    }
    await transactionDone(tx)
    return revision
  } finally {
    db.close()
  }
}

export function pruneSnapshotHistory<T>(value: T, now = Date.now()): T {
  if (!isRecord(value) || !Array.isArray(value.history)) return value
  const cutoff = now - 30 * 24 * 60 * 60 * 1000
  const history = value.history
    .filter((entry) => isRecord(entry) && typeof entry.at === 'number' && Number.isSafeInteger(entry.at) && entry.at >= cutoff && entry.at <= now + 5 * 60_000)
    .slice(0, 100)
  return { ...value, history } as T
}

export async function bootstrapPortalState<T>(
  fallback: T,
  legacyRaw: string | null,
  factory?: IDBFactory,
): Promise<{ readonly value: T; readonly revision: number; readonly migratedLegacy: boolean; readonly persistent: boolean }> {
  try {
    const existing = await readPortalSnapshot<T>(fallback, factory)
    if (existing.value !== null) {
      const value = pruneSnapshotHistory(existing.value)
      publishStorageStatus(STATUS_READY)
      return { value, revision: existing.revision, migratedLegacy: false, persistent: true }
    }
    let value = fallback
    let migratedLegacy = false
    if (legacyRaw) {
      const parsed: unknown = JSON.parse(legacyRaw)
      if (!isRecord(parsed)) throw new TypeError('Legacy local save is not a valid object.')
      value = pruneSnapshotHistory({ ...fallback as object, ...parsed } as T)
      migratedLegacy = true
    }
    const revision = await commitPortalSnapshot(value, 0, factory)
    publishStorageStatus(STATUS_READY)
    return { value, revision, migratedLegacy, persistent: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Local storage is unavailable.'
    publishStorageStatus({ kind: 'warning', message: `Local database unavailable: ${message} Your current play may not survive a reload.` })
    let value = fallback
    if (legacyRaw) {
      try {
        const parsed: unknown = JSON.parse(legacyRaw)
        if (isRecord(parsed)) value = pruneSnapshotHistory({ ...fallback as object, ...parsed } as T)
      } catch {
        // Keep the original legacy value untouched for manual recovery.
      }
    }
    return { value, revision: 0, migratedLegacy: false, persistent: false }
  }
}

export async function saveCustomPack(
  packInput: unknown,
  itemInputs: readonly unknown[],
  factory?: IDBFactory,
): Promise<void> {
  const pack = parseContentPack(packInput)
  const items = itemInputs.map((item) => parseContentItem(item))
  const ids = new Set(items.map((item) => item.id))
  const packIds = new Set(pack.contentIds)
  if (ids.size !== items.length || pack.contentIds.length !== items.length ||
      pack.contentIds.some((id) => !ids.has(id)) ||
      items.some((item) => item.gameId !== pack.gameId || item.suitability !== pack.suitability || !packIds.has(item.id))) {
    throw new TypeError('Custom pack items must be unique and match the pack game and content IDs exactly.')
  }
  const db = await openPortalDatabase(factory)
  try {
    const tx = db.transaction('customPacks', 'readwrite')
    const store = tx.objectStore('customPacks')
    const existingRequest = store.get(pack.id)
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as { revision?: number } | undefined
      store.put({
        id: pack.id,
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        revision: (existing?.revision ?? 0) + 1,
        pack: pack satisfies ContentPack,
        items: items satisfies ContentItem[],
        updatedAt: Date.now(),
      })
    }
    await transactionDone(tx)
  } finally {
    db.close()
  }
}

export interface StoredCustomPackRecord {
  readonly id: string
  readonly schemaVersion: number
  readonly revision: number
  readonly pack: ContentPack
  readonly items: readonly ContentItem[]
  readonly updatedAt: number
}

export function validateStoredCustomPackRecord(input: unknown): StoredCustomPackRecord {
  if (!isRecord(input)) throw new TypeError('Custom pack record must be an object.')
  if (typeof input.id !== 'string' || input.id.length < 2 || input.id.length > 120) throw new TypeError('Custom pack record has an invalid ID.')
  if (input.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) throw new TypeError('Custom pack record has an unsupported schema version.')
  if (!Number.isSafeInteger(input.revision) || Number(input.revision) < 1) throw new TypeError('Custom pack record has an invalid revision.')
  if (!Number.isSafeInteger(input.updatedAt) || Number(input.updatedAt) < 0) throw new TypeError('Custom pack record has an invalid update timestamp.')
  const pack = parseContentPack(input.pack)
  if (pack.id !== input.id || !Array.isArray(input.items) || input.items.length !== pack.contentIds.length) {
    throw new TypeError('Custom pack record metadata does not match its contents.')
  }
  const items = input.items.map(item => parseContentItem(item))
  const itemIds = items.map(item => item.id)
  if (new Set(itemIds).size !== itemIds.length || itemIds.length !== pack.contentIds.length
    || pack.contentIds.some((id, index) => id !== itemIds[index])
    || items.some(item => item.gameId !== pack.gameId || item.packId !== pack.id || item.suitability !== pack.suitability)) {
    throw new TypeError('Custom pack record contains mismatched or duplicate content.')
  }
  return {
    id: input.id,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    revision: Number(input.revision),
    pack,
    items,
    updatedAt: Number(input.updatedAt),
  }
}

export async function listCustomPacks(factory?: IDBFactory): Promise<readonly StoredCustomPackRecord[]> {
  const db = await openPortalDatabase(factory)
  try {
    const tx = db.transaction('customPacks', 'readonly')
    const done = transactionDone(tx)
    const values = await requestResult(tx.objectStore('customPacks').getAll())
    await done
    const valid: StoredCustomPackRecord[] = []
    let rejected = 0
    for (const value of values) {
      try { valid.push(validateStoredCustomPackRecord(value)) } catch { rejected += 1 }
    }
    if (rejected > 0) {
      publishStorageStatus({ kind: 'warning', message: `${rejected} damaged custom pack record(s) were ignored. Other local content remains available; export a backup and recreate those packs.` })
    }
    return valid
  } finally {
    db.close()
  }
}

export async function clearCustomPacks(factory?: IDBFactory): Promise<void> {
  await clearStore('customPacks', factory)
}

/** Atomically reconciles the persisted custom-pack store with the current
 * in-memory pack collection after a memory-only session is recovered. */
export function validateCustomPackCollection(records: readonly unknown[]): StoredCustomPackRecord[] {
  if (records.length > 200) throw new TypeError('A maximum of 200 custom packs can be stored.')
  const validated = records.map(validateStoredCustomPackRecord)
  const itemCount = validated.reduce((total, record) => total + record.items.length, 0)
  const packIds = validated.map(record => record.id)
  const itemIds = validated.flatMap(record => record.items.map(item => item.id))
  if (itemCount > 5_000 || new Set(packIds).size !== packIds.length || new Set(itemIds).size !== itemIds.length) {
    throw new TypeError('Custom pack collection exceeds supported limits or contains duplicate identifiers.')
  }
  return validated
}

export async function replaceCustomPacks(
  records: readonly StoredCustomPackRecord[],
  factory?: IDBFactory,
): Promise<void> {
  const validated = validateCustomPackCollection(records)
  const db = await openPortalDatabase(factory)
  try {
    const tx = db.transaction('customPacks', 'readwrite')
    const store = tx.objectStore('customPacks')
    store.clear()
    for (const record of validated) store.put(record)
    await transactionDone(tx)
  } finally {
    db.close()
  }
}

export async function clearHistory(factory?: IDBFactory): Promise<void> {
  await clearStore('history', factory)
}

async function clearStore(store: StoreName, factory?: IDBFactory): Promise<void> {
  const db = await openPortalDatabase(factory)
  try {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).clear()
    await transactionDone(tx)
  } finally {
    db.close()
  }
}

export interface PortalBackup<T = unknown> {
  readonly format: 'king-fun-backup'
  readonly schemaVersion: number
  readonly exportedAt: number
  readonly snapshot: SnapshotRecord<T>
  readonly customPacks: readonly StoredCustomPackRecord[]
}

export async function exportPortalBackup<T>(
  fallbackState?: T,
  fallbackRevision = 0,
  fallbackCustomPacks: readonly StoredCustomPackRecord[] = [],
  factory?: IDBFactory,
  preferFallback = false,
): Promise<PortalBackup<T>> {
  if (preferFallback) {
    if (fallbackState === undefined) throw new TypeError('A memory snapshot is required when exporting without IndexedDB.');
    return {
      format: 'king-fun-backup',
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      exportedAt: Date.now(),
      snapshot: createSnapshotRecord(fallbackState, fallbackRevision),
      customPacks: fallbackCustomPacks.map(validateStoredCustomPackRecord),
    };
  }
  try {
    const db = await openPortalDatabase(factory)
    try {
      const tx = db.transaction(['appState', 'customPacks'], 'readonly')
      const done = transactionDone(tx)
      const [rawSnapshot, rawCustomPacks] = await Promise.all([
        requestResult(tx.objectStore('appState').get('current')) as Promise<SnapshotRecord<unknown> | undefined>,
        requestResult(tx.objectStore('customPacks').getAll()),
      ])
      await done
      const snapshot = rawSnapshot
        ? migrateSnapshot<T>(rawSnapshot, (fallbackState ?? {}) as T)
        : createSnapshotRecord((fallbackState ?? {}) as T, fallbackRevision)
      const customPacks = rawCustomPacks.map(validateStoredCustomPackRecord)
      return { format: 'king-fun-backup', schemaVersion: SNAPSHOT_SCHEMA_VERSION, exportedAt: Date.now(), snapshot, customPacks }
    } finally {
      db.close()
    }
  } catch (error) {
    if (fallbackState === undefined) throw error
    publishStorageStatus({ kind: 'warning', message: `IndexedDB could not be read for export; the current in-memory snapshot was exported instead. ${error instanceof Error ? error.message : 'Storage unavailable.'}` })
    return {
      format: 'king-fun-backup',
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      exportedAt: Date.now(),
      snapshot: createSnapshotRecord(fallbackState, fallbackRevision),
      customPacks: fallbackCustomPacks.map(validateStoredCustomPackRecord),
    }
  }
}

function createSnapshotRecord<T>(value: T, revision: number): SnapshotRecord<T> {
  if (!isJsonValue(value) || !isRecord(value)) throw new TypeError('Backup state must be bounded plain JSON.')
  if (!Number.isSafeInteger(revision) || revision < 0) throw new TypeError('Backup revision is invalid.')
  return { key: 'current', schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision, updatedAt: Date.now(), value }
}

export function parsePortalBackup<T>(
  input: unknown,
  fallback: T,
  normalizeState: (value: unknown) => T,
): { readonly value: T; readonly customPacks: readonly StoredCustomPackRecord[] } {
  if (!isRecord(input)) throw new TypeError('Backup file must contain a JSON object.')
  if (input.format !== 'king-fun-backup') throw new TypeError('This is not a King-Fun backup file.')
  const now = Date.now()
  if (!Number.isSafeInteger(input.exportedAt) || Number(input.exportedAt) < 0 || Number(input.exportedAt) > now + 5 * 60_000) {
    throw new TypeError('Backup export timestamp is invalid.')
  }
  if (!Number.isSafeInteger(input.schemaVersion) || Number(input.schemaVersion) < 1 || Number(input.schemaVersion) > SNAPSHOT_SCHEMA_VERSION) {
    throw new TypeError('Backup schema version is not supported by this King-Fun build.')
  }
  const snapshot = migrateSnapshot<T>(input.snapshot as SnapshotRecord<unknown>, fallback)
  const value = normalizeState(snapshot.value)
  if (!Array.isArray(input.customPacks) || input.customPacks.length > 200) {
    throw new TypeError('Backup custom-pack list is missing or exceeds the supported limit.')
  }
  const customPacks = input.customPacks.map(validateStoredCustomPackRecord)
  const totalContentItems = customPacks.reduce((total, pack) => total + pack.items.length, 0)
  if (totalContentItems > 5_000) throw new TypeError('Backup contains more than 5,000 custom content items.')
  const packIds = customPacks.map(item => item.id)
  const itemIds = customPacks.flatMap(item => item.items.map(content => content.id))
  if (new Set(packIds).size !== packIds.length || new Set(itemIds).size !== itemIds.length) {
    throw new TypeError('Backup contains duplicate custom pack or content IDs.')
  }
  return { value, customPacks }
}

export async function restorePortalBackup<T>(
  input: unknown,
  expectedRevision: number,
  fallback: T,
  normalizeState: (value: unknown) => T,
  factory?: IDBFactory,
): Promise<{ readonly value: T; readonly revision: number; readonly customPacks: readonly StoredCustomPackRecord[] }> {
  const backup = parsePortalBackup(input, fallback, normalizeState)
  const db = await openPortalDatabase(factory)
  try {
    const tx = db.transaction([...STORE_NAMES], 'readwrite')
    const appState = tx.objectStore('appState')
    let conflict: StorageConflictError | null = null
    const currentRequest = appState.get('current')
    currentRequest.onsuccess = () => {
      const current = currentRequest.result as SnapshotRecord<unknown> | undefined
      const actualRevision = current?.revision ?? 0
      if (actualRevision !== expectedRevision) {
        conflict = new StorageConflictError(actualRevision)
        tx.abort()
        return
      }
      const revision = actualRevision + 1
      const value = backup.value
      appState.put({ key: 'current', schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision, updatedAt: Date.now(), value } satisfies SnapshotRecord<T>)
      const snapshot = value as { active?: { game: string; phase: string; data: unknown } | null; history?: readonly { id: string; at: number }[] }
      if (snapshot.active) {
        tx.objectStore('sessions').put({ id: 'active', schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision, game: snapshot.active.game, phase: snapshot.active.phase })
        tx.objectStore('rounds').put({ id: 'active', schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision, value: snapshot.active })
      } else {
        tx.objectStore('sessions').delete('active')
        tx.objectStore('rounds').delete('active')
      }
      const history = tx.objectStore('history')
      history.clear()
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
      for (const item of (snapshot.history ?? []).filter(entry => Number.isSafeInteger(entry.at) && entry.at >= cutoff).slice(0, 100)) {
        history.put({ ...item, schemaVersion: SNAPSHOT_SCHEMA_VERSION, revision })
      }
      const customPacks = tx.objectStore('customPacks')
      customPacks.clear()
      for (const pack of backup.customPacks) customPacks.put(pack)
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(conflict ?? tx.error ?? new Error('Backup restore transaction aborted.'))
      tx.onerror = () => reject(tx.error ?? new Error('Backup restore transaction failed.'))
    })
    return { value: backup.value, revision: expectedRevision + 1, customPacks: backup.customPacks }
  } finally {
    db.close()
  }
}

export async function getPersistentStorageState(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return null
  try { return await navigator.storage.persisted() } catch { return false }
}

export async function requestPersistentStorage(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return 'unsupported'
  try { return await navigator.storage.persist() ? 'granted' : 'denied' } catch { return 'denied' }
}

export function listenForRemoteRevision(
  onRemoteRevision: (revision: number) => void,
): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => undefined
  const channel = new BroadcastChannel(`${DATABASE_NAME}:revision`)
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data as { revision?: unknown } | null
    if (data && Number.isSafeInteger(data.revision) && typeof data.revision === 'number') {
      onRemoteRevision(data.revision)
    }
  }
  return () => channel.close()
}

export function announceRevision(revision: number): void {
  if (typeof BroadcastChannel === 'undefined') return
  revisionSender ??= new BroadcastChannel(`${DATABASE_NAME}:revision`)
  revisionSender.postMessage({ revision })
}

/** Delete one locally stored custom pack without touching other game data. */
export async function deleteCustomPack(packId: string, factory?: IDBFactory): Promise<void> {
  if (typeof packId !== 'string' || packId.trim().length < 2) {
    throw new TypeError('A valid custom pack ID is required.')
  }
  const db = await openPortalDatabase(factory)
  try {
    const tx = db.transaction('customPacks', 'readwrite')
    tx.objectStore('customPacks').delete(packId)
    await transactionDone(tx)
  } finally {
    db.close()
  }
}
