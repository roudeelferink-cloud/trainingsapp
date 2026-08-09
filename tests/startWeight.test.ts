import { beforeEach, describe, expect, it } from 'vitest'
import { EXERCISES, getExercise } from '../src/data/exercises'
import { emptyExerciseState } from '../src/logic/progression'
import { hasLoggedHistory, startWeightAdvice } from '../src/logic/startWeight'
import * as A from '../src/store/actions'
import { getState, resetState, setState } from '../src/store/store'
import type { UserState, ExerciseState } from '../src/types'
import { MON, baseState } from './helpers'

const legPress = getExercise('leg_press') // anker: stap 1,25 · factor 0,5 · geen verwijzing
const slLegPress = getExercise('single_leg_press') // verwijst naar leg_press ×0,5
const dbPress = getExercise('db_shoulder_press') // stap 2,5 · factor 0,16
const squatBw = getExercise('squat_bw') // lichaamsgewicht

function withWeight(kg: number | null, patch: Partial<UserState> = {}): UserState {
  const s = baseState(patch)
  return { ...s, settings: { ...s.settings, bodyweightKg: kg } }
}

function logged(weight: number): ExerciseState {
  return { ...emptyExerciseState(), targetWeight: weight, targetReps: 8, lastUpdated: 'x' }
}

describe('data voor het startgewicht', () => {
  it('geeft elke oefening een startFactor', () => {
    for (const ex of EXERCISES) {
      expect(typeof ex.startFactor, ex.id).toBe('number')
      expect(ex.startFactor, ex.id).toBeGreaterThanOrEqual(0)
    }
  })

  it('geeft elke oefening met extern gewicht een verhouding of een eigen factor', () => {
    for (const ex of EXERCISES.filter((e) => e.unit !== 'bw' && e.unit !== 'band')) {
      expect(ex.startFactor, `${ex.id} heeft geen bruikbaar startpunt`).toBeGreaterThan(0)
    }
  })

  it('verwijst alleen naar oefeningen die bestaan', () => {
    for (const ex of EXERCISES) {
      if (!ex.relatedRatio) continue
      const rel = EXERCISES.find((e) => e.id === ex.relatedRatio!.exerciseId)
      expect(rel, `${ex.id} verwijst naar onbekende oefening`).toBeDefined()
      expect(ex.relatedRatio.ratio, ex.id).toBeGreaterThan(0)
    }
  })

  it('bevat geen kringetjes in de verwijzingen', () => {
    const byId = new Map(EXERCISES.map((e) => [e.id, e]))
    for (const start of EXERCISES) {
      const gezien = new Set<string>([start.id])
      let huidig = start
      while (huidig.relatedRatio) {
        const volgende = byId.get(huidig.relatedRatio.exerciseId)
        if (!volgende) break
        expect(
          gezien.has(volgende.id),
          `kringetje vanaf ${start.id}: ${[...gezien, volgende.id].join(' -> ')}`,
        ).toBe(false)
        gezien.add(volgende.id)
        huidig = volgende
      }
    }
  })

  it('verwijst nooit naar zichzelf', () => {
    for (const ex of EXERCISES) {
      if (ex.relatedRatio) expect(ex.relatedRatio.exerciseId, ex.id).not.toBe(ex.id)
    }
  })

  it('koppelt eenbenige leg press aan de gewone leg press, niet aan dumbbellwerk', () => {
    expect(slLegPress.relatedRatio).toEqual({ exerciseId: 'leg_press', ratio: 0.5 })
  })

  it('laat elke keten uitkomen bij een anker zonder verwijzing', () => {
    const byId = new Map(EXERCISES.map((e) => [e.id, e]))
    const ankers = new Set<string>()
    for (const start of EXERCISES.filter((e) => e.startFactor > 0)) {
      let huidig = start
      for (let i = 0; i < 20 && huidig.relatedRatio; i++) {
        huidig = byId.get(huidig.relatedRatio.exerciseId)!
      }
      expect(huidig.relatedRatio, `${start.id} eindigt niet bij een anker`).toBeUndefined()
      expect(huidig.startFactor, `anker ${huidig.id} heeft geen eigen startpunt`).toBeGreaterThan(0)
      ankers.add(huidig.id)
    }
    // één anker per soort weerstand
    expect([...ankers].sort()).toEqual([
      'curl_bar_curl',
      'flat_db_press',
      'goblet_squat_kb',
      'lat_pulldown',
      'leg_press',
      'rdl_barbell',
      'sandbag_squat',
      'smith_squat',
    ])
  })

  it('houdt de factoren aan de lage kant', () => {
    for (const ex of EXERCISES) {
      expect(ex.startFactor, `${ex.id} is te agressief`).toBeLessThanOrEqual(0.8)
    }
  })
})

