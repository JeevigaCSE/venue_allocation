import React, { useEffect, useRef, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  cleanPurpose,
  isStandardRequest,
  isCancellationNotice,
  CANCELLATION_REASON
} from '../lib/bookingRequests'

// STAFF: pop-up when the admin approves/rejects one of their requests.
// ADMIN: pop-up when a staff member cancels a booking.
// What was already shown is remembered in this browser only.
const formatWhen = (iso) =>
  `${new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${new Date(
    iso
  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

export default function RequestNotifications({ onView }) {
  const { user, isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const seenRef = useRef(null) // null = not initialised yet

  const storageKey = user ? `request_updates_seen_${user.id}` : null

  const saveSeen = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...seenRef.current]))
    } catch (e) {
      /* storage unavailable: keep in memory only */
    }
  }

  const loadStored = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey))
      return Array.isArray(stored) ? stored : null
    } catch (e) {
      return null
    }
  }

  const check = useCallback(async () => {
    if (!user) return
    try {
      // ---------------- ADMIN: staff cancellations ----------------
      if (isAdmin) {
        const { data, error } = await supabase
          .from('override_requests')
          .select(
            'id, purpose, status, created_at, start_time, end_time, rooms:room_id(name), profiles:requester_id(full_name, email)'
          )
          .eq('priority_reason', CANCELLATION_REASON)
          .eq('status', 'pending')

        if (error || !data) return
        if (seenRef.current === null) seenRef.current = new Set(loadStored() || [])
        setItems(
          data.filter((d) => !seenRef.current.has(d.id)).map((d) => ({ ...d, kind: 'cancel' }))
        )
        return
      }

      // ---------------- STAFF: decisions on their requests ----------------
      const { data, error } = await supabase
        .from('override_requests')
        .select('id, purpose, priority_reason, status, start_time, end_time, rooms:room_id(name)')
        .eq('requester_id', user.id)
        .neq('status', 'pending')

      if (error || !data) return
      const decisions = data.filter((d) => !isCancellationNotice(d))

      if (seenRef.current === null) {
        const stored = loadStored()
        if (stored) {
          seenRef.current = new Set(stored)
        } else {
          // First time on this browser: do not notify about old decisions
          seenRef.current = new Set(decisions.map((d) => d.id))
          saveSeen()
        }
      }

      setItems(decisions.filter((d) => !seenRef.current.has(d.id)))
    } catch (e) {
      console.warn('Notification check failed:', e)
    }
  }, [user, isAdmin])

  useEffect(() => {
    seenRef.current = null
    setItems([])
    check()
    const timer = setInterval(check, 30000)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [check])

  const dismiss = (id) => {
    if (seenRef.current) {
      seenRef.current.add(id)
      saveSeen()
    }
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  if (!user || items.length === 0) return null

  return (
    <div className="fixed top-20 right-4 z-40 w-[calc(100%-2rem)] sm:w-96 space-y-3">
      {items.map((it) => {
        const isCancel = it.kind === 'cancel'
        const approved = it.status === 'approved'
        const label = isStandardRequest(it) ? 'booking request' : 'override request'
        return (
          <div
            key={it.id}
            className={`rounded-2xl border shadow-lg p-4 bg-white flex gap-3 ${
              isCancel ? 'border-orange-200' : approved ? 'border-emerald-200' : 'border-red-200'
            }`}
          >
            {isCancel ? (
              <XCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            ) : approved ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm">
              <div className="font-bold text-slate-900">
                {isCancel
                  ? `${it.profiles?.full_name || 'A staff member'} cancelled a booking`
                  : `Your ${label} was ${approved ? 'approved' : 'rejected'}`}
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {cleanPurpose(it.purpose)} &bull; {it.rooms?.name || 'Room'} &bull;{' '}
                {formatWhen(it.start_time)}
              </div>
              {isCancel && (
                <div className="text-[11px] text-slate-500 mt-1">
                  See Admin Panel &gt; Cancellations
                </div>
              )}
              <div className="mt-2 flex items-center gap-3">
                {!isCancel && approved && onView && (
                  <button
                    type="button"
                    onClick={() => {
                      dismiss(it.id)
                      onView()
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    View booking
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss(it.id)}
                  className="text-xs font-semibold text-slate-500 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(it.id)}
              className="text-slate-400 hover:text-slate-600 self-start"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
