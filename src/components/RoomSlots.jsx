import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Users, RefreshCw, Lock, Check, CalendarCheck, Send, ShieldAlert, Info, Trash2, Clock, User, Mail, Briefcase, FileText, Hourglass, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Sheet, Toast, PageHeader, Badge, ErrorState } from './ui'
import { STAFF_NEEDS_APPROVAL, BOOKING_WINDOW_DAYS } from '../lib/config'
import { STANDARD_REQUEST_REASON, CANCELLATION_REASON, OVERRIDDEN_REASON, isStandardRequest, cleanPurpose, notifyAdminOfCancellation } from '../lib/bookingRequests'
import {
  usePeriods, getSlotState, periodsCovering, runsToWindows, spanLabel, countLabel,
  toDateStr, addDays, dayBounds, fmt12, fmtRange, fmtIsoTime, fmtLongDate,
} from '../lib/schedule'

const PROFILE_COLS = 'id, full_name, designation, email'

// ----- one period tile ------------------------------------------------------
const TILE = {
  available: 'bg-emerald-100 text-emerald-950 border-emerald-700 shadow-elev-green hover:bg-emerald-200',
  selected: 'bg-brand-700 text-white border-brand-900 shadow-elev-blue',
  booked: 'bg-red-600 text-white border-red-900 shadow-elev-red hover:bg-red-700',
  pending: 'bg-amber-100 text-amber-950 border-amber-700 shadow-elev-amber hover:bg-amber-200',
  ended: 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed',
}

