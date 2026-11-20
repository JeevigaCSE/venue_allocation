import React, { useState, useEffect } from 'react'
import {
  Building2,
  DoorOpen,
  Plus,
  Pencil,
  Trash2,
  Search,
  ArrowLeft,
  Calendar,
  Layers,
  Users,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  X,
  AlertCircle,
  ExternalLink,
  SlidersHorizontal,
  BookmarkPlus
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DepartmentDetail from '../components/DepartmentDetail'

// Distinct department color gradients
const BLOCK_THEMES = [
  { from: 'from-blue-600', to: 'to-indigo-700', text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { from: 'from-cyan-600', to: 'to-blue-700', text: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
  { from: 'from-violet-600', to: 'to-purple-700', text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  { from: 'from-amber-600', to: 'to-orange-700', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { from: 'from-emerald-600', to: 'to-teal-700', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { from: 'from-stone-600', to: 'to-slate-700', text: 'text-stone-600', bg: 'bg-stone-50', border: 'border-stone-200' },
  { from: 'from-rose-600', to: 'to-red-700', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  { from: 'from-fuchsia-600', to: 'to-pink-700', text: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
  { from: 'from-slate-700', to: 'to-slate-900', text: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-300' }
]

export default function DepartmentsPage() {
  const { profile, isAdmin } = useAuth()

  // Departments & Rooms State
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState(null)

  // Navigation State: Selected Department for Detail View
  const [selectedDept, setSelectedDept] = useState(null)

  // Modal States for Admin
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [submittingModal, setSubmittingModal] = useState(false)

  // Form State for Add / Edit
  const [currentDept, setCurrentDept] = useState(null)
  const [deptName, setDeptName] = useState('')
  const [deptCode, setDeptCode] = useState('')
  const [deptOrder, setDeptOrder] = useState(0)

  // Load Departments and their Room counts
  const loadDepartments = async () => {
    setLoading(true)
    setFetchError(null)

    try {
      // 1. Fetch departments
      const { data: deptData, error: deptErr } = await supabase
        .from('departments')
        .select('*')
        .order('display_order', { ascending: true })

      if (deptErr) {
        throw deptErr
      }

      // 2. Fetch rooms to calculate counts per department
      let counts = {}
      try {
        const { data: roomsData } = await supabase
          .from('rooms')
          .select('id, department_id')

        if (roomsData) {
          roomsData.forEach((r) => {
            counts[r.department_id] = (counts[r.department_id] || 0) + 1
          })
        }
      } catch (rErr) {
        console.warn('Could not fetch room counts:', rErr)
      }

      // Merge count into department records
      const merged = (deptData || []).map((d) => ({
        ...d,
        roomCount: counts[d.id] || 0
      }))

      setDepartments(merged)

      // If a department is currently selected, refresh its details
      if (selectedDept) {
        const updated = merged.find((m) => m.id === selectedDept.id)
        if (updated) setSelectedDept(updated)
      }
    } catch (err) {
      console.error('Error fetching departments:', err)
      setFetchError(err.message || 'Failed to retrieve department listings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDepartments()
  }, [])

  // Auto-dismiss feedback message after 5 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Open Add Modal
  const handleOpenAdd = () => {
    const nextOrder = departments.length > 0
      ? Math.max(...departments.map((d) => d.display_order || 0)) + 1
      : 1
    setDeptName('')
    setDeptCode('')
    setDeptOrder(nextOrder)
    setIsAddModalOpen(true)
  }

  // Submit Add Department
  const handleAddSubmit = async (e) => {
    e.preventDefault()
    if (!deptName.trim() || !deptCode.trim()) return

    setSubmittingModal(true)
    try {
      const { data, error } = await supabase
        .from('departments')
        .insert([
          {
            name: deptName.trim(),
            code: deptCode.trim().toUpperCase(),
            display_order: parseInt(deptOrder, 10) || 0
          }
        ])
        .select()
        .single()

      if (error) throw error

      setFeedback({
        type: 'success',
        message: `Department "${deptName}" (${deptCode.toUpperCase()}) added successfully!`
      })
      setIsAddModalOpen(false)
      loadDepartments()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to add department: ${err.message}`
      })
    } finally {
      setSubmittingModal(false)
    }
  }

  // Open Edit Modal
  const handleOpenEdit = (dept, e) => {
    e.stopPropagation() // Prevent opening detail view
    setCurrentDept(dept)
    setDeptName(dept.name)
    setDeptCode(dept.code)
    setDeptOrder(dept.display_order || 0)
    setIsEditModalOpen(true)
  }

  // Submit Edit Department
  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!currentDept || !deptName.trim() || !deptCode.trim()) return

    setSubmittingModal(true)
    try {
      const { error } = await supabase
        .from('departments')
        .update({
          name: deptName.trim(),
          code: deptCode.trim().toUpperCase(),
          display_order: parseInt(deptOrder, 10) || 0
        })
        .eq('id', currentDept.id)

      if (error) throw error

      setFeedback({
        type: 'success',
        message: `Department updated successfully!`
      })
      setIsEditModalOpen(false)
      loadDepartments()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to update department: ${err.message}`
      })
    } finally {
      setSubmittingModal(false)
    }
  }

  // Open Delete Confirmation Modal
  const handleOpenDelete = (dept, e) => {
    e.stopPropagation() // Prevent opening detail view
    setCurrentDept(dept)
    setIsDeleteModalOpen(true)
  }

  // Confirm Delete Department
  const handleDeleteConfirm = async () => {
    if (!currentDept) return

    setSubmittingModal(true)
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', currentDept.id)

      if (error) throw error

      setFeedback({
        type: 'success',
        message: `Department "${currentDept.name}" and all associated rooms have been removed.`
      })

      // If user was viewing this department, return to grid
      if (selectedDept && selectedDept.id === currentDept.id) {
        setSelectedDept(null)
      }

      setIsDeleteModalOpen(false)
      loadDepartments()
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to delete department: ${err.message}`
      })
    } finally {
      setSubmittingModal(false)
    }
  }

  // Filter departments by search
  const filteredDepartments = departments.filter((d) => {
    const q = searchTerm.toLowerCase()
    return (
      d.name.toLowerCase().includes(q) ||
      d.code.toLowerCase().includes(q)
    )
  })

  // --------------------------------------------------------------------------
  // DETAIL VIEW: When a department card is clicked
  // --------------------------------------------------------------------------
  if (selectedDept) {
    return (
      <DepartmentDetail
        department={selectedDept}
        onBack={() => {
          setSelectedDept(null)
          loadDepartments()
        }}
        onDepartmentUpdated={() => {
          loadDepartments()
        }}
      />
    )
  }

  // --------------------------------------------------------------------------
  // GRID VIEW: All Departments
  // --------------------------------------------------------------------------
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

      {/* Main Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-indigo-800/40 mb-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 mb-3">
              <Layers className="w-3.5 h-3.5 text-indigo-300" />
              <span>Campus Infrastructure Overview</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Department Blocks & Facilities
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 leading-relaxed">
              Select any department block to browse its seminar halls, classrooms, and laboratory booking availability.
            </p>
          </div>

          {/* Admin "+ Add Department" Action Button */}
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition border border-indigo-500/30 self-start md:self-center"
            >
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: Search, Count & Refresh */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by department name or code (e.g., CSE, Civil)..."
            className="w-full pl-10 pr-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
          />
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-800">{filteredDepartments.length}</strong> of{' '}
            <strong className="text-slate-800">{departments.length}</strong> blocks
          </span>
          <button
            type="button"
            onClick={loadDepartments}
            disabled={loading}
            title="Reload departments"
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading department blocks...</p>
          <p className="text-xs text-slate-400 mt-1">Connecting to Supabase PostgreSQL database</p>
        </div>
      ) : fetchError ? (
        /* Error State */
        <div className="bg-white rounded-3xl border border-red-200 p-10 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Unable to Load Departments
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mb-4">
            {fetchError}
          </p>
          <button
            type="button"
            onClick={loadDepartments}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredDepartments.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">No Departments Found</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-6">
            {searchTerm
              ? `No department blocks matched "${searchTerm}". Try clearing your search.`
              : 'The departments table has not been populated yet.'}
          </p>
          {isAdmin && !searchTerm && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Initial Department</span>
            </button>
          )}
        </div>
      ) : (
        /* Departments Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepartments.map((dept, index) => {
            const theme =
              BLOCK_THEMES[(dept.display_order - 1) % BLOCK_THEMES.length] || BLOCK_THEMES[0]

            return (
              <div
                key={dept.id}
                onClick={() => setSelectedDept(dept)}
                className="group relative bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                {/* Accent Top Bar */}
                <div className={`h-2.5 bg-gradient-to-r ${theme.from} ${theme.to}`} />

                {/* Card Body */}
                <div className="p-6">
                  {/* Code Badge and Display Order */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                      {dept.code}
                    </span>

                    <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                      Block #{dept.display_order}
                    </span>
                  </div>

                  {/* Department Name */}
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition leading-snug mb-2">
                    {dept.name}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    Lecture spaces, smart classrooms, and specialized engineering laboratories.
                  </p>

                  {/* Room Count Pill */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-700">
                    <DoorOpen className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      <strong className="text-slate-900">{dept.roomCount}</strong>{' '}
                      {dept.roomCount === 1 ? 'Room / Hall' : 'Rooms & Halls'}
                    </span>
                  </div>
                </div>

                {/* Footer with Card Actions */}
                <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition inline-flex items-center gap-1">
                    <span>View Rooms</span>
                    <span>&rarr;</span>
                  </span>

                  {/* Admin Only Controls: Edit & Delete (with e.stopPropagation()) */}
                  {isAdmin && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(dept, e)}
                        title="Edit Department"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleOpenDelete(dept, e)}
                        title="Delete Department"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-white border border-transparent hover:border-slate-200 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADD DEPARTMENT (Admin Only) */}
      {/* ===================================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Add New Department
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g., Biotechnology Engineering"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Block Code
                  </label>
                  <input
                    type="text"
                    required
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    placeholder="e.g., BT"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={deptOrder}
                    onChange={(e) => setDeptOrder(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingModal}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {submittingModal ? 'Saving...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: EDIT DEPARTMENT (Admin Only) */}
      {/* ===================================================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Pencil className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Department
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Block Code
                  </label>
                  <input
                    type="text"
                    required
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={deptOrder}
                    onChange={(e) => setDeptOrder(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingModal}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {submittingModal ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: DELETE CONFIRMATION (Admin Only) */}
      {/* ===================================================================== */}
      {isDeleteModalOpen && currentDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-red-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
              Delete Department?
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 text-center mb-4 leading-relaxed">
              Are you sure you want to delete <strong>{currentDept.name}</strong> ({currentDept.code})?
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 mb-6 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Deleting this department will trigger a cascade delete, removing all associated rooms, halls, and historical booking reservations.
              </span>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingModal}
                onClick={handleDeleteConfirm}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-red-600/20 transition disabled:opacity-50"
              >
                {submittingModal ? 'Deleting...' : 'Yes, Delete Department'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
