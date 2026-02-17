import { motion as Motion } from 'framer-motion'

function toneClass(tone) {
  if (tone === 'Positive') return 'text-emerald-300'
  if (tone === 'Negative') return 'text-rose-300'
  return 'text-slate-300'
}

function strengthTone(strength = '') {
  const lower = strength.toLowerCase()
  if (lower === 'strong') return 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
  if (lower === 'moderate') return 'text-amber-300 border-amber-300/40 bg-amber-400/10'
  return 'text-slate-300 border-slate-400/30 bg-slate-500/10'
}

export function WorkflowInsights({ dailySentimentRows, stockReturnRows, educationReport }) {
  const sentimentPreview = dailySentimentRows.slice(0, 10)
  const returnsPreview = stockReturnRows.slice(0, 10)

  return (
    <section className="mt-8 grid gap-6 xl:grid-cols-3">
      <Motion.div
        className="glass-card rounded-3xl p-6 xl:col-span-2"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <div className="mb-3 inline-flex rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
          News Sentiment
        </div>
        <h3 className="text-base font-semibold text-white">Daily sentiment score and headline polarity</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-300">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Sentiment Score</th>
                <th className="px-3 py-2 font-medium">Avg/Day</th>
                <th className="px-3 py-2 font-medium">Positive</th>
                <th className="px-3 py-2 font-medium">Negative</th>
                <th className="px-3 py-2 font-medium">Tone</th>
              </tr>
            </thead>
            <tbody>
              {sentimentPreview.length ? (
                sentimentPreview.map((row) => (
                  <tr key={row.date} className="border-b border-white/5 text-slate-200">
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{row.sentimentScore.toFixed(2)}</td>
                    <td className="px-3 py-2">{row.averageSentiment.toFixed(2)}</td>
                    <td className="px-3 py-2 text-emerald-300">{row.positiveHeadlines}</td>
                    <td className="px-3 py-2 text-rose-300">{row.negativeHeadlines}</td>
                    <td className={`px-3 py-2 font-medium ${toneClass(row.tone)}`}>{row.tone}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-5 text-slate-400" colSpan={6}>
                    Run analysis to view daily sentiment metrics.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Motion.div>

      <Motion.div
        className="glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.07 }}
      >
        <div className="inline-flex rounded-full border border-emerald-300/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
          Educational Report
        </div>
        <h3 className="mt-3 text-base font-semibold text-white">Interpretation & statistical caution</h3>
        <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${strengthTone(educationReport?.strength)}`}>
          {educationReport?.strength || 'No result'}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-200">
          {educationReport?.relationshipSummary || 'Run analysis to generate interpretation for selected watchlist.'}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {educationReport?.statisticalMeaning || 'Statistical significance is reported after analysis completes.'}
        </p>
        <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-amber-200">Warnings</p>
          <ul className="mt-2 space-y-2 text-sm text-amber-100/90">
            {(educationReport?.warnings ?? []).map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </div>
      </Motion.div>

      <Motion.div
        className="glass-card rounded-3xl p-6 xl:col-span-3"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.12 }}
      >
        <div className="mb-3 inline-flex rounded-full border border-indigo-300/35 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-200">
          Stock Returns
        </div>
        <h3 className="text-base font-semibold text-white">Closing price, next-day return, rolling return</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-300">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Closing Price</th>
                <th className="px-3 py-2 font-medium">Next-day Return %</th>
                <th className="px-3 py-2 font-medium">Rolling Return % (5D)</th>
              </tr>
            </thead>
            <tbody>
              {returnsPreview.length ? (
                returnsPreview.map((row) => (
                  <tr key={row.date} className="border-b border-white/5 text-slate-200">
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{row.close.toFixed(2)}</td>
                    <td className={row.nextDayReturnPct >= 0 ? 'px-3 py-2 text-emerald-300' : 'px-3 py-2 text-rose-300'}>
                      {row.nextDayReturnPct.toFixed(2)}%
                    </td>
                    <td className={row.rollingReturnPct >= 0 ? 'px-3 py-2 text-emerald-300' : 'px-3 py-2 text-rose-300'}>
                      {row.rollingReturnPct.toFixed(2)}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-5 text-slate-400" colSpan={4}>
                    Run analysis to view stock return metrics.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Motion.div>
    </section>
  )
}
