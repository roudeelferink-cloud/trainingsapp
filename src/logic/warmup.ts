import type { SessionLog, Warmup, WarmupType } from '../types'

/**
 * Elke krachtsessie begint met hetzelfde blok: 5-10 minuten rustig op de loopband
 * of losfietsen op de spinningfiets. Type en duur zijn per sessie in te stellen,
 * het blok is af te vinken en wordt met de sessie meegeschreven.
 */
export const WARMUP_TYPES: { id: WarmupType; label: string }[] = [
  { id: 'loopband', label: 'Loopband' },
  { id: 'fiets', label: 'Losfietsen' },
]

export const WARMUP_TYPE_LABEL: Record<WarmupType, string> = {
  loopband: 'Loopband',
  fiets: 'Losfietsen (spinningfiets)',
}

/** Het advies. De duur is instelbaar, dit is waar hij op begint. */
export const WARMUP_MIN_MINUTES = 5
export const WARMUP_MAX_MINUTES = 10

export const WARMUP_HINT = `${WARMUP_MIN_MINUTES}-${WARMUP_MAX_MINUTES} min rustig, tot je warm bent en je hartslag omhoog is. Niet zwaar: dit kost geen kracht voor de eerste oefening.`

export const DEFAULT_WARMUP: Warmup = {
  type: 'loopband',
  minutes: WARMUP_MIN_MINUTES,
  done: false,
}

/** Buiten dit bereik is het geen warming-up meer; 0 minuten al helemaal niet. */
export function clampWarmupMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_WARMUP.minutes
  return Math.min(60, Math.max(1, Math.round(minutes)))
}

/**
 * De warming-up van een sessie. Logs van vóór dit blok bestond hebben er geen,
 * en die krijgen gewoon het standaardblok te zien — er gaat niets verloren.
 */
export function warmupOf(log: SessionLog | null | undefined): Warmup {
  const w = log?.warmup
  if (!w) return DEFAULT_WARMUP
  return {
    type: w.type === 'fiets' ? 'fiets' : 'loopband',
    minutes: clampWarmupMinutes(w.minutes),
    done: !!w.done,
  }
}

export function warmupLabel(w: Warmup): string {
  return `${WARMUP_TYPES.find((t) => t.id === w.type)?.label ?? 'Loopband'} ${w.minutes} min`
}
