import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'

/** Emit the service-worker precache list and a dependency graph for accurate
 * recursive gzip budgets across deferred startup and lazy game chunks. */
function precacheManifestPlugin(): Plugin {
  return {
    name: 'king-fun-precache-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assetPattern = /\.(?:js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|avif)$/i
      const paths = Object.values(bundle)
        .filter(output => output.fileName.startsWith('assets/') && assetPattern.test(output.fileName))
        .map(output => `/${output.fileName}`)
        .sort()
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify(paths),
      })
      const chunks = Object.values(bundle).filter(output => output.type === 'chunk')
      const dependencyGraph = Object.fromEntries(chunks.map(chunk => [chunk.fileName, {
        imports: chunk.imports,
        dynamicImports: chunk.dynamicImports,
      }]))
      this.emitFile({
        type: 'asset',
        fileName: 'asset-dependency-manifest.json',
        source: JSON.stringify(dependencyGraph),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  envDir: '..',
  resolve: { alias: { '@': fileURLToPath(new URL('./src/', import.meta.url)) } },
  build: { sourcemap: false },
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true, rewrite: path => path.replace(/^\/api/, '') } },
  },
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    precacheManifestPlugin(),
  ],
})
