import fs from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { loadNewsByDate, loadPricesByDate } from './dataSourceService.js'
import { computeDailySentiment } from './sentimentService.js'
import { pearsonCorrelation, rollingCorrelation } from '../utils/stats.js'
import { env } from '../config/env.js'
import { addDays, parseDateInput, toIsoDate } from '../utils/time.js'

function buildReturnsByDate(priceRows) {
  const out = new Map()
  for (let i = 0; i < priceRows.length - 1; i += 1) {
    const current = priceRows[i]
    const next = priceRows[i + 1]
    if (!current?.close || !next?.close) continue
    const nextDayReturn = (next.close - current.close) / current.close
    out.set(current.date, Number(nextDayReturn.toFixed(5)))
  }
  return out
}

function buildCloseByDate(priceRows) {
  const out = new Map()
  for (let i = 0; i < priceRows.length - 1; i += 1) {
    const current = priceRows[i]
    if (!current?.close) continue
    out.set(current.date, Number(current.close.toFixed(3)))
  }
  return out
}

function explainCorrelation(correlation) {
  const abs = Math.abs(correlation)
  if (abs < 0.2) return 'Weak relationship: sentiment alone explains little movement in next-day returns.'
  if (abs < 0.5) return 'Moderate relationship: sentiment has signal, but macro and sector effects remain important.'
  return 'Strong relationship: sentiment currently aligns meaningfully with next-day return direction.'
}

function correlationStrengthLabel(correlation) {
  const abs = Math.abs(correlation)
  if (abs < 0.2) return 'weak'
  if (abs < 0.5) return 'moderate'
  return 'strong'
}

function normalCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  let probability =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (x > 0) probability = 1 - probability
  return probability
}

function correlationStats(correlation, sampleSize) {
  if (sampleSize < 3 || Math.abs(correlation) >= 1) {
    return {
      tStatistic: 0,
      pValueApprox: 1,
      isStatisticallyMeaningful: false,
      significanceLevel: 0.05,
    }
  }

  const denominator = 1 - correlation ** 2
  const tStatistic = correlation * Math.sqrt((sampleSize - 2) / denominator)
  const pValueApprox = 2 * (1 - normalCdf(Math.abs(tStatistic)))

  return {
    tStatistic: Number(tStatistic.toFixed(4)),
    pValueApprox: Number(pValueApprox.toFixed(4)),
    isStatisticallyMeaningful: pValueApprox < 0.05,
    significanceLevel: 0.05,
  }
}

function rollingCompoundReturn(returns, window = 5) {
  const out = []
  for (let i = 0; i < returns.length; i += 1) {
    const start = Math.max(0, i - window + 1)
    const slice = returns.slice(start, i + 1)
    const compounded = slice.reduce((acc, value) => acc * (1 + value), 1) - 1
    out.push(compounded)
  }
  return out
}

const csvFeatureNames = [
  'RSIadjclose15',
  'RSIadjclose25',
  'RSIadjclose50',
  'MACDhistadjclose15',
  'MACDhistadjclose25',
  'MACDhistadjclose50',
  'diff',
  'INCREMENTO',
  'atr10',
  'stochastic-kd-10',
  'volumenrelativo',
]

const csvCache = {
  filePath: '',
  mtimeMs: 0,
  rows: [],
}

function toNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function sigmoid(z) {
  if (z > 35) return 1
  if (z < -35) return 0
  return 1 / (1 + Math.exp(-z))
}

function getMetrics(rows, probs, threshold) {
  let tp = 0
  let tn = 0
  let fp = 0
  let fn = 0

  for (let i = 0; i < rows.length; i += 1) {
    const y = rows[i].y
    const pred = probs[i] >= threshold ? 1 : 0
    if (pred === 1 && y === 1) tp += 1
    else if (pred === 0 && y === 0) tn += 1
    else if (pred === 1 && y === 0) fp += 1
    else fn += 1
  }

  const n = rows.length || 1
  const accuracy = (tp + tn) / n
  const precision = tp / (tp + fp || 1)
  const recall = tp / (tp + fn || 1)
  const f1 = (2 * precision * recall) / (precision + recall || 1)
  return { accuracy, precision, recall, f1, tp, tn, fp, fn }
}

async function loadCsvPredictionRows() {
  const fullPath = path.resolve(env.csvPredictionDatasetPath)
  const stat = await fs.stat(fullPath)
  if (csvCache.filePath === fullPath && csvCache.mtimeMs === stat.mtimeMs && csvCache.rows.length > 0) {
    return csvCache.rows
  }

  const raw = await fs.readFile(fullPath, 'utf8')
  const records = parse(raw, { columns: true, skip_empty_lines: true })
  const rows = records
    .map((row) => ({
      date: String(row.date || '').trim(),
      ticker: String(row.ticker || '').trim().toUpperCase(),
      y: Number(row.TARGET) > 0 ? 1 : 0,
      x: csvFeatureNames.map((feature) => toNum(row[feature])),
    }))
    .filter((row) => row.date && row.ticker && Number.isFinite(row.y))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  csvCache.filePath = fullPath
  csvCache.mtimeMs = stat.mtimeMs
  csvCache.rows = rows
  return rows
}

