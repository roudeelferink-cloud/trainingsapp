import { beforeEach, describe, expect, it } from 'vitest'
import { BY_ID, EXERCISES, getExercise } from '../src/data/exercises'
import { TEMPLATES } from '../src/data/plan'
import {
  BAND_LEVELS,
  MAX_BAND_LEVEL,
  MIN_BAND_LEVEL,
  bandLabel,
  isBandExercise,
  levelOf,
} from '../src/logic/band'
import { buildDay } from '../src/logic/day'
import { setVolumeKg } from '../src/logic/dumbbell'
import { weightInputLabel, loadHint } from '../src/logic/load'
import { applyProgression, emptyExerciseState, targetFor } from '../src/logic/progression'
import { isTravelSafe, resolveSlot } from '../src/logic/select'
import { seedSets } from '../src/logic/sessionFlow'
import { oneRmSeries } from '../src/logic/stats'
import { startWeightAdvice } from '../src/logic/startWeight'
import type { ExerciseState, LoggedSet, UserState } from '../src/types'
import { MON, baseState } from './helpers'

const BOUNDS = { repMin: 15, repMax: 20 }
const CEILING = BOUNDS.repMax + 2

let state: UserState

beforeEach(() => {
  state = baseState()
})

function sets(level: number, reps: number, rir = 1): LoggedSet[] {
  return Array.from({ length: 3 }, () => ({ weight: 0, level, reps, rir, done: true }))
}

function na(prev: ExerciseState, id: string, s: LoggedSet[], allowIncrease = true): ExerciseState {
  return applyProgression(getExercise(id), BOUNDS, s, prev, { allowIncrease }).next
}

describe('nieuw materiaal in de bibliotheek', () => {
  it('kent mini-band en enkelmanchet als equipment', () => {
    const mini = EXERCISES.filter((e) => e.equipment.includes('mini_band'))
    const manchet = EXERCISES.filter((e) => e.equipment.includes('ankle_strap'))

    expect(mini.length).toBeGreaterThanOrEqual(6)
    expect(manchet.map((e) => e.id)).toEqual(['cable_hip_abduction'])
    // de enkelmanchet hangt aan de lage kabel, anders is er niets om aan te haken
    expect(getExercise('cable_hip_abduction').equipment).toContain('low_cable')
  })

  it('heeft de vier heupabductie-oefeningen met de juiste tags', () => {
    const ids = [
      'clamshell',
      'side_lying_abduction_band',
      'monster_walk',
      'band_lateral_walk',
      'cable_hip_abduction',
    ]
    for (const id of ids) {
      const ex = getExercise(id)
      expect(ex.pattern, id).toBe('abduction')
      expect(ex.loads, id).toContain('lateral_hip')
      expect(ex.coaching.setup.length, id).toBeGreaterThan(20)
      expect(ex.coaching.execution.length, id).toBeGreaterThanOrEqual(2)
      expect(ex.coaching.mistake.length, id).toBeGreaterThan(15)
    }
  })

  it('koppelt ze als alternatieven binnen hetzelfde pattern', () => {
    const pool = EXERCISES.filter((e) => e.pattern === 'abduction' && !e.group).map((e) => e.id)
    for (const id of ['clamshell', 'side_lying_abduction_band', 'monster_walk', 'cable_hip_abduction']) {
      expect(pool, id).toContain(id)
    }
  })

  it('logt al het mini-bandwerk op niveau en de kabelvariant in kilo\'s', () => {
    for (const ex of EXERCISES.filter((e) => e.equipment.includes('mini_band'))) {
      expect(isBandExercise(ex), ex.id).toBe(true)
      expect(weightInputLabel(ex, state.settings), ex.id).toBe('bandniveau')
      expect(startWeightAdvice(ex, { ...state, settings: { ...state.settings, bodyweightKg: 82 } }), ex.id).toBeNull()
    }
    const kabel = getExercise('cable_hip_abduction')
    expect(isBandExercise(kabel)).toBe(false)
    expect(weightInputLabel(kabel, state.settings)).toBe('kg')
    expect(kabel.minIncrement).toBeGreaterThan(0)
  })

  it('neemt een mini-band mee op reis, een kabeltoren niet', () => {
    expect(isTravelSafe(getExercise('clamshell'))).toBe(true)
    expect(isTravelSafe(getExercise('cable_hip_abduction'))).toBe(false)
  })

  it('zet glute medius-werk in beide beensessies', () => {
    const abductie = (kind: 'legs_a' | 'legs_b') =>
      TEMPLATES[kind]!.slots.filter((s) => BY_ID[s.exerciseId].pattern === 'abduction')

    for (const kind of ['legs_a', 'legs_b'] as const) {
      const slots = abductie(kind)
      expect(slots.length, kind).toBe(2)
      // allebei beginnen ze op de band: opbouwen vanaf de laagste weerstand
      for (const s of slots) expect(BY_ID[s.exerciseId].unit, s.key).toBe('band')
    }
    expect(abductie('legs_a').map((s) => s.exerciseId)).toEqual(['band_lateral_walk', 'clamshell'])
    expect(abductie('legs_b').map((s) => s.exerciseId)).toEqual([
      'band_hip_abduction_seated',
      'side_lying_abduction_band',
    ])
  })
})

