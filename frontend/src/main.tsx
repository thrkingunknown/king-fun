import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('KING-FUN root element is missing.')

const root = createRoot(rootElement)
root.render(
  <StrictMode>
    <div className="bootstrap-screen" role="status" aria-live="polite">
      <img className="bootstrap-logo" src="/king-fun-logo.svg" width="56" height="56" alt="" aria-hidden="true" decoding="async" />
      <span className="bootstrap-label">KING-FUN</span>
      <span className="bootstrap-subtle">Loading…</span>
    </div>
  </StrictMode>,
)

async function startApplication() {
  try {
    // Keep the document entry small. IndexedDB boot and the application shell
    // are asynchronous chunks, loaded together while the lightweight startup
    // state is visible. This preserves IndexedDB-first startup and avoids
    // shipping the entire application graph in the render-blocking entry file.
    const [storage, appTypes, appModule] = await Promise.all([
      import('./domain/storage/portal-storage.ts'),
      import('./types.ts'),
      import('./AppShell.tsx'),
    ])

    let legacyRaw: string | null = null
    try {
      legacyRaw = localStorage.getItem(storage.LEGACY_STORAGE_KEY)
    } catch {
      // IndexedDB remains the primary store; a blocked localStorage read is non-fatal.
    }

    const boot = await storage.bootstrapPortalState(appTypes.INITIAL_SAVE, legacyRaw)
    const normalizedState = appTypes.normalizeSave(boot.value)
    document.documentElement.dataset.theme = normalizedState.theme
    document.documentElement.dataset.motion = normalizedState.motionPreference ?? 'system'
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (themeColor) themeColor.content = normalizedState.theme === 'dark' ? '#090d13' : '#f3f6fa'
    let revision = boot.revision
    let persistenceAvailable = boot.persistent
    const normalizedChanged = JSON.stringify(normalizedState) !== JSON.stringify(boot.value)

    if (persistenceAvailable && normalizedChanged) {
      try {
        revision = await storage.commitPortalSnapshot(normalizedState, revision)
      } catch (error) {
        persistenceAvailable = false
        storage.publishStorageStatus({
          kind: 'warning',
          message: `The saved data was repaired in memory but could not be rewritten. Export a backup or retry local storage. ${error instanceof Error ? error.message : ''}`.trim(),
        })
      }
    }

    // Once IndexedDB is confirmed durable, it is the source of truth. Remove a
    // stale legacy key even when an earlier migration succeeded but cleanup did not.
    if (legacyRaw !== null && persistenceAvailable) {
      try {
        localStorage.removeItem(storage.LEGACY_STORAGE_KEY)
      } catch {
        // The migrated IndexedDB record is already durable; retaining the legacy
        // copy is safer than treating an unavailable localStorage API as fatal.
      }
    }

    const AppShell = appModule.default
    root.render(
      <StrictMode>
        <AppShell initialState={normalizedState} initialRevision={revision} initialPersistenceAvailable={persistenceAvailable} />
      </StrictMode>,
    )

    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
        console.warn('Offline app shell registration failed.', error)
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown startup error occurred.'
    root.render(
      <StrictMode>
        <main className="bootstrap-error" role="alert">
          <strong>KING-FUN could not start.</strong>
          <p>{message}</p>
          <button type="button" onClick={() => window.location.reload()}>Reload app</button>
        </main>
      </StrictMode>,
    )
  }
}

void startApplication()
