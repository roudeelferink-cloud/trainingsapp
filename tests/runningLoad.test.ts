import { describe, expect, it } from 'vitest'
import { addDays } from '../src/logic/dates'
import { BASE_WEEK_KM, rawWeekKm, splitWeek } from '../src/logic/running'
import {
  MAX_WEEKLY_GROWTH,
  actualWeekKm,
  hadHeavyRun,
  plannedRunKm,
  remainingRuns,
  weekLoad,
  weekReference,
} from '../src/logic/runningLoad'
import type { Activity, Feel, RunKind, UserState } from '../src/types'
import { DI, DO, MON, ZO, baseState } from './helpers'

function run(date: string, km: number, opts: { bike?: boolean; kind?: RunKind; feel?: Feel; planned?: number } = {}) {
  return {
    [date]: {
      date,
      kind: opts.kind ?? ('short' as const),
      plannedKm: opts.planned ?? 6,
      km,
      minutes: Math.round(km * 6),
      bike: opts.bike ?? false,
      completedAt: `${date}T18:00:00.000Z`,
      feel: opts.feel,
    },
  }
}

function loop(date: string, km: number): Activity {
  return {
    id: `a-${date}`,
    date,
    type: 'hardlopen',
    minutes: Math.round(km * 6),
    distanceKm: km,
    intensity: 'normaal',
    note: null,
    createdAt: `${date}T19:00:00.000Z`,
  }
}

/** Een hele week netjes volgens plan gelopen, zodat de referentie klopt. */
function weekGelopen(monday: string, km: number): UserState['runs'] {
  const split = splitWeek(km)
  return {
    ...run(addDays(monday, 1), split.short),
    ...run(addDays(monday, 3), split.short),
    ...run(addDays(monday, 6), split.long, { kind: 'long' }),
  }
}

describe('werkelijk gelopen kilometers', () => {
  it('telt alleen voltooide loops, geen fietssessies', () => {
    const state = baseState({ runs: { ...run(DI, 6), ...run(DO, 8, { bike: true }) } })
    expect(actualWeekKm(state, MON)).toBe(6)
  })

  it('telt losse hardloopactiviteiten mee', () => {
    const state = baseState({ runs: run(DI, 6), activities: [loop(DO, 4.5)] })
    expect(actualWeekKm(state, MON)).toBe(10.5)
  })

  it('houdt weken uit elkaar, ook rond de zondag', () => {
    const state = baseState({ runs: { ...run(ZO, 10, { kind: 'long' }), ...run(addDays(ZO, 1), 5) } })
    expect(actualWeekKm(state, MON)).toBe(10)
    expect(actualWeekKm(state, addDays(MON, 7))).toBe(5)
  })
})

describe('weekplafond', () => {
  it('laat week 1 ongemoeid: er is niets om mee te vergelijken', () => {
    const load = weekLoad(baseState(), MON)
    expect(load.km).toBe(BASE_WEEK_KM)
    expect(load.capped).toBe(false)
  })

  it('vergelijkt met het gemiddelde van de twee voorgaande weken', () => {
    const state = baseState({
      runs: { ...weekGelopen(MON, 22), ...weekGelopen(addDays(MON, 7), 10) },
    })
    const load = weekLoad(state, addDays(MON, 14))
    expect(load.reference).toBeCloseTo((actualWeekKm(state, MON) + actualWeekKm(state, addDays(MON, 7))) / 2, 5)
    expect(load.km).toBeLessThanOrEqual(load.reference * MAX_WEEKLY_GROWTH)
    expect(load.capped).toBe(true)
  })

  it('laat één matige week het schema niet slopen', () => {
    // week 1 volgens plan, week 2 maar 10 km: het gemiddelde vangt dat op
    const state = baseState({
      runs: { ...weekGelopen(MON, 22), ...weekGelopen(addDays(MON, 7), 10) },
    })
    const load = weekLoad(state, addDays(MON, 14))
    expect(load.km).toBeGreaterThan(10 * MAX_WEEKLY_GROWTH)
  })

  it('gebruikt het plan als referentie voor een week zonder enige loop', () => {
    const state = baseState()
    expect(weekReference(state, MON)).toBeCloseTo(rawWeekKm(1), 5)
  })

  it('rondt de bovengrens naar beneden af, zodat +10% ook echt de grens is', () => {
    const state = baseState({
      runs: { ...weekGelopen(MON, 8), ...weekGelopen(addDays(MON, 7), 8) },
    })
    const load = weekLoad(state, addDays(MON, 14))
    expect(load.km).toBeLessThanOrEqual(load.reference * MAX_WEEKLY_GROWTH + 1e-9)
    expect(load.km * 2).toBe(Math.round(load.km * 2)) // halve kilometers
  })
})

