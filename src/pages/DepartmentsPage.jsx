import React, { useState, useEffect } from 'react'
import { Building2, DoorOpen, Plus, Pencil, Trash2, Search, RefreshCw, ChevronRight, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import DepartmentDetail from '../components/DepartmentDetail'
import { Spinner, EmptyState, ErrorState, Toast, Sheet, PageHeader } from '../components/ui'
import { isScheduleRow } from '../lib/schedule'

export default function DepartmentsPage({ resetTrigger }) {
  const { isAdmin } = useAuth()

  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [selectedDept, setSelectedDept] = useState(null)

  const [modal, setModal] = useState(null) // 'add' | 'edit' | 'delete'
  const [submitting, setSubmitting] = useState(false)
  const [currentDept, setCurrentDept] = useState(null)
  const [deptName, setDeptName] = useState('')
  const [deptCode, setDeptCode] = useState('')
  const [deptOrder, setDeptOrder] = useState(0)

  useEffect(() => {
    if (resetTrigger) setSelectedDept(null)
  }, [resetTrigger])

  const loadDepartments = async (preserveSelected = false) => {
    setLoading(true)
    setFetchError(null)
    try {
      const { data: deptData, error } = await supabase.from('departments').select('*').order('display_order', { ascending: true })
      if (error) throw error

      const counts = {}
      try {
        const { data: roomsData } = await supabase.from('rooms').select('id, department_id')
        ;(roomsData || []).forEach((r) => (counts[r.department_id] = (counts[r.department_id] || 0) + 1))
      } catch (e) {
        console.warn('Could not fetch room counts:', e)
      }

      // The hidden period-timings row is not a real department
      const merged = (deptData || []).filter((d) => !isScheduleRow(d)).map((d) => ({ ...d, roomCount: counts[d.id] || 0 }))
      setDepartments(merged)
      if (preserveSelected) setSelectedDept((prev) => (prev ? merged.find((m) => m.id === prev.id) || null : null))
    } catch (err) {
      console.error('Error fetching departments:', err)
      setFetchError(err.message || 'Could not load departments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDepartments()
  }, [])

  const openAdd = () => {
    setDeptName('')
    setDeptCode('')
    setDeptOrder(departments.length ? Math.max(...departments.map((d) => d.display_order || 0)) + 1 : 1)
    setModal('add')
  }
  const openEdit = (dept, e) => {
    e.stopPropagation()
    setCurrentDept(dept)
    setDeptName(dept.name)
    setDeptCode(dept.code)
    setDeptOrder(dept.display_order || 0)
    setModal('edit')
  }
  const openDelete = (dept, e) => {
    e.stopPropagation()
    setCurrentDept(dept)
    setModal('delete')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!deptName.trim() || !deptCode.trim()) return
    const row = { name: deptName.trim(), code: deptCode.trim().toUpperCase(), display_order: parseInt(deptOrder, 10) || 0 }
    setSubmitting(true)
    try {
      const { error } =
        modal === 'add'
          ? await supabase.from('departments').insert([row])
          : await supabase.from('departments').update(row).eq('id', currentDept.id)
      if (error) throw error
      setFeedback({ type: 'success', message: modal === 'add' ? `${row.name} (${row.code}) added.` : 'Department updated.' })
      setModal(null)
      loadDepartments()
    } catch (err) {
      setFeedback({ type: 'error', message: `Could not save department: ${err.message}` })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!currentDept) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('departments').delete().eq('id', currentDept.id)
      if (error) throw error
      setFeedback({ type: 'success', message: `${currentDept.name} and its rooms were removed.` })
      if (selectedDept?.id === currentDept.id) setSelectedDept(null)
      setModal(null)
      loadDepartments()
    } catch (err) {
      setFeedback({ type: 'error', message: `Could not delete department: ${err.message}` })
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = departments.filter((d) => {
    const q = searchTerm.toLowerCase()
    return d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
  })

  if (selectedDept) {
    return (
      <DepartmentDetail
        department={selectedDept}
        onBack={() => {
          setSelectedDept(null)
          loadDepartments(false)
        }}
        onDepartmentUpdated={() => loadDepartments(true)}
      />
    )
  }

  return (
    <div>
      <Toast feedback={feedback} onClose={() => setFeedback(null)} />

      <PageHeader
        title="Choose a department"
        subtitle="Then pick a lab or classroom to see its 8 periods."
        actions={
          isAdmin && (
            <button type="button" onClick={openAdd} className="btn-primary">
              <Plus className="w-4 h-4" /> Add department
            </button>
          )
        }
      />

      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name or code" className="input pl-10" />
        </div>
        <button type="button" onClick={() => loadDepartments()} disabled={loading} aria-label="Reload departments" className="btn-secondary w-[46px] px-0">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <Spinner label="Loading departments..." />
      ) : fetchError ? (
        <ErrorState title="Could not load departments" text={fetchError} onRetry={() => loadDepartments()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments found"
          text={searchTerm ? `Nothing matched "${searchTerm}".` : 'No departments have been created yet.'}
          action={isAdmin && !searchTerm && (<button type="button" onClick={openAdd} className="btn-primary"><Plus className="w-4 h-4" /> Add department</button>)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((dept) => (
            <div key={dept.id} className="elev flex flex-col overflow-hidden transition active:translate-y-0.5">
              <button type="button" onClick={() => setSelectedDept(dept)} className="text-left p-5 flex-1 group focus-visible:outline-none focus-visible:bg-brand-50">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center justify-center min-w-[52px] h-10 px-3 rounded-xl bg-brand-700 text-white font-extrabold text-sm border-[1.5px] border-brand-900">
                    {dept.code}
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-700 group-hover:translate-x-0.5 transition" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 leading-snug">{dept.name}</h3>
                <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-600 font-semibold">
                  <DoorOpen className="w-4 h-4 text-brand-600" />
                  {dept.roomCount} {dept.roomCount === 1 ? 'lab / classroom' : 'labs & classrooms'}
                </div>
              </button>
              {isAdmin && (
                <div className="px-3 py-2 bg-slate-50 border-t-[1.5px] border-slate-300 flex items-center justify-end gap-1">
                  <button type="button" onClick={(e) => openEdit(dept, e)} className="btn-ghost btn-sm"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                  <button type="button" onClick={(e) => openDelete(dept, e)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / edit */}
      <Sheet
        open={modal === 'add' || modal === 'edit'}
        onClose={() => setModal(null)}
        icon={modal === 'add' ? Building2 : Pencil}
        title={modal === 'add' ? 'Add department' : 'Edit department'}
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" form="dept-form" disabled={submitting} className="btn-primary flex-1">{submitting ? 'Saving...' : modal === 'add' ? 'Create' : 'Save changes'}</button>
          </div>
        }
      >
        <form id="dept-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="field-label">Department name</label>
            <input className="input" required value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Biotechnology Engineering" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Short code</label>
              <input className="input uppercase" required value={deptCode} onChange={(e) => setDeptCode(e.target.value)} placeholder="BT" />
            </div>
            <div>
              <label className="field-label">Display order</label>
              <input className="input" type="number" inputMode="numeric" min="1" required value={deptOrder} onChange={(e) => setDeptOrder(e.target.value)} />
            </div>
          </div>
        </form>
      </Sheet>

      {/* Delete */}
      <Sheet
        open={modal === 'delete'}
        onClose={() => setModal(null)}
        icon={Trash2}
        tone="red"
        title="Delete this department?"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Keep it</button>
            <button type="button" onClick={handleDelete} disabled={submitting} className="btn-danger flex-1">{submitting ? 'Deleting...' : 'Delete'}</button>
          </div>
        }
      >
        <p className="text-sm text-slate-700"><strong>{currentDept?.name}</strong> ({currentDept?.code}) will be removed.</p>
        <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border-[1.5px] border-amber-600 text-sm text-amber-950 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>All its rooms and every booking in them are deleted too. This cannot be undone.</span>
        </div>
      </Sheet>
    </div>
  )
}