function PeriodTile({ period, state, selected, mine, onClick }) {
  const key = selected ? 'selected' : state.status
  const label = { available: 'Free', selected: 'Selected', booked: mine ? 'Yours' : 'Booked', pending: 'Requested', ended: 'Ended' }[key]
  const a11y = `Period ${period.no}, ${fmtRange(period)}, ${label}`
  return (
    <button
      type="button"
      disabled={state.status === 'ended'}
      onClick={onClick}
      aria-label={a11y}
      aria-pressed={state.status === 'available' ? selected : undefined}
      className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[98px] px-1 py-2 rounded-2xl border-[1.5px] transition select-none active:translate-y-[3px] active:shadow-elev-press focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${TILE[key]}`}
    >
      {state.live && state.status !== 'ended' && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-current animate-live-pulse" title="Running now" />
      )}
      <span className="text-lg font-extrabold leading-none">P{period.no}</span>
      <span className="text-[10px] leading-tight font-semibold opacity-90 text-center">
        {fmt12(period.start)}
        <br />
        {fmt12(period.end)}
      </span>
      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold leading-none">
        {key === 'selected' && <Check className="w-3 h-3" />}
        {key === 'ended' && <Lock className="w-3 h-3" />}
        {label}
      </span>
    </button>
  )
}

const Legend = () => (
  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-slate-700">
    {[
      ['bg-emerald-300 border-emerald-800', 'Free'],
      ['bg-red-600 border-red-900', 'Booked'],
      ['bg-brand-700 border-brand-900', 'Selected'],
      ['bg-amber-300 border-amber-800', 'Requested'],
      ['bg-slate-200 border-slate-400', 'Ended'],
    ].map(([c, l]) => (
      <span key={l} className="inline-flex items-center gap-1.5">
        <span className={`w-3.5 h-3.5 rounded border-[1.5px] ${c}`} /> {l}
      </span>
    ))}
  </div>
)

const InfoRow = ({ icon: Icon, label, children }) => (
  <div className="flex gap-3 py-2.5 border-b border-slate-100 last:border-0">
    <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-bold text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-900 break-words">{children}</div>
    </div>
  </div>
)

export default function RoomSlots({ room, department, onBack }) {
  const { user, isAdmin } = useAuth()
  const periods = usePeriods()

  const [dateStr, setDateStr] = useState(toDateStr())
  const [bookings, setBookings] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [now, setNow] = useState(new Date())
  const [selected, setSelected] = useState([]) // period numbers

  const [sheet, setSheet] = useState(null) // 'confirm' | 'booked' | 'override' | 'pending'
  const [focusSlot, setFocusSlot] = useState(null) // slot state that was tapped
  const [reason, setReason] = useState('')
  const [overridePeriods, setOverridePeriods] = useState([])
  const [overrideReason, setOverrideReason] = useState('')
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const stripRef = useRef(null)

  const today = toDateStr(now)
  const isToday = dateStr === today
  const staffRequests = !isAdmin && STAFF_NEEDS_APPROVAL

  // Clock: slots flip from red -> ended by themselves, no reset needed
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setFetchError(null)
      const { start, end } = dayBounds(dateStr)
      try {
        let { data: b, error } = await supabase
          .from('bookings')
          .select(`*, profiles(${PROFILE_COLS})`)
          .eq('room_id', room.id)
          .lt('start_time', end.toISOString())
          .gt('end_time', start.toISOString())
          .order('start_time')
        if (error) {
          const raw = await supabase.from('bookings').select('*').eq('room_id', room.id).lt('start_time', end.toISOString()).gt('end_time', start.toISOString())
          if (raw.error) throw raw.error
          const { data: profs } = await supabase.from('profiles').select(PROFILE_COLS)
          const map = Object.fromEntries((profs || []).map((p) => [p.id, p]))
          b = (raw.data || []).map((x) => ({ ...x, profiles: map[x.user_id] }))
        }
        setBookings(b || [])

        // Pending normal requests (staff see their own; admin sees everyone's)
        const r = await supabase
          .from('override_requests')
          .select(`*, profiles:requester_id(${PROFILE_COLS})`)
          .eq('room_id', room.id)
          .eq('status', 'pending')
          .eq('priority_reason', STANDARD_REQUEST_REASON)
          .lt('start_time', end.toISOString())
          .gt('end_time', start.toISOString())
        setRequests(r.error ? [] : r.data || [])
      } catch (err) {
        console.error(err)
        if (!silent) setFetchError(err.message || 'Could not load this room.')
      } finally {
        setLoading(false)
      }
    },
    [dateStr, room.id]
  )

  useEffect(() => {
    setSelected([])
    load()
  }, [load])

  // Pick up other people's bookings without a manual refresh
  useEffect(() => {
    const t = setInterval(() => load(true), 60000)
    const onFocus = () => load(true)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [load])

  const states = useMemo(
    () => periods.map((p) => getSlotState({ dateStr, period: p, bookings, requests, now })),
    [periods, dateStr, bookings, requests, now]
  )

  // Drop selections that stopped being free (period ended / someone booked it)
  useEffect(() => {
    setSelected((sel) => sel.filter((n) => states[n - 1]?.status === 'available'))
  }, [states])

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today])
  const maxDate = addDays(today, BOOKING_WINDOW_DAYS)
  const freeCount = states.filter((s) => s.status === 'available').length

  // ---- tile taps -----------------------------------------------------------
  const onTile = (period, state) => {
    if (state.status === 'available') {
      setSelected((sel) => (sel.includes(period.no) ? sel.filter((n) => n !== period.no) : [...sel, period.no].sort((a, b) => a - b)))
    } else if (state.status === 'booked') {
      setFocusSlot(state)
      setConfirmCancel(false)
      setSheet('booked')
    } else if (state.status === 'pending') {
      setFocusSlot(state)
      setSheet('pending')
    }
  }

  const closeSheet = () => {
    setSheet(null)
    setFormError(null)
    setConfirmCancel(false)
  }

  const bookerOf = (booking) => ({
    name: booking?.profiles?.full_name || 'Faculty member',
    id: booking?.profiles?.email || '—',
    role: booking?.profiles?.designation || 'Staff',
  })

  // ---- book / request selected periods ------------------------------------
  const openConfirm = () => {
    setReason('')
    setFormError(null)
    setSheet('confirm')
  }

  const hasConflict = async (windows) => {
    for (const w of windows) {
      const { data, error } = await supabase.from('bookings').select('id').eq('room_id', room.id).lt('start_time', w.end.toISOString()).gt('end_time', w.start.toISOString()).limit(1)
      if (error) throw error
      if (data?.length) return true
    }
    return false
  }

  const submitBooking = async (e) => {
    e.preventDefault()
    if (!reason.trim()) return setFormError('Enter a reason for the booking.')
    if (!selected.length) return setFormError('Select at least one free period.')
    const windows = runsToWindows(dateStr, selected, periods)
    if (windows.some((w) => w.end <= new Date())) return setFormError('One of these periods has already ended. Pick another.')

    setBusy(true)
    setFormError(null)
    try {
      if (await hasConflict(windows)) {
        setFormError('Someone just booked one of these periods. The grid has been refreshed.')
        setSelected([])
        load(true)
        return
      }

      if (staffRequests) {
        const rows = windows.map((w) => ({
          room_id: room.id, requester_id: user.id, purpose: reason.trim(), priority_reason: STANDARD_REQUEST_REASON,
          start_time: w.start.toISOString(), end_time: w.end.toISOString(), status: 'pending',
        }))
        const { error } = await supabase.from('override_requests').insert(rows)
        if (error) throw error
        setFeedback({ type: 'success', message: `Request for ${spanLabel(selected)} sent to the admin. Track it in My Bookings.` })
      } else {
        const rows = windows.map((w) => ({
          room_id: room.id, user_id: user.id, purpose: reason.trim(),
          start_time: w.start.toISOString(), end_time: w.end.toISOString(),
        }))
        const { error } = await supabase.from('bookings').insert(rows)
        if (error) {
          if (error.code === '23P01' || /overlap|exclude/i.test(error.message || '')) {
            setFormError('Someone just booked one of these periods. The grid has been refreshed.')
            setSelected([])
            load(true)
            return
          }
          throw error
        }
        setFeedback({ type: 'success', message: `${room.name} booked for ${spanLabel(selected)}.` })
      }
      setSelected([])
      closeSheet()
      load(true)
    } catch (err) {
      console.error(err)
      setFormError(err.message || 'Could not save the booking.')
    } finally {
      setBusy(false)
    }
  }

  // ---- cancel a booking (own, or admin) ------------------------------------
  const cancelBooking = async () => {
    const booking = focusSlot?.booking
    if (!booking) return
    setBusy(true)
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', booking.id)
      if (error) throw error
      if (!isAdmin && booking.user_id === user.id) await notifyAdminOfCancellation(booking, user.id)
      setFeedback({ type: 'success', message: isAdmin ? 'Booking cancelled. Its periods are free again.' : 'Booking cancelled and the admin has been told.' })
      closeSheet()
      load(true)
    } catch (err) {
      setFeedback({ type: 'error', message: `Could not cancel: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  const withdrawRequest = async () => {
    const req = focusSlot?.request
    if (!req) return
    setBusy(true)
    try {
      const { error } = await supabase.from('override_requests').delete().eq('id', req.id)
      if (error) throw error
      setFeedback({ type: 'success', message: 'Your request was withdrawn.' })
      closeSheet()
      load(true)
    } catch (err) {
      setFeedback({ type: 'error', message: `Could not withdraw: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  // ---- emergency override request -----------------------------------------
  const openOverride = () => {
    const booking = focusSlot.booking
    const covered = periodsCovering(booking, dateStr, periods).map((p) => p.no)
    setOverridePeriods(covered.filter((n) => states[n - 1]?.status !== 'ended'))
    setReason('')
    setOverrideReason('')
    setFormError(null)
    setSheet('override')
  }

  const toggleOverridePeriod = (no) =>
    setOverridePeriods((cur) => (cur.includes(no) ? cur.filter((n) => n !== no) : [...cur, no].sort((a, b) => a - b)))

  const submitOverride = async (e) => {
    e.preventDefault()
    if (!overridePeriods.length) return setFormError('Choose the periods you need.')
    if (!reason.trim()) return setFormError('Say what the room is needed for.')
    if (!overrideReason.trim()) return setFormError('Explain why this is an emergency.')
    const pr = overrideReason.trim()
    if ([STANDARD_REQUEST_REASON, CANCELLATION_REASON, OVERRIDDEN_REASON].includes(pr)) return setFormError('Write your own emergency reason.')

    setBusy(true)
    setFormError(null)
    try {
      const rows = runsToWindows(dateStr, overridePeriods, periods).map((w) => ({
        room_id: room.id, requester_id: user.id, purpose: reason.trim(), priority_reason: pr,
        start_time: w.start.toISOString(), end_time: w.end.toISOString(), status: 'pending',
      }))
      const { error } = await supabase.from('override_requests').insert(rows)
      if (error) throw error
      setFeedback({ type: 'success', message: 'Emergency request sent. The admin will compare it with the current booking and decide.' })
      closeSheet()
    } catch (err) {
      setFormError(err.message || 'Could not send the request.')
    } finally {
      setBusy(false)
    }
  }

  // ---- derived values for sheets -------------------------------------------
  const booking = focusSlot?.booking
  const bookedNos = booking ? periodsCovering(booking, dateStr, periods).map((p) => p.no) : []
  const bookedByMe = booking?.user_id === user.id
  const selWindows = selected.length ? runsToWindows(dateStr, selected, periods) : []
  const selLabel = selected.length ? `${countLabel(selected.length)} · ${spanLabel(selected)}` : ''

  const liveIdx = states.findIndex((s) => s.live)

  return (
    <div>
      <Toast feedback={feedback} onClose={() => setFeedback(null)} />

      <PageHeader
        onBack={onBack}
        backLabel={department.code + ' rooms'}
        title={room.name}
        subtitle={`${department.name} · ${room.type === 'Room' ? 'Classroom' : room.type} · ${room.capacity} seats`}
        actions={
          <button type="button" onClick={() => load()} disabled={loading} className="btn-secondary btn-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      {/* Date strip */}
      <div className="elev p-3 sm:p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-extrabold text-slate-900">{isToday ? 'Today' : fmtLongDate(dateStr)}</div>
          <input
            type="date"
            aria-label="Pick another date"
            value={dateStr}
            min={today}
            max={maxDate}
            onChange={(e) => e.target.value && e.target.value >= today && setDateStr(e.target.value)}
            className="input !min-h-[40px] !w-auto !py-1.5 text-sm font-semibold"
          />
        </div>
        <div ref={stripRef} className="-mx-1 px-1 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-1">
            {days.map((d) => {
              const dt = new Date(`${d}T00:00:00`)
              const active = d === dateStr
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDateStr(d)}
                  aria-pressed={active}
                  className={`w-[58px] py-2 rounded-xl border-[1.5px] text-center transition ${active ? 'bg-brand-700 text-white border-brand-900 shadow-elev-blue' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-800'}`}
                >
                  <div className="text-[10px] font-bold opacity-80">{dt.toLocaleDateString([], { weekday: 'short' })}</div>
                  <div className="text-lg font-extrabold leading-tight">{dt.getDate()}</div>
                  <div className="text-[10px] font-bold opacity-80">{dt.toLocaleDateString([], { month: 'short' })}</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="elev p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">8 periods</h2>
            <p className="text-xs text-slate-500">
              {isToday && liveIdx >= 0 ? `Period ${periods[liveIdx].no} is running now. ` : ''}
              {freeCount} free · tap green to select, tap red to see who booked it.
            </p>
          </div>
          <Legend />
        </div>

        {fetchError ? (
          <ErrorState title="Could not load periods" text={fetchError} onRetry={() => load()} />
        ) : (
          <div className={`grid grid-cols-4 md:grid-cols-8 gap-2.5 sm:gap-3 ${loading ? 'opacity-60' : ''}`}>
            {periods.map((p, i) => (
              <PeriodTile
                key={p.no}
                period={p}
                state={states[i]}
                selected={selected.includes(p.no)}
                mine={states[i].booking?.user_id === user.id}
                onClick={() => onTile(p, states[i])}
              />
            ))}
          </div>
        )}

        {isToday && states.some((s) => s.status === 'ended') && (
          <p className="mt-4 text-xs text-slate-500 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            Periods that have ended are locked. Booked slots turn back to normal on their own once the period is over.
          </p>
        )}
      </div>

      {selected.length > 0 && <div className="h-28" aria-hidden="true" />}

      {/* Sticky action bar */}
      {selected.length > 0 && (
        <div className="fixed inset-x-0 z-40 px-3 bottom-[calc(64px+env(safe-area-inset-bottom)+8px)] md:bottom-4">
          <div className="max-w-3xl mx-auto elev p-3 flex items-center gap-3 animate-sheet-up">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-slate-900 truncate">{selLabel}</div>
              <div className="text-xs text-slate-500 truncate">
                {selWindows.map((w) => `${fmtIsoTime(w.start.toISOString())} – ${fmtIsoTime(w.end.toISOString())}`).join(' · ')}
              </div>
            </div>
            <button type="button" onClick={() => setSelected([])} className="btn-secondary btn-sm" aria-label="Clear selection"><X className="w-4 h-4" /></button>
            <button type="button" onClick={openConfirm} className="btn-primary">
              <CalendarCheck className="w-4 h-4" /> {staffRequests ? 'Request' : 'Book'}
            </button>
          </div>
        </div>
      )}

      {/* ---- Confirm booking / request ---- */}
      <Sheet
        open={sheet === 'confirm'}
        onClose={closeSheet}
        icon={CalendarCheck}
        title={staffRequests ? 'Send booking request' : 'Confirm booking'}
        subtitle={`${room.name} · ${fmtLongDate(dateStr)}`}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={closeSheet} className="btn-secondary flex-1">Back</button>
            <button type="submit" form="book-form" disabled={busy} className="btn-primary flex-[2]">
              <Send className="w-4 h-4" /> {busy ? 'Sending...' : staffRequests ? 'Send request' : 'Confirm booking'}
            </button>
          </div>
        }
      >
        <form id="book-form" onSubmit={submitBooking} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-brand-50 border-[1.5px] border-brand-300">
            <div className="text-sm font-extrabold text-brand-900">{selLabel}</div>
            <ul className="mt-1.5 space-y-0.5 text-xs text-brand-900/80 font-semibold">
              {selected.map((n) => (<li key={n}>P{n} · {fmtRange(periods[n - 1])}</li>))}
            </ul>
          </div>
          <div>
            <label className="field-label">Reason for booking</label>
            <textarea className="input" rows={3} required autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Data Structures lab, guest lecture, department meeting" />
          </div>
          {staffRequests && (
            <p className="text-xs text-slate-600 flex gap-2"><Hourglass className="w-4 h-4 shrink-0 text-amber-600" /> These periods stay free for others until the admin approves your request.</p>
          )}
          {formError && <p role="alert" className="p-3 rounded-xl bg-red-50 border-[1.5px] border-red-700 text-sm font-semibold text-red-900">{formError}</p>}
        </form>
      </Sheet>

      {/* ---- Booked slot details ---- */}
      <Sheet
        open={sheet === 'booked' && !!booking}
        onClose={closeSheet}
        icon={Info}
        tone="red"
        title={`Booked · ${room.name}`}
        subtitle={fmtLongDate(dateStr)}
        footer={
          confirmCancel ? (
            <div>
              <p className="text-sm font-bold text-slate-900 mb-3">Cancel this booking for all {countLabel(bookedNos.length)}?</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setConfirmCancel(false)} className="btn-secondary flex-1">Keep it</button>
                <button type="button" onClick={cancelBooking} disabled={busy} className="btn-danger flex-1">{busy ? 'Cancelling...' : 'Yes, cancel'}</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              {(bookedByMe || isAdmin) && (
                <button type="button" onClick={() => setConfirmCancel(true)} className="btn-secondary flex-1 text-red-700 border-red-700">
                  <Trash2 className="w-4 h-4" /> Cancel booking
                </button>
              )}
              {!bookedByMe && !isAdmin && (
                <button type="button" onClick={openOverride} className="btn-amber flex-1">
                  <ShieldAlert className="w-4 h-4" /> Request override
                </button>
              )}
              <button type="button" onClick={closeSheet} className="btn-secondary flex-1">Close</button>
            </div>
          )
        }
      >
        {booking && (
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge tone="red">{countLabel(bookedNos.length)} · {spanLabel(bookedNos)}</Badge>
              {bookedByMe && <Badge tone="blue">Your booking</Badge>}
            </div>
            <InfoRow icon={User} label="Booked by">{bookerOf(booking).name}</InfoRow>
            <InfoRow icon={Mail} label="Email / ID">{bookerOf(booking).id}</InfoRow>
            <InfoRow icon={Briefcase} label="Department / role">{bookerOf(booking).role}</InfoRow>
            <InfoRow icon={Clock} label="Periods booked">
              {countLabel(bookedNos.length)} ({spanLabel(bookedNos)})
              <div className="text-xs text-slate-500 font-semibold">{fmtIsoTime(booking.start_time)} – {fmtIsoTime(booking.end_time)}</div>
            </InfoRow>
            <InfoRow icon={FileText} label="Reason">{cleanPurpose(booking.purpose)}</InfoRow>
            {!bookedByMe && !isAdmin && (
              <p className="mt-3 text-xs text-slate-500">Is this an emergency? Use Request override. The admin compares both bookings and decides.</p>
            )}
          </div>
        )}
      </Sheet>

      {/* ---- Emergency override request ---- */}
      <Sheet
        open={sheet === 'override' && !!booking}
        onClose={closeSheet}
        icon={ShieldAlert}
        tone="amber"
        title="Emergency override request"
        subtitle={`${room.name} · ${fmtLongDate(dateStr)}`}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={closeSheet} className="btn-secondary flex-1">Back</button>
            <button type="submit" form="override-form" disabled={busy} className="btn-amber flex-[2]">
              <Send className="w-4 h-4" /> {busy ? 'Sending...' : 'Send to admin'}
            </button>
          </div>
        }
      >
        {booking && (
          <form id="override-form" onSubmit={submitOverride} className="space-y-4">
            <div className="p-3 rounded-xl bg-red-50 border-[1.5px] border-red-300 text-xs text-red-950">
              <strong>Currently booked:</strong> {bookerOf(booking).name} · {spanLabel(bookedNos)} · {cleanPurpose(booking.purpose)}
            </div>
            <div>
              <label className="field-label">Periods you need</label>
              <div className="grid grid-cols-4 gap-2">
                {periods.map((p, i) => {
                  const ended = states[i].status === 'ended'
                  const on = overridePeriods.includes(p.no)
                  return (
                    <button
                      key={p.no}
                      type="button"
                      disabled={ended}
                      aria-pressed={on}
                      onClick={() => toggleOverridePeriod(p.no)}
                      className={`min-h-[48px] rounded-xl border-[1.5px] text-sm font-extrabold transition ${
                        ended ? 'bg-slate-100 text-slate-300 border-slate-200' : on ? 'bg-amber-400 text-slate-900 border-amber-900 shadow-elev-amber' : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      P{p.no}
                    </button>
                  )
                })}
              </div>
              {overridePeriods.length > 0 && <p className="mt-2 text-xs font-bold text-slate-600">{countLabel(overridePeriods.length)} · {spanLabel(overridePeriods)}</p>}
            </div>
            <div>
              <label className="field-label">What do you need the room for?</label>
              <input className="input" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. University practical exam" />
            </div>
            <div>
              <label className="field-label">Why is it an emergency?</label>
              <textarea className="input" rows={3} required value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. Exam moved here at short notice. The original room is flooded." />
            </div>
            {formError && <p role="alert" className="p-3 rounded-xl bg-red-50 border-[1.5px] border-red-700 text-sm font-semibold text-red-900">{formError}</p>}
          </form>
        )}
      </Sheet>

      {/* ---- Pending request details ---- */}
      <Sheet
        open={sheet === 'pending' && !!focusSlot?.request}
        onClose={closeSheet}
        icon={Hourglass}
        tone="amber"
        title="Waiting for admin approval"
        subtitle={`${room.name} · ${fmtLongDate(dateStr)}`}
        footer={
          <div className="flex gap-3">
            {focusSlot?.request?.requester_id === user.id && (
              <button type="button" onClick={withdrawRequest} disabled={busy} className="btn-secondary flex-1 text-red-700 border-red-700">{busy ? 'Withdrawing...' : 'Withdraw request'}</button>
            )}
            <button type="button" onClick={closeSheet} className="btn-secondary flex-1">Close</button>
          </div>
        }
      >
        {focusSlot?.request && (
          <div>
            <InfoRow icon={User} label="Requested by">{focusSlot.request.profiles?.full_name || 'You'}</InfoRow>
            <InfoRow icon={Clock} label="Time">{fmtIsoTime(focusSlot.request.start_time)} – {fmtIsoTime(focusSlot.request.end_time)}</InfoRow>
            <InfoRow icon={FileText} label="Reason">{focusSlot.request.purpose}</InfoRow>
            {isAdmin && <p className="mt-3 text-xs text-slate-500">Decide on it in Admin &gt; Booking requests.</p>}
          </div>
        )}
      </Sheet>
    </div>
  )
}
