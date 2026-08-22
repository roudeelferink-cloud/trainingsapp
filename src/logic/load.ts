import type { Exercise, Settings } from '../types'
import { MAX_BAND_LEVEL, isBandExercise } from './band'
import { barWeightFor } from './barWeight'
import { DUMBBELL_REPS_UNIT, DUMBBELL_WEIGHT_UNIT, isDumbbell, isUnilateral } from './dumbbell'

/**
 * Wat er boven een invoerveld hoort te staan. De eenheid moet expliciet zijn:
 * "kg" is bij een stang iets anders (alleen schijven) dan bij dumbbells (per
 * dumbbell, niet het totaal van twee), en bandwerk gaat helemaal niet in kilo's.
 */

export function weightInputLabel(ex: Exercise, settings: Settings): string {
  if (isBandExercise(ex)) return 'bandniveau'
  if (barWeightFor(ex, settings) > 0) return 'kg schijven'
  if (isDumbbell(ex)) return `kg ${DUMBBELL_WEIGHT_UNIT}`
  return 'kg'
}

/**
 * Boven het repveld. "Per zijde" hoort er alleen te staan als de oefening ook echt per
 * zijde gaat: bij tweearmig werk is een rep een rep, en de toevoeging zou de helft van
 * het werk laten verdwijnen.
 */
export function repsInputLabel(ex: Exercise): string {
  return isUnilateral(ex) ? `reps ${DUMBBELL_REPS_UNIT}` : 'reps'
}

/**
 * Korte toelichting onder het repveld: hoe je bij eenzijdig werk telt. Bij tweearmig
 * werk valt de regel weg — daar is niets uit te leggen wat het veld niet al zegt.
 */
export function repsHint(ex: Exercise): string | null {
  if (!isUnilateral(ex)) return null
  return 'Per kant tellen: 10 links en 10 rechts is 10 reps, niet 20.'
}

/** Korte toelichting onder het gewichtsveld; null als er niets uit te leggen valt. */
export function loadHint(ex: Exercise, settings: Settings): string | null {
  if (isBandExercise(ex)) {
    return `Geen kilo's: log de band die je gebruikt, 1 is de lichtste en ${MAX_BAND_LEVEL} de zwaarste.`
  }
  if (barWeightFor(ex, settings) > 0) return null // daar staat het totaal al onder
  if (!isDumbbell(ex)) return null
  return isUnilateral(ex)
    ? 'Gewicht van de dumbbell in je hand; reps per kant.'
    : 'Gewicht van één dumbbell, niet van twee samen.'
}
