import React, { useEffect, useState } from 'react'
import {
  Building2,
  Layers,
  DoorOpen,
  CalendarDays,
  ShieldCheck,
  Sparkles,
  Search,
  ExternalLink
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DEFAULT_BLOCKS = [
  { code: 'CSE', name: 'Computer Science and Engineering', color: 'from-blue-600 to-indigo-700' },
  { code: 'IT', name: 'Information Technology', color: 'from-cyan-600 to-blue-700' },
  { code: 'ECE', name: 'Electronics and Communication', color: 'from-violet-600 to-purple-700' },
  { code: 'EEE', name: 'Electrical & Electronics', color: 'from-amber-600 to-orange-700' },
  { code: 'ADS', name: 'AI & Data Science', color: 'from-emerald-600 to-teal-700' },
  { code: 'CIVIL', name: 'Civil Engineering', color: 'from-stone-600 to-slate-700' },
  { code: 'MECH', name: 'Mechanical Engineering', color: 'from-red-600 to-rose-700' },
  { code: 'AUD', name: 'Campus Auditorium', color: 'from-fuchsia-600 to-pink-700' },
  { code: 'ADMIN', name: 'Administrative Block', color: 'from-slate-700 to-slate-900' }
]

export default function DepartmentsPlaceholder({ onGoToAdmin }) {
  const { profile, isAdmin } = useAuth()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('*')
          .order('display_order', { ascending: true })

        if (!error && data && data.length > 0) {
          setDepartments(data)
        } else {
          setDepartments(DEFAULT_BLOCKS)
        }
      } catch (e) {
        setDepartments(DEFAULT_BLOCKS)
      } finally {
        setLoading(false)
      }
    }

    fetchDepartments()
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl relative overflow-hidden border border-indigo-800/40 mb-10">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Authorized Staff Session: {profile?.designation || 'Staff'}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Welcome, {profile?.full_name || 'Faculty Member'}
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
            Your college credentials are authenticated and approved. Browse department blocks and examine available halls, smart classrooms, and laboratory booking schedules below.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/90 rounded-xl border border-slate-700 text-xs font-medium text-slate-200">
              <DoorOpen className="w-4 h-4 text-indigo-400" />
              <span>9 Campus Department Blocks</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/90 rounded-xl border border-slate-700 text-xs font-medium text-slate-200">
              <CalendarDays className="w-4 h-4 text-emerald-400" />
              <span>Conflict-Free Room Scheduling</span>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={onGoToAdmin}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition"
              >
                <span>Open Admin Queue</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Subtle background decoration */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 opacity-10 pointer-events-none text-white">
          <Building2 className="w-96 h-96" />
        </div>
      </div>

      {/* Department Blocks Grid Preview */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>Campus Department Blocks</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Phase 3 will enable in-depth room filtering, capacity management, and instant booking slots.
          </p>
        </div>
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
          Phase 2 Active
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept, index) => {
          const colorClass = DEFAULT_BLOCKS[index % DEFAULT_BLOCKS.length].color

          return (
            <div
              key={dept.id || dept.code}
              className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className={`h-3 bg-gradient-to-r ${colorClass}`} />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider bg-slate-100 text-slate-700 font-mono">
                      {dept.code}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      Block #{dept.display_order || index + 1}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition">
                    {dept.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2">
                    Seminar Halls, Lecture Rooms, and Specialized Engineering Laboratories.
                  </p>
                </div>
              </div>

              <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Ready for Phase 3 Rooms
                </span>
                <span className="font-semibold text-indigo-600 group-hover:translate-x-0.5 transition">
                  Details &rarr;
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
