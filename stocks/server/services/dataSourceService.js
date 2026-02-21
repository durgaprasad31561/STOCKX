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

function normalizeTickerValue(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.^=-]/g, '')
}

function normalizeDateValue(value) {
  if (!value) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  return toIsoDate(parsed)
}

async function fileExists(filePath) {
  try {
    await fs.stat(path.resolve(filePath))
    return true
  } catch {
    return false
  }
}

async function readTickerNewsCsv(filePath) {
  const fullPath = path.resolve(filePath)
  const raw = await fs.readFile(fullPath, 'utf8')
  const records = parse(raw, { columns: true, skip_empty_lines: true })
  return records
    .map((row) => {
      const ticker = normalizeTickerValue(row.ticker || row.symbol || row.Symbol || '')
      const date = normalizeDateValue(
        row.date || row.Date || row.datetime || row.publishedAt || row.published_at || row.time || '',
      )
      const headline = String(row.headline || row.title || row.Headline || '').trim()
      return { ticker, date, headline }
    })
    .filter((row) => row.ticker && row.date && row.headline)
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

function groupTickerNews(records, startDate, endDate, ticker) {
  const out = {}
  const start = toIsoDate(startDate)
  const end = toIsoDate(endDate)
  const target = normalizeTickerValue(ticker)

  for (const item of records) {
    if (!item?.date || !item?.headline || !item?.ticker) continue
    if (item.date < start || item.date > end) continue
    if (target && item.ticker !== target) continue
    out[item.date] = out[item.date] || []
    out[item.date].push(item.headline)
  }

  return out
}

function hasHeadlinesByDate(grouped) {
  return Object.values(grouped || {}).some((headlines) => Array.isArray(headlines) && headlines.length > 0)
}

export async function loadNewsByDate({ dateFrom, dateTo, ticker }) {
  const startDate = parseDateInput(dateFrom)
  const endDate = parseDateInput(dateTo)

  if (env.tickerNewsDatasetPath && (await fileExists(env.tickerNewsDatasetPath))) {
    try {
      const tickerRecords = await readTickerNewsCsv(env.tickerNewsDatasetPath)
      const groupedTickerNews = groupTickerNews(tickerRecords, startDate, endDate, ticker)
      if (hasHeadlinesByDate(groupedTickerNews)) {
        return groupedTickerNews
      }
    } catch (error) {
      console.warn(`[news] Failed reading ticker news dataset, using fallback source: ${error.message}`)
    }
  }

  const isCsv = env.newsDatasetPath.toLowerCase().endsWith('.csv')
  const records = isCsv ? await readKaggleCsv(env.newsDatasetPath) : await readFallbackNews()
  return groupNews(records, startDate, endDate)
}

export async function getNewsDataRange() {
  if (newsRangeCache) return newsRangeCache

  if (env.tickerNewsDatasetPath && (await fileExists(env.tickerNewsDatasetPath))) {
    try {
      const tickerRecords = await readTickerNewsCsv(env.tickerNewsDatasetPath)
      newsRangeCache = resolveNewsRange(tickerRecords)
      return newsRangeCache
    } catch (error) {
      console.warn(`[news] Failed reading ticker news range, using fallback source: ${error.message}`)
    }
  }

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
