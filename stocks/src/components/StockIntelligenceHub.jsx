import { useEffect, useMemo, useState } from 'react'
import { motion as Motion } from 'framer-motion'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  addToWatchlist,
  fetchStockComparison,
  fetchStockHistory,
  fetchStockQuote,
  fetchWatchlist,
  removeFromWatchlist,
} from '../services/api'

const RANGE_OPTIONS = ['1mo', '3mo', '6mo', '1y']
const DETAIL_COLORS = ['#22d3ee']
const COMPARE_COLORS = ['#22d3ee', '#34d399', '#f59e0b']
const STARTER_SYMBOLS = ['AAPL', 'MSFT', 'TSLA']

function formatNumber(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return '-'
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
}

export function StockIntelligenceHub({ auth, onRequireAuth }) {
  const [watchlist, setWatchlist] = useState([])
  const [watchlistInput, setWatchlistInput] = useState('')
  const [watchlistLoading, setWatchlistLoading] = useState(false)
  const [watchlistError, setWatchlistError] = useState('')

  const [detailSymbol, setDetailSymbol] = useState('AAPL')
  const [detailRange, setDetailRange] = useState('3mo')
  const [detailQuote, setDetailQuote] = useState(null)
  const [detailHistory, setDetailHistory] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const [compareRange, setCompareRange] = useState('3mo')
  const [compareSymbols, setCompareSymbols] = useState(['AAPL', 'MSFT'])
  const [compareChart, setCompareChart] = useState([])
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState('')

  const availableSymbols = useMemo(() => {
    const union = new Set([...watchlist, ...STARTER_SYMBOLS, detailSymbol])
    return Array.from(union)
  }, [watchlist, detailSymbol])

  useEffect(() => {
    if (!auth?.token) {
      setWatchlist([])
      setDetailQuote(null)
      setDetailHistory([])
      setCompareChart([])
      return
    }

    async function loadWatchlist() {
      setWatchlistLoading(true)
      setWatchlistError('')
      try {
        const payload = await fetchWatchlist()
        const symbols = payload?.symbols?.length ? payload.symbols : STARTER_SYMBOLS
        setWatchlist(symbols)
        setDetailSymbol((prev) => (symbols.includes(prev) ? prev : symbols[0]))
        setCompareSymbols((prev) => {
          const next = prev.filter((item) => symbols.includes(item))
          if (next.length >= 2) return next.slice(0, 3)
          return symbols.slice(0, Math.min(3, Math.max(2, symbols.length)))
        })
      } catch (error) {
        setWatchlistError(error.message)
      } finally {
        setWatchlistLoading(false)
      }
    }

    loadWatchlist()
  }, [auth])

  useEffect(() => {
    if (!auth?.token || !detailSymbol) return
    async function loadDetails() {
      setDetailLoading(true)
      setDetailError('')
      try {
        const [quotePayload, historyPayload] = await Promise.all([
          fetchStockQuote(detailSymbol),
          fetchStockHistory(detailSymbol, detailRange),
        ])
        setDetailQuote(quotePayload?.quote ?? null)
        setDetailHistory(historyPayload?.points ?? [])
      } catch (error) {
        setDetailError(error.message)
      } finally {
        setDetailLoading(false)
      }
    }
    loadDetails()
  }, [auth, detailSymbol, detailRange])

  useEffect(() => {
    if (!auth?.token || compareSymbols.length < 2) {
      setCompareChart([])
      return
    }
    async function loadComparison() {
      setCompareLoading(true)
      setCompareError('')
      try {
        const payload = await fetchStockComparison(compareSymbols, compareRange)
        setCompareChart(payload?.chart ?? [])
      } catch (error) {
        setCompareError(error.message)
      } finally {
        setCompareLoading(false)
      }
    }
    loadComparison()
  }, [auth, compareSymbols, compareRange])

  if (!auth?.token) {
    return (
      <section className="mt-8">
        <div className="glass-card rounded-3xl p-6">
          <h3 className="text-lg font-semibold text-white">Stock Intelligence Workspace</h3>
          <p className="mt-2 text-sm text-slate-300">
            Login to unlock watchlist persistence in MongoDB, stock detail dashboard, and comparison analytics.
          </p>
          <button
            className="mt-4 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-300 transition hover:brightness-110"
            onClick={onRequireAuth}
          >
            Login to Continue
          </button>
        </div>
      </section>
    )
  }

  async function handleAddSymbol() {
    const symbol = watchlistInput.trim().toUpperCase()
    if (!symbol) return

    try {
      setWatchlistError('')
      const payload = await addToWatchlist(symbol)
      const symbols = payload?.symbols ?? []
      setWatchlist(symbols)
      setWatchlistInput('')
      if (!symbols.includes(detailSymbol)) setDetailSymbol(symbols[0] || symbol)
    } catch (error) {
      setWatchlistError(error.message)
    }
  }

  async function handleRemoveSymbol(symbol) {
    try {
      setWatchlistError('')
      const payload = await removeFromWatchlist(symbol)
      const symbols = payload?.symbols ?? []
      setWatchlist(symbols)
      if (detailSymbol === symbol) setDetailSymbol(symbols[0] || 'AAPL')
      setCompareSymbols((prev) => prev.filter((item) => item !== symbol))
    } catch (error) {
      setWatchlistError(error.message)
    }
  }

  function toggleCompareSymbol(symbol) {
    setCompareSymbols((prev) => {
      if (prev.includes(symbol)) return prev.filter((item) => item !== symbol)
      if (prev.length >= 3) return prev
      return [...prev, symbol]
    })
  }

  const detailTrend = detailHistory.map((item) => ({
    date: item.date.slice(5),
    close: item.close,
    normalized: item.normalized,
  }))

  return (
    <section className="mt-8 grid gap-6">
      <Motion.div
        className="glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Stock Intelligence Workspace</h3>
            <p className="mt-1 text-xs text-slate-300">Watchlist is persisted per user in MongoDB.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="field-input w-40"
              value={watchlistInput}
              onChange={(event) => setWatchlistInput(event.target.value)}
              placeholder="Add symbol (e.g. NVDA)"
            />
            <button
              className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-300 transition hover:brightness-110"
              onClick={handleAddSymbol}
            >
              Add
            </button>
          </div>
        </div>
        {watchlistError ? <p className="mt-3 text-sm text-red-300">{watchlistError}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {(watchlistLoading ? [] : watchlist).map((symbol) => (
            <div key={symbol} className="flex items-center gap-2 rounded-full border border-slate-500/30 bg-slate-900/60 px-3 py-1">
              <button
                className={`text-xs font-semibold ${detailSymbol === symbol ? 'text-cyan-300' : 'text-slate-200'}`}
                onClick={() => setDetailSymbol(symbol)}
              >
                {symbol}
              </button>
              <button className="text-xs text-slate-400 hover:text-red-300" onClick={() => handleRemoveSymbol(symbol)}>
                x
              </button>
            </div>
          ))}
          {!watchlistLoading && !watchlist.length ? <p className="text-sm text-slate-400">No symbols yet.</p> : null}
          {watchlistLoading ? <p className="text-sm text-slate-400">Loading watchlist...</p> : null}
        </div>
      </Motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Motion.div
          className="glass-card rounded-3xl p-6"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-base font-semibold text-white">Stock Detail Dashboard</h4>
            <select className="field-input w-24" value={detailRange} onChange={(event) => setDetailRange(event.target.value)}>
              {RANGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          {detailError ? <p className="mt-3 text-sm text-red-300">{detailError}</p> : null}
          {detailLoading ? <p className="mt-3 text-sm text-slate-400">Loading stock details...</p> : null}
          {detailQuote ? (
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-slate-500/30 bg-slate-900/45 p-3">
                <p className="text-slate-400">Company</p>
                <p className="mt-1 font-semibold text-white">{detailQuote.name}</p>
              </div>
              <div className="rounded-2xl border border-slate-500/30 bg-slate-900/45 p-3">
                <p className="text-slate-400">Price</p>
                <p className="mt-1 font-semibold text-white">
                  {formatNumber(detailQuote.currentPrice)} {detailQuote.currency}
                </p>
                <p className={detailQuote.change >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                  {detailQuote.change >= 0 ? '+' : ''}
                  {formatNumber(detailQuote.change)} ({formatNumber(detailQuote.changePercent)}%)
                </p>
              </div>
              <div className="rounded-2xl border border-slate-500/30 bg-slate-900/45 p-3">
                <p className="text-slate-400">52W Range</p>
                <p className="mt-1 font-semibold text-white">
                  {formatNumber(detailQuote.fiftyTwoWeekLow)} - {formatNumber(detailQuote.fiftyTwoWeekHigh)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-500/30 bg-slate-900/45 p-3">
                <p className="text-slate-400">Volume</p>
                <p className="mt-1 font-semibold text-white">{formatNumber(detailQuote.volume, 0)}</p>
              </div>
            </div>
          ) : null}
          <div className="mt-4 h-72">
            {detailTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={detailTrend}>
                  <CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid rgba(34,211,238,0.45)',
                      background: 'rgba(2,6,23,0.95)',
                    }}
                  />
                  <Line dataKey="close" type="monotone" stroke={DETAIL_COLORS[0]} strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">No trend data available.</div>
            )}
          </div>
        </Motion.div>

        <Motion.div
          className="glass-card rounded-3xl p-6"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-base font-semibold text-white">Compare 2-3 Stocks</h4>
            <select className="field-input w-24" value={compareRange} onChange={(event) => setCompareRange(event.target.value)}>
              {RANGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs text-slate-400">Performance is normalized to first close in the selected range.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {availableSymbols.map((symbol) => (
              <button
                key={symbol}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  compareSymbols.includes(symbol)
                    ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-200'
                    : 'border-slate-500/35 bg-slate-900/50 text-slate-300'
                }`}
                onClick={() => toggleCompareSymbol(symbol)}
              >
                {symbol}
              </button>
            ))}
          </div>
          {compareSymbols.length < 2 ? <p className="mt-2 text-sm text-amber-300">Select at least two symbols.</p> : null}
          {compareError ? <p className="mt-2 text-sm text-red-300">{compareError}</p> : null}
          <div className="mt-4 h-80">
            {compareLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading comparison...</div>
            ) : compareChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={compareChart}>
                  <CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#94a3b8" tickFormatter={(value) => String(value).slice(5)} />
                  <YAxis stroke="#94a3b8" tickFormatter={(value) => `${value}%`} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid rgba(52,211,153,0.35)',
                      background: 'rgba(2,6,23,0.95)',
                    }}
                    formatter={(value) => [`${formatNumber(value, 2)}%`, 'Return']}
                  />
                  <Legend />
                  {compareSymbols.map((symbol, index) => (
                    <Line
                      key={symbol}
                      type="monotone"
                      dataKey={symbol}
                      stroke={COMPARE_COLORS[index % COMPARE_COLORS.length]}
                      strokeWidth={2.5}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Comparison chart appears here.</div>
            )}
          </div>
        </Motion.div>
      </div>
    </section>
  )
}
