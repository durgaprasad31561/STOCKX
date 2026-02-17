import { motion as Motion } from 'framer-motion'

export function HistoryTable({ experimentHistory }) {
  return (
    <section className="mt-8">
      <Motion.div
        className="glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <h3 className="text-base font-semibold text-white">Experiment History</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-300">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Model</th>
              </tr>
            </thead>
            <tbody>
              {experimentHistory.length > 0 ? (
                experimentHistory.map((row) => (
                  <tr
                    key={row._id || `${row.date}-${row.stock}-${row.model}`}
                    className="border-b border-white/5 text-slate-200 transition hover:bg-white/5"
                  >
                    <td className="px-4 py-3">{row.date}</td>
                    <td className="px-4 py-3">{row.stock}</td>
                    <td
                      className={
                        row.runType === 'csv_prediction'
                          ? row.predictionLabel === 'UP'
                            ? 'px-4 py-3 text-emerald-400'
                            : 'px-4 py-3 text-amber-300'
                          : row.correlation > 0
                            ? 'px-4 py-3 text-emerald-400'
                            : 'px-4 py-3 text-red-400'
                      }
                    >
                      {row.runType === 'csv_prediction'
                        ? `${Number(row.predictionProbability ?? row.correlation).toFixed(2)} (${row.predictionLabel || 'N/A'})`
                        : Number(row.correlation).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{row.model}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-slate-400" colSpan={4}>
                    No experiments yet. Run the first analysis.
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