describe('bandwerk logt op niveau, niet op kilo\'s', () => {
  const clamshell = () => getExercise('clamshell')

  it('vult sets voor met een niveau en zonder gewicht', () => {
    const target = targetFor(clamshell(), BOUNDS.repMin, state, { calibration: false, deload: false })
    expect(target.level).toBe(MIN_BAND_LEVEL) // zonder historie de lichtste band
    expect(target.weight).toBeNull()

    const seeded = seedSets(3, target, null)
    expect(seeded).toHaveLength(3)
    for (const s of seeded) {
      expect(s.weight).toBe(0)
      expect(s.level).toBe(MIN_BAND_LEVEL)
      expect(s.reps).toBe(BOUNDS.repMin)
    }
  })

  it('geeft elk niveau een kleur uit de set', () => {
    expect(BAND_LEVELS).toHaveLength(MAX_BAND_LEVEL)
    expect(bandLabel(1)).toBe('niveau 1 · geel')
    expect(bandLabel(MAX_BAND_LEVEL)).toContain(`niveau ${MAX_BAND_LEVEL}`)
    // buiten de set valt terug op de randen in plaats van te crashen
    expect(levelOf({ weight: 0, reps: 10, rir: 2 })).toBe(MIN_BAND_LEVEL)
    expect(levelOf({ weight: 0, level: 99, reps: 10, rir: 2 })).toBe(MAX_BAND_LEVEL)
  })

  it('zegt in het invoerveld dat er geen kilo\'s aan te pas komen', () => {
    expect(weightInputLabel(clamshell(), state.settings)).toBe('bandniveau')
    expect(loadHint(clamshell(), state.settings)).toContain("Geen kilo's")
  })

  it('telt niet mee in het tilvolume', () => {
    const set = { weight: 0, level: 3, reps: 20, rir: 1, done: true }
    expect(setVolumeKg(clamshell(), set)).toBe(0)
    // ook niet als er ooit een getal in het gewichtsveld is beland
    expect(setVolumeKg(clamshell(), { ...set, weight: 12 })).toBe(0)
    // en de kabelvariant telt gewoon wel
    expect(setVolumeKg(getExercise('cable_hip_abduction'), { weight: 5, reps: 20, rir: 1 })).toBeGreaterThan(0)
  })

  it('vervuilt de 1RM-grafiek niet, ook niet met oude gelogde kilo\'s', () => {
    const log = {
      date: MON,
      kind: 'legs_a' as const,
      short: false,
      completedAt: 'x',
      skippedSlots: [],
      completedSlots: [],
      exercises: { 'legs_a:5': 'band_lateral_walk', 'legs_a:0': 'leg_press' },
      entries: {
        'legs_a:5': [{ weight: 12, level: 2, reps: 20, rir: 1, done: true }],
        'legs_a:0': [{ weight: 100, reps: 10, rir: 1, done: true }],
      },
    }
    const series = oneRmSeries({ ...state, sessions: { [`${MON}:legs_a`]: log } })
    expect(series.map((s) => s.exerciseId)).toEqual(['leg_press'])
  })
})

