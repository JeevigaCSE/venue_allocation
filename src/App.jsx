import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import Navbar, { BottomNav } from './components/Navbar'
import Footer from './components/Footer'
import AdminPanel from './pages/AdminPanel'
import DepartmentsPage from './pages/DepartmentsPage'
import MyBookingsPage from './pages/MyBookingsPage'
import SetNewPasswordModal from './components/SetNewPasswordModal'
import RequestNotifications from './components/RequestNotifications'
import { Building2, RefreshCw } from 'lucide-react'
import { supabase } from './lib/supabase'
import { refreshPeriods } from './lib/schedule'
import { isCancellationNotice } from './lib/bookingRequests'

function AppContent() {
  const { user, loading, isApproved, isAdmin, isPasswordRecovery } = useAuth()
  const [activeTab, setActiveTab] = useState('departments') // 'departments' | 'my-bookings' | 'admin'
  const [deptResetTrigger, setDeptResetTrigger] = useState(0)
  const [adminBadge, setAdminBadge] = useState(0)

  // Load the admin's 8-period timings once the user is signed in
  useEffect(() => {
    if (user && isApproved) refreshPeriods()
  }, [user, isApproved])

  // Admin: number of things waiting for a decision (shown on the Admin tab)
  useEffect(() => {
    if (!isAdmin) {
      setAdminBadge(0)
      return
    }
    let alive = true
    const count = async () => {
      try {
        const [{ data: reqs }, { count: staff }] = await Promise.all([
          supabase.from('override_requests').select('priority_reason').eq('status', 'pending'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_approved', false),
        ])
        if (alive) setAdminBadge((reqs || []).filter((r) => !isCancellationNotice(r)).length + (staff || 0))
      } catch (e) {
        /* badge is optional */
      }
    }
    count()
    const t = setInterval(count, 45000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [isAdmin, activeTab])

  const handleTabChange = (tab) => {
    if (tab === 'departments') setDeptResetTrigger((p) => p + 1)
    setActiveTab(tab === 'admin' && !isAdmin ? 'departments' : tab)
    window.scrollTo({ top: 0 })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-800 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-16 h-16 rounded-2xl bg-white text-brand-800 border-[1.5px] border-slate-900 shadow-elev flex items-center justify-center mb-5">
          <Building2 className="w-8 h-8" />
        </div>
        <div className="flex items-center gap-2 text-sm text-brand-100">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Signing you in...</span>
        </div>
      </div>
    )
  }

  if (isPasswordRecovery) {
    return (
      <div className="min-h-screen bg-brand-800 flex items-center justify-center p-4">
        <SetNewPasswordModal />
      </div>
    )
  }

  if (!user || !isApproved) return <AuthPage />

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar activeTab={activeTab} onTabChange={handleTabChange} adminBadge={adminBadge} />
      <RequestNotifications onView={!isAdmin ? () => setActiveTab('my-bookings') : undefined} />

      {/* pb leaves room for the phone bottom tab bar */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 pb-8">
        {activeTab === 'departments' && <DepartmentsPage resetTrigger={deptResetTrigger} />}
        {activeTab === 'my-bookings' && (
          <MyBookingsPage
            onNavigateToDepartments={() => {
              setDeptResetTrigger((p) => p + 1)
              setActiveTab('departments')
            }}
          />
        )}
        {activeTab === 'admin' && isAdmin && <AdminPanel />}
      </main>

      <Footer className="pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0" />
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} adminBadge={adminBadge} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
