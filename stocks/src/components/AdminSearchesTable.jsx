import { motion as Motion } from 'framer-motion'

export function AdminSearchesTable({ rows }) {
  return (
    <section className="mt-8">
      <Motion.div
        className="glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.42 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-indigo-200/90">Admin Intelligence</p>
            <h3 className="mt-2 text-xl font-semibold text-white">User Search Activity</h3>
          </div>
          <div className="rounded-xl border border-indigo-300/25 bg-indigo-500/12 px-4 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-indigo-200">Total Records</p>
            <p className="text-lg font-bold text-white">{rows.length}</p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-slate-300">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Correlation</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row._id} className="border-b border-white/5 bg-slate-900/20 text-slate-100">
                    <td className="px-4 py-3">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 font-medium">{row.requestedBy}</td>
                    <td className="px-4 py-3 uppercase text-slate-300">{row.requestedRole}</td>
                    <td className="px-4 py-3 font-semibold text-cyan-200">{row.stock}</td>
                    <td className="px-4 py-3">{row.model}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          row.runType === 'csv_prediction'
                            ? row.predictionLabel === 'UP'
                              ? 'border border-emerald-300/35 bg-emerald-500/15 text-emerald-200'
                              : 'border border-amber-300/35 bg-amber-500/15 text-amber-200'
                            : row.correlation > 0
                              ? 'border border-emerald-300/35 bg-emerald-500/15 text-emerald-200'
                              : 'border border-red-300/35 bg-red-500/15 text-red-200'
                        }`}
                      >
                        {row.runType === 'csv_prediction'
                          ? `${Number(row.predictionProbability ?? row.correlation).toFixed(2)} ${row.predictionLabel || ''}`
                          : Number(row.correlation).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-7 text-slate-400" colSpan={6}>
                    No search activity found.
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
