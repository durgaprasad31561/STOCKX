import { motion as Motion } from 'framer-motion'

export function HeroSection() {
  return (
    <section className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-blue-900/40 via-slate-900/60 to-emerald-900/30 p-8 shadow-[0_24px_80px_rgba(8,15,35,0.6)] md:p-12">
      <Motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-white md:text-5xl">
          Stock News Sentiment &amp; Market Movement Analysis
        </h1>
        <p className="mt-5 max-w-3xl text-sm text-slate-300 md:text-base">
          Quantify how headline sentiment aligns with next-day stock returns. Compare sentiment model
          signals and detect if narrative momentum is translating into market performance.
        </p>
      </Motion.div>
      <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-12 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" />
    </section>
  )
}
