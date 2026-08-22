import { useEffect, useId, useState, type ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-in-block flex items-baseline justify-between gap-column">
      <h2 className="text-caps uppercase tracking-caps-wide text-dim">{children}</h2>
      {right}
    </div>
  )
}

/**
 * Een label naast iets anders. In het Logboek-ontwerp is een chip geen gekleurd
 * bolletje meer maar een kapitaal-label: `accent` voor "hier ben je", `dim` voor
 * de rest. Er is maar één accentkleur, dus onderscheid maken met kleur kan niet —
 * en hoeft ook niet, want de tekst zegt het zelf al.
 */
export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'run' | 'lift' | 'warn' | 'ok' | 'off' | 'deload'
}) {
  const accent = tone === 'run' || tone === 'deload' || tone === 'ok' || tone === 'warn'
  return (
    <span
      className={`chip uppercase tracking-caps-tight text-caps-lg ${
        accent ? 'text-accent' : tone === 'off' ? 'text-faint' : 'text-dim'
      }`}
    >
      {children}
    </span>
  )
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
      {/* geen ronde hoeken en geen schaduw: het blad is een vel papier met een lijn erboven */}
      <div className="safe-bottom relative max-h-[85vh] w-full max-w-content overflow-y-auto border-t-hair border-rule bg-bg px-gutter pb-block pt-block">
        <h3 id={titleId} className="mb-block font-serif text-lead text-ink">
          {title}
        </h3>
        {children}
      </div>
    </div>
  )
}

/**
 * Rooster met keuzeknoppen: de gekozen knop kleurt oker, de rest is een haarlijnrand.
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
  buttonClass = 'min-h-tap py-segment-y text-body',
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
    <div className={`grid ${cols} gap-segment`}>
      {options.map((o) => (
        <button
          key={o.id}
          aria-pressed={value !== undefined ? value === o.id : undefined}
          onClick={() => onChange(o.id)}
          className={`flex items-center justify-center border-hair text-center transition-colors duration-color ${buttonClass} ${
            value === o.id
              ? 'border-accent bg-accent font-semibold text-on-accent'
              : 'border-chip-border text-dim'
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
 * wissen): één rij die je aan- en uitzet, met het vinkje als het aanstaat.
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
      className="flex w-full items-center gap-column border-hair border-rule p-3 text-left"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
    >
      <span
        className={`flex h-checkbox w-checkbox shrink-0 items-center justify-center border-hair text-meta transition-colors duration-color ${
          checked ? 'border-accent bg-accent text-on-accent' : 'border-checkbox-border text-transparent'
        }`}
        aria-hidden
      >
        ✓
      </span>
      <span className="text-body text-ink">{children}</span>
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
      className="flex w-full items-center justify-between gap-column py-3 text-left"
      role="switch"
      aria-checked={checked}
    >
      <span>
        <span className="block text-list text-ink">{label}</span>
        {hint && <span className="block text-meta leading-meta text-dim">{hint}</span>}
      </span>
      {/* geen ronde schakelaar: een vierkant vakje dat vol loopt, net als het set-vinkje */}
      <span
        className={`flex h-checkbox w-checkbox shrink-0 items-center justify-center border-hair text-meta transition-colors duration-color ${
          checked ? 'border-accent bg-accent text-on-accent' : 'border-checkbox-border text-transparent'
        }`}
        aria-hidden
      >
        ✓
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

/**
 * Grote getallen met een spatie als duizendtalscheiding: 8 240 kg. Een smalle
 * spatie, zodat het getal één woord blijft en niet over twee regels breekt.
 */
export function formatThousands(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
}

/**
 * De stepper uit het ontwerp: 64px hoog, − en + van 64px breed, het veld ertussen.
 *
 * Die maat is geen smaak maar de reden dat het ding in een sportschool werkt — met
 * zweethanden mis je een knop van 44px. Tikken op het veld zelf opent het numerieke
 * toetsenbord; de knoppen zijn de gewone route.
 */
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

  const knop =
    'flex h-stepper w-stepper-btn flex-none items-center justify-center border-hair ' +
    'border-rule-strong text-stepper text-ink-status transition-colors duration-color'

  return (
    <div className="flex items-stretch gap-stepper">
      {/* − is U+2212, geen koppelteken: een hyphen staat te hoog en te kort */}
      <button className={knop} onClick={() => stap(-1)} aria-label="Minder">
        −
      </button>
      <div className="flex h-stepper min-w-number-field flex-1 items-center justify-center gap-2 border-hair border-field-border bg-field-bg px-1 focus-within:border-accent">
        <input
          type="text"
          inputMode="decimal"
          aria-label={ariaLabel}
          className="w-full min-w-number-field bg-transparent text-center font-serif text-input text-ink focus:outline-none placeholder:text-faint"
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
        {suffix && <span className="shrink-0 pr-1 text-body text-dim">{suffix}</span>}
      </div>
      <button className={knop} onClick={() => stap(1)} aria-label="Meer">
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

export function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-bar bg-rule-faint">
      <div className="h-bar bg-accent" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-block text-center text-body text-dim">{children}</p>
}
