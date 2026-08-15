import type { Exercise, LoggedSet } from '../types'

/**
 * Bandwerk.
 *
 * Een mini-loopband heeft geen kilo's: de set thuis loopt van licht naar zwaar en de
 * kleur zegt welke je in handen hebt. Loggen op kg zou hier een verzonnen getal zijn
 * dat vervolgens in het tilvolume en het geschatte 1RM terechtkomt, dus bandwerk logt
 * op **niveau + reps** en laat `weight` op 0 staan.
 *
 * Progressie loopt daardoor in twee trappen: eerst reps erbij op hetzelfde niveau,
 * dan de volgende band. Boven de zwaarste band houdt het op — daar neemt de belaste
 * variant het over (`progressesTo` op de oefening), want die gaat wél in kilo's.
 *
 * De kleuren hieronder zijn die van de set in de thuisgym. Het niveau is wat telt;
 * de kleur staat erbij zodat je de juiste band pakt zonder te hoeven tellen.
 */

export interface BandLevel {
  level: number
  kleur: string
}

export const BAND_LEVELS: BandLevel[] = [
  { level: 1, kleur: 'geel' },
  { level: 2, kleur: 'rood' },
  { level: 3, kleur: 'groen' },
  { level: 4, kleur: 'blauw' },
  { level: 5, kleur: 'zwart' },
]

export const MIN_BAND_LEVEL = 1
export const MAX_BAND_LEVEL = BAND_LEVELS.length

/** Logt deze oefening op bandniveau in plaats van op kilo's? */
export function isBandExercise(ex: Exercise): boolean {
  return ex.unit === 'band'
}

export function clampBandLevel(level: number): number {
  if (!Number.isFinite(level)) return MIN_BAND_LEVEL
  return Math.min(MAX_BAND_LEVEL, Math.max(MIN_BAND_LEVEL, Math.round(level)))
}

/** Het gelogde niveau van een set; zonder invulling de lichtste band. */
export function levelOf(set: LoggedSet): number {
  return clampBandLevel(set.level ?? MIN_BAND_LEVEL)
}

export function bandColor(level: number): string {
  return BAND_LEVELS[clampBandLevel(level) - 1].kleur
}

/** "niveau 2 · rood" */
export function bandLabel(level: number): string {
  const l = clampBandLevel(level)
  return `niveau ${l} · ${bandColor(l)}`
}

/** Is dit het zwaarste bandje uit de set? Dan houdt bandprogressie op. */
export function isTopBand(level: number): boolean {
  return clampBandLevel(level) >= MAX_BAND_LEVEL
}
