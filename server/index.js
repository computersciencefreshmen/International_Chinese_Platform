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
    if (database?.open) await database.close()
  }
}

try {
  database = await createDatabase({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl,
    max: config.databasePoolMax
  })
  if (config.seedOnStart) {
    const { seedDatabase } = await import('./db/seed-data.js')
    await seedDatabase(database)
  }
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

  if (database?.open) await database.close()
  process.exitCode = 1
}
