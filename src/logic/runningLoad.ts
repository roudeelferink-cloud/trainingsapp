import type { DayCheck, RunKind, UserState } from '../types'
import { activityKm } from './activities'
import { cycleInfo } from './cycle'
import { addDays, mondayOf } from './dates'
import { DELOAD_RUN_FACTOR, DELOAD_RUN_PCT, deloadFor } from './deload'
import { MIN_CHECKS_PER_WEEK, dayChecksInWeek, heavyCountBefore, isPoorDay, logFeel } from './feel'
import {
  LONG_MAX_KM,
  SHORT_MIN_KM,
  atLongCeiling,
  floor05,
  longRunLineKm,
  rawWeekKm,
  round05,
  splitWeekAround,
} from './running'
import { scheduledRun } from './schedule'

/**
 * Hardloopvolume: waar de app op uitkomt, en waarom.
 *
 * De regels, op volgorde van hoe ze ingrijpen:
 * 1. **Weekplafond** — een richtlijn boven het rollend gemiddelde van de laatste vier
 *    weken wérkelijk gelopen kilometers. De stap erbovenop beweegt mee met de check-ins:
 *    bij structureel goede signalen tot +15%, bij slechte signalen geen opbouw. Weken
 *    zonder enige gelogde loop tellen niet mee in dat gemiddelde — een week zonder
 *    telefoon bij de hand is geen week van nul kilometer.
 * 2. **Duurloop apart** — de duurloop volgt zijn eigen opbouwlijn (10 km, +0,5 km per
 *    opbouwweek, hard maximum 15 km) en zit niet onder het weekplafond. De korte lopen
 *    krijgen wat er van de week overblijft.
 * 3. **Deload** — in een deloadweek gaat er 30% van het weekvolume af, duurloop
 *    inbegrepen. Die staat los van de rest en verandert niet mee.
 * 4. **Beoordeling** — een als 'zwaar' beoordeelde loop haalt de rest van de week 10%
 *    omlaag.
 * 5. **Handmatig** — een zelf ingevulde afstand wint van alles hierboven, zonder
 *    aftoppen en zonder drempel. Eronder staat één feitelijke regel met de context:
 *    hoe deze afstand zich verhoudt tot je gemiddelde en tot je langste loop.
 *
 * Wat hier bewust *niet* meer gebeurt: de geplande afstand aftoppen. Dat werkte
 * averechts. Minder lopen verlaagde het gemiddelde, het lagere gemiddelde verlaagde het
 * plafond, en dat plafond verlaagde de voorgeschreven afstand weer — een spiraal die
 * eindigde met 5,5 km op zondag terwijl er al maanden 10 km gelopen werd. De app rekent
 * nog steeds door en zegt nog steeds wat ze ziet; ze houdt niemand meer tegen.
 */

/** Het venster waarover teruggekeken wordt: vier weken werkelijk gelopen kilometers. */
export const REFERENCE_WEEKS = 4

/**
 * De stap boven het gemiddelde, afhankelijk van wat de check-ins zeggen.
 *
 * - `HOLD` — geen opbouw. Bij slechte signalen, en bij de rem hieronder.
 * - `STEADY` — de gewone stap, als er niets bijzonders te melden is.
 * - `STRONG` — alleen bij structureel goede signalen: genoeg ingevulde dagchecks, geen
 *   slechte dag, frisse benen en geen enkele zware sessie in twee weken.
 */
export const GROWTH_HOLD = 1.0
export const GROWTH_STEADY = 1.1
export const GROWTH_STRONG = 1.15

/** De hoogste stap die er ooit in zit. Boven dit percentage bouwt de app nooit op. */
export const MAX_WEEKLY_GROWTH = GROWTH_STRONG

/**
 * De rem op stijgen: na dit aantal weken meer kilometers op rij houdt de app de week
 * gelijk. Die rem is blokkerend en niet weg te klikken — hij heeft geen `dismissKey` en
 * krijgt er ook geen. Drie weken doorstijgen is precies het patroon dat pezen sloopt, en
 * een consolidatieweek is goedkoper dan de blessure erna.
 */
