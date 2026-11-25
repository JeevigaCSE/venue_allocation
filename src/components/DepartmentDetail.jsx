import React, { useState, useEffect, useMemo } from 'react'
import { DoorOpen, Plus, Pencil, Trash2, Users, Search, RefreshCw, ChevronRight, AlertTriangle, FlaskConical, School, Landmark } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Spinner, EmptyState, ErrorState, Toast, Sheet, PageHeader, Badge } from './ui'
import RoomSlots from './RoomSlots'
import { usePeriods, getSlotState, toDateStr, dayBounds, fmt12 } from '../lib/schedule'

const TYPE_META = {
  Lab: { label: 'Lab', icon: FlaskConical, tone: 'blue' },
  Room: { label: 'Classroom', icon: School, tone: 'slate' },
  Hall: { label: 'Hall', icon: Landmark, tone: 'amber' },
}

// Tiny 8-segment bar: today's availability at a glance
function MiniStrip({ states }) {
  const color = {
    available: 'bg-emerald-500 border-emerald-800',
    booked: 'bg-red-600 border-red-900',
    pending: 'bg-amber-400 border-amber-700',
    ended: 'bg-slate-200 border-slate-300',
  }
  return (
    <div className="flex gap-1" aria-hidden="true">
      {states.map((s, i) => (
        <span key={i} className={`flex-1 h-3.5 rounded-md border ${color[s.status]}`} />
      ))}
    </div>
  )
}

