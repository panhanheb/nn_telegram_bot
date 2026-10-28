import { registerRepository } from '../db'

/**
 * Node/Docker-only plugin: initialises the SQLite storage repository.
 *
 * On Cloudflare Workers the Rollup plugin in nuxt.config.ts replaces
 * sqlite-repository with a no-op stub, so this plugin's dynamic import
 * never reaches the real better-sqlite3 code. The runtime guard below
 * also ensures the plugin exits immediately on Workers.
 *
 * On Node/Docker (NITRO_PRESET=node or node-server) this plugin runs
 * normally and registers the real SqliteStorageRepository.
 */
export default defineNitroPlugin(async () => {
  const preset = process.env.NITRO_PRESET || ''

  // On Workers the preset is 'cloudflare-module'. Exit immediately —
  // D1 is detected lazily by getStorageRepository() on the first request.
  if (preset.startsWith('cloudflare')) return

  // In Cloudflare Pages build the preset env var may not be set at runtime;
  // check the env binding instead. If __env__.DB exists we are on Workers.
  if ((globalThis as any).__env__?.DB) return

  try {
    // Dynamic import so Rollup cannot statically inline sqlite-repository.
    // The Rollup stub plugin (nuxt.config.ts) replaces this with a no-op
    // during the Workers build anyway.
    const modPath = '../db/' + 'sqlite-repository'
    const { SqliteStorageRepository } = await import(/* @vite-ignore */ modPath) as typeof import('../db/sqlite-repository')
    const repo = new SqliteStorageRepository()
    await repo.initialize()
    registerRepository(repo)
    console.log('[DB] SQLite repository initialized')
  } catch (err: any) {
    console.error('[DB] Failed to initialize SQLite repository:', err.message)
  }
})
