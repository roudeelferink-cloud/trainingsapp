import { beforeEach, describe, expect, it } from 'vitest'
import { buildDay } from '../src/logic/day'
import { addDays } from '../src/logic/dates'
import { deloadFor } from '../src/logic/deload'
import { heavyCountBefore, weekIsPoor } from '../src/logic/feel'
import { plannedRunKm } from '../src/logic/runningLoad'
import * as A from '../src/store/actions'
import { getState, resetState, setState } from '../src/store/store'
import { DI, DO, MON, VR, ZO } from './helpers'

beforeEach(() => {
  resetState()
  // buiten de kalibratieweken, zodat de progressie echt iets doet
  setState((s) => ({ ...s, startDate: addDays(MON, -14) }))
})

/** De eerste oefening van de sessie van die dag, met één afgevinkte set. */
function sessieVan(iso: string) {
  const strength = buildDay(getState(), iso).strength!
  const slot = strength.slots[0]
  return { kind: strength.kind, slot, key: slot.slot.key }
}

describe('beoordeling per sessie', () => {
  it('slaat de beoordeling op bij de sessie', () => {
    const { kind, slot, key } = sessieVan(MON)
    A.completeSession(MON, kind, [slot], { [key]: [{ weight: 100, reps: slot.repMax, rir: 2, done: true }] }, false, [key], 'goed')

    expect(getState().sessions[`${MON}:${kind}`].feel).toBe('goed')
  })

  it('laat een zware sessie het gewicht niet verhogen', () => {
    const { kind, slot, key } = sessieVan(MON)
    const sets = [{ weight: 100, reps: slot.repMax, rir: 0, done: true }]

    A.completeSession(MON, kind, [slot], { [key]: sets }, false, [key], 'zwaar')
    expect(getState().exerciseState[slot.exercise.id].targetWeight).toBe(100)
  })

  it('verhoogt na dezelfde sessie als die goed voelde', () => {
    const { kind, slot, key } = sessieVan(MON)
    const sets = [{ weight: 100, reps: slot.repMax, rir: 0, done: true }]

    A.completeSession(MON, kind, [slot], { [key]: sets }, false, [key], 'goed')
    expect(getState().exerciseState[slot.exercise.id].targetWeight).toBeGreaterThan(100)
  })

  it('is achteraf bij te stellen', () => {
    const { kind, slot, key } = sessieVan(MON)
    A.completeSession(MON, kind, [slot], { [key]: [{ weight: 100, reps: 8, rir: 2, done: true }] }, false, [key], 'goed')
    A.setSessionFeel(MON, kind, 'zwaar')
    expect(getState().sessions[`${MON}:${kind}`].feel).toBe('zwaar')
  })

  it('telt zware sessies van kracht en loop bij elkaar op', () => {
    const { kind, slot, key } = sessieVan(MON)
    A.completeSession(MON, kind, [slot], { [key]: [{ weight: 100, reps: 8, rir: 2, done: true }] }, false, [key], 'zwaar')
    A.completeRun(DI, 'short', { plannedKm: 6, km: 6, minutes: 36, bike: false, feel: 'zwaar' })
    A.completeRun(DO, 'short', { plannedKm: 6, km: 6, minutes: 36, bike: false, feel: 'zwaar' })

    expect(heavyCountBefore(getState(), VR, 14)).toBe(3)
    expect(deloadFor(getState(), addDays(MON, 7)).reason).toBe('zwaar')
  })
})

describe('dagcheck', () => {
  it('is optioneel en per dag te wissen', () => {
    A.setDayCheck(MON, { sleep: 1, energy: 1 })
    expect(getState().dayChecks[MON]).toEqual({ sleep: 1, energy: 1 })

    A.clearDayCheck(MON)
    expect(getState().dayChecks[MON]).toBeUndefined()
  })

  it('laat slaap en energie los van elkaar zetten', () => {
    A.setDayCheckPart(MON, 'sleep', 3)
    expect(getState().dayChecks[MON]).toEqual({ sleep: 3, energy: 2 })
    A.setDayCheckPart(MON, 'energy', 1)
    expect(getState().dayChecks[MON]).toEqual({ sleep: 3, energy: 1 })
  })

  it('maakt van twee slechte dagen een slechte week', () => {
    A.setDayCheck(MON, { sleep: 1, energy: 1 })
    A.setDayCheck(DI, { sleep: 1, energy: 2 })
    expect(weekIsPoor(getState(), MON)).toBe(true)
  })
})

describe('geplande loopafstand', () => {
  it('is per gebruiker met de hand te zetten en weer los te laten', () => {
    A.setPlannedRunKm(ZO, 'long', 14)
    expect(buildDay(getState(), ZO).run!.plannedKm).toBe(14)
    expect(buildDay(getState(), ZO).run!.manualPlan).toBe(true)

    A.clearPlannedRunKm(ZO)
    expect(buildDay(getState(), ZO).run!.manualPlan).toBe(false)
  })

  it('legt de afwijking van het voorstel vast', () => {
    const voorstel = plannedRunKm(getState(), ZO, 'long').km
    A.setPlannedRunKm(ZO, 'long', voorstel + 4)

    const afwijking = getState().deviations.at(-1)!
    expect(afwijking.kind).toBe('run_plan')
    expect(afwijking.suggested).toBe(voorstel)
    expect(afwijking.chosen).toBe(voorstel + 4)
  })

  it('legt niets vast als je precies het voorstel kiest', () => {
    const voorstel = plannedRunKm(getState(), ZO, 'long').km
    A.setPlannedRunKm(ZO, 'long', voorstel)
    expect(getState().deviations).toHaveLength(0)
  })
})

