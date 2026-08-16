import type { Feel, UserState, Exercise, ExerciseState, LoggedSet, Settings } from '../types'
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
import { daysBetween, mondayOf } from './dates'
import { DELOAD_WEIGHT_FACTOR } from './deload'
import { allowsIncrease } from './feel'
import { nextLoadable, roundToLoadable } from './plates'

export type ProgressionPace = 'standard' | 'gentle'

export const CALIBRATION_TEXT = 'op gevoel, stop bij RIR 2-3'

/**
 * De maximale sprong per oefening per week. Samengesteld werk verdraagt een grotere
 * stap dan isolatie, maar geen van beide meer dan dit — ook niet na drie goede sessies
 * in dezelfde week. De grens zit op de oefening, niet op de sessie.
 */
export const MAX_JUMP_COMPOUND = 2.5
export const MAX_JUMP_ISOLATION = 1.25

/** Terugschakelen na twee sessies onder de ondergrens. */
export const SETBACK_FACTOR = 0.9

export function isCompound(ex: Exercise): boolean {
  return ex.orderCategory === 'heavy_legs' || ex.orderCategory === 'compound'
}

/** Wat er deze week maximaal bij mag op deze oefening. */
export function maxWeeklyJump(ex: Exercise): number {
  return isCompound(ex) ? MAX_JUMP_COMPOUND : MAX_JUMP_ISOLATION
}

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
    increaseWeek: null,
    increasedKg: 0,
  }
}

/** Hoeveel er deze week al bij kwam op deze oefening. */
export function increasedThisWeek(prev: ExerciseState, iso: string): number {
  if (!prev.increaseWeek || prev.increaseWeek !== mondayOf(iso)) return 0
  return prev.increasedKg ?? 0
}

/**
 * Hoeveel hele weken er sinds de laatste verhoging voorbij zijn. Oneindig als er nog
 * nooit verhoogd is — dan houdt niets de eerste stap tegen.
 */
export function weeksSinceIncrease(prev: ExerciseState, iso: string): number {
  if (!prev.increaseWeek) return Number.POSITIVE_INFINITY
  return Math.floor(daysBetween(prev.increaseWeek, mondayOf(iso)) / 7)
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
  if (opts.deload) {
    // 40% eraf, en dan naar beneden naar wat er echt te laden is
    w = roundToLoadable(w * DELOAD_WEIGHT_FACTOR, ex, state.settings)
  }
  return { weight: w, reps, level: null, byFeel: false }
}

export interface ProgressionResult {
  next: ExerciseState
  message: string | null
}

export interface ProgressionOptions {
  allowIncrease: boolean
  pace?: ProgressionPace
  /** datum van de sessie; bepaalt in welke week de verhoging valt */
  iso: string
  /** hoe de sessie viel; bepaalt samen met de reps of er verhoogd wordt */
  feel?: Feel
  /**
   * Deze sessie viel in een deloadweek. Dan is er met opzet lichter getild, en dat mag het
   * streefgewicht niet omlaag trekken: na de deloadweek pak je gewoon weer op waar je was.
   */
  deload?: boolean
  /** schijven en stanggewichten, om af te ronden op wat te laden is */
  settings?: Settings
}

/**
 * Werkt de streefwaarden bij na een sessie: double progression met een rem erop.
 *
 * - alle sets op de bovengrens **en** de sessie als 'makkelijk' of 'goed' beoordeeld
 *   -> gewicht omhoog naar het eerstvolgende gewicht dat te laden is;
 * - 'zwaar', of de reps niet gehaald -> gewicht ongewijzigd;
 * - twee sessies op rij onder de ondergrens -> streefgewicht 10% omlaag;
 * - per oefening nooit meer dan 2,5 kg (samengesteld) of 1,25 kg (isolatie) per week,
 *   ook niet na meerdere goede sessies;
 * - is de kleinste échte stap groter dan die grens — een dumbbellrek dat van 5 naar
 *   12,5 springt, of alleen schijven van 5 kg — dan blijft het gewicht staan en gaan
 *   er reps bij.
 *
 * Zonder beoordeling (oude logs, of overgeslagen) valt de beslissing terug op de
 * gelogde RIR: RIR ≤ 2 telt dan als 'goed'.
 *
 * `pace: 'gentle'` (beginnersprogramma) behandelt élke oefening als reps-progressie:
 * eerst herhalingen opbouwen tot boven de bovengrens, pas daarna gewicht erbij.
 */
