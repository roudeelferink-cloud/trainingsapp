import { describe, expect, it } from 'vitest'
import { buildDay } from '../src/logic/day'
import { addDays } from '../src/logic/dates'
import { dayGuardrails } from '../src/logic/guardrails'
import {
  LONG_BASE_KM,
  LONG_MAX_KM,
  longRunLineKm,
  splitWeekAround,
} from '../src/logic/running'
import {
  GROWTH_HOLD,
  GROWTH_STEADY,
  GROWTH_STRONG,
  MAX_RISES_IN_A_ROW,
  REFERENCE_WEEKS,
  averageRunKm,
  longRunTarget,
  longestRunKm,
  plannedRunKm,
  risesInARow,
  rollingReference,
  runContext,
  weekLoad,
  weeklyGrowth,
} from '../src/logic/runningLoad'
import type { DayScore, Feel, RunKind, UserState } from '../src/types'
import { DI, DO, MON, ZO, baseState } from './helpers'

/**
 * De hardloopopbouw na de omslag: de gebruiker bepaalt de afstand, de app rekent mee.
 * Het venster is vier weken werkelijk gelopen kilometers, de duurloop heeft een eigen
 * lijn, en de weekstap beweegt mee met de check-ins.
 */

function run(
  date: string,
  km: number,
  opts: { kind?: RunKind; feel?: Feel; bike?: boolean; planned?: number } = {},
) {
  return {
    [date]: {
      date,
      kind: opts.kind ?? ('short' as const),
      plannedKm: opts.planned ?? km,
      km,
      minutes: Math.round(km * 6),
      bike: opts.bike ?? false,
      completedAt: `${date}T18:00:00.000Z`,
      feel: opts.feel,
    },
  }
}

/** Een week met drie lopen: kort, kort, lang. */
function week(monday: string, kort: number, lang: number): UserState['runs'] {
  return {
    ...run(addDays(monday, 1), kort),
    ...run(addDays(monday, 3), kort),
    ...run(addDays(monday, 6), lang, { kind: 'long' }),
  }
}

/** Vier weken op hetzelfde niveau, direct vóór `monday`. */
function vierWeken(monday: string, kort: number, lang: number): UserState['runs'] {
  let runs: UserState['runs'] = {}
  for (let w = 1; w <= 4; w++) runs = { ...runs, ...week(addDays(monday, -7 * w), kort, lang) }
  return runs
}

const WEEK5 = addDays(MON, 28)

describe('het venster: vier weken werkelijk gelopen', () => {
  it('kijkt vier weken terug in plaats van twee', () => {
    expect(REFERENCE_WEEKS).toBe(4)
    const state = baseState({ runs: vierWeken(WEEK5, 6, 10) })
    const ref = rollingReference(state, WEEK5)
    expect(ref.weeks).toBe(4)
    expect(ref.km).toBeCloseTo(22, 5)
  })

  it('rekent op gelopen kilometers, niet op wat er voorgeschreven stond', () => {
    // vier weken lang 10 km voorgeschreven maar 14 km gelopen: het gemiddelde volgt het lopen
    let runs: UserState['runs'] = {}
    for (let w = 1; w <= 4; w++) {
      runs = { ...runs, ...run(addDays(WEEK5, -7 * w + 6), 14, { kind: 'long', planned: 10 }) }
    }
    expect(rollingReference(baseState({ runs }), WEEK5).km).toBeCloseTo(14, 5)
  })

  it('slaat een week zonder enige loop over in plaats van hem als nul te tellen', () => {
    // dit is de spiraal die de zondag op 5,5 km zette: een lege week trok alles omlaag
    const compleet = baseState({ runs: vierWeken(WEEK5, 6, 10) })
    const metGat = baseState({
      runs: Object.fromEntries(
        Object.entries(vierWeken(WEEK5, 6, 10)).filter(([d]) => !d.startsWith(addDays(WEEK5, -14))),
      ),
    })
    // de weggelaten week telt niet mee; het gemiddelde blijft op hetzelfde niveau
    expect(rollingReference(metGat, WEEK5).km).toBeCloseTo(rollingReference(compleet, WEEK5).km, 1)
  })

  it('valt zonder enige gelopen week terug op het plan', () => {
    const ref = rollingReference(baseState(), addDays(MON, 7))
    expect(ref.weeks).toBe(0)
    expect(ref.km).toBeGreaterThan(0)
  })
})

