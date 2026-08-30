import type { DayKind, RunKind, SessionLog, UserState } from '../types'
import { addDays, formatLong, mondayOf, today } from './dates'
import { buildDay } from './day'

/**
 * Achteraf invullen: een sessie van een eerdere dag alsnog openen en loggen.
 *
 * De app kon alleen op de dag zelf iets vastleggen. Wie een dag vergat, kon er niets
 * meer mee — en dat is precies de dag die je later terugzoekt. Hier staat wat er nodig
 * is om dat wel te kunnen, en waar de grenzen liggen.
 *
 * **Het venster.** De lopende week plus de week ervoor. Verder terug niet: dan gok je
 * de gewichten in plaats van ze te herinneren, en een gegokte sessie is erger dan een
 * ontbrekende — die stuurt de progressie bij op iets wat nooit gebeurd is.
 *
 * **De volgorde van de progressie.** Streefgewichten lopen op de tijd: een sessie
 * bouwt voort op de stand van dát moment. Een sessie van dinsdag die je op donderdag
 * invult komt dus ná de sessie van woensdag binnen, terwijl hij ervoor hoort. Daarom
 * telt een achteraf ingevulde sessie per oefening alleen mee voor de streefgewichten
 * zolang er van díé oefening nog geen nieuwere sessie staat — zie `hasLaterLogFor`.
 * Alles wat de sessie verder is (tilvolume, historie, beoordeling, deloadtelling,
 * kilometers) telt gewoon mee, want dat hangt aan de datum en niet aan de volgorde.
 */

/** Hoeveel hele weken terug er nog in te vullen is, naast de lopende week. */
export const BACKFILL_WEEKS = 1

/** De vroegste dag die nog achteraf in te vullen is: de maandag van de week ervoor. */
export function backfillStart(vandaag: string = today()): string {
  return addDays(mondayOf(vandaag), -7 * BACKFILL_WEEKS)
}

/** Ligt deze dag in het verleden én binnen het terugwerkende venster? */
export function isBackfillDate(iso: string, vandaag: string = today()): boolean {
  return iso < vandaag && iso >= backfillStart(vandaag)
}

/** Ligt deze dag zo ver terug dat er niets meer in te vullen valt? */
export function isTooOld(iso: string, vandaag: string = today()): boolean {
  return iso < backfillStart(vandaag)
}

/** Eén regel bij een sessie van een eerdere dag; leeg als het gewoon vandaag is. */
export function backfillNotice(iso: string, vandaag: string = today()): string {
  if (!isBackfillDate(iso, vandaag)) return ''
  return `Sessie van ${formatLong(iso)}. Je vult hem achteraf in; hij landt op die datum, niet op vandaag.`
}

export const TOO_OLD_TEXT =
  'Deze dag ligt verder terug dan de vorige week. Zo ver terug invullen is gokken naar ' +
  'gewichten in plaats van ze herinneren, en dat stuurt de opbouw bij op iets wat niet gebeurd is.'

/** Is deze log achteraf ingevuld, op een andere dag dan waar hij over gaat? */
export function isBackfilled(log: { backfilledOn?: string } | null | undefined): boolean {
  return !!log?.backfilledOn
}

/* -------------------------------------------------------------------------
 * Wat er open staat
 * ---------------------------------------------------------------------- */

export type MissedWhat = 'strength' | 'run'

export interface Missed {
  date: string
  what: MissedWhat
  /** de soort krachtsessie; null bij een loop */
  kind: DayKind | null
  /** zoals het op het scherm heet */
  naam: string
}

export function runName(kind: RunKind, bike: boolean): string {
  if (bike) return 'Fietsen'
  return kind === 'long' ? 'Duurloop' : 'Korte loop'
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

/* -------------------------------------------------------------------------
 * De volgorde van de progressie
 * ---------------------------------------------------------------------- */

/**
 * Staat er van deze oefening al een afgeronde sessie ná `iso`?
 *
 * Zo ja, dan is de stand van de streefgewichten al voorbij deze sessie gelopen en mag
 * hij er niet meer aan komen: dat zou een oudere waarheid over een nieuwere heen
 * schrijven. De sessie zelf wordt gewoon bewaard.
 */
export function hasLaterLogFor(
  state: UserState,
  iso: string,
  exerciseId: string,
  exceptKey?: string,
): boolean {
  for (const [key, log] of Object.entries(state.sessions ?? {})) {
    if (key === exceptKey) continue
    if (!log?.completedAt || log.date <= iso) continue
    if (Object.values(log.exercises ?? {}).includes(exerciseId)) return true
  }
  return false
}

/** De regel die uitlegt waarom een achteraf ingevulde sessie de gewichten niet stuurt. */
export function staleProgressionNote(namen: string[]): string {
  const lijst =
    namen.length === 1
      ? namen[0]
      : `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`
  return (
    `Achteraf ingevuld: ${lijst} ${namen.length === 1 ? 'stuurt' : 'sturen'} de streefgewichten niet — ` +
    'daar staat al een nieuwere sessie tegenover. De sessie zelf is bewaard.'
  )
}

/**
 * De laatste afgeronde krachtsessie vóór `iso`, op datum en niet op invoermoment.
 *
 * Dat onderscheid is er sinds er achteraf ingevuld kan worden: een sessie van vorige
 * week die je vandaag invult heeft het jongste invoermoment van allemaal, maar is niet
 * de vorige sessie van vandaag.
 */
export function sortByDate(logs: SessionLog[]): SessionLog[] {
  return [...logs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return (a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1
  })
}