describe('loop afvinken', () => {
  it('bewaart gepland en werkelijk apart', () => {
    A.completeRun(DI, 'short', { plannedKm: 6, km: 9, minutes: 54, bike: false, feel: 'goed' })
    const log = getState().runs[DI]
    expect(log.plannedKm).toBe(6)
    expect(log.km).toBe(9)
    expect(log.feel).toBe('goed')
  })

  it('legt vast dat er verder gelopen is dan gepland', () => {
    A.completeRun(DI, 'short', { plannedKm: 6, km: 9, minutes: 54, bike: false })
    const afwijking = getState().deviations.at(-1)!
    expect(afwijking.kind).toBe('run_distance')
    expect(afwijking.note).toContain('verder')
  })

  it('zwijgt bij een halve kilometer verschil', () => {
    A.completeRun(DI, 'short', { plannedKm: 6, km: 6.4, minutes: 38, bike: false })
    expect(getState().deviations).toHaveLength(0)
  })
})

describe('zwaarder tillen dan voorgesteld', () => {
  it('wordt vastgelegd, maar niet tegengehouden', () => {
    const { kind, slot, key } = sessieVan(MON)
    setState((s) => ({
      ...s,
      exerciseState: {
        ...s.exerciseState,
        [slot.exercise.id]: {
          targetWeight: 80,
          targetReps: 8,
          belowMinStreak: 0,
          lastNote: null,
          lastUpdated: null,
        },
      },
    }))

    A.completeSession(MON, kind, [slot], { [key]: [{ weight: 95, reps: 8, rir: 2, done: true }] }, false, [key], 'goed')

    const afwijking = getState().deviations.at(-1)!
    expect(afwijking.kind).toBe('lift_weight')
    expect(afwijking.suggested).toBe(80)
    expect(afwijking.chosen).toBe(95)
    // en wat er getild is, is het nieuwe uitgangspunt
    expect(getState().exerciseState[slot.exercise.id].targetWeight).toBeGreaterThanOrEqual(95)
  })
})

describe('deload overslaan', () => {
  const week8 = addDays(MON, -14 + 49)

  it('lukt alleen met een expliciete bevestiging', () => {
    expect(A.skipDeload(week8, false).ok).toBe(false)
    expect(deloadFor(getState(), week8).active).toBe(true)

    expect(A.skipDeload(week8, true).ok).toBe(true)
    expect(deloadFor(getState(), week8).active).toBe(false)
  })

  it('bewaart de tekst die bevestigd is en legt de afwijking vast', () => {
    A.skipDeload(week8, true)
    const skip = Object.values(getState().deloadSkips)[0]
    expect(skip.acknowledged).toContain('blessure')
    expect(getState().deviations.at(-1)!.kind).toBe('deload_skip')
  })

  it('is terug te draaien', () => {
    A.skipDeload(week8, true)
    A.undoSkipDeload(week8)
    expect(deloadFor(getState(), week8).active).toBe(true)
  })

  it('doet niets in een week zonder deload', () => {
    expect(A.skipDeload(MON, true).ok).toBe(false)
  })
})

describe('structurele melding wegklikken', () => {
  it('legt vast wanneer je hem wegklikte en houdt hem dan stil', () => {
    A.dismissWarning('benen-duurloop:6-7:full_body_b:hoog', MON)
    expect(getState().dismissedWarnings['benen-duurloop:6-7:full_body_b:hoog']).toBe(MON)

    A.undismissWarning('benen-duurloop:6-7:full_body_b:hoog')
    expect(getState().dismissedWarnings).toEqual({})
  })

  it('negeert een lege sleutel', () => {
    A.dismissWarning('', MON)
    expect(getState().dismissedWarnings).toEqual({})
  })

  it('haalt de melding van het scherm en laat hem na vier weken terugkomen', () => {
    // benen B staat elke week 48 uur voor de duurloop: dat is een patroon, geen incident
    const dag = [MON, DI, DO, VR, ZO].find((iso) =>
      buildDay(getState(), iso).guardrails.some((g) => g.dismissKey),
    )
    expect(dag).toBeTruthy()

    const melding = buildDay(getState(), dag!).guardrails.find((g) => g.dismissKey)!
    expect(melding.move).toBeTruthy()

    A.dismissWarning(melding.dismissKey!, dag!)
    expect(buildDay(getState(), dag!).guardrails.some((g) => g.id === melding.id)).toBe(false)

    // en vier weken later staat hij er weer
    const later = addDays(dag!, 28)
    expect(buildDay(getState(), later).guardrails.some((g) => g.dismissKey)).toBe(true)
  })
})
