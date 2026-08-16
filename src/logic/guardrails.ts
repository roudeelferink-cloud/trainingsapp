import { getExercise } from '../data/exercises'
import { programFor } from '../data/programs'
import type { DayKind, UserState } from '../types'
import { cycleInfo } from './cycle'
import { addDays, daysBetween, formatShort, mondayOf } from './dates'
import { deloadFor } from './deload'
import { weekLoad } from './runningLoad'
import { scheduledRun, scheduledStrength } from './schedule'

/**
 * De guardrails van een dag op één hoop.
 *
 * Alles wat de app uit zichzelf bijstuurt hoort zichtbaar en uitlegbaar te zijn: per
 * bijsturing één regel waarom. Deze module verzamelt de regels die je met alleen een
 * datum al kunt bepalen — deload, weekplafond en zware benen vlak voor de duurloop. De
 * bijsturingen die de sessie van vandaag zelf nodig hebben (de geschatte duur, het
 * gewichtsvoorstel per oefening) komen uit `duration.ts` en `progression.ts` en worden
 * in `day.ts` toegevoegd.
 */

export type GuardrailTone = 'info' | 'warn'

export interface Guardrail {
  id: string
  text: string
  tone: GuardrailTone
}

/**
 * Hoeveel uur er tussen zware benen en de duurloop hoort te zitten. Vrijdag valt op
 * precies 48 uur en blijft daarmee buiten de waarschuwing: dat is de standaardweek.
 * Zaterdag en de zondag zelf zitten eronder.
 */
export const LEGS_RUN_HOURS = 48

/** Doet deze sessie zwaar beenwerk? Bepaald door de oefeningen, niet door de naam. */
export function isHeavyLegsSession(state: UserState, kind: DayKind | null, week: number): boolean {
  if (!kind || kind === 'rest') return false
  const template = programFor(state).templateFor(kind, week)
  if (!template) return false
  return template.slots.some((slot) => {
    const id = state.permanentReplacements?.[slot.key] ?? slot.exerciseId
    const exercise = getExercise(id)
    return exercise.orderCategory === 'heavy_legs' && exercise.role === 'core'
  })
}

/** De dag van de duurloop in de week van `iso`, of null. */
export function longRunDay(state: UserState, iso: string): string | null {
  const mon = mondayOf(iso)
  for (let i = 0; i < 7; i++) {
    const date = addDays(mon, i)
    if (scheduledRun(state, date).kind === 'long') return date
  }
  return null
}

export interface LegsBeforeRun {
  /** de dag met het zware beenwerk */
  legsDate: string
  /** de dag van de duurloop */
  runDate: string
  /** een dag eerder in de week waar de beensessie wel kan; null als die er niet is */
  suggestion: string | null
  text: string
}

/**
 * Zware benen binnen 48 uur vóór de duurloop. Dat is de combinatie waar knieën en
 * achillespezen van omvallen: de benen zijn nog niet hersteld en gaan dan tien
 * kilometer op de weg.
 */
export function legsBeforeLongRun(state: UserState, iso: string): LegsBeforeRun | null {
  const runDate = longRunDay(state, iso)
  if (!runDate) return null
  if (state.skips?.[`${runDate}:run`]) return null

  const week = cycleInfo(state.startDate, runDate).week
  const maxDaysBefore = Math.floor(LEGS_RUN_HOURS / 24) - 1 // 48 uur = vanaf één dag ervoor

  for (let back = 0; back <= maxDaysBefore; back++) {
    const legsDate = addDays(runDate, -back)
    const kind = scheduledStrength(state, legsDate).kind
    if (!isHeavyLegsSession(state, kind, week)) continue
    if (state.skips?.[`${legsDate}:strength`]) continue

    const suggestion = swapSuggestion(state, legsDate, runDate, week)
    const uren = back === 0 ? 'op dezelfde dag als' : `minder dan ${LEGS_RUN_HOURS} uur voor`
    return {
      legsDate,
      runDate,
      suggestion,
      text:
        `Zware benensessie ${uren} de duurloop van ${formatShort(runDate)}.` +
        (suggestion ? ` Ruilen met ${formatShort(suggestion)} geeft je benen twee dagen.` : ''),
    }
  }

  return null
}

/**
 * Een dag eerder in dezelfde week waar de beensessie wel kan: minstens twee dagen voor
 * de duurloop, geen rustdag, en er staat nog geen zware beensessie.
 */
function swapSuggestion(
  state: UserState,
  legsDate: string,
  runDate: string,
  week: number,
): string | null {
  const program = programFor(state)
  const mon = mondayOf(runDate)
  for (let i = 0; i < 7; i++) {
    const date = addDays(mon, i)
    if (date === legsDate) continue
    if (daysBetween(date, runDate) < 2) continue
    if (program.restWeekday !== null && date === addDays(mon, program.restWeekday - 1)) continue
    if (isHeavyLegsSession(state, scheduledStrength(state, date).kind, week)) continue
    return date
  }
  return null
}

/** Alles wat er vandaag bijgestuurd wordt, met per bijsturing één regel waarom. */
export function dayGuardrails(state: UserState, iso: string): Guardrail[] {
  const out: Guardrail[] = []

  const deload = deloadFor(state, iso)
  if (deload.explanation) {
    out.push({ id: 'deload', text: deload.explanation, tone: deload.skipped ? 'warn' : 'info' })
  }

  const load = weekLoad(state, iso)
  for (const [i, text] of load.reasons.entries()) {
    if (text.startsWith('Deloadweek')) continue // staat al bij de deload zelf
    out.push({ id: `loopvolume-${i}`, text, tone: 'info' })
  }
  if (load.overCapReason) out.push({ id: 'loopvolume-over', text: load.overCapReason, tone: 'warn' })

  const legs = legsBeforeLongRun(state, iso)
  if (legs && (iso === legs.legsDate || iso === legs.runDate)) {
    out.push({ id: 'benen-voor-duurloop', text: legs.text, tone: 'warn' })
  }

  return out
}
