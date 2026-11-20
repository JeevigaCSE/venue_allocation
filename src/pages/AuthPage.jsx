import React, { useState } from 'react'
import {
  Building2,
  Lock,
  Mail,
  User,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  KeyRound
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const DESIGNATION_PRESETS = [
  'Head of Department (HOD)',
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Lecturer',
  'Senior Lab Assistant',
  'Lab Technician',
  'System Administrator',
  'Administrative Officer',
  'Department Secretary',
  'Other Staff'
]

export default function AuthPage() {
  const {
    signIn,
    signUp,
    resetPasswordForEmail,
    authError,
    setAuthError,
    authMessage,
    setAuthMessage
  } = useAuth()

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'forgot-password'
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [resetSentSuccess, setResetSentSuccess] = useState(false)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Register form state
  const [fullName, setFullName] = useState('')
  const [designation, setDesignation] = useState('')
  const [customDesignation, setCustomDesignation] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('')

  const handleTabSwitch = (newMode) => {
    setMode(newMode)
    setAuthError(null)
    setAuthMessage(null)
    setRegistrationSuccess(false)
    setResetSentSuccess(false)
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    if (!loginEmail || !loginPassword) {
      setAuthError('Please enter both your college email and password.')
      return
    }

    setSubmitting(true)
    try {
      await signIn(loginEmail, loginPassword)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()

    const finalDesignation =
      designation === 'Other Staff' ? customDesignation.trim() : designation.trim()

    if (!fullName.trim() || !finalDesignation || !registerEmail.trim() || !registerPassword) {
      setAuthError('All registration fields are required.')
      return
    }

    if (registerPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.')
      return
    }

    if (registerPassword !== confirmPassword) {
      setAuthError('Passwords do not match. Please verify and retype.')
      return
    }

    setSubmitting(true)
    try {
      const result = await signUp(registerEmail, registerPassword, {
        full_name: fullName.trim(),
        designation: finalDesignation
      })

      if (!result.error) {
        setRegistrationSuccess(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault()
    if (!forgotEmail.trim()) {
      setAuthError('Please enter your college email address.')
      return
    }

    setSubmitting(true)
    try {
      const result = await resetPasswordForEmail(forgotEmail)
      if (!result.error) {
        setResetSentSuccess(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/90 text-white shadow-xl shadow-indigo-600/30 mb-4 ring-8 ring-indigo-500/10">
          <Building2 className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          College Department Portal
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Faculty, Staff & Room Scheduling System
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
          
          {/* Staff Access Only Warning Banner */}
          <div className="bg-amber-50 border-b border-amber-200/80 px-5 py-3 flex items-center gap-3 text-amber-900 text-xs font-medium">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              <strong>Staff & Administration Restricted:</strong> Access is limited to authorized college faculty, department staff, and administrators. Student access is not permitted.
            </span>
          </div>

          {/* Mode Switcher Tabs (Only visible when not in forgot-password view) */}
          {mode !== 'forgot-password' && (
            <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/50 p-1.5 gap-1.5">
              <button
                type="button"
                onClick={() => handleTabSwitch('login')}
                className={`py-3 text-sm font-semibold rounded-xl transition-all ${
                  mode === 'login'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleTabSwitch('register')}
                className={`py-3 text-sm font-semibold rounded-xl transition-all ${
                  mode === 'register'
                    ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                Staff Registration
              </button>
            </div>
          )}

          <div className="p-6 sm:p-8">
            {/* Feedback Alerts */}
            {authError && (
              <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold">Authentication Notice</p>
                  <p className="mt-0.5">{authError}</p>
                </div>
              </div>
            )}

            {authMessage && !authError && !registrationSuccess && !resetSentSuccess && (
              <div className="mb-6 rounded-xl bg-amber-50 p-4 border border-amber-200 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-semibold">Account Status</p>
                  <p className="mt-0.5">{authMessage}</p>
                </div>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    College Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="faculty.name@college.edu"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => handleTabSwitch('forgot-password')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying Credentials...
                    </span>
                  ) : (
                    <>
                      <span>Sign In to Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-slate-500">
                    New staff member?{' '}
                    <button
                      type="button"
                      onClick={() => handleTabSwitch('register')}
                      className="font-semibold text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300 underline-offset-2"
                    >
                      Submit registration here
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {mode === 'forgot-password' && (
              <div>
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('login')}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Reset Password
                    </h3>
                    <p className="text-xs text-slate-500">
                      Enter your institutional email to receive a recovery link
                    </p>
                  </div>
                </div>

                {resetSentSuccess ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-900 mb-2">
                      Reset Link Dispatched
                    </h4>
                    <p className="text-sm text-slate-600 max-w-sm mx-auto mb-6 leading-relaxed">
                      If an account exists for <strong className="text-slate-800">{forgotEmail}</strong>, a secure password recovery link has been sent. Click the link in your email to choose a new password.
                    </p>

                    <button
                      type="button"
                      onClick={() => handleTabSwitch('login')}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition"
                    >
                      Return to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        Registered Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          required
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="faculty.name@college.edu"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                    >
                      {submitting ? (
                        <span className="inline-flex items-center gap-2">
                          <KeyRound className="w-4 h-4 animate-spin" />
                          Sending Recovery Link...
                        </span>
                      ) : (
                        <span>Send Password Reset Link</span>
                      )}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => handleTabSwitch('login')}
                        className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 mx-auto"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Sign In</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* REGISTRATION FORM */}
            {mode === 'register' && (
              <>
                {registrationSuccess ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      Registration Submitted
                    </h3>
                    <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
                      Your staff account has been created successfully. For security reasons, college access is gated and requires administrative approval. You will be able to log in once an administrator approves your profile.
                    </p>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs text-slate-600 mb-6 space-y-1.5">
                      <p><strong>Name:</strong> {fullName}</p>
                      <p><strong>Email:</strong> {registerEmail}</p>
                      <p><strong>Designation:</strong> {designation === 'Other Staff' ? customDesignation : designation}</p>
                      <p><strong>Approval Status:</strong> <span className="text-amber-600 font-semibold">Pending Admin Review</span></p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTabSwitch('login')}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition"
                    >
                      Return to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        Full Name & Title
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g., Dr. Robert Vance"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        Academic / Staff Designation
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <select
                          required
                          value={designation}
                          onChange={(e) => setDesignation(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                        >
                          <option value="">Select your designation...</option>
                          {DESIGNATION_PRESETS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {designation === 'Other Staff' && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Specify Designation
                        </label>
                        <input
                          type="text"
                          required
                          value={customDesignation}
                          onChange={(e) => setCustomDesignation(e.target.value)}
                          placeholder="e.g., Research Associate"
                          className="w-full px-3.5 py-2 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        College / Institutional Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={registerEmail}
                          onChange={(e) => setRegisterEmail(e.target.value)}
                          placeholder="r.vance@college.edu"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Password
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={registerPassword}
                            onChange={(e) => setRegisterPassword(e.target.value)}
                            placeholder="Min 6 characters"
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                          Confirm Password
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <Lock className="w-4 h-4" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-type password"
                            className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showPassword}
                          onChange={(e) => setShowPassword(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Show password characters</span>
                      </label>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>
                        Upon registration, your account will enter the administrator review queue. Access to room booking is enabled once verified.
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600"
                    >
                      {submitting ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting Registration...
                        </span>
                      ) : (
                        <span>Submit Staff Registration</span>
                      )}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