describe('progressie op bandniveau', () => {
  it('bouwt eerst reps op, daarna pas een zwaardere band', () => {
    let es = emptyExerciseState()

    es = na(es, 'clamshell', sets(1, BOUNDS.repMin))
    expect(es.targetLevel).toBe(1)
    expect(es.targetWeight).toBeNull() // nooit kilo's
    expect(es.targetReps).toBe(BOUNDS.repMin + 1)

    // door tot het repsplafond
    let reps = es.targetReps!
    while (reps < CEILING) {
      es = na(es, 'clamshell', sets(1, reps))
      reps = es.targetReps!
    }
    expect(es.targetLevel).toBe(1)
    expect(es.targetReps).toBe(CEILING)

    // plafond gehaald: volgende band, reps terug naar de ondergrens
    const res = applyProgression(getExercise('clamshell'), BOUNDS, sets(1, CEILING), es, {
      allowIncrease: true,
    })
    expect(res.next.targetLevel).toBe(2)
    expect(res.next.targetReps).toBe(BOUNDS.repMin)
    expect(res.message).toContain('niveau 2')
  })

  it('stapt niet omhoog als de sets nog niet dicht bij falen zaten', () => {
    // RIR 4: er zat nog veel in het vat, dus het aantal reps telt niet als geslaagd
    const res = applyProgression(
      getExercise('clamshell'),
      BOUNDS,
      sets(2, CEILING, 4),
      { ...emptyExerciseState(), targetLevel: 2, targetReps: CEILING },
      { allowIncrease: true },
    )
    expect(res.next.targetLevel).toBe(2)
    expect(res.next.targetReps).toBeLessThanOrEqual(CEILING)
    expect(res.message).toBeNull()
  })

  it('gaat een band terug na twee sessies onder de ondergrens', () => {
    let es: ExerciseState = { ...emptyExerciseState(), targetLevel: 3, targetReps: BOUNDS.repMin }
    es = na(es, 'clamshell', sets(3, BOUNDS.repMin - 4))
    expect(es.belowMinStreak).toBe(1)
    expect(es.targetLevel).toBe(3)

    const res = applyProgression(getExercise('clamshell'), BOUNDS, sets(3, BOUNDS.repMin - 4), es, {
      allowIncrease: true,
    })
    expect(res.next.targetLevel).toBe(2)
    expect(res.message).toContain('terug naar niveau 2')
  })

  it('zakt een band in een deloadweek en blijft op de lichtste staan', () => {
    const met = (level: number) => ({
      ...state,
      exerciseState: { clamshell: { ...emptyExerciseState(), targetLevel: level, targetReps: 18 } },
    })
    const deload = { calibration: false, deload: true }
    expect(targetFor(getExercise('clamshell'), BOUNDS.repMin, met(3), deload).level).toBe(2)
    expect(targetFor(getExercise('clamshell'), BOUNDS.repMin, met(1), deload).level).toBe(1)
  })

  it('verhoogt niets bij check-in 3', () => {
    const es = { ...emptyExerciseState(), targetLevel: 2, targetReps: CEILING }
    const res = applyProgression(getExercise('clamshell'), BOUNDS, sets(2, CEILING), es, {
      allowIncrease: false,
    })
    expect(res.next.targetLevel).toBe(2)
    expect(res.next.lastNote).toContain('geen zwaardere band')
  })
})

