import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dir, '..')
const forbiddenLockfiles = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'])
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules', '.vite', 'coverage', 'target', 'gen'])
const failures: string[] = []
const bunLockPaths: string[] = []

function visit(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) visit(path)
      continue
    }
    if (forbiddenLockfiles.has(entry.name)) failures.push(`Forbidden lockfile: ${relative(repositoryRoot, path)}`)
    if (entry.name === 'bun.lock') bunLockPaths.push(path)
  }
}

visit(repositoryRoot)
const rootLock = join(repositoryRoot, 'bun.lock')
if (!existsSync(rootLock)) failures.push('Missing root bun.lock.')
if (bunLockPaths.length !== 1 || bunLockPaths[0] !== rootLock) {
  failures.push(`Expected exactly one Bun lockfile at bun.lock; found: ${bunLockPaths.map(path => relative(repositoryRoot, path)).join(', ') || 'none'}.`)
}

function readJson(path: string): Record<string, any> {
  try { return JSON.parse(readFileSync(path, 'utf8')) as Record<string, any> }
  catch { failures.push(`Could not parse ${relative(repositoryRoot, path)}.`); return {} }
}

/** Bun's text lockfile is JSON with trailing commas; JSON.parse alone rejects it. */
function readBunLock(path: string): Record<string, any> {
  try {
    const source = readFileSync(path, 'utf8')
    let normalized = ''
    let inString = false
    let escaped = false
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index]!
      if (inString) {
        normalized += character
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') inString = false
        continue
      }
      if (character === '"') { inString = true; normalized += character; continue }
      if (character === ',') {
        let lookahead = index + 1
        while (lookahead < source.length && /\s/.test(source[lookahead]!)) lookahead += 1
        if (source[lookahead] === '}' || source[lookahead] === ']') continue
      }
      normalized += character
    }
    return JSON.parse(normalized) as Record<string, any>
  } catch {
    failures.push(`Could not parse Bun lockfile ${relative(repositoryRoot, path)}.`)
    return {}
  }
}

const rootManifest = readJson(join(repositoryRoot, 'package.json'))
if (rootManifest.name !== 'king-fun') failures.push('Root package name must be king-fun.')
if (rootManifest.packageManager !== 'bun@1.4.4') failures.push('Root packageManager must pin bun@1.4.4.')
if (JSON.stringify(rootManifest.workspaces) !== JSON.stringify(['frontend', 'backend'])) failures.push('Root workspaces must be exactly frontend and backend.')
if (!rootManifest.scripts?.check) failures.push('Root package must expose the complete check script.')
if (!rootManifest.devDependencies?.oxlint || !rootManifest.devDependencies?.typescript) failures.push('Root devDependencies must own the shared Oxlint and TypeScript toolchain.')

const frontend = readJson(join(repositoryRoot, 'frontend', 'package.json'))
const backend = readJson(join(repositoryRoot, 'backend', 'package.json'))
if (frontend.name !== '@king-fun/frontend') failures.push('Frontend workspace must be named @king-fun/frontend.')
if (backend.name !== '@king-fun/backend') failures.push('Backend workspace must be named @king-fun/backend.')
if (backend.dependencies?.elysia !== '^1.4.31') failures.push('Backend Elysia must have a patched minimum of ^1.4.31 or newer.')
if (!rootManifest.scripts?.['security:audit'] || !rootManifest.scripts?.['check:release-contracts'] || !rootManifest.scripts?.['check:build-budget']) failures.push('Root workspace must expose dependency audit, release-contract, and build-budget gates.')
if (existsSync(join(repositoryRoot, 'frontend', 'server'))) failures.push('Legacy frontend/server directory must not exist; server source belongs in root backend/.')
if (existsSync(join(repositoryRoot, 'frontend', 'bun.lock'))) failures.push('Nested frontend/bun.lock is forbidden.')

const lock = readBunLock(rootLock)
const workspaces = lock.workspaces ?? {}
if (workspaces['']?.name !== 'king-fun') failures.push('bun.lock root workspace does not match package.json; correct the root workspace name to king-fun.')
if (workspaces.frontend?.name !== '@king-fun/frontend') failures.push('bun.lock is missing the current frontend workspace snapshot.')
if (workspaces.backend?.name !== '@king-fun/backend' || workspaces.backend?.dependencies?.elysia !== '^1.4.31') failures.push('bun.lock backend workspace must match the patched Elysia minimum in backend/package.json.')
if (!String(lock.packages?.elysia?.[0] ?? '').includes('elysia@1.4.31')) failures.push('bun.lock must resolve Elysia to the reviewed patched release 1.4.31 or newer.')

const prohibitedCommand = /\b(?:npm|npx|pnpm|yarn|corepack)\s+(?:install|i|run|exec|add|remove|update|dlx|publish)\b/i
for (const [path, manifest] of [['package.json', rootManifest], ['frontend/package.json', frontend], ['backend/package.json', backend]] as const) {
  for (const [name, command] of Object.entries(manifest.scripts ?? {}) as [string, string][]) {
    if (prohibitedCommand.test(command)) failures.push(`${path} script "${name}" uses a prohibited package manager.`)
  }
}

const workflowPath = join(repositoryRoot, '.github', 'workflows', 'ci.yml')
if (!existsSync(workflowPath)) failures.push('Missing .github/workflows/ci.yml.')
else {
  const workflow = readFileSync(workflowPath, 'utf8')
  for (const required of ['bun-version: 1.4.4', 'bun install --frozen-lockfile', 'bun run check']) {
    if (!workflow.includes(required)) failures.push(`CI workflow is missing required command/config: ${required}`)
  }
  if (workflow.includes('working-directory: frontend')) failures.push('CI workflow must run from the repository root workspace.')
  if (prohibitedCommand.test(workflow)) failures.push('CI workflow contains a prohibited package-manager command.')
}

if (failures.length) {
  for (const failure of failures) console.error(`Policy failure: ${failure}`)
  process.exitCode = 1
} else {
  console.info('Repository policy passed: root Bun 1.4.4 workspace, one root lockfile, root backend, and Bun-only CI.')
}
