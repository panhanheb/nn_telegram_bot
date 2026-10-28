import type { IStorageRepository } from './interfaces'
import { D1StorageRepository } from './d1-repository'

let repositoryInstance: IStorageRepository | null = null

/**
 * Returns the active storage repository for the current runtime environment.
 * Automatically chooses Cloudflare D1 on Workers, or SQLite on Docker/Node.
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

  // Docker / Node / Local SQLite fallback — only reachable outside Workers.
  // Dynamic import avoids bundling better-sqlite3 into the Workers build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SqliteStorageRepository } = require('./sqlite-repository') as typeof import('./sqlite-repository')
  const sqliteRepo = new SqliteStorageRepository()
  sqliteRepo.initialize().catch((err: Error) => {
    console.error('[DB] Failed to initialize SQLite database:', err)
  })
  repositoryInstance = sqliteRepo
  return repositoryInstance
}

// NOTE: Do NOT add `export const repo = getStorageRepository()` here.
// Top-level execution runs during Workers script validation (before env
// bindings are injected) and will crash with error 10021.
