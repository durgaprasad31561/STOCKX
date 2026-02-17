import { useEffect, useState } from 'react'
import { AdminSearchesTable } from './components/AdminSearchesTable'
import { AdminUsersTable } from './components/AdminUsersTable'
import { ArchivePredictionsPanel } from './components/ArchivePredictionsPanel'
import { AuthPage } from './components/AuthPage'
import { ChartsSection } from './components/ChartsSection'
import { ControlPanel } from './components/ControlPanel'
import { CorrelationCard } from './components/CorrelationCard'
import { HeroSection } from './components/HeroSection'
import { HistoryTable } from './components/HistoryTable'
import { LoginEventsTable } from './components/LoginEventsTable'
import { NavBar } from './components/NavBar'
import { WorkflowInsights } from './components/WorkflowInsights'
import { emptyHistory, emptyRolling, emptyScatter, tickerTape } from './data/dashboardData'
import {
  deleteUser,
  fetchHistory,
  fetchArchivePredictions,
  fetchDataRange,
  fetchLoginEvents,
  fetchUserSearches,
  fetchUsers,
  runAnalysis,
  setAuthToken,
  updateUserRole,
} from './services/api'

function App() {
  const todayIso = new Date().toISOString().slice(0, 10)
  const [ticker, setTicker] = useState('AAPL')
  const [model, setModel] = useState('FinBERT')
  const [dateFrom, setDateFrom] = useState('2026-01-01')
  const [dateTo, setDateTo] = useState('2026-02-13')
  const [correlation, setCorrelation] = useState(0)
  const [animatedCorrelation, setAnimatedCorrelation] = useState(0)
  const [explanation, setExplanation] = useState(
    'Run analysis to compute sentiment and next-day return correlation for your selected range.',
  )
  const [sampleSize, setSampleSize] = useState(0)
  const [resultMeta, setResultMeta] = useState(null)
  const [scatterData, setScatterData] = useState(emptyScatter)
  const [rollingData, setRollingData] = useState(emptyRolling)
  const [dailySentimentRows, setDailySentimentRows] = useState([])
  const [stockReturnRows, setStockReturnRows] = useState([])
  const [educationReport, setEducationReport] = useState(null)
  const [analysisStats, setAnalysisStats] = useState(null)
  const [dataRange, setDataRange] = useState(null)
  const [historyRows, setHistoryRows] = useState(emptyHistory)
  const [loginEvents, setLoginEvents] = useState([])
  const [users, setUsers] = useState([])
  const [userSearchRows, setUserSearchRows] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [archivePredictions, setArchivePredictions] = useState(null)
  const [isArchiveLoading, setIsArchiveLoading] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const [error, setError] = useState('')
  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem('stocksentix_auth')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    setAuthToken(auth?.token || '')
  }, [auth])

  useEffect(() => {
    let frame
    let start
    const duration = 900

    const animate = (timestamp) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      setAnimatedCorrelation(progress * correlation)
      if (progress < 1) frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [correlation])

  useEffect(() => {
    if (!auth?.token) return
    async function loadHistory() {
      try {
        const [payload, rangePayload] = await Promise.all([fetchHistory(), fetchDataRange()])
        setHistoryRows(payload.rows ?? [])
        setDataRange(rangePayload?.range ?? null)
      } catch (err) {
        setError(err.message)
      }
    }
    loadHistory()
  }, [auth])

  useEffect(() => {
    if (!auth?.token || auth?.user?.role !== 'admin') return
    async function loadAdminData() {
      try {
        const [eventsPayload, usersPayload, searchesPayload] = await Promise.all([
          fetchLoginEvents(),
          fetchUsers(),
          fetchUserSearches(),
        ])
        setLoginEvents(eventsPayload.rows ?? [])
        setUsers(usersPayload.rows ?? [])
        setUserSearchRows(searchesPayload.rows ?? [])
      } catch (err) {
        setError(err.message)
      }
    }
    loadAdminData()
  }, [auth])

  function handleLoginSuccess(payload) {
    const nextAuth = { token: payload.token, user: payload.user }
    setAuth(nextAuth)
    localStorage.setItem('stocksentix_auth', JSON.stringify(nextAuth))
  }

  function handleLogout() {
    setAuth(null)
    setAuthToken('')
    localStorage.removeItem('stocksentix_auth')
    setHistoryRows([])
    setLoginEvents([])
    setUsers([])
    setUserSearchRows([])
    setScatterData([])
    setRollingData([])
    setDailySentimentRows([])
    setStockReturnRows([])
    setEducationReport(null)
    setAnalysisStats(null)
    setDataRange(null)
    setCorrelation(0)
    setAnimatedCorrelation(0)
    setSampleSize(0)
    setResultMeta(null)
    setExplanation('Run analysis to compute sentiment and next-day return correlation for your selected range.')
    setArchivePredictions(null)
    setArchiveError('')
    setError('')
  }

  async function handleDeleteUser(userId) {
    try {
      setError('')
      await deleteUser(userId)
      const usersPayload = await fetchUsers()
      setUsers(usersPayload.rows ?? [])
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUpdateUserRole(userId, role) {
    try {
      setError('')
      await updateUserRole(userId, role)
      const usersPayload = await fetchUsers()
      setUsers(usersPayload.rows ?? [])
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  async function handleRunAnalysis() {
    setError('')
    if (dateFrom > todayIso || dateTo > todayIso) {
      setError(`Future dates are not allowed. Please choose a date on or before ${todayIso}.`)
      return
    }
    if (dateFrom > dateTo) {
      setError('Date From must be earlier than or equal to Date To.')
      return
    }

    setIsRunning(true)
    try {
      const payload = await runAnalysis({ ticker, model, dateFrom, dateTo })
      setCorrelation(payload.correlation ?? 0)
      setExplanation(payload.explanation ?? 'Analysis completed.')
      setSampleSize(payload.sampleSize ?? 0)
      setResultMeta({
        resultType: payload.resultType ?? 'correlation',
        predictionLabel: payload.predictionLabel ?? null,
        threshold: payload.threshold ?? null,
      })
      setScatterData(payload.scatterData ?? [])
      setRollingData(payload.rollingCorrelation ?? [])
      setDailySentimentRows(payload.dailySentimentRows ?? [])
      setStockReturnRows(payload.stockReturnRows ?? [])
      setEducationReport(payload.educationalReport ?? null)
      setAnalysisStats(payload.stats ?? null)

      const latestHistory = await fetchHistory()
      setHistoryRows(latestHistory.rows ?? [])
      if (auth?.user?.role === 'admin') {
        const [latestEvents, latestSearches] = await Promise.all([fetchLoginEvents(), fetchUserSearches()])
        setLoginEvents(latestEvents.rows ?? [])
        setUserSearchRows(latestSearches.rows ?? [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsRunning(false)
    }
  }

  async function handleLoadArchivePredictions() {
    setArchiveError('')
    setIsArchiveLoading(true)
    try {
      const payload = await fetchArchivePredictions()
      setArchivePredictions(payload)
    } catch (err) {
      setArchiveError(err.message)
    } finally {
      setIsArchiveLoading(false)
    }
  }

  if (!auth?.token) {
    return <AuthPage onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090f1f] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_88%_20%,rgba(52,211,153,0.16),transparent_40%),radial-gradient(circle_at_40%_90%,rgba(37,99,235,0.15),transparent_45%)]" />
      <div className="ticker-track border-b border-white/10 bg-black/20 py-2 backdrop-blur-md">
        <div className="ticker-content text-xs text-slate-300 md:text-sm">
          {[...tickerTape, ...tickerTape].map((item, idx) => (
            <span key={`${item}-${idx}`} className="mx-6">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <NavBar authUser={auth.user} onLogout={handleLogout} />
        <HeroSection />

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <ControlPanel
            ticker={ticker}
            setTicker={setTicker}
            model={model}
            setModel={setModel}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            maxDate={todayIso}
            dataRange={dataRange}
            onRunAnalysis={handleRunAnalysis}
            isRunning={isRunning}
          />
          <CorrelationCard
            animatedCorrelation={animatedCorrelation}
            correlation={correlation}
            explanation={explanation}
            sampleSize={sampleSize}
            resultMeta={resultMeta}
            stats={analysisStats}
          />
        </section>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <ChartsSection sentimentVsReturn={scatterData} rollingCorrelation={rollingData} />
        <WorkflowInsights
          dailySentimentRows={dailySentimentRows}
          stockReturnRows={stockReturnRows}
          educationReport={educationReport}
        />
        <ArchivePredictionsPanel
          data={archivePredictions}
          onLoad={handleLoadArchivePredictions}
          isLoading={isArchiveLoading}
          error={archiveError}
        />
        <HistoryTable experimentHistory={historyRows} />
        {auth?.user?.role === 'admin' ? (
          <LoginEventsTable events={loginEvents} users={users} searchRows={userSearchRows} />
        ) : null}
        {auth?.user?.role === 'admin' ? (
          <AdminUsersTable
            users={users}
            onDeleteUser={handleDeleteUser}
            onUpdateUserRole={handleUpdateUserRole}
            authUser={auth.user}
          />
        ) : null}
        {auth?.user?.role === 'admin' ? <AdminSearchesTable rows={userSearchRows} /> : null}
      </div>
    </div>
  )
}

export default App
