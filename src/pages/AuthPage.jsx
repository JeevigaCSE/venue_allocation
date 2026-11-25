import React, { useState } from 'react'
import {
  Building2, Lock, Mail, User, Briefcase, AlertCircle, CheckCircle2, Eye, EyeOff,
  ArrowRight, ArrowLeft, KeyRound, CalendarCheck, Clock, ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Footer from '../components/Footer'
import { APP_CONFIG } from '../lib/config'

const DESIGNATION_PRESETS = [
  'Head of Department (HOD)', 'Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer',
  'Senior Lab Assistant', 'Lab Technician', 'System Administrator', 'Administrative Officer',
  'Department Secretary', 'Other Staff',
]

const FEATURES = [
  { icon: CalendarCheck, title: 'Book by period', text: 'Pick any of the 8 college periods for a lab or classroom.' },
  { icon: Clock, title: 'Live availability', text: 'Green is free, red is booked. Slots free up on their own when a period ends.' },
  { icon: ShieldCheck, title: 'Emergency override', text: 'Urgent need? Send the admin a priority request in a few taps.' },
]

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="relative">
        <Icon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        {children}
      </div>
    </div>
  )
}

export default function AuthPage() {
  const { signIn, signUp, resetPasswordForEmail, authError, setAuthError, authMessage, setAuthMessage } = useAuth()

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot-password'
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [resetSentSuccess, setResetSentSuccess] = useState(false)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [fullName, setFullName] = useState('')
  const [designation, setDesignation] = useState('')
  const [customDesignation, setCustomDesignation] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [forgotEmail, setForgotEmail] = useState('')

  const switchMode = (m) => {
    setMode(m)
    setAuthError(null)
    setAuthMessage(null)
    setRegistrationSuccess(false)
    setResetSentSuccess(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      setAuthError('Enter your college email and password.')
      return
    }
    setSubmitting(true)
    try {
      await signIn(loginEmail, loginPassword)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    const finalDesignation = designation === 'Other Staff' ? customDesignation.trim() : designation.trim()
    if (!fullName.trim() || !finalDesignation || !registerEmail.trim() || !registerPassword) {
      setAuthError('Fill in every field to register.')
      return
    }
    if (registerPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.')
      return
    }
    if (registerPassword !== confirmPassword) {
      setAuthError('The two passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const result = await signUp(registerEmail, registerPassword, { full_name: fullName.trim(), designation: finalDesignation })
      if (!result.error) setRegistrationSuccess(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    if (!forgotEmail.trim()) {
      setAuthError('Enter your college email address.')
      return
    }
    setSubmitting(true)
    try {
      const result = await resetPasswordForEmail(forgotEmail)
      if (!result.error) setResetSentSuccess(true)
    } finally {
      setSubmitting(false)
    }
  }

  const PasswordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 text-slate-400 hover:text-slate-700 rounded-lg"
    >
      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  )
  const pwType = showPassword ? 'text' : 'password'

  const Banner = ({ tone, children }) => (
    <div
      role="alert"
      className={`mb-4 p-3.5 rounded-xl border-[1.5px] text-sm flex items-start gap-2.5 font-semibold ${
        tone === 'error' ? 'bg-red-50 border-red-700 text-red-900' : 'bg-emerald-50 border-emerald-700 text-emerald-900'
      }`}
    >
      {tone === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  )

  const successScreen = (title, text) => (
    <div className="text-center py-4">
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-50 text-emerald-700 border-[1.5px] border-emerald-700 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600 mt-2 mb-6">{text}</p>
      <button type="button" onClick={() => switchMode('login')} className="btn-primary w-full">
        <ArrowLeft className="w-4 h-4" /> Back to sign in
      </button>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Brand panel: full height on desktop, compact header band on phones */}
        <aside className="bg-brand-800 text-white lg:w-[46%] pt-safe">
          <div className="max-w-xl mx-auto lg:mx-0 lg:ml-auto lg:max-w-none px-6 sm:px-10 lg:px-14 pt-8 pb-16 lg:py-14 lg:min-h-screen flex flex-col">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-white text-brand-800 border-[1.5px] border-slate-900 shadow-elev-sm flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </span>
              <div>
                <div className="font-extrabold text-lg leading-tight">{APP_CONFIG.appName}</div>
                <div className="text-xs text-brand-200">{APP_CONFIG.collegeName}</div>
              </div>
            </div>

            <div className="mt-8 lg:my-auto lg:py-10">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight">
                {APP_CONFIG.tagline}.
              </h1>
              <p className="mt-3 text-brand-100 text-sm sm:text-base max-w-md">
                One place for staff to check which labs and classrooms are free, reserve them, and track approvals.
              </p>
              <ul className="hidden lg:block mt-9 space-y-5 max-w-md">
                {FEATURES.map((f) => (
                  <li key={f.title} className="flex gap-3">
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-white/10 border border-white/25 flex items-center justify-center">
                      <f.icon className="w-5 h-5" />
                    </span>
                    <span>
                      <span className="block font-bold text-sm">{f.title}</span>
                      <span className="block text-sm text-brand-200">{f.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        {/* Form card: overlaps the band on phones */}
        <main className="flex-1 flex items-start lg:items-center justify-center px-4 sm:px-8 -mt-10 lg:mt-0 pb-10 lg:py-12">
          <div className="w-full max-w-md elev p-5 sm:p-8">
            {registrationSuccess ? (
              successScreen('Registration sent', authMessage || 'Your account is waiting for admin approval. You can sign in once it is approved.')
            ) : resetSentSuccess ? (
              successScreen('Check your email', authMessage || 'We sent a password reset link to your email address.')
            ) : (
              <>
                {mode !== 'forgot-password' ? (
                  <>
                    <h2 className="text-2xl font-extrabold text-slate-900">{mode === 'login' ? 'Welcome back' : 'Create staff account'}</h2>
                    <p className="text-sm text-slate-500 mt-1 mb-5">
                      {mode === 'login' ? 'Sign in with your college email.' : 'The admin will approve your account before you can sign in.'}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-xl border-[1.5px] border-slate-300 mb-5" role="tablist">
                      {[['login', 'Sign in'], ['register', 'Register']].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={mode === id}
                          onClick={() => switchMode(id)}
                          className={`min-h-[42px] rounded-lg text-sm font-bold transition ${mode === id ? 'bg-white text-brand-800 border-[1.5px] border-slate-800 shadow-elev-sm' : 'text-slate-500'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => switchMode('login')} className="btn-ghost btn-sm -ml-2 mb-2">
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <h2 className="text-2xl font-extrabold text-slate-900">Reset password</h2>
                    <p className="text-sm text-slate-500 mt-1 mb-5">Enter your email and we will send you a reset link.</p>
                  </>
                )}

                {authError && <Banner tone="error">{authError}</Banner>}
                {authMessage && !authError && <Banner tone="success">{authMessage}</Banner>}

                {mode === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <Field icon={Mail} label="College email">
                      <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="name@college.edu" className="input pl-10" />
                    </Field>
                    <Field icon={Lock} label="Password">
                      <input type={pwType} autoComplete="current-password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Your password" className="input pl-10 pr-12" />
                      {PasswordToggle}
                    </Field>
                    <div className="text-right -mt-1">
                      <button type="button" onClick={() => switchMode('forgot-password')} className="text-sm font-bold text-brand-700 hover:underline py-1">
                        Forgot password?
                      </button>
                    </div>
                    <button type="submit" disabled={submitting} className="btn-primary w-full min-h-[50px] text-base">
                      {submitting ? 'Signing in...' : (<>Sign in <ArrowRight className="w-4 h-4" /></>)}
                    </button>
                  </form>
                )}

                {mode === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <Field icon={User} label="Full name">
                      <input type="text" autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. A. Kumar" className="input pl-10" />
                    </Field>
                    <Field icon={Briefcase} label="Designation">
                      <select required value={designation} onChange={(e) => setDesignation(e.target.value)} className="input pl-10">
                        <option value="">Select designation</option>
                        {DESIGNATION_PRESETS.map((d) => (<option key={d} value={d}>{d}</option>))}
                      </select>
                    </Field>
                    {designation === 'Other Staff' && (
                      <Field icon={Briefcase} label="Your designation">
                        <input type="text" required value={customDesignation} onChange={(e) => setCustomDesignation(e.target.value)} placeholder="e.g. Librarian" className="input pl-10" />
                      </Field>
                    )}
                    <Field icon={Mail} label="College email">
                      <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} placeholder="name@college.edu" className="input pl-10" />
                    </Field>
                    <Field icon={Lock} label="Password">
                      <input type={pwType} autoComplete="new-password" required value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="At least 6 characters" className="input pl-10 pr-12" />
                      {PasswordToggle}
                    </Field>
                    <Field icon={KeyRound} label="Confirm password">
                      <input type={pwType} autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Type it again" className="input pl-10" />
                    </Field>
                    <button type="submit" disabled={submitting} className="btn-primary w-full min-h-[50px] text-base">
                      {submitting ? 'Sending...' : 'Request account'}
                    </button>
                  </form>
                )}

                {mode === 'forgot-password' && (
                  <form onSubmit={handleForgot} className="space-y-4">
                    <Field icon={Mail} label="College email">
                      <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="name@college.edu" className="input pl-10" />
                    </Field>
                    <button type="submit" disabled={submitting} className="btn-primary w-full min-h-[50px] text-base">
                      {submitting ? 'Sending...' : 'Send reset link'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
