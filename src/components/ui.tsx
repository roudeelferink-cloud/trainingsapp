import { useEffect, useId, useState, type ReactNode } from 'react'

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
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // de pagina achter het blad mag niet meescrollen (klassiek iOS-euvel)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button aria-label="Sluiten" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-md bg-ink-800 border-t border-ink-600 rounded-t-3xl p-4 pb-6 max-h-[85vh] overflow-y-auto safe-bottom">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink-500" />
        <h3 id={titleId} className="text-lg font-bold mb-3">
          {title}
        </h3>
        {children}
      </div>
    </div>
  )
}

/**
 * Rooster met keuzeknoppen: de gekozen knop kleurt accent, de rest blijft donker.
 * Hetzelfde blok stond op zeven plekken met de hand nagebouwd (check-in, dagcheck,
 * beoordeling, warming-uptype, activiteit); dit is die ene plek. Werkt ook zonder
 * gekozen waarde — dan zijn het actieknoppen in dezelfde stijl, zoals bij de
 * beoordeling na een sessie.
 */
export function ChoiceGrid<T extends string | number>({
  options,
  value,
  onChange,
  columns = 3,
  buttonClass = 'min-h-[52px] text-sm',
}: {
  options: readonly { id: T; label: ReactNode }[]
  value?: T
  onChange: (id: T) => void
  columns?: 2 | 3 | 5
  /** hoogte en tekstgrootte van de knoppen; de standaard past de meeste kiezers */
  buttonClass?: string
}) {
  const cols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 5: 'grid-cols-5' }[columns]
  return (
    <div className={`grid ${cols} gap-2`}>
      {options.map((o) => (
        <button
          key={o.id}
          aria-pressed={value !== undefined ? value === o.id : undefined}
          onClick={() => onChange(o.id)}
          className={`btn ${buttonClass} ${
            value === o.id ? 'bg-accent text-ink-900' : 'bg-ink-700 border border-ink-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Bevestigingsvinkje voor een ingreep met gevolgen (deload overslaan, gegevens
 * wissen): één rij die je aan- en uitzet, met het rode vinkje als het aanstaat.
 */
export function ConfirmCheck({
  checked,
  onToggle,
  children,
}: {
  checked: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <button
      className="w-full flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-900 p-3 text-left"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
    >
      <span
        className={`shrink-0 w-6 h-6 rounded border flex items-center justify-center text-sm font-bold ${
          checked ? 'bg-rose-500 border-rose-500 text-ink-900' : 'border-ink-500 text-transparent'
        }`}
        aria-hidden
      >
        ✓
      </span>
      <span className="text-sm">{children}</span>
    </button>
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

/**
 * Minimale breedte van een getalveld in pixels. Daaronder knijpt het veld op een
 * smalle telefoon dicht tot een streepje en is het getal niet meer te lezen of te
 * bewerken. De klasse hieronder moet hiermee overeenkomen; de test bewaakt dat.
 */
export const NUMBER_INPUT_MIN_PX = 56

/**
 * Leest wat er in een getalveld getypt is. Komma en punt gelden allebei als
 * decimaalteken: het Nederlandse iOS-toetsenbord toont een komma, en in een
 * `type="number"`-veld maakte die de waarde leeg — daarom zijn de velden tekstvelden.
 * Een half getal tijdens het typen ("7,") telt gewoon als 7; onleesbare invoer is null.
 */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '' || t === '.' || !/^\d*\.?\d*$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Nederlandse weergave: komma als decimaalteken. */
export function formatDecimal(value: number, decimals = 0): string {
  const text = decimals ? value.toFixed(decimals) : String(value)
  return text.replace('.', ',')
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

  // wat er getypt wordt, letterlijk, zolang het veld de focus heeft. Zonder dit concept
  // zou elke toetsaanslag meteen terugformatteren ("4" werd "4.0") en verdween een
  // net getypte komma direct weer.
  const [draft, setDraft] = useState<string | null>(null)

  const stap = (richting: 1 | -1) => {
    setDraft(null)
    onChange(clamp(basis + richting * step))
  }

  return (
    // flex-wrap: op een heel smal scherm (320px) wipt het veld naar een eigen regel
    // in plaats van dat het tussen de knoppen wordt platgedrukt.
    <div className="flex flex-wrap items-stretch gap-1">
      <button
        className="btn-ghost btn-sm w-11 flex-none text-xl"
        onClick={() => stap(-1)}
        aria-label="Minder"
      >
        −
      </button>
      {/* min-w houdt het veld leesbaar; de knoppen ernaast mogen het nooit wegdrukken */}
      <div className="flex-1 min-w-[64px] flex items-center rounded-lg bg-ink-900 border border-ink-600 px-1 focus-within:border-accent">
        <input
          type="text"
          inputMode="decimal"
          aria-label={ariaLabel}
          // text-base = 16px: kleiner laat iOS bij focus inzoomen op het veld
          className="w-full min-w-[56px] bg-transparent text-center text-base tabular-nums font-bold focus:outline-none placeholder:text-slate-500 placeholder:font-normal"
          value={draft ?? (empty ? '' : formatDecimal(value, decimals))}
          placeholder={placeholder === undefined ? undefined : formatDecimal(placeholder, decimals)}
          onChange={(e) => {
            const text = e.target.value
            setDraft(text)
            if (text === '') return onChange(0)
            const parsed = parseDecimal(text)
            if (parsed !== null) onChange(clamp(parsed))
          }}
          onBlur={() => setDraft(null)}
        />
        {suffix && <span className="text-xs text-slate-400 pr-1">{suffix}</span>}
      </div>
      <button
        className="btn-ghost btn-sm w-11 flex-none text-xl"
        onClick={() => stap(1)}
        aria-label="Meer"
      >
        +
      </button>
    </div>
  )
}

/**
 * Los decimaal veld (zonder −/+): zelfde komma-afhandeling en hetzelfde concept
 * tijdens het typen als de Stepper. Leeg veld betekent "niet ingevuld" (null).
 */
export function DecimalField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  ariaLabel?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      className="field"
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={draft ?? (value === null ? '' : formatDecimal(value))}
      onChange={(e) => {
        const text = e.target.value
        setDraft(text)
        if (text === '') return onChange(null)
        const parsed = parseDecimal(text)
        if (parsed !== null) onChange(parsed)
      }}
      onBlur={() => setDraft(null)}
    />
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
