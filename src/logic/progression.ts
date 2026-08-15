import type { UserState, Exercise, ExerciseState, LoggedSet } from '../types'
import { BY_ID } from '../data/exercises'
import {
  MAX_BAND_LEVEL,
  MIN_BAND_LEVEL,
  bandLabel,
  clampBandLevel,
  isBandExercise,
  isTopBand,
  levelOf,
} from './band'

export type ProgressionPace = 'standard' | 'gentle'

export const CALIBRATION_TEXT = 'op gevoel, stop bij RIR 2-3'

export function roundTo(value: number, step: number): number {
  if (step <= 0) return Math.round(value * 10) / 10
  return Math.round(value / step) * step
}

export function emptyExerciseState(): ExerciseState {
  return {
    targetWeight: null,
    targetReps: null,
    targetLevel: null,
    graduatedTo: null,
    belowMinStreak: 0,
    lastNote: null,
    lastUpdated: null,
  }
}

export function stateFor(state: UserState, id: string): ExerciseState {
  return state.exerciseState[id] ?? emptyExerciseState()
}

export interface Target {
  weight: number | null
  reps: number
  /** bandniveau bij bandwerk; null bij alles wat in kilo's gaat */
  level: number | null
  /** kalibratie of nog geen data: op gevoel trainen */
  byFeel: boolean
  note?: string
}

/** Streefwaarden voor vandaag, inclusief deload-korting. */
export function targetFor(
  ex: Exercise,
  repMin: number,
  state: UserState,
  opts: { calibration: boolean; deload: boolean },
): Target {
  const es = stateFor(state, ex.id)
  const reps = es.targetReps ?? repMin

  // bandwerk: geen kilo's, wel een niveau. Zonder historie begin je op de lichtste
  // band; dat is ook wat "let op" bij een gevoelig gebied voorschrijft.
  if (isBandExercise(ex)) {
    const level = clampBandLevel(es.targetLevel ?? MIN_BAND_LEVEL)
    if (opts.deload && level > MIN_BAND_LEVEL) {
      return { weight: null, reps, level: level - 1, byFeel: false }
    }
    return {
      weight: null,
      reps,
      level,
      byFeel: opts.calibration || es.targetLevel == null,
      note: opts.calibration ? CALIBRATION_TEXT : undefined,
    }
  }

  if (opts.calibration || es.targetWeight === null) {
    return { weight: es.targetWeight, reps, level: null, byFeel: true, note: CALIBRATION_TEXT }
  }
  let w = es.targetWeight
  if (opts.deload) w = roundTo(w * 0.9, ex.minIncrement || 0.5)
  return { weight: w, reps, level: null, byFeel: false }
}

export interface ProgressionResult {
  next: ExerciseState
  message: string | null
}

/**
 * Werkt de streefwaarden bij na een sessie.
 * - alle sets op repMax met RIR <= 2  -> gewicht omhoog met minIncrement, reps terug naar repMin
 * - progression 'reps'                -> eerst door tot repMax + 2, pas dan gewicht omhoog
 * - twee sessies onder de ondergrens  -> streefgewicht 5% omlaag
 *
 * `pace: 'gentle'` (beginnersprogramma) behandelt élke oefening als reps-progressie:
 * eerst herhalingen opbouwen tot boven de bovengrens, pas daarna gewicht erbij. Dat
 * klimt duidelijk rustiger dan meteen naar de volgende schijf.
 */
export function applyProgression(
  ex: Exercise,
  bounds: { repMin: number; repMax: number },
  sets: LoggedSet[],
  prev: ExerciseState,
  opts: { allowIncrease: boolean; pace?: ProgressionPace },
): ProgressionResult {
  const done = sets.filter((s) => s.reps > 0)
  if (done.length === 0) return { next: prev, message: null }

  if (isBandExercise(ex)) return bandProgression(ex, bounds, done, prev, opts)

  const gentle = (opts.pace ?? 'standard') === 'gentle'
  const progression = gentle ? 'reps' : ex.progression
  const inc = ex.minIncrement
  const usedWeight = Math.max(...done.map((s) => s.weight))
  const minReps = Math.min(...done.map((s) => s.reps))
  const maxRir = Math.max(...done.map((s) => s.rir))
  const currentTargetReps = prev.targetReps ?? bounds.repMin
  const repCeiling = progression === 'reps' ? bounds.repMax + 2 : bounds.repMax

  const next: ExerciseState = {
    ...prev,
    targetWeight: prev.targetWeight ?? usedWeight,
    targetReps: currentTargetReps,
    lastUpdated: new Date().toISOString(),
    lastNote: null,
  }

  // basis: wat er daadwerkelijk gelift is, is het nieuwe uitgangspunt
  if (usedWeight > 0) next.targetWeight = usedWeight

  // onder de ondergrens gebleven
  if (minReps < bounds.repMin) {
    const streak = prev.belowMinStreak + 1
    if (streak >= 2 && next.targetWeight && next.targetWeight > 0) {
      next.targetWeight = roundTo(next.targetWeight * 0.95, inc || 0.5)
      next.belowMinStreak = 0
      next.targetReps = bounds.repMin
      const msg = `${ex.naam}: twee sessies onder ${bounds.repMin} reps — streefgewicht 5% omlaag naar ${fmt(next.targetWeight)} kg.`
      next.lastNote = msg
      return { next, message: msg }
    }
    next.belowMinStreak = streak
    next.targetReps = bounds.repMin
    return { next, message: null }
  }

  next.belowMinStreak = 0

  const succeeded = minReps >= Math.min(repCeiling, Math.max(currentTargetReps, bounds.repMax)) && maxRir <= 2
  const repsSucceeded = progression === 'reps' && minReps >= currentTargetReps && maxRir <= 2

  if (!opts.allowIncrease) {
    next.lastNote = 'Check-in 3: vandaag geen nieuwe gewichtsverhoging.'
    return { next, message: null }
  }

  if (progression === 'weight') {
    if (succeeded) {
      if (inc > 0 && next.targetWeight !== null) {
        next.targetWeight = roundTo(next.targetWeight + inc, inc)
        next.targetReps = bounds.repMin
        const msg = `${ex.naam}: alle sets op ${bounds.repMax} met RIR ≤ 2 — omhoog naar ${fmt(next.targetWeight)} kg.`
        return { next, message: msg }
      }
      next.targetReps = Math.min(currentTargetReps + 1, repCeiling)
      return { next, message: null }
    }
    next.targetReps = Math.max(bounds.repMin, Math.min(minReps + 1, bounds.repMax))
    return { next, message: null }
  }

  // progression === 'reps' (ook alle oefeningen bij pace 'gentle')
  if (repsSucceeded) {
    if (currentTargetReps < repCeiling) {
      next.targetReps = currentTargetReps + 1
      return { next, message: null }
    }
    if (inc > 0 && next.targetWeight !== null) {
      next.targetWeight = roundTo(next.targetWeight + inc, inc)
      next.targetReps = bounds.repMin
      const msg = `${ex.naam}: ${repCeiling} reps gehaald — omhoog naar ${fmt(next.targetWeight)} kg, terug naar ${bounds.repMin} reps.`
      return { next, message: msg }
    }
    next.targetReps = repCeiling
    return { next, message: null }
  }

  next.targetReps = Math.max(bounds.repMin, Math.min(minReps, repCeiling))
  return { next, message: null }
}

