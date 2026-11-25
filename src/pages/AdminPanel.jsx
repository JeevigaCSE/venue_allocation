import React, { useState, useEffect } from 'react'
import {
  Users, Search, KeyRound, Mail, AlertTriangle, RefreshCw, UserCheck, UserX, Clock, ShieldAlert, CalendarDays, Lock, Eye, EyeOff,
  Check, XCircle, Timer, ShieldCheck, Hourglass, CheckCircle2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { isStandardRequest, isCancellationNotice, isOverriddenNotice, markDisplacedBookings } from '../lib/bookingRequests'
import { Spinner, EmptyState, Toast, Sheet, PageHeader, Tabs, Badge } from '../components/ui'
import ScheduleSettings from '../components/admin/ScheduleSettings'
import OverrideCompare from '../components/admin/OverrideCompare'
import { usePeriods, periodsCovering, spanLabel, countLabel, toDateStr, fmtLongDate, fmtIsoTime } from '../lib/schedule'

const REQ_SELECT = `*, profiles:requester_id(id, full_name, designation, email), rooms:room_id(id, name, type, department_id, departments(id, name, code))`

export default function AdminPanel() {
  const { user, isAdmin } = useAuth()
  const periods = usePeriods()

  const [section, setSection] = useState('requests') // requests | overrides | approvals | cancellations | schedule | security
  const [feedback, setFeedback] = useState(null)

  const [profiles, setProfiles] = useState([])
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [search, setSearch] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('pending')
  const [actionId, setActionId] = useState(null)

  const [requests, setRequests] = useState([])
  const [loadingReqs, setLoadingReqs] = useState(true)
  const [reqFilter, setReqFilter] = useState('pending')
  const [approving, setApproving] = useState(null) // { req, conflicts }
  const [busy, setBusy] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [emBusy, setEmBusy] = useState(false)

  const loadProfiles = async () => {
    setLoadingProfiles(true)
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) setFeedback({ type: 'error', message: `Could not load staff: ${error.message}` })
    else setProfiles(data || [])
    setLoadingProfiles(false)
  }

  const loadRequests = async () => {
    setLoadingReqs(true)
    try {
      let { data, error } = await supabase.from('override_requests').select(REQ_SELECT).order('created_at', { ascending: false })
      if (error) {
        const simple = await supabase.from('override_requests').select('*').order('created_at', { ascending: false })
        data = simple.data
      }
      setRequests(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingReqs(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadProfiles()
      loadRequests()
    }
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <EmptyState icon={AlertTriangle} title="Admins only" text="Your account does not have permission to open this area." />
    )
  }

  // ----- derived lists -------------------------------------------------------
  const standard = requests.filter(isStandardRequest)
  const cancellations = requests.filter(isCancellationNotice)
  const overrides = requests.filter((o) => !isStandardRequest(o) && !isCancellationNotice(o) && !isOverriddenNotice(o))
  const pendingStaff = profiles.filter((p) => p.is_approved === false).length
  const pendingStd = standard.filter((o) => o.status === 'pending').length
  const pendingOv = overrides.filter((o) => o.status === 'pending').length
  const newCancels = cancellations.filter((o) => o.status === 'pending').length

  // ----- actions -------------------------------------------------------------
  const toggleApproval = async (target, approve) => {
    if (target.id === user.id) return setFeedback({ type: 'error', message: 'You cannot change approval on your own admin account.' })
    setActionId(target.id)
    const { error } = await supabase.from('profiles').update({ is_approved: approve }).eq('id', target.id)
    if (error) setFeedback({ type: 'error', message: `Update failed: ${error.message}` })
    else {
      setProfiles((prev) => prev.map((p) => (p.id === target.id ? { ...p, is_approved: approve } : p)))
      setFeedback({ type: 'success', message: `${target.full_name || target.email} ${approve ? 'approved' : 'access revoked'}.` })
    }
    setActionId(null)
  }

  const reject = async (req) => {
    setBusy(true)
    try {
      const { error } = await supabase.from('override_requests').update({ status: 'rejected' }).eq('id', req.id)
      if (error) throw error
      setFeedback({ type: 'success', message: isStandardRequest(req) ? 'Request rejected. The staff member will be told.' : 'Override rejected. The original booking stays and the requester will be told.' })
      loadRequests()
    } catch (err) {
      setFeedback({ type: 'error', message: `Could not reject: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  const confirmApprove = async () => {
    if (!approving) return
    const { req, conflicts } = approving
    setBusy(true)
    try {
      if (isStandardRequest(req)) {
        // A normal request must never evict somebody: stop if the slot was taken meanwhile
        const { data: clash, error: ce } = await supabase.from('bookings').select('id').eq('room_id', req.room_id).lt('start_time', req.end_time).gt('end_time', req.start_time).limit(1)
        if (ce) throw ce
        if (clash?.length) {
          setFeedback({ type: 'error', message: 'This slot was booked by someone else in the meantime. Reject this request instead.' })
          setApproving(null)
          return
        }
      } else if (conflicts?.length) {
        // Tell the people being replaced (their app shows a notice)
        await markDisplacedBookings(conflicts.filter((b) => b.user_id !== user.id))
      }
      const { error } = await supabase.rpc('approve_override_request', { req_id: req.id })
      if (error) throw error
      setFeedback({
        type: 'success',
        message: isStandardRequest(req)
          ? 'Request approved. The periods are now booked for the staff member.'
          : 'Override approved. The old booking was replaced and both staff members have been notified.',
      })
      setApproving(null)
      loadRequests()
    } catch (err) {
      setFeedback({ type: 'error', message: `Could not approve: ${err.message}` })
    } finally {
      setBusy(false)
    }
  }

  const acknowledge = async (id) => {
    const { error } = await supabase.from('override_requests').update({ status: 'approved' }).eq('id', id)
    if (error) setFeedback({ type: 'error', message: `Could not update: ${error.message}` })
    else loadRequests()
  }

  const updatePassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) return setFeedback({ type: 'error', message: 'Password must be at least 6 characters.' })
    if (newPassword !== confirmPassword) return setFeedback({ type: 'error', message: 'The two passwords do not match.' })
    setPwBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwBusy(false)
    if (error) return setFeedback({ type: 'error', message: error.message })
    setFeedback({ type: 'success', message: 'Admin password updated.' })
    setNewPassword('')
    setConfirmPassword('')
  }

  const updateEmail = async (e) => {
    e.preventDefault()
    if (!newEmail.trim()) return
    setEmBusy(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmBusy(false)
    if (error) return setFeedback({ type: 'error', message: error.message })
    setFeedback({ type: 'success', message: 'Confirmation link sent to the new email. Open it to finish the change.' })
    setNewEmail('')
  }

  // ----- small pieces --------------------------------------------------------
  const StatusFilter = ({ value, onChange, options }) => (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto mb-4">
      <div className="inline-flex gap-2 min-w-max">
        {options.map(([id, label]) => (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold border-[1.5px] ${value === id ? 'bg-brand-700 text-white border-brand-900 shadow-elev-blue' : 'bg-white text-slate-700 border-slate-800 shadow-elev-sm'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )

  const filteredReqs = (list) => list.filter((o) => reqFilter === 'all' || o.status === reqFilter)
  const reqOptions = [['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']]

  const filteredProfiles = profiles.filter((p) => {
    const f = approvalFilter === 'all' || (approvalFilter === 'pending' ? p.is_approved === false : p.is_approved === true)
    const t = search.toLowerCase()
    return f && (!t || [p.full_name, p.email, p.designation].some((v) => (v || '').toLowerCase().includes(t)))
  })

  const spanOf = (o) => {
    const nos = periodsCovering(o, toDateStr(new Date(o.start_time)), periods).map((p) => p.no)
    return nos.length ? `${countLabel(nos.length)} · ${spanLabel(nos)}` : null
  }

  return (
    <div>
      <Toast feedback={feedback} onClose={() => setFeedback(null)} />
      <PageHeader title="Admin" subtitle="Approve staff and requests, decide emergency overrides, and set the period timings." />

      <div className="mb-5">
        <Tabs
          value={section}
          onChange={(s) => { setSection(s); setReqFilter('pending') }}
          tabs={[
            { id: 'requests', label: 'Booking requests', icon: CalendarDays, count: pendingStd },
            { id: 'overrides', label: 'Overrides', icon: ShieldAlert, count: pendingOv },
            { id: 'approvals', label: 'Staff', icon: Users, count: pendingStaff },
            { id: 'cancellations', label: 'Cancellations', icon: XCircle, count: newCancels },
            { id: 'schedule', label: 'Period timings', icon: Timer, count: 0 },
            { id: 'security', label: 'Security', icon: KeyRound, count: 0 },
          ]}
        />
      </div>

      {/* ---- Booking requests ---- */}
      {section === 'requests' && (
        <div>
          <StatusFilter value={reqFilter} onChange={setReqFilter} options={reqOptions} />
          {loadingReqs ? <Spinner label="Loading requests..." /> : filteredReqs(standard).length === 0 ? (
            <EmptyState icon={CalendarDays} title="No booking requests" text={reqFilter === 'pending' ? 'Nothing is waiting for approval.' : 'No requests match this filter.'} />
          ) : (
            <div className="space-y-4">
              {filteredReqs(standard).map((req) => (
                <div key={req.id} className="elev p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-brand-700 text-white text-xs font-extrabold">{req.rooms?.departments?.code || 'DEPT'}</span>
                    <span className="text-sm font-bold text-slate-800">{req.rooms?.name}</span>
                    <span className="ml-auto">
                      {req.status === 'pending' && <Badge tone="amber"><Hourglass className="w-3 h-3" /> Waiting</Badge>}
                      {req.status === 'approved' && <Badge tone="green">Approved</Badge>}
                      {req.status === 'rejected' && <Badge tone="red">Rejected</Badge>}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">{req.purpose}</h3>
                  <p className="text-xs text-slate-600 mt-1">Requested by <strong>{req.profiles?.full_name || 'Staff member'}</strong> ({req.profiles?.designation || req.profiles?.email})</p>
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border-[1.5px] border-slate-300 text-xs font-semibold text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                    <span>{fmtLongDate(toDateStr(new Date(req.start_time)))}</span>
                    <span>{fmtIsoTime(req.start_time)} – {fmtIsoTime(req.end_time)}</span>
                    {spanOf(req) && <span className="font-extrabold text-brand-800">{spanOf(req)}</span>}
                  </div>
                  {req.status === 'pending' && (
                    <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                      <button type="button" disabled={busy} onClick={() => reject(req)} className="btn-secondary text-red-700 border-red-700">Decline</button>
                      <button type="button" onClick={() => setApproving({ req, conflicts: [] })} className="btn-primary"><ShieldCheck className="w-4 h-4" /> Approve</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Emergency override requests (side-by-side compare) ---- */}
      {section === 'overrides' && (
        <div>
          <StatusFilter value={reqFilter} onChange={setReqFilter} options={reqOptions} />
          {loadingReqs ? <Spinner label="Loading override requests..." /> : filteredReqs(overrides).length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No emergency requests" text={reqFilter === 'pending' ? 'No one is asking to replace a booking right now.' : 'No requests match this filter.'} />
          ) : (
            <div className="space-y-5">
              {filteredReqs(overrides).map((req) => (
                <OverrideCompare key={req.id} req={req} isPending={req.status === 'pending'} busy={busy}
                  onReject={reject} onApprove={(r, conflicts) => setApproving({ req: r, conflicts })} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- Staff approvals ---- */}
      {section === 'approvals' && (
        <div>
          <StatusFilter value={approvalFilter} onChange={setApprovalFilter} options={[['pending', `Waiting (${pendingStaff})`], ['approved', 'Approved'], ['all', `All (${profiles.length})`]]} />
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type="search" className="input pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or designation" />
            </div>
            <button type="button" onClick={loadProfiles} disabled={loadingProfiles} aria-label="Refresh" className="btn-secondary w-[46px] px-0"><RefreshCw className={`w-4 h-4 ${loadingProfiles ? 'animate-spin' : ''}`} /></button>
          </div>
          {loadingProfiles ? <Spinner label="Loading staff..." /> : filteredProfiles.length === 0 ? (
            <EmptyState icon={Users} title="No staff here" text={approvalFilter === 'pending' ? 'Every registration has been handled.' : 'No one matches your search.'} />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredProfiles.map((p) => {
                const self = p.id === user.id
                const loading = actionId === p.id
                return (
                  <div key={p.id} className="elev p-4">
                    <div className="flex items-start gap-3">
                      <span className="w-11 h-11 shrink-0 rounded-full bg-brand-50 text-brand-800 border-[1.5px] border-brand-300 font-extrabold flex items-center justify-center">{(p.full_name || 'U').charAt(0).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-slate-900 truncate">{p.full_name || 'Unnamed staff'}</span>
                          {p.role === 'admin' && <Badge tone="amber">Admin</Badge>}
                          {self && <Badge>You</Badge>}
                        </div>
                        <div className="text-xs text-slate-600 font-semibold">{p.designation || 'No designation'}</div>
                        <div className="text-xs text-slate-500 truncate inline-flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      {p.is_approved ? <Badge tone="green"><CheckCircle2 className="w-3 h-3" /> Approved</Badge> : <Badge tone="amber"><Clock className="w-3 h-3" /> Waiting</Badge>}
                      {self ? <span className="text-xs italic text-slate-400">Protected</span> : p.is_approved ? (
                        <button type="button" disabled={loading} onClick={() => toggleApproval(p, false)} className="btn-secondary btn-sm text-red-700 border-red-700"><UserX className="w-3.5 h-3.5" /> Revoke</button>
                      ) : (
                        <button type="button" disabled={loading} onClick={() => toggleApproval(p, true)} className="btn-success btn-sm"><UserCheck className="w-3.5 h-3.5" /> Approve</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ---- Cancellations ---- */}
      {section === 'cancellations' && (
        loadingReqs ? <Spinner label="Loading..." /> : cancellations.length === 0 ? (
          <EmptyState icon={XCircle} title="No cancellations" text="Staff cancellations will show up here." />
        ) : (
          <div className="space-y-4">
            {cancellations.map((c) => {
              const isNew = c.status === 'pending'
              return (
                <div key={c.id} className={`elev p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isNew ? '' : 'opacity-70'}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-brand-700 text-white text-xs font-extrabold">{c.rooms?.departments?.code || 'DEPT'}</span>
                      <span className="text-sm font-bold">{c.rooms?.name}</span>
                      {isNew && <Badge tone="orange">New</Badge>}
                    </div>
                    <h3 className="font-extrabold text-slate-900">{c.purpose}</h3>
                    <p className="text-xs text-slate-600 mt-1"><strong>{c.profiles?.full_name || 'A staff member'}</strong> cancelled this. Now free: {fmtLongDate(toDateStr(new Date(c.start_time)))}, {fmtIsoTime(c.start_time)} – {fmtIsoTime(c.end_time)}{spanOf(c) ? ` (${spanOf(c)})` : ''}</p>
                  </div>
                  {isNew && <button type="button" onClick={() => acknowledge(c.id)} className="btn-secondary btn-sm self-start"><Check className="w-4 h-4" /> Mark as seen</button>}
                </div>
              )
            })}
          </div>
        )
      )}

      {section === 'schedule' && <ScheduleSettings onSaved={(m) => setFeedback({ type: 'success', message: m })} />}

      {/* ---- Security ---- */}
      {section === 'security' && (
        <div className="grid lg:grid-cols-2 gap-5">
          <form onSubmit={updatePassword} className="elev p-5 space-y-4">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2"><Lock className="w-4 h-4 text-brand-700" /> Change password</h3>
            <div>
              <label className="field-label">New password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="input pr-12" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" required />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label="Show or hide password" className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 text-slate-400">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
            <div>
              <label className="field-label">Confirm new password</label>
              <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={pwBusy} className="btn-primary w-full">{pwBusy ? 'Updating...' : 'Update password'}</button>
          </form>

          <form onSubmit={updateEmail} className="elev p-5 space-y-4">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2"><Mail className="w-4 h-4 text-brand-700" /> Change login email</h3>
            <div className="p-3 rounded-xl bg-slate-50 border-[1.5px] border-slate-300 text-xs">
              <div className="font-bold text-slate-600">Current email</div>
              <div className="font-semibold text-brand-800 break-all">{user?.email}</div>
            </div>
            <div>
              <label className="field-label">New email</label>
              <input type="email" inputMode="email" className="input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin.new@college.edu" required />
            </div>
            <p className="text-xs text-slate-500">You must open the confirmation link sent to the new address before the change takes effect.</p>
            <button type="submit" disabled={emBusy} className="btn-primary w-full">{emBusy ? 'Sending...' : 'Send confirmation link'}</button>
          </form>
        </div>
      )}

      {/* ---- Approve confirmation ---- */}
      <Sheet
        open={!!approving}
        onClose={() => setApproving(null)}
        icon={ShieldCheck}
        tone={approving && !isStandardRequest(approving.req) ? 'amber' : 'green'}
        title={approving && isStandardRequest(approving.req) ? 'Approve this request?' : 'Approve emergency override?'}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setApproving(null)} className="btn-secondary flex-1">Back</button>
            <button type="button" onClick={confirmApprove} disabled={busy} className="btn-primary flex-[2]">{busy ? 'Working...' : approving && isStandardRequest(approving.req) ? 'Approve' : 'Approve and replace'}</button>
          </div>
        }
      >
        {approving && (
          <div className="text-sm text-slate-700 space-y-3">
            <p><strong>{approving.req.profiles?.full_name || 'The staff member'}</strong> gets <strong>{approving.req.rooms?.name}</strong> for {spanOf(approving.req) || 'the requested time'}.</p>
            {!isStandardRequest(approving.req) && (
              <div className="p-3.5 rounded-xl bg-red-50 border-[1.5px] border-red-700 text-red-950 flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>{approving.conflicts?.length ? `${approving.conflicts.length} existing booking(s) in these periods will be cancelled and their owners notified.` : 'No existing booking is in the way.'}</span>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
