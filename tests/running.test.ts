import { describe, expect, it } from 'vitest'
import {
  BASE_WEEK_KM,
  SHORT_MAX_KM,
  SHORT_MIN_KM,
  floor05,
  rawWeekKm,
  round05,
  runKmFor,
  scaledRunKm,
  splitWeek,
} from '../src/logic/running'

describe('weekafstand', () => {
  it('begint op 22 km', () => {
    expect(rawWeekKm(1)).toBe(BASE_WEEK_KM)
  })

  it('bouwt 5% per week op', () => {
    expect(rawWeekKm(2)).toBeCloseTo(BASE_WEEK_KM * 1.05, 5)
    expect(rawWeekKm(3)).toBeCloseTo(BASE_WEEK_KM * 1.05 ** 2, 5)
  })

  it('slaat de deloadweek over in de opbouw, zodat je daarna verder gaat waar je was', () => {
    // week 8 is de deloadweek; week 9 pakt de draad op waar week 8 hem liet liggen
    expect(rawWeekKm(9)).toBeCloseTo(rawWeekKm(8), 5)
    expect(rawWeekKm(10)).toBeCloseTo(rawWeekKm(9) * 1.05, 5)
  })

  it('valt terug op week 1 voor rare weeknummers', () => {
    expect(rawWeekKm(0)).toBe(BASE_WEEK_KM)
    expect(rawWeekKm(-3)).toBe(BASE_WEEK_KM)
  })
})

describe('verdeling over de week', () => {
  it('geeft het uitgangspunt 6 + 6 + 10 bij 22 km', () => {
    expect(splitWeek(22)).toEqual({ short: 6, long: 10 })
  })

  it('houdt de duurloop altijd de langste loop van de week', () => {
    for (let km = 3; km <= 45; km += 0.5) {
      const { short, long } = splitWeek(km)
      expect(long, `${km} km`).toBeGreaterThanOrEqual(short)
    }
  })

  it('blijft binnen de weekafstand, ook bij weinig kilometers', () => {
    for (let km = 3; km <= 45; km += 0.5) {
      const { short, long } = splitWeek(km)
      expect(2 * short + long, `${km} km`).toBeLessThanOrEqual(km + 1e-9)
    }
  })

  it('houdt een korte loop op maximaal 8 km en legt de rest bij de duurloop', () => {
    const { short, long } = splitWeek(40)
    expect(short).toBe(SHORT_MAX_KM)
    expect(long).toBe(24)
  })

  it('laat de korte lopen krimpen in plaats van de duurloop af te knijpen', () => {
    // dit is de oude fout: 16 km werd 5 + 5 + 6, met een duurloop korter dan de korte lopen
    const { short, long } = splitWeek(16)
    expect(long).toBeGreaterThan(short)
    expect(short).toBe(4.5)
    expect(long).toBe(7)
  })

  it('houdt in een normale week de korte lopen binnen 5 tot 8 km', () => {
    const { short } = splitWeek(BASE_WEEK_KM)
    expect(short).toBeGreaterThanOrEqual(SHORT_MIN_KM)
    expect(short).toBeLessThanOrEqual(SHORT_MAX_KM)
  })

  it('houdt een korte loop tussen 5 en 8 km zolang de week dat toelaat', () => {
    for (const km of [22, 23.1, 24.3, 25.5, 27, 30]) {
      const { short } = splitWeek(km)
      expect(short, `${km} km`).toBeGreaterThanOrEqual(5)
      expect(short, `${km} km`).toBeLessThanOrEqual(8)
    }
  })

  it('kiest per soort loop de juiste afstand', () => {
    expect(runKmFor(22, 'short')).toBe(6)
    expect(runKmFor(22, 'long')).toBe(10)
  })

  it('gaat niet stuk op nul', () => {
    expect(splitWeek(0)).toEqual({ short: 0, long: 0 })
  })
})

describe('afronden', () => {
  it('rondt op halve kilometers af', () => {
    expect(round05(6.24)).toBe(6)
    expect(round05(6.26)).toBe(6.5)
  })

  it('rondt naar beneden waar een bovengrens niet overschreden mag worden', () => {
    expect(floor05(3.3)).toBe(3)
    expect(floor05(3.5)).toBe(3.5)
    expect(floor05(3.9)).toBe(3.5)
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
