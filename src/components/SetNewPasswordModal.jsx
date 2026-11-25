import React, { useState } from 'react'
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function SetNewPasswordModal() {
  const { updatePassword, signOut } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 6) return setError('Password must be at least 6 characters.')
    if (newPassword !== confirmPassword) return setError('The two passwords do not match.')
    setSubmitting(true)
    try {
      await updatePassword(newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Could not update the password. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md elev p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-50 text-brand-700 border-[1.5px] border-brand-300 rounded-2xl mb-3">
          <KeyRound className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Set a new password</h2>
        <p className="text-sm text-slate-500 mt-1">Choose a password you have not used before.</p>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3.5 rounded-xl bg-red-50 border-[1.5px] border-red-700 text-red-900 text-sm font-semibold flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-emerald-800 font-bold mb-5">
            <CheckCircle2 className="w-5 h-5" /> Password updated
          </div>
          <button type="button" onClick={() => signOut()} className="btn-primary w-full">Continue to sign in</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">New password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" className="input pl-10 pr-12" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 text-slate-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="field-label">Confirm new password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Type it again" className="input pl-10" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full min-h-[50px]">
            {submitting ? 'Saving...' : 'Save password'}
          </button>
        </form>
      )}
    </div>
  )
}
