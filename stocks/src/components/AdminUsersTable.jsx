import { useMemo, useState } from 'react'
import { motion as Motion } from 'framer-motion'

export function AdminUsersTable({ users, onDeleteUser, onUpdateUserRole, authUser }) {
  const [roleDrafts, setRoleDrafts] = useState({})
  const [savingUserId, setSavingUserId] = useState('')

  const adminCount = useMemo(() => users.filter((row) => row.role === 'admin').length, [users])
  const userCount = useMemo(() => users.filter((row) => row.role === 'user').length, [users])

  async function handleSaveRole(userId, currentRole) {
    const nextRole = roleDrafts[userId] ?? currentRole
    if (!nextRole || nextRole === currentRole) return
    setSavingUserId(userId)
    try {
      await onUpdateUserRole(userId, nextRole)
      setRoleDrafts((prev) => ({ ...prev, [userId]: '' }))
    } finally {
      setSavingUserId('')
    }
  }

  return (
    <section className="mt-8">
      <Motion.div
        className="glass-card rounded-3xl p-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-300/80">Admin Control Center</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Users And Role Management</h3>
            <p className="mt-1 text-sm text-slate-300">Promote users to admin or downgrade admin access securely.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right">
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-cyan-200/90">Admins</p>
              <p className="text-lg font-semibold text-cyan-100">{adminCount}</p>
            </div>
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-emerald-200/90">Users</p>
              <p className="text-lg font-semibold text-emerald-100">{userCount}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950/60 text-slate-300">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Current Role</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Set Role</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((row) => {
                  const selectedRole = roleDrafts[row._id] ?? row.role
                  const roleChanged = selectedRole !== row.role
                  const rowIsActor = row.username === authUser?.username
                  return (
                    <tr key={row._id} className="border-b border-white/5 bg-slate-900/20 text-slate-100">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-xs font-bold text-cyan-200">
                            {row.username.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="font-medium">{row.username}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                            row.role === 'admin'
                              ? 'border border-cyan-300/35 bg-cyan-500/15 text-cyan-200'
                              : 'border border-emerald-300/35 bg-emerald-500/15 text-emerald-200'
                          }`}
                        >
                          {row.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <select
                          className="rounded-lg border border-slate-500/45 bg-slate-900/90 px-3 py-1.5 text-xs uppercase tracking-wide text-slate-100 outline-none focus:border-cyan-300/70"
                          value={selectedRole}
                          onChange={(event) =>
                            setRoleDrafts((prev) => ({
                              ...prev,
                              [row._id]: event.target.value,
                            }))
                          }
                          disabled={rowIsActor}
                        >
                          <option value="user">USER</option>
                          <option value="admin">ADMIN</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleSaveRole(row._id, row.role)}
                            disabled={!roleChanged || savingUserId === row._id || rowIsActor}
                            className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {savingUserId === row._id ? 'Saving...' : 'Save Role'}
                          </button>
                          <button
                            onClick={() => onDeleteUser(row._id)}
                            disabled={rowIsActor}
                            className="rounded-lg border border-red-400/45 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td className="px-4 py-7 text-slate-400" colSpan={5}>
                    No users found.
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
