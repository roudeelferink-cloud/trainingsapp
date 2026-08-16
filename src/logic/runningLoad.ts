import { programFor } from '../data/programs'
import type { RunKind, UserState } from '../types'
import { activityKm } from './activities'
import { cycleInfo } from './cycle'
import { addDays, mondayOf } from './dates'
import { DELOAD_RUN_FACTOR, DELOAD_RUN_PCT, deloadFor } from './deload'
import { logFeel } from './feel'
import { floor05, rawWeekKm, round05, runKmFor } from './running'
import { scheduledRun } from './schedule'

/**
 * Hardloopvolume met de rem erop.
 *
 * De regels, op volgorde van hoe ze ingrijpen:
 * 1. **Weekplafond** — nooit meer dan 10% boven het gemiddelde van de twee voorgaande
 *    weken. Twee weken, niet één: dan trekt één week met een gemiste loop het schema
 *    niet meteen onderuit.
 * 2. **Deload** — in een deloadweek gaat er 30% van het weekvolume af.
 * 3. **Al gelopen** — wie verder loopt dan gepland eet van het weekplafond. Wat er nog
 *    op de rol staat schuift dan naar beneden, met de reden erbij.
 * 4. **Beoordeling** — een als 'zwaar' beoordeelde loop haalt de rest van de week 10%
 *    omlaag.
 * 5. **Handmatig** — een zelf ingevulde afstand wint van alles hierboven. De app remt
 *    af, ze houdt niemand tegen; de afwijking wordt wel vastgelegd.
 */

export const MAX_WEEKLY_GROWTH = 1.1

/** Een zware loop haalt de rest van de week 10% omlaag. */
export const HEAVY_RUN_FACTOR = 0.9

export interface WeekLoad {
  weekStart: string
  week: number
  /** ongeremd geplande weekafstand */
  raw: number
  /** referentie: gemiddelde van de twee voorgaande weken */
  reference: number
  /** bovengrens: referentie plus 10% */
  cap: number
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

/** Het weekplafond en wat de app deze week aanhoudt. */
export function weekLoad(state: UserState, iso: string): WeekLoad {
  const weekStart = mondayOf(iso)
  const week = cycleInfo(state.startDate, weekStart).week
  const raw = round(rawWeekKm(week))
  const done = actualWeekKm(state, weekStart)
  const deload = deloadFor(state, weekStart).active
  const reasons: string[] = []

  const refs = [weekReference(state, addDays(weekStart, -7)), weekReference(state, addDays(weekStart, -14))]
  const reference = round((refs[0] + refs[1]) / 2)
  const cap = round(reference * MAX_WEEKLY_GROWTH)

  // in de eerste week is er niets om mee te vergelijken
  let km = round05(raw)
  let capped = false
  if (week > 1 && raw > cap) {
    km = floor05(cap)
    capped = true
    reasons.push(
      `Vorige twee weken gemiddeld ${fmt(reference)} km gelopen — deze week afgetopt op ${fmt(km)} km (max +10%).`,
    )
  }

  if (deload) {
    km = round05(km * DELOAD_RUN_FACTOR)
    reasons.push(`Deloadweek: ${DELOAD_RUN_PCT}% minder kilometers, ${fmt(km)} km in plaats van ${fmt(capped ? floor05(cap) : round05(raw))}.`)
  }

  const overCap = done > km + 1e-9
  const overCapReason = overCap
    ? `Deze week al ${fmt(done)} km gelopen, tegen een plafond van ${fmt(km)} km.`
    : null

  return { weekStart, week, raw, reference, cap, km, done, capped, deload, overCap, reasons, overCapReason }
}

export interface RunTarget {
  /** de afstand die de app vandaag voorschrijft */
  km: number
  /** wat het zonder bijsturing geweest was */
  base: number
  /** handmatig gezet door de gebruiker */
  manual: boolean
  capped: boolean
  /** één regel per bijsturing, in de volgorde waarin ze ingrijpen */
  reasons: string[]
}

/**
 * De geplande afstand van de loop op `iso`.
 *
 * Een handmatig gezette afstand wint meteen: dat is een keuze van de gebruiker, geen
 * voorstel van de app. Verder wordt het weekplafond eerlijk verdeeld over de lopen die
 * er deze week nog aankomen.
 */
export function plannedRunKm(state: UserState, iso: string, kind: RunKind): RunTarget {
  const manual = state.runPlans?.[iso]
  if (typeof manual === 'number' && Number.isFinite(manual) && manual > 0) {
    return {
      km: round05(manual),
      base: round05(manual),
      manual: true,
      capped: false,
      reasons: [`Zelf ingesteld op ${fmt(round05(manual))} km.`],
    }
  }

  const load = weekLoad(state, iso)
  const base = runKmFor(load.km, kind)
  let km = base
  const reasons = [...load.reasons]

  // Wat er deze week nog komt: samen mag dat niet meer zijn dan wat er van het weekplafond
  // over is. Bewust vanaf maandag geteld en niet vanaf vandaag — anders kijkt elke loop
  // alleen naar de lopen ná zichzelf, en dan past elke dag apart binnen het plafond
  // terwijl de week als geheel er ruim overheen gaat.
  const remaining = remainingRuns(state, mondayOf(iso))
  const plannedSum = remaining.reduce((sum, r) => sum + runKmFor(load.km, r.kind), 0)
  const left = Math.max(0, round(load.km - load.done))
  if (plannedSum > left + 1e-9 && plannedSum > 0) {
    km = floor05(km * (left / plannedSum))
    reasons.push(
      `Deze week al ${fmt(load.done)} km gelopen van de ${fmt(load.km)} — resterende lopen teruggeschaald naar ${fmt(km)} km.`,
    )
  }

  if (hadHeavyRun(state, iso)) {
    const before = km
    km = floor05(km * HEAVY_RUN_FACTOR)
    reasons.push(`Vorige loop viel zwaar — ${fmt(before)} km wordt ${fmt(km)} km voor de rest van de week.`)
  }

  return { km, base, manual: false, capped: load.capped, reasons }
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
  const remaining = remainingRuns(state, mondayOf(iso))
  const planned = round(load.done + remaining.reduce((sum, r) => sum + runKmFor(load.km, r.kind), 0))
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

/** Schrijft dit programma afstanden voor, of registreert het alleen? */
export function prescribesDistance(state: UserState): boolean {
  return programFor(state).runMode === 'planned'
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

/** Nederlandse notatie, zonder nullen die niets toevoegen. */
export function fmt(km: number): string {
  return String(Math.round(km * 10) / 10).replace('.', ',')
}
