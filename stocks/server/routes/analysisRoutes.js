import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { requireAuth, requireRole } from '../middlewares/auth.js'
import { runCorrelationAnalysis, runCsvPredictionAnalysis } from '../services/analysisService.js'
import { getNewsDataRange } from '../services/dataSourceService.js'
import { getRecentRuns, saveRun } from '../services/runStore.js'

const archivePredictionsDir = path.resolve('server/data/archive_1_predictions')

async function readCsvPreview(fileName, take = 12) {
  const fullPath = path.join(archivePredictionsDir, fileName)
  const raw = await fs.readFile(fullPath, 'utf8')
  const rows = parse(raw, { columns: true, skip_empty_lines: true })
  return {
    file: fileName,
    totalRows: rows.length,
    previewRows: rows.slice(0, take),
  }
}

async function loadArchivePredictionPayload() {
  const summaryPath = path.join(archivePredictionsDir, 'prediction_summary.json')
  const summaryRaw = await fs.readFile(summaryPath, 'utf8')
  const summary = JSON.parse(summaryRaw)

  const [combined, reddit, djia] = await Promise.all([
    readCsvPreview('Combined_News_predictions.csv'),
    readCsvPreview('RedditNews_date_predictions.csv'),
    readCsvPreview('DJIA_next_close_test_predictions.csv'),
  ])

  return { summary, previews: { combined, reddit, djia } }
}

export function createAnalysisRouter({ useMongo }) {
  const router = express.Router()

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'stocksentix-api' })
  })

  router.get('/history', requireAuth, requireRole(['admin', 'user']), async (_req, res, next) => {
    try {
      const rows = await getRecentRuns({
        useMongo,
        limit: 30,
        requestedBy: _req.auth.role === 'admin' ? null : _req.auth.username,
      })
      res.json({ rows })
    } catch (error) {
      next(error)
    }
  })

  router.get('/data-range', requireAuth, requireRole(['admin', 'user']), async (_req, res, next) => {
    try {
      const range = await getNewsDataRange()
      res.json({ range })
    } catch (error) {
      next(error)
    }
  })

  router.post('/run', requireAuth, requireRole(['admin', 'user']), async (req, res, next) => {
    try {
      const { ticker, model, dateFrom, dateTo } = req.body ?? {}
      if (!ticker || !model || !dateFrom || !dateTo) {
        return res.status(400).json({
          error: 'ticker, model, dateFrom, and dateTo are required',
        })
      }

      const result =
        model === 'CSV-ML'
          ? await runCsvPredictionAnalysis({ ticker, dateFrom, dateTo })
          : await runCorrelationAnalysis({ ticker, model, dateFrom, dateTo })
      await saveRun(
        {
          date: new Date().toISOString().slice(0, 10),
          requestedBy: req.auth.username,
          requestedRole: req.auth.role,
          stock: ticker,
          correlation: result.correlation,
          model,
          dateFrom,
          dateTo,
          sampleSize: result.sampleSize,
          runType: result.resultType === 'csv_prediction' ? 'csv_prediction' : 'correlation',
          predictionLabel: result.predictionLabel ?? null,
          predictionProbability: result.predictionProbability ?? null,
        },
        { useMongo },
      )

      return res.json(result)
    } catch (error) {
      if (
        error?.message?.includes('Future dates are not allowed') ||
        error?.message?.includes('dateFrom must be earlier than dateTo') ||
        error?.message?.includes('Insufficient aligned news/price data') ||
        error?.message?.includes('CSV') ||
        error?.message?.includes('Ticker')
      ) {
        return res.status(400).json({ error: error.message })
      }
      next(error)
    }
  })

  router.get('/archive-predictions', requireAuth, requireRole(['admin', 'user']), async (_req, res, next) => {
    try {
      const payload = await loadArchivePredictionPayload()
      res.json(payload)
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return res.status(404).json({
          error: 'Archive prediction files were not found. Run prediction generation first.',
        })
      }
      next(error)
    }
  })

  return router
}
