import type { Exercise, Settings } from '../types'
import { barWeightFor } from './barWeight'
import { DUMBBELL_REPS_UNIT, DUMBBELL_WEIGHT_UNIT, isDumbbell } from './dumbbell'

/**
 * Wat er boven een invoerveld hoort te staan. De eenheid moet expliciet zijn:
 * "kg" is bij een stang iets anders (alleen schijven) dan bij dumbbells (per
 * dumbbell, niet het totaal van twee).
 */

export function weightInputLabel(ex: Exercise, settings: Settings): string {
  if (barWeightFor(ex, settings) > 0) return 'kg schijven'
  if (isDumbbell(ex)) return `kg ${DUMBBELL_WEIGHT_UNIT}`
  return 'kg'
}

export function repsInputLabel(ex: Exercise): string {
  return ex.perSide ? `reps ${DUMBBELL_REPS_UNIT}` : 'reps'
}

/** Korte toelichting onder het gewichtsveld; null als er niets uit te leggen valt. */
export function loadHint(ex: Exercise, settings: Settings): string | null {
  if (barWeightFor(ex, settings) > 0) return null // daar staat het totaal al onder
  if (!isDumbbell(ex)) return null
  return ex.perSide
    ? 'Gewicht van de dumbbell in je hand; reps per kant.'
    : 'Gewicht van één dumbbell, niet van twee samen.'
}
