import { motion as Motion } from 'framer-motion'

export function ControlPanel({
  ticker,
  setTicker,
  model,
  setModel,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  maxDate,
  dataRange,
  onRunAnalysis,
  isRunning,
}) {
  const isCsvModel = model === 'CSV-ML'
  const watchlistTickers = ['AAPL', 'TSLA', 'MSFT', 'NIFTY50', 'TCS', 'INFY', 'RELIANCE']

  const rangeLabel =
    dataRange?.dateFrom && dataRange?.dateTo
      ? `Available data for ${ticker}: ${dataRange.dateFrom} to ${dataRange.dateTo}.`
      : 'Data range is shown after login and dataset load.'
  const minSelectableDate = dataRange?.dateFrom || undefined
  const maxSelectableDate = dataRange?.dateTo && dataRange.dateTo < maxDate ? dataRange.dateTo : maxDate

  return (
    <Motion.div
      className="glass-card rounded-3xl p-6"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
    >
      <h2 className="text-lg font-semibold text-white">Select Watchlist & Date Range</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="field-wrap">
          <span className="field-label">{isCsvModel ? 'CSV Dataset Ticker' : 'Watchlist Stock'}</span>
          {isCsvModel ? (
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="field-input"
              placeholder="Example: ASLE"
            />
          ) : (
            <select value={ticker} onChange={(e) => setTicker(e.target.value)} className="field-input">
              {watchlistTickers.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="field-wrap">
          <span className="field-label">Analysis Model</span>
          <select
            value={model}
            onChange={(e) => {
              const nextModel = e.target.value
              setModel(nextModel)
              if (nextModel === 'CSV-ML') {
                setTicker('ASLE')
                setDateFrom('2022-01-01')
                setDateTo('2022-12-30')
              }
            }}
            className="field-input"
          >
            {['VADER', 'FinBERT', 'CSV-ML'].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field-wrap">
          <span className="field-label">Date From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            min={minSelectableDate}
            max={maxSelectableDate}
            className="field-input"
          />
        </label>
        <label className="field-wrap">
          <span className="field-label">Date To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={minSelectableDate}
            max={maxSelectableDate}
            className="field-input"
          />
        </label>
      </div>
      {isCsvModel ? (
        <p className="mt-3 text-xs text-cyan-200/90">
          CSV-ML mode uses your uploaded file and shows UP/DOWN prediction confidence for the selected ticker.
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-300">{rangeLabel}</p>
      )}
      {!isCsvModel ? (
        <p className="mt-2 text-xs text-slate-400">
          Select one stock from watchlist, choose period, then run analysis to unlock sentiment, returns, correlation,
          and educational interpretation.
        </p>
      ) : null}
      <button
        className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 shadow-[0_12px_36px_rgba(52,211,153,0.3)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onRunAnalysis}
        disabled={isRunning}
      >
        {isRunning ? 'Running...' : 'Run Analysis'}
      </button>
    </Motion.div>
  )
}
