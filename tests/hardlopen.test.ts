import { beforeEach, describe, expect, it } from 'vitest'
import { buildDay, moveTargets, moveWarnings } from '../src/logic/day'
import { addDays } from '../src/logic/dates'
import { dayGuardrails } from '../src/logic/guardrails'
import {
  actualWeekKm,
  averageRunKm,
  longestRunKm,
  runContext,
  weekRunFacts,
  weeklyKm,
} from '../src/logic/runningLoad'
import * as A from '../src/store/actions'
import { getState, resetState, setState } from '../src/store/store'
import type { RunLog, UserState } from '../src/types'
import { DI, DO, MON, VR, ZA, ZO, baseState } from './helpers'

/**
 * Hardlopen: registreren en constateren, verder niets.
 *
 * De app rekende hier een weekplafond uit op een rollend gemiddelde, gaf de duurloop een
 * eigen opbouwlijn van 10 naar 15 km, remde af na drie stijgende weken en waarschuwde
 * voor zware benen vlak voor de duurloop. Dat is er allemaal uit: de loopplanning doen we
 * zelf.
 *
 * De helft van dit bestand bestaat daarom uit tests die vastleggen dat er iets *niet*
 * gebeurt. Dat is met opzet — een advies dat stilletjes terugkomt is precies het soort
 * regressie dat je pas maanden later opmerkt, als je je afvraagt waarom de app op zondag
 * ineens 11,5 km voorstelt.
 */

function run(date: string, km: number, kind: 'short' | 'long' = 'short'): RunLog {
  return {
    date,
    kind,
    plannedKm: km,
    km,
    minutes: Math.round(km * 6),
    bike: false,
    completedAt: `${date}T18:00:00.000Z`,
  }
}

/** Een staat met een paar weken gelopen kilometers erin. */
function metLopen(patch: Partial<UserState> = {}): UserState {
  const runs: UserState['runs'] = {}
  for (let w = 0; w < 4; w++) {
    const mon = addDays(MON, -7 * w)
    runs[addDays(mon, 1)] = run(addDays(mon, 1), 6 + w)
    runs[addDays(mon, 6)] = run(addDays(mon, 6), 10 + w, 'long')
  }
  return baseState({ runs, ...patch })
}

describe('de app schrijft geen kilometers voor', () => {
  it('geeft geen enkele loopdag een afstand', () => {
    const state = metLopen()
    for (const iso of [DI, DO, ZO]) {
      const r = buildDay(state, iso).run!
      expect(r.plannedKm, iso).toBe(0)
      expect(r.km, iso).toBe(0)
      expect(r.free, iso).toBe(true)
    }
  })

  it('bouwt de duurloop niet op van week tot week', () => {
    const state = metLopen()
    // acht weken vooruit: er verandert niets, want er is niets dat opbouwt
    for (let w = 0; w < 8; w++) {
      expect(buildDay(state, addDays(ZO, 7 * w)).run!.plannedKm, `week ${w}`).toBe(0)
    }
  })

  it('remt niet af na weken waarin er meer gelopen is', () => {
    // drie weken op rij meer: dat was precies wat de rem liet vuren
    const runs: UserState['runs'] = {}
    for (const [w, km] of [20, 24, 28, 32].entries()) {
      const mon = addDays(MON, -7 * (3 - w))
      runs[addDays(mon, 1)] = run(addDays(mon, 1), km / 2)
      runs[addDays(mon, 6)] = run(addDays(mon, 6), km / 2, 'long')
    }
    const state = baseState({ runs })
    expect(buildDay(state, ZO).run!.plannedKm).toBe(0)
    expect(dayGuardrails(state, ZO)).toEqual([])
  })

  it('kort de loop niet in bij een lage check-in', () => {
    const state = baseState({ checkins: { [DI]: 1 }, runPlans: { [DI]: 8 } })
    expect(buildDay(state, DI).run!.km).toBe(8)
  })

  it('haalt in een deloadweek geen kilometers weg', () => {
    const deloadZondag = addDays(ZO, 49)
    const state = baseState({ runPlans: { [ZO]: 12, [deloadZondag]: 12 } })
    expect(buildDay(state, deloadZondag).deload.active).toBe(true)
    expect(buildDay(state, deloadZondag).run!.km).toBe(12)
  })

  it('zegt niets over zware benen vlak voor de duurloop', () => {
    // benen A naar zaterdag, één dag voor de duurloop van zondag: vroeger een waarschuwing
    const state = baseState({ moves: { [MON]: ZA } })
    for (const iso of [ZA, ZO]) {
      const teksten = dayGuardrails(state, iso).map((g) => g.text).join(' ')
      expect(teksten, iso).not.toContain('duurloop')
    }
    expect(moveTargets(baseState(), MON).find((t) => t.date === ZA)!.warnings.join(' ')).not.toContain(
      'duurloop',
    )
  })

  it('waarschuwt nergens over een week die er een loop bij krijgt', () => {
    expect(moveWarnings(metLopen(), ZO, addDays(ZO, 4), 'run')).toEqual([])
  })

  it('laat geen enkele guardrail meer over hardlopen gaan', () => {
    const state = metLopen({ checkins: { [DI]: 1 } })
    for (let d = 0; d < 14; d++) {
      const iso = addDays(MON, d)
      for (const g of dayGuardrails(state, iso)) {
        expect(g.text.toLowerCase(), `${iso}: ${g.text}`).not.toMatch(
          /km|kilometer|duurloop|loopvolume|plafond/,
        )
      }
    }
  })
})

