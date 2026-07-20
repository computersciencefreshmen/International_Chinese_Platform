/* global process */

import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDatabase } from './db/database.js'

const config = loadConfig()
let app
let database
let shuttingDown = false

async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true

  app?.log.info({ signal }, 'Shutting down API server')

  try {
    if (app) await app.close()
  } finally {
    if (database?.open) database.close()
  }
}

try {
  database = createDatabase({
    filename: config.databasePath,
    seed: config.seedOnStart
  })
  app = await buildApp({ database, config })
  await app.listen({ host: config.host, port: config.port })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      shutdown(signal).catch((error) => {
        app.log.error({ err: error }, 'Graceful shutdown failed')
        process.exitCode = 1
      })
    })
  }
} catch (error) {
  if (app) {
    app.log.error({ err: error }, 'API server failed to start')
    await app.close().catch(() => {})
  } else {
    console.error('API server failed to start')
  }

  if (database?.open) database.close()
  process.exitCode = 1
}
