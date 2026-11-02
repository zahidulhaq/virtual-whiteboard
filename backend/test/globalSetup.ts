import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import type { TestProject } from 'vitest/node'

/**
 * Uses TEST_DATABASE_URL when provided (CI runs against a real Postgres
 * service with migrations applied). Otherwise boots an in-memory PGlite
 * server and applies the Prisma migrations to it.
 */
export default async function setup(_project: TestProject) {
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    return
  }

  const db = await PGlite.create()
  const migrationsDir = join(import.meta.dirname, '../prisma/migrations')
  const migrations = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  for (const name of migrations) {
    await db.exec(await readFile(join(migrationsDir, name, 'migration.sql'), 'utf8'))
  }

  const port = 15_000 + Math.floor(Math.random() * 10_000)
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`
  process.env.DATABASE_POOL_SIZE = '1'

  return async () => {
    await server.stop()
    await db.close()
  }
}
