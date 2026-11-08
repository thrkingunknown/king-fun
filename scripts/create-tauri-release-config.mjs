import { writeFile } from 'node:fs/promises'

const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim()
const repository = process.env.GITHUB_REPOSITORY?.trim()

if (!publicKey) throw new Error('TAURI_UPDATER_PUBLIC_KEY is required for updater artifacts.')
if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) throw new Error('GITHUB_REPOSITORY is required for updater artifacts.')

const config = {
  bundle: { createUpdaterArtifacts: true },
  plugins: {
    updater: {
      active: true,
      endpoints: [`https://github.com/${repository}/releases/latest/download/latest.json`],
      dialog: false,
      pubkey: publicKey,
    },
  },
}

await writeFile('src-tauri/tauri.release.conf.json', `${JSON.stringify(config, null, 2)}\n`, 'utf8')
