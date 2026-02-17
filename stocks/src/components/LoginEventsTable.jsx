import { useMemo } from 'react'
import { motion as Motion } from 'framer-motion'

export function LoginEventsTable({ events, users, searchRows }) {
  const successCount = useMemo(() => events.filter((row) => row.status === 'success').length, [events])
  const failedCount = useMemo(() => events.filter((row) => row.status !== 'success').length, [events])

  return (
    <section className="mt-8">
      <Motion.div
        className="glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.42 }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-200/90">Total Users</p>
            <p className="mt-1 text-2xl font-bold text-white">{users?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/90">Search Runs</p>
            <p className="mt-1 text-2xl font-bold text-white">{searchRows?.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-green-300/20 bg-green-500/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-green-200/90">Login Success</p>
            <p className="mt-1 text-2xl font-bold text-white">{successCount}</p>
          </div>
          <div className="rounded-2xl border border-red-300/20 bg-red-500/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-red-200/90">Login Failed</p>
            <p className="mt-1 text-2xl font-bold text-white">{failedCount}</p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="border-b border-white/10 bg-slate-950/60 px-4 py-3">
            <h3 className="text-base font-semibold text-white">Authentication Audit Trail</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-300">
                <tr className="border-b border-white/10 bg-slate-950/40">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {events.length > 0 ? (
                  events.map((row) => (
                    <tr key={row._id} className="border-b border-white/5 bg-slate-900/20 text-slate-100">
                      <td className="px-4 py-3">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium">{row.username}</td>
                      <td className="px-4 py-3 uppercase">{row.role}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                            row.status === 'success'
                              ? 'border border-emerald-300/35 bg-emerald-500/15 text-emerald-200'
                              : 'border border-red-300/35 bg-red-500/15 text-red-200'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{row.reason || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-7 text-slate-400" colSpan={5}>
                      No login events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Motion.div>
    </section>
  )
}
