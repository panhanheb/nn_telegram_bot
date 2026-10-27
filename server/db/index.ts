import type { IStorageRepository } from './interfaces'
import { SqliteStorageRepository } from './sqlite-repository'
import { D1StorageRepository } from './d1-repository'

let repositoryInstance: IStorageRepository | null = null

/**
 * Returns the active storage repository for the current runtime environment.
 * Automatically chooses Cloudflare D1 on Workers, or SQLite on Docker/Node.
 */
export function getStorageRepository(d1Binding?: any): IStorageRepository {
  if (repositoryInstance) {
    return repositoryInstance
  }

  // 1. Cloudflare Workers D1 Binding
  const binding = d1Binding ||
    (globalThis as any).__env__?.DB ||
    (globalThis as any).DB ||
    (process.env as any).DB

  if (binding && typeof binding.prepare === 'function') {
    repositoryInstance = new D1StorageRepository(binding)
    return repositoryInstance
  }

  // 2. Docker / Node / Local SQLite
  const sqliteRepo = new SqliteStorageRepository()
  sqliteRepo.initialize().catch(err => {
    console.error('[DB] Failed to initialize SQLite database:', err)
  })
  repositoryInstance = sqliteRepo
  return repositoryInstance
}

export const repo = getStorageRepository()
