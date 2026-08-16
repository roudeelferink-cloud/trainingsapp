import type { DayKind, Exercise, Pattern, UserState } from '../types'
import { cycleInfo } from './cycle'
import { DELOAD_WEIGHT_FACTOR, deloadFor } from './deload'
import { bestEstimated1RM, stateFor } from './progression'
import { scheduledStrength } from './schedule'
import { resolveSession } from './sessionSlots'

/**
 * Hoe zwaar een sessie op je benen is.
 *
 * De vorige versie van deze regel keek naar de naam van de sessie: "benen A" en "benen B"
 * waren zwaar, de rest niet. Dat klopte voor één programma en voor geen enkel ander — bij
 * een full body met een squat erin zweeg de app, en bij een beensessie die op de deload
 * halve sets draaide waarschuwde hij alsnog.
 *
 * Hier wordt geteld wat er daadwerkelijk gepland staat:
 *
 * 1. **Wat voor werk** — zwaar samengesteld beenwerk (squat, leg press, RDL, lunges,
 *    hip thrust) telt vol mee, beenisolatie (leg curl, leg extension, kuiten, abductie)
 *    licht, bovenlichaam en romp niet.
 * 2. **Hoeveel werksets** er van staan, na alles wat de dag er al af haalt: de korte
 *    versie, een lage check-in en de deloadweek.
 * 3. **Hoe zwaar** — welk deel van je geschatte 1RM er gepland staat. Zonder historie
 *    valt dat terug op een vaste schatting, en werk op lichaamsgewicht of band weegt
 *    lichter omdat daar geen kilo's tegenover staan.
 */

const LEG_PATTERNS = new Set<Pattern>([
  'knee_dominant',
  'hip_dominant',
  'single_leg',
  'calf',
  'abduction',
])

export type LegCategory = 'zwaar' | 'licht' | 'geen'

/** Wat voor beenwerk dit is. Bepaald door het patroon en de plek in de sessie. */
export function legCategory(ex: Exercise): LegCategory {
  if (!LEG_PATTERNS.has(ex.pattern)) return 'geen'
  return ex.orderCategory === 'heavy_legs' ? 'zwaar' : 'licht'
}

/** Wat één werkset van dit soort werk meetelt. */
export const CATEGORY_WEIGHT: Record<LegCategory, number> = {
  zwaar: 1,
  licht: 0.3,
  geen: 0,
}

/** Zonder kilo's valt er geen percentage van je maximum te berekenen. */
export const BODYWEIGHT_INTENSITY = 0.4
/** Wel kilo's, maar nog geen historie om ze mee te vergelijken. */
export const DEFAULT_INTENSITY = 0.7
const MIN_INTENSITY = 0.3

/**
 * Welk deel van je maximum er gepland staat, tussen 0,3 en 1. In een deloadweek gaat de
 * korting er meteen af: daar staat met opzet minder op de stang.
 */
export function intensityFactor(state: UserState, ex: Exercise, deload: boolean): number {
  const deloadFactor = deload ? DELOAD_WEIGHT_FACTOR : 1
  if (ex.unit === 'band' || ex.unit === 'bw') return BODYWEIGHT_INTENSITY * deloadFactor

  const target = stateFor(state, ex.id).targetWeight
  const best = bestEstimated1RM(state, ex.id)
  if (target !== null && target > 0 && best > 0) {
    const share = Math.min(1, Math.max(MIN_INTENSITY, target / best))
    return share * deloadFactor
  }
  return DEFAULT_INTENSITY * deloadFactor
}

/** Drempels voor de waarschuwing. Eén stevige beenoefening haalt `hoog` niet. */
export const LEG_LOAD_HIGH = 3
export const LEG_LOAD_VERY_HIGH = 6

export type LegLoadLevel = 'geen' | 'licht' | 'hoog' | 'zeer_hoog'

export function levelOf(score: number): LegLoadLevel {
  if (score >= LEG_LOAD_VERY_HIGH) return 'zeer_hoog'
  if (score >= LEG_LOAD_HIGH) return 'hoog'
  if (score > 0) return 'licht'
  return 'geen'
}

export const LEVEL_LABEL: Record<LegLoadLevel, string> = {
  geen: 'geen beenwerk',
  licht: 'licht beenwerk',
  hoog: 'zware benen',
  zeer_hoog: 'heel zware benen',
}

export interface LegLoadPart {
  exerciseId: string
  naam: string
  sets: number
  category: LegCategory
  score: number
}

export interface LegLoad {
  date: string
  kind: DayKind | null
  score: number
  level: LegLoadLevel
  /** de oefeningen die de belasting veroorzaken, zwaarste eerst */
  parts: LegLoadPart[]
}

const LEEG: Omit<LegLoad, 'date'> = { kind: null, score: 0, level: 'geen', parts: [] }

/**
 * Dezelfde staat en dezelfde dag geven altijd dezelfde uitkomst, en een `UserState` wordt
 * nooit aangepast maar vervangen. De weekpagina vraagt dit tientallen keren per render —
 * elke dag kijkt naar zijn eigen week én naar de twee weken ervoor — dus onthouden loont.
 */
const cache = new WeakMap<UserState, Map<string, LegLoad>>()

/** De beenbelasting van de krachtsessie op deze dag. */
export function legLoadOn(state: UserState, iso: string): LegLoad {
  const cached = cache.get(state)?.get(iso)
  if (cached) return cached
  const load = computeLegLoad(state, iso)
  const perDay = cache.get(state) ?? new Map<string, LegLoad>()
  perDay.set(iso, load)
  cache.set(state, perDay)
  return load
}

function computeLegLoad(state: UserState, iso: string): LegLoad {
  const kind = scheduledStrength(state, iso).kind
  if (!kind || kind === 'rest') return { date: iso, ...LEEG }
  if (state.skips?.[`${iso}:strength`]) return { date: iso, ...LEEG }

  const cycle = cycleInfo(state.startDate, iso)
  const deload = deloadFor(state, iso).active
  const checkin = state.checkins?.[iso]
  const lowEnergy = checkin !== undefined && checkin <= 2

  // de optionele zaterdagsessie vervalt bij een deload of een lage check-in
  if (kind === 'optional_upper' && (deload || lowEnergy)) return { date: iso, ...LEEG }

  const { slots } = resolveSession(state, iso, kind, {
    short: state.overrides?.[iso]?.short ?? state.sessions?.[`${iso}:${kind}`]?.short ?? false,
    lowEnergy,
    deload,
    rotation: cycle.rotation,
    week: cycle.week,
  })

  const parts: LegLoadPart[] = []
  for (const slot of slots) {
    const category = legCategory(slot.exercise)
    if (category === 'geen') continue
    const score =
      CATEGORY_WEIGHT[category] * slot.sets * intensityFactor(state, slot.exercise, deload)
    parts.push({
      exerciseId: slot.exercise.id,
      naam: slot.exercise.naam,
      sets: slot.sets,
      category,
      score: round(score),
    })
  }

  parts.sort((a, b) => b.score - a.score || a.naam.localeCompare(b.naam))
  const score = round(parts.reduce((sum, p) => sum + p.score, 0))

  return { date: iso, kind, score, level: levelOf(score), parts }
}

/** De oefeningen die het zwaarst wegen, voor in de uitleg. */
export function mainCulprits(load: LegLoad, max = 3): string[] {
  return load.parts
    .filter((p) => p.category === 'zwaar' || p.score >= 1)
    .slice(0, max)
    .map((p) => p.naam)
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
