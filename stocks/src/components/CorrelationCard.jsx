import { motion as Motion } from 'framer-motion'
import { useMemo } from 'react'

export function CorrelationCard({ animatedCorrelation, correlation, explanation, sampleSize, resultMeta, stats }) {
  const isPredictionMode = resultMeta?.resultType === 'csv_prediction'

  const resultTone = useMemo(() => {
    if (isPredictionMode) {
      if (resultMeta?.predictionLabel === 'UP') {
        return {
          label: 'Predicted Up',
          className: 'text-emerald-400 border-emerald-400/40 bg-emerald-500/10',
        }
      }
      return {
        label: 'Predicted Down',
        className: 'text-amber-300 border-amber-300/40 bg-amber-500/10',
      }
    }
    if (correlation > 0.2) {
      return {
        label: 'Positive Correlation',
        className: 'text-emerald-400 border-emerald-400/40 bg-emerald-500/10',
      }
    }
    if (correlation < -0.2) {
      return {
        label: 'Negative Correlation',
        className: 'text-red-400 border-red-400/40 bg-red-500/10',
      }
    }
    return {
      label: 'Weak Correlation',
      className: 'text-yellow-300 border-yellow-300/40 bg-yellow-400/10',
    }
  }, [correlation, isPredictionMode, resultMeta?.predictionLabel])

  return (
    <Motion.div
      className="glass-card rounded-3xl p-6"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: 0.1 }}
    >
      <p className="text-sm text-slate-300">{isPredictionMode ? 'Current Prediction Confidence' : 'Current Correlation'}</p>
      <div className="mt-4 text-5xl font-bold tracking-tight text-white md:text-6xl">
        {isPredictionMode ? `${(correlation * 100).toFixed(1)}%` : animatedCorrelation.toFixed(2)}
      </div>
      <div className={`mt-4 inline-flex rounded-full border px-4 py-2 text-sm ${resultTone.className}`}>
        {resultTone.label}
      </div>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
        {explanation}
      </p>
      <p className="mt-2 text-xs text-slate-400">
        {isPredictionMode ? 'Rows used for training/backtest' : 'Aligned samples'}: {sampleSize}
      </p>
      {isPredictionMode ? (
        <p className="mt-1 text-xs text-slate-400">Classification threshold: {resultMeta?.threshold ?? '-'}</p>
      ) : null}
      {!isPredictionMode && stats ? (
        <p className="mt-1 text-xs text-slate-400">
          Approx. p-value: {stats.pValueApprox} ({stats.isStatisticallyMeaningful ? 'statistically meaningful' : 'not statistically meaningful'})
        </p>
      ) : null}
    </Motion.div>
  )
}
