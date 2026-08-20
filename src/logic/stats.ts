import { BY_ID } from '../data/exercises'
import type { SessionLog, UserState } from '../types'
import { buildDay } from './day'
import { addDays, mondayOf, today } from './dates'
import { setVolumeKg } from './dumbbell'
import { estimate1RM } from './progression'
import { cycleInfo } from './cycle'
import { deloadFor } from './deload'
import { weeklyKm } from './runningLoad'

/** Aantal afgeronde krachtsessies. */
export function completedSessions(state: UserState): number {
  return Object.values(state.sessions).filter((s) => s.completedAt).length
}

export function completedRuns(state: UserState): number {
  return Object.values(state.runs).filter((r) => r.completedAt).length
}

/**
 * Trainingsstreak in dagen. Woensdag, zaterdag en met reden overgeslagen dagen
 * zijn neutraal: ze verlengen de streak niet, maar breken hem ook niet.
 */
export function trainingStreak(state: UserState): number {
  let streak = 0
  let iso = today()
  for (let i = 0; i < 400; i++) {
    const plan = buildDay(state, iso)
    const neutral =
      plan.isRest ||
      (!plan.run && !plan.strength) ||
      (plan.strength?.optional ?? false) ||
      !!plan.strength?.skipped ||
      !!plan.run?.skipped
    if (!neutral) {
      const runOk = !plan.run || plan.run.done
      const strengthOk = !plan.strength || plan.strength.done
      if (runOk && strengthOk) streak++
      else if (i === 0) {
        // vandaag is nog niet voorbij: telt niet mee, breekt ook niet
      } else break
    }
    iso = addDays(iso, -1)
  }
  return streak
}

export interface WeekVolume {
  weekStart: string
  week: number
  km: number
  deload: boolean
}

/**
 * Hardloopvolume per week, oudste eerst. Rekent met dezelfde kilometers als de
 * guardrails: losse hardloopactiviteiten tellen mee, fietsen niet.
 */
export function weeklyRunVolume(state: UserState, weeks = 12): WeekVolume[] {
  return weeklyKm(state, today(), weeks).map((w) => ({
    weekStart: w.weekStart,
    week: w.week,
    km: Math.round(w.km * 10) / 10,
    deload: w.deload,
  }))
}

/**
 * Getild gewicht van één sessie: per set gewicht × reps, met de dumbbell-conventie
 * erin verwerkt (zie `setVolumeKg`). Een afgeronde sessie bevat alleen afgevinkte
 * sets, dus alles wat erin staat telt mee.
 */
export function sessionVolumeKg(log: SessionLog): number {
  let kg = 0
  for (const [slotKey, sets] of Object.entries(log.entries)) {
    const ex = BY_ID[log.exercises?.[slotKey] ?? '']
    if (!ex) continue
    for (const set of sets) {
      if (set.done === false) continue
      kg += setVolumeKg(ex, set)
    }
  }
  return Math.round(kg)
}

export interface WeekTonnage {
  weekStart: string
  week: number
  kg: number
  deload: boolean
}

/** Tilvolume per week, oudste eerst. Zelfde vorm als het loopvolume. */
export function weeklyStrengthVolume(state: UserState, weeks = 12): WeekTonnage[] {
  const out: WeekTonnage[] = []
  const start = mondayOf(today())
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = addDays(start, -7 * w)
    const days = new Set(Array.from({ length: 7 }, (_, d) => addDays(weekStart, d)))
    let kg = 0
    for (const log of Object.values(state.sessions)) {
      if (log.completedAt && days.has(log.date)) kg += sessionVolumeKg(log)
    }
    const info = cycleInfo(state.startDate, weekStart)
    out.push({ weekStart, week: info.week, kg, deload: deloadFor(state, weekStart).active })
  }
  return out
}

export interface Point {
  date: string
  value: number
}

/**
 * Geschat 1RM per oefening over de tijd (beste set per sessie). Oefeningen die op
 * bandniveau loggen doen niet mee: daar staat geen gewicht tegenover.
 */