export const MAX_RISES_IN_A_ROW = 3

/** Een zware loop haalt de rest van de week 10% omlaag. */
export const HEAVY_RUN_FACTOR = 0.9

/** Benen-check-in: hieronder is het geen frisse week meer. */
const FRESH_LEGS = 4
const LOW_LEGS = 2
/** Slaap plus energie: 5 of hoger is twee keer minstens 'oké' met één keer 'goed'. */
const GOOD_DAY_SCORE = 5

export interface WeekLoad {
  weekStart: string
  week: number
  /** ongeremd geplande weekafstand */
  raw: number
  /** referentie: rollend gemiddelde van de laatste vier weken werkelijk gelopen km */
  reference: number
  /** aantal weken met gelogde kilometers waar die referentie op rust */
  referenceWeeks: number
  /** bovengrens: referentie plus de stap die bij de signalen hoort */
  cap: number
  /** de stap die deze week gebruikt is */
  growth: WeeklyGrowth
  /** wat de app deze week aanhoudt */
  km: number
  /** al gelopen deze week, losse hardloopactiviteiten meegerekend */
  done: number
  capped: boolean
  deload: boolean
  /** al gelopen boven het weekplafond */
  overCap: boolean
  /** één regel per bijsturing aan de week zelf: plafond en deload */
  reasons: string[]
  /** uitleg bij een overschreden weekplafond; null als er niets aan de hand is */
  overCapReason: string | null
}

/**
 * Werkelijk gelopen kilometers in de week van `iso`.
 *
 * Losse hardloopactiviteiten tellen mee: een rondje dat niet in het schema stond is
 * net zo goed belasting voor je pezen. Fietsen telt niet mee, ook niet als het een
 * geplande loop verving.
 */
export function actualWeekKm(state: UserState, iso: string): number {
  const mon = mondayOf(iso)
  const days = new Set(Array.from({ length: 7 }, (_, i) => addDays(mon, i)))
  let total = 0

  for (const day of days) {
    const run = state.runs?.[day]
    if (run?.completedAt && !run.bike) total += run.km
  }
  for (const activity of state.activities ?? []) {
    if (activity.type !== 'hardlopen' || !days.has(activity.date)) continue
    total += activityKm(activity) ?? 0
  }

  return round(total)
}

/** Heeft deze week een afgeronde loop? Zonder loop zegt 0 km niets over de belasting. */
function hasRunData(state: UserState, iso: string): boolean {
  const mon = mondayOf(iso)
  for (let i = 0; i < 7; i++) {
    const run = state.runs?.[addDays(mon, i)]
    if (run?.completedAt && !run.bike && run.km > 0) return true
  }
  return (state.activities ?? []).some(
    (a) => a.type === 'hardlopen' && (activityKm(a) ?? 0) > 0 && withinWeek(a.date, mon),
  )
}

function withinWeek(iso: string, monday: string): boolean {
  return iso >= monday && iso <= addDays(monday, 6)
}

/**
 * Waar een week mee vergeleken wordt: wat er gelopen is, of — als er die week niets
 * gelogd staat — wat er gepland stond. Een lege week is meestal een week zonder
 * telefoon bij de hand, geen week van nul kilometer; dat mag het schema niet slopen.
 */
export function weekReference(state: UserState, monday: string): number {
  if (hasRunData(state, monday)) return actualWeekKm(state, monday)
  return round(rawWeekKm(cycleInfo(state.startDate, monday).week))
}

export interface RollingReference {
  /** gemiddelde over de weken die iets te zeggen hadden */
  km: number
  /** hoeveel weken dat er waren */
  weeks: number
}

/**
 * Het rollend gemiddelde over vier weken, uitsluitend op wérkelijk gelopen kilometers.
 *
 * Weken zonder enige gelogde loop tellen niet mee in plaats van als nul: anders trekt
 * één vakantieweek het gemiddelde omlaag, en daarmee het plafond, en daarmee de
 * voorgeschreven afstand — precies de spiraal die deze module niet meer heeft. Is er
 * helemaal niets gelogd, dan valt de referentie terug op het plan van vorige week.
 */
