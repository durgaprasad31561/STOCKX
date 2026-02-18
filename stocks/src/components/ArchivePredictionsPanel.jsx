import { useMemo, useState } from 'react'
import { motion as Motion } from 'framer-motion'

function parseNumberSeries(rawText) {
  return rawText
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value))
}

function calculateMedian(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const center = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[center - 1] + sorted[center]) / 2
  }
  return sorted[center]
}

function calculateMode(values) {
  if (!values.length) return null
  const counts = new Map()
  values.forEach((value) => {
    const rounded = Number(value.toFixed(2))
    counts.set(rounded, (counts.get(rounded) ?? 0) + 1)
  })

  let topValue = null
  let topCount = 0
  counts.forEach((count, value) => {
    if (count > topCount) {
      topValue = value
      topCount = count
    }
  })
  return topCount > 1 ? topValue : null
}

function sentimentBand(score) {
  if (score >= 0.25) return 'Positive Bias'
  if (score <= -0.25) return 'Negative Bias'
  return 'Neutral Bias'
}

function outlookFromMetrics(mean, median) {
  if (mean >= 0.35 && median >= 0.25) {
    return {
      title: 'Constructive Momentum Outlook',
      body: 'Your current sentiment profile suggests stronger upside behavior if this pattern persists. Validate with volume and event risk before acting.',
      toneClass: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100',
    }
  }
  if (mean <= -0.35 && median <= -0.25) {
    return {
      title: 'Defensive Outlook',
      body: 'The distribution leans negative and may indicate downside pressure. Consider tighter risk controls and scenario-based planning.',
      toneClass: 'border-rose-400/35 bg-rose-500/10 text-rose-100',
    }
  }
  return {
    title: 'Range-Bound Outlook',
    body: 'Signals are mixed, suggesting indecision. Focus on upcoming catalysts and update your data frequently to improve directional confidence.',
    toneClass: 'border-amber-300/35 bg-amber-500/10 text-amber-100',
  }
}

function detectDelimiter(headerLine) {
  const delimiterScores = [
    { delimiter: ',', count: (headerLine.match(/,/g) ?? []).length },
    { delimiter: ';', count: (headerLine.match(/;/g) ?? []).length },
    { delimiter: '\t', count: (headerLine.match(/\t/g) ?? []).length },
  ]
  const best = delimiterScores.sort((a, b) => b.count - a.count)[0]
  return best.count > 0 ? best.delimiter : ','
}

function splitCsvLine(line, delimiter) {
  const cells = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && next === '"' && inQuotes) {
      cell += '"'
      i += 1
      continue
    }
    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (char === delimiter && !inQuotes) {
      cells.push(cell)
      cell = ''
      continue
    }
    cell += char
  }
  cells.push(cell)
  return cells.map((value) => value.trim())
}

