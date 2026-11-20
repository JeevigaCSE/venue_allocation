import React, { useState, useEffect } from 'react'
import {
  Shield,
  Users,
  CheckCircle,
  XCircle,
  Search,
  KeyRound,
  Mail,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  UserX,
  Clock,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Check,
  AlertCircle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function AdminPanel() {
  const { user, profile, isAdmin } = useAuth()

  const [activeSection, setActiveSection] = useState('approvals') // 'approvals' | 'security'
  
  // Users list state
  const [profiles, setProfiles] = useState([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('pending') // 'pending' | 'approved' | 'all'
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [actionFeedback, setActionFeedback] = useState(null)

  // Security settings state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState(null)

  const [newEmail, setNewEmail] = useState('')
  const [updatingEmail, setUpdatingEmail] = useState(false)
  const [emailFeedback, setEmailFeedback] = useState(null)

  // Fetch all profiles from Supabase
  const loadProfiles = async () => {
    setLoadingProfiles(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching profiles:', error)
        setActionFeedback({
          type: 'error',
          message: `Failed to load profiles: ${error.message}`
        })
      } else {
        setProfiles(data || [])
      }
    } catch (err) {
      console.error('Unexpected error loading profiles:', err)
    } finally {
      setLoadingProfiles(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadProfiles()
    }
  }, [isAdmin])

  // Toggle user approval (Approve or Revoke)
  const handleToggleApproval = async (targetUser, shouldApprove) => {
    if (targetUser.id === user.id) {
      setActionFeedback({
        type: 'error',
        message: 'Security policy: You cannot revoke or alter approval on your own active administrator account.'
      })
      return
    }

    setActionLoadingId(targetUser.id)
    setActionFeedback(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: shouldApprove })
        .eq('id', targetUser.id)

      if (error) {
        setActionFeedback({
          type: 'error',
          message: `Update failed: ${error.message}`
        })
      } else {
        // Optimistically update list
        setProfiles((prev) =>
          prev.map((p) =>
            p.id === targetUser.id ? { ...p, is_approved: shouldApprove } : p
          )
        )
        setActionFeedback({
          type: 'success',
          message: `Account for ${targetUser.full_name || targetUser.email} has been ${
            shouldApprove ? 'approved' : 'revoked'
          }.`
        })
      }
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: `An unexpected error occurred: ${err.message}`
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  // Update Admin Password
  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    setPasswordFeedback(null)

    if (newPassword.length < 6) {
      setPasswordFeedback({
        type: 'error',
        message: 'Password must be at least 6 characters in length.'
      })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        message: 'Password confirmation does not match.'
      })
      return
    }

    setUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) {
        setPasswordFeedback({
          type: 'error',
          message: error.message
        })
      } else {
        setPasswordFeedback({
          type: 'success',
          message: 'Your administrator password has been updated successfully.'
        })
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      setPasswordFeedback({
        type: 'error',
        message: err.message || 'Failed to update password.'
      })
    } finally {
      setUpdatingPassword(false)
    }
  }

  // Update Admin Login Email
  const handleEmailUpdate = async (e) => {
    e.preventDefault()
    setEmailFeedback(null)

    if (!newEmail.trim()) {
      setEmailFeedback({
        type: 'error',
        message: 'Please enter a valid email address.'
      })
      return
    }

    setUpdatingEmail(true)
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim()
      })

      if (error) {
        setEmailFeedback({
          type: 'error',
          message: error.message
        })
      } else {
        setEmailFeedback({
          type: 'success',
          message:
            'Confirmation link sent to your new email. Please check your inbox to finalize the change.'
        })
        setNewEmail('')
      }
    } catch (err) {
      setEmailFeedback({
        type: 'error',
        message: err.message || 'Failed to update email.'
      })
    } finally {
      setUpdatingEmail(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-16 p-6 bg-white rounded-2xl shadow-lg border border-red-100 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-slate-600">
          This area is designated for system administrators only. Your current role does not have authorization to view or modify security queues.
        </p>
      </div>
    )
  }

  // Compute metrics
  const pendingCount = profiles.filter((p) => p.is_approved === false).length
  const approvedCount = profiles.filter((p) => p.is_approved === true).length

  // Filtered users list
  const filteredProfiles = profiles.filter((p) => {
    const matchesFilter =
      approvalFilter === 'all'
        ? true
        : approvalFilter === 'pending'
        ? p.is_approved === false
        : p.is_approved === true

    const term = searchTerm.toLowerCase()
    const matchesSearch =
      !term ||
      (p.full_name && p.full_name.toLowerCase().includes(term)) ||
      (p.email && p.email.toLowerCase().includes(term)) ||
      (p.designation && p.designation.toLowerCase().includes(term))

    return matchesFilter && matchesSearch
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/50 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-indigo-600/90 rounded-xl shadow-lg shadow-indigo-600/30 ring-4 ring-indigo-500/20">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Administrator Control Center
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950">
                  Admin Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Manage staff authorization, account approvals, and system credentials
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 px-4">
            <div className="text-center px-2 border-r border-slate-700">
              <div className="text-lg font-bold text-amber-400">{pendingCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Pending</div>
            </div>
            <div className="text-center px-2">
              <div className="text-lg font-bold text-emerald-400">{approvedCount}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Approved</div>
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSection('approvals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeSection === 'approvals'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff Approval Queue</span>
            {pendingCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('security')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeSection === 'security'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Admin Security Settings</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: USER APPROVALS QUEUE */}
      {activeSection === 'approvals' && (
        <div className="space-y-6">
          {/* Action Feedback Notification */}
          {actionFeedback && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all ${
                actionFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {actionFeedback.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionFeedback(null)}
                className="text-xs font-semibold hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Filter Pills */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
              <button
                type="button"
                onClick={() => setApprovalFilter('pending')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  approvalFilter === 'pending'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Pending Review</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800">
                  {pendingCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setApprovalFilter('approved')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  approvalFilter === 'approved'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>Approved</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                  {approvedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setApprovalFilter('all')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  approvalFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Users ({profiles.length})
              </button>
            </div>

            {/* Search Input & Refresh Button */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, email, designation..."
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <button
                type="button"
                onClick={loadProfiles}
                disabled={loadingProfiles}
                title="Reload user list"
                className="p-2 border border-slate-300 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingProfiles ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* User List Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {loadingProfiles ? (
              <div className="py-16 text-center">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Querying profiles and authorization records...</p>
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="py-16 text-center px-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">No users found</h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1">
                  {approvalFilter === 'pending'
                    ? 'All registered staff accounts have been processed! No pending accounts in the queue.'
                    : 'No profiles matched your search and filter criteria.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th scope="col" className="px-6 py-3.5">
                        Staff Member
                      </th>
                      <th scope="col" className="px-6 py-3.5">
                        Designation
                      </th>
                      <th scope="col" className="px-6 py-3.5">
                        Email Address
                      </th>
                      <th scope="col" className="px-6 py-3.5">
                        Access Status
                      </th>
                      <th scope="col" className="px-6 py-3.5 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProfiles.map((p) => {
                      const isCurrentUser = p.id === user.id
                      const isApproved = p.is_approved === true
                      const isLoadingAction = actionLoadingId === p.id

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition">
                          {/* Staff Column */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                                {p.full_name ? p.full_name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  <span>{p.full_name || 'Unnamed Staff'}</span>
                                  {p.role === 'admin' && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      Admin
                                    </span>
                                  )}
                                  {isCurrentUser && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400">
                                  Registered {new Date(p.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Designation */}
                          <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-xs sm:text-sm font-medium">
                            {p.designation || 'Not specified'}
                          </td>

                          {/* Email */}
                          <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-xs sm:text-sm">
                            <span className="inline-flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {p.email}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                Pending Approval
                              </span>
                            )}
                          </td>

                          {/* Action Button */}
                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                            {isCurrentUser ? (
                              <span className="text-slate-400 italic text-xs">Protected (Self)</span>
                            ) : isApproved ? (
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleToggleApproval(p, false)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold transition disabled:opacity-50"
                              >
                                {isLoadingAction ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5" />
                                )}
                                <span>Revoke Access</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleToggleApproval(p, true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm transition disabled:opacity-50"
                              >
                                {isLoadingAction ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )}
                                <span>Approve</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: ADMIN SECURITY SETTINGS */}
      {activeSection === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Change Password Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Update Admin Password
                </h3>
                <p className="text-xs text-slate-500">
                  Safely reset your administrator login credentials
                </p>
              </div>
            </div>

            {passwordFeedback && (
              <div
                className={`mb-5 p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {passwordFeedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <span>{passwordFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  New Admin Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter min. 6 characters"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {updatingPassword ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Updating Password...
                    </span>
                  ) : (
                    <span>Apply New Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Change Login Email Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Administrator Login Email
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manage your primary administrative address
                  </p>
                </div>
              </div>

              {emailFeedback && (
                <div
                  className={`mb-5 p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-2.5 ${
                    emailFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  {emailFeedback.type === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{emailFeedback.message}</span>
                </div>
              )}

              <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <div className="font-semibold text-slate-700 mb-0.5">Current Active Email:</div>
                <div className="font-mono text-indigo-600">{user?.email || 'N/A'}</div>
              </div>

              <form onSubmit={handleEmailUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    New Administrator Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="admin.new@college.edu"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  Supabase security requires confirming the link sent to your new email before the transfer activates.
                </div>

                <button
                  type="submit"
                  disabled={updatingEmail}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {updatingEmail ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending Confirmation...
                    </span>
                  ) : (
                    <span>Request Email Change</span>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center">
              Account ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{user?.id}</code>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
