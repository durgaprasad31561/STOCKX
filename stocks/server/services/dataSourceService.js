import fs from 'node:fs/promises'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import { env } from '../config/env.js'
import { addDays, epochSeconds, parseDateInput, toIsoDate } from '../utils/time.js'

const symbolMap = {
  AAPL: 'AAPL',
  TSLA: 'TSLA',
  MSFT: 'MSFT',
  NIFTY50: '^NSEI',
  TCS: 'TCS.NS',
  INFY: 'INFY.NS',
  RELIANCE: 'RELIANCE.NS',
}

let newsRangeCache = null

function buildFallbackPrices(startDate, endDate) {
  const out = []
  let close = 100
  for (let d = new Date(startDate); d <= endDate; d = addDays(d, 1)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue
    const drift = Math.sin(d.getUTCDate() / 5) * 0.003 + (d.getUTCMonth() % 2 === 0 ? 0.0008 : -0.0006)
    close *= 1 + drift
    out.push({ date: toIsoDate(d), close: Number(close.toFixed(3)) })
  }
  return out
}

async function readFallbackNews() {
  const fullPath = path.resolve(env.newsDatasetPath)
  const raw = await fs.readFile(fullPath, 'utf8')
  const parsed = JSON.parse(raw)
  return parsed
}

async function readKaggleCsv(filePath) {
  const fullPath = path.resolve(filePath)
  const raw = await fs.readFile(fullPath, 'utf8')
  const records = parse(raw, { columns: true, skip_empty_lines: true })
  return records.map((row) => {
    const allHeadlines = Object.entries(row)
      .filter(([key, value]) => key !== 'Date' && value && String(value).trim())
      .map(([, value]) => String(value))
    return { date: row.Date, headlines: allHeadlines }
  })
}

function resolveNewsRange(records) {
  const dates = records
    .map((item) => String(item.date || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  if (!dates.length) {
    return { dateFrom: null, dateTo: null, totalDays: 0 }
  }

  return {
    dateFrom: dates[0],
    dateTo: dates[dates.length - 1],
    totalDays: new Set(dates).size,
  }
}

function groupNews(records, startDate, endDate) {
  const out = {}
  const start = toIsoDate(startDate)
  const end = toIsoDate(endDate)
  for (const item of records) {
    if (item.date < start || item.date > end) continue
    out[item.date] = item.headlines
  }
  return out
}

export async function loadNewsByDate({ dateFrom, dateTo }) {
  const startDate = parseDateInput(dateFrom)
  const endDate = parseDateInput(dateTo)
  const isCsv = env.newsDatasetPath.toLowerCase().endsWith('.csv')
  const records = isCsv ? await readKaggleCsv(env.newsDatasetPath) : await readFallbackNews()
  return groupNews(records, startDate, endDate)
}

export async function getNewsDataRange() {
  if (newsRangeCache) return newsRangeCache

  const isCsv = env.newsDatasetPath.toLowerCase().endsWith('.csv')
  const records = isCsv ? await readKaggleCsv(env.newsDatasetPath) : await readFallbackNews()
  newsRangeCache = resolveNewsRange(records)
  return newsRangeCache
}

export async function loadPricesByDate({ ticker, dateFrom, dateTo }) {
  const symbol = symbolMap[ticker] ?? ticker
  const from = parseDateInput(dateFrom)
  const to = parseDateInput(dateTo)
  const toPlusOne = addDays(to, 1)

  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?interval=1d&period1=${epochSeconds(from)}&period2=${epochSeconds(toPlusOne)}`

    const response = await fetch(url)
    if (!response.ok) throw new Error(`Yahoo request failed: ${response.status}`)
    const payload = await response.json()
    const result = payload?.chart?.result?.[0]
    const timestamps = result?.timestamp ?? []
    const closes = result?.indicators?.quote?.[0]?.close ?? []
    if (!timestamps.length || !closes.length) throw new Error('No market data available')

    const rows = timestamps
      .map((timestamp, idx) => ({
        date: toIsoDate(new Date(timestamp * 1000)),
        close: closes[idx],
      }))
      .filter((row) => typeof row.close === 'number')

    if (!rows.length) throw new Error('No valid close prices')
    return rows
  } catch (error) {
    console.warn(`[market] Falling back to synthetic prices: ${error.message}`)
    return buildFallbackPrices(from, toPlusOne)
  }
}
