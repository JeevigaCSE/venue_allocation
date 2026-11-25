import React, { useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'

export function Spinner({ label = 'Loading...' }) {
  return (
    <div className="elev p-12 text-center">
      <RefreshCw className="w-8 h-8 text-brand-700 animate-spin mx-auto mb-3" />
      <p className="text-sm font-semibold text-slate-700">{label}</p>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="elev p-10 text-center">
      {Icon && (
        <div className="w-14 h-14 bg-brand-50 text-brand-700 border-[1.5px] border-brand-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-lg font-extrabold text-slate-900 mb-1">{title}</h3>
      {text && <p className="text-sm text-slate-500 max-w-md mx-auto">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ title, text, onRetry }) {
  return (
    <div className="elev p-10 text-center">
      <div className="w-14 h-14 bg-red-50 text-red-600 border-[1.5px] border-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-extrabold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">{text}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-primary">
          Try again
        </button>
      )}
    </div>
  )
}

// Floating message that clears itself. feedback = { type: 'success' | 'error', message }
export function Toast({ feedback, onClose }) {
  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [feedback, onClose])
  if (!feedback) return null
  const ok = feedback.type === 'success'
  return (
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-[70] px-4 pointer-events-none">
      <div
        role="status"
        className={`pointer-events-auto max-w-lg mx-auto flex items-start gap-3 p-3.5 rounded-2xl border-[1.5px] shadow-elev-sm animate-toast-in ${
          ok ? 'bg-emerald-50 border-emerald-800 text-emerald-950' : 'bg-red-50 border-red-800 text-red-950'
        }`}
      >
        {ok ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
        )}
        <p className="flex-1 text-sm font-semibold leading-snug">{feedback.message}</p>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="p-1 -m-1 rounded-lg hover:bg-black/5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Bottom sheet on phones, centred dialog on larger screens.
export function Sheet({ open, onClose, title, subtitle, icon: Icon, tone = 'brand', children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null

  const tones = {
    brand: 'bg-brand-50 text-brand-700 border-brand-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-300',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  const width = size === 'lg' ? 'md:max-w-2xl' : size === 'sm' ? 'md:max-w-sm' : 'md:max-w-lg'

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${width} max-h-[92dvh] flex flex-col bg-white border-[1.5px] border-slate-800 shadow-elev rounded-t-3xl md:rounded-2xl animate-sheet-up`}
      >
        <div className="md:hidden flex justify-center pt-2.5">
          <span className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>
        <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-slate-200">
          {Icon && (
            <div className={`p-2.5 rounded-xl border-[1.5px] ${tones[tone]}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 leading-snug">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 -m-1 rounded-xl text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4 border-t border-slate-200 bg-slate-50 md:rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, onBack, backLabel = 'Back', actions }) {
  return (
    <div className="mb-5">
      {onBack && (
        <button type="button" onClick={onBack} className="btn-secondary btn-sm mb-3">
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </button>
      )}
      <div className="elev p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-[10px] border-l-brand-700">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

// Horizontally scrollable pill tabs (works with a thumb on a phone).
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
      <div className="inline-flex gap-2 p-1.5 bg-white border-[1.5px] border-slate-800 rounded-2xl shadow-elev-sm min-w-max">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
              value === t.id ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.icon && <t.icon className="w-4 h-4" />}
            {t.label}
            {t.count > 0 && (
              <span
                className={`px-1.5 min-w-[20px] text-center rounded-full text-[10px] font-extrabold ${
                  value === t.id ? 'bg-white text-brand-800' : 'bg-red-600 text-white'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Badge({ tone = 'slate', children, className = '' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-300',
    blue: 'bg-brand-50 text-brand-800 border-brand-300',
    green: 'bg-emerald-50 text-emerald-800 border-emerald-400',
    red: 'bg-red-50 text-red-800 border-red-400',
    amber: 'bg-amber-50 text-amber-900 border-amber-400',
    orange: 'bg-orange-50 text-orange-900 border-orange-400',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

