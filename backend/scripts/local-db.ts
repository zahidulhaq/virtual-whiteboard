/**
 * Starts a throwaway Postgres-compatible server (PGlite over the Postgres
 * wire protocol) so the API can be run without Docker or a Neon account.
 *
 *   npm run db:local            # persists to ./.pglite
 *   npm run db:local -- --memory
 */
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

const port = Number(process.env.LOCAL_DB_PORT ?? 5433)
const inMemory = process.argv.includes('--memory')

const db = await PGlite.create(inMemory ? undefined : './.pglite')
// Extra connections let tools like Prisma Studio attach alongside the API.
// PGlite runs queries one at a time, so keep the API's pool size at 1.
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 5 })
await server.start()

console.log(`Local database ready: postgresql://postgres:postgres@127.0.0.1:${port}/postgres`)

async function stop() {
  await server.stop()
  await db.close()
  process.exit(0)
}

process.on('SIGINT', stop)
process.on('SIGTERM', stop)