export function rollingReference(state: UserState, iso: string, weeks = REFERENCE_WEEKS): RollingReference {
  const monday = mondayOf(iso)
  const gelopen: number[] = []
  for (let w = 1; w <= weeks; w++) {
    const week = addDays(monday, -7 * w)
    if (hasRunData(state, week)) gelopen.push(actualWeekKm(state, week))
  }
  if (gelopen.length === 0) return { km: weekReference(state, addDays(monday, -7)), weeks: 0 }
  return { km: round(gelopen.reduce((a, b) => a + b, 0) / gelopen.length), weeks: gelopen.length }
}

/* -------------------------------------------------------------------------
 * Het meebewegende weekplafond
 * ---------------------------------------------------------------------- */

export type GrowthTone = 'behoudend' | 'normaal' | 'ruim'

export interface WeeklyGrowth {
  /** vermenigvuldiger op de referentie */
  factor: number
  tone: GrowthTone
  /**
   * Deze stap is een rem die vaststaat. Blokkerend betekent hier: hij hoort niet met
   * een knop weg te klikken te zijn, en er komt dus ook geen `dismissKey` bij.
   */
  blocking: boolean
  reason: string
}

/** De benen-check-ins van één week, alleen de dagen die ingevuld zijn. */
function legChecksInWeek(state: UserState, monday: string): number[] {
  const out: number[] = []
  for (let i = 0; i < 7; i++) {
    const v = state.checkins?.[addDays(monday, i)]
    if (typeof v === 'number') out.push(v)
  }
  return out
}

function goodDay(check: DayCheck): boolean {
  return check.sleep + check.energy >= GOOD_DAY_SCORE
}

/**
 * Hoeveel weken op rij er meer gelopen is dan de week ervoor, direct vóór `monday`.
 * Alleen weken met gelogde kilometers tellen mee; een gat breekt de reeks niet af maar
 * telt ook niet als stijging.
 */
export function risesInARow(state: UserState, iso: string, lookback = 6): number {
  const monday = mondayOf(iso)
  const weken: number[] = []
  for (let w = 1; w <= lookback + 1; w++) {
    const week = addDays(monday, -7 * w)
    weken.push(hasRunData(state, week) ? actualWeekKm(state, week) : Number.NaN)
  }

  let n = 0
  for (let i = 0; i < weken.length - 1; i++) {
    const deze = weken[i]
    const vorige = weken[i + 1]
    if (Number.isNaN(deze) || Number.isNaN(vorige)) break
    if (deze > vorige + 0.01) n++
    else break
  }
  return n
}

/**
 * De stap boven het gemiddelde, uit de check-ins van de twee voorgaande weken.
 *
 * De volgorde is de bedoeling: de rem op doorstijgen komt eerst en is niet weg te
 * klikken, daarna de slechte signalen, dan pas de ruimte. Zo kan een goede week nooit
 * over de rem heen.
 */
