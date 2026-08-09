import type { UserState, RunKind } from '../types'
import { cycleInfo } from './cycle'
import { addDays, mondayOf } from './dates'

/** Startvolume: 6 + 6 + 10 km. */
const BASE_WEEK_KM = 22
const MAX_WEEKLY_GROWTH = 1.1

function round05(n: number): number {
  return Math.round(n * 2) / 2
}

/** Ongeremd geplande weekafstand op basis van de cyclus. */
function rawWeekKm(week: number): number {
  const w = Math.max(1, week)
  const cycleWeek = ((w - 1) % 4) + 1
  const cycle = Math.floor((w - 1) / 4) + 1
  const growth = Math.pow(1.05, (cycle - 1) * 3) // 3 opbouwweken per cyclus
  const factor = [1, 1.05, 1.1, 1.1 * 0.8][cycleWeek - 1] // week 4 = deload: -20%
  return BASE_WEEK_KM * growth * factor
}

/** Werkelijk gelopen kilometers in de week van `iso`. */
export function actualWeekKm(state: UserState, iso: string): number {
  const mon = mondayOf(iso)
  let total = 0
  for (let i = 0; i < 7; i++) {
    const r = state.runs[addDays(mon, i)]
    if (r && r.completedAt && !r.bike) total += r.km
  }
  return total
}

/**
 * Geplande weekafstand met harde bewaking: nooit meer dan 10% boven de vorige week.
 * Bij overschrijding wordt automatisch teruggeschaald.
 */
export function plannedWeekKm(state: UserState, iso: string): { km: number; capped: boolean } {
  const info = cycleInfo(state.startDate, iso)
  const raw = rawWeekKm(info.week)
  if (info.week <= 1) return { km: round05(raw), capped: false }

  const prevMonday = addDays(mondayOf(iso), -7)
  const prevActual = actualWeekKm(state, prevMonday)
  const prevRef = prevActual > 0 ? prevActual : rawWeekKm(info.week - 1)
  const cap = prevRef * MAX_WEEKLY_GROWTH
  // naar beneden afronden: de grens van +10% mag door afronding niet alsnog overschreden worden
  if (raw > cap) return { km: Math.floor(cap * 2) / 2, capped: true }
  return { km: round05(raw), capped: false }
}

/** Verdeling over de drie loopdagen: kort / kort / lang. */
export function plannedRunKm(state: UserState, iso: string, kind: RunKind): { km: number; capped: boolean } {
  const week = plannedWeekKm(state, iso)
  const short = Math.min(8, Math.max(5, round05(week.km * (6 / BASE_WEEK_KM))))
  if (kind === 'short') return { km: short, capped: week.capped }
  return { km: Math.max(6, round05(week.km - 2 * short)), capped: week.capped }
}

/** Check-in 1-2: 30% korter, of fietsen. */
export function scaledRunKm(km: number, checkin: number | undefined): number {
  if (checkin !== undefined && checkin <= 2) return round05(km * 0.7)
  return km
}

export const BIKE_MINUTES = 30
