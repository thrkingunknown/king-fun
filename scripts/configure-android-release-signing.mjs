import { spawnSync } from 'node:child_process'
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const androidRoot = join(root, 'src-tauri', 'gen', 'android')
const appGradlePath = join(androidRoot, 'app', 'build.gradle.kts')
const propertiesPath = join(androidRoot, 'keystore.properties')
const requiredSecrets = [
  'ANDROID_KEYSTORE_BASE64',
  'ANDROID_KEYSTORE_PASSWORD',
  'ANDROID_KEY_ALIAS',
  'ANDROID_KEY_PASSWORD',
]

function fail(message) {
  console.error(`Android release signing configuration failed: ${message}`)
  process.exit(1)
}

function escapeJavaProperty(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\f/g, '\\f')
    .replace(/([ :=#!])/g, '\\$1')
}

async function validateKeystore(keystorePath, alias, runnerTemp) {
  const listResult = spawnSync('keytool', [
    '-list',
    '-keystore', keystorePath,
    '-storepass:env', 'ANDROID_KEYSTORE_PASSWORD',
    '-alias', alias,
  ], { encoding: 'utf8', stdio: 'ignore' })

  if (listResult.error || listResult.status !== 0) {
    fail('the keystore could not be opened with the supplied store password and alias; check ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, and ANDROID_KEY_ALIAS')
  }

  // `keytool -list` does not unlock the private key. Generate a temporary CSR
  // so the configured key password is validated before Gradle starts.
  const requestPath = join(runnerTemp, 'king-fun-signing-validation.csr')
  try {
    const keyResult = spawnSync('keytool', [
      '-certreq',
      '-alias', alias,
      '-keystore', keystorePath,
      '-storepass:env', 'ANDROID_KEYSTORE_PASSWORD',
      '-keypass:env', 'ANDROID_KEY_PASSWORD',
      '-file', requestPath,
    ], { encoding: 'utf8', stdio: 'ignore' })
    if (keyResult.error || keyResult.status !== 0) {
      fail('the private key could not be unlocked; verify ANDROID_KEY_PASSWORD and ANDROID_KEY_ALIAS')
    }
  } finally {
    await rm(requestPath, { force: true })
  }
}

async function configureGradleSigning() {
  let gradle = await readFile(appGradlePath, 'utf8').catch(() => null)
  if (gradle === null) fail('generated app/build.gradle.kts was not found; initialize Android with `bun run tauri android init --ci` first')

  if (!gradle.includes('import java.util.Properties')) {
    gradle = `import java.util.Properties\n${gradle}`
  }

  const startMarker = '// KING-FUN release signing: begin'
  const endMarker = '// KING-FUN release signing: end'
  const markerStart = gradle.indexOf(startMarker)
  const markerEnd = gradle.indexOf(endMarker)
  const signingBlock = [
    `    ${startMarker}`,
    '    signingConfigs {',
    '        create("release") {',
    '            val kingFunKeystoreFile = rootProject.file("keystore.properties")',
    '            check(kingFunKeystoreFile.isFile) { "KING-FUN release keystore.properties is missing" }',
    '            val kingFunKeystore = Properties().apply {',
    '                kingFunKeystoreFile.inputStream().use { load(it) }',
    '            }',
    '            keyAlias = kingFunKeystore.getProperty("keyAlias") ?: error("KING-FUN keyAlias is missing")',
    '            keyPassword = kingFunKeystore.getProperty("keyPassword") ?: error("KING-FUN keyPassword is missing")',
    '            storeFile = file(kingFunKeystore.getProperty("storeFile") ?: error("KING-FUN storeFile is missing"))',
    '            storePassword = kingFunKeystore.getProperty("storePassword") ?: error("KING-FUN storePassword is missing")',
    '        }',
    '    }',
    `    ${endMarker}`,
  ].join('\n')

  if (markerStart >= 0 || markerEnd >= 0) {
    if (markerStart < 0 || markerEnd < markerStart) fail('existing KING-FUN signing block has mismatched markers')
    gradle = `${gradle.slice(0, markerStart)}${signingBlock}${gradle.slice(markerEnd + endMarker.length)}`
  } else {
    const androidStart = gradle.indexOf('android {')
    if (androidStart < 0) fail('could not locate the Android block in app/build.gradle.kts')
    const androidBodyStart = androidStart + 'android {'.length
    const buildTypesMatch = /^([ \t]*)buildTypes\s*\{/m.exec(gradle.slice(androidBodyStart))
    if (!buildTypesMatch) fail('could not locate the Android buildTypes block in app/build.gradle.kts')
    const insertionPoint = androidBodyStart + buildTypesMatch.index
    gradle = `${gradle.slice(0, insertionPoint)}${signingBlock}\n${gradle.slice(insertionPoint)}`
  }

  const releaseBuildType = /getByName\(["']release["']\)\s*\{/g.exec(gradle)
  if (!releaseBuildType) fail('could not locate the release build type in app/build.gradle.kts')
  const releaseBodyStart = releaseBuildType.index + releaseBuildType[0].length
  const releaseHead = gradle.slice(releaseBodyStart, releaseBodyStart + 500)
  if (!releaseHead.includes('signingConfig = signingConfigs.getByName("release")')) {
    const lineEnding = gradle.includes('\r\n') ? '\r\n' : '\n'
    gradle = `${gradle.slice(0, releaseBodyStart)}${lineEnding}            signingConfig = signingConfigs.getByName("release")${gradle.slice(releaseBodyStart)}`
  }

  await writeFile(appGradlePath, gradle, 'utf8')
}

async function main() {
  for (const name of requiredSecrets) {
    if (!process.env[name]?.trim()) fail(`required GitHub Actions secret ${name} is empty or unavailable`)
  }

  const encoded = process.env.ANDROID_KEYSTORE_BASE64.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    fail('ANDROID_KEYSTORE_BASE64 is not valid base64')
  }
  const keystoreBytes = Buffer.from(encoded, 'base64')
  if (keystoreBytes.length < 512) fail('decoded keystore is unexpectedly small; verify the base64 secret contains the complete keystore file')

  const runnerTemp = process.env.RUNNER_TEMP || tmpdir()
  await mkdir(runnerTemp, { recursive: true })
  const keystorePath = join(runnerTemp, 'king-fun-upload-keystore.jks')
  await writeFile(keystorePath, keystoreBytes, { mode: 0o600 })
  await chmod(keystorePath, 0o600)
  await validateKeystore(keystorePath, process.env.ANDROID_KEY_ALIAS, runnerTemp)

  await mkdir(androidRoot, { recursive: true })
  const properties = [
    `storeFile=${escapeJavaProperty(keystorePath)}`,
    `storePassword=${escapeJavaProperty(process.env.ANDROID_KEYSTORE_PASSWORD)}`,
    `keyAlias=${escapeJavaProperty(process.env.ANDROID_KEY_ALIAS)}`,
    `keyPassword=${escapeJavaProperty(process.env.ANDROID_KEY_PASSWORD)}`,
    '',
  ].join('\n')
  await writeFile(propertiesPath, properties, { mode: 0o600 })
  await chmod(propertiesPath, 0o600)
  await configureGradleSigning()

  console.info('Android release signing is configured: keystore validated, Gradle release signing enabled, debug signing left unchanged.')
}

await main()
