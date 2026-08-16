import { describe, expect, it } from 'vitest'
import { addDays } from '../src/logic/dates'
import { DELOAD_RUN_FACTOR, DELOAD_WEIGHT_FACTOR, deloadFor, deloadTrigger } from '../src/logic/deload'
import { isPoorDay, weekIsPoor } from '../src/logic/feel'
import type { DayCheck, DayKind, Feel, UserState } from '../src/types'
import { MON, baseState } from './helpers'

/** Een afgeronde krachtsessie met een beoordeling. */
function sessie(date: string, feel: Feel, kind: DayKind = 'push'): UserState['sessions'] {
  return {
    [`${date}:${kind}`]: {
      date,
      kind,
      completedAt: `${date}T19:00:00.000Z`,
      short: false,
      entries: {},
      exercises: {},
      skippedSlots: [],
      completedSlots: [],
      feel,
    },
  }
}

function checks(dates: string[], check: DayCheck): Record<string, DayCheck> {
  return Object.fromEntries(dates.map((d) => [d, check]))
}

const SLECHT: DayCheck = { sleep: 1, energy: 2 }
const GOED: DayCheck = { sleep: 3, energy: 3 }

describe('deloadtriggers', () => {
  it('plant elke achtste week een deload', () => {
    const s = baseState()
    expect(deloadTrigger(s, addDays(MON, 49))).toBe('ritme')
    expect(deloadTrigger(s, addDays(MON, 7 * 15))).toBe('ritme')
    expect(deloadTrigger(s, addDays(MON, 21))).toBeNull()
  })

  it('trekt aan de bel na drie zware sessies in twee weken', () => {
    const s = baseState({
      sessions: {
        ...sessie(addDays(MON, 1), 'zwaar'),
        ...sessie(addDays(MON, 4), 'zwaar', 'pull'),
        ...sessie(addDays(MON, 8), 'zwaar', 'legs_a'),
      },
    })
    // de week erna (vanaf maandag van week 3) is een deloadweek
    expect(deloadTrigger(s, addDays(MON, 14))).toBe('zwaar')
    // in de week zelf verandert er niets: het schema schuift niet onder je voeten weg
    expect(deloadTrigger(s, addDays(MON, 9))).toBeNull()
  })

  it('telt een zware loop net zo hard mee als een zware krachtsessie', () => {
    const zwaar = (date: string) => ({
      [date]: {
        date,
        kind: 'short' as const,
        plannedKm: 6,
        km: 6,
        minutes: 36,
        bike: false,
        completedAt: `${date}T18:00:00.000Z`,
        feel: 'zwaar' as const,
      },
    })
    const s = baseState({
      sessions: sessie(addDays(MON, 1), 'zwaar'),
      runs: { ...zwaar(addDays(MON, 3)), ...zwaar(addDays(MON, 6)) },
    })
    expect(deloadTrigger(s, addDays(MON, 7))).toBe('zwaar')
  })

  it('doet niets bij twee zware sessies', () => {
    const s = baseState({
      sessions: { ...sessie(addDays(MON, 1), 'zwaar'), ...sessie(addDays(MON, 4), 'zwaar', 'pull') },
    })
    expect(deloadTrigger(s, addDays(MON, 14))).toBeNull()
  })

  it('trekt aan de bel na twee weken op rij een slechte dagcheck', () => {
    const s = baseState({
      dayChecks: {
        ...checks([MON, addDays(MON, 1), addDays(MON, 2)], SLECHT),
        ...checks([addDays(MON, 7), addDays(MON, 8)], SLECHT),
      },
    })
    expect(deloadTrigger(s, addDays(MON, 14))).toBe('dagcheck')
  })

  it('laat één slechte week met rust', () => {
    const s = baseState({
      dayChecks: {
        ...checks([MON, addDays(MON, 1)], SLECHT),
        ...checks([addDays(MON, 7), addDays(MON, 8)], GOED),
      },
    })
    expect(deloadTrigger(s, addDays(MON, 14))).toBeNull()
  })

  it('vraagt minstens twee ingevulde dagen voordat een week meetelt', () => {
    const s = baseState({ dayChecks: checks([MON], SLECHT) })
    expect(weekIsPoor(s, MON)).toBe(false)
    expect(weekIsPoor(baseState({ dayChecks: checks([MON, addDays(MON, 2)], SLECHT) }), MON)).toBe(true)
  })

  it('rekent slaap en energie samen', () => {
    expect(isPoorDay({ sleep: 1, energy: 1 })).toBe(true)
    expect(isPoorDay({ sleep: 1, energy: 2 })).toBe(true)
    expect(isPoorDay({ sleep: 2, energy: 2 })).toBe(false)
    expect(isPoorDay({ sleep: 1, energy: 3 })).toBe(false)
  })
})

describe('deload overslaan', () => {
  const week8 = addDays(MON, 49)

  it('staat aan tot hij overgeslagen wordt', () => {
    const s = baseState()
    expect(deloadFor(s, week8).active).toBe(true)

    const overgeslagen = baseState({
      deloadSkips: { [week8]: { weekStart: week8, confirmedAt: 'x', acknowledged: 'risico' } },
    })
    const plan = deloadFor(overgeslagen, week8)
    expect(plan.active).toBe(false)
    expect(plan.skipped).toBe(true)
    expect(plan.explanation).toContain('overgeslagen')
  })

  it('werkt alleen voor de week waar hij op staat', () => {
    const overgeslagen = baseState({
      deloadSkips: { [week8]: { weekStart: week8, confirmedAt: 'x', acknowledged: 'risico' } },
    })
    expect(deloadFor(overgeslagen, addDays(week8, 7 * 8)).active).toBe(true)
  })
})

describe('hoeveel er af gaat', () => {
  it('is 40% van het gewicht en 30% van de kilometers', () => {
    expect(DELOAD_WEIGHT_FACTOR).toBe(0.6)
    expect(DELOAD_RUN_FACTOR).toBe(0.7)
  })
})
