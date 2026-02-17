import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'

const baseDir = process.argv[2] || 'server/data/archive_1_extracted_2'
const outputDir = process.argv[3] || 'server/data/archive_1_predictions'

const combinedPath = path.join(baseDir, 'Combined_News_DJIA.csv')
const redditPath = path.join(baseDir, 'RedditNews.csv')
const djiaPath = path.join(baseDir, 'upload_DJIA_table.csv')

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  })
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function csvEscape(value) {
  const s = value == null ? '' : String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replaceAll('"', '""')}"`
  }
  return s
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, '')
    return
  }
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','))
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`)
}

function cleanNewsText(text) {
  return String(text || '')
    .replace(/^b['"]/, '')
    .replace(/['"]$/, '')
    .replace(/\\'/g, "'")
    .replace(/[^a-zA-Z0-9 ]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(text) {
  return cleanNewsText(text)
    .split(' ')
    .filter((t) => t.length >= 2)
}

function collectCombinedRows(records) {
  const rows = []
  for (const row of records) {
    const label = Number(row.Label)
    if (!Number.isFinite(label)) continue
    const parts = []
    for (let i = 1; i <= 25; i += 1) {
      const value = row[`Top${i}`]
      if (value) parts.push(value)
    }
    rows.push({
      date: row.Date,
      y: label > 0 ? 1 : 0,
      text: parts.join(' '),
    })
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return rows
}

function aggregateReddit(records) {
  const byDate = new Map()
  for (const row of records) {
    const date = row.Date
    const prev = byDate.get(date) || []
    prev.push(row.News || '')
    byDate.set(date, prev)
  }
  return [...byDate.entries()]
    .map(([date, list]) => ({ date, text: list.join(' ') }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

function trainNaiveBayes(rows, vocabLimit = 6000) {
  const tokenFreq = new Map()
  for (const row of rows) {
    const words = tokenize(row.text)
    for (const w of words) tokenFreq.set(w, (tokenFreq.get(w) || 0) + 1)
  }

  const vocab = [...tokenFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, vocabLimit)
    .map(([w]) => w)

  const vocabSet = new Set(vocab)
  const counts0 = new Map()
  const counts1 = new Map()
  let total0 = 0
  let total1 = 0
  let n0 = 0
  let n1 = 0

  for (const row of rows) {
    const words = tokenize(row.text).filter((w) => vocabSet.has(w))
    if (row.y === 1) n1 += 1
    else n0 += 1

    for (const w of words) {
      if (row.y === 1) {
        counts1.set(w, (counts1.get(w) || 0) + 1)
        total1 += 1
      } else {
        counts0.set(w, (counts0.get(w) || 0) + 1)
        total0 += 1
      }
    }
  }

  const prior1 = (n1 + 1) / (n0 + n1 + 2)
  const prior0 = 1 - prior1
  const denom1 = total1 + vocab.length
  const denom0 = total0 + vocab.length

  function predict(text) {
    const words = tokenize(text).filter((w) => vocabSet.has(w))
    let s1 = Math.log(prior1)
    let s0 = Math.log(prior0)
    for (const w of words) {
      s1 += Math.log(((counts1.get(w) || 0) + 1) / denom1)
      s0 += Math.log(((counts0.get(w) || 0) + 1) / denom0)
    }
    const max = Math.max(s0, s1)
    const p1 = Math.exp(s1 - max)
    const p0 = Math.exp(s0 - max)
    const probUp = p1 / (p1 + p0 || 1)
    return { probUp, pred: probUp >= 0.5 ? 1 : 0 }
  }

  return { predict }
}

function classificationMetrics(actual, predicted) {
  let tp = 0
  let tn = 0
  let fp = 0
  let fn = 0
  for (let i = 0; i < actual.length; i += 1) {
    const a = actual[i]
    const p = predicted[i]
    if (a === 1 && p === 1) tp += 1
    else if (a === 0 && p === 0) tn += 1
    else if (a === 0 && p === 1) fp += 1
    else fn += 1
  }
  const n = actual.length || 1
  const accuracy = (tp + tn) / n
  const precision = tp / (tp + fp || 1)
  const recall = tp / (tp + fn || 1)
  const f1 = (2 * precision * recall) / (precision + recall || 1)
  return { accuracy, precision, recall, f1, tp, tn, fp, fn }
}

function buildDjiaRows(records) {
  const rows = records
    .map((r) => ({
      date: r.Date,
      open: toNum(r.Open),
      high: toNum(r.High),
      low: toNum(r.Low),
      close: toNum(r.Close),
      volume: toNum(r.Volume),
      adjClose: toNum(r['Adj Close']),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const samples = []
  for (let i = 1; i < rows.length - 1; i += 1) {
    const prev = rows[i - 1]
    const cur = rows[i]
    const next = rows[i + 1]
    const x = [
      cur.open,
      cur.high,
      cur.low,
      cur.close,
      cur.volume,
      cur.adjClose,
      cur.close - cur.open,
      (cur.high - cur.low) / (cur.close || 1),
      (cur.close - prev.close) / (prev.close || 1),
      Math.log((cur.volume + 1) / (prev.volume + 1)),
    ]
    samples.push({ date: cur.date, x, y: next.close })
  }
  return { samples, latest: rows[rows.length - 1], prev: rows[rows.length - 2] }
}

function trainLinearRegression(samples, epochs = 2500, lrStart = 0.03, l2 = 0.0005) {
  const n = samples.length
  const d = samples[0]?.x.length || 0
  const trainEnd = Math.floor(n * 0.8)
  const train = samples.slice(0, trainEnd)
  const test = samples.slice(trainEnd)

  const mean = Array(d).fill(0)
  const std = Array(d).fill(0)

  for (const row of train) {
    for (let j = 0; j < d; j += 1) mean[j] += row.x[j]
  }
  for (let j = 0; j < d; j += 1) mean[j] /= train.length || 1

  for (const row of train) {
    for (let j = 0; j < d; j += 1) {
      const diff = row.x[j] - mean[j]
      std[j] += diff * diff
    }
  }
  for (let j = 0; j < d; j += 1) std[j] = Math.sqrt(std[j] / (train.length || 1)) || 1

  const normalize = (x) => x.map((v, j) => (v - mean[j]) / std[j])

  let yMean = 0
  for (const row of train) yMean += row.y
  yMean /= train.length || 1
  let yStd = 0
  for (const row of train) {
    const diff = row.y - yMean
    yStd += diff * diff
  }
  yStd = Math.sqrt(yStd / (train.length || 1)) || 1

  const w = Array(d).fill(0)
  let b = 0
  let lr = lrStart

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradW = Array(d).fill(0)
    let gradB = 0
    for (const row of train) {
      const x = normalize(row.x)
      let pred = b
      for (let j = 0; j < d; j += 1) pred += w[j] * x[j]
      const y = (row.y - yMean) / yStd
      const err = pred - y
      for (let j = 0; j < d; j += 1) gradW[j] += err * x[j]
      gradB += err
    }
    const invN = 1 / (train.length || 1)
    for (let j = 0; j < d; j += 1) {
      w[j] -= lr * (gradW[j] * invN + l2 * w[j])
    }
    b -= lr * gradB * invN
    lr *= 0.999
  }

  const predict = (row) => {
    const x = normalize(row.x)
    let predNorm = b
    for (let j = 0; j < d; j += 1) predNorm += w[j] * x[j]
    return predNorm * yStd + yMean
  }

  const testPred = test.map((row) => ({ ...row, pred: predict(row) }))
  let absErr = 0
  let sqErr = 0
  let pctErr = 0
  for (const row of testPred) {
    const e = Math.abs(row.pred - row.y)
    absErr += e
    sqErr += e * e
    pctErr += e / (Math.abs(row.y) || 1)
  }
  const denom = testPred.length || 1
  const mae = absErr / denom
  const rmse = Math.sqrt(sqErr / denom)
  const mape = (pctErr / denom) * 100

  return { train, testPred, mae, rmse, mape, predict }
}

function run() {
  if (!fs.existsSync(combinedPath) || !fs.existsSync(redditPath) || !fs.existsSync(djiaPath)) {
    throw new Error(`Expected CSV files in ${baseDir}`)
  }
  fs.mkdirSync(outputDir, { recursive: true })

  const combinedRecords = readCsv(combinedPath)
  const redditRecords = readCsv(redditPath)
  const djiaRecords = readCsv(djiaPath)

  const combinedRows = collectCombinedRows(combinedRecords)
  const cutoff = Math.floor(combinedRows.length * 0.8)
  const combinedTrain = combinedRows.slice(0, cutoff)
  const combinedTest = combinedRows.slice(cutoff)

  const textModel = trainNaiveBayes(combinedTrain)
  const combinedPredictions = combinedRows.map((row, idx) => {
    const pred = textModel.predict(row.text)
    return {
      Date: row.date,
      ActualLabel: row.y,
      ProbabilityUp: Number(pred.probUp.toFixed(4)),
      PredictedLabel: pred.pred,
      Split: idx < cutoff ? 'train' : 'test',
    }
  })

  const actualTest = combinedTest.map((r) => r.y)
  const predTest = combinedTest.map((r) => textModel.predict(r.text).pred)
  const combinedMetrics = classificationMetrics(actualTest, predTest)
  writeCsv(path.join(outputDir, 'Combined_News_predictions.csv'), combinedPredictions)

  const redditByDate = aggregateReddit(redditRecords)
  const fullTextModel = trainNaiveBayes(combinedRows)
  const redditPredictions = redditByDate.map((row) => {
    const pred = fullTextModel.predict(row.text)
    return {
      Date: row.date,
      ProbabilityUp: Number(pred.probUp.toFixed(4)),
      PredictedLabel: pred.pred,
    }
  })
  writeCsv(path.join(outputDir, 'RedditNews_date_predictions.csv'), redditPredictions)

  const { samples, latest, prev } = buildDjiaRows(djiaRecords)
  const djiaModel = trainLinearRegression(samples)
  const djiaPredictions = djiaModel.testPred.map((r) => ({
    Date: r.date,
    ActualNextClose: Number(r.y.toFixed(4)),
    PredictedNextClose: Number(r.pred.toFixed(4)),
    AbsoluteError: Number(Math.abs(r.pred - r.y).toFixed(4)),
  }))
  writeCsv(path.join(outputDir, 'DJIA_next_close_test_predictions.csv'), djiaPredictions)

  const latestFeatureRow = {
    x: [
      latest.open,
      latest.high,
      latest.low,
      latest.close,
      latest.volume,
      latest.adjClose,
      latest.close - latest.open,
      (latest.high - latest.low) / (latest.close || 1),
      (latest.close - prev.close) / (prev.close || 1),
      Math.log((latest.volume + 1) / (prev.volume + 1)),
    ],
  }
  const nextCloseForecast = djiaModel.predict(latestFeatureRow)

  const summary = {
    sourceFolder: baseDir,
    outputFolder: outputDir,
    generatedAt: new Date().toISOString(),
    datasets: {
      Combined_News_DJIA: {
        rows: combinedRows.length,
        trainRows: combinedTrain.length,
        testRows: combinedTest.length,
        metrics: {
          accuracy: Number(combinedMetrics.accuracy.toFixed(4)),
          precision: Number(combinedMetrics.precision.toFixed(4)),
          recall: Number(combinedMetrics.recall.toFixed(4)),
          f1: Number(combinedMetrics.f1.toFixed(4)),
          confusion: {
            tp: combinedMetrics.tp,
            tn: combinedMetrics.tn,
            fp: combinedMetrics.fp,
            fn: combinedMetrics.fn,
          },
        },
        predictionsFile: 'Combined_News_predictions.csv',
      },
      RedditNews: {
        rows: redditRecords.length,
        aggregatedDates: redditByDate.length,
        predictionsFile: 'RedditNews_date_predictions.csv',
      },
      upload_DJIA_table: {
        rows: djiaRecords.length,
        trainRows: djiaModel.train.length,
        testRows: djiaModel.testPred.length,
        metrics: {
          mae: Number(djiaModel.mae.toFixed(4)),
          rmse: Number(djiaModel.rmse.toFixed(4)),
          mape: Number(djiaModel.mape.toFixed(4)),
        },
        predictionsFile: 'DJIA_next_close_test_predictions.csv',
        latestForecast: {
          lastKnownDate: latest.date,
          predictedNextClose: Number(nextCloseForecast.toFixed(4)),
        },
      },
    },
  }

  fs.writeFileSync(path.join(outputDir, 'prediction_summary.json'), JSON.stringify(summary, null, 2))
  console.log(JSON.stringify(summary, null, 2))
}

run()
