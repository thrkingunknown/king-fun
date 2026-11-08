import { useSyncExternalStore } from 'react'
import { getStorageStatus, subscribeStorageStatus } from './portal-storage.ts'

export function usePortalStorageStatus() {
  return useSyncExternalStore(subscribeStorageStatus, getStorageStatus, getStorageStatus)
}
