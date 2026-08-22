import type { RunKind } from '../types'

/**
 * De kale rekenkunde van het loopschema: hoeveel kilometer een week ongeremd zou
 * vragen, en hoe die kilometers over de drie loopdagen verdeeld worden.
 *
 * Alles hier is een pure functie van het weeknummer. Wat er daadwerkelijk gelopen is,
 * de +10%-bewaking, de deload en de beoordelingen zitten in `runningLoad.ts` — die leest
 * de staat van de gebruiker en gebruikt dit als vertrekpunt.
 */

/** Startvolume: 6 + 6 + 10 km. */
export const BASE_WEEK_KM = 22

/** Uitgangspunt van de week: twee korte lopen van 6 en een duurloop van 10 km. */
export const BASE_SHORT_KM = 6
export const BASE_LONG_KM = 10

/**
 * De duurloop heeft een eigen opbouwlijn, los van het weekplafond.
 *
 * Waarom apart: de duurloop is het werk waar de opbouw om draait, en hij hoort niet mee
 * te krimpen omdat er een korte loop uitviel. Hij begint op 10 km, groeit met een halve
 * kilometer per opbouwweek, en houdt op bij 15 km. Boven de 15 km is er geen opbouw
 * meer — dan is het onderhoud, en dat is een bewuste grens: verder bouwen op deze
 * frequentie is meer blessure dan winst.
 */
export const LONG_BASE_KM = 10
export const LONG_MAX_KM = 15
export const LONG_STEP_KM = 0.5

/** De duurloop houdt zijn aandeel in de week; de rest gaat naar de twee korte lopen. */
export const LONG_SHARE = BASE_LONG_KM / BASE_WEEK_KM

/** Bandbreedte van een korte loop: dinsdag en donderdag zijn 5 tot 8 km. */
export const SHORT_MIN_KM = 5
export const SHORT_MAX_KM = 8

/** Opbouw per week zolang de bewaking niets zegt. */
export const WEEKLY_GROWTH = 1.05

/** Elke achtste trainingsweek is een deloadweek; die telt niet mee in de opbouw. */
export const DELOAD_EVERY_WEEKS = 8

export function round05(n: number): number {
  return Math.round(n * 2) / 2
}

/** Naar beneden op halve kilometers: een bovengrens mag door afronding niet sneuvelen. */
export function floor05(n: number): number {
  return Math.floor(n * 2 + 1e-9) / 2
}

/**
 * Ongeremd geplande weekafstand: 22 km in week 1, daarna 5% per opbouwweek erbij.
 *
 * Deloadweken tellen niet mee in de opbouw, dus na een deload pak je de draad op waar
 * je hem liet liggen in plaats van een week te verliezen. De korting van de deloadweek
 * zelf zit hier niet in; die hoort bij de deload en staat in `runningLoad.ts`.
 */
export function rawWeekKm(week: number): number {
  const w = Math.max(1, Math.floor(week))
  const builds = w - 1 - Math.floor((w - 1) / DELOAD_EVERY_WEEKS)
  return BASE_WEEK_KM * Math.pow(WEEKLY_GROWTH, builds)
}

/**
 * De opbouwlijn van de duurloop: 10 km in week 1, een halve kilometer per opbouwweek
 * erbij, met een hard maximum van 15 km. Deloadweken tellen niet mee in de opbouw,
 * net als bij het weekvolume.
 */
export function longRunLineKm(week: number): number {
  const w = Math.max(1, Math.floor(week))
  const builds = w - 1 - Math.floor((w - 1) / DELOAD_EVERY_WEEKS)
  return Math.min(LONG_MAX_KM, round05(LONG_BASE_KM + builds * LONG_STEP_KM))
}

/** Zit deze afstand op of boven het maximum, zodat er alleen onderhoud overblijft? */
export function atLongCeiling(km: number): boolean {
  return km >= LONG_MAX_KM - 1e-9
}

export interface WeekSplit {
  short: number
  long: number
}

/**
 * De week over kort / kort / lang.
 *
 * De duurloop krijgt zijn aandeel als eerste en houdt wat er overblijft: hij is de
 * lange loop van de week en moet dat blijven. De korte lopen krijgen de rest, netjes
 * binnen hun bandbreedte van 5 tot 8 km.
 *
 * Die volgorde is het hele punt. Andersom — korte lopen eerst op hun ondergrens van 5
 * km zetten en de duurloop de rest geven — kon in een teruggeschaalde week een zondag
 * van 6 km opleveren terwijl er dinsdag en donderdag 5 km stond. Bij weinig ruimte
 * krimpen de korte lopen daarom mee onder hun ondergrens; de duurloop blijft de langste.
 */
export function splitWeek(weekKm: number): WeekSplit {
  const km = Math.max(0, weekKm)
  // overal naar beneden afronden: samen mogen de drie lopen nooit meer worden dan de
  // weekafstand, want dan zou de afronding het weekplafond alsnog overschrijden
  const share = floor05(km * LONG_SHARE)
  let short = floor05((km - share) / 2)

  if (short > SHORT_MAX_KM) short = SHORT_MAX_KM
  short = Math.max(0, short)

  return { short, long: Math.max(share, floor05(km - 2 * short)) }
}

/** De geplande afstand van één loop uit een weektotaal. */
export function runKmFor(weekKm: number, kind: RunKind): number {
  const split = splitWeek(weekKm)
  return kind === 'long' ? split.long : split.short
}

/**
 * De week met een vaste duurloop: die komt uit zijn eigen lijn, de korte lopen krijgen
 * wat er van de week overblijft.
 *
 * De korte lopen blijven tussen hun ondergrens en 8 km. Past dat samen niet meer binnen
 * het weekplafond, dan wint de loop van het plafond: het plafond is een richtlijn met een
 * uitlegregel eronder, geen blokkade. `minShort` schaalt mee met een deloadweek, want daar
 * hoort de week wél echt lager uit te komen.
 */
export function splitWeekAround(weekKm: number, longKm: number, minShort = SHORT_MIN_KM): WeekSplit {
  const long = Math.max(0, round05(longKm))
  const over = Math.max(0, weekKm - long)
  const ruimte = floor05(over / 2)
  const short = Math.min(SHORT_MAX_KM, Math.max(round05(minShort), ruimte))
  return { short, long }
}

/** Check-in 1-2: 30% korter, of fietsen. */
export function scaledRunKm(km: number, checkin: number | undefined): number {
  if (checkin !== undefined && checkin <= 2) return round05(km * 0.7)
  return km
}

export const BIKE_MINUTES = 30
