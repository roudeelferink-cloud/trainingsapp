import type { UserState, Exercise } from '../types'
import { BY_ID } from '../data/exercises'
import { dumbbellAtMost, isDumbbell, loadFactor, totalLoadKg } from './dumbbell'

export interface StartAdvice {
  weight: number
  /** waar de schatting op gebaseerd is */
  source: 'related' | 'bodyweight'
  /** naam van de vergelijkbare oefening, als die gebruikt is */
  relatedName?: string
}

export const ADVICE_HINT =
  'Voelt dit te licht? Verhoog gerust — de app rekent verder met wat je logt.'

/** Naar beneden afronden op de kleinste haalbare stap: liever te licht dan te zwaar. */
function floorToStep(value: number, step: number): number {
  if (step <= 0) return Math.round(value)
  const n = Math.floor(value / step) * step
  return Math.round(n * 100) / 100
}

/**
 * Naar iets wat er ook echt ligt. Bij dumbbells is dat het rek (5, 12,5, 15, 17,5,
 * 20 kg per stuk); bij de rest de kleinste stap van de oefening. Een advies van 9 kg
 * helpt niemand als de dumbbell ernaast 5 of 12,5 weegt.
 */
function toAvailable(ex: Exercise, value: number): number | null {
  if (isDumbbell(ex)) return dumbbellAtMost(value)
  const w = floorToStep(value, ex.minIncrement)
  return w > 0 ? w : null
}

/** Is er al iets gelogd voor deze oefening? Dan neemt de progressielogica het over. */
export function hasLoggedHistory(state: UserState, exerciseId: string): boolean {
  const es = state.exerciseState[exerciseId]
  return !!es && (es.targetWeight !== null || es.lastUpdated !== null)
}

/**
 * Conservatief startgewicht voor een oefening zonder historie.
 *
 * De keten van `relatedRatio` wordt afgelopen tot een oefening waar wél data van is;
 * de ratio's onderweg worden met elkaar vermenigvuldigd. Pas als de hele keten leeg
 * is, valt het advies terug op lichaamsgewicht × startFactor. Zonder lichaamsgewicht
 * geen advies.
 *
 * `scale` komt uit het programma: een beginnersprogramma start bewust lichter.
 *
 * Het advies is uitgedrukt in de eenheid waarin je invult: per dumbbell bij
 * dumbbell-werk, en inclusief het stanggewicht bij een stang. Bij dumbbells rondt het
 * af naar een gewicht dat er ook echt ligt; ligt de schatting onder de lichtste
 * dumbbell, dan is er geen advies en train je op gevoel met de lichtste. Onderweg door de
 * keten wordt met de werkelijke belasting gerekend (zie `loadFactor`), zodat een
 * verhouding tussen twee soorten materiaal blijft kloppen.
 *
 * De keten is per opzet acyclisch en eindigt bij een anker zonder verwijzing; de
 * `seen`-set hieronder is puur een veiligheidsklep voor handmatig aangepaste data.
 */
export function startWeightAdvice(ex: Exercise, state: UserState, scale = 1): StartAdvice | null {
  if (ex.unit === 'bw' || ex.unit === 'band') return null
  if (hasLoggedHistory(state, ex.id)) return null

  let current = ex
  let ratio = 1
  const seen = new Set<string>([ex.id])

  while (current.relatedRatio) {
    const { exerciseId, ratio: step } = current.relatedRatio
    if (seen.has(exerciseId)) break
    const next = BY_ID[exerciseId]
    if (!next) break

    seen.add(next.id)
    ratio *= step

    const relWeight = state.exerciseState[next.id]?.targetWeight
    if (relWeight !== null && relWeight !== undefined && relWeight > 0) {
      // via de werkelijke belasting rekenen: een tweezijdige dumbbell-oefening
      // telt intern dubbel, zodat de verhouding klopt zodra de keten van
      // dumbbells naar ander materiaal loopt (of andersom). Blijft de keten
      // binnen dezelfde soort, dan valt de factor tegen elkaar weg.
      const relTotal = totalLoadKg(next, relWeight)
      const weight = toAvailable(ex, (relTotal * ratio * scale) / loadFactor(ex))
      if (weight !== null && weight > 0) return { weight, source: 'related', relatedName: next.naam }
    }
    current = next
  }

  const bw = state.settings?.bodyweightKg
  if (!bw || bw <= 0 || ex.startFactor <= 0) return null
  const weight = toAvailable(ex, bw * ex.startFactor * scale)
  if (weight === null || weight <= 0) return null
  return { weight, source: 'bodyweight' }
}
