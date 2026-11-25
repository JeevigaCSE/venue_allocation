import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// 8 fixed college periods, configured by the admin.
//
// NO DATABASE CHANGE NEEDED: the timings are stored as one hidden row in the
// existing `departments` table (code = '__SCHEDULE__'). Every approved user can
// read it, only admins can write it (your existing RLS policies already do this).
// The row is filtered out of every department list in the app.
// ---------------------------------------------------------------------------
export const SCHEDULE_CODE = '__SCHEDULE__'
export const isScheduleRow = (dept) => dept?.code === SCHEDULE_CODE

export const DEFAULT_PERIODS = [
  { no: 1, start: '09:00', end: '09:50' },
  { no: 2, start: '09:50', end: '10:40' },
  { no: 3, start: '10:55', end: '11:45' },
  { no: 4, start: '11:45', end: '12:35' },
  { no: 5, start: '13:25', end: '14:15' },
  { no: 6, start: '14:15', end: '15:05' },
  { no: 7, start: '15:15', end: '16:05' },
  { no: 8, start: '16:05', end: '16:55' },
]

const CACHE_KEY = 'venue_periods_cache_v1'
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// Returns a clean 8-period list or null if the data is not valid.
export const sanitizePeriods = (list) => {
  if (!Array.isArray(list) || list.length !== 8) return null
  const out = list.map((p, i) => ({ no: i + 1, start: p?.start, end: p?.end }))
  return out.every((p) => HHMM.test(p.start) && HHMM.test(p.end)) ? out : null
}

// Returns an error message, or null when the timings are valid.
export const validatePeriods = (periods) => {
  const clean = sanitizePeriods(periods)
  if (!clean) return 'Every period needs a start and an end time.'
  for (let i = 0; i < clean.length; i++) {
    const p = clean[i]
    if (p.end <= p.start) return `Period ${p.no}: end time must be after the start time.`
    if (i > 0 && p.start < clean[i - 1].end)
      return `Period ${p.no} starts before Period ${p.no - 1} ends.`
  }
  return null
}

const readCache = () => {
  try {
    return sanitizePeriods(JSON.parse(localStorage.getItem(CACHE_KEY)))
  } catch (e) {
    return null
  }
}

let current = readCache() || DEFAULT_PERIODS
let loaded = false
const listeners = new Set()
const publish = (next) => {
  current = next
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch (e) {
    /* storage unavailable: keep in memory */
  }
  listeners.forEach((fn) => fn(next))
}

export async function refreshPeriods() {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('name')
      .eq('code', SCHEDULE_CODE)
      .maybeSingle()
    if (error) throw error
    loaded = true
    if (data?.name) {
      const clean = sanitizePeriods(JSON.parse(data.name)?.periods)
      if (clean) publish(clean)
    }
  } catch (e) {
    console.warn('Could not load period timings, using saved/default ones:', e)
  }
  return current
}

// Admin only (blocked by your existing RLS for everyone else).
export async function savePeriods(periods) {
  const problem = validatePeriods(periods)
  if (problem) throw new Error(problem)
  const clean = sanitizePeriods(periods)
  const payload = JSON.stringify({ v: 1, periods: clean })

  const { data: existing, error: findErr } = await supabase
    .from('departments')
    .select('id')
    .eq('code', SCHEDULE_CODE)
    .maybeSingle()
  if (findErr) throw findErr

  const { error } = existing
    ? await supabase.from('departments').update({ name: payload }).eq('id', existing.id)
    : await supabase
        .from('departments')
        .insert([{ name: payload, code: SCHEDULE_CODE, display_order: 9999 }])
  if (error) throw error
  publish(clean)
}

export function usePeriods() {
  const [periods, setPeriods] = useState(current)
  useEffect(() => {
    listeners.add(setPeriods)
    if (!loaded) refreshPeriods()
    return () => listeners.delete(setPeriods)
  }, [])
  return periods
}

// ---------------------------------------------------------------------------
// Date / time helpers (all local time)
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0')
export const toDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}
export const atTime = (dateStr, hhmm) => new Date(`${dateStr}T${hhmm}:00`)
export const fmt12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`
}
export const fmtRange = (p) => `${fmt12(p.start)} – ${fmt12(p.end)}`
export const fmtIsoTime = (iso) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
export const fmtLongDate = (dateStr) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
export const dayBounds = (dateStr) => ({
  start: new Date(`${dateStr}T00:00:00`),
  end: new Date(`${addDays(dateStr, 1)}T00:00:00`),
})

const overlaps = (aS, aE, bS, bE) => aS < bE && aE > bS
export const periodWindow = (dateStr, p) => ({
  start: atTime(dateStr, p.start),
  end: atTime(dateStr, p.end),
})

// ---------------------------------------------------------------------------
// Slot state for one room + one date.
//   ended     -> period already over (booked ones are released automatically)
//   booked    -> red
//   pending   -> a request is waiting for the admin
//   available -> green
// Computed from the clock, so no manual reset is ever needed.
// ---------------------------------------------------------------------------
export function getSlotState({ dateStr, period, bookings, requests = [], now }) {
  const { start, end } = periodWindow(dateStr, period)
  const live = start <= now && now < end
  if (end <= now) return { status: 'ended' }
  const hit = (x) => overlaps(new Date(x.start_time), new Date(x.end_time), start, end)
  const booking = bookings.find(hit)
  if (booking) return { status: 'booked', booking, live }
  const request = requests.find(hit)
  if (request) return { status: 'pending', request, live }
  return { status: 'available', live }
}

// Which periods does a booking/request cover on a given date?
export const periodsCovering = (item, dateStr, periods) =>
  periods.filter((p) => {
    const w = periodWindow(dateStr, p)
    return overlaps(new Date(item.start_time), new Date(item.end_time), w.start, w.end)
  })

// [1,2,3,5] -> [[1,2,3],[5]]
export const groupRuns = (nos) => {
  const sorted = [...nos].sort((a, b) => a - b)
  const runs = []
  sorted.forEach((n) => {
    const last = runs[runs.length - 1]
    if (last && n === last[last.length - 1] + 1) last.push(n)
    else runs.push([n])
  })
  return runs
}

// [2,3,4] -> "P2–P4"; [1,3] -> "P1, P3"
export const spanLabel = (nos) =>
  groupRuns(nos)
    .map((r) => (r.length > 1 ? `P${r[0]}–P${r[r.length - 1]}` : `P${r[0]}`))
    .join(', ')

export const countLabel = (n) => `${n} period${n === 1 ? '' : 's'}`

// Selected period numbers -> one {start,end} ISO window per consecutive run.
export const runsToWindows = (dateStr, nos, periods) =>
  groupRuns(nos).map((run) => {
    const first = periods.find((p) => p.no === run[0])
    const last = periods.find((p) => p.no === run[run.length - 1])
    return {
      nos: run,
      start: atTime(dateStr, first.start),
      end: atTime(dateStr, last.end),
    }
  })