describe('doorschakelen naar de kabelvariant', () => {
  const topBand = sets(MAX_BAND_LEVEL, CEILING)

  function opDeZwaarsteBand(id: string) {
    const es = { ...emptyExerciseState(), targetLevel: MAX_BAND_LEVEL, targetReps: CEILING }
    return applyProgression(getExercise(id), BOUNDS, topBand, es, { allowIncrease: true })
  }

  it('groeit door zodra de zwaarste band op het repsplafond zit', () => {
    const res = opDeZwaarsteBand('band_lateral_walk')
    expect(res.next.graduatedTo).toBe('cable_hip_abduction')
    expect(res.next.targetReps).toBe(BOUNDS.repMin)
    expect(res.message).toContain('Staande heupabductie kabel')
  })

  it('laat vloeractivatie staan: die heeft geen belaste variant', () => {
    expect(getExercise('clamshell').progressesTo).toBeUndefined()
    const res = opDeZwaarsteBand('clamshell')
    expect(res.next.graduatedTo).toBeFalsy()
    expect(res.next.targetLevel).toBe(MAX_BAND_LEVEL)
  })

  it('zet de kabelvariant daarna in de sessie', () => {
    const gegroeid: UserState = {
      ...state,
      exerciseState: {
        band_lateral_walk: {
          ...emptyExerciseState(),
          targetLevel: MAX_BAND_LEVEL,
          graduatedTo: 'cable_hip_abduction',
        },
      },
    }
    const slot = TEMPLATES.legs_a!.slots[5]
    const r = resolveSlot(slot, gegroeid, MON, 0)
    expect(r.exercise.id).toBe('cable_hip_abduction')
    expect(r.reasons).toContain('doorgegroeid')

    // en in de hele dag komt hij maar één keer voor
    const ids = buildDay(gegroeid, MON).strength!.slots.map((x) => x.exercise.id)
    expect(ids.filter((id) => id === 'cable_hip_abduction')).toHaveLength(1)
    expect(ids).toContain('clamshell')
  })

  it('houdt twee doorgegroeide bandslots uit elkaar binnen één sessie', () => {
    const beide: UserState = {
      ...state,
      exerciseState: {
        band_lateral_walk: { ...emptyExerciseState(), graduatedTo: 'cable_hip_abduction' },
        clamshell: { ...emptyExerciseState(), graduatedTo: 'cable_hip_abduction' },
      },
    }
    const ids = buildDay(beide, MON).strength!.slots.map((x) => x.exercise.id)
    expect(ids.filter((id) => id === 'cable_hip_abduction')).toHaveLength(1)
    // het tweede slot blijft gewoon op de band staan
    expect(ids).toContain('clamshell')
  })

  it('blijft in reismodus op de band: een kabeltoren gaat niet mee', () => {
    const opReis: UserState = {
      ...state,
      settings: { ...state.settings, travelMode: true },
      exerciseState: {
        band_lateral_walk: { ...emptyExerciseState(), graduatedTo: 'cable_hip_abduction' },
      },
    }
    const r = resolveSlot(TEMPLATES.legs_a!.slots[5], opReis, MON, 0)
    expect(r.exercise.id).toBe('band_lateral_walk')
    expect(r.reasons).not.toContain('doorgegroeid')
  })

  it('respecteert een keuze voor vandaag', () => {
    const vandaag: UserState = {
      ...state,
      overrides: { [MON]: { swaps: { 'legs_a:5': 'monster_walk' } } },
      exerciseState: {
        monster_walk: { ...emptyExerciseState(), graduatedTo: 'cable_hip_abduction' },
      },
    }
    const r = resolveSlot(TEMPLATES.legs_a!.slots[5], vandaag, MON, 0)
    expect(r.exercise.id).toBe('monster_walk')
  })
})