export default function DepartmentDetail({ department, onBack, onDepartmentUpdated }) {
  const { isAdmin } = useAuth()
  const periods = usePeriods()

  const [rooms, setRooms] = useState([])
  const [todayBookings, setTodayBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [typeFilter, setTypeFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [activeRoom, setActiveRoom] = useState(null)
  const [now, setNow] = useState(new Date())

  const [roomModal, setRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomName, setRoomName] = useState('')
  const [roomType, setRoomType] = useState('Room')
  const [roomCapacity, setRoomCapacity] = useState(40)
  const [deleteRoom, setDeleteRoom] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(t)
  }, [])

  const loadData = async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const { data: roomsData, error } = await supabase.from('rooms').select('*').eq('department_id', department.id).order('name', { ascending: true })
      if (error) throw error
      setRooms(roomsData || [])

      const ids = (roomsData || []).map((r) => r.id)
      if (ids.length) {
        const { start, end } = dayBounds(toDateStr())
        const { data: b } = await supabase.from('bookings').select('id, room_id, start_time, end_time').in('room_id', ids).lt('start_time', end.toISOString()).gt('end_time', start.toISOString())
        setTodayBookings(b || [])
      } else {
        setTodayBookings([])
      }
    } catch (err) {
      console.error(err)
      setFetchError(err.message || 'Could not load rooms.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [department.id])

  const roomStates = (roomId) => {
    const mine = todayBookings.filter((b) => b.room_id === roomId)
    return periods.map((p) => getSlotState({ dateStr: toDateStr(now), period: p, bookings: mine, now }))
  }

  const filteredRooms = useMemo(
    () =>
      rooms.filter((r) => (typeFilter === 'All' || r.type === typeFilter) && (!search || r.name.toLowerCase().includes(search.toLowerCase()))),
    [rooms, typeFilter, search]
  )

  const openAdd = () => {
    setEditingRoom(null)
    setRoomName('')
    setRoomType('Room')
    setRoomCapacity(40)
    setRoomModal(true)
  }
  const openEdit = (room, e) => {
    e.stopPropagation()
    setEditingRoom(room)
    setRoomName(room.name)
    setRoomType(room.type)
    setRoomCapacity(room.capacity || 0)
    setRoomModal(true)
  }

  const handleSaveRoom = async (e) => {
    e.preventDefault()
    if (!roomName.trim()) return
    const row = { name: roomName.trim(), type: roomType, capacity: parseInt(roomCapacity, 10) || 0 }
    setSaving(true)
    try {
      const { error } = editingRoom
        ? await supabase.from('rooms').update(row).eq('id', editingRoom.id)
        : await supabase.from('rooms').insert([{ ...row, department_id: department.id }])
      if (error) throw error
      setFeedback({ type: 'success', message: editingRoom ? `${row.name} updated.` : `${row.name} added to ${department.name}.` })
      setRoomModal(false)
      loadData()
      onDepartmentUpdated?.()
    } catch (err) {
      setFeedback({ type: 'error', message: `Could not save room: ${err.message}` })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRoom = async () => {
    if (!deleteRoom) return
    setSaving(true)
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', deleteRoom.id)
      if (error) throw error
      setFeedback({ type: 'success', message: `${deleteRoom.name} and its bookings were removed.` })
      setDeleteRoom(null)
      loadData()
      onDepartmentUpdated?.()
    } catch (err) {
      setFeedback({ type: 'error', message: `Could not delete room: ${err.message}` })
    } finally {
      setSaving(false)
    }
  }

  // Level 3: the 8-period grid for one room
  if (activeRoom) {
    return (
      <RoomSlots
        room={activeRoom}
        department={department}
        onBack={() => {
          setActiveRoom(null)
          loadData()
        }}
      />
    )
  }

  return (
    <div>
      <Toast feedback={feedback} onClose={() => setFeedback(null)} />

      <PageHeader
        onBack={onBack}
        backLabel="All departments"
        title={department.name}
        subtitle={`${department.code} · ${rooms.length} lab${rooms.length === 1 ? '' : 's'} & classroom${rooms.length === 1 ? '' : 's'}. Today's periods are shown on each card.`}
        actions={
          isAdmin && (
            <button type="button" onClick={openAdd} className="btn-primary">
              <Plus className="w-4 h-4" /> Add room
            </button>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
          <div className="inline-flex gap-2 min-w-max">
            {['All', 'Lab', 'Room', 'Hall'].map((t) => {
              const count = t === 'All' ? rooms.length : rooms.filter((r) => r.type === t).length
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`min-h-[40px] px-4 rounded-xl text-sm font-bold border-[1.5px] transition whitespace-nowrap ${
                    typeFilter === t ? 'bg-brand-700 text-white border-brand-900 shadow-elev-blue' : 'bg-white text-slate-700 border-slate-800 shadow-elev-sm'
                  }`}
                >
                  {t === 'All' ? 'All' : TYPE_META[t].label + 's'} <span className="opacity-70">({count})</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a room" className="input pl-10" />
          </div>
          <button type="button" onClick={loadData} disabled={loading} aria-label="Refresh" className="btn-secondary w-[46px] px-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading rooms..." />
      ) : fetchError ? (
        <ErrorState title="Could not load rooms" text={fetchError} onRetry={loadData} />
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="No rooms here"
          text={search ? `Nothing matched "${search}".` : typeFilter !== 'All' ? 'No rooms of this type in this department.' : 'No labs or classrooms have been added yet.'}
          action={isAdmin && (<button type="button" onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add the first room</button>)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredRooms.map((room) => {
            const meta = TYPE_META[room.type] || TYPE_META.Room
            const states = roomStates(room.id)
            const liveIdx = periods.findIndex((p, i) => states[i].live)
            const live = liveIdx >= 0 ? states[liveIdx] : null
            const freeCount = states.filter((s) => s.status === 'available').length
            return (
              <div key={room.id} className="elev overflow-hidden">
                <button type="button" onClick={() => setActiveRoom(room)} className="w-full text-left p-4 sm:p-5 group focus-visible:outline-none focus-visible:bg-brand-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-11 h-11 shrink-0 rounded-xl bg-brand-50 text-brand-700 border-[1.5px] border-brand-300 flex items-center justify-center">
                        <meta.icon className="w-5 h-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold text-slate-900 leading-snug truncate">{room.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                            <Users className="w-3.5 h-3.5" /> {room.capacity} seats
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-700 mt-1 shrink-0" />
                  </div>

                  <div className="mt-4">
                    <MiniStrip states={states} />
                    <div className="mt-2 flex items-center justify-between text-xs font-bold">
                      {live ? (
                        live.status === 'booked' ? (
                          <span className="text-red-700">In use · until {fmt12(periods[liveIdx].end)}</span>
                        ) : (
                          <span className="text-emerald-700">Free right now</span>
                        )
                      ) : (
                        <span className="text-slate-500">No period running</span>
                      )}
                      <span className="text-slate-600">{freeCount} of {periods.length} periods free today</span>
                    </div>
                  </div>
                </button>

                {isAdmin && (
                  <div className="px-3 py-2 bg-slate-50 border-t-[1.5px] border-slate-300 flex justify-end gap-1">
                    <button type="button" onClick={(e) => openEdit(room, e)} className="btn-ghost btn-sm"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setDeleteRoom(room) }} className="btn-ghost btn-sm text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Sheet
        open={roomModal}
        onClose={() => setRoomModal(false)}
        icon={editingRoom ? Pencil : Plus}
        title={editingRoom ? 'Edit room' : 'Add lab or classroom'}
        subtitle={department.name}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setRoomModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" form="room-form" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : editingRoom ? 'Save changes' : 'Create room'}</button>
          </div>
        }
      >
        <form id="room-form" onSubmit={handleSaveRoom} className="space-y-4">
          <div>
            <label className="field-label">Room name</label>
            <input className="input" required value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="e.g. Networks Lab, LH-201" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Type</label>
              <select className="input" value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                <option value="Room">Classroom</option>
                <option value="Lab">Lab</option>
                <option value="Hall">Hall</option>
              </select>
            </div>
            <div>
              <label className="field-label">Seats</label>
              <input className="input" type="number" inputMode="numeric" min="1" required value={roomCapacity} onChange={(e) => setRoomCapacity(e.target.value)} />
            </div>
          </div>
        </form>
      </Sheet>

      <Sheet
        open={!!deleteRoom}
        onClose={() => setDeleteRoom(null)}
        icon={Trash2}
        tone="red"
        title="Delete this room?"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setDeleteRoom(null)} className="btn-secondary flex-1">Keep it</button>
            <button type="button" onClick={handleDeleteRoom} disabled={saving} className="btn-danger flex-1">{saving ? 'Deleting...' : 'Delete'}</button>
          </div>
        }
      >
        <p className="text-sm text-slate-700"><strong>{deleteRoom?.name}</strong> will be removed.</p>
        <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border-[1.5px] border-amber-600 text-sm text-amber-950 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>Every past and upcoming booking for this room is deleted too.</span>
        </div>
      </Sheet>
    </div>
  )
}
