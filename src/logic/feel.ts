import type { DayCheck, DayScore, Feel, RunLog, SessionLog, UserState } from '../types'
import { addDays, mondayOf } from './dates'

/**
 * Gevoelsregistratie.
 *
 * Twee dingen, allebei optioneel en allebei één tik:
 * 1. na een sessie (kracht én hardlopen) een beoordeling: makkelijk / goed / zwaar;
 * 2. per dag een dagcheck: slaap en energie, elk op een schaal van 3.
 *
 * De guardrails lezen hier hun subjectieve signaal uit. Alles wat hier ontbreekt telt
 * als "niets gezegd": de app bouwt dan gewoon door op wat er gelogd is. Overslaan mag
 * dus echt, en kost je niets.
 */

export const FEELS: { id: Feel; label: string }[] = [
  { id: 'makkelijk', label: 'Makkelijk' },
  { id: 'goed', label: 'Goed' },
  { id: 'zwaar', label: 'Zwaar' },
]

export function isFeel(v: unknown): v is Feel {
  return v === 'makkelijk' || v === 'goed' || v === 'zwaar'
}

export function feelLabel(feel: Feel): string {
  return FEELS.find((f) => f.id === feel)?.label ?? feel
}

/** Ruimte om te verhogen: alleen 'makkelijk' en 'goed' geven die. */
export function allowsIncrease(feel: Feel | undefined): boolean {
  return feel === 'makkelijk' || feel === 'goed'
}

export const DAY_SCORES: { id: DayScore; label: string }[] = [
  { id: 1, label: 'Slecht' },
  { id: 2, label: 'Oké' },
  { id: 3, label: 'Goed' },
]

export function isDayScore(v: unknown): v is DayScore {
  return v === 1 || v === 2 || v === 3
}

export function dayScoreLabel(score: DayScore): string {
  return DAY_SCORES.find((s) => s.id === score)?.label ?? String(score)
}

/**
 * Een slechte dag: slaap en energie samen op 3 of lager. Dat is één keer 'slecht' met
 * hooguit een 'oké' ernaast — twee keer 'oké' (4) telt dus nog niet als slecht.
 */
export const POOR_DAY_SCORE = 3

export function isPoorDay(check: DayCheck): boolean {
  return check.sleep + check.energy <= POOR_DAY_SCORE
}

/** Minimaal aantal ingevulde dagchecks voordat een week iets over zichzelf zegt. */
export const MIN_CHECKS_PER_WEEK = 2

/**
 * Een week is "overwegend slecht" zodra er genoeg ingevuld is én meer dan de helft van
 * die dagen slecht scoort. Eén brakke dag in een verder goede week zegt niets; twee van
 * de drie wel.
 */
export function weekIsPoor(state: UserState, iso: string): boolean {
  const checks = dayChecksInWeek(state, iso)
  if (checks.length < MIN_CHECKS_PER_WEEK) return false
  const poor = checks.filter(isPoorDay).length
  return poor * 2 > checks.length
}

export function dayChecksInWeek(state: UserState, iso: string): DayCheck[] {
  const mon = mondayOf(iso)
  const out: DayCheck[] = []
  for (let i = 0; i < 7; i++) {
    const check = state.dayChecks?.[addDays(mon, i)]
    if (check) out.push(check)
  }
  return out
}

/** Alle afgeronde sessies (kracht en loop) op één dag, met hun beoordeling. */
export function feelsOn(state: UserState, iso: string): Feel[] {
  const out: Feel[] = []
  for (const log of Object.values(state.sessions ?? {})) {
    if (log.date === iso && log.completedAt && isFeel(log.feel)) out.push(log.feel)
  }
  const run: RunLog | undefined = state.runs?.[iso]
  if (run?.completedAt && isFeel(run.feel)) out.push(run.feel)
  return out
}

/**
 * Aantal als 'zwaar' beoordeelde sessies in de `days` dagen vóór `iso`, `iso` zelf niet
 * meegerekend. Kracht en hardlopen tellen allebei mee: de rem gaat over de hele
 * belasting, niet over één soort werk.
 */
export function heavyCountBefore(state: UserState, iso: string, days: number): number {
  let n = 0
  for (let i = 1; i <= days; i++) {
    n += feelsOn(state, addDays(iso, -i)).filter((f) => f === 'zwaar').length
  }
  return n
}

/** Beoordeling van een afgeronde sessie; null als er niets ingevuld is. */
export function logFeel(log: SessionLog | RunLog | null | undefined): Feel | null {
  return log && isFeel(log.feel) ? log.feel : null
}
