import { access, copyFile, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

async function requireFile(path, description) {
  try {
    await access(path)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`Missing ${description}: ${path}`)
    }

    throw error
  }
}

// Add the two files required by Sites after Vite has produced the static app.
export function sites() {
  let root = process.cwd()

  return {
    name: 'sites',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      root = config.root
    },
    async buildStart() {
      // Sites serves static files from dist/client. Clear the complete deploy
      // output so assets from an older layout cannot leak into the archive.
      await rm(resolve(root, 'dist'), { recursive: true, force: true })
    },
    async closeBundle() {
      const outputRoot = resolve(root, 'dist')
      const clientOutput = resolve(outputRoot, 'client')
      const hostingSource = resolve(root, '.openai', 'hosting.json')
      const workerSource = resolve(root, 'worker', 'index.js')
      const metadataOutput = resolve(outputRoot, '.openai')
      const serverOutput = resolve(outputRoot, 'server')

      await Promise.all([
        requireFile(resolve(clientOutput, 'index.html'), 'Sites client entry point'),
        requireFile(hostingSource, 'Sites hosting metadata'),
        requireFile(workerSource, 'Sites worker entry point'),
      ])

      await rm(metadataOutput, { recursive: true, force: true })
      await Promise.all([
        mkdir(metadataOutput, { recursive: true }),
        mkdir(serverOutput, { recursive: true }),
      ])
      await Promise.all([
        copyFile(hostingSource, resolve(metadataOutput, 'hosting.json')),
        copyFile(workerSource, resolve(serverOutput, 'index.js')),
      ])
    },
  }
}
