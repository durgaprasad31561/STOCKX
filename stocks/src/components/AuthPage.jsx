import { useCallback, useEffect, useRef, useState } from 'react'
import {
  login,
  loginWithGoogle,
  register,
  requestPasswordResetOtp,
  resendEmailOtp,
  resetPasswordWithOtp,
  verifyEmailOtp,
} from '../services/api'

export function AuthPage({ onLoginSuccess }) {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
  const googleButtonRef = useRef(null)
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [adminAccessKey, setAdminAccessKey] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotStep, setForgotStep] = useState('request')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleReady, setIsGoogleReady] = useState(false)
  const isDefaultAdminAttempt = username === 'DurgaPrasad' && password === '2300031561'

  const handleGoogleCredential = useCallback(
    async (response) => {
      const idToken = response?.credential
      if (!idToken) return
      setError('')
      setMessage('')
      setIsLoading(true)
      try {
        const payload = await loginWithGoogle(idToken)
        onLoginSuccess(payload)
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    },
    [onLoginSuccess],
  )

  useEffect(() => {
    if (!googleClientId) return
    if (window.google?.accounts?.id) {
      setIsGoogleReady(true)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => setIsGoogleReady(true)
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [googleClientId])

  useEffect(() => {
    if (!isGoogleReady || !['login', 'register'].includes(mode)) return
    if (!googleButtonRef.current || !window.google?.accounts?.id) return

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    })

    googleButtonRef.current.innerHTML = ''
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'outline',
      size: 'large',
      text: mode === 'register' ? 'signup_with' : 'signin_with',
      shape: 'pill',
      width: 320,
    })
  }, [googleClientId, handleGoogleCredential, isGoogleReady, mode])

  function openForgotPassword() {
    setMode('forgot')
    setForgotStep('request')
    setForgotOtp('')
    setForgotNewPassword('')
    setForgotEmail(email || '')
    setError('')
    setMessage('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsLoading(true)
    try {
      if (mode === 'register') {
        await register({
          username,
          email,
          password,
        })
        setMode('verify')
        setPendingVerificationEmail(email)
        setAdminAccessKey('')
        setOtp('')
        setPassword('')
        setMessage('Registration successful. OTP has been sent to your email.')
      } else if (mode === 'verify') {
        await verifyEmailOtp(pendingVerificationEmail || email, otp)
        setMode('login')
        setOtp('')
        setMessage('Email verified successfully. You can login now.')
      } else if (mode === 'forgot') {
        if (forgotStep === 'request') {
          await requestPasswordResetOtp(forgotEmail)
          setForgotStep('reset')
          setMessage('OTP sent. Enter OTP and new password to reset.')
        } else {
          await resetPasswordWithOtp(forgotEmail, forgotOtp, forgotNewPassword)
          setMode('login')
          setForgotStep('request')
          setForgotOtp('')
          setForgotNewPassword('')
          setMessage('Password reset successful. Please login with new password.')
        }
      } else {
        const payload = await login({
          username,
          password,
          adminAccessKey: isDefaultAdminAttempt ? adminAccessKey : undefined,
        })
        onLoginSuccess(payload)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const title =
    mode === 'login'
      ? 'Login'
      : mode === 'register'
        ? 'Register'
        : mode === 'verify'
          ? 'Verify Email'
          : 'Reset Password'

  const subtitle =
    mode === 'login'
      ? 'Sign in to continue your analysis workspace.'
      : mode === 'register'
        ? 'Create your account to get started.'
        : mode === 'verify'
          ? 'Enter the OTP sent to your email.'
          : forgotStep === 'request'
            ? 'Request a password reset OTP to your email.'
            : 'Enter OTP and set your new password.'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090f1f] px-4 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.18),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.15),transparent_40%)]" />
      <form onSubmit={handleSubmit} className="glass-card relative z-10 w-full max-w-md rounded-3xl p-6">
        <h1 className="text-2xl font-semibold text-white">StockSentix {title}</h1>
        <p className="mt-2 text-sm text-slate-300">{subtitle}</p>

        {['login', 'register'].includes(mode) ? (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Action</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'login', label: 'LOGIN' },
                { id: 'register', label: 'REGISTER' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    mode === item.id
                      ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-500/40 bg-slate-800/40 text-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Credentials</p>

          {['login', 'register'].includes(mode) ? (
            <label className="field-wrap">
              <span className="field-label">Username</span>
              <input
                type="text"
                className="field-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </label>
          ) : null}

          {mode === 'register' ? (
            <label className="field-wrap">
              <span className="field-label">Email</span>
              <input
                type="email"
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                required
              />
            </label>
          ) : null}

          {mode === 'verify' ? (
            <>
              <label className="field-wrap">
                <span className="field-label">Email</span>
                <input
                  type="email"
                  className="field-input"
                  value={pendingVerificationEmail || email}
                  onChange={(e) => setPendingVerificationEmail(e.target.value)}
                  placeholder="Enter registered email"
                  required
                />
              </label>
              <label className="field-wrap">
                <span className="field-label">OTP</span>
                <input
                  type="text"
                  className="field-input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  required
                />
              </label>
            </>
          ) : null}

          {mode === 'forgot' ? (
            <>
              <label className="field-wrap">
                <span className="field-label">Email</span>
                <input
                  type="email"
                  className="field-input"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter registered email"
                  required
                />
              </label>
              {forgotStep === 'reset' ? (
                <>
                  <label className="field-wrap">
                    <span className="field-label">OTP</span>
                    <input
                      type="text"
                      className="field-input"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      required
                    />
                  </label>
                  <label className="field-wrap">
                    <span className="field-label">New Password</span>
                    <input
                      type="password"
                      className="field-input"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                    />
                  </label>
                </>
              ) : null}
            </>
          ) : null}

          {['login', 'register'].includes(mode) ? (
            <>
              <label className="field-wrap">
                <span className="field-label">Password</span>
                <input
                  type="password"
                  className="field-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </label>
              {mode === 'login' ? (
                <div className="mt-1 text-right">
                  <button type="button" onClick={openForgotPassword} className="text-xs text-cyan-300 underline">
                    Forgot password?
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {mode === 'login' && isDefaultAdminAttempt ? (
            <label className="field-wrap">
              <span className="field-label">Admin Passkey (MongoDB Password)</span>
              <input
                type="password"
                className="field-input"
                value={adminAccessKey}
                onChange={(e) => setAdminAccessKey(e.target.value)}
                placeholder="Enter admin passkey"
                required
              />
            </label>
          ) : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {message}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 disabled:opacity-60"
        >
          {isLoading
            ? mode === 'login'
              ? 'Signing in...'
              : mode === 'register'
                ? 'Registering...'
                : mode === 'verify'
                  ? 'Verifying...'
                  : forgotStep === 'request'
                    ? 'Sending OTP...'
                    : 'Resetting Password...'
            : mode === 'login'
              ? 'Sign In'
              : mode === 'register'
                ? 'Register'
                : mode === 'verify'
                  ? 'Verify OTP'
                  : forgotStep === 'request'
                    ? 'Send OTP'
                    : 'Reset Password'}
        </button>

        {['login', 'register'].includes(mode) ? (
          <>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-700/60" />
              <span className="text-xs uppercase tracking-wide text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-700/60" />
            </div>
            {googleClientId ? (
              <div className="flex justify-center">
                <div ref={googleButtonRef} />
              </div>
            ) : (
              <p className="text-center text-xs text-slate-400">
                Google login is unavailable. Set <code>VITE_GOOGLE_CLIENT_ID</code>.
              </p>
            )}
          </>
        ) : null}

        {mode === 'verify' ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  setError('')
                  setMessage('')
                  await resendEmailOtp(pendingVerificationEmail || email)
                  setMessage('OTP resent successfully. Please check your email.')
                } catch (err) {
                  setError(err.message)
                }
              }}
              className="text-xs text-cyan-300 underline"
            >
              Resend OTP
            </button>
            <button type="button" onClick={() => setMode('login')} className="text-xs text-slate-300 underline">
              Back to Login
            </button>
          </div>
        ) : null}

        {mode === 'forgot' && forgotStep === 'reset' ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  setError('')
                  setMessage('')
                  await requestPasswordResetOtp(forgotEmail)
                  setMessage('OTP resent successfully. Please check your email.')
                } catch (err) {
                  setError(err.message)
                }
              }}
              className="text-xs text-cyan-300 underline"
            >
              Resend OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setForgotStep('request')
                setForgotOtp('')
                setForgotNewPassword('')
              }}
              className="text-xs text-slate-300 underline"
            >
              Change Email
            </button>
          </div>
        ) : null}

        <p className="mt-3 text-center text-xs text-slate-400">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => setMode('register')} className="text-cyan-300 underline">
                Register here
              </button>
              .
            </>
          ) : mode === 'register' ? (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')} className="text-cyan-300 underline">
                Login here
              </button>
              .
            </>
          ) : mode === 'verify' ? (
            'Use OTP sent to your registered email.'
          ) : (
            <>
              Remembered your password?{' '}
              <button type="button" onClick={() => setMode('login')} className="text-cyan-300 underline">
                Back to Login
              </button>
              .
            </>
          )}
        </p>
      </form>
    </div>
  )
}