export function oneRmSeries(state: UserState): { exerciseId: string; naam: string; points: Point[] }[] {
  const byEx = new Map<string, Point[]>()
  const logs = Object.values(state.sessions)
    .filter((s) => s.completedAt)
    .sort((a, b) => a.date.localeCompare(b.date))

  for (const log of logs) {
    for (const [slotKey, sets] of Object.entries(log.entries)) {
      const exId = log.exercises?.[slotKey]
      if (!exId || !BY_ID[exId]) continue
      // bandwerk heeft geen kilo's; een ooit ingetypt getal hoort hier niet in de grafiek
      if (BY_ID[exId].unit === 'band') continue
      const best = sets.reduce((m, s) => Math.max(m, estimate1RM(s.weight, s.reps)), 0)
      if (best <= 0) continue
      const arr = byEx.get(exId) ?? []
      const last = arr[arr.length - 1]
      if (last && last.date === log.date) last.value = Math.max(last.value, best)
      else arr.push({ date: log.date, value: best })
      byEx.set(exId, arr)
    }
  }

  return [...byEx.entries()]
    .map(([exerciseId, points]) => ({ exerciseId, naam: BY_ID[exerciseId].naam, points }))
    .filter((s) => s.points.length > 0)
    .sort((a, b) => b.points.length - a.points.length || a.naam.localeCompare(b.naam))
}

export const EXPORT_REMINDER_DAYS = 30

export interface ExportReminder {
  /** dagen sinds de laatste export; null als er nog nooit geëxporteerd is */
  daysAgo: number | null
  text: string
}

/**
 * Herinnering om te exporteren. Komt terug zodra de laatste export ouder is dan
 * 30 dagen, of als er wel data is maar nog nooit een export gemaakt.
 */
export function exportReminder(state: UserState, now = new Date()): ExportReminder | null {
  const hasData =
    completedSessions(state) > 0 || completedRuns(state) > 0 || state.activities.length > 0
  if (!hasData) return null

  if (!state.lastExportAt) {
    return { daysAgo: null, text: 'Je hebt nog nooit een back-up gemaakt. Exporteer je historie.' }
  }

  const then = new Date(state.lastExportAt).getTime()
  if (Number.isNaN(then)) {
    return { daysAgo: null, text: 'Onbekend wanneer je voor het laatst geëxporteerd hebt. Maak een back-up.' }
  }

  const daysAgo = Math.floor((now.getTime() - then) / 86400000)
  if (daysAgo < EXPORT_REMINDER_DAYS) return null
  return { daysAgo, text: `Laatste back-up was ${daysAgo} dagen geleden. Tijd om te exporteren.` }
}

/**
 * Waarschuwing vóór het wissen: er is nooit geëxporteerd, of de laatste export is
 * ouder dan een week. Strenger dan de herinnering van 30 dagen op het instellingen-
 * scherm, want hierna is de historie echt weg.
 */
export const EXPORT_WARNING_DAYS = 7

export function exportWarning(state: UserState, now = new Date()): string | null {
  if (!state.lastExportAt) return 'Je hebt nog nooit een back-up gemaakt.'
  const then = new Date(state.lastExportAt).getTime()
  if (Number.isNaN(then)) return 'Onbekend wanneer je voor het laatst geëxporteerd hebt.'
  const days = Math.floor((now.getTime() - then) / 86400000)
  if (days < EXPORT_WARNING_DAYS) return null
  return `Je laatste back-up is ${days} dagen oud.`
}

export interface DataSummary {
  /** gelogde krachtsessies, inclusief nog lopende concepten */
  sessions: number
  runs: number
  activities: number
  /** datum van de oudste log; null als er niets is */
  oldest: string | null
}

/** Wat er precies verdwijnt als deze gebruiker gewist wordt. */
export function dataSummary(state: UserState): DataSummary {
  const datums = [
    ...Object.values(state.sessions).map((x) => x.date),
    ...Object.values(state.runs).map((x) => x.date),
    ...state.activities.map((x) => x.date),
  ].filter((d) => typeof d === 'string' && d)

  return {
    sessions: Object.keys(state.sessions).length,
    runs: Object.keys(state.runs).length,
    activities: state.activities.length,
    oldest: datums.length ? datums.reduce((a, b) => (a < b ? a : b)) : null,
  }
}

