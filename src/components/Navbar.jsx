import React, { useState } from 'react'
import {
  Building2,
  Shield,
  Layers,
  LogOut,
  User,
  Menu,
  X,
  ChevronRight,
  CalendarCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ activeTab, onTabChange }) {
  const { profile, user, signOut, isAdmin } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut()
  }

  const handleNavClick = (tab) => {
    onTabChange(tab)
    setMobileMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Brand & Navigation */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-base sm:text-lg tracking-tight text-white block leading-tight">
                  Campus Space Portal
                </span>
                <span className="text-[11px] font-medium text-slate-400 block tracking-wide">
                  Department & Room Booking
                </span>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1">
              <button
                type="button"
                onClick={() => handleNavClick('departments')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'departments'
                    ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Departments & Rooms</span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('my-bookings')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'my-bookings'
                    ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <CalendarCheck className="w-4 h-4" />
                <span>My Bookings</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleNavClick('admin')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'admin'
                      ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>Admin Panel</span>
                </button>
              )}
            </nav>
          </div>

          {/* Right: User Profile & Actions */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-3 pl-3 py-1 pr-1 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-semibold">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-200 leading-tight">
                    {profile?.full_name || 'Staff Member'}
                  </span>
                  {profile?.role === 'admin' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Admin
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                      Staff
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 block leading-tight">
                  {profile?.designation || user?.email}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition border border-transparent hover:border-slate-700"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-3 pb-4 space-y-3">
          {/* User Info Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                {profile?.full_name || 'Staff Member'}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  profile?.role === 'admin'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {profile?.role === 'admin' ? 'Admin' : 'Staff'}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {profile?.designation || user?.email}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 rounded-lg"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => handleNavClick('departments')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                activeTab === 'departments'
                  ? 'bg-slate-800 text-indigo-400'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Departments & Rooms
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('my-bookings')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                activeTab === 'my-bookings'
                  ? 'bg-slate-800 text-indigo-400'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <span className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4" />
                My Bookings
              </span>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => handleNavClick('admin')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                  activeTab === 'admin'
                    ? 'bg-indigo-950 text-indigo-300'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  Admin Panel
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
