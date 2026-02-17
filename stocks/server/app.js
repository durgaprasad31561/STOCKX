import cors from 'cors'
import express from 'express'
import { connectMongo } from './config/db.js'
import { createAuthRouter } from './routes/authRoutes.js'
import { env } from './config/env.js'
import { createAnalysisRouter } from './routes/analysisRoutes.js'

async function startServer() {
  const app = express()
  const mongoConnected = await connectMongo()

  app.use(cors())
  app.use(express.json({ limit: '1mb' }))

  app.use('/api/auth', createAuthRouter({ useMongo: mongoConnected }))
  app.use('/api', createAnalysisRouter({ useMongo: mongoConnected }))

  app.use((err, _req, res, _next) => {
    const message = err?.message ?? 'Unexpected server error'
    res.status(500).json({ error: message })
  })

  app.listen(env.port, () => {
    console.log(`[server] StockSentix API running on ${env.apiBaseUrl}`)
    console.log(`[server] Mongo mode: ${mongoConnected ? 'enabled' : 'fallback file storage'}`)
  })
}

startServer()
