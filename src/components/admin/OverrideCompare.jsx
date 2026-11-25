import React, { useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck, Clock, User, FileText, CalendarDays, XCircle, Hourglass } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Badge } from '../ui'
import { cleanPurpose } from '../../lib/bookingRequests'
import { usePeriods, periodsCovering, spanLabel, countLabel, toDateStr, fmtLongDate, fmtIsoTime } from '../../lib/schedule'

const Line = ({ icon: Icon, children }) => (
  <div className="flex gap-2 text-sm">
    <Icon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
    <div className="min-w-0 break-words">{children}</div>
  </div>
)

// Side-by-side: what is booked now vs the emergency request.
export default function OverrideCompare({ req, isPending, onApprove, onReject, busy }) {
  const periods = usePeriods()
  const [conflicts, setConflicts] = useState(null)
  const dateStr = toDateStr(new Date(req.start_time))
  const reqNos = periodsCovering(req, dateStr, periods).map((p) => p.no)
  const room = req.rooms

  useEffect(() => {
    let alive = true
    supabase
      .from('bookings')
      .select('*, profiles(id, full_name, designation, email)')
      .eq('room_id', req.room_id)
      .lt('start_time', req.end_time)
      .gt('end_time', req.start_time)
      .then(({ data }) => alive && setConflicts(data || []))
    return () => {
      alive = false
    }
  }, [req.id])

  return (
    <div className="elev overflow-hidden">
      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b-[1.5px] border-slate-300 flex flex-wrap items-center gap-2">
        <span className="px-2 py-0.5 rounded-md bg-brand-700 text-white text-xs font-extrabold">{room?.departments?.code || 'DEPT'}</span>
        <span className="text-sm font-extrabold text-slate-900">{room?.name}</span>
        <span className="text-xs font-semibold text-slate-500 inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{fmtLongDate(dateStr)}</span>
        <span className="ml-auto">
          {req.status === 'pending' && <Badge tone="amber"><Hourglass className="w-3 h-3" /> Waiting</Badge>}
          {req.status === 'approved' && <Badge tone="green">Approved</Badge>}
          {req.status === 'rejected' && <Badge tone="red"><XCircle className="w-3 h-3" /> Rejected</Badge>}
        </span>
      </div>

      <div className="grid md:grid-cols-2">
        <div className="p-4 sm:p-5 md:border-r-[1.5px] border-slate-200 bg-red-50/60">
          <div className="text-xs font-extrabold text-red-800 mb-3">CURRENT BOOKING</div>
          {conflicts === null ? (
            <p className="text-sm text-slate-500">Checking...</p>
          ) : conflicts.length === 0 ? (
            <p className="text-sm font-semibold text-slate-600">{isPending ? 'Nothing is booked in these periods now. Approving simply reserves them.' : 'No booking overlaps this request now.'}</p>
          ) : (
            <div className="space-y-4">
              {conflicts.map((b) => {
                const nos = periodsCovering(b, dateStr, periods).map((p) => p.no)
                return (
                  <div key={b.id} className="space-y-1.5">
                    <Badge tone="red">{countLabel(nos.length)} · {spanLabel(nos)}</Badge>
                    <Line icon={User}><strong>{b.profiles?.full_name || 'Staff member'}</strong><div className="text-xs text-slate-500">{b.profiles?.designation || b.profiles?.email}</div></Line>
                    <Line icon={Clock}>{fmtIsoTime(b.start_time)} – {fmtIsoTime(b.end_time)}</Line>
                    <Line icon={FileText}>{cleanPurpose(b.purpose)}</Line>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 bg-amber-50/60 border-t-[1.5px] md:border-t-0 border-slate-200">
          <div className="text-xs font-extrabold text-amber-900 mb-3">EMERGENCY REQUEST</div>
          <div className="space-y-1.5">
            <Badge tone="amber">{countLabel(reqNos.length)} · {spanLabel(reqNos)}</Badge>
            <Line icon={User}><strong>{req.profiles?.full_name || 'Staff member'}</strong><div className="text-xs text-slate-500">{req.profiles?.designation || req.profiles?.email}</div></Line>
            <Line icon={Clock}>{fmtIsoTime(req.start_time)} – {fmtIsoTime(req.end_time)}</Line>
            <Line icon={FileText}>{req.purpose}</Line>
            <Line icon={ShieldAlert}><strong>Emergency reason:</strong> {req.priority_reason}</Line>
          </div>
        </div>
      </div>

      {isPending && (
        <div className="px-4 sm:px-5 py-3 bg-white border-t-[1.5px] border-slate-300 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => onReject(req)} className="btn-secondary text-red-700 border-red-700">Reject, keep current booking</button>
          <button type="button" disabled={busy || conflicts === null} onClick={() => onApprove(req, conflicts || [])} className="btn-primary">
            <ShieldCheck className="w-4 h-4" /> Approve and replace
          </button>
        </div>
      )}
    </div>
  )
}