function parseNumericCell(value) {
  const normalized = String(value ?? '')
    .replace(/"/g, '')
    .replace(/%/g, '')
    .trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseCsvSentimentSeries(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) return []

  const delimiter = detectDelimiter(lines[0])
  const firstRow = splitCsvLine(lines[0], delimiter)
  const hasHeader = firstRow.some((cell) => Number.isNaN(Number(cell)))
  const headerRow = hasHeader ? firstRow : []
  const dataLines = hasHeader ? lines.slice(1) : lines

  const sentimentHeaders = ['sentiment', 'score', 'polarity', 'compound', 'value']
  const targetIndexes = headerRow
    .map((header, index) => ({ header: header.toLowerCase(), index }))
    .filter(({ header }) => sentimentHeaders.some((token) => header.includes(token)))
    .map(({ index }) => index)

  const values = []
  dataLines.forEach((line) => {
    const row = splitCsvLine(line, delimiter)
    if (targetIndexes.length) {
      targetIndexes.forEach((columnIndex) => {
        const parsed = parseNumericCell(row[columnIndex])
        if (parsed !== null) values.push(parsed)
      })
      return
    }
    row.forEach((cell) => {
      const parsed = parseNumericCell(cell)
      if (parsed !== null) values.push(parsed)
    })
  })

  return values
}

function PreviewTable({ title, rows, totalRows }) {
  const columns = rows?.length ? Object.keys(rows[0]) : []

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <span className="text-xs text-slate-400">Rows: {totalRows ?? 0}</span>
      </div>
      {rows?.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="text-slate-300">
              <tr className="border-b border-white/10">
                {columns.map((column) => (
                  <th key={column} className="px-2 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${title}-${idx}`} className="border-b border-white/5 text-slate-200">
                  {columns.map((column) => (
                    <td key={`${title}-${idx}-${column}`} className="px-2 py-2">
                      {String(row[column] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-400">No rows available.</p>
      )}
    </div>
  )
}

export function ArchivePredictionsPanel({ data, onLoad, isLoading, error }) {
  const [customInput, setCustomInput] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const summary = data?.summary
  const datasets = summary?.datasets
  const sentimentSeries = useMemo(() => parseNumberSeries(customInput), [customInput])
  const parsedCount = sentimentSeries.length
  const mean = parsedCount ? sentimentSeries.reduce((sum, value) => sum + value, 0) / parsedCount : 0
  const median = parsedCount ? calculateMedian(sentimentSeries) : 0
  const mode = parsedCount ? calculateMode(sentimentSeries) : null
  const variance = parsedCount
    ? sentimentSeries.reduce((sum, value) => sum + (value - mean) ** 2, 0) / parsedCount
    : 0
  const standardDeviation = Math.sqrt(variance)
  const outlook = outlookFromMetrics(mean, median)

  function handleCsvUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError('')
    setUploadMessage('')

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const values = parseCsvSentimentSeries(text)
      if (!values.length) {
        setUploadError('No numeric sentiment values were found in this CSV file.')
        return
      }
      setCustomInput(values.join(', '))
      setUploadMessage(`Loaded ${values.length} values from ${file.name}.`)
    }
    reader.onerror = () => {
      setUploadError('Unable to read the selected CSV file. Try another file.')
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <section className="mt-8">
      <Motion.div
        className="glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">Prediction Results</h3>
          <button
            className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onLoad}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load Results'}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
        ) : null}

        {summary ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Combined News</p>
              <p className="mt-2 text-sm text-slate-200">Test Accuracy: {datasets?.Combined_News_DJIA?.metrics?.accuracy}</p>
              <p className="mt-1 text-sm text-slate-200">F1 Score: {datasets?.Combined_News_DJIA?.metrics?.f1}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">Reddit News</p>
              <p className="mt-2 text-sm text-slate-200">Rows: {datasets?.RedditNews?.rows}</p>
              <p className="mt-1 text-sm text-slate-200">Daily Aggregates: {datasets?.RedditNews?.aggregatedDates}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-400">DJIA Forecast</p>
              <p className="mt-2 text-sm text-slate-200">MAE: {datasets?.upload_DJIA_table?.metrics?.mae}</p>
              <p className="mt-1 text-sm text-slate-200">
                Next Close: {datasets?.upload_DJIA_table?.latestForecast?.predictedNextClose}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Click Load Results to view generated predictions from archive ZIP.</p>
        )}

        {data?.previews ? (
          <div className="mt-5 grid gap-4">
            <PreviewTable
              title="Combined_News_predictions.csv (preview)"
              rows={data.previews.combined?.previewRows}
              totalRows={data.previews.combined?.totalRows}
            />
            <PreviewTable
              title="RedditNews_date_predictions.csv (preview)"
              rows={data.previews.reddit?.previewRows}
              totalRows={data.previews.reddit?.totalRows}
            />
            <PreviewTable
              title="DJIA_next_close_test_predictions.csv (preview)"
              rows={data.previews.djia?.previewRows}
              totalRows={data.previews.djia?.totalRows}
            />
          </div>
        ) : null}
      </Motion.div>

      <Motion.div
        className="mt-6 glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.06 }}
      >
        <div className="inline-flex rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
          Analyse your own data
        </div>
        <h3 className="mt-3 text-base font-semibold text-white">Upload CSV or paste sentiment values for custom analysis</h3>
        <p className="mt-2 text-sm text-slate-300">
          Upload a `.csv` file with sentiment/score columns, or enter comma, space, or new-line separated values.
        </p>

        <label className="field-wrap mt-4">
          <span className="field-label">Upload CSV File</span>
          <input className="field-input" type="file" accept=".csv,text/csv" onChange={handleCsvUpload} />
        </label>

        {uploadError ? (
          <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {uploadError}
          </div>
        ) : null}
        {uploadMessage ? (
          <div className="mt-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {uploadMessage}
          </div>
        ) : null}

        <textarea
          className="field-input mt-4 min-h-28 w-full resize-y"
          placeholder="Or paste values here..."
          value={customInput}
          onChange={(event) => setCustomInput(event.target.value)}
        />

        {parsedCount ? (
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-cyan-200">Mean Sentiment</p>
              <p className="mt-2 text-lg font-semibold text-white">{mean.toFixed(4)}</p>
            </div>
            <div className="rounded-2xl border border-indigo-300/30 bg-indigo-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-indigo-200">Median Sentiment</p>
              <p className="mt-2 text-lg font-semibold text-white">{median.toFixed(4)}</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-4">
              <p className="text-xs uppercase tracking-wider text-fuchsia-200">Mode Sentiment</p>
              <p className="mt-2 text-lg font-semibold text-white">{mode !== null ? mode.toFixed(2) : 'No repeated mode'}</p>
            </div>
            <div className="rounded-2xl border border-slate-300/30 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-300">Sample Size</p>
              <p className="mt-2 text-lg font-semibold text-white">{parsedCount}</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
            Add your numeric data to generate mean, median, mode, and future prediction guidance.
          </div>
        )}

        {parsedCount ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className={`rounded-2xl border p-4 ${outlook.toneClass}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.12em]">Educational Future Prediction Report</p>
              <p className="mt-2 text-base font-semibold">{outlook.title}</p>
              <p className="mt-2 text-sm leading-relaxed">{outlook.body}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">Analytical Notes</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                <li>Bias profile: {sentimentBand(mean)} (mean-based)</li>
                <li>Central tendency check: mean {mean.toFixed(4)} vs median {median.toFixed(4)}</li>
                <li>Volatility proxy (std. dev): {standardDeviation.toFixed(4)}</li>
                <li>Interpretation scope: educational guidance only, not a trading guarantee</li>
              </ul>
            </div>
          </div>
        ) : null}
      </Motion.div>
    </section>
  )
}