describe('de duurloop heeft een eigen lijn', () => {
  it('begint op 10 km en groeit met een halve kilometer per opbouwweek', () => {
    expect(LONG_BASE_KM).toBe(10)
    expect(longRunLineKm(1)).toBe(10)
    expect(longRunLineKm(2)).toBe(10.5)
    expect(longRunLineKm(5)).toBe(12)
  })

  it('stopt hard op 15 km', () => {
    expect(LONG_MAX_KM).toBe(15)
    for (const w of [12, 20, 40, 200]) {
      expect(longRunLineKm(w), `week ${w}`).toBeLessThanOrEqual(LONG_MAX_KM)
    }
    expect(longRunLineKm(40)).toBe(15)
  })

  it('slaat de deloadweek over in de opbouw', () => {
    expect(longRunLineKm(9)).toBe(longRunLineKm(8))
  })

  it('houdt boven de 15 km op met opbouwen en gaat over op onderhoud', () => {
    // zelf 17 km gelopen: de app trekt dat niet terug naar de lijn, maar bouwt ook niet door
    const state = baseState({ runs: run(addDays(WEEK5, -7 + 6), 17, { kind: 'long' }) })
    const doel = longRunTarget(state, WEEK5)
    expect(doel.maintenance).toBe(true)
    expect(doel.km).toBe(17)
    expect(doel.reason).toContain('onderhoud')
    // en een week later nog steeds onderhoud, niet 17,5
    expect(longRunTarget(state, addDays(WEEK5, 7)).km).toBeLessThanOrEqual(17)
  })

  it('laat het weekplafond de duurloop niet meer inkorten', () => {
    // het geval uit de melding: een magere vorige week zette de zondag op 5,5 km
    const state = baseState({ runs: week(addDays(WEEK5, -7), 3, 5) })
    const zondag = plannedRunKm(state, addDays(WEEK5, 6), 'long')
    expect(zondag.km).toBe(longRunLineKm(5))
    expect(zondag.km).toBeGreaterThanOrEqual(LONG_BASE_KM)
  })

  it('laat de deload wél over de duurloop gaan', () => {
    const state = baseState()
    const deloadWeek = addDays(MON, 49) // week 8
    expect(weekLoad(state, deloadWeek).deload).toBe(true)
    const doel = longRunTarget(state, deloadWeek)
    expect(doel.km).toBeLessThan(longRunLineKm(8))
    expect(doel.reason).toContain('Deloadweek')
  })

  it('geeft de korte lopen wat er van de week overblijft, met een ondergrens', () => {
    expect(splitWeekAround(22, 10)).toEqual({ short: 6, long: 10 })
    // krappe week: de korte lopen zakken niet door hun ondergrens van 5 km
    expect(splitWeekAround(14, 10).short).toBe(5)
  })
})

