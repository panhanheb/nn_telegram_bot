import { registerRepository } from '../db'

/**
 * Node/Docker-only plugin: initialises the SQLite storage repository.
 *
 * On Cloudflare Workers, D1 is detected lazily in getStorageRepository() —
 * this plugin exits immediately and does nothing.
 *
 * The dynamic import below uses string concatenation so Rollup cannot
 * statically resolve and inline sqlite-repository.ts into the Workers bundle.
 * This is the critical trick that prevents `fs.mkdirSync is not implemented`
 * (error 10021) during Cloudflare Workers script validation.
 */
export default defineNitroPlugin(async () => {
  // Exit immediately on Cloudflare Workers. D1 binding is picked up lazily
  // by getStorageRepository() on the first request.
  const preset = process.env.NITRO_PRESET || ''
  if (preset.startsWith('cloudflare') || preset === '') {
    // In the Workers build NITRO_PRESET is always set to 'cloudflare-module'.
    // We only proceed when running under a Node.js preset (node, node-server,
    // node-cluster, etc.) or in local dev (where preset is empty string but
    // import.meta.dev is true).
    if (!import.meta.dev) return
  }

  try {
    // Dynamic import with runtime-computed specifier so Rollup cannot bundle
    // sqlite-repository.ts into the Workers output (it can't follow the concat).
    const modPath = '../db/' + 'sqlite-repository'
    const { SqliteStorageRepository } = await import(/* @vite-ignore */ modPath) as typeof import('../db/sqlite-repository')
    const repo = new SqliteStorageRepository()
    await repo.initialize()
    registerRepository(repo)
    console.log('[DB] SQLite repository initialized:', process.env.SQLITE_PATH || './data/teleflow.db')
  } catch (err: any) {
    console.error('[DB] Failed to initialize SQLite repository:', err.message)
  }
})