describe('advies zonder eerdere data', () => {
  it('geeft geen advies zonder lichaamsgewicht', () => {
    expect(startWeightAdvice(legPress, withWeight(null))).toBeNull()
  })

  it('rekent met lichaamsgewicht × startFactor', () => {
    const advies = startWeightAdvice(legPress, withWeight(82))
    expect(advies).not.toBeNull()
    expect(advies!.source).toBe('bodyweight')
    // 82 × 0,5 = 41, naar beneden op de stap van 1,25 -> 40
    expect(advies!.weight).toBe(40)
  })

  it('rondt naar beneden af op de kleinste stap van dat apparaat', () => {
    // 85 × 0,5 = 42,5 -> stap 1,25 laat 42,5 staan
    expect(startWeightAdvice(legPress, withWeight(85))!.weight).toBe(42.5)
    // 83 × 0,5 = 41,5 -> naar beneden naar 41,25
    expect(startWeightAdvice(legPress, withWeight(83))!.weight).toBe(41.25)
    // dumbbells: 82 × 0,16 = 13,12 -> naar beneden naar 12,5
    expect(startWeightAdvice(dbPress, withWeight(82))!.weight).toBe(12.5)
  })

  it('adviseert niets voor lichaamsgewicht- en bandoefeningen', () => {
    expect(startWeightAdvice(squatBw, withWeight(82))).toBeNull()
    expect(startWeightAdvice(getExercise('band_curl'), withWeight(82))).toBeNull()
  })

  it('valt terug op het lichaamsgewicht als de verwante oefening nog leeg is', () => {
    const advies = startWeightAdvice(legPress, withWeight(82, { exerciseState: {} }))
    expect(advies!.source).toBe('bodyweight')
  })
})

describe('advies op basis van een vergelijkbare oefening', () => {
  it('gebruikt de verhouding zodra daar data van is', () => {
    const state = withWeight(82, { exerciseState: { leg_press: logged(60) } })
    const advies = startWeightAdvice(slLegPress, state)
    expect(advies!.source).toBe('related')
    expect(advies!.relatedName).toBe('Leg press')
    // halve belasting per been: 60 × 0,5 = 30
    expect(advies!.weight).toBe(30)
  })

  it('kiest de vergelijkbare oefening boven het lichaamsgewicht', () => {
    const zonder = startWeightAdvice(slLegPress, withWeight(82))!
    const met = startWeightAdvice(slLegPress, withWeight(82, { exerciseState: { leg_press: logged(60) } }))!
    expect(zonder.source).toBe('bodyweight')
    expect(met.weight).not.toBe(zonder.weight)
  })

  it('werkt ook zonder lichaamsgewicht', () => {
    const state = withWeight(null, { exerciseState: { leg_press: logged(60) } })
    expect(startWeightAdvice(slLegPress, state)!.source).toBe('related')
  })

  it('kijkt over bewegingspatronen heen naar dezelfde soort weerstand', () => {
    // kabelabductie hangt aan de lat pulldown: allebei kabel, ander patroon
    const abductie = getExercise('cable_hip_abduction')
    expect(abductie.pattern).not.toBe(getExercise('lat_pulldown').pattern)
    const state = withWeight(82, { exerciseState: { lat_pulldown: logged(40) } })
    // 40 × 0,15 = 6, naar beneden op de stap van 1,25 -> 5
    expect(startWeightAdvice(abductie, state)!.weight).toBe(5)
  })

  it('loopt een keten van drie diep af waarin alleen het anker data heeft', () => {
    // leg_curl -> leg_extension -> leg_press (anker)
    const legCurl = getExercise('leg_curl')
    const legExt = getExercise('leg_extension')
    expect(legCurl.relatedRatio).toEqual({ exerciseId: 'leg_extension', ratio: 0.8 })
    expect(legExt.relatedRatio).toEqual({ exerciseId: 'leg_press', ratio: 0.35 })
    expect(legPress.relatedRatio).toBeUndefined()

    // alleen het anker heeft data; de tussenstap is leeg
    const state = withWeight(82, { exerciseState: { leg_press: logged(60) } })
    expect(state.exerciseState.leg_extension).toBeUndefined()

    const advies = startWeightAdvice(legCurl, state)!
    expect(advies.source).toBe('related')
    // naam van de oefening waar de data vandaan komt, niet de tussenstap
    expect(advies.relatedName).toBe('Leg press')
    // ratio's vermenigvuldigd: 60 × 0,35 × 0,8 = 16,8 -> naar beneden op 1,25 -> 16,25
    expect(advies.weight).toBe(16.25)
  })

  it('stopt bij de eerste oefening in de keten die wél data heeft', () => {
    const state = withWeight(82, {
      exerciseState: { leg_extension: logged(30), leg_press: logged(60) },
    })
    const advies = startWeightAdvice(getExercise('leg_curl'), state)!
    expect(advies.relatedName).toBe('Leg extension')
    // 30 × 0,8 = 24, naar beneden op de stap van 1,25 -> 23,75; niet via het anker
    expect(advies.weight).toBe(23.75)
  })

  it('valt pas terug op het lichaamsgewicht als de hele keten leeg is', () => {
    const advies = startWeightAdvice(getExercise('leg_curl'), withWeight(82))!
    expect(advies.source).toBe('bodyweight')
    expect(advies.weight).toBe(16.25) // 82 × 0,2 = 16,4 -> 16,25
  })

  it('rondt pas aan het eind af, niet bij elke stap', () => {
    // 60 × 0,35 = 21 en 21 × 0,8 = 16,8; tussentijds afronden zou 16,25 × 0,8 geven
    const state = withWeight(82, { exerciseState: { leg_press: logged(60) } })
    expect(startWeightAdvice(getExercise('leg_curl'), state)!.weight).toBe(16.25)
  })

  it('loopt ook een keten met dumbbells helemaal af', () => {
    // hammer_curl -> db_curl -> flat_db_press (anker): 1,1 × 0,55 = 0,605
    const state = withWeight(82, { exerciseState: { flat_db_press: logged(20) } })
    const advies = startWeightAdvice(getExercise('hammer_curl'), state)!
    expect(advies.relatedName).toBe('Bankdrukken dumbbell')
    expect(advies.weight).toBe(10) // 20 × 0,605 = 12,1 -> stap 2,5 -> 10
  })
})

