import type { Exercise, LoggedSet } from '../types'

/**
 * Dumbbell-conventie. Staat hier één keer, zodat invoer, volume en advies er
 * gegarandeerd hetzelfde over denken.
 *
 * 1. GEWICHT wordt PER DUMBBELL ingevoerd, niet als totaal. Twee dumbbells van
 *    12,5 kg log je als 12,5, niet als 25. Zo staat het ook op de dumbbell zelf.
 * 2. REPS worden PER ZIJDE geteld. 10 links en 10 rechts tegelijk is 10 reps,
 *    niet 20. Bij een eenzijdige oefening (`perSide`) doe je die 10 dus per kant.
 * 3. INTERN telt een tweezijdige dumbbell-oefening dubbel: je tilt twee
 *    dumbbells, dus is de belasting 2 × het ingevoerde gewicht. Dat geldt voor
 *    volumeberekeningen en voor het omrekenen van startgewichtadvies tussen
 *    oefeningen met verschillend materiaal.
 *
 * Bij een eenzijdige oefening komt de factor 2 aan de andere kant terug: één
 * dumbbell, maar twee kanten. Het totale werk van een set is daardoor voor beide
 * varianten op dezelfde manier te berekenen.
 */

export const DUMBBELL_WEIGHT_UNIT = 'per dumbbell'
export const DUMBBELL_REPS_UNIT = 'per zijde'

export function isDumbbell(ex: Exercise): boolean {
  return ex.equipment.includes('dumbbells')
}

/** Twee dumbbells tegelijk: beide kanten werken in dezelfde rep. */
export function isBilateralDumbbell(ex: Exercise): boolean {
  return isDumbbell(ex) && !ex.perSide
}

/**
 * Hoe vaak het ingevoerde gewicht daadwerkelijk in je handen zit.
 * 2 bij een tweezijdige dumbbell-oefening, anders 1.
 */
export function loadFactor(ex: Exercise): number {
  return isBilateralDumbbell(ex) ? 2 : 1
}

/** Hoe vaak een set uitgevoerd wordt: 2 bij werk per kant, anders 1. */
export function sideFactor(ex: Exercise): number {
  return ex.perSide ? 2 : 1
}

/** Wat er per rep echt aan gewicht beweegt, uit het ingevoerde getal. */
export function totalLoadKg(ex: Exercise, weight: number): number {
  return round(weight * loadFactor(ex))
}

/**
 * Volume van één set in kg: gewicht × reps, met de dumbbell-conventie erin.
 * Tweezijdig telt het gewicht dubbel, eenzijdig tellen de reps dubbel (beide kanten).
 */
export function setVolumeKg(ex: Exercise, set: LoggedSet): number {
  if (set.weight <= 0 || set.reps <= 0) return 0
  return round(set.weight * loadFactor(ex) * set.reps * sideFactor(ex))
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
