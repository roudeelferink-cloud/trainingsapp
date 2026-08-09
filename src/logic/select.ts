import { alternatives, getExercise } from '../data/exercises'
import type { UserState, Exercise, LoadArea, SessionSlot, Sensitivity } from '../types'

export type ReplaceReason = 'permanent' | 'rotatie' | 'reismodus' | 'gevoelig' | 'vandaag'

export interface ResolvedSlot {
  slot: SessionSlot
  exercise: Exercise
  sets: number
  repMin: number
  repMax: number
  reasons: ReplaceReason[]
  /** gevoelig gebied kon niet weggefilterd worden */
  warning?: string
}

const TRAVEL_EQUIPMENT = new Set(['bodyweight', 'band'])

export function isTravelSafe(e: Exercise): boolean {
  return e.equipment.every((q) => TRAVEL_EQUIPMENT.has(q))
}

export function offAreas(sensitive: Record<LoadArea, Sensitivity>): LoadArea[] {
  return (Object.keys(sensitive) as LoadArea[]).filter((a) => sensitive[a] === 'off')
}

function conflicts(e: Exercise, off: LoadArea[]): boolean {
  return e.loads.some((l) => off.includes(l))
}

/** Volgende variant binnen hetzelfde pattern, deterministisch. */
function rotate(base: Exercise, rotation: number): Exercise {
  if (rotation === 0) return base
  const pool = alternatives(base)
    .filter((c) => c.role === base.role || c.pattern === base.pattern)
    .sort((a, b) => a.id.localeCompare(b.id))
  if (pool.length < 2) return base
  const i = pool.findIndex((c) => c.id === base.id)
  return pool[(Math.max(0, i) + rotation) % pool.length]
}

function travelSwap(e: Exercise): Exercise {
  if (isTravelSafe(e)) return e
  const alt = getExercise(e.bodyweightAlternative)
  if (isTravelSafe(alt)) return alt
  const pool = alternatives(e).filter(isTravelSafe)
  return pool[0] ?? alt
}

function sensitiveSwap(e: Exercise, off: LoadArea[], travel: boolean): { ex: Exercise; changed: boolean; warning?: string } {
  if (off.length === 0 || !conflicts(e, off)) return { ex: e, changed: false }
  const pool = alternatives(e).filter((c) => !conflicts(c, off) && (!travel || isTravelSafe(c)))
  if (pool.length === 0) {
    return { ex: e, changed: false, warning: 'Geen alternatief zonder gevoelig gebied — let extra op.' }
  }
  // zelfde rol eerst, daarna de eerste bruikbare
  const sameRole = pool.find((c) => c.role === e.role)
  return { ex: sameRole ?? pool[0], changed: true }
}

export function resolveSlot(
  slot: SessionSlot,
  state: UserState,
  iso: string,
  rotation: number,
): ResolvedSlot {
  const reasons: ReplaceReason[] = []
  const travel = state.settings.travelMode
  const off = offAreas(state.settings.sensitive)

  const daily = state.overrides[iso]?.swaps?.[slot.key]
  const perm = state.permanentReplacements[slot.key]

  let ex: Exercise
  if (daily) {
    ex = getExercise(daily)
    reasons.push('vandaag')
  } else if (perm) {
    ex = getExercise(perm)
    reasons.push('permanent')
  } else {
    const base = getExercise(slot.exerciseId)
    ex = rotate(base, rotation)
    if (ex.id !== base.id) reasons.push('rotatie')
  }

  if (travel) {
    const t = travelSwap(ex)
    if (t.id !== ex.id) {
      ex = t
      reasons.push('reismodus')
    }
  }

  const s = sensitiveSwap(ex, off, travel)
  if (s.changed) reasons.push('gevoelig')
  ex = s.ex

  const custom = ex.id !== slot.exerciseId
  return {
    slot,
    exercise: ex,
    sets: slot.setsReps.sets,
    repMin: custom ? ex.setsReps.repMin : slot.setsReps.repMin,
    repMax: custom ? ex.setsReps.repMax : slot.setsReps.repMax,
    reasons,
    warning: s.warning,
  }
}

/** Kandidaten die de UI aanbiedt bij "wissel". */
export function swapCandidates(current: Exercise, state: UserState): Exercise[] {
  const travel = state.settings.travelMode
  const off = offAreas(state.settings.sensitive)
  return alternatives(current)
    .filter((c) => c.id !== current.id)
    .filter((c) => !conflicts(c, off))
    .filter((c) => !travel || isTravelSafe(c))
}
