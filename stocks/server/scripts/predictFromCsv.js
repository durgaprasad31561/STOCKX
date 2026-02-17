import fs from 'node:fs'
import readline from 'node:readline'

const filePath = process.argv[2] || 'server/data/uploads/data.csv'

const featureNames = [
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

function toNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function sigmoid(z) {
  if (z > 35) return 1
  if (z < -35) return 0
  return 1 / (1 + Math.exp(-z))
}

function metricsFrom(rows, probs, threshold) {
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
  const specificity = tn / (tn + fp || 1)
  const balancedAccuracy = (recall + specificity) / 2

  return { accuracy, precision, recall, f1, specificity, balancedAccuracy, tp, tn, fp, fn }
}

async function loadRows(csvPath) {
  const rows = []
  const rl = readline.createInterface({
    input: fs.createReadStream(csvPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  let header = null
  let idx = {}

  for await (const line of rl) {
    if (!header) {
      header = line.split(',')
      idx = {
        date: header.indexOf('date'),
        ticker: header.indexOf('ticker'),
        target: header.indexOf('TARGET'),
        features: featureNames.map((name) => header.indexOf(name)),
      }
      continue
    }
    if (!line) continue

    const cols = line.split(',')
    const yRaw = Number(cols[idx.target])
    if (!Number.isFinite(yRaw)) continue

    rows.push({
      date: idx.date >= 0 ? cols[idx.date] : '',
      ticker: idx.ticker >= 0 ? cols[idx.ticker] : 'UNK',
      y: yRaw > 0 ? 1 : 0,
      x: idx.features.map((i) => (i >= 0 ? toNum(cols[i]) : 0)),
    })
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return rows
}

function trainAndPredict(rows) {
  const n = rows.length
  const trainEnd = Math.floor(n * 0.7)
  const valEnd = trainEnd + Math.floor(n * 0.1)
  const trainRows = rows.slice(0, trainEnd)
  const valRows = rows.slice(trainEnd, valEnd)
  const testRows = rows.slice(valEnd)

  const d = featureNames.length
  const mean = Array(d).fill(0)
  const std = Array(d).fill(0)

  for (const row of trainRows) {
    for (let j = 0; j < d; j += 1) mean[j] += row.x[j]
  }
  for (let j = 0; j < d; j += 1) mean[j] /= trainRows.length || 1

  for (const row of trainRows) {
    for (let j = 0; j < d; j += 1) {
      const diff = row.x[j] - mean[j]
      std[j] += diff * diff
    }
  }
  for (let j = 0; j < d; j += 1) {
    std[j] = Math.sqrt(std[j] / (trainRows.length || 1)) || 1
  }

  const normalize = (x) => x.map((v, j) => (v - mean[j]) / std[j])

  const positiveCount = trainRows.reduce((acc, row) => acc + row.y, 0)
  const negativeCount = trainRows.length - positiveCount
  const posWeight = negativeCount / (positiveCount || 1)

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
  let bestVal = metricsFrom(valRows, valProbs, bestThreshold)
  for (let t = 0.15; t <= 0.85; t += 0.01) {
    const m = metricsFrom(valRows, valProbs, t)
    if (m.f1 > bestVal.f1) {
      bestVal = m
      bestThreshold = t
    }
  }

  const testProbs = predictProbs(testRows)
  const testMetrics = metricsFrom(testRows, testProbs, bestThreshold)

  const latestByTicker = new Map()
  for (const row of rows) {
    const prev = latestByTicker.get(row.ticker)
    if (!prev || row.date > prev.date) latestByTicker.set(row.ticker, row)
  }

  const latestPredictions = [...latestByTicker.entries()]
    .map(([ticker, row]) => {
      const x = normalize(row.x)
      let z = b
      for (let j = 0; j < d; j += 1) z += w[j] * x[j]
      const p = sigmoid(z)
      return {
        ticker,
        date: row.date,
        probability_up: Number(p.toFixed(4)),
        prediction: p >= bestThreshold ? 1 : 0,
      }
    })
    .sort((a, b2) => b2.probability_up - a.probability_up)

  return {
    totalRows: rows.length,
    trainRows: trainRows.length,
    valRows: valRows.length,
    testRows: testRows.length,
    selectedFeatures: featureNames,
    threshold: Number(bestThreshold.toFixed(2)),
    validation: {
      accuracy: Number(bestVal.accuracy.toFixed(4)),
      precision: Number(bestVal.precision.toFixed(4)),
      recall: Number(bestVal.recall.toFixed(4)),
      f1: Number(bestVal.f1.toFixed(4)),
      balancedAccuracy: Number(bestVal.balancedAccuracy.toFixed(4)),
    },
    test: {
      accuracy: Number(testMetrics.accuracy.toFixed(4)),
      precision: Number(testMetrics.precision.toFixed(4)),
      recall: Number(testMetrics.recall.toFixed(4)),
      f1: Number(testMetrics.f1.toFixed(4)),
      balancedAccuracy: Number(testMetrics.balancedAccuracy.toFixed(4)),
      confusion: {
        tp: testMetrics.tp,
        tn: testMetrics.tn,
        fp: testMetrics.fp,
        fn: testMetrics.fn,
      },
    },
    topLatestPredictions: latestPredictions.slice(0, 15),
  }
}

async function main() {
  const rows = await loadRows(filePath)
  if (rows.length < 100) {
    throw new Error(`Not enough labeled rows in ${filePath}. Need at least 100.`)
  }
  const report = trainAndPredict(rows)
  console.log(JSON.stringify({ filePath, ...report }, null, 2))
}

main().catch((error) => {
  console.error(`[predictFromCsv] ${error.message}`)
  process.exit(1)
})