export function weeklyGrowth(state: UserState, iso: string): WeeklyGrowth {
  const monday = mondayOf(iso)
  const stijgingen = risesInARow(state, monday)

  if (stijgingen >= MAX_RISES_IN_A_ROW) {
    return {
      factor: GROWTH_HOLD,
      tone: 'behoudend',
      blocking: true,
      reason:
        `${stijgingen} weken op rij meer kilometers — deze week houdt de app het volume gelijk. ` +
        'Die rem staat vast en is niet weg te klikken.',
    }
  }

  const vorige = addDays(monday, -7)
  const eerder = addDays(monday, -14)
  const checks = [...dayChecksInWeek(state, vorige), ...dayChecksInWeek(state, eerder)]
  const benen = [...legChecksInWeek(state, vorige), ...legChecksInWeek(state, eerder)]
  const zwaar = heavyCountBefore(state, monday, 14)

  const slecht =
    checks.some(isPoorDay) || benen.some((b) => b <= LOW_LEGS) || zwaar >= 2
  if (slecht) {
    return {
      factor: GROWTH_HOLD,
      tone: 'behoudend',
      blocking: false,
      reason: `Signalen van de laatste twee weken staan op rood (${signalen(checks.filter(isPoorDay).length, benen.filter((b) => b <= LOW_LEGS).length, zwaar)}) — deze week geen opbouw.`,
    }
  }

  const genoegChecks =
    dayChecksInWeek(state, vorige).length >= MIN_CHECKS_PER_WEEK &&
    dayChecksInWeek(state, eerder).length >= MIN_CHECKS_PER_WEEK
  const sterk =
    genoegChecks &&
    checks.every(goodDay) &&
    benen.length > 0 &&
    benen.every((b) => b >= FRESH_LEGS) &&
    zwaar === 0
  if (sterk) {
    return {
      factor: GROWTH_STRONG,
      tone: 'ruim',
      blocking: false,
      reason: `Twee weken goed geslapen, energie op peil en frisse benen — ruimte voor ${pct(GROWTH_STRONG)} deze week.`,
    }
  }

  return {
    factor: GROWTH_STEADY,
    tone: 'normaal',
    blocking: false,
    reason: `Gewone opbouwstap van ${pct(GROWTH_STEADY)}.`,
  }
}

function signalen(slechteDagen: number, brakkeBenen: number, zwaar: number): string {
  const delen = [
    slechteDagen > 0 ? `${slechteDagen}× slecht geslapen of weinig energie` : null,
    brakkeBenen > 0 ? `${brakkeBenen}× brakke benen` : null,
    zwaar > 0 ? `${zwaar} zware sessies` : null,
  ].filter(Boolean) as string[]
  return delen.join(', ')
}

function pct(factor: number): string {
  return `+${Math.round((factor - 1) * 100)}%`
}

/* -------------------------------------------------------------------------
 * De week
 * ---------------------------------------------------------------------- */

/** Het weekplafond en wat de app deze week aanhoudt. */
export function weekLoad(state: UserState, iso: string): WeekLoad {
  const weekStart = mondayOf(iso)
  const week = cycleInfo(state.startDate, weekStart).week
  const raw = round(rawWeekKm(week))
  const done = actualWeekKm(state, weekStart)
  const deload = deloadFor(state, weekStart).active
  const reasons: string[] = []

  const ref = rollingReference(state, weekStart)
  const growth = weeklyGrowth(state, weekStart)
  const reference = ref.km
  const cap = round(reference * growth.factor)

  // in de eerste week is er niets om mee te vergelijken
  let km = round05(raw)
  let capped = false
  if (week > 1 && raw > cap) {
    km = floor05(cap)
    capped = true
    reasons.push(
      `${weken(ref)} gemiddeld ${fmt(reference)} km gelopen — richtlijn voor deze week ${fmt(km)} km (${pct(growth.factor)}).`,
    )
  }
  if (week > 1 && growth.blocking) reasons.push(growth.reason)

  if (deload) {
    km = round05(km * DELOAD_RUN_FACTOR)
    reasons.push(`Deloadweek: ${DELOAD_RUN_PCT}% minder kilometers, ${fmt(km)} km in plaats van ${fmt(capped ? floor05(cap) : round05(raw))}.`)
  }

  const overCap = done > km + 1e-9
  const overCapReason = overCap
    ? `Deze week al ${fmt(done)} km gelopen, tegen een richtlijn van ${fmt(km)} km.`
    : null

  return {
    weekStart,
    week,
    raw,
    reference,
    referenceWeeks: ref.weeks,
    cap,
    growth,
    km,
    done,
    capped,
    deload,
    overCap,
    reasons,
    overCapReason,
  }
}

function weken(ref: RollingReference): string {
  if (ref.weeks === 0) return 'Nog geen gelopen weken, dus op het plan:'
  if (ref.weeks === 1) return 'Vorige week'
  return `Laatste ${ref.weeks} weken`
}

