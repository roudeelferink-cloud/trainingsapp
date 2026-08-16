import type { UserState } from '../types'
import { cycleInfo } from './cycle'
import { addDays, mondayOf } from './dates'
import { heavyCountBefore, weekIsPoor } from './feel'
import { DELOAD_EVERY_WEEKS } from './running'

/**
 * De deloadweek: een week waarin je hetzelfde doet, maar lichter.
 *
 * Drie aanleidingen, allemaal deterministisch en allemaal uit wat er gelogd is:
 * 1. **zwaar** — drie sessies als 'zwaar' beoordeeld binnen twee weken;
 * 2. **dagcheck** — twee weken op rij een overwegend slechte dagcheck;
 * 3. **ritme** — elke achtste trainingsweek, ook als er niets aan de hand is.
 *
 * De structuur van de week blijft staan: dezelfde sessies, dezelfde oefeningen, alleen
 * 40% van het gewicht eraf en 30% van het loopvolume. Overslaan kan, maar alleen met een
 * expliciete bevestiging waarin staat wat je riskeert — zie `DELOAD_RISK`.
 */

export type DeloadReason = 'zwaar' | 'dagcheck' | 'ritme'

/** Hoeveel gewicht en loopvolume er in een deloadweek af gaat. */
export const DELOAD_WEIGHT_FACTOR = 0.6
export const DELOAD_RUN_FACTOR = 0.7

/** Drie zware sessies binnen twee weken is genoeg. */
export const HEAVY_WINDOW_DAYS = 14
export const HEAVY_TRIGGER = 3

export const DELOAD_RISK =
  'Een deload overslaan betekent doortrainen op vermoeidheid. Het risico is een blessure ' +
  'aan pees of gewricht, en die kost weken in plaats van deze ene lichte week.'

export interface DeloadPlan {
  /** maandag van de week waar dit over gaat */
  weekStart: string
  /** doorlopend weeknummer van het programma */
  week: number
  /** deze week is een deloadweek en de korting geldt */
  active: boolean
  /** de aanleiding; null als er geen deload nodig is */
  reason: DeloadReason | null
  /** één regel uitleg; null als er niets te melden is */
  explanation: string | null
  /** er wás een deload nodig, maar de gebruiker heeft hem bewust overgeslagen */
  skipped: boolean
}

const REASON_TEXT: Record<DeloadReason, string> = {
  zwaar: `Drie sessies als zwaar beoordeeld in twee weken — deloadweek: 40% van het gewicht eraf, 30% minder kilometers.`,
  dagcheck: `Twee weken op rij slecht geslapen en weinig energie — deloadweek: 40% van het gewicht eraf, 30% minder kilometers.`,
  ritme: `Achtste trainingsweek — vaste deloadweek: 40% van het gewicht eraf, 30% minder kilometers.`,
}

/**
 * De aanleiding voor een deload in de week van `iso`, of null.
 *
 * De reactieve triggers kijken uitsluitend naar wat er vóór deze week gebeurd is. Dat
 * moet ook: anders zou een zware maandag de week waarin hij valt met terugwerkende
 * kracht lichter maken, en dan verandert het schema onder je voeten terwijl je er in
 * staat.
 */
export function deloadTrigger(state: UserState, iso: string): DeloadReason | null {
  const weekStart = mondayOf(iso)
  const week = cycleInfo(state.startDate, weekStart).week

  if (week >= DELOAD_EVERY_WEEKS && week % DELOAD_EVERY_WEEKS === 0) return 'ritme'
  if (heavyCountBefore(state, weekStart, HEAVY_WINDOW_DAYS) >= HEAVY_TRIGGER) return 'zwaar'
  if (weekIsPoor(state, addDays(weekStart, -7)) && weekIsPoor(state, addDays(weekStart, -14))) {
    return 'dagcheck'
  }
  return null
}

export function deloadFor(state: UserState, iso: string): DeloadPlan {
  const weekStart = mondayOf(iso)
  const week = cycleInfo(state.startDate, weekStart).week
  const reason = deloadTrigger(state, iso)
  const skipped = reason !== null && !!state.deloadSkips?.[weekStart]

  return {
    weekStart,
    week,
    active: reason !== null && !skipped,
    reason,
    skipped,
    explanation: reason === null ? null : skipped ? skippedText(reason) : REASON_TEXT[reason],
  }
}

function skippedText(reason: DeloadReason): string {
  return `Deloadweek overgeslagen (${reasonLabel(reason)}). Je traint op vol gewicht — let extra op pezen en knieën.`
}

export function reasonLabel(reason: DeloadReason): string {
  if (reason === 'zwaar') return 'drie zware sessies'
  if (reason === 'dagcheck') return 'twee slechte weken'
  return 'vaste achtste week'
}

/**
 * Hoeveel weken het nog duurt tot de vaste deload. 0 in de deloadweek zelf. Een deload
 * die eerder komt omdat het te zwaar werd staat hier los van: die kondigt zich niet aan.
 */
export function weeksUntilDeload(week: number): number {
  const w = Math.max(1, Math.floor(week))
  return (DELOAD_EVERY_WEEKS - (w % DELOAD_EVERY_WEEKS)) % DELOAD_EVERY_WEEKS
}

/** Percentage dat er in een deloadweek van het gewicht af gaat, voor in de uitleg. */
export const DELOAD_WEIGHT_PCT = Math.round((1 - DELOAD_WEIGHT_FACTOR) * 100)
export const DELOAD_RUN_PCT = Math.round((1 - DELOAD_RUN_FACTOR) * 100)