describe('advies verdwijnt na de eerste gelogde set', () => {
  it('herkent gelogde historie', () => {
    expect(hasLoggedHistory(withWeight(82), 'leg_press')).toBe(false)
    expect(hasLoggedHistory(withWeight(82, { exerciseState: { leg_press: logged(100) } }), 'leg_press')).toBe(true)
  })

  it('geeft geen advies meer zodra er iets gelogd is', () => {
    const state = withWeight(82, { exerciseState: { leg_press: logged(100) } })
    expect(startWeightAdvice(legPress, state)).toBeNull()
  })
})

describe('advies en historie in de echte store', () => {
  beforeEach(() => {
    resetState()
    setState((s) => ({ ...s, startDate: MON, settings: { ...s.settings, bodyweightKg: 82 } }))
  })

  const slot = {
    slot: { key: 'legs_a:0', exerciseId: 'leg_press', role: 'core' as const, setsReps: { sets: 3, repMin: 8, repMax: 10 } },
    exercise: legPress,
    sets: 3,
    repMin: 8,
    repMax: 10,
    reasons: [],
  }

  it('neemt een handmatig gewicht over als basis voor de volgende sessie', () => {
    expect(startWeightAdvice(legPress, getState())!.weight).toBe(40)

    // handmatig veel zwaarder gelogd dan geadviseerd
    A.completeSession(MON, 'legs_a', [slot], { 'legs_a:0': [{ weight: 70, reps: 9, rir: 2, done: true }] }, false)

    expect(getState().exerciseState.leg_press.targetWeight).toBe(70)
    expect(startWeightAdvice(legPress, getState())).toBeNull()
  })

  it('laat een nieuw lichaamsgewicht alleen nog niet gelogde adviezen veranderen', () => {
    A.completeSession(MON, 'legs_a', [slot], { 'legs_a:0': [{ weight: 70, reps: 9, rir: 2, done: true }] }, false)
    const historie = JSON.stringify(getState().sessions)

    A.setBodyweight(100)

    // gelogde oefening: streefwaarde en historie ongemoeid
    expect(getState().exerciseState.leg_press.targetWeight).toBe(70)
    expect(JSON.stringify(getState().sessions)).toBe(historie)

    // nog niet gelogde oefening: advies schuift mee (100 × 0,45 = 45)
    expect(startWeightAdvice(getExercise('rdl_barbell'), getState())!.weight).toBe(45)
  })

  it('gebruikt na een gelogde sessie de verhouding voor de vergelijkbare oefening', () => {
    // zonder data hangt het eenbenige advies nog aan het lichaamsgewicht
    expect(startWeightAdvice(slLegPress, getState())!.source).toBe('bodyweight')

    A.completeSession(MON, 'legs_a', [slot], { 'legs_a:0': [{ weight: 60, reps: 9, rir: 2, done: true }] }, false)

    const advies = startWeightAdvice(slLegPress, getState())!
    expect(advies.source).toBe('related')
    expect(advies.relatedName).toBe('Leg press')
    expect(advies.weight).toBe(30)
  })
})
