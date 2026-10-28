import type { IStorageRepository } from './interfaces'
import { D1StorageRepository } from './d1-repository'

let repositoryInstance: IStorageRepository | null = null

/**
 * Registers a pre-constructed repository instance.
 * Called by environment-specific Nitro plugins (e.g. the Node/Docker SQLite
 * plugin) that run after startup and before any requests are served.
 */
export function registerRepository(repo: IStorageRepository): void {
  repositoryInstance = repo
}

/**
 * Returns the active storage repository for the current runtime environment.
 * Automatically chooses Cloudflare D1 on Workers, or the pre-registered
 * instance (SQLite) on Docker/Node.
 *
 * IMPORTANT: Never call this at module-load time (top-level). Cloudflare
 * Workers validate the script before injecting env bindings; any top-level
 * code that touches the filesystem (SQLite) or reads env will crash with
 * error 10021. Always call from inside a request handler or Nitro plugin.
 */
export function getStorageRepository(d1Binding?: any): IStorageRepository {
  if (repositoryInstance) {
    return repositoryInstance
  }

  // Cloudflare Workers D1 Binding.
  // Nitro exposes the CF env object on globalThis.__env__ after the first
  // request is received. We also accept an explicit binding passed by callers
  // (e.g. from event.context.cloudflare.env.DB in API routes).
  const binding =
    d1Binding ||
    (globalThis as any).__env__?.DB ||
    (globalThis as any).DB

  if (binding && typeof binding.prepare === 'function') {
    repositoryInstance = new D1StorageRepository(binding)
    return repositoryInstance
  }

  // If no binding and no pre-registered instance, we are in an unexpected
  // state. Throw a clear error rather than silently failing.
  // In Docker/Node, the sqlite-init plugin (server/plugins/db-sqlite-init.ts)
  // should have called registerRepository() before any requests arrive.
  throw new Error(
    '[DB] No storage repository available. ' +
    'On Cloudflare Workers: ensure a D1 database binding named "DB" is configured in wrangler.toml. ' +
    'On Node/Docker: ensure NITRO_PRESET is not set to a Cloudflare preset.'
  )
}

// NOTE: Do NOT add `export const repo = getStorageRepository()` here.
// Top-level execution runs during Workers script validation (before env
// bindings are injected) and will crash with error 10021.
