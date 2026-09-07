import type { DayKind, UserState } from '../types'
import { backfillStart } from './backfill'
import { addDays, mondayOf, today } from './dates'
import { buildDay, runName } from './day'

/**
 * Wat er nog open staat.
 *
 * Eén vraag, twee antwoorden die van elkaar verschillen in wat ze meenemen: alles binnen
 * het terugwerkende venster (`missedSessions`), of alleen wat er in één week staat
 * (`missedInWeek`). De weekpagina en de planpagina gebruiken de derde vorm,
 * `openForWeek` — die is voor de week waar je nú in zit ruimer dan de week zelf.
 *
 * Dit staat los van `backfill.ts` omdat het een laag hoger zit: hier is de hele
 * dagopbouw voor nodig, inclusief de rustdag en de optionele zaterdag die in een
 * deloadweek wegvalt. Het venster zelf hangt daar juist niet van af.
 */

export type MissedWhat = 'strength' | 'run'

export interface Missed {
  date: string
  what: MissedWhat
  /** de soort krachtsessie; null bij een loop */
  kind: DayKind | null
  /** zoals het op het scherm heet */
  naam: string
}

/**
 * Wat er in het terugwerkende venster nog open staat: gepland, niet gedaan en niet
 * overgeslagen. Oudste eerst, en per dag eerst de loop en dan de krachtsessie —
 * dezelfde volgorde als waarin je ze op een dag doet.
 */
export function missedSessions(state: UserState, vandaag: string = today()): Missed[] {
  const start = backfillStart(vandaag)
  const out: Missed[] = []

  for (let iso = start; iso < vandaag; iso = addDays(iso, 1)) {
    const plan = buildDay(state, iso)
    if (plan.isRest) continue
    const run = plan.run
    if (run && !run.done && !run.skipped) {
      out.push({ date: iso, what: 'run', kind: null, naam: runName(run.kind, run.bike) })
    }
    const strength = plan.strength
    if (strength && !strength.done && !strength.skipped) {
      out.push({ date: iso, what: 'strength', kind: strength.kind, naam: strength.naam })
    }
  }

  return out
}

/** Wat er van de week van `monday` nog open staat en binnen het venster valt. */
export function missedInWeek(state: UserState, monday: string, vandaag: string = today()): Missed[] {
  const eind = addDays(mondayOf(monday), 7)
  return missedSessions(state, vandaag).filter((m) => m.date >= mondayOf(monday) && m.date < eind)
}

/**
 * Wat er op de weekpagina van `monday` als "nog in te vullen" hoort te staan.
 *
 * Voor de week waar je nu in zit is dat meer dan die week zelf: een sessie van vorige
 * week die nog open staat is nog steeds in te vullen én vandaag nog op te pakken, en die
 * is onzichtbaar als de teller precies op de weekgrens stopt. Precies dáár zag je het
 * niet meer — je kijkt op dinsdag naar deze week, en de sessie die je mist staat op
 * zondag ervoor. Voor elke andere week is het gewoon die week: die kun je niet meer
 * inhalen, alleen nog invullen.
 */
export function openForWeek(
  state: UserState,
  monday: string,
  vandaag: string = today(),
): Missed[] {
  return mondayOf(monday) === mondayOf(vandaag)
    ? missedSessions(state, vandaag)
    : missedInWeek(state, monday, vandaag)
}