export async function runCsvPredictionAnalysis({ ticker, dateFrom, dateTo }) {
  const normalizedTicker = String(ticker || '').trim().toUpperCase()
  if (!normalizedTicker) throw new Error('Ticker is required for CSV prediction mode.')

  const start = parseDateInput(dateFrom)
  const end = parseDateInput(dateTo)
  if (start > end) throw new Error('dateFrom must be earlier than dateTo')

  const allRows = await loadCsvPredictionRows()
  const rows = allRows.filter((row) => row.date >= dateFrom && row.date <= dateTo)
  if (rows.length < 200) {
    throw new Error('CSV range has too few rows. Expand date range for better prediction quality.')
  }

  const trainEnd = Math.floor(rows.length * 0.7)
  const valEnd = trainEnd + Math.floor(rows.length * 0.1)
  const trainRows = rows.slice(0, trainEnd)
  const valRows = rows.slice(trainEnd, valEnd)
  const testRows = rows.slice(valEnd)
  if (!trainRows.length || !valRows.length || !testRows.length) {
    throw new Error('CSV dataset split failed. Use a wider date range.')
  }

  const d = csvFeatureNames.length
  const mean = Array(d).fill(0)
  const std = Array(d).fill(0)

  for (const row of trainRows) {
    for (let j = 0; j < d; j += 1) mean[j] += row.x[j]
  }
  for (let j = 0; j < d; j += 1) mean[j] /= trainRows.length
  for (const row of trainRows) {
    for (let j = 0; j < d; j += 1) {
      const diff = row.x[j] - mean[j]
      std[j] += diff * diff
    }
  }
  for (let j = 0; j < d; j += 1) std[j] = Math.sqrt(std[j] / trainRows.length) || 1

  const normalize = (x) => x.map((v, j) => (v - mean[j]) / std[j])

  const posCount = trainRows.reduce((acc, row) => acc + row.y, 0)
  const negCount = trainRows.length - posCount
  const posWeight = negCount / (posCount || 1)

  const w = Array(d).fill(0)
  let b = 0
  let lr = 0.03
  const l2 = 0.0008

  for (let epoch = 0; epoch < 18; epoch += 1) {
    for (const row of trainRows) {
      const x = normalize(row.x)
      let z = b
      for (let j = 0; j < d; j += 1) z += w[j] * x[j]
      const p = sigmoid(z)
      const classWeight = row.y === 1 ? posWeight : 1
      const err = (p - row.y) * classWeight
      for (let j = 0; j < d; j += 1) w[j] -= lr * (err * x[j] + l2 * w[j])
      b -= lr * err
    }
    lr *= 0.93
  }

  const predictProbs = (set) =>
    set.map((row) => {
      const x = normalize(row.x)
      let z = b
      for (let j = 0; j < d; j += 1) z += w[j] * x[j]
      return sigmoid(z)
    })

  const valProbs = predictProbs(valRows)
  let bestThreshold = 0.5
  let bestMetrics = getMetrics(valRows, valProbs, bestThreshold)
  for (let threshold = 0.15; threshold <= 0.85; threshold += 0.01) {
    const metrics = getMetrics(valRows, valProbs, threshold)
    if (metrics.f1 > bestMetrics.f1) {
      bestMetrics = metrics
      bestThreshold = threshold
    }
  }

  const testProbs = predictProbs(testRows)
  const testMetrics = getMetrics(testRows, testProbs, bestThreshold)

  const tickerRows = rows.filter((row) => row.ticker === normalizedTicker)
  if (!tickerRows.length) {
    throw new Error(`Ticker ${normalizedTicker} was not found in CSV for selected date range.`)
  }
  const latestTickerRow = tickerRows[tickerRows.length - 1]
  const latestVector = normalize(latestTickerRow.x)
  let latestZ = b
  for (let j = 0; j < d; j += 1) latestZ += w[j] * latestVector[j]
  const probabilityUp = sigmoid(latestZ)
  const predictionLabel = probabilityUp >= bestThreshold ? 'UP' : 'DOWN'

  return {
    ticker: normalizedTicker,
    model: 'CSV-ML',
    dateFrom,
    dateTo,
    sampleSize: rows.length,
    correlation: Number(probabilityUp.toFixed(4)),
    predictionProbability: Number(probabilityUp.toFixed(4)),
    predictionLabel,
    threshold: Number(bestThreshold.toFixed(2)),
    resultType: 'csv_prediction',
    explanation: `Predicted ${predictionLabel} for ${normalizedTicker} on ${latestTickerRow.date}. Validation F1 ${bestMetrics.f1.toFixed(2)}, Test Accuracy ${testMetrics.accuracy.toFixed(2)}.`,
    performance: {
      validation: {
        accuracy: Number(bestMetrics.accuracy.toFixed(4)),
        precision: Number(bestMetrics.precision.toFixed(4)),
        recall: Number(bestMetrics.recall.toFixed(4)),
        f1: Number(bestMetrics.f1.toFixed(4)),
      },
      test: {
        accuracy: Number(testMetrics.accuracy.toFixed(4)),
        precision: Number(testMetrics.precision.toFixed(4)),
        recall: Number(testMetrics.recall.toFixed(4)),
        f1: Number(testMetrics.f1.toFixed(4)),
      },
      confusion: {
        tp: testMetrics.tp,
        tn: testMetrics.tn,
        fp: testMetrics.fp,
        fn: testMetrics.fn,
      },
    },
    scatterData: [],
    rollingCorrelation: [],
  }
}