describe('de context onder de afstand', () => {
  it('zegt hoeveel procent dit is ten opzichte van je gemiddelde, en wat je langste was', () => {
    // vier duurlopen: 10, 10, 10 en 11 km → gemiddeld 10,25
    const runs = {
      ...run(addDays(WEEK5, -28 + 6), 10, { kind: 'long' }),
      ...run(addDays(WEEK5, -21 + 6), 10, { kind: 'long' }),
      ...run(addDays(WEEK5, -14 + 6), 10, { kind: 'long' }),
      ...run(addDays(WEEK5, -7 + 6), 11, { kind: 'long' }),
    }
    const state = baseState({ runs })
    expect(averageRunKm(state, WEEK5, 'long')).toBeCloseTo(10.25, 2)
    expect(longestRunKm(state, WEEK5)).toBe(11)

    const regel = runContext(state, WEEK5, 'long', 12)
    expect(regel).toContain('12 km')
    expect(regel).toContain('+17%')
    expect(regel).toContain('laatste vier weken')
    expect(regel).toContain('langste loop was 11 km')
  })

  it('vergelijkt duurlopen met duurlopen en korte lopen met korte lopen', () => {
    const state = baseState({ runs: vierWeken(WEEK5, 6, 10) })
    expect(averageRunKm(state, WEEK5, 'short')).toBeCloseTo(6, 5)
    expect(averageRunKm(state, WEEK5, 'long')).toBeCloseTo(10, 5)
  })

  it('zegt het gewoon als er nog niets te vergelijken valt', () => {
    const regel = runContext(baseState(), MON, 'long', 12)
    expect(regel).toContain('12 km')
    expect(regel).toContain('om mee te vergelijken')
  })

  it('staat onder de loop van vandaag', () => {
    const state = baseState({ runs: vierWeken(WEEK5, 6, 10) })
    const plan = buildDay(state, addDays(WEEK5, 6))
    expect(plan.run?.kind).toBe('long')
    expect(plan.run?.context).toContain('km')
  })
})

describe('de afstand is van de gebruiker', () => {
  it('neemt een zelf ingevulde afstand over zonder aftoppen', () => {
    // vorige weken mager gelopen, dus het oude plafond zou dit hebben teruggeschroefd
    const state = baseState({ runs: { ...week(addDays(WEEK5, -7), 3, 5) }, runPlans: { [addDays(WEEK5, 6)]: 12 } })
    const doel = plannedRunKm(state, addDays(WEEK5, 6), 'long')
    expect(doel.km).toBe(12)
    expect(doel.manual).toBe(true)
    expect(doel.capped).toBe(false)
  })

  it('zet er de feitelijke context bij in plaats van een blokkade', () => {
    const state = baseState({ runs: vierWeken(WEEK5, 6, 10), runPlans: { [addDays(WEEK5, 6)]: 14 } })
    const doel = plannedRunKm(state, addDays(WEEK5, 6), 'long')
    expect(doel.context).toContain('14 km')
    expect(doel.context).toContain('+40%')
  })
})

describe('het meebewegende weekplafond', () => {
  /** Een week vullen met dagchecks en benen-check-ins. */
  function signalen(
    monday: string,
    check: { sleep: DayScore; energy: DayScore },
    benen: number,
  ): Pick<UserState, 'dayChecks' | 'checkins'> {
    const dayChecks: UserState['dayChecks'] = {}
    const checkins: UserState['checkins'] = {}
    for (const d of [1, 3, 5]) {
      dayChecks[addDays(monday, d)] = check
      checkins[addDays(monday, d)] = benen
    }
    return { dayChecks, checkins }
  }

  function metSignalen(check: { sleep: DayScore; energy: DayScore }, benen: number): UserState {
    const a = signalen(addDays(WEEK5, -7), check, benen)
    const b = signalen(addDays(WEEK5, -14), check, benen)
    return baseState({
      runs: vierWeken(WEEK5, 6, 10),
      dayChecks: { ...a.dayChecks, ...b.dayChecks },
      checkins: { ...a.checkins, ...b.checkins },
    })
  }

  it('houdt de gewone stap aan als er niets ingevuld is', () => {
    const groei = weeklyGrowth(baseState({ runs: vierWeken(WEEK5, 6, 10) }), WEEK5)
    expect(groei.factor).toBe(GROWTH_STEADY)
    expect(groei.tone).toBe('normaal')
  })

  it('gaat naar +15% bij twee weken goede signalen', () => {
    const groei = weeklyGrowth(metSignalen({ sleep: 3, energy: 3 }, 5), WEEK5)
    expect(groei.factor).toBe(GROWTH_STRONG)
    expect(groei.tone).toBe('ruim')
    expect(groei.reason).toContain('+15%')
  })

  it('gaat terug naar behoudend bij slechte signalen', () => {
    const groei = weeklyGrowth(metSignalen({ sleep: 1, energy: 1 }, 1), WEEK5)
    expect(groei.factor).toBe(GROWTH_HOLD)
    expect(groei.tone).toBe('behoudend')
    expect(groei.reason).toContain('geen opbouw')
  })

  it('laat het weekplafond die stap ook echt gebruiken', () => {
    const ruim = weekLoad(metSignalen({ sleep: 3, energy: 3 }, 5), WEEK5)
    const behoudend = weekLoad(metSignalen({ sleep: 1, energy: 1 }, 1), WEEK5)
    expect(ruim.cap).toBeGreaterThan(behoudend.cap)
    expect(ruim.cap).toBeCloseTo(ruim.reference * GROWTH_STRONG, 5)
    expect(behoudend.cap).toBeCloseTo(behoudend.reference * GROWTH_HOLD, 5)
  })

  it('bouwt nooit meer dan +15% op', () => {
    const ruim = weekLoad(metSignalen({ sleep: 3, energy: 3 }, 5), WEEK5)
    expect(ruim.km).toBeLessThanOrEqual(ruim.reference * GROWTH_STRONG + 1e-9)
  })
})

