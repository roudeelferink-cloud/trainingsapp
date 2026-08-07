import { BY_ID } from '../data/exercises'
import type { AppState } from '../types'
import { buildDay } from './day'
import { addDays, mondayOf, today } from './dates'
import { estimate1RM } from './progression'
import { cycleInfo } from './cycle'

/** Aantal afgeronde krachtsessies. */
export function completedSessions(state: AppState): number {
  return Object.values(state.sessions).filter((s) => s.completedAt).length
}

export function completedRuns(state: AppState): number {
  return Object.values(state.runs).filter((r) => r.completedAt).length
}

/**
 * Trainingsstreak in dagen. Woensdag, zaterdag en met reden overgeslagen dagen
 * zijn neutraal: ze verlengen de streak niet, maar breken hem ook niet.
 */
export function trainingStreak(state: AppState): number {
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

/** Streak van de dagelijkse onderhoudschecklist. */
export function maintenanceStreak(state: AppState): number {
  const items = state.settings.maintenanceItems
  if (items.length === 0) return 0
  let streak = 0
  let iso = today()
  for (let i = 0; i < 400; i++) {
    const done = state.maintenance[iso] ?? []
    const all = items.every((m) => done.includes(m.id))
    if (all) streak++
    else if (i > 0) break
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

/** Hardloopvolume per week, oudste eerst. */
export function weeklyRunVolume(state: AppState, weeks = 12): WeekVolume[] {
  const out: WeekVolume[] = []
  const start = mondayOf(today())
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = addDays(start, -7 * w)
    let km = 0
    for (let d = 0; d < 7; d++) {
      const r = state.runs[addDays(weekStart, d)]
      if (r?.completedAt && !r.bike) km += r.km
    }
    const info = cycleInfo(state.startDate, weekStart)
    out.push({ weekStart, week: info.week, km: Math.round(km * 10) / 10, deload: info.deload })
  }
  return out
}

export interface Point {
  date: string
  value: number
}

/** Geschat 1RM per oefening over de tijd (beste set per sessie). */
export function oneRmSeries(state: AppState): { exerciseId: string; naam: string; points: Point[] }[] {
  const byEx = new Map<string, Point[]>()
  const logs = Object.values(state.sessions)
    .filter((s) => s.completedAt)
    .sort((a, b) => a.date.localeCompare(b.date))

  for (const log of logs) {
    for (const [slotKey, sets] of Object.entries(log.entries)) {
      const exId = log.exercises?.[slotKey]
      if (!exId || !BY_ID[exId]) continue
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
export function exportReminder(state: AppState, now = new Date()): ExportReminder | null {
  const hasData =
    completedSessions(state) > 0 || completedRuns(state) > 0 || Object.keys(state.protein).length > 0
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

export function proteinGoal(state: AppState): number | null {
  const kg = state.settings.bodyweightKg
  if (!kg || kg <= 0) return null
  return Math.round((kg * state.settings.proteinFactor) / 5) * 5
}
