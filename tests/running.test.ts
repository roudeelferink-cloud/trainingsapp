import { describe, expect, it } from 'vitest'
import { addDays } from '../src/logic/dates'
import { actualWeekKm, plannedRunKm, plannedWeekKm, scaledRunKm } from '../src/logic/running'
import { DI, MON, baseState } from './helpers'

const s0 = baseState()

function runLog(date: string, km: number, bike = false) {
  return {
    [date]: { date, kind: 'short' as const, plannedKm: 6, km, minutes: 30, bike, completedAt: 'x' },
  }
}

describe('hardloopvolume', () => {
  it('verdeelt de week over twee korte lopen en een duurloop', () => {
    const kort = plannedRunKm(s0, MON, 'short').km
    const lang = plannedRunKm(s0, MON, 'long').km
    expect(kort).toBeGreaterThanOrEqual(5)
    expect(kort).toBeLessThanOrEqual(8)
    expect(lang).toBeGreaterThan(kort)
  })

  it('groeit nooit meer dan 10% ten opzichte van de vorige week', () => {
    const week1 = plannedWeekKm(s0, MON).km
    const week2 = plannedWeekKm(s0, addDays(MON, 7)).km
    expect(week2).toBeLessThanOrEqual(week1 * 1.1)
  })

  it('schaalt terug na een week met weinig kilometers', () => {
    const state = baseState({ runs: runLog(addDays(MON, 7), 3) })
    const week3 = plannedWeekKm(state, addDays(MON, 14))
    expect(week3.capped).toBe(true)
    expect(week3.km).toBeLessThanOrEqual(3 * 1.1)
  })

  it('rondt de bovengrens naar beneden af, zodat +10% ook echt de grens is', () => {
    const state = baseState({ runs: runLog(addDays(MON, 7), 3) })
    // 3 km * 1.1 = 3.3 -> naar boven afronden zou 3.5 geven en de grens overschrijden
    expect(plannedWeekKm(state, addDays(MON, 14)).km).toBe(3)
  })

  it('haalt in de deloadweek volume weg', () => {
    expect(plannedWeekKm(s0, addDays(MON, 21)).km).toBeLessThan(plannedWeekKm(s0, MON).km)
  })

  it('telt alleen voltooide loops mee, geen fietssessies', () => {
    const state = baseState({ runs: { ...runLog(DI, 6), ...runLog(addDays(DI, 2), 8, true) } })
    expect(actualWeekKm(state, MON)).toBe(6)
  })
})

describe('afschalen op check-in', () => {
  it('haalt er 30% af bij 1-2', () => {
    expect(scaledRunKm(10, 1)).toBe(7)
    expect(scaledRunKm(10, 2)).toBe(7)
  })

  it('laat 3 en hoger ongemoeid', () => {
    expect(scaledRunKm(10, 3)).toBe(10)
    expect(scaledRunKm(10, 5)).toBe(10)
    expect(scaledRunKm(10, undefined)).toBe(10)
  })
})
