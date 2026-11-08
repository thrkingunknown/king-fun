import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'frontend', 'dist')
const errors = []
const report = []
const KiB = 1024
const budgets = {
  initialJsGzip: 150 * KiB,
  initialCssGzip: 20 * KiB,
  initialTransferGzip: 170 * KiB,
  lazyGameJsGzip: 12 * KiB,
  arcadeControllerJsGzip: 35 * KiB,
  applicationShellJsGzip: 120 * KiB,
  startupDeferredJsGzip: 160 * KiB,
}

function fail(message) { errors.push(message) }
function measure(file) {
  const bytes = readFileSync(file)
  return { raw: bytes.byteLength, gzip: gzipSync(bytes).byteLength }
}
function walk(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walk(path))
    else files.push(path)
  }
  return files
}

try {
  if (!statSync(dist).isDirectory()) throw new Error('frontend/dist is not a directory')
} catch {
  console.error('Build budget check requires a completed frontend production build.')
  process.exit(1)
}

const indexPath = join(dist, 'index.html')
const indexHtml = readFileSync(indexPath, 'utf8')
const scripts = [...indexHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1])
const modulePreloads = [...indexHtml.matchAll(/<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1])
const initialScripts = [...new Set([...scripts, ...modulePreloads])]
const styles = [...indexHtml.matchAll(/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1])
if (!scripts.length) fail('No external entry JavaScript was found in dist/index.html.')
if (!styles.length) fail('No external entry stylesheet was found in dist/index.html.')
if (/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(indexHtml)) fail('Inline script element found; production CSP blocks inline JavaScript.')
if (/(?:src|href)=["']https?:\/\//i.test(indexHtml)) fail('An entry script or stylesheet uses a remote origin.')

const resolveEntry = (assetPath, kind) => {
  if (!assetPath.startsWith('/assets/')) {
    fail(`Entry ${kind} must be a Vite-hashed same-origin /assets path: ${assetPath}`)
    return null
  }
  const path = resolve(dist, `.${assetPath}`)
  if (!path.startsWith(`${dist}${process.platform === 'win32' ? '\\' : '/'}`)) {
    fail(`Entry ${kind} escaped the dist directory: ${assetPath}`)
    return null
  }
  return path
}

let initialJsGzip = 0
let initialCssGzip = 0
for (const asset of initialScripts) {
  const path = resolveEntry(asset, modulePreloads.includes(asset) ? 'modulepreload' : 'script')
  if (path) {
    const size = measure(path)
    initialJsGzip += size.gzip
    report.push(`${modulePreloads.includes(asset) ? 'modulepreload' : 'entry JS'} ${asset}: ${(size.gzip / KiB).toFixed(2)} KiB gzip (${(size.raw / KiB).toFixed(2)} KiB raw)`)
  }
}
for (const asset of styles) {
  const path = resolveEntry(asset, 'stylesheet')
  if (path) {
    const size = measure(path)
    initialCssGzip += size.gzip
    report.push(`entry CSS ${asset}: ${(size.gzip / KiB).toFixed(2)} KiB gzip (${(size.raw / KiB).toFixed(2)} KiB raw)`)
  }
}
if (initialJsGzip > budgets.initialJsGzip) fail(`Initial JS gzip (entry + modulepreloads) ${(initialJsGzip / KiB).toFixed(2)} KiB exceeds ${(budgets.initialJsGzip / KiB).toFixed(0)} KiB.`)
if (initialCssGzip > budgets.initialCssGzip) fail(`Initial CSS gzip ${(initialCssGzip / KiB).toFixed(2)} KiB exceeds ${(budgets.initialCssGzip / KiB).toFixed(0)} KiB.`)
if (initialJsGzip + initialCssGzip > budgets.initialTransferGzip) fail(`Initial JS+CSS gzip ${((initialJsGzip + initialCssGzip) / KiB).toFixed(2)} KiB exceeds ${(budgets.initialTransferGzip / KiB).toFixed(0)} KiB.`)
report.push(`initial JS+CSS: ${((initialJsGzip + initialCssGzip) / KiB).toFixed(2)} KiB gzip`)

const files = walk(dist)
const sourceMaps = files.filter((path) => path.endsWith('.map'))
if (sourceMaps.length) fail(`Production source maps were emitted: ${sourceMaps.map((path) => relative(dist, path)).join(', ')}`)
const manifestPath = join(dist, 'precache-manifest.json')
let precache = []
try {
  precache = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!Array.isArray(precache) || precache.some((value) => typeof value !== 'string' || !value.startsWith('/assets/'))) {
    fail('precache-manifest.json must contain only same-origin /assets paths.')
    precache = []
  }
} catch {
  fail('precache-manifest.json is missing or invalid.')
}

const dependencyGraphPath = join(dist, 'asset-dependency-manifest.json')
let dependencyGraph = {}
try {
  dependencyGraph = JSON.parse(readFileSync(dependencyGraphPath, 'utf8'))
  if (!dependencyGraph || typeof dependencyGraph !== 'object' || Array.isArray(dependencyGraph)) throw new Error('invalid dependency graph')
} catch {
  fail('asset-dependency-manifest.json is missing or invalid; deferred startup dependencies cannot be measured.')
}

function resolveChunkImport(fromFile, importedFile) {
  const value = String(importedFile)
  const resolved = value.startsWith('/')
    ? posix.normalize(value.slice(1))
    : value.startsWith('.')
      ? posix.normalize(posix.join(posix.dirname(fromFile), value))
      : posix.normalize(value)
  if (!resolved || resolved === '..' || resolved.startsWith('../') || resolved.includes('/../')) {
    fail(`Chunk dependency escaped the output directory: ${fromFile} -> ${value}`)
    return null
  }
  return resolved
}

function collectStaticChunkGraph(entryFile) {
  const visited = new Set()
  const pending = [entryFile]
  while (pending.length) {
    const file = pending.pop()
    if (!file || visited.has(file)) continue
    visited.add(file)
    const record = dependencyGraph[file]
    if (!record) {
      fail(`Dependency graph is missing emitted chunk metadata for ${file}.`)
      continue
    }
    for (const imported of record.imports ?? []) {
      const dependency = resolveChunkImport(file, imported)
      if (dependency && /\.js$/i.test(dependency)) pending.push(dependency)
    }
  }
  return [...visited].filter(file => /\.js$/i.test(file)).sort()
}

const applicationShellAsset = precache.find((value) => /\/assets\/AppShell-[^/]+\.js$/.test(value))
const initialAssetFiles = new Set(initialScripts.map(value => value.replace(/^\//, '')))
let shellGraphFiles = []
if (!applicationShellAsset) {
  fail('The application shell must be emitted as a deferred AppShell chunk.')
} else {
  shellGraphFiles = collectStaticChunkGraph(applicationShellAsset.replace(/^\//, ''))
  const deferredShellFiles = shellGraphFiles.filter(file => !initialAssetFiles.has(file))
  const shellSize = deferredShellFiles.reduce((total, file) => {
    const size = measure(resolve(dist, file))
    return { raw: total.raw + size.raw, gzip: total.gzip + size.gzip }
  }, { raw: 0, gzip: 0 })
  report.push(`deferred application shell graph: ${(shellSize.gzip / KiB).toFixed(2)} KiB gzip across ${deferredShellFiles.length} JS chunks (${(shellSize.raw / KiB).toFixed(2)} KiB raw)`)
  if (shellSize.gzip > budgets.applicationShellJsGzip) fail(`Application shell dependency graph ${(shellSize.gzip / KiB).toFixed(2)} KiB gzip exceeds ${(budgets.applicationShellJsGzip / KiB).toFixed(0)} KiB.`)
}

const mainEntryFile = scripts[0]?.replace(/^\//, '')
const mainChunkMetadata = mainEntryFile ? dependencyGraph[mainEntryFile] : null
if (!mainChunkMetadata) {
  fail('The main entry is missing from the emitted dependency graph; startup imports cannot be measured.')
} else {
  const startupRoots = (mainChunkMetadata.dynamicImports ?? [])
    .map(imported => resolveChunkImport(mainEntryFile, imported))
    .filter(Boolean)
  const startupFiles = new Set()
  for (const startupRoot of startupRoots) {
    for (const file of collectStaticChunkGraph(startupRoot)) startupFiles.add(file)
  }
  const deferredStartupFiles = [...startupFiles].filter(file => !initialAssetFiles.has(file)).sort()
  const startupSize = deferredStartupFiles.reduce((total, file) => {
    const size = measure(resolve(dist, file))
    return { raw: total.raw + size.raw, gzip: total.gzip + size.gzip }
  }, { raw: 0, gzip: 0 })
  report.push(`deferred startup graph: ${(startupSize.gzip / KiB).toFixed(2)} KiB gzip across ${deferredStartupFiles.length} JS chunks (${(startupSize.raw / KiB).toFixed(2)} KiB raw)`)
  if (startupSize.gzip > budgets.startupDeferredJsGzip) fail(`Deferred startup dependency graph ${(startupSize.gzip / KiB).toFixed(2)} KiB gzip exceeds ${(budgets.startupDeferredJsGzip / KiB).toFixed(0)} KiB.`)
}

const gameChunks = [
  ['Imposter', /\/assets\/ImposterGame-[^/]+\.js$/, budgets.lazyGameJsGzip],
  ['GuessUp', /\/assets\/GuessUpGame-[^/]+\.js$/, budgets.lazyGameJsGzip],
  ['Truth or Dare', /\/assets\/TruthOrDareGame-[^/]+\.js$/, budgets.lazyGameJsGzip],
  ['I Have Never', /\/assets\/NeverHaveIEverGame-[^/]+\.js$/, budgets.lazyGameJsGzip],
  ['Social deduction controller', /\/assets\/SocialDeductionGame-[^/]+\.js$/, budgets.arcadeControllerJsGzip],
  ['Prompt arcade controller', /\/assets\/PromptArcadeGame-[^/]+\.js$/, budgets.arcadeControllerJsGzip],
  ['Hot Bomb controller', /\/assets\/HotBombGame-[^/]+\.js$/, budgets.arcadeControllerJsGzip],
  ['Tilt It controller', /\/assets\/TiltItGame-[^/]+\.js$/, budgets.arcadeControllerJsGzip],
  ['$20 Challenge controller', /\/assets\/Challenge20Game-[^/]+\.js$/, budgets.arcadeControllerJsGzip],
  ['Word arcade controller', /\/assets\/WordArcadeGame-[^/]+\.js$/, budgets.arcadeControllerJsGzip],
  ['Reverse Singing controller', /\/assets\/ReverseSingingGame-[^/]+\.js$/, budgets.arcadeControllerJsGzip],
]
for (const [game, pattern, budget] of gameChunks) {
  const asset = precache.find((value) => pattern.test(value))
  if (!asset) {
    fail(`${game} does not have an independently emitted and precached lazy game chunk.`)
    continue
  }
  const path = resolve(dist, `.${asset}`)
  const size = measure(path)
  report.push(`${game} lazy chunk: ${(size.gzip / KiB).toFixed(2)} KiB gzip (${(size.raw / KiB).toFixed(2)} KiB raw; ${(budget / KiB).toFixed(0)} KiB budget)`)
  if (size.gzip > budget) fail(`${game} lazy chunk ${(size.gzip / KiB).toFixed(2)} KiB gzip exceeds ${(budget / KiB).toFixed(0)} KiB.`)
}

const secretPatterns = [
  ['Google API key', /AIza[0-9A-Za-z_-]{30,}/],
  ['Groq API key', /gsk_[A-Za-z0-9]{20,}/],
  ['OpenAI-style secret key', /sk-[A-Za-z0-9]{24,}/],
  ['Cloudflare operator token assignment', /CLOUDFLARE_API_TOKEN\s*[:=]\s*["'][^"'\s]{16,}["']/],
  ['Redis limiter token assignment', /AI_LIMITER_REST_TOKEN\s*[:=]\s*["'][^"'\s]{16,}["']/],
  ['Redis content vault token assignment', /CONTENT_VAULT_REST_TOKEN\s*[:=]\s*["'][^"'\s]{16,}["']/],
  ['Creator secret assignment', /KING_FUN_CREATOR_SECRET\s*[:=]\s*["'][^"'\s]{24,}["']/],
  ['Creator token signing secret assignment', /KING_FUN_CREATOR_TOKEN_SECRET\s*[:=]\s*["'][^"'\s]{32,}["']/],
]
for (const file of files) {
  if (!/\.(?:js|css|html|json|webmanifest|txt)$/i.test(file)) continue
  const content = readFileSync(file, 'utf8')
  if (/sourceMappingURL=/.test(content)) fail(`Source map reference found in ${relative(dist, file)}.`)
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(content)) fail(`${label} pattern detected in ${relative(dist, file)}.`)
  }
}

if (errors.length) {
  console.error(`Build release gate failed (${errors.length}):`)
  for (const error of errors) console.error(`  ✗ ${error}`)
  process.exitCode = 1
} else {
  console.info('Build release gate passed. Transfer budgets include entry scripts plus every modulepreload (150 KiB JS, 20 KiB CSS, 170 KiB combined), the deferred AppShell graph (120 KiB), total deferred startup graph (160 KiB), and each original game chunk (12 KiB) and each lazy arcade controller chunk (35 KiB), all gzip.')
}
for (const line of report) console.info(`  • ${line}`)
