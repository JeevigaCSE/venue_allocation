import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import Navbar from './components/Navbar'
import AdminPanel from './pages/AdminPanel'
import DepartmentsPage from './pages/DepartmentsPage'
import { Building2, RefreshCw } from 'lucide-react'

function AppContent() {
  const { user, profile, loading, isApproved, isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('departments') // 'departments' | 'admin'

  // Global loading state while verifying auth session & approval gate
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 mb-4 animate-pulse">
          <Building2 className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">College Space Portal</h2>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Verifying credentials & authorization...</span>
        </div>
      </div>
    )
  }

  // If user is not authenticated or not approved, show the login / registration page
  if (!user || !isApproved) {
    return <AuthPage />
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'admin' && !isAdmin) {
            setActiveTab('departments')
          } else {
            setActiveTab(tab)
          }
        }}
      />

      <main className="flex-1 pb-16">
        {activeTab === 'departments' && <DepartmentsPage />}
        {activeTab === 'admin' && isAdmin && <AdminPanel />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} College Department & Room Management System. All rights reserved.</span>
          <span className="text-slate-400">Authorized Academic Staff Portal &bull; Phase 3</span>
        </div>
      </footer>
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
