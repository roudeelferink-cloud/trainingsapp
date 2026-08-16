import type { Exercise, Settings } from '../types'
import { isBandExercise } from './band'
import { barWeightFor } from './barWeight'
import { DUMBBELL_WEIGHTS, isDumbbell } from './dumbbell'

/**
 * Afronden op wat er daadwerkelijk te laden is.
 *
 * Een voorstel van 101,25 kg is waardeloos als de lichtste schijf 2,5 kg weegt: dan
 * bestaat dat gewicht niet. Deze module rekent elk voorstel om naar het dichtstbijzijnde
 * gewicht dat er echt op kan.
 *
 * Drie soorten belasting, drie roosters:
 * 1. **schijven** — stanggewicht (of 0 bij een leg press) plus schijven, en die gaan
 *    per paar op. De kleinste stap is dus twee keer de lichtste schijf die er ligt.
 * 2. **dumbbells** — wat er in het rek staat, niets ertussenin.
 * 3. **de rest** — machines met een pin: daar is `minIncrement` van de oefening de stap.
 *
 * Er wordt altijd naar beneden afgerond. Naar boven zou de sprong groter maken dan
 * bedoeld, en dat is precies wat deze laag moet voorkomen.
 */

/** Wat er standaard aan schijven ligt, in kg per schijf. */
export const DEFAULT_PLATES: number[] = [1.25, 2.5, 5, 10, 15, 20, 25]

/** Schijven die in de instellingen aan of uit gezet kunnen worden. */
export const PLATE_OPTIONS: number[] = [0.5, 1.25, 2.5, 5, 10, 15, 20, 25]

export function platesOf(settings: Settings | undefined): number[] {
  const raw = settings?.plates
  const clean = (Array.isArray(raw) ? raw : [])
    .filter((kg) => typeof kg === 'number' && Number.isFinite(kg) && kg > 0)
    .sort((a, b) => a - b)
  return clean.length > 0 ? clean : DEFAULT_PLATES
}

/** De lichtste schijf die er ligt. */
export function smallestPlate(settings: Settings | undefined): number {
  return platesOf(settings)[0]
}

/** Gaat deze oefening met losse schijven? Ook zonder stang, zoals de leg press. */
export function usesPlates(ex: Exercise): boolean {
  return ex.equipment.includes('plates')
}

/**
 * De kleinste stap die bij deze oefening echt te maken is. Bandwerk heeft geen kilo's
 * en levert 0 op; dat gaat per niveau.
 */
export function loadStep(ex: Exercise, settings?: Settings): number {
  if (isBandExercise(ex)) return 0
  if (usesPlates(ex)) return round(2 * smallestPlate(settings))
  if (isDumbbell(ex)) return round(DUMBBELL_WEIGHTS[1] - DUMBBELL_WEIGHTS[0])
  return ex.minIncrement || 0.5
}

/**
 * Het zwaarste laadbare gewicht dat niet boven `weight` uitkomt.
 *
 * Bij schijven is de kale stang (of, zonder stang, 0) de ondergrens: lichter dan dat
 * bestaat niet. Bij dumbbells wordt het de zwaarste dumbbell die past, en ligt het
 * voorstel onder de lichtste, dan is de lichtste het antwoord — die ligt er tenslotte.
 */
export function roundToLoadable(weight: number, ex: Exercise, settings?: Settings): number {
  if (isBandExercise(ex)) return 0
  if (weight <= 0) return 0

  if (usesPlates(ex)) {
    const bar = barWeightFor(ex, settings)
    const step = loadStep(ex, settings)
    if (weight <= bar) return bar
    const steps = Math.floor(round((weight - bar) / step) + 1e-9)
    return round(bar + steps * step)
  }

  if (isDumbbell(ex)) {
    let out = DUMBBELL_WEIGHTS[0]
    for (const kg of DUMBBELL_WEIGHTS) if (kg <= weight + 1e-9) out = kg
    return out
  }

  const step = loadStep(ex, settings)
  return round(Math.floor(round(weight / step) + 1e-9) * step)
}

/**
 * Het eerstvolgende gewicht boven `weight` dat te laden is. Dit is de kleinste
 * verhoging die er bestaat — hij kan groter zijn dan de gewenste stap, bijvoorbeeld
 * als het dumbbellrek van 5 naar 12,5 springt of als de lichtste schijf 5 kg weegt.
 */
export function nextLoadable(weight: number, ex: Exercise, settings?: Settings): number | null {
  if (isBandExercise(ex)) return null

  if (isDumbbell(ex) && !usesPlates(ex)) {
    const next = DUMBBELL_WEIGHTS.find((kg) => kg > weight + 1e-9)
    return next ?? null
  }

  const step = loadStep(ex, settings)
  if (step <= 0) return null
  const down = roundToLoadable(weight, ex, settings)
  return round(down + step)
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