/* -------------------------------------------------------------------------
 * De duurloop: een eigen lijn
 * ---------------------------------------------------------------------- */

export interface LongRunTarget {
  km: number
  /** de opbouwlijn zelf, zonder onderhoud erbij */
  line: number
  /** boven het maximum: geen opbouw meer, alleen vasthouden wat er is */
  maintenance: boolean
  reason: string
}

/**
 * De duurloop van deze week.
 *
 * De lijn loopt van 10 naar 15 km en stopt daar. Loop je al verder dan 15 km — je eigen
 * keuze, de app remt daar niet op — dan volgt het voorstel die afstand als onderhoud in
 * plaats van hem terug te trekken naar de lijn. Wat de app níét doet, is boven de 15 km
 * verder opbouwen.
 */
export function longRunTarget(state: UserState, iso: string): LongRunTarget {
  const monday = mondayOf(iso)
  const week = cycleInfo(state.startDate, monday).week
  const line = longRunLineKm(week)
  const langste = longestRunKm(state, monday)
  const deload = deloadFor(state, monday).active

  let km = line
  let maintenance = false
  let reason = `Duurloop volgt zijn eigen opbouw: ${fmt(line)} km deze week, basis ${fmt(longRunLineKm(1))} en maximaal ${fmt(LONG_MAX_KM)} km.`

  if (langste > LONG_MAX_KM + 1e-9) {
    km = round05(langste)
    maintenance = true
    reason = `Je langste loop van de laatste vier weken was ${fmt(langste)} km, boven het maximum van ${fmt(LONG_MAX_KM)} km — geen verdere opbouw, dit is onderhoud.`
  } else if (atLongCeiling(line)) {
    maintenance = true
    reason = `Duurloop staat op het maximum van ${fmt(LONG_MAX_KM)} km — vanaf hier onderhoud, geen opbouw meer.`
  }

  if (deload) {
    const voor = km
    km = round05(km * DELOAD_RUN_FACTOR)
    reason = `Deloadweek: duurloop van ${fmt(voor)} naar ${fmt(km)} km.`
  }

  return { km, line, maintenance, reason }
}

/**
 * De langste enkele loop in de laatste vier weken, losse rondjes meegerekend. 0 als er
 * niets gelogd staat.
 */
export function longestRunKm(state: UserState, iso: string, weeks = REFERENCE_WEEKS): number {
  const monday = mondayOf(iso)
  const vanaf = addDays(monday, -7 * weeks)
  const tot = addDays(monday, 6)
  let best = 0

  for (const run of Object.values(state.runs ?? {})) {
    if (!run.completedAt || run.bike) continue
    if (run.date < vanaf || run.date > tot) continue
    best = Math.max(best, run.km)
  }
  for (const a of state.activities ?? []) {
    if (a.type !== 'hardlopen' || a.date < vanaf || a.date > tot) continue
    best = Math.max(best, activityKm(a) ?? 0)
  }
  return round(best)
}

/**
 * Het gemiddelde van de vergelijkbare lopen uit de laatste vier weken: duurlopen naast
 * duurlopen, korte lopen naast korte lopen. Null zolang er niets te vergelijken is.
 */
export function averageRunKm(
  state: UserState,
  iso: string,
  kind: RunKind,
  weeks = REFERENCE_WEEKS,
): number | null {
  const monday = mondayOf(iso)
  const vanaf = addDays(monday, -7 * weeks)
  const afstanden: number[] = []

  for (const run of Object.values(state.runs ?? {})) {
    if (!run.completedAt || run.bike || run.kind !== kind) continue
    if (run.date < vanaf || run.date > addDays(monday, 6)) continue
    if (run.km > 0) afstanden.push(run.km)
  }
  if (afstanden.length === 0) return null
  return round(afstanden.reduce((a, b) => a + b, 0) / afstanden.length)
}

