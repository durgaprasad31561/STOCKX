import { motion as Motion } from 'framer-motion'

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
  const summary = data?.summary
  const datasets = summary?.datasets

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
    </section>
  )
}