/**
 * Progressie op bandwerk: reps erbij op dezelfde band, daarna de volgende band.
 *
 * De trap is bewust dezelfde als bij reps-progressie op gewicht, alleen staat er een
 * bandniveau in plaats van kilo's. Twee sessies onder de ondergrens gaat een band
 * terug, in plaats van 5% eraf.
 *
 * Boven de zwaarste band houdt het op. Heeft de oefening een belaste variant
 * (`progressesTo`), dan groeit hij daarin op: `graduatedTo` blijft in de staat staan en
 * de selectie pakt vanaf de volgende sessie die oefening, die wél in kilo's loopt.
 * Zonder zo'n variant blijft het bij de zwaarste band en meer reps.
 */
function bandProgression(
  ex: Exercise,
  bounds: { repMin: number; repMax: number },
  done: LoggedSet[],
  prev: ExerciseState,
  opts: { allowIncrease: boolean; pace?: ProgressionPace },
): ProgressionResult {
  const usedLevel = clampBandLevel(Math.max(...done.map(levelOf)))
  const minReps = Math.min(...done.map((s) => s.reps))
  const maxRir = Math.max(...done.map((s) => s.rir))
  const currentTargetReps = prev.targetReps ?? bounds.repMin
  const repCeiling = bounds.repMax + 2

  const next: ExerciseState = {
    ...prev,
    // bandwerk kent geen kilo's: die blijven leeg, zodat volume en 1RM schoon blijven
    targetWeight: null,
    targetLevel: usedLevel,
    targetReps: currentTargetReps,
    lastUpdated: new Date().toISOString(),
    lastNote: null,
  }

  if (minReps < bounds.repMin) {
    const streak = prev.belowMinStreak + 1
    if (streak >= 2 && usedLevel > MIN_BAND_LEVEL) {
      next.targetLevel = usedLevel - 1
      next.belowMinStreak = 0
      next.targetReps = bounds.repMin
      const msg = `${ex.naam}: twee sessies onder ${bounds.repMin} reps — terug naar ${bandLabel(next.targetLevel)}.`
      next.lastNote = msg
      return { next, message: msg }
    }
    next.belowMinStreak = streak
    next.targetReps = bounds.repMin
    return { next, message: null }
  }

  next.belowMinStreak = 0

  if (!opts.allowIncrease) {
    next.lastNote = 'Check-in 3: vandaag geen zwaardere band.'
    return { next, message: null }
  }

  const succeeded = minReps >= currentTargetReps && maxRir <= 2
  if (!succeeded) {
    next.targetReps = Math.max(bounds.repMin, Math.min(minReps, repCeiling))
    return { next, message: null }
  }

  if (currentTargetReps < repCeiling) {
    next.targetReps = currentTargetReps + 1
    return { next, message: null }
  }

  if (!isTopBand(usedLevel)) {
    next.targetLevel = usedLevel + 1
    next.targetReps = bounds.repMin
    const msg = `${ex.naam}: ${repCeiling} reps gehaald — door naar ${bandLabel(next.targetLevel)}, terug naar ${bounds.repMin} reps.`
    return { next, message: msg }
  }

  // zwaarste band én het repsplafond: verder kan de band niet
  const volgende = ex.progressesTo ? BY_ID[ex.progressesTo] : undefined
  if (volgende) {
    next.graduatedTo = volgende.id
    next.targetReps = bounds.repMin
    const msg = `${ex.naam}: ${bandLabel(MAX_BAND_LEVEL)} op ${repCeiling} reps — verder met ${volgende.naam}, daar gaat het gewicht wél omhoog.`
    next.lastNote = msg
    return { next, message: msg }
  }

  next.targetReps = repCeiling
  return { next, message: null }
}

export function fmt(n: number | null): string {
  if (n === null) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '').replace(/\.$/, '')
}

/** Geschat 1RM volgens Epley. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}
