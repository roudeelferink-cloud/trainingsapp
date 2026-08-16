import { programFor } from '../data/programs'
import type { DayKind, RunKind, UserState } from '../types'
import { weekday } from './dates'

/**
 * Wat er volgens het schema op een dag staat, verplaatsingen meegerekend.
 *
 * Dit stukje zat eerst in `day.ts`, maar meer dan één laag heeft het nodig: het
 * loopvolume moet weten welke lopen er deze week nog komen, en de waarschuwing over
 * zware benen vlak voor de duurloop moet weten waar die benensessie staat. Allemaal via
 * `buildDay` zou een kring opleveren — `buildDay` gebruikt die lagen zelf.
 */

export interface Scheduled<T> {
  /** wat er hier staat; null als deze dag leeg is */
  kind: T | null
  /** dit stond oorspronkelijk op die datum */
  movedFrom: string | null
  /** wat hier stond staat nu op die datum */
  movedTo: string | null
}

function resolve<T>(
  iso: string,
  pick: (weekdayIndex: number) => T | null,
  moves: Record<string, string>,
): Scheduled<T> {
  const movedTo = moves[iso] ?? null
  let kind = movedTo ? null : pick(weekday(iso))
  let movedFrom: string | null = null

  if (!kind) {
    const incoming = Object.entries(moves).find(([, to]) => to === iso)
    if (incoming) {
      const origin = incoming[0]
      const originKind = pick(weekday(origin))
      if (originKind) {
        kind = originKind
        movedFrom = origin
      }
    }
  }

  return { kind, movedFrom, movedTo }
}

/** De krachtsessie van deze dag. */
export function scheduledStrength(state: UserState, iso: string): Scheduled<DayKind> {
  const program = programFor(state)
  return resolve(iso, (wd) => program.week[wd - 1]?.strength ?? null, state.moves ?? {})
}

/** De loop van deze dag. Loopt los van de krachtsessie: eigen lijst met verplaatsingen. */
export function scheduledRun(state: UserState, iso: string): Scheduled<RunKind> {
  const program = programFor(state)
  return resolve(iso, (wd) => program.week[wd - 1]?.run ?? null, state.runMoves ?? {})
}

/** Is deze dag de vaste rustdag van dit programma? */
export function isRestDay(state: UserState, iso: string): boolean {
  return weekday(iso) === programFor(state).restWeekday
}