export async function runCorrelationAnalysis({ ticker, model, dateFrom, dateTo }) {
  const start = parseDateInput(dateFrom)
  const end = parseDateInput(dateTo)
  const todayIso = new Date().toISOString().slice(0, 10)

  if (dateFrom > todayIso || dateTo > todayIso) {
    throw new Error(`Future dates are not allowed. Please choose a date on or before ${todayIso}.`)
  }

  if (start > end) {
    throw new Error('dateFrom must be earlier than dateTo')
  }

  const newsByDate = await loadNewsByDate({ dateFrom, dateTo })
  const prices = await loadPricesByDate({
    ticker,
    dateFrom,
    dateTo: toIsoDate(addDays(end, 1)),
  })
  const dailySentiment = computeDailySentiment(newsByDate, model)
  const returnsByDate = buildReturnsByDate(prices)
  const closeByDate = buildCloseByDate(prices)

  const aligned = dailySentiment
    .map((daily) => ({
      date: daily.date,
      sentiment: daily.sentimentMean,
      return: returnsByDate.get(daily.date),
      close: closeByDate.get(daily.date),
      variance: daily.sentimentVariance,
      headlineCount: daily.headlineCount,
      positiveHeadlineCount: daily.positiveHeadlineCount,
      negativeHeadlineCount: daily.negativeHeadlineCount,
    }))
    .filter((row) => typeof row.return === 'number' && typeof row.close === 'number')

  if (aligned.length < 3) {
    throw new Error('Insufficient aligned news/price data. Expand the date range or provide richer input data.')
  }

  const sentiments = aligned.map((p) => p.sentiment)
  const returns = aligned.map((p) => p.return)
  const correlation = Number(pearsonCorrelation(sentiments, returns).toFixed(4))
  const rollingReturns = rollingCompoundReturn(returns, 5)
  const stats = correlationStats(correlation, aligned.length)
  const strengthLabel = correlationStrengthLabel(correlation)

  return {
    ticker,
    model,
    dateFrom,
    dateTo,
    sampleSize: aligned.length,
    correlation,
    explanation: explainCorrelation(correlation),
    stats,
    educationalReport: {
      strength: strengthLabel,
      relationshipSummary: `${strengthLabel[0].toUpperCase()}${strengthLabel.slice(1)} relationship detected between sentiment and next-day returns.`,
      statisticalMeaning: stats.isStatisticallyMeaningful
        ? `Approx. p-value ${stats.pValueApprox} is below 0.05, so this relationship is statistically meaningful for the selected sample.`
        : `Approx. p-value ${stats.pValueApprox} is above 0.05, so the relationship is not statistically meaningful for the selected sample.`,
      warnings: [
        'Look-ahead bias can inflate results if same-day news timing is not controlled.',
        'Headline sentiment is noisy and can include contradictory narratives.',
        'Macro events, sector rotation, and liquidity can confound correlations.',
        'Short-horizon markets are partly random, so correlations can drift quickly.',
      ],
    },
    dailySentimentRows: aligned.map((row) => ({
      date: row.date,
      sentimentScore: Number(row.sentiment.toFixed(4)),
      averageSentiment: Number(row.sentiment.toFixed(4)),
      positiveHeadlines: row.positiveHeadlineCount,
      negativeHeadlines: row.negativeHeadlineCount,
      totalHeadlines: row.headlineCount,
      tone: row.sentiment > 0 ? 'Positive' : row.sentiment < 0 ? 'Negative' : 'Neutral',
    })),
    stockReturnRows: aligned.map((row, idx) => ({
      date: row.date,
      close: row.close,
      nextDayReturnPct: Number((row.return * 100).toFixed(3)),
      rollingReturnPct: Number((rollingReturns[idx] * 100).toFixed(3)),
    })),
    sentimentFeatures: aligned.map((row) => ({
      date: row.date,
      sentimentMean: row.sentiment,
      sentimentVariance: row.variance,
      headlineCount: row.headlineCount,
      nextDayReturn: row.return,
    })),
    scatterData: aligned.map((row) => ({
      sentiment: Number(row.sentiment.toFixed(4)),
      return: Number((row.return * 100).toFixed(3)),
      date: row.date,
    })),
    rollingCorrelation: rollingCorrelation(aligned, 30).map((r) => ({
      day: r.date,
      value: r.value,
    })),
  }
}
