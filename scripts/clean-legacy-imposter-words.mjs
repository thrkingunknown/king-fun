import { existsSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const legacyWordBank = join(root, 'frontend', 'src', 'content', 'imposter-additional-words.ts')

if (existsSync(legacyWordBank)) {
  unlinkSync(legacyWordBank)
  console.log('Removed obsolete bundled Imposter word bank: frontend/src/content/imposter-additional-words.ts')
} else {
  console.log('No obsolete bundled Imposter word bank found.')
}
