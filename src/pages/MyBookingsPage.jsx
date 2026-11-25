import React, { useState, useEffect, useMemo } from 'react'
import { CalendarDays, Clock, DoorOpen, Trash2, Search, RefreshCw, CalendarCheck, ShieldAlert, Hourglass, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isStandardRequest, isCancellationNotice, isOverriddenNotice, cleanPurpose, notifyAdminOfCancellation } from '../lib/bookingRequests'
import { useAuth } from '../context/AuthContext'
import { Spinner, EmptyState, ErrorState, Toast, Sheet, PageHeader, Tabs, Badge } from '../components/ui'
import { usePeriods, periodsCovering, spanLabel, countLabel, toDateStr, fmtLongDate, fmtIsoTime } from '../lib/schedule'

const ROOM_SELECT = 'rooms(id, name, type, department_id, departments(id, name, code))'

export default function MyBookingsPage({ onNavigateToDepartments }) {
  const { user, isAdmin } = useAuth()
  const periods = usePeriods()

  const [activeTab, setActiveTab] = useState('upcoming') // upcoming | pending | past | overrides
  const [bookings, setBookings] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [search, setSearch] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [canceling, setCanceling] = useState(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const load = async () => {
    if (!user) return
    setLoading(true)
    setFetchError(null)
    try {
      const { data: b, error } = await supabase.from('bookings').select(`*, ${ROOM_SELECT}`).eq('user_id', user.id).order('start_time', { ascending: false })
      if (error) throw error
      const r = await supabase.from('override_requests').select(`*, ${ROOM_SELECT}`).eq('requester_id', user.id).order('created_at', { ascending: false })
      setBookings(b || [])
      setRequests((r.data || []).filter((o) => !isCancellationNotice(o) && !isOverriddenNotice(o)))
    } catch (err) {
      console.error(err)
      setFetchError(err.message || 'Could not load your bookings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [user])

  const handleCancel = async () => {
    if (!canceling) return
    setBusy(true)
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', canceling.id)
      if (error) throw error
      if (!isAdmin) await notifyAdminOfCancellation(canceling, user.id)
      setFeedback({ type: 'success', message: isAdmin ? 'Booking cancelled.' : 'Booking cancelled and the admin has been told.' })
      setCanceling(null)
      load()
    } catch (err) {
      setFeedback({ type: 'error', message: `Could not cancel: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  const { upcoming, past } = useMemo(() => {
    const t = now.getTime()
    const up = bookings.filter((b) => new Date(b.end_time).getTime() >= t).sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    return { upcoming: up, past: bookings.filter((b) => new Date(b.end_time).getTime() < t) }
  }, [bookings, now])

  const pendingReqs = requests.filter((o) => isStandardRequest(o) && o.status !== 'approved')
  const overrideReqs = requests.filter((o) => !isStandardRequest(o))
  const pendingCount = pendingReqs.filter((o) => o.status === 'pending').length
  const overrideCount = overrideReqs.filter((o) => o.status === 'pending').length

  const list = useMemo(() => {
    const q = search.toLowerCase()
    const source = activeTab === 'upcoming' ? upcoming : activeTab === 'past' ? past : activeTab === 'pending' ? pendingReqs : overrideReqs
    return source.filter(
      (o) =>
        !q ||
        [o.purpose, o.priority_reason, o.rooms?.name, o.rooms?.departments?.name, o.rooms?.departments?.code].some((v) => (v || '').toLowerCase().includes(q))
    )
  }, [activeTab, upcoming, past, pendingReqs, overrideReqs, search])

  const emptyText = {
    upcoming: ['No upcoming bookings', 'Pick a department to book a lab or classroom.'],
    pending: ['No pending requests', 'Requests waiting for the admin appear here.'],
    past: ['No past bookings', 'Finished bookings are listed here.'],
    overrides: ['No emergency requests', 'Override requests you send show up here.'],
  }[activeTab]

  const periodText = (item) => {
    const nos = periodsCovering(item, toDateStr(new Date(item.start_time)), periods).map((p) => p.no)
    return nos.length ? `${countLabel(nos.length)} · ${spanLabel(nos)}` : null
  }

  const statusBadge = (o) => {
    const std = isStandardRequest(o)
    if (o.status === 'pending') return <Badge tone="amber"><Hourglass className="w-3 h-3" /> {std ? 'Waiting for admin' : 'Admin reviewing'}</Badge>
    if (o.status === 'approved') return <Badge tone="green"><CheckCircle2 className="w-3 h-3" /> {std ? 'Approved' : 'Override approved'}</Badge>
    return <Badge tone="red"><XCircle className="w-3 h-3" /> {std ? 'Rejected' : 'Override rejected'}</Badge>
  }

  return (
    <div>
      <Toast feedback={feedback} onClose={() => setFeedback(null)} />
      <PageHeader title="My bookings" subtitle="Your reservations and the requests waiting for a decision." />

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[['Upcoming', upcoming.length, 'text-brand-700'], ['Pending', pendingCount, 'text-amber-600'], ['Completed', past.length, 'text-emerald-700']].map(([l, n, c]) => (
          <div key={l} className="elev-sm p-3 text-center">
            <div className={`text-2xl font-extrabold ${c}`}>{n}</div>
            <div className="text-[11px] font-bold text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3 mb-5">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'upcoming', label: 'Upcoming', count: 0 },
            { id: 'pending', label: 'Requests', count: pendingCount },
            { id: 'overrides', label: 'Emergency', count: overrideCount },
            { id: 'past', label: 'History', count: 0 },
          ]}
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="search" className="input pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bookings" />
          </div>
          <button type="button" onClick={load} disabled={loading} aria-label="Refresh" className="btn-secondary w-[46px] px-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading your bookings..." />
      ) : fetchError ? (
        <ErrorState title="Could not load bookings" text={fetchError} onRetry={load} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={search ? 'No matches' : emptyText[0]}
          text={search ? `Nothing matched "${search}".` : emptyText[1]}
          action={activeTab === 'upcoming' && !search && onNavigateToDepartments && (<button type="button" onClick={onNavigateToDepartments} className="btn-primary"><DoorOpen className="w-4 h-4" /> Browse rooms</button>)}
        />
      ) : (
        <div className="space-y-4">
          {list.map((item) => {
            const isReq = activeTab === 'pending' || activeTab === 'overrides'
            const room = item.rooms
            const dept = room?.departments
            const live = !isReq && new Date(item.start_time) <= now && new Date(item.end_time) > now
            const pt = periodText(item)
            return (
              <div key={item.id} className="elev p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-brand-700 text-white text-xs font-extrabold">{dept?.code || 'DEPT'}</span>
                  <span className="text-sm font-bold text-slate-800">{room?.name || 'Room'}</span>
                  <span className="ml-auto">
                    {isReq ? statusBadge(item) : live ? <Badge tone="red"><span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-live-pulse" /> In progress</Badge> : activeTab === 'upcoming' ? <Badge tone="blue">Upcoming</Badge> : <Badge>Completed</Badge>}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-900">{cleanPurpose(item.purpose)}</h3>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-slate-400" />{fmtLongDate(toDateStr(new Date(item.start_time)))}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" />{fmtIsoTime(item.start_time)} – {fmtIsoTime(item.end_time)}</span>
                  {pt && <span className="font-extrabold text-brand-800">{pt}</span>}
                </div>
                {activeTab === 'overrides' && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-50 border-[1.5px] border-amber-600 text-xs text-amber-950 flex gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span><strong>Emergency reason:</strong> {item.priority_reason}</span>
                  </div>
                )}
                {activeTab === 'upcoming' && (
                  <div className="mt-3 flex justify-end">
                    <button type="button" onClick={() => setCanceling(item)} className="btn-secondary btn-sm text-red-700 border-red-700"><Trash2 className="w-3.5 h-3.5" /> Cancel booking</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Sheet
        open={!!canceling}
        onClose={() => setCanceling(null)}
        icon={Trash2}
        tone="red"
        title="Cancel this booking?"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setCanceling(null)} className="btn-secondary flex-1">Keep it</button>
            <button type="button" onClick={handleCancel} disabled={busy} className="btn-danger flex-1">{busy ? 'Cancelling...' : 'Yes, cancel'}</button>
          </div>
        }
      >
        {canceling && (
          <p className="text-sm text-slate-700">
            <strong>{cleanPurpose(canceling.purpose)}</strong> in {canceling.rooms?.name} on {fmtLongDate(toDateStr(new Date(canceling.start_time)))}, {fmtIsoTime(canceling.start_time)} – {fmtIsoTime(canceling.end_time)}. The periods become free for others.
          </p>
        )}
      </Sheet>
    </div>
  )
}
