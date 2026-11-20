import React, { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeft,
  Building2,
  DoorOpen,
  Calendar,
  Clock,
  Plus,
  Pencil,
  Trash2,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  X,
  CalendarDays,
  ShieldAlert,
  ChevronRight,
  Filter,
  Check,
  Info,
  ShieldCheck,
  Send
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Local Date Helper (YYYY-MM-DD)
const getTodayString = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Time Formatting Helper (e.g., "10:00 AM")
const formatDisplayTime = (isoString) => {
  if (!isoString) return ''
  const date = new Date(isoString)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function DepartmentDetail({ department, onBack, onDepartmentUpdated }) {
  const { user, profile, isAdmin } = useAuth()

  // State: Rooms and Bookings
  const [rooms, setRooms] = useState([])
  const [bookings, setBookings] = useState([])
  const [profilesMap, setProfilesMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [feedback, setFeedback] = useState(null)

  // Filters
  const [typeFilter, setTypeFilter] = useState('All') // 'All' | 'Hall' | 'Room' | 'Lab'
  const [selectedDate, setSelectedDate] = useState(getTodayString())
  const [searchRoomQuery, setSearchRoomQuery] = useState('')

  // State: Book Room Modal
  const [bookingModalRoom, setBookingModalRoom] = useState(null)
  const [bookDate, setBookDate] = useState(getTodayString())
  const [bookStartTime, setBookStartTime] = useState('10:00')
  const [bookEndTime, setBookEndTime] = useState('11:00')
  const [bookPurpose, setBookPurpose] = useState('')
  const [bookingError, setBookingError] = useState(null)
  const [submittingBooking, setSubmittingBooking] = useState(false)

  // Conflict & Admin Override State
  const [conflictDetected, setConflictDetected] = useState(false)
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [priorityReason, setPriorityReason] = useState('')
  const [submittingOverride, setSubmittingOverride] = useState(false)

  // State: Admin Add/Edit Room Modal
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomName, setRoomName] = useState('')
  const [roomType, setRoomType] = useState('Room')
  const [roomCapacity, setRoomCapacity] = useState(40)
  const [submittingRoomModal, setSubmittingRoomModal] = useState(false)

  // State: Delete Room Confirmation Modal
  const [deleteModalRoom, setDeleteModalRoom] = useState(null)
  const [submittingDeleteRoom, setSubmittingDeleteRoom] = useState(false)

  // State: Cancel Booking Confirmation Modal
  const [cancelingBooking, setCancelingBooking] = useState(null)
  const [submittingCancelBooking, setSubmittingCancelBooking] = useState(false)

  // Load Department Rooms, Bookings, and Profiles
  const loadData = async () => {
    setLoading(true)
    setFetchError(null)

    try {
      // 1. Fetch Rooms in this Department
      const { data: roomsData, error: roomsErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('department_id', department.id)
        .order('name', { ascending: true })

      if (roomsErr) throw roomsErr
      setRooms(roomsData || [])

      const roomIds = (roomsData || []).map((r) => r.id)

      if (roomIds.length > 0) {
        // 2. Fetch Active and Upcoming Bookings for these rooms
        const { data: bookingsData, error: bookingsErr } = await supabase
          .from('bookings')
          .select('*, profiles(id, full_name, designation, email)')
          .in('room_id', roomIds)
          .order('start_time', { ascending: true })

        if (bookingsErr) {
          console.warn('Booking join error, attempting standalone fetch:', bookingsErr)
          const { data: rawBookings } = await supabase
            .from('bookings')
            .select('*')
            .in('room_id', roomIds)
            .order('start_time', { ascending: true })
          setBookings(rawBookings || [])
        } else {
          setBookings(bookingsData || [])
        }

        // 3. Resilient user profile map
        try {
          const { data: profData } = await supabase
            .from('profiles')
            .select('id, full_name, designation, email')
          if (profData) {
            const map = {}
            profData.forEach((p) => {
              map[p.id] = p
            })
            setProfilesMap(map)
          }
        } catch (pErr) {
          console.warn('Could not fetch profiles lookup:', pErr)
        }
      } else {
        setBookings([])
      }
    } catch (err) {
      console.error('Error loading department rooms/bookings:', err)
      setFetchError(err.message || 'Failed to load department room data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [department.id])

  // Auto-dismiss feedback message
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Real-time ticking indicator for live room status
  const [currentTimestamp, setCurrentTimestamp] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setCurrentTimestamp(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  // Resolve Booker information
  const getBookerInfo = (booking) => {
    if (booking.profiles?.full_name) {
      return {
        name: booking.profiles.full_name,
        designation: booking.profiles.designation || 'Staff Member'
      }
    }
    const mapped = profilesMap[booking.user_id]
    if (mapped?.full_name) {
      return {
        name: mapped.full_name,
        designation: mapped.designation || 'Staff Member'
      }
    }
    return {
      name: 'Faculty Member',
      designation: 'Staff'
    }
  }

  // Check if a room is active RIGHT NOW
  const getActiveBookingNow = (roomId) => {
    const now = currentTimestamp.getTime()
    return bookings.find((b) => {
      if (b.room_id !== roomId) return false
      const start = new Date(b.start_time).getTime()
      const end = new Date(b.end_time).getTime()
      return now >= start && now < end
    })
  }

  // Get bookings for a room on the chosen date
  const getBookingsForDate = (roomId, dateStr) => {
    return bookings.filter((b) => {
      if (b.room_id !== roomId) return false
      const startDate = new Date(b.start_time)
      const year = startDate.getFullYear()
      const month = String(startDate.getMonth() + 1).padStart(2, '0')
      const day = String(startDate.getDate()).padStart(2, '0')
      const bDateStr = `${year}-${month}-${day}`
      return bDateStr === dateStr
    })
  }

  // --------------------------------------------------------------------------
  // BOOK ROOM ACTIONS
  // --------------------------------------------------------------------------
  const handleOpenBookModal = (room) => {
    setBookingModalRoom(room)
    setBookDate(selectedDate)
    setBookStartTime('10:00')
    setBookEndTime('11:00')
    setBookPurpose('')
    setBookingError(null)
    setConflictDetected(false)
    setShowOverrideForm(false)
    setPriorityReason('')
  }

  const handleBookingSubmit = async (e) => {
    e.preventDefault()
    if (!bookingModalRoom) return
    setBookingError(null)
    setConflictDetected(false)

    if (!bookDate || !bookStartTime || !bookEndTime) {
      setBookingError('Please enter date, start time, and end time.')
      return
    }

    if (!bookPurpose.trim()) {
      setBookingError('Please specify the purpose or event name.')
      return
    }

    const startObj = new Date(`${bookDate}T${bookStartTime}:00`)
    const endObj = new Date(`${bookDate}T${bookEndTime}:00`)

    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
      setBookingError('Invalid date or time provided.')
      return
    }

    if (endObj <= startObj) {
      setBookingError('End time must be strictly after the start time.')
      return
    }

    const now = new Date()
    if (endObj <= now) {
      setBookingError('Cannot schedule a room reservation in the past.')
      return
    }

    setSubmittingBooking(true)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([
          {
            room_id: bookingModalRoom.id,
            user_id: user.id,
            purpose: bookPurpose.trim(),
            start_time: startObj.toISOString(),
            end_time: endObj.toISOString()
          }
        ])
        .select('*, profiles(id, full_name, designation, email)')
        .single()

      if (error) {
        // PostgreSQL GiST Exclusion Constraint violation code: 23P01
        if (
          error.code === '23P01' ||
          error.message?.toLowerCase().includes('overlapping') ||
          error.message?.toLowerCase().includes('exclude')
        ) {
          setConflictDetected(true)
          setBookingError(
            'This room is already booked during the selected time slot. Please choose another time, or submit an Admin Override Request if this is an urgent priority.'
          )
          return
        }
        throw error
      }

      setFeedback({
        type: 'success',
        message: `Successfully booked "${bookingModalRoom.name}" for ${bookPurpose.trim()}!`
      })
      setBookingModalRoom(null)
      loadData()
    } catch (err) {
      console.error('Booking error:', err)
      setBookingError(err.message || 'An unexpected error occurred while saving booking.')
    } finally {
      setSubmittingBooking(false)
    }
  }

  // Submit Override Request when conflict exists
  const handleSubmitOverrideRequest = async (e) => {
    e.preventDefault()
    if (!priorityReason.trim()) {
      setBookingError('Please provide a justification for this priority override.')
      return
    }

    const startObj = new Date(`${bookDate}T${bookStartTime}:00`)
    const endObj = new Date(`${bookDate}T${bookEndTime}:00`)

    setSubmittingOverride(true)
    try {
      const { error } = await supabase
        .from('override_requests')
        .insert([
          {
            room_id: bookingModalRoom.id,
            requester_id: user.id,
            purpose: bookPurpose.trim(),
            priority_reason: priorityReason.trim(),
            start_time: startObj.toISOString(),
            end_time: endObj.toISOString(),
            status: 'pending'
          }
        ])

      if (error) throw error

      setFeedback({
        type: 'success',
        message: 'Priority override request submitted to administrators for review.'
      })
      setBookingModalRoom(null)
      setConflictDetected(false)
      setShowOverrideForm(false)
      setPriorityReason('')
    } catch (err) {
      setBookingError(`Failed to submit override request: ${err.message}`)
    } finally {
      setSubmittingOverride(false)
    }
  }

  // --------------------------------------------------------------------------
  // CANCEL BOOKING ACTIONS
  // --------------------------------------------------------------------------
  const handleConfirmCancelBooking = async () => {
    if (!cancelingBooking) return

    setSubmittingCancelBooking(true)
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', cancelingBooking.id)

      if (error) throw error

      setFeedback({
        type: 'success',
        message: 'The reservation has been canceled successfully.'
      })
      setCancelingBooking(null)
      loadData()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to cancel booking: ${err.message}`
      })
    } finally {
      setSubmittingCancelBooking(false)
    }
  }

  // --------------------------------------------------------------------------
  // ADMIN ROOM ACTIONS (Add / Edit / Delete)
  // --------------------------------------------------------------------------
  const handleOpenAddRoom = () => {
    setEditingRoom(null)
    setRoomName('')
    setRoomType('Room')
    setRoomCapacity(40)
    setIsRoomModalOpen(true)
  }

  const handleOpenEditRoom = (room) => {
    setEditingRoom(room)
    setRoomName(room.name)
    setRoomType(room.type)
    setRoomCapacity(room.capacity || 0)
    setIsRoomModalOpen(true)
  }

  const handleSaveRoomSubmit = async (e) => {
    e.preventDefault()
    if (!roomName.trim()) return

    setSubmittingRoomModal(true)
    try {
      if (editingRoom) {
        const { error } = await supabase
          .from('rooms')
          .update({
            name: roomName.trim(),
            type: roomType,
            capacity: parseInt(roomCapacity, 10) || 0
          })
          .eq('id', editingRoom.id)

        if (error) throw error

        setFeedback({
          type: 'success',
          message: `Room "${roomName}" updated successfully.`
        })
      } else {
        const { error } = await supabase.from('rooms').insert([
          {
            department_id: department.id,
            name: roomName.trim(),
            type: roomType,
            capacity: parseInt(roomCapacity, 10) || 0
          }
        ])

        if (error) throw error

        setFeedback({
          type: 'success',
          message: `Room "${roomName}" added to ${department.name}.`
        })
      }

      setIsRoomModalOpen(false)
      loadData()
      if (onDepartmentUpdated) onDepartmentUpdated()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to save room: ${err.message}`
      })
    } finally {
      setSubmittingRoomModal(false)
    }
  }

  const handleConfirmDeleteRoom = async () => {
    if (!deleteModalRoom) return

    setSubmittingDeleteRoom(true)
    try {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', deleteModalRoom.id)

      if (error) throw error

      setFeedback({
        type: 'success',
        message: `Room "${deleteModalRoom.name}" and its bookings were removed.`
      })
      setDeleteModalRoom(null)
      loadData()
      if (onDepartmentUpdated) onDepartmentUpdated()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to delete room: ${err.message}`
      })
    } finally {
      setSubmittingDeleteRoom(false)
    }
  }

  // Filtered rooms by category tab and search query
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesType = typeFilter === 'All' ? true : r.type === typeFilter
      const query = searchRoomQuery.toLowerCase()
      const matchesSearch = !query || r.name.toLowerCase().includes(query)
      return matchesType && matchesSearch
    })
  }, [rooms, typeFilter, searchRoomQuery])

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

      {/* Top Navigation & Back Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm transition self-start"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Back to All Departments</span>
        </button>

        {/* Admin Action: + Add Room / Hall / Lab */}
        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenAddRoom}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-600/20 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Room / Hall / Lab</span>
          </button>
        )}
      </div>

      {/* Department Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-900/50 mb-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-4 rounded-2xl bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-500/20">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  {department.code}
                </span>
                <span className="text-xs text-slate-300">
                  Block Order #{department.display_order}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {department.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Real-Time Room Management & Conflict-Free Slot Reservations
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 px-6 self-start md:self-auto">
            <div className="text-center pr-4 border-r border-slate-700">
              <div className="text-2xl font-bold text-white">{rooms.length}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Spaces Listed
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-400">{bookings.length}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Active Bookings
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Categories, Date Picker, Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Category Filter Tabs */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
          {['All', 'Hall', 'Room', 'Lab'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                typeFilter === type
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {type === 'All' ? 'All Spaces' : `${type}s`}
              {type !== 'All' && (
                <span className="ml-1 text-[10px] text-slate-400">
                  ({rooms.filter((r) => r.type === type).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Date Selector & Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
            />
            {selectedDate !== getTodayString() && (
              <button
                type="button"
                onClick={() => setSelectedDate(getTodayString())}
                className="px-2 py-0.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded"
              >
                Today
              </button>
            )}
          </div>

          {/* Search Room */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchRoomQuery}
              onChange={(e) => setSearchRoomQuery(e.target.value)}
              placeholder="Filter rooms by name..."
              className="w-full sm:w-48 pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Refresh room schedules"
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition disabled:opacity-50 self-end sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading rooms and active schedules...</p>
        </div>
      ) : fetchError ? (
        <div className="bg-white rounded-3xl border border-red-200 p-10 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Failed to load department spaces</h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mb-4">{fetchError}</p>
          <button
            type="button"
            onClick={loadData}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <DoorOpen className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">No Spaces Available</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
            {searchRoomQuery
              ? `No spaces matched "${searchRoomQuery}".`
              : typeFilter !== 'All'
              ? `There are no ${typeFilter}s registered under ${department.name}.`
              : `No rooms, seminar halls, or laboratories have been created for ${department.name} yet.`}
          </p>
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAddRoom}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Initial Room</span>
            </button>
          )}
        </div>
      ) : (
        /* ROOM CARDS GRID */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredRooms.map((room) => {
            const activeBookingNow = getActiveBookingNow(room.id)
            const dateBookings = getBookingsForDate(room.id, selectedDate)

            const typeBadgeColor =
              room.type === 'Hall'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : room.type === 'Lab'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'

            return (
              <div
                key={room.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                {/* Room Header */}
                <div className="p-5 sm:p-6 pb-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`font-semibold text-xs px-2.5 py-0.5 rounded-full border ${typeBadgeColor}`}
                        >
                          {room.type}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>Cap: {room.capacity} seats</span>
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 leading-snug">
                        {room.name}
                      </h3>
                    </div>

                    {/* Admin Actions: Edit & Delete */}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditRoom(room)}
                          title="Edit Room Details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModalRoom(room)}
                          title="Delete Room"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* LIVE STATUS BADGE */}
                  <div className="mt-3">
                    {activeBookingNow ? (
                      (() => {
                        const booker = getBookerInfo(activeBookingNow)
                        return (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/90 text-amber-900 text-xs">
                            <div className="flex items-center gap-2 font-bold text-amber-800 mb-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                              <span className="w-2 h-2 rounded-full bg-amber-600 -ml-3.5"></span>
                              <span>Occupied Right Now</span>
                            </div>
                            <p className="text-amber-950 font-medium">
                              Assigned to <strong className="font-semibold">{booker.name}</strong>{' '}
                              ({booker.designation}) &bull;{' '}
                              <span className="font-semibold font-mono">
                                {formatDisplayTime(activeBookingNow.start_time)} –{' '}
                                {formatDisplayTime(activeBookingNow.end_time)}
                              </span>
                            </p>
                            <p className="text-[11px] text-amber-800/80 mt-0.5">
                              Event: {activeBookingNow.purpose}
                            </p>
                          </div>
                        )
                      })()
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>Available Now</span>
                      </div>
                    )}
                  </div>

                  {/* SCHEDULE LIST FOR SELECTED DATE */}
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Schedule for {selectedDate === getTodayString() ? 'Today' : selectedDate}:
                        </span>
                      </h4>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {dateBookings.length} {dateBookings.length === 1 ? 'Booking' : 'Bookings'}
                      </span>
                    </div>

                    {dateBookings.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        No reservations on this date — all slots available.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {dateBookings.map((b) => {
                          const booker = getBookerInfo(b)
                          const canCancel = b.user_id === user.id || isAdmin

                          return (
                            <div
                              key={b.id}
                              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 font-mono font-bold text-slate-800">
                                  <span>
                                    {formatDisplayTime(b.start_time)} – {formatDisplayTime(b.end_time)}
                                  </span>
                                  {b.user_id === user.id && (
                                    <span className="text-[10px] font-sans font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                                      Your Booking
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-600 truncate mt-0.5">
                                  <strong className="text-slate-700">{booker.name}</strong> ({booker.designation}) &bull;{' '}
                                  <span className="text-slate-500">{b.purpose}</span>
                                </div>
                              </div>

                              {/* Cancel Booking Action */}
                              {canCancel && (
                                <button
                                  type="button"
                                  onClick={() => setCancelingBooking(b)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition shrink-0"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action: Book Room Button */}
                <div className="px-5 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Conflict-checked reservations
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenBookModal(room)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-indigo-600/20 transition"
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Book Room</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: BOOK ROOM (With Conflict & Admin Override Support) */}
      {/* ===================================================================== */}
      {bookingModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Book {bookingModalRoom.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {department.name} &bull; {bookingModalRoom.type} (Cap: {bookingModalRoom.capacity})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookingModalRoom(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Notification inside Modal */}
            {bookingError && (
              <div className="mx-6 mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{bookingError}</div>
              </div>
            )}

            {/* Conflict Detected & Override Request Option */}
            {conflictDetected && (
              <div className="mx-6 mt-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-amber-900">Room Is Currently Occupied</p>
                    <p className="mt-0.5 text-amber-800 leading-relaxed">
                      Another department session or faculty event is already scheduled for this slot. If this is an urgent college necessity (e.g. university exam, statutory inspection), you may submit an Admin Override Request.
                    </p>

                    {!showOverrideForm ? (
                      <button
                        type="button"
                        onClick={() => setShowOverrideForm(true)}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-sm transition"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Request Admin Override</span>
                      </button>
                    ) : (
                      <form onSubmit={handleSubmitOverrideRequest} className="mt-3 pt-3 border-t border-amber-200 space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                            Priority Justification / Reason
                          </label>
                          <textarea
                            required
                            rows={3}
                            value={priorityReason}
                            onChange={(e) => setPriorityReason(e.target.value)}
                            placeholder="State the urgency (e.g., Scheduled University Semester Exam, NAAC Peer Inspection, Department HOD meeting)..."
                            className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowOverrideForm(false)}
                            className="px-3 py-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900"
                          >
                            Cancel Request
                          </button>
                          <button
                            type="submit"
                            disabled={submittingOverride}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{submittingOverride ? 'Submitting...' : 'Submit Override Request'}</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Standard Booking Form */}
            <form onSubmit={handleBookingSubmit} className="p-6 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Reservation Date
                </label>
                <input
                  type="date"
                  required
                  value={bookDate}
                  min={getTodayString()}
                  onChange={(e) => setBookDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              {/* Start & End Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={bookStartTime}
                    onChange={(e) => setBookStartTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={bookEndTime}
                    onChange={(e) => setBookEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
              </div>

              {/* Purpose / Event Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Purpose / Event Name
                </label>
                <input
                  type="text"
                  required
                  value={bookPurpose}
                  onChange={(e) => setBookPurpose(e.target.value)}
                  placeholder="e.g., Guest Lecture, Department Meeting, Lab Exam"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  The database guarantees conflict prevention. Overlapping bookings for the same room will be automatically detected and blocked.
                </span>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBookingModalRoom(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBooking || conflictDetected}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {submittingBooking ? 'Reserving...' : 'Confirm Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CANCEL BOOKING CONFIRMATION */}
      {/* ===================================================================== */}
      {cancelingBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-red-100 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
              Cancel Reservation?
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 text-center mb-4 leading-relaxed">
              Are you sure you want to cancel the booking for{' '}
              <strong>"{cancelingBooking.purpose}"</strong> scheduled on{' '}
              <span className="font-semibold">
                {new Date(cancelingBooking.start_time).toLocaleDateString()}
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
                disabled={submittingCancelBooking}
                onClick={handleConfirmCancelBooking}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
              >
                {submittingCancelBooking ? 'Canceling...' : 'Yes, Cancel Reservation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADMIN ADD / EDIT ROOM */}
      {/* ===================================================================== */}
      {isRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  {editingRoom ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRoom ? 'Edit Space Details' : 'Add Room / Hall / Lab'}
                  </h3>
                  <p className="text-xs text-slate-500">{department.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRoomModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoomSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Space / Room Name
                </label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g., Seminar Hall A, Lab 3, LH-201"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Space Type
                  </label>
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  >
                    <option value="Room">Room (Classroom)</option>
                    <option value="Hall">Hall (Auditorium)</option>
                    <option value="Lab">Lab (Laboratory)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Seating Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={roomCapacity}
                    onChange={(e) => setRoomCapacity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRoomModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRoomModal}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {submittingRoomModal ? 'Saving...' : editingRoom ? 'Save Changes' : 'Create Space'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADMIN DELETE ROOM CONFIRMATION */}
      {/* ===================================================================== */}
      {deleteModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-red-100 p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
              Delete Space?
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 text-center mb-4 leading-relaxed">
              Are you sure you want to delete <strong>{deleteModalRoom.name}</strong> ({deleteModalRoom.type})?
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 mb-6 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Deleting this room will permanently erase its entire historical and upcoming booking records.
              </span>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalRoom(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingDeleteRoom}
                onClick={handleConfirmDeleteRoom}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-red-600/20 transition disabled:opacity-50"
              >
                {submittingDeleteRoom ? 'Deleting...' : 'Yes, Delete Room'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
