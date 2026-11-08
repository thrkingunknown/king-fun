import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const requiredPackages = [
  ['root', 'typescript'],
  ['root', 'oxlint'],
  ['frontend', 'vite'],
  ['frontend', '@vitejs/plugin-react'],
  ['frontend', '@tailwindcss/vite'],
  ['frontend', 'react'],
  ['frontend', '@types/react'],
  ['frontend', '@playwright/test'],
  ['backend', 'elysia'],
]

function packagePath(name) {
  return name.split('/')
}

function isInstalled(workspace, name) {
  const locations = workspace === 'root'
    ? [join(root, 'node_modules')]
    : [join(root, workspace, 'node_modules'), join(root, 'node_modules')]
  return locations.some(location => existsSync(join(location, ...packagePath(name))))
}

const missing = requiredPackages.filter(([workspace, name]) => !isInstalled(workspace, name))
if (missing.length) {
  console.error('Workspace dependencies are missing:')
  for (const [workspace, name] of missing) console.error(`  - ${workspace}: ${name}`)
  console.error('Run `bun install --frozen-lockfile` from the repository root, then rerun the command.')
  process.exitCode = 1
} else {
  console.log('Workspace dependencies are installed for frontend checks, backend checks and Playwright.')
}