/**
 * De feitelijke context onder een afstand: één regel, geen oordeel.
 *
 * Dit is wat er in de plaats komt van het aftoppen. De app zegt wat ze ziet — hoe deze
 * afstand zich verhoudt tot je gemiddelde loop van deze soort en tot je langste loop —
 * en laat de keuze bij jou.
 */
export function runContext(state: UserState, iso: string, kind: RunKind, km: number): string {
  const soort = kind === 'long' ? 'duurloop' : 'korte loop'
  const gemiddelde = averageRunKm(state, iso, kind)
  const langste = longestRunKm(state, iso)

  if (gemiddelde === null || gemiddelde <= 0) {
    return `${fmt(km)} km. Nog geen ${soort === 'duurloop' ? 'duurlopen' : 'korte lopen'} in de laatste vier weken om mee te vergelijken.`
  }

  const verschil = Math.round(((km - gemiddelde) / gemiddelde) * 100)
  const teken = verschil > 0 ? `+${verschil}%` : verschil < 0 ? `${verschil}%` : 'gelijk'
  const staart = langste > 0 ? `; je langste loop was ${fmt(langste)} km` : ''
  return `${fmt(km)} km is ${teken} t.o.v. je gemiddelde ${soort} van de laatste vier weken (${fmt(gemiddelde)} km)${staart}.`
}

/* -------------------------------------------------------------------------
 * De loop van vandaag
 * ---------------------------------------------------------------------- */

export interface RunTarget {
  /** de afstand die de app voorstelt */
  km: number
  /** wat het zonder bijsturing geweest was */
  base: number
  /** handmatig gezet door de gebruiker */
  manual: boolean
  capped: boolean
  /** één regel per bijsturing, in de volgorde waarin ze ingrijpen */
  reasons: string[]
  /** de feitelijke context bij deze afstand; altijd gevuld */
  context: string
}

/**
 * De geplande afstand van de loop op `iso`.
 *
 * Een handmatig gezette afstand wint meteen: dat is een keuze van de gebruiker, geen
 * voorstel van de app, en er gaat niets meer overheen. De duurloop komt uit zijn eigen
 * lijn; de korte lopen delen wat er van het weekplafond overblijft.
 */
export function plannedRunKm(state: UserState, iso: string, kind: RunKind): RunTarget {
  const manual = state.runPlans?.[iso]
  if (typeof manual === 'number' && Number.isFinite(manual) && manual > 0) {
    const km = round05(manual)
    return {
      km,
      base: km,
      manual: true,
      capped: false,
      reasons: [`Zelf ingesteld op ${fmt(km)} km.`],
      context: runContext(state, iso, kind, km),
    }
  }

  const load = weekLoad(state, iso)
  const lang = longRunTarget(state, iso)
  const minShort = load.deload ? round05(SHORT_MIN_KM * DELOAD_RUN_FACTOR) : SHORT_MIN_KM
  const split = splitWeekAround(load.km, lang.km, minShort)
  const base = kind === 'long' ? split.long : split.short
  let km = base
  const reasons = kind === 'long' ? [lang.reason] : [...load.reasons]

  // Wat er deze week nog komt: samen mag dat niet meer zijn dan wat er van het weekplafond
  // over is. Bewust vanaf maandag geteld en niet vanaf vandaag — anders kijkt elke loop
  // alleen naar de lopen ná zichzelf, en dan past elke dag apart binnen het plafond
  // terwijl de week als geheel er ruim overheen gaat. De duurloop doet hier niet aan mee:
  // die heeft zijn eigen lijn en hoort niet te krimpen omdat er een korte loop bijkwam.
  if (kind !== 'long') {
    const remaining = remainingRuns(state, mondayOf(iso)).filter((r) => r.kind !== 'long')
    const plannedSum = remaining.length * split.short
    const left = Math.max(0, round(load.km - lang.km - load.done))
    if (plannedSum > left + 1e-9 && plannedSum > 0) {
      // niet door de ondergrens heen: een korte loop van 1 km is geen bijsturing maar
      // een sessie die z'n eigen doel kwijt is. Past het niet, dan zegt de weekregel dat.
      const geschaald = Math.max(minShort, floor05(km * (left / plannedSum)))
      if (geschaald < km) {
        km = geschaald
        reasons.push(
          `Deze week al ${fmt(load.done)} km gelopen van de ${fmt(load.km)} — resterende korte lopen teruggeschaald naar ${fmt(km)} km.`,
        )
      }
    }
  }

  if (hadHeavyRun(state, iso)) {
    const before = km
    km = floor05(km * HEAVY_RUN_FACTOR)
    reasons.push(`Vorige loop viel zwaar — ${fmt(before)} km wordt ${fmt(km)} km voor de rest van de week.`)
  }

  return { km, base, manual: false, capped: load.capped, reasons, context: runContext(state, iso, kind, km) }
}