describe('de zondag is de duurloop', () => {
  it('houdt de duurloop langer dan de korte lopen, ook na een teruggeschaalde week', () => {
    // dit is het geval waar het misging: week 2 half gelopen, week 3 teruggeschaald
    const state = baseState({ runs: weekGelopen(addDays(MON, 7), 12) })
    const derde = addDays(MON, 14)
    const kort = plannedRunKm(state, addDays(derde, 1), 'short')
    const lang = plannedRunKm(state, addDays(derde, 6), 'long')
    expect(lang.km).toBeGreaterThan(kort.km)
  })

  it('schrijft in een normale week 6 + 6 + 10 km voor', () => {
    const state = baseState()
    expect(plannedRunKm(state, DI, 'short').km).toBe(6)
    expect(plannedRunKm(state, DO, 'short').km).toBe(6)
    expect(plannedRunKm(state, ZO, 'long').km).toBe(10)
  })
})

describe('verder gelopen dan gepland', () => {
  it('schaalt de resterende lopen terug en zegt waarom', () => {
    // dinsdag 12 km gelopen in plaats van 6: dat eet van het weekplafond
    const state = baseState({ runs: run(DI, 12) })
    const donderdag = plannedRunKm(state, DO, 'short')
    expect(donderdag.km).toBeLessThan(6)
    expect(donderdag.reasons.join(' ')).toContain('teruggeschaald')
  })

  it('meldt het overschreden plafond op weekniveau', () => {
    const binnen = baseState({ runs: { ...run(DI, 6), ...run(DO, 6) } })
    expect(weekLoad(binnen, DO).overCap).toBe(false)

    // 12 + 12 km is meer dan de 22 km die deze week het plafond is
    const overschreden = weekLoad(baseState({ runs: { ...run(DI, 12), ...run(DO, 12) } }), DO)
    expect(overschreden.overCap).toBe(true)
    expect(overschreden.overCapReason).toContain('plafond')
  })

  it('telt alleen lopen mee die nog komen', () => {
    const state = baseState({ runs: run(DI, 6) })
    expect(remainingRuns(state, DI).map((r) => r.date)).toEqual([DO, ZO])
    expect(remainingRuns(state, DO).map((r) => r.date)).toEqual([DO, ZO])
  })

  it('laat een overgeslagen of gefietste loop buiten de resterende lopen', () => {
    const state = baseState({
      skips: { [`${DO}:run`]: { reason: 'druk', what: 'run' } },
      overrides: { [ZO]: { bike: true } },
    })
    expect(remainingRuns(state, DI).map((r) => r.date)).toEqual([DI])
  })
})

describe('alle lopen samen binnen het plafond', () => {
  it('houdt de som van de weeklopen onder het plafond, ook met een loop erbij', () => {
    // een vierde loop in de week, bijvoorbeeld doordat er eentje naar deze week verhuisde
    const state = baseState({ runMoves: { [addDays(ZO, -7)]: MON } })
    const load = weekLoad(state, MON)
    const lopen = remainingRuns(state, MON)
    expect(lopen.length).toBe(4)

    const samen = lopen.reduce((sum, r) => sum + plannedRunKm(state, r.date, r.kind).km, 0)
    expect(samen).toBeLessThanOrEqual(load.km + 0.01)
  })

  it('schaalt elke loop van de week met dezelfde factor', () => {
    const state = baseState({ runMoves: { [addDays(ZO, -7)]: MON } })
    const eerste = plannedRunKm(state, DI, 'short').km
    const tweede = plannedRunKm(state, DO, 'short').km
    expect(eerste).toBe(tweede)
  })
})

describe('een zware loop remt de rest van de week', () => {
  it('haalt er 10% af', () => {
    const zwaar = baseState({ runs: run(DI, 6, { feel: 'zwaar' }) })
    const normaal = baseState({ runs: run(DI, 6, { feel: 'goed' }) })
    expect(hadHeavyRun(zwaar, DO)).toBe(true)
    expect(plannedRunKm(zwaar, DO, 'short').km).toBeLessThan(plannedRunKm(normaal, DO, 'short').km)
    expect(plannedRunKm(zwaar, DO, 'short').reasons.join(' ')).toContain('zwaar')
  })

  it('werkt alleen vooruit, niet op de loop zelf', () => {
    const state = baseState({ runs: run(DO, 6, { feel: 'zwaar' }) })
    expect(hadHeavyRun(state, DI)).toBe(false)
  })
})

describe('handmatig geplande afstand', () => {
  it('wint van wat de app uitrekent', () => {
    const state = baseState({ runPlans: { [ZO]: 14 } })
    const target = plannedRunKm(state, ZO, 'long')
    expect(target.km).toBe(14)
    expect(target.manual).toBe(true)
    expect(target.reasons.join(' ')).toContain('Zelf ingesteld')
  })
})

describe('deloadweek', () => {
  it('haalt 30% van het loopvolume af', () => {
    const state = baseState()
    const normaal = weekLoad(state, addDays(MON, 42)) // week 7
    const deload = weekLoad(state, addDays(MON, 49)) // week 8
    expect(deload.deload).toBe(true)
    expect(deload.km).toBeLessThan(normaal.km * 0.75)
    expect(deload.reasons.join(' ')).toContain('Deloadweek')
  })
})
