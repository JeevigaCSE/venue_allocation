import React, { useState, useEffect, useMemo } from 'react'
import {
  CalendarDays,
  Clock,
  DoorOpen,
  Building2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  CalendarCheck,
  ShieldAlert,
  ArrowRight,
  Filter
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isStandardRequest, isCancellationNotice, cleanPurpose, notifyAdminOfCancellation } from '../lib/bookingRequests'
import { useAuth } from '../context/AuthContext'

// Helper: format ISO date to readable string (e.g., "Nov 22, 2026")
const formatDisplayDate = (isoString) => {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Helper: format time (e.g., "10:00 AM")
const formatDisplayTime = (isoString) => {
  if (!isoString) return ''
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function MyBookingsPage({ onNavigateToDepartments }) {
  const { user, isAdmin } = useAuth()

  const [activeTab, setActiveTab] = useState('upcoming') // 'upcoming' | 'pending' | 'past' | 'overrides'
  const [bookings, setBookings] = useState([])
  const [overrides, setOverrides] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState(null)

  // Cancel Booking modal state
  const [cancelingBooking, setCancelingBooking] = useState(null)
  const [submittingCancel, setSubmittingCancel] = useState(false)

  // Current timestamp for live status
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Auto-dismiss feedback
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Load Bookings & Overrides
  const loadMyData = async () => {
    if (!user) return
    setLoading(true)
    setFetchError(null)

    try {
      // 1. Fetch User Bookings
      const { data: bData, error: bErr } = await supabase
        .from('bookings')
        .select(`
          *,
          rooms (
            id,
            name,
            type,
            department_id,
            departments (
              id,
              name,
              code
            )
          )
        `)
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })

      if (bErr) throw bErr

      // 2. Fetch User Override Requests
      let oData = []
      try {
        const { data: overData, error: overErr } = await supabase
          .from('override_requests')
          .select(`
            *,
            rooms (
              id,
              name,
              type,
              department_id,
              departments (
                id,
                name,
                code
              )
            )
          `)
          .eq('requester_id', user.id)
          .order('created_at', { ascending: false })

        if (!overErr && overData) {
          oData = overData
        }
      } catch (oErr) {
        console.warn('Override requests table not yet initialized or empty:', oErr)
      }

      setBookings(bData || [])
      setOverrides((oData || []).filter((o) => !isCancellationNotice(o)))
    } catch (err) {
      console.error('Error loading my bookings:', err)
      setFetchError(err.message || 'Failed to load your personal bookings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMyData()
  }, [user])

  // Confirm Cancellation
  const handleConfirmCancel = async () => {
    if (!cancelingBooking) return

    setSubmittingCancel(true)
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', cancelingBooking.id)

      if (error) throw error

      // Let the admin know a staff member cancelled
      if (!isAdmin) {
        await notifyAdminOfCancellation(cancelingBooking, user.id)
      }

      setFeedback({
        type: 'success',
        message: 'Your reservation has been canceled and the admin has been notified.'
      })
      setCancelingBooking(null)
      loadMyData()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to cancel booking: ${err.message}`
      })
    } finally {
      setSubmittingCancel(false)
    }
  }

  // Filter Bookings by Upcoming vs Past
  const { upcomingBookings, pastBookings } = useMemo(() => {
    const currentTime = now.getTime()
    const upcoming = []
    const past = []

    bookings.forEach((b) => {
      const endTime = new Date(b.end_time).getTime()
      if (endTime >= currentTime) {
        upcoming.push(b)
      } else {
        past.push(b)
      }
    })

    // Sort upcoming ascending (nearest first)
    upcoming.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())

    return { upcomingBookings: upcoming, pastBookings: past }
  }, [bookings, now])

  // Filtered List based on Search and Tab
  const displayedList = useMemo(() => {
    const q = searchTerm.toLowerCase()

    if (activeTab === 'overrides' || activeTab === 'pending') {
      // 'pending' = normal booking requests not yet approved (approved ones become bookings)
      const source =
        activeTab === 'pending'
          ? overrides.filter((o) => isStandardRequest(o) && o.status !== 'approved')
          : overrides.filter((o) => !isStandardRequest(o))
      return source.filter((o) => {
        const roomName = o.rooms?.name || ''
        const deptName = o.rooms?.departments?.name || ''
        const deptCode = o.rooms?.departments?.code || ''
        return (
          o.purpose.toLowerCase().includes(q) ||
          o.priority_reason.toLowerCase().includes(q) ||
          roomName.toLowerCase().includes(q) ||
          deptName.toLowerCase().includes(q) ||
          deptCode.toLowerCase().includes(q)
        )
      })
    }

    const source = activeTab === 'upcoming' ? upcomingBookings : pastBookings
    return source.filter((b) => {
      const roomName = b.rooms?.name || ''
      const deptName = b.rooms?.departments?.name || ''
      const deptCode = b.rooms?.departments?.code || ''
      return (
        b.purpose.toLowerCase().includes(q) ||
        roomName.toLowerCase().includes(q) ||
        deptName.toLowerCase().includes(q) ||
        deptCode.toLowerCase().includes(q)
      )
    })
  }, [activeTab, upcomingBookings, pastBookings, overrides, searchTerm])

  const pendingOverridesCount = overrides.filter(
    (o) => !isStandardRequest(o) && o.status === 'pending'
  ).length
  const pendingRequestsCount = overrides.filter(
    (o) => isStandardRequest(o) && o.status === 'pending'
  ).length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`mb-6 p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm transition-all shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/50 mb-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 mb-3">
              <CalendarCheck className="w-3.5 h-3.5 text-indigo-300" />
              <span>Personal Scheduling Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              My Reservations & Requests
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 leading-relaxed">
              Track your scheduled classrooms, laboratories, seminar halls, and track your booking requests awaiting admin approval.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 px-5 self-start md:self-auto">
            <div className="text-center px-2 border-r border-slate-700">
              <div className="text-xl font-bold text-indigo-400">{upcomingBookings.length}</div>
              <div className="text-[10px] uppercase font-semibold text-slate-400">Upcoming</div>
            </div>
            <div className="text-center px-2 border-r border-slate-700">
              <div className="text-xl font-bold text-emerald-400">{pastBookings.length}</div>
              <div className="text-[10px] uppercase font-semibold text-slate-400">Completed</div>
            </div>
            <div className="text-center px-2">
              <div className="text-xl font-bold text-amber-400">{pendingRequestsCount}</div>
              <div className="text-[10px] uppercase font-semibold text-slate-400">Pending Approval</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar: Filter Tabs & Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Navigation Tabs */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'upcoming'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Upcoming / Active</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 text-indigo-700 font-bold">
              {upcomingBookings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'pending'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Pending Requests</span>
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'past'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Past History</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
              {pastBookings.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overrides')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === 'overrides'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Override Requests</span>
            {pendingOverridesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
                {pendingOverridesCount}
              </span>
            )}
          </button>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reservations..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
          </div>

          <button
            type="button"
            onClick={loadMyData}
            disabled={loading}
            title="Reload personal bookings"
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading your reservations...</p>
        </div>
      ) : fetchError ? (
        <div className="bg-white rounded-3xl border border-red-200 p-10 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Failed to load reservations</h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mb-4">{fetchError}</p>
          <button
            type="button"
            onClick={loadMyData}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : displayedList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarCheck className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            {activeTab === 'upcoming'
              ? 'No Upcoming Reservations'
              : activeTab === 'past'
              ? 'No Past Reservations'
              : activeTab === 'pending'
              ? 'No Pending Requests'
              : 'No Override Requests'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
            {searchTerm
              ? `No bookings matched "${searchTerm}".`
              : activeTab === 'upcoming'
              ? 'You do not have any upcoming room reservations booked. Browse departments to schedule a space.'
              : activeTab === 'past'
              ? 'You have not completed any room bookings yet.'
              : activeTab === 'pending'
              ? 'You have no booking requests waiting for admin approval.'
              : 'You have not submitted any admin override requests.'}
          </p>
          {onNavigateToDepartments && activeTab === 'upcoming' && !searchTerm && (
            <button
              type="button"
              onClick={onNavigateToDepartments}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition"
            >
              <DoorOpen className="w-4 h-4" />
              <span>Browse Departments & Rooms</span>
            </button>
          )}
        </div>
      ) : (
        /* LIST OF CARDS */
        <div className="space-y-4">
          {displayedList.map((item) => {
            if (activeTab === 'overrides' || activeTab === 'pending') {
              // Request Card (pending booking requests + override requests)
              const room = item.rooms
              const dept = room?.departments
              const isStd = isStandardRequest(item)

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 transition hover:shadow-md"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {dept?.code || 'DEPT'}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {dept?.name || 'College Department'}
                        </span>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-xs text-slate-500 font-semibold">
                          {room?.name} ({room?.type})
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900">
                        {cleanPurpose(item.purpose)}
                      </h3>
                    </div>

                    {/* Status Badge */}
                    <div className="self-start sm:self-auto">
                      {item.status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>{isStd ? 'Pending Admin Approval' : 'Pending Admin Review'}</span>
                        </span>
                      )}
                      {item.status === 'approved' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{isStd ? 'Approved' : 'Override Approved'}</span>
                        </span>
                      )}
                      {item.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-800 border border-red-200">
                          <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                          <span>{isStd ? 'Rejected' : 'Override Declined'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Slot & Priority Details */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        <strong>Requested Slot:</strong> {formatDisplayDate(item.start_time)} from{' '}
                        <span className="font-mono font-semibold">
                          {formatDisplayTime(item.start_time)} – {formatDisplayTime(item.end_time)}
                        </span>
                      </span>
                    </div>
                    {!isStd && (
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>Priority Justification:</strong> {item.priority_reason}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Submitted on {new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>
              )
            }

            // Standard Booking Card
            const booking = item
            const room = booking.rooms
            const dept = room?.departments
            const isCurrentlyActive =
              new Date(booking.start_time).getTime() <= now.getTime() &&
              new Date(booking.end_time).getTime() > now.getTime()

            return (
              <div
                key={booking.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 transition hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {dept?.code || 'DEPT'}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {dept?.name || 'Department Block'}
                      </span>
                      <span className="text-slate-300">&bull;</span>
                      <span className="text-xs font-semibold text-indigo-600">
                        {room?.name || 'Room'} ({room?.type || 'Space'})
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-1">
                      {cleanPurpose(booking.purpose)}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDisplayDate(booking.start_time)}</span>
                      </span>

                      <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-800">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {formatDisplayTime(booking.start_time)} – {formatDisplayTime(booking.end_time)}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Status & Cancel Action */}
                  <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    {isCurrentlyActive ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                        <span>Active Now</span>
                      </span>
                    ) : activeTab === 'upcoming' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Upcoming
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        Completed
                      </span>
                    )}

                    {activeTab === 'upcoming' && (
                      <button
                        type="button"
                        onClick={() => setCancelingBooking(booking)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* CANCEL BOOKING CONFIRMATION MODAL */}
      {/* ===================================================================== */}
      {cancelingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-red-100 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
              Cancel Reservation?
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 text-center mb-4 leading-relaxed">
              Are you sure you want to cancel your reservation for{' '}
              <strong>"{cleanPurpose(cancelingBooking.purpose)}"</strong> scheduled on{' '}
              <span className="font-semibold">
                {formatDisplayDate(cancelingBooking.start_time)}
              </span>{' '}
              from{' '}
              <span className="font-mono font-semibold">
                {formatDisplayTime(cancelingBooking.start_time)} –{' '}
                {formatDisplayTime(cancelingBooking.end_time)}
              </span>
              ?
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setCancelingBooking(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={submittingCancel}
                onClick={handleConfirmCancel}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
              >
                {submittingCancel ? 'Canceling...' : 'Yes, Cancel Reservation'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
