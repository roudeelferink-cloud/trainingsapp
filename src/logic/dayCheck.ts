import type { DayCheck, Exercise, LegsFeel, LoadArea, PainSpot, UserState } from '../types'

/**
 * De dagcheck: twee vragen, allebei optioneel.
 *
 * 1. **Benen** — fris, normaal of zwaar. Zwaar haalt er een set af en het zware kuitwerk
 *    eruit (wat "benen 1 of 2" deed), en telt mee in de deloadbeslissing.
 * 2. **Pijn of gevoeligheid** — nee, of ja met één tik voor de plek. Dat stuurt niets
 *    automatisch: in het sessiescherm komt er bij de oefeningen die die plek belasten één
 *    feitelijke regel, en de plek staat in de historie en de export.
 *
 * Maximaal twee tikken zonder pijn (benen, nee), drie met (benen, ja, plek).
 */

export const LEGS_OPTIONS: { id: LegsFeel; label: string }[] = [
  { id: 'fris', label: 'Fris' },
  { id: 'normaal', label: 'Normaal' },
  { id: 'zwaar', label: 'Zwaar' },
]

export const PAIN_SPOTS: { id: PainSpot; label: string }[] = [
  { id: 'knie', label: 'Knie' },
  { id: 'rug', label: 'Rug' },
  { id: 'schouder', label: 'Schouder' },
  { id: 'heup', label: 'Heup' },
  { id: 'anders', label: 'Anders' },
]

export function painLabel(spot: PainSpot): string {
  return PAIN_SPOTS.find((p) => p.id === spot)?.label ?? spot
}

/** De dagcheck van deze dag, of undefined als er niets ingevuld is. */
export function dayCheckOn(state: UserState, iso: string): DayCheck | undefined {
  return state.dayChecks?.[iso]
}

/** Benen als zwaar gemeld. Dit is wat vroeger een check-in van 1 of 2 was. */
export function legsHeavy(check: DayCheck | undefined): boolean {
  return check?.legs === 'zwaar'
}

/** De gemelde plek, of null bij "nee" en bij niets ingevuld. */
export function painSpot(check: DayCheck | undefined): PainSpot | null {
  return check?.pain ?? null
}

/**
 * Welke plekken een oefening belast.
 *
 * Er komt hier bewust geen tweede lijstje per oefening bij: elke oefening heeft al zijn
 * `loads` — de gebieden die de gevoeligheidsinstelling gebruikt om een oefening te
 * vervangen. Die tags zeggen precies wat hier nodig is, dus de pijnregel leest dezelfde:
 * een oefening die de knie diep belast, belast de knie.
 */
const AREA_SPOT: Record<LoadArea, PainSpot | null> = {
  knee_deep: 'knie',
  hip_deep: 'heup',
  lateral_hip: 'heup',
  lower_back: 'rug',
  shoulder: 'schouder',
  achilles: null,
  calf: null,
}

export function painSpotsFor(ex: Exercise): PainSpot[] {
  const out = new Set<PainSpot>()
  for (const area of ex.loads) {
    const spot = AREA_SPOT[area]
    if (spot) out.add(spot)
  }
  return [...out]
}

/**
 * De ene regel bij een oefening in het sessiescherm, of null als de gemelde plek er niet
 * door belast wordt. Feitelijk en niet blokkerend: er wordt niets aangepast.
 */
export function painNote(ex: Exercise, check: DayCheck | undefined): string | null {
  const spot = painSpot(check)
  if (!spot || spot === 'anders') return null
  if (!painSpotsFor(ex).includes(spot)) return null
  return `${painLabel(spot).toLowerCase()} gemeld — kies eventueel een lichter gewicht`
}

/** Gemelde pijn, nieuwste eerst: voor de historie. */
export function painReports(state: UserState, limit = 30): { date: string; spot: PainSpot }[] {
  return Object.entries(state.dayChecks ?? {})
    .filter(([, c]) => !!c?.pain)
    .map(([date, c]) => ({ date, spot: c.pain as PainSpot }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}
