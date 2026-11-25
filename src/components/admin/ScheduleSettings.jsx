import React, { useState, useEffect } from 'react'
import { Clock, Save, RotateCcw, AlertCircle, Info } from 'lucide-react'
import { usePeriods, savePeriods, validatePeriods, DEFAULT_PERIODS, fmt12 } from '../../lib/schedule'

const minutes = (p) => {
  const [sh, sm] = p.start.split(':').map(Number)
  const [eh, em] = p.end.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

export default function ScheduleSettings({ onSaved }) {
  const saved = usePeriods()
  const [rows, setRows] = useState(saved)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Follow the saved timings until the admin starts editing
  useEffect(() => {
    if (!dirty) setRows(saved)
  }, [saved, dirty])

  const problem = validatePeriods(rows)

  const edit = (no, field, value) => {
    setDirty(true)
    setError(null)
    setRows((cur) => cur.map((r) => (r.no === no ? { ...r, [field]: value } : r)))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await savePeriods(rows)
      setDirty(false)
      onSaved?.('Period timings saved. Every lab and classroom now uses them.')
    } catch (err) {
      setError(err.message || 'Could not save the timings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="elev p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-xl bg-brand-50 text-brand-700 border-[1.5px] border-brand-300"><Clock className="w-5 h-5" /></span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Period timings</h2>
            <p className="text-sm text-slate-500 mt-0.5">These 8 periods apply to every lab and classroom in every department. Staff pick periods, so they never type a time.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {rows.map((r) => {
            const len = minutes(r)
            const bad = r.end <= r.start
            return (
              <div key={r.no} className="elev-sm p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 sm:w-40">
                  <span className="w-11 h-11 rounded-xl bg-brand-700 text-white font-extrabold flex items-center justify-center border-[1.5px] border-brand-900">P{r.no}</span>
                  <span className="text-sm font-extrabold text-slate-900">Period {r.no}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <div>
                    <label className="field-label" htmlFor={`s${r.no}`}>Starts</label>
                    <input id={`s${r.no}`} type="time" className="input" value={r.start} onChange={(e) => edit(r.no, 'start', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`e${r.no}`}>Ends</label>
                    <input id={`e${r.no}`} type="time" className="input" value={r.end} onChange={(e) => edit(r.no, 'end', e.target.value)} />
                  </div>
                </div>
                <div className={`text-xs font-bold sm:w-36 sm:text-right ${bad ? 'text-red-700' : 'text-slate-500'}`}>
                  {bad ? 'End must be after start' : `${fmt12(r.start)} – ${fmt12(r.end)} · ${len} min`}
                </div>
              </div>
            )
          })}
        </div>

        {(error || (dirty && problem)) && (
          <div role="alert" className="mt-4 p-3.5 rounded-xl bg-red-50 border-[1.5px] border-red-700 text-sm font-semibold text-red-900 flex gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error || problem}
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={save} disabled={!dirty || !!problem || saving} className="btn-primary sm:min-w-[200px]">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save timings'}
          </button>
          <button type="button" onClick={() => { setRows(DEFAULT_PERIODS); setDirty(true); setError(null) }} className="btn-secondary">
            <RotateCcw className="w-4 h-4" /> Use standard timings
          </button>
          {dirty && (
            <button type="button" onClick={() => { setRows(saved); setDirty(false); setError(null) }} className="btn-ghost">Discard changes</button>
          )}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-brand-50 border-[1.5px] border-brand-300 text-sm text-brand-900 flex gap-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Existing bookings keep their exact start and end times. If you change a period, a booking shows against whichever new periods it overlaps.</span>
      </div>
    </div>
  )
}
