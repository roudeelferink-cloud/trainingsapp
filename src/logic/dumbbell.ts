import type { Exercise, LoggedSet } from '../types'

/**
 * Dumbbell-conventie. Staat hier één keer, zodat invoer, volume en advies er
 * gegarandeerd hetzelfde over denken.
 *
 * 1. GEWICHT wordt PER DUMBBELL ingevoerd, niet als totaal. Twee dumbbells van
 *    12,5 kg log je als 12,5, niet als 25. Zo staat het ook op de dumbbell zelf.
 *    Dit geldt voor álle dumbbelloefeningen, eenarmig of niet.
 * 2. REPS worden PER ZIJDE geteld, maar **alleen bij eenarmig of eenbenig werk**
 *    (`unilateral`). Doe je de beweging met beide armen tegelijk — bankdrukken met
 *    twee dumbbells, lateral raises — dan is een rep gewoon een rep en staat er
 *    nergens "per zijde". Alleen bij eenzijdig werk doe je die 10 per kant.
 * 3. INTERN telt een tweezijdige dumbbell-oefening dubbel: je tilt twee
 *    dumbbells, dus is de belasting 2 × het ingevoerde gewicht. Dat geldt voor
 *    volumeberekeningen en voor het omrekenen van startgewichtadvies tussen
 *    oefeningen met verschillend materiaal.
 *
 * Bij een eenzijdige oefening komt die factor 2 aan de andere kant terug: één
 * dumbbell, maar twee kanten. Het totale werk van een set is daardoor voor beide
 * varianten op dezelfde manier te berekenen.
 *
 * De vlag zit op de oefening en niet op het materiaal: eenbenige leg press en side
 * plank zijn ook per kant, zonder dat er een dumbbell aan te pas komt.
 */

export const DUMBBELL_WEIGHT_UNIT = 'per dumbbell'
export const DUMBBELL_REPS_UNIT = 'per zijde'

/**
 * De dumbbells die er in de thuisgym liggen, per stuk, oplopend. Het advies rondt
 * hiernaartoe af: een schatting van 9 kg is niets waard als het rek van 5 naar 12,5
 * springt. De 5 kg is de nieuwste en tot nu toe ontbrekende stap — die maakt licht
 * isolatiewerk en een rustige start voor de tweede gebruiker pas mogelijk.
 */
export const DUMBBELL_WEIGHTS: number[] = [5, 12.5, 15, 17.5, 20]

export const LIGHTEST_DUMBBELL = DUMBBELL_WEIGHTS[0]

/**
 * De zwaarste dumbbell die niet boven het advies uitkomt: liever te licht dan te
 * zwaar. Zit het advies onder de lichtste dumbbell, dan is er geen bruikbare keuze
 * (null) — dan is dumbbellwerk simpelweg te zwaar om mee te beginnen.
 *
 * Het rek springt van 5 naar 12,5 kg. Valt een schatting daartussen, dan is 5 kg het
 * advies: aan de lichte kant, maar wel een gewicht dat er ligt. Naar boven afronden zou
 * de eerste set zwaarder maken dan de schatting, en dat is precies wat deze app niet
 * doet — het veld staat open en het advies zegt er zelf bij dat verhogen mag.
 */
export function dumbbellAtMost(weight: number): number | null {
  let out: number | null = null
  for (const kg of DUMBBELL_WEIGHTS) {
    if (kg <= weight + 1e-9) out = kg
  }
  return out
}

export function isDumbbell(ex: Exercise): boolean {
  return ex.equipment.includes('dumbbells')
}

/** Eenarmig of eenbenig: de oefening wordt per kant uitgevoerd. */
export function isUnilateral(ex: Exercise): boolean {
  return ex.unilateral
}

/** Twee dumbbells tegelijk: beide kanten werken in dezelfde rep. */
export function isBilateralDumbbell(ex: Exercise): boolean {
  return isDumbbell(ex) && !isUnilateral(ex)
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
  return isUnilateral(ex) ? 2 : 1
}

/** Wat er per rep echt aan gewicht beweegt, uit het ingevoerde getal. */
export function totalLoadKg(ex: Exercise, weight: number): number {
  return round(weight * loadFactor(ex))
}

/**
 * Volume van één set in kg: gewicht × reps, met de dumbbell-conventie erin.
 * Tweezijdig telt het gewicht dubbel, eenzijdig tellen de reps dubbel (beide kanten).
 *
 * Bandwerk telt niet mee: daar staat geen kilo tegenover, dus zou elk getal dat er
 * ooit is ingetypt het weekvolume vervuilen.
 */
export function setVolumeKg(ex: Exercise, set: LoggedSet): number {
  if (ex.unit === 'band') return 0
  if (set.weight <= 0 || set.reps <= 0) return 0
  return round(set.weight * loadFactor(ex) * set.reps * sideFactor(ex))
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
