const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'
const SUPPORTED_RANGES = new Set(['1mo', '3mo', '6mo', '1y'])

const symbolAliases = {
  NIFTY50: '^NSEI',
  RELIANCE: 'RELIANCE.NS',
  TCS: 'TCS.NS',
  INFY: 'INFY.NS',
}

function sanitizeSymbol(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.^=-]/g, '')
}

function resolveYahooSymbol(symbol) {
  const clean = sanitizeSymbol(symbol)
  return symbolAliases[clean] || clean
}

function resolveRange(range) {
  const clean = String(range || '').trim()
  return SUPPORTED_RANGES.has(clean) ? clean : '3mo'
}

function toIsoDay(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

async function fetchYahooChart(symbol, { range = '3mo', interval = '1d' } = {}) {
  const yahooSymbol = resolveYahooSymbol(symbol)
  if (!yahooSymbol) throw new Error('Symbol is required.')

  const query = new URLSearchParams({
    range: resolveRange(range),
    interval,
    events: 'history',
  })
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(yahooSymbol)}?${query.toString()}`
  const response = await fetch(url, {
    headers: { 'User-Agent': 'StockSentix/1.0' },
  })
  if (!response.ok) {
    throw new Error(`Market data provider failed for ${symbol}.`)
  }

  const payload = await response.json()
  const result = payload?.chart?.result?.[0]
  if (!result?.timestamp?.length || !result?.indicators?.quote?.[0]) {
    throw new Error(`No market data available for ${symbol}.`)
  }
  return result
}

function buildHistoryRows(result) {
  const closes = result.indicators.quote[0]?.close || []
  const rows = []
  for (let index = 0; index < result.timestamp.length; index += 1) {
    const close = closes[index]
    if (close == null || Number.isNaN(close)) continue
    rows.push({
      date: toIsoDay(result.timestamp[index]),
      close: Number(close),
    })
  }
  return rows
}

function normalizeHistory(rows) {
  if (!rows.length) return []
  const base = rows[0].close || 1
  return rows.map((row) => ({
    ...row,
    normalized: Number((((row.close - base) / base) * 100).toFixed(3)),
  }))
}

export async function getStockQuote(symbol) {
  const result = await fetchYahooChart(symbol, { range: '1mo', interval: '1d' })
  const meta = result.meta || {}
  const rows = buildHistoryRows(result)
  const latest = rows[rows.length - 1]
  const previous = rows[rows.length - 2]
  if (!latest) throw new Error(`No market data available for ${symbol}.`)

  const currentPrice = Number(meta.regularMarketPrice ?? latest.close)
  const previousClose = Number(meta.previousClose ?? previous?.close ?? latest.close)
  const change = Number((currentPrice - previousClose).toFixed(3))
  const changePercent = previousClose ? Number(((change / previousClose) * 100).toFixed(3)) : 0

  return {
    symbol: sanitizeSymbol(symbol),
    providerSymbol: meta.symbol || resolveYahooSymbol(symbol),
    name: meta.longName || meta.shortName || sanitizeSymbol(symbol),
    exchange: meta.exchangeName || meta.fullExchangeName || '',
    currency: meta.currency || '',
    marketState: meta.marketState || '',
    currentPrice,
    previousClose,
    change,
    changePercent,
    dayHigh: Number(meta.regularMarketDayHigh ?? currentPrice),
    dayLow: Number(meta.regularMarketDayLow ?? currentPrice),
    fiftyTwoWeekHigh: Number(meta.fiftyTwoWeekHigh ?? currentPrice),
    fiftyTwoWeekLow: Number(meta.fiftyTwoWeekLow ?? currentPrice),
    volume: Number(meta.regularMarketVolume ?? 0),
    avgVolume: Number(meta.averageDailyVolume3Month ?? 0),
    lastUpdatedAt: new Date().toISOString(),
  }
}

export async function getStockHistory(symbol, range) {
  const result = await fetchYahooChart(symbol, { range: resolveRange(range), interval: '1d' })
  const meta = result.meta || {}
  const rows = normalizeHistory(buildHistoryRows(result))
  if (!rows.length) throw new Error(`No market data available for ${symbol}.`)

  return {
    symbol: sanitizeSymbol(symbol),
    providerSymbol: meta.symbol || resolveYahooSymbol(symbol),
    name: meta.longName || meta.shortName || sanitizeSymbol(symbol),
    range: resolveRange(range),
    points: rows,
  }
}

function buildCompareChart(series) {
  const rowsByDate = new Map()
  for (const stock of series) {
    for (const point of stock.points) {
      const row = rowsByDate.get(point.date) || { date: point.date }
      row[stock.symbol] = point.normalized
      rowsByDate.set(point.date, row)
    }
  }
  return Array.from(rowsByDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getComparisonData(symbols, range) {
  const uniqueSymbols = Array.from(
    new Set(
      (symbols || [])
        .map((value) => sanitizeSymbol(value))
        .filter(Boolean),
    ),
  ).slice(0, 3)

  if (uniqueSymbols.length < 2) {
    throw new Error('Select at least two symbols to compare.')
  }

  const series = await Promise.all(uniqueSymbols.map((symbol) => getStockHistory(symbol, range)))
  return {
    symbols: uniqueSymbols,
    range: resolveRange(range),
    series,
    chart: buildCompareChart(series),
  }
}