export function applyProgression(
  ex: Exercise,
  bounds: { repMin: number; repMax: number },
  sets: LoggedSet[],
  prev: ExerciseState,
  opts: ProgressionOptions,
): ProgressionResult {
  const done = sets.filter((s) => s.reps > 0)
  if (done.length === 0) return { next: prev, message: null }

  if (isBandExercise(ex)) return bandProgression(ex, bounds, done, prev, opts)

  const gentle = (opts.pace ?? 'standard') === 'gentle'
  const progression = gentle ? 'reps' : ex.progression
  const usedWeight = Math.max(...done.map((s) => s.weight))
  const minReps = Math.min(...done.map((s) => s.reps))
  const currentTargetReps = prev.targetReps ?? bounds.repMin
  const repCeiling = progression === 'reps' ? bounds.repMax + 2 : bounds.repMax
  const feltGood = feelSaysGo(done, opts.feel)

  const next: ExerciseState = {
    ...prev,
    targetWeight: prev.targetWeight ?? usedWeight,
    targetReps: currentTargetReps,
    lastUpdated: new Date().toISOString(),
    lastNote: null,
  }

  // basis: wat er daadwerkelijk gelift is, is het nieuwe uitgangspunt. In een deloadweek
  // alleen naar boven: daar staat met opzet minder gewicht op de stang.
  if (usedWeight > 0 && (!opts.deload || usedWeight > (prev.targetWeight ?? 0))) {
    next.targetWeight = usedWeight
  }

  // onder de ondergrens gebleven
  if (minReps < bounds.repMin) {
    const streak = prev.belowMinStreak + 1
    if (streak >= 2 && next.targetWeight && next.targetWeight > 0) {
      next.targetWeight = roundToLoadable(next.targetWeight * SETBACK_FACTOR, ex, opts.settings)
      next.belowMinStreak = 0
      next.targetReps = bounds.repMin
      const msg = `${ex.naam}: twee sessies onder ${bounds.repMin} reps — streefgewicht 10% omlaag naar ${fmt(next.targetWeight)} kg.`
      next.lastNote = msg
      return { next, message: msg }
    }
    next.belowMinStreak = streak
    next.targetReps = bounds.repMin
    return { next, message: null }
  }

  next.belowMinStreak = 0

  const repsAtCeiling = minReps >= Math.min(repCeiling, Math.max(currentTargetReps, bounds.repMax))
  const succeeded = repsAtCeiling && feltGood
  const repsSucceeded = progression === 'reps' && minReps >= currentTargetReps && feltGood

  if (opts.feel === 'zwaar' && repsAtCeiling) {
    next.lastNote = `${ex.naam}: reps gehaald, maar de sessie viel zwaar — gewicht blijft staan.`
    return { next, message: null }
  }

  if (!opts.allowIncrease) {
    next.lastNote = 'Check-in 3: vandaag geen nieuwe gewichtsverhoging.'
    return { next, message: null }
  }

  if (progression === 'weight') {
    if (succeeded) {
      const step = raise(ex, next.targetWeight, prev, opts)
      if (step.weight !== null) {
        next.targetWeight = step.weight
        next.targetReps = bounds.repMin
        next.increaseWeek = mondayOf(opts.iso)
        next.increasedKg = step.total
        const msg = `${ex.naam}: alle sets op ${bounds.repMax} ${reason(opts.feel)} — omhoog naar ${fmt(next.targetWeight)} kg.`
        return { next, message: msg }
      }
      // niet verhogen: dan maar een rep erbij, en uitleggen waarom
      next.targetReps = Math.min(currentTargetReps + 1, bounds.repMax + 2)
      next.lastNote = step.blocked || null
      return { next, message: step.blocked || null }
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
    const step = raise(ex, next.targetWeight, prev, opts)
    if (step.weight !== null) {
      next.targetWeight = step.weight
      next.targetReps = bounds.repMin
      next.increaseWeek = mondayOf(opts.iso)
      next.increasedKg = step.total
      const msg = `${ex.naam}: ${repCeiling} reps gehaald — omhoog naar ${fmt(next.targetWeight)} kg, terug naar ${bounds.repMin} reps.`
      return { next, message: msg }
    }
    next.targetReps = repCeiling
    next.lastNote = step.blocked || null
    return { next, message: step.blocked || null }
  }

  next.targetReps = Math.max(bounds.repMin, Math.min(minReps, repCeiling))
  return { next, message: null }
}

/**
 * Mag het gewicht omhoog, en zo ja naar welk gewicht?
 *
 * De grens is 2,5 kg per week op samengesteld werk en 1,25 kg op isolatie. Twee dingen
 * kunnen een verhoging tegenhouden:
 *
 * 1. **De week is op.** Er kwam deze week al genoeg bij; een tweede goede sessie levert
 *    niets extra's op.
 * 2. **De kleinste stap past niet.** Het lichtste dat erbij kan is soms groter dan de
 *    weekgrens: een dumbbellrek dat van 5 naar 12,5 kg springt, of een machine met
 *    schijven van 1,25 kg terwijl isolatie maar 1,25 kg per week mag (schijven gaan per
 *    paar, dus de stap is 2,5). Zo'n stap wordt uitgesmeerd: hij mag pas als er genoeg
 *    weken tussen zitten om er gemiddeld onder de grens mee uit te komen — 2,5 kg op
 *    isolatie dus eens per twee weken. Anders zou zo'n oefening nooit meer zwaarder
 *    kunnen worden, en dat is geen rem maar een muur.
 *
 * In beide gevallen komt er een regel terug die uitlegt waarom er niets verandert; de
 * sessie gaat dan verder op reps.
 */
function raise(
  ex: Exercise,
  current: number | null,
  prev: ExerciseState,
  opts: ProgressionOptions,
): { weight: number | null; total: number; blocked: string } {
  const max = maxWeeklyJump(ex)
  const used = increasedThisWeek(prev, opts.iso)
  const room = Math.round((max - used) * 1000) / 1000

  if (current === null || current <= 0) return { weight: null, total: used, blocked: '' }

  const target = nextLoadable(current, ex, opts.settings)
  if (target === null) return { weight: null, total: used, blocked: '' }
  const jump = Math.round((target - current) * 1000) / 1000

  if (jump <= room + 1e-9) {
    return { weight: target, total: Math.round((used + jump) * 1000) / 1000, blocked: '' }
  }

  if (used > 0) {
    return {
      weight: null,
      total: used,
      blocked: `${ex.naam}: deze week al ${fmt(used)} kg omhoog — dat is het maximum van ${fmt(max)} kg per week. Reps erbij in plaats van kilo's.`,
    }
  }

  const weken = Math.max(1, Math.ceil(jump / max - 1e-9))
  const gewacht = weeksSinceIncrease(prev, opts.iso)
  if (gewacht >= weken) {
    return { weight: target, total: jump, blocked: '' }
  }

  const teGaan = weken - gewacht
  return {
    weight: null,
    total: used,
    blocked: `${ex.naam}: de kleinste stap die te laden is, is ${fmt(jump)} kg — meer dan de ${fmt(max)} kg per week. Die mag over ${teGaan} ${teGaan === 1 ? 'week' : 'weken'}; tot dan reps erbij.`,
  }
}

/**
 * Ging het goed genoeg om te verhogen? De beoordeling is leidend; ontbreekt hij, dan
 * beslist de gelogde RIR zoals voorheen.
 */
function feelSaysGo(done: LoggedSet[], feel: Feel | undefined): boolean {
  if (feel) return allowsIncrease(feel)
  return Math.max(...done.map((s) => s.rir)) <= 2
}

/** Waarom er verhoogd werd: de beoordeling, of anders de RIR waar hij op terugviel. */
function reason(feel: Feel | undefined): string {
  return feel ? `en de sessie viel ${feel}` : 'met RIR ≤ 2'
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
  opts: ProgressionOptions,
): ProgressionResult {
  const usedLevel = clampBandLevel(Math.max(...done.map(levelOf)))
  const minReps = Math.min(...done.map((s) => s.reps))
  const currentTargetReps = prev.targetReps ?? bounds.repMin
  const repCeiling = bounds.repMax + 2

  const prevLevel = clampBandLevel(prev.targetLevel ?? MIN_BAND_LEVEL)
  const next: ExerciseState = {
    ...prev,
    // bandwerk kent geen kilo's: die blijven leeg, zodat volume en 1RM schoon blijven
    targetWeight: null,
    // in een deloadweek staat er met opzet een lichtere band om; dat is geen stap terug
    targetLevel: opts.deload ? Math.max(prevLevel, usedLevel) : usedLevel,
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

  const succeeded = minReps >= currentTargetReps && feelSaysGo(done, opts.feel)
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
