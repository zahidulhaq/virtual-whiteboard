import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { prisma } from './lib/prisma.js'
import { createSocketServer } from './realtime/socket.js'

const app = createApp()
const server = createServer(app)
const io = createSocketServer(server)

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server listening')
})

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down')
  void io.close()
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
