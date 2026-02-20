import express from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { requireAuth, requireRole } from '../middlewares/auth.js'
import { runCorrelationAnalysis, runCsvPredictionAnalysis } from '../services/analysisService.js'
import { getNewsDataRange } from '../services/dataSourceService.js'
import { getComparisonData, getStockHistory, getStockQuote } from '../services/marketDataService.js'
import { getRecentRuns, saveRun } from '../services/runStore.js'
import { addUserWatchlistSymbol, getUserWatchlist, removeUserWatchlistSymbol } from '../services/watchlistStore.js'

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

  router.get('/watchlist', requireAuth, requireRole(['admin', 'user']), async (req, res, next) => {
    try {
      const symbols = await getUserWatchlist({
        useMongo,
        username: req.auth.username,
      })
      res.json({ symbols })
    } catch (error) {
      next(error)
    }
  })

  router.post('/watchlist', requireAuth, requireRole(['admin', 'user']), async (req, res, next) => {
    try {
      const symbols = await addUserWatchlistSymbol({
        useMongo,
        username: req.auth.username,
        symbol: req.body?.symbol,
      })
      res.status(201).json({ symbols })
    } catch (error) {
      if (error?.message?.includes('symbol')) {
        return res.status(400).json({ error: error.message })
      }
      next(error)
    }
  })

  router.delete('/watchlist/:symbol', requireAuth, requireRole(['admin', 'user']), async (req, res, next) => {
    try {
      const symbols = await removeUserWatchlistSymbol({
        useMongo,
        username: req.auth.username,
        symbol: req.params.symbol,
      })
      res.json({ symbols })
    } catch (error) {
      if (error?.message?.includes('symbol')) {
        return res.status(400).json({ error: error.message })
      }
      next(error)
    }
  })

  router.get('/market/quote/:symbol', requireAuth, requireRole(['admin', 'user']), async (req, res, next) => {
    try {
      const quote = await getStockQuote(req.params.symbol)
      res.json({ quote })
    } catch (error) {
      if (error?.message?.toLowerCase().includes('market data') || error?.message?.includes('Symbol')) {
        return res.status(400).json({ error: error.message })
      }
      next(error)
    }
  })

  router.get('/market/history/:symbol', requireAuth, requireRole(['admin', 'user']), async (req, res, next) => {
    try {
      const history = await getStockHistory(req.params.symbol, req.query.range)
      res.json(history)
    } catch (error) {
      if (error?.message?.toLowerCase().includes('market data') || error?.message?.includes('Symbol')) {
        return res.status(400).json({ error: error.message })
      }
      next(error)
    }
  })

  router.get('/market/compare', requireAuth, requireRole(['admin', 'user']), async (req, res, next) => {
    try {
      const symbols = String(req.query.symbols || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
      const payload = await getComparisonData(symbols, req.query.range)
      res.json(payload)
    } catch (error) {
      if (error?.message?.toLowerCase().includes('select at least') || error?.message?.toLowerCase().includes('market data')) {
        return res.status(400).json({ error: error.message })
      }
      next(error)
    }
  })

  return router
}
