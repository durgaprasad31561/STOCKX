import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'

const FINNHUB_NEWS_URL = 'https://finnhub.io/api/v1/company-news'

const symbolMap = {
  AAPL: ['AAPL'],
  TSLA: ['TSLA'],
  MSFT: ['MSFT'],
  NIFTY50: ['^NSEI', 'NSE:NIFTY50'],
  TCS: ['TCS.NS', 'NSE:TCS', 'TCS'],
  INFY: ['INFY.NS', 'NSE:INFY', 'INFY'],
  RELIANCE: ['RELIANCE.NS', 'NSE:RELIANCE', 'RELIANCE'],
}

function resolveSymbolCandidates(input) {
  const normalized = String(input || '')
    .trim()
    .toUpperCase()
  if (!normalized) return []
  const mapped = symbolMap[normalized] || []
  return Array.from(new Set([normalized, ...mapped])).filter(Boolean)
}

function parseArgValue(flag) {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index + 1 >= process.argv.length) return ''
  return String(process.argv[index + 1] || '').trim()
}

function getIsoDateShift(daysBack) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - daysBack)
  return date.toISOString().slice(0, 10)
}

function resolveConfig() {
  const key = parseArgValue('--api-key') || env.finnhubApiKey
  const symbolsRaw = parseArgValue('--symbols') || 'AAPL,TSLA,MSFT,TCS,INFY,RELIANCE'
  const from = parseArgValue('--from') || getIsoDateShift(120)
  const to = parseArgValue('--to') || getIsoDateShift(0)
  const out = parseArgValue('--out') || 'server/data/ticker_news.csv'

  const symbols = symbolsRaw
    .split(',')
    .map((value) => String(value).trim().toUpperCase())
    .filter(Boolean)

  return { key, symbols, from, to, out }
}

function csvEscape(value) {
  const raw = String(value ?? '')
  if (/["\n,]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

function formatDate(epochSeconds) {
  if (!Number.isFinite(epochSeconds)) return ''
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchNewsForSymbol({ key, symbol, from, to }) {
  const candidates = resolveSymbolCandidates(symbol)
  let lastStatus = null
  let lastError = 'no_data'

  for (const providerSymbol of candidates) {
    const query = new URLSearchParams({
      symbol: providerSymbol,
      from,
      to,
      token: key,
    })

    const response = await fetch(`${FINNHUB_NEWS_URL}?${query.toString()}`)
    lastStatus = response.status
    if (!response.ok) {
      lastError = `status_${response.status}`
      continue
    }

    const payload = await response.json()
    if (!Array.isArray(payload) || payload.length === 0) {
      lastError = 'empty'
      continue
    }

    return payload
      .map((item) => ({
        date: formatDate(Number(item.datetime)),
        ticker: symbol,
        headline: String(item.headline || '').trim(),
        source: String(item.source || ''),
        url: String(item.url || ''),
      }))
      .filter((row) => row.date && row.ticker && row.headline)
  }

  return {
    __error: true,
    symbol,
    status: lastStatus,
    reason: lastError,
  }
}

async function writeCsv(rows, outPath) {
  const header = 'date,ticker,headline,source,url'
  const lines = rows.map((row) =>
    [row.date, row.ticker, row.headline, row.source, row.url].map(csvEscape).join(','),
  )
  const fullPath = path.resolve(outPath)
  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  await fs.writeFile(fullPath, `${header}\n${lines.join('\n')}\n`, 'utf8')
  return fullPath
}

async function main() {
  const { key, symbols, from, to, out } = resolveConfig()
  if (!key) {
    throw new Error('Finnhub API key missing. Set FINNHUB_API_KEY or pass --api-key.')
  }
  if (!symbols.length) {
    throw new Error('No symbols provided. Use --symbols AAPL,TSLA,...')
  }

  const rows = []
  const failures = []
  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i]
    const newsRows = await fetchNewsForSymbol({ key, symbol, from, to })
    if (newsRows?.__error) {
      failures.push({
        symbol: newsRows.symbol,
        status: newsRows.status,
        reason: newsRows.reason,
      })
    } else {
      rows.push(...newsRows)
    }
    if (i < symbols.length - 1) await sleep(350)
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ticker.localeCompare(b.ticker)))
  const csvPath = await writeCsv(rows, out)
  console.log(
    JSON.stringify(
      {
        from,
        to,
        symbols,
        rowCount: rows.length,
        failedSymbols: failures,
        output: csvPath,
        nextStep: 'Set TICKER_NEWS_DATASET_PATH to this CSV path and run analysis.',
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(`[fetchTickerNewsFinnhub] ${error.message}`)
  process.exit(1)
})
