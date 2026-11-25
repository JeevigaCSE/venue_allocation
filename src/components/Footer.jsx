import React from 'react'
import { Building2 } from 'lucide-react'
import { APP_CONFIG } from '../lib/config'

export default function Footer({ className = '' }) {
  return (
    <footer className={`border-t-[1.5px] border-slate-300 bg-white ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <Building2 className="w-4 h-4 text-brand-700" />
          {APP_CONFIG.collegeName}
        </div>
        <div className="text-center">{APP_CONFIG.supportNote}</div>
        <div>&copy; {new Date().getFullYear()} {APP_CONFIG.appName}</div>
      </div>
    </footer>
  )
}
