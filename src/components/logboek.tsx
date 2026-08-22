import type { ReactNode } from 'react'

/**
 * De bouwstenen van het Logboek-ontwerp: een pagina met haarlijnen in plaats van
 * kaartjes. Alles hier leest uitsluitend tokens uit theme.css — staat er in dit
 * bestand een px-waarde of een kleur, dan is dat een fout.
 */

/**
 * Een scherm: inhoud die scrollt, met daaronder een actiezone die blijft staan.
 *
 * De actiezone hoort niet mee te scrollen. Het duimbereik is een harde eis — wat je
 * tussen sets aanraakt moet onderin blijven, ook als de lijst erboven lang is.
 */
export function Screen({
  children,
  action,
  bottom = 'nav',
}: {
  children: ReactNode
  /** de knoppenrij onderaan; laat weg als er echt niets te doen is */
  action?: ReactNode
  /** 'nav' als er een navigatiebalk onder komt, 'free' als het scherm zelf afsluit */
  bottom?: 'nav' | 'free'
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-content px-gutter pb-block">{children}</div>
      </div>
      {action ? (
        <div className={`flex-none ${bottom === 'free' ? 'pb-session-bottom' : ''}`}>
          <div className="mx-auto w-full max-w-content px-gutter py-action-y">{action}</div>
        </div>
      ) : null}
    </div>
  )
}

/** De regel bovenaan elk scherm: links waar je bent, rechts wanneer. */
export function TopLine({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-column text-caps-lg uppercase tracking-caps-wide text-dim">
      <div>{left}</div>
      {right ? <div className="shrink-0 text-accent">{right}</div> : null}
    </div>
  )
}

/** Haarlijn met het verticale ritme van een blokscheiding eromheen. */
export function Rule({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-rule ${className}`} aria-hidden />
}

/** Kapitaal-label. `tone="accent"` markeert de enige twee dingen die oker mag zijn. */
export function Caps({
  children,
  tone = 'dim',
  size = 'sm',
  className = '',
}: {
  children: ReactNode
  tone?: 'dim' | 'accent' | 'faint' | 'muted'
  size?: 'sm' | 'lg'
  className?: string
}) {
  const kleur =
    tone === 'accent'
      ? 'text-accent'
      : tone === 'faint'
        ? 'text-faint'
        : tone === 'muted'
          ? 'text-muted'
          : 'text-dim'
  const maat = size === 'lg' ? 'text-caps-lg tracking-caps' : 'text-caps tracking-caps-wide'
  return <div className={`uppercase ${maat} ${kleur} ${className}`}>{children}</div>
}

export interface Stat {
  label: string
  /** de meetwaarde zelf; serif, want het is een getal om te lezen */
  value: ReactNode
  /** wat er direct achter de waarde staat, kleiner en gedempt: ' / 14,5 km' */
  suffix?: ReactNode
  /** verhouding tussen de kolommen; standaard even breed */
  flex?: number
}

/**
 * Kerncijfers: twee of drie kolommen tussen twee haarlijnen, met een verticale lijn
 * ertussen. Kolommen zonder gegevens hoor je niet mee te geven — het ontwerp
 * reserveert geen lege ruimte.
 */
export function Stats({ items, variant = 'today' }: { items: Stat[]; variant?: 'today' | 'week' }) {
  if (items.length === 0) return null
  const maat = variant === 'week' ? 'text-week-stat' : 'text-stat'
  const inspring = variant === 'week' ? 'pl-week-stat-x' : 'pl-stat-x'

  return (
    <div className="flex border-y-hair border-rule">
      {items.map((s, i) => (
        <div key={s.label} className="flex" style={{ flex: s.flex ?? 1 }}>
          {i > 0 ? <div className="w-px shrink-0 bg-rule" aria-hidden /> : null}
          <div
            className={`flex flex-1 flex-col gap-stat py-stat-y ${i > 0 ? inspring : ''}`}
          >
            <Caps>{s.label}</Caps>
            <div className={`font-serif ${maat} text-ink`}>
              {s.value}
              {s.suffix ? <span className="text-list text-dim">{s.suffix}</span> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * De primaire actie. Eén per scherm — in donker oker, in licht zwart; dat is de
 * enige plek waar de twee thema's echt van elkaar afwijken.
 */
export function Primary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex-1 bg-primary-bg py-primary text-center text-button font-bold text-primary-ink
                 transition-colors duration-color disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/** De knop ernaast: een rand, meer niet. Blijft smal zodat de primaire actie wint. */
export function Secondary({
  children,
  onClick,
  disabled,
  width = 'secondary',
  ariaLabel,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  width?: 'secondary' | 'arrow'
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${width === 'arrow' ? 'w-arrow' : 'w-secondary'} flex shrink-0 items-center
                  justify-center border-hair border-rule-strong text-center text-label
                  leading-secondary text-muted transition-colors duration-color disabled:opacity-40`}
    >
      {children}
    </button>
  )
}

/** De rij onderaan: primair plus wat ernaast hoort. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className="flex gap-action">{children}</div>
}

export interface SegmentOption<T> {
  id: T
  label: ReactNode
}

/**
 * Een rij segmenten met een label ervoor — de check-in op Vandaag.
 *
 * Gekozen is oker met de schermkleur als tekst; de rest is een haarlijnrand. Bij
 * opnieuw tikken op wat al gekozen is roept `onChange` met `undefined`, zodat een
 * per ongeluk gezette waarde ook weer weg kan.
 */
export function Segments<T extends string | number>({
  label,
  options,
  value,
  onChange,
  clearable = false,
}: {
  label: string
  options: SegmentOption<T>[]
  value: T | undefined
  onChange: (v: T | undefined) => void
  clearable?: boolean
}) {
  return (
    <div className="flex items-center gap-checkin-label">
      <div className="w-checkin-label shrink-0 text-label text-muted">{label}</div>
      <div className="flex flex-1 gap-segment" role="group" aria-label={label}>
        {options.map((o) => {
          const aan = value === o.id
          return (
            <button
              key={String(o.id)}
              type="button"
              aria-pressed={aan}
              onClick={() => onChange(clearable && aan ? undefined : o.id)}
              className={`flex-1 border-hair py-segment-y text-center text-body
                          transition-colors duration-color ${
                            aan
                              ? 'border-accent bg-accent font-semibold text-on-accent'
                              : 'border-chip-border text-dim'
                          }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Een lijstrij op een haarlijn. De laatste rij van een lijst krijgt er ook een
 * onder, zodat de lijst als blok afsluit.
 */
export function Row({
  children,
  last = false,
  className = '',
}: {
  children: ReactNode
  last?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex gap-column border-t-hair border-rule py-row ${
        last ? 'border-b-hair' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Een tekstknop in oker: "Bekijk", "Verplaatsen". Geen vlak, geen rand — oker doet
 * op een scherm maar twee dingen, en dit is er één van.
 */
export function Link({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 text-label text-accent transition-colors duration-color disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/** Een 2px balk die voor een deel gevuld is: het weekplafond, de rusttimer. */
export function Meter({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className="h-bar bg-rule-faint" aria-hidden>
      <div className="h-bar bg-accent" style={{ width: `${pct}%` }} />
    </div>
  )
}