describe('registreren blijft precies zoals het was', () => {
  beforeEach(() => {
    resetState()
    setState((s) => ({ ...s, startDate: MON }))
  })

  it('houdt gepland en werkelijk apart bij het afvinken', () => {
    A.completeRun(DI, 'short', { plannedKm: 6, km: 9, minutes: 54, bike: false, feel: 'goed' })
    const log = getState().runs[DI]
    expect(log.plannedKm).toBe(6)
    expect(log.km).toBe(9)
    expect(log.minutes).toBe(54)
    expect(log.feel).toBe('goed')
  })

  it('neemt een zelfgezette afstand over, en laat hem weer los', () => {
    A.setPlannedRunKm(ZO, 16)
    expect(buildDay(getState(), ZO).run!.km).toBe(16)
    expect(buildDay(getState(), ZO).run!.manualPlan).toBe(true)

    A.clearPlannedRunKm(ZO)
    expect(buildDay(getState(), ZO).run!.free).toBe(true)
  })

  it('rondt een zelfgezette afstand op halve kilometers af', () => {
    A.setPlannedRunKm(ZO, 12.3)
    expect(getState().runPlans[ZO]).toBe(12.5)
  })

  it('laat fietsen in plaats van lopen staan', () => {
    A.setBike(DI, true)
    expect(buildDay(getState(), DI).run!.bike).toBe(true)
  })

  it('laat een loop verplaatsen', () => {
    expect(A.moveRun(ZO, VR).ok).toBe(true)
    expect(buildDay(getState(), VR).run!.kind).toBe('long')
    expect(buildDay(getState(), ZO).run).toBeNull()
  })
})

describe('constateren mag: wat er gelopen is', () => {
  it('telt de week op, inclusief losse rondjes', () => {
    const state = baseState({
      runs: { [DI]: run(DI, 6), [ZO]: run(ZO, 12, 'long') },
      activities: [
        {
          id: 'a1',
          date: DO,
          type: 'hardlopen',
          minutes: 30,
          distanceKm: 5,
          intensity: 'normaal',
          note: null,
          createdAt: `${DO}T19:00:00.000Z`,
        },
      ],
    })
    const week = weekRunFacts(state, MON)
    expect(week.km).toBe(23)
    expect(week.aantal).toBe(3)
    expect(actualWeekKm(state, MON)).toBe(23)
  })

  it('zwijgt over een week waarin niets gelopen is', () => {
    expect(weekRunFacts(baseState(), MON)).toMatchObject({ km: 0, aantal: 0 })
  })

  it('telt fietsen niet mee', () => {
    const state = baseState({
      runs: { [DI]: { ...run(DI, 0), bike: true, minutes: 30 } },
    })
    expect(weekRunFacts(state, MON).aantal).toBe(0)
  })

  it('weet de langste loop en het gemiddelde van de laatste vier weken', () => {
    const state = metLopen()
    expect(longestRunKm(state, MON)).toBe(13)
    expect(averageRunKm(state, MON, 'long')).toBe(11.5)
    expect(averageRunKm(state, MON, 'short')).toBe(7.5)
  })

  it('geeft één feitelijke regel bij een zelfgezette afstand, zonder oordeel', () => {
    const regel = runContext(metLopen(), MON, 'long', 14)
    expect(regel).toContain('14 km')
    expect(regel).toContain('+22%')
    expect(regel).toContain('je langste loop was 13 km')
    // geen voorstel, geen waarschuwing, geen "je zou moeten"
    expect(regel.toLowerCase()).not.toMatch(/richtlijn|plafond|voorstel|te veel|advies/)
  })

  it('levert de grafiek op Historie kale kilometers per week', () => {
    const weken = weeklyKm(metLopen(), MON, 4)
    expect(weken).toHaveLength(4)
    expect(weken[3].km).toBe(16) // 6 + 10 in de week van MON
    expect(weken[0].weekStart < weken[3].weekStart).toBe(true)
    expect(Object.keys(weken[0]).sort()).toEqual(['deload', 'km', 'week', 'weekStart'])
  })
})
