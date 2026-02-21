import { motion as Motion } from 'framer-motion'

function directionTone(direction) {
  if (direction === 'UP') return 'text-emerald-300 border-emerald-400/35 bg-emerald-500/10'
  if (direction === 'DOWN') return 'text-rose-300 border-rose-400/35 bg-rose-500/10'
  return 'text-slate-300 border-slate-400/30 bg-slate-500/10'
}

function driverTone(direction) {
  return direction === 'up' ? 'text-emerald-300' : direction === 'down' ? 'text-rose-300' : 'text-slate-300'
}

export function EventImpactPanel({ ticker, eventInsight }) {
  const hasInsight = Boolean(eventInsight)
  const coveragePct = hasInsight ? (eventInsight.tickerCoverage * 100).toFixed(1) : '0.0'
  const coverageTone =
    Number(coveragePct) >= 35 ? 'text-emerald-300' : Number(coveragePct) >= 15 ? 'text-amber-300' : 'text-rose-300'

  return (
    <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Motion.div
        className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(2,20,47,0.96),rgba(3,32,60,0.9)_55%,rgba(5,19,42,0.96))] p-6 shadow-[0_22px_58px_rgba(2,8,23,0.5)]"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <div className="inline-flex rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
          Why Tomorrow May Move
        </div>
        <h3 className="mt-3 text-lg font-semibold text-white">Event-Based Next-Day Return Insight</h3>
        <p className="mt-2 text-sm text-slate-300">
          Converts headlines into event categories such as layoffs, CEO exit, legal risk, guidance change, and earnings surprise.
        </p>

        {hasInsight ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Probability Up</p>
                <p className="mt-1 text-xl font-semibold text-emerald-300">{(eventInsight.probabilityUp * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Probability Down</p>
                <p className="mt-1 text-xl font-semibold text-rose-300">{(eventInsight.probabilityDown * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Model Confidence</p>
                <p className="mt-1 text-xl font-semibold text-cyan-200">{(eventInsight.confidence * 100).toFixed(1)}%</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.08em] text-slate-400">Ticker-Specific Coverage</p>
                <p className={`text-sm font-semibold ${coverageTone}`}>{coveragePct}% headlines directly reference {ticker}</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-800/90">
                <div
                  className={`h-full rounded-full ${
                    Number(coveragePct) >= 35 ? 'bg-emerald-400' : Number(coveragePct) >= 15 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.max(6, Math.min(100, Number(coveragePct)))}%` }}
                />
              </div>
            </div>

            <div
              className={`mt-4 inline-flex rounded-full border px-4 py-2 text-sm font-semibold uppercase tracking-[0.1em] ${directionTone(eventInsight.expectedDirection)}`}
            >
              Expected Next-Day Bias: {eventInsight.expectedDirection}
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-200">{eventInsight.explanation}</p>
            <p className="mt-3 text-xs text-slate-400">{eventInsight.disclaimer}</p>
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-slate-300">
            Run analysis for {ticker || 'selected stock'} to generate event-based next-day return insight.
          </div>
        )}
      </Motion.div>

      <Motion.div
        className="glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.06 }}
      >
        <div className="inline-flex rounded-full border border-indigo-300/35 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-200">
          Event Drivers
        </div>
        <h3 className="mt-3 text-base font-semibold text-white">Top signals detected from headlines</h3>
        <div className="mt-4 space-y-3">
          {(eventInsight?.topDrivers || []).length ? (
            eventInsight.topDrivers.map((driver) => (
              <div key={`${driver.category}-${driver.sampleHeadline}`} className="rounded-2xl border border-white/10 bg-slate-900/35 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-100">{driver.category}</p>
                  <span className={`text-xs font-semibold uppercase tracking-[0.1em] ${driverTone(driver.direction)}`}>
                    {driver.direction}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Frequency: {driver.frequency} | Impact score: {driver.impactScore.toFixed(2)}
                </p>
                <p className="mt-2 line-clamp-2 text-xs text-slate-300">&quot;{driver.sampleHeadline}&quot;</p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-slate-900/35 p-4 text-sm text-slate-300">
              No strong event keywords detected in the selected window.
            </div>
          )}
        </div>
      </Motion.div>
    </section>
  )
}