export interface WeekProjection {
  /** wat de week wordt: gelopen plus wat er nog staat, zonder terugschalen */
  planned: number
  /** het plafond van die week */
  cap: number
  over: boolean
  /** aantal lopen dat er deze week nog staat */
  remaining: number
}

/**
 * Waar de week op uitkomt als alles doorgaat zoals gepland: de kilometers die er al in
 * zitten plus de basisafstand van elke loop die er nog staat, zonder de bijsturing die de
 * app zelf zou toepassen. Zo is te zien of een week overvol raakt — bijvoorbeeld doordat
 * er een vierde loop bij komt — in plaats van alleen te zien dat alles korter wordt.
 */
export function weekProjection(state: UserState, iso: string): WeekProjection {
  const load = weekLoad(state, iso)
  const lang = longRunTarget(state, iso)
  const minShort = load.deload ? round05(SHORT_MIN_KM * DELOAD_RUN_FACTOR) : SHORT_MIN_KM
  const split = splitWeekAround(load.km, lang.km, minShort)
  const remaining = remainingRuns(state, mondayOf(iso))
  const planned = round(
    load.done + remaining.reduce((sum, r) => sum + (r.kind === 'long' ? split.long : split.short), 0),
  )
  return { planned, cap: load.km, over: planned > load.km + 1e-9, remaining: remaining.length }
}

/** De lopen die er deze week nog staan, vanaf `iso`: niet gedaan en niet overgeslagen. */
export function remainingRuns(state: UserState, iso: string): { date: string; kind: RunKind }[] {
  const mon = mondayOf(iso)
  const out: { date: string; kind: RunKind }[] = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(mon, i)
    if (date < iso) continue
    const kind = scheduledRun(state, date).kind
    if (!kind) continue
    if (state.runs?.[date]?.completedAt) continue
    if (state.skips?.[`${date}:run`]) continue
    if (state.overrides?.[date]?.bike) continue
    out.push({ date, kind })
  }
  return out
}

/** Is er deze week al een loop als 'zwaar' beoordeeld, vóór `iso`? */
export function hadHeavyRun(state: UserState, iso: string): boolean {
  const mon = mondayOf(iso)
  for (let i = 0; i < 7; i++) {
    const date = addDays(mon, i)
    if (date >= iso) break
    const run = state.runs?.[date]
    if (run?.completedAt && logFeel(run) === 'zwaar') return true
  }
  return false
}

/**
 * Loopvolume per week voor de grafiek: werkelijk gelopen, met het plafond ernaast.
 * Oudste week eerst.
 */
export interface WeekKm {
  weekStart: string
  week: number
  km: number
  planned: number
  deload: boolean
}

export function weeklyKm(state: UserState, from: string, weeks = 12): WeekKm[] {
  const start = mondayOf(from)
  const out: WeekKm[] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = addDays(start, -7 * w)
    const load = weekLoad(state, weekStart)
    out.push({
      weekStart,
      week: load.week,
      km: load.done,
      planned: load.km,
      deload: load.deload,
    })
  }
  return out
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** Nederlandse notatie, zonder nullen die niets toevoegen. */
export function fmt(km: number): string {
  return String(Math.round(km * 10) / 10).replace('.', ',')
}
