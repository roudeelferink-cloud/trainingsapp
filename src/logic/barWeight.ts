import type { BarId, Exercise, Settings } from '../types'

/**
 * Stanggewicht.
 *
 * Bij een oefening met een stang voer je alleen de schijven in; de app telt het
 * eigen gewicht van de stang erbij. In de log staat altijd het **totaal**: dat is
 * wat je tilt, en daarmee rekenen de progressie, het 1RM en het startgewichtadvies
 * verder. De omrekening naar schijven gebeurt puur in het invoerveld.
 *
 * De getallen hieronder zijn de standaard; ze staan per gebruiker in de
 * instellingen omdat elke sportschool andere stangen heeft. De Smith-stang is
 * daarvan de belangrijkste: die loopt in de praktijk van 7 tot 20 kg.
 */

export const DEFAULT_BAR_WEIGHTS: Record<BarId, number> = {
  trap_bar: 20,
  smith: 15,
  barbell: 20,
  deadlift_bar: 20,
  curl_bar: 7.5,
}

export const BAR_LABEL: Record<BarId, string> = {
  trap_bar: 'Trap bar',
  smith: 'Smith-stang',
  barbell: 'Olympische stang',
  deadlift_bar: 'Deadliftstang',
  curl_bar: 'Curlstang',
}

/** Volgorde waarin een oefening met meerdere stangen in de uitrusting gelezen wordt. */
export const BAR_IDS: BarId[] = ['trap_bar', 'smith', 'barbell', 'deadlift_bar', 'curl_bar']

/**
 * Welke stang deze oefening gebruikt, of null.
 *
 * Een stang telt alleen mee als er ook schijven op gaan: `inverted_row_smith`
 * hangt aan de smithstang maar wordt met lichaamsgewicht gedaan, en een
 * bulgarian split squat met dumbbells gebruikt de smith hooguit als steun.
 */
export function barFor(ex: Exercise): BarId | null {
  if (!ex.equipment.includes('plates')) return null
  return BAR_IDS.find((b) => (ex.equipment as string[]).includes(b)) ?? null
}

/** Eigen gewicht van de stang bij deze oefening; 0 als er geen stang aan te pas komt. */
export function barWeightFor(ex: Exercise, settings: Settings | undefined): number {
  const bar = barFor(ex)
  if (!bar) return 0
  const kg = settings?.barWeights?.[bar]
  return typeof kg === 'number' && Number.isFinite(kg) && kg > 0 ? kg : DEFAULT_BAR_WEIGHTS[bar]
}

/** Schijven + stang = wat je tilt. Dit is de waarde die in de log komt. */
export function totalFromPlates(plates: number, barKg: number): number {
  return round(Math.max(0, plates) + barKg)
}

/** Van een gelogd totaal terug naar de schijven die de gebruiker invulde. */
export function platesFromTotal(total: number, barKg: number): number {
  return round(Math.max(0, total - barKg))
}

/** "40 kg totaal — 20 kg stang + 20 kg schijven" */
export function barTotalLabel(plates: number, barKg: number): string {
  const p = round(Math.max(0, plates))
  return `${fmtKg(totalFromPlates(p, barKg))} kg totaal — ${fmtKg(barKg)} kg stang + ${fmtKg(p)} kg schijven`
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function fmtKg(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
}