describe('de rem op doorstijgen', () => {
  /** Vier weken die elke week een stukje verder gaan. */
  function oplopend(monday: string): UserState['runs'] {
    let runs: UserState['runs'] = {}
    const km = [6, 8, 10, 12]
    for (let w = 4; w >= 1; w--) runs = { ...runs, ...run(addDays(monday, -7 * w + 1), km[4 - w]) }
    return runs
  }

  it('telt de weken die op rij stegen', () => {
    const state = baseState({ runs: oplopend(WEEK5) })
    expect(risesInARow(state, WEEK5)).toBeGreaterThanOrEqual(MAX_RISES_IN_A_ROW)
  })

  it('zet het volume stil na drie stijgingen op rij', () => {
    const state = baseState({ runs: oplopend(WEEK5) })
    const groei = weeklyGrowth(state, WEEK5)
    expect(groei.factor).toBe(GROWTH_HOLD)
    expect(groei.blocking).toBe(true)
  })

  it('laat goede signalen niet over de rem heen', () => {
    const dayChecks: UserState['dayChecks'] = {}
    const checkins: UserState['checkins'] = {}
    for (const w of [7, 14]) {
      for (const d of [1, 3, 5]) {
        dayChecks[addDays(WEEK5, -w + d)] = { sleep: 3, energy: 3 }
        checkins[addDays(WEEK5, -w + d)] = 5
      }
    }
    const state = baseState({ runs: oplopend(WEEK5), dayChecks, checkins })
    expect(weeklyGrowth(state, WEEK5).factor).toBe(GROWTH_HOLD)
    expect(weeklyGrowth(state, WEEK5).blocking).toBe(true)
  })

  it('is niet weg te klikken: de melding heeft geen dismissKey', () => {
    const state = baseState({ runs: oplopend(WEEK5) })
    const rails = dayGuardrails(state, addDays(WEEK5, 1))
    const rem = rails.find((g) => g.text.includes('niet weg te klikken'))
    expect(rem).toBeTruthy()
    expect(rem!.dismissKey).toBeUndefined()
  })

  it('laat de deload gewoon staan naast de rem', () => {
    const state = baseState({ runs: oplopend(addDays(MON, 49)) })
    const load = weekLoad(state, addDays(MON, 49))
    expect(load.deload).toBe(true)
    expect(load.reasons.join(' ')).toContain('Deloadweek')
  })
})

describe('de werkelijk gelopen afstand wordt vastgelegd', () => {
  it('rekent met wat er gelopen is, niet met wat er gepland stond', () => {
    const state = baseState({ runs: run(DI, 9, { planned: 6 }) })
    expect(weekLoad(state, MON).done).toBe(9)
    expect(longestRunKm(state, MON)).toBe(9)
  })

  it('telt een gefietste sessie niet als kilometers', () => {
    const state = baseState({ runs: { ...run(DI, 6), ...run(DO, 8, { bike: true }) } })
    expect(weekLoad(state, MON).done).toBe(6)
    expect(longestRunKm(state, ZO)).toBe(6)
  })
})
