import { motion as Motion } from 'framer-motion'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function ScatterTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="rounded-2xl border border-cyan-300/45 bg-slate-950/95 px-4 py-3 shadow-[0_10px_26px_rgba(2,6,23,0.6)]">
      {label || point.date ? <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-200">{label || point.date}</p> : null}
      <p className="mt-1 text-sm font-semibold text-slate-100">Return: {Number(point.return).toFixed(2)}%</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">Sentiment: {Number(point.sentiment).toFixed(4)}</p>
    </div>
  )
}

function RollingTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  return (
    <div className="rounded-2xl border border-emerald-300/45 bg-slate-950/95 px-4 py-3 shadow-[0_10px_26px_rgba(2,6,23,0.6)]">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-200">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">Rolling correlation: {Number(value).toFixed(4)}</p>
    </div>
  )
}

export function ChartsSection({ sentimentVsReturn, rollingCorrelation }) {
  const hasScatter = sentimentVsReturn.length > 0
  const hasRolling = rollingCorrelation.length > 0
  const chartBoxClass = 'mt-4 h-80'
  const chartMargin = { top: 10, right: 10, left: 0, bottom: 4 }
  const axisTick = { fill: '#94a3b8', fontSize: 12 }

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      <Motion.div
        className="glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <div className="inline-flex rounded-full border border-fuchsia-300/35 bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-200">
          Correlation Analysis
        </div>
        <h3 className="mt-3 text-base font-semibold text-white">Sentiment vs Next-day Return</h3>
        <div className={chartBoxClass}>
          {hasScatter ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={chartMargin}>
                <CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
                <XAxis dataKey="sentiment" stroke="#94a3b8" tick={axisTick} height={30} tickMargin={6} />
                <YAxis dataKey="return" stroke="#94a3b8" tick={axisTick} />
                <Tooltip
                  cursor={{ strokeDasharray: '4 4' }}
                  content={<ScatterTooltip />}
                />
                <Scatter data={sentimentVsReturn} fill="#22d3ee" />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Run analysis to populate scatter data.
            </div>
          )}
        </div>
      </Motion.div>

      <Motion.div
        className="glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: 0.08 }}
      >
        <h3 className="mt-3 text-base font-semibold text-white">Rolling 30-day Correlation</h3>
        <div className={chartBoxClass}>
          {hasRolling ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rollingCorrelation} margin={chartMargin}>
                <CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  stroke="#94a3b8"
                  tick={axisTick}
                  height={30}
                  tickMargin={6}
                  tickFormatter={(value) => String(value).slice(5)}
                />
                <YAxis stroke="#94a3b8" tick={axisTick} />
                <Tooltip
                  content={<RollingTooltip />}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#34d399"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#34d399' }}
                  activeDot={{ r: 6, fill: '#22d3ee' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Run analysis to populate rolling correlation.
            </div>
          )}
        </div>
      </Motion.div>
    </section>
  )
}
