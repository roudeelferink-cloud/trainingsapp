import { useEffect, type ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <h2 className="text-lg font-bold text-slate-100">{children}</h2>
      {right}
    </div>
  )
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'run' | 'lift' | 'warn' | 'ok' | 'off' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-ink-600 text-slate-200',
    run: 'bg-amber-500/20 text-amber-300',
    lift: 'bg-sky-500/20 text-sky-300',
    warn: 'bg-rose-500/20 text-rose-300',
    ok: 'bg-emerald-500/20 text-emerald-300',
    off: 'bg-ink-700 text-slate-400',
  }
  return <span className={`chip ${tones[tone]}`}>{children}</span>
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button aria-label="Sluiten" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md bg-ink-800 border-t border-ink-600 rounded-t-3xl p-4 pb-6 max-h-[85vh] overflow-y-auto safe-bottom">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink-500" />
        <h3 className="text-lg font-bold mb-3">{title}</h3>
        {children}
      </div>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-3 text-left"
    >
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-sm text-slate-400">{hint}</span>}
      </span>
      <span
        className={`shrink-0 w-14 h-8 rounded-full p-1 transition ${checked ? 'bg-accent' : 'bg-ink-600'}`}
      >
        <span
          className={`block w-6 h-6 rounded-full bg-white transition ${checked ? 'translate-x-6' : ''}`}
        />
      </span>
    </button>
  )
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  suffix,
  decimals = 0,
  placeholder,
  ariaLabel,
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
  decimals?: number
  /** grijze voorgevulde schatting; verdwijnt zodra er zelf iets ingevuld wordt */
  placeholder?: number
  ariaLabel?: string
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  const empty = value === 0 && placeholder !== undefined
  const basis = empty ? placeholder : value

  return (
    <div className="flex items-stretch gap-1">
      <button
        className="btn-ghost btn-sm w-11 shrink-0 text-xl"
        onClick={() => onChange(clamp(basis - step))}
        aria-label="Minder"
      >
        −
      </button>
      <div className="flex-1 min-w-0 flex items-center rounded-lg bg-ink-900 border border-ink-600 px-1 focus-within:border-accent">
        <input
          type="number"
          inputMode="decimal"
          aria-label={ariaLabel}
          className="w-full min-w-0 bg-transparent text-center tabular-nums font-bold focus:outline-none placeholder:text-slate-500 placeholder:font-normal"
          value={empty ? '' : decimals ? value.toFixed(decimals) : String(value)}
          placeholder={placeholder === undefined ? undefined : String(placeholder)}
          onChange={(e) => onChange(e.target.value === '' ? 0 : clamp(Number(e.target.value)))}
        />
        {suffix && <span className="text-xs text-slate-400 pr-1">{suffix}</span>}
      </div>
      <button
        className="btn-ghost btn-sm w-11 shrink-0 text-xl"
        onClick={() => onChange(clamp(basis + step))}
        aria-label="Meer"
      >
        +
      </button>
    </div>
  )
}

export function Bar({ value, max, tone = 'bg-accent' }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-3 rounded-full bg-ink-600 overflow-hidden">
      <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-slate-400 text-sm py-6 text-center">{children}</p>
}
