import type { RunKind, UserState } from '../types'
import { activityKm } from './activities'
import { cycleInfo } from './cycle'
import { addDays, mondayOf } from './dates'
import { deloadFor } from './deload'
import { scheduledRun } from './schedule'

/**
 * Hardlopen: wat er gebeurd is, en verder niets.
 *
 * Deze module stuurde het hardlopen aan — een weekplafond op een rollend gemiddelde,
 * een opbouwlijn voor de duurloop van 10 naar 15 km, een rem na drie stijgende weken,
 * een korting na een zware loop. Dat is er allemaal uit. De hardloopplanning is geen
 * werk voor de app: wie op zondag verder wil lopen dan de app in gedachten had, heeft
 * gelijk vaker dan de app.
 *
 * Wat blijft is registratie en constatering. De app telt wat je gelopen hebt, weet wat
 * je langste loop was en hoe deze afstand zich verhoudt tot je gemiddelde. Er staat
 * nergens meer een getal dat de app zelf verzonnen heeft, en er is geen regel die zegt
 * wat je zou moeten doen.
 *
 * Alles wat met loggen te maken heeft staat elders en is onaangeroerd: de afstand en de
 * tijd invoeren, het tempo, fietsen in plaats van lopen, en het verplaatsen van een loop
 * naar een andere dag.
 */

export interface WeekRunFacts {
  weekStart: string
  /** doorlopend weeknummer van het programma */
  week: number
  /** werkelijk gelopen kilometers, losse rondjes meegerekend */
  km: number
  /** aantal keer gelopen; fietsen telt niet mee */
  aantal: number
  deload: boolean
}

/**
 * Werkelijk gelopen kilometers in de week van `iso`.
 *
 * Losse hardloopactiviteiten tellen mee: een rondje dat niet in het schema stond is
 * net zo goed belasting voor je pezen. Fietsen telt niet mee, ook niet als het een
 * geplande loop verving.
 */
export function actualWeekKm(state: UserState, iso: string): number {
  return weekRunFacts(state, iso).km
}

/** Wat er deze week gelopen is: hoe vaak en hoeveel. Puur geteld, niets voorspeld. */
export function weekRunFacts(state: UserState, iso: string): WeekRunFacts {
  const weekStart = mondayOf(iso)
  const days = new Set(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)))
  let km = 0
  let aantal = 0

  for (const day of days) {
    const run = state.runs?.[day]
    if (run?.completedAt && !run.bike) {
      km += run.km
      aantal++
    }
  }
  for (const activity of state.activities ?? []) {
    if (activity.type !== 'hardlopen' || !days.has(activity.date)) continue
    km += activityKm(activity) ?? 0
    aantal++
  }

  return {
    weekStart,
    week: cycleInfo(state.startDate, weekStart).week,
    km: round(km),
    aantal,
    deload: deloadFor(state, weekStart).active,
  }
}

/** Over hoeveel weken terug er gekeken wordt bij "je langste loop" en het gemiddelde. */
export const REFERENCE_WEEKS = 4

/** De langste loop van de laatste weken; 0 als er niets gelogd is. */
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
 * De feitelijke context onder een afstand die jij zelf ingevuld hebt: één regel, geen
 * oordeel en geen voorstel. Hoe deze afstand zich verhoudt tot je gemiddelde loop van
 * deze soort en tot je langste loop — meer zegt de app er niet over.
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

export interface WeekKm {
  weekStart: string
  week: number
  km: number
  deload: boolean
}

/** Gelopen kilometers per week voor de grafiek op Historie. Oudste week eerst. */
export function weeklyKm(state: UserState, from: string, weeks = 12): WeekKm[] {
  const start = mondayOf(from)
  const out: WeekKm[] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const facts = weekRunFacts(state, addDays(start, -7 * w))
    out.push({ weekStart: facts.weekStart, week: facts.week, km: facts.km, deload: facts.deload })
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
