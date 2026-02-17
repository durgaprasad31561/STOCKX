export function NavBar({ authUser, onLogout }) {
  const isAdmin = authUser?.role === 'admin'

  return (
    <nav className="glass-card flex items-center justify-between rounded-2xl px-5 py-3">
      <div className="text-lg font-semibold tracking-wide text-white md:text-xl">
        Stock<span className="text-cyan-400">Sentix</span>
        {isAdmin ? (
          <span className="ml-2 rounded-full border border-amber-300/45 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">
            Admin
          </span>
        ) : null}
      </div>
      <div className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
        {(isAdmin ? ['Dashboard', 'Security', 'Users', 'Activity'] : ['Dashboard', 'Analysis', 'History']).map(
          (item) => (
          <button key={item} className="glow-link">
            {item}
          </button>
          ),
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden rounded-full border border-white/15 bg-slate-900/60 px-3 py-1 text-xs text-slate-200 md:block">
          {authUser?.username} ({authUser?.role})
        </div>
        <button
          className="rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-300 transition hover:shadow-[0_0_20px_rgba(56,189,248,0.35)]"
          aria-label="Logout"
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
