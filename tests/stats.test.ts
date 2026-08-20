import { describe, expect, it } from 'vitest'
import { addDays } from '../src/logic/dates'
import {
  EXPORT_REMINDER_DAYS,
  completedRuns,
  completedSessions,
  exportReminder,
  oneRmSeries,
  trainingStreak,
} from '../src/logic/stats'
import { MON, baseState } from './helpers'

function sessionLog(date: string, weight: number) {
  return {
    [`${date}:legs_a`]: {
      date,
      kind: 'legs_a' as const,
      short: false,
      completedAt: 'x',
      skippedSlots: [],
      completedSlots: [],
      exercises: { 'legs_a:0': 'leg_press' },
      entries: { 'legs_a:0': [{ weight, reps: 10, rir: 1, done: true }] },
    },
  }
}

describe('statistiek', () => {
  it('telt afgeronde sessies en loops', () => {
    const state = baseState({
      sessions: sessionLog(MON, 100),
      runs: {
        [MON]: { date: MON, kind: 'short', plannedKm: 6, km: 6, minutes: 30, bike: false, completedAt: 'x' },
      },
    })
    expect(completedSessions(state)).toBe(1)
    expect(completedRuns(state)).toBe(1)
  })

  it('bouwt per oefening een oplopende 1RM-reeks', () => {
    const state = baseState({
      sessions: { ...sessionLog(MON, 100), ...sessionLog(addDays(MON, 7), 105) },
    })
    const series = oneRmSeries(state)
    expect(series).toHaveLength(1)
    expect(series[0].exerciseId).toBe('leg_press')
    expect(series[0].points).toHaveLength(2)
    expect(series[0].points[1].value).toBeGreaterThan(series[0].points[0].value)
  })

  it('slaat sessies zonder oefeningmap over', () => {
    const kaal = {
      [`${MON}:legs_a`]: {
        date: MON,
        kind: 'legs_a' as const,
        short: false,
        completedAt: 'x',
        skippedSlots: [],
        completedSlots: [],
        exercises: {},
        entries: { 'legs_a:0': [{ weight: 100, reps: 10, rir: 1, done: true }] },
      },
    }
    expect(oneRmSeries(baseState({ sessions: kaal }))).toEqual([])
  })

  it('draait streaks zonder te crashen op lege data', () => {
    expect(typeof trainingStreak(baseState())).toBe('number')
  })
})

describe('exportherinnering', () => {
  const metData = (patch = {}) => baseState({ sessions: sessionLog(MON, 100), ...patch })

  it('zwijgt zolang er nog niets te verliezen valt', () => {
    expect(exportReminder(baseState())).toBeNull()
  })

  it('vraagt om een eerste back-up zodra er data is', () => {
    const r = exportReminder(metData())
    expect(r).not.toBeNull()
    expect(r!.daysAgo).toBeNull()
    expect(r!.text).toContain('nooit')
  })

  it('zwijgt binnen 30 dagen na een export', () => {
    const now = new Date('2026-09-01T12:00:00Z')
    const recent = new Date(now.getTime() - 29 * 86400000).toISOString()
    expect(exportReminder(metData({ lastExportAt: recent }), now)).toBeNull()
  })

  it('herinnert zodra de laatste export ouder is dan 30 dagen', () => {
    const now = new Date('2026-09-01T12:00:00Z')
    const oud = new Date(now.getTime() - 31 * 86400000).toISOString()
    const r = exportReminder(metData({ lastExportAt: oud }), now)
    expect(r).not.toBeNull()
    expect(r!.daysAgo).toBe(31)
    expect(r!.text).toContain('31 dagen')
  })

  it('slaat precies op de grens van 30 dagen aan', () => {
    const now = new Date('2026-09-01T12:00:00Z')
    const grens = new Date(now.getTime() - EXPORT_REMINDER_DAYS * 86400000).toISOString()
    expect(exportReminder(metData({ lastExportAt: grens }), now)?.daysAgo).toBe(30)
  })

  it('herinnert ook bij een onleesbaar tijdstip', () => {
    expect(exportReminder(metData({ lastExportAt: 'onzin' }))).not.toBeNull()
  })
})
