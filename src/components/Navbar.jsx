import React, { useState } from 'react'
import { Building2, Shield, Layers, LogOut, CalendarCheck, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { APP_CONFIG } from '../lib/config'

const useTabs = (isAdmin) => [
  { id: 'departments', label: 'Venues', icon: Layers },
  { id: 'my-bookings', label: 'My Bookings', icon: CalendarCheck },
  ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: Shield }] : []),
]

// Top header: brand + (desktop) tabs + profile. On phones the tabs move to the bottom bar.
export default function Navbar({ activeTab, onTabChange, adminBadge = 0 }) {
  const { profile, user, signOut, isAdmin } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const tabs = useTabs(isAdmin)
  const initial = (profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-50 bg-brand-800 text-white border-b-[1.5px] border-slate-900 shadow-[0_3px_0_0_#0F172A] pt-safe">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <button type="button" onClick={() => onTabChange('departments')} className="flex items-center gap-3 min-w-0 text-left">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-white text-brand-800 border-[1.5px] border-slate-900 shrink-0">
            <Building2 className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-extrabold text-sm sm:text-base leading-tight truncate">{APP_CONFIG.appName}</span>
            <span className="block text-[11px] text-brand-200 leading-tight truncate">{APP_CONFIG.collegeName}</span>
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-1.5" aria-label="Main">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`relative inline-flex items-center gap-2 px-4 min-h-[42px] rounded-xl text-sm font-bold transition ${
                activeTab === t.id ? 'bg-white text-brand-800' : 'text-brand-100 hover:bg-white/10'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.id === 'admin' && adminBadge > 0 && (
                <span className="min-w-[20px] px-1.5 text-center rounded-full text-[10px] font-extrabold bg-red-600 text-white">{adminBadge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 min-h-[44px] rounded-xl hover:bg-white/10"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="w-9 h-9 rounded-full bg-white text-brand-800 font-extrabold text-sm flex items-center justify-center border-[1.5px] border-slate-900">
              {initial}
            </span>
            <span className="hidden sm:block text-left max-w-[160px]">
              <span className="block text-sm font-bold leading-tight truncate">{profile?.full_name || 'Staff member'}</span>
              <span className="block text-[11px] text-brand-200 leading-tight truncate">{profile?.role === 'admin' ? 'Administrator' : profile?.designation || 'Staff'}</span>
            </span>
            <ChevronDown className="w-4 h-4 text-brand-200" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div role="menu" className="absolute right-0 mt-2 w-64 z-50 bg-white text-slate-900 border-[1.5px] border-slate-800 rounded-2xl shadow-elev overflow-hidden animate-fade-in">
                <div className="p-4 border-b border-slate-200">
                  <div className="font-extrabold text-sm truncate">{profile?.full_name || 'Staff member'}</div>
                  <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                  <div className="text-xs text-brand-700 font-bold mt-1">{profile?.role === 'admin' ? 'Administrator' : profile?.designation || 'Staff'}</div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    signOut()
                  }}
                  className="w-full flex items-center gap-2.5 px-4 min-h-[48px] text-sm font-bold text-red-700 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// Phone navigation: same three destinations as the desktop tabs, in thumb reach.
export function BottomNav({ activeTab, onTabChange, adminBadge = 0 }) {
  const { isAdmin } = useAuth()
  const tabs = useTabs(isAdmin)
  return (
    <nav
      aria-label="Main"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t-[1.5px] border-slate-900 shadow-[0_-3px_0_0_rgba(15,23,42,0.12)] pb-safe"
    >
      <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center gap-1 min-h-[60px] text-[11px] font-bold"
            >
              <span className={`flex items-center justify-center w-14 h-8 rounded-full transition ${active ? 'bg-brand-700 text-white' : 'text-slate-500'}`}>
                <t.icon className="w-5 h-5" />
              </span>
              <span className={active ? 'text-brand-800' : 'text-slate-500'}>{t.label}</span>
              {t.id === 'admin' && adminBadge > 0 && (
                <span className="absolute top-1.5 left-1/2 ml-3 min-w-[18px] px-1 text-center rounded-full text-[10px] font-extrabold bg-red-600 text-white">{adminBadge}</span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
