import { beforeEach, describe, expect, it } from 'vitest'
import { EXERCISES, getExercise } from '../src/data/exercises'
import {
  DUMBBELL_WEIGHTS,
  LIGHTEST_DUMBBELL,
  dumbbellAtMost,
  isBilateralDumbbell,
  isDumbbell,
  loadFactor,
  setVolumeKg,
  sideFactor,
  totalLoadKg,
} from '../src/logic/dumbbell'
import { loadHint, repsInputLabel, weightInputLabel } from '../src/logic/load'
import { startWeightAdvice } from '../src/logic/startWeight'
import { sessionVolumeKg, weeklyStrengthVolume } from '../src/logic/stats'
import { defaultState } from '../src/store/store'
import type { LoggedSet, SessionLog, UserState } from '../src/types'
import { mondayOf, today } from '../src/logic/dates'
import { MON } from './helpers'

let state: UserState

beforeEach(() => {
  state = { ...defaultState(), startDate: MON }
})

const set = (weight: number, reps: number): LoggedSet => ({ weight, reps, rir: 2, done: true })

describe('wat telt als dumbbell-werk', () => {
  it('herkent dumbbells aan de uitrusting', () => {
    expect(isDumbbell(getExercise('flat_db_press'))).toBe(true)
    expect(isDumbbell(getExercise('db_row_1arm'))).toBe(true)
    expect(isDumbbell(getExercise('leg_press'))).toBe(false)
    expect(isDumbbell(getExercise('goblet_squat_kb'))).toBe(false)
  })

  it('scheidt tweezijdig van eenzijdig werk', () => {
    // twee dumbbells tegelijk
    expect(isBilateralDumbbell(getExercise('flat_db_press'))).toBe(true)
    expect(isBilateralDumbbell(getExercise('db_shoulder_press'))).toBe(true)
    // één dumbbell, per kant uitgevoerd
    expect(isBilateralDumbbell(getExercise('db_row_1arm'))).toBe(false)
    expect(isBilateralDumbbell(getExercise('bulgarian_split_squat'))).toBe(false)
  })
})

describe('gewicht per dumbbell, reps per zijde', () => {
  it('rekent intern met beide dumbbells', () => {
    const press = getExercise('flat_db_press')
    expect(loadFactor(press)).toBe(2)
    // 2 × 12,5 kg ingevoerd als 12,5
    expect(totalLoadKg(press, 12.5)).toBe(25)
  })

  it('rekent bij eenzijdig werk met één dumbbell en twee kanten', () => {
    const row = getExercise('db_row_1arm')
    expect(loadFactor(row)).toBe(1)
    expect(sideFactor(row)).toBe(2)
    expect(totalLoadKg(row, 20)).toBe(20)
  })

  it('telt 10 links en 10 rechts als 10 reps', () => {
    const row = getExercise('db_row_1arm')
    // 10 reps ingevoerd = 10 per kant = 20 herhalingen werk met 20 kg
    expect(setVolumeKg(row, set(20, 10))).toBe(20 * 10 * 2)
  })

  it('geeft tweezijdig en eenzijdig hetzelfde volume bij hetzelfde werk', () => {
    // 12,5 kg in twee handen, 10 reps == 12,5 kg in één hand, 10 reps per kant
    expect(setVolumeKg(getExercise('flat_db_press'), set(12.5, 10))).toBe(250)
    expect(setVolumeKg(getExercise('db_row_1arm'), set(12.5, 10))).toBe(250)
  })

  it('laat niet-dumbbelloefeningen ongemoeid', () => {
    expect(setVolumeKg(getExercise('leg_press'), set(100, 10))).toBe(1000)
    // eenbenige leg press is wél per kant, dus twee kanten werk
    expect(setVolumeKg(getExercise('single_leg_press'), set(60, 10))).toBe(1200)
  })

  it('telt een lege set niet mee', () => {
    expect(setVolumeKg(getExercise('flat_db_press'), set(0, 10))).toBe(0)
    expect(setVolumeKg(getExercise('flat_db_press'), set(12.5, 0))).toBe(0)
  })
})

describe('de conventie staat ook in de UI', () => {
  it('labelt het gewichtsveld per dumbbell', () => {
    expect(weightInputLabel(getExercise('flat_db_press'), state.settings)).toBe('kg per dumbbell')
    expect(weightInputLabel(getExercise('db_row_1arm'), state.settings)).toBe('kg per dumbbell')
    // een stang toont schijven, een machine gewoon kg
    expect(weightInputLabel(getExercise('smith_squat'), state.settings)).toBe('kg schijven')
    expect(weightInputLabel(getExercise('leg_press'), state.settings)).toBe('kg')
  })

  it('zegt bij eenzijdig werk dat de reps per zijde zijn', () => {
    expect(repsInputLabel(getExercise('db_row_1arm'))).toBe('reps per zijde')
    expect(repsInputLabel(getExercise('bulgarian_split_squat'))).toBe('reps per zijde')
    expect(repsInputLabel(getExercise('flat_db_press'))).toBe('reps')
  })

  it('legt bij dumbbells uit dat het om één dumbbell gaat', () => {
    expect(loadHint(getExercise('flat_db_press'), state.settings)).toContain('één dumbbell')
    expect(loadHint(getExercise('db_row_1arm'), state.settings)).toContain('per kant')
    expect(loadHint(getExercise('leg_press'), state.settings)).toBeNull()
  })

  it('geldt voor elke dumbbell-oefening in de bibliotheek', () => {
    const dumbbells = EXERCISES.filter((e) => isDumbbell(e) && e.unit !== 'bw')
    expect(dumbbells.length).toBeGreaterThan(10)
    for (const ex of dumbbells) {
      expect(weightInputLabel(ex, state.settings), ex.id).toBe('kg per dumbbell')
      expect(loadFactor(ex) * sideFactor(ex), ex.id).toBe(2)
    }
  })
})

describe('startgewichtadvies rekent in dezelfde eenheid', () => {
  it('houdt een keten binnen dumbbells per dumbbell', () => {
    // db_curl 15 kg per hand -> hamercurl ratio 1,1 -> 16,5, afgerond omlaag op 2,5
    state.exerciseState = {
      db_curl: {
        targetWeight: 15,
        targetReps: 10,
        belowMinStreak: 0,
        lastNote: null,
        lastUpdated: 'x',
      },
    }
    const advies = startWeightAdvice(getExercise('hammer_curl'), state)!
    expect(advies.source).toBe('related')
    expect(advies.weight).toBe(15)
    // en niet het dubbele: dit is het gewicht van één dumbbell
    expect(advies.weight).toBeLessThan(20)
  })

  it('adviseert per dumbbell op basis van lichaamsgewicht', () => {
    state.settings = { ...state.settings, bodyweightKg: 82 }
    const advies = startWeightAdvice(getExercise('flat_db_press'), state)!
    // 82 × 0,18 = 14,76 -> 12,5 per dumbbell; als totaal zou dat 25 kg zijn
    expect(advies.weight).toBe(12.5)
  })
})

describe('tilvolume per week', () => {
  const log = (date: string, exerciseId: string, sets: LoggedSet[]): SessionLog => ({
    date,
    kind: 'push',
    completedAt: `${date}T18:00:00.000Z`,
    short: false,
    entries: { 'push:0': sets },
    exercises: { 'push:0': exerciseId },
    skippedSlots: [],
    completedSlots: ['push:0'],
  })

  it('telt beide dumbbells mee in het volume van een sessie', () => {
    const zwaar = log(MON, 'flat_db_press', [set(12.5, 10), set(12.5, 8)])
    expect(sessionVolumeKg(zwaar)).toBe(12.5 * 2 * 18)
  })

  it('vat het volume samen in de week waarin de sessie viel', () => {
    const deze = mondayOf(today())
    state.sessions = { a: log(deze, 'flat_db_press', [set(12.5, 10)]) }

    const weken = weeklyStrengthVolume(state, 12)
    expect(weken[weken.length - 1].kg).toBe(250)
    expect(weken.slice(0, -1).every((w) => w.kg === 0)).toBe(true)
  })

  it('telt een niet-afgeronde sessie niet mee', () => {
    const deze = mondayOf(today())
    const concept = { ...log(deze, 'flat_db_press', [set(12.5, 10)]), completedAt: null }
    state.sessions = { a: concept }
    expect(weeklyStrengthVolume(state, 12).every((w) => w.kg === 0)).toBe(true)
  })
})

describe('het dumbbellrek, inclusief de nieuwe 5 kg', () => {
  it('kent de gewichten die er echt liggen, oplopend', () => {
    expect(DUMBBELL_WEIGHTS).toEqual([5, 12.5, 15, 17.5, 20])
    expect(LIGHTEST_DUMBBELL).toBe(5)
    expect([...DUMBBELL_WEIGHTS].sort((a, b) => a - b)).toEqual(DUMBBELL_WEIGHTS)
  })

  it('kiest de zwaarste dumbbell die niet boven de schatting uitkomt', () => {
    expect(dumbbellAtMost(20)).toBe(20)
    expect(dumbbellAtMost(19.9)).toBe(17.5)
    expect(dumbbellAtMost(12.5)).toBe(12.5)
    // de nieuwe stap: alles tussen 5 en 12,5 landt nu op 5 in plaats van nergens
    expect(dumbbellAtMost(9)).toBe(5)
    expect(dumbbellAtMost(5)).toBe(5)
    // lichter dan het lichtste bestaat niet
    expect(dumbbellAtMost(4.9)).toBeNull()
  })

  it('adviseert alleen gewichten die in het rek liggen', () => {
    state.settings = { ...state.settings, bodyweightKg: 82 }
    for (const ex of EXERCISES.filter((e) => isDumbbell(e) && e.unit !== 'bw')) {
      const advies = startWeightAdvice(ex, state)
      if (!advies) continue
      expect(DUMBBELL_WEIGHTS, `${ex.id}: ${advies.weight}`).toContain(advies.weight)
    }
  })

  it('geeft de tweede gebruiker de 5 kg-stap voor licht isolatiewerk', () => {
    // Anouc start bewust lichter (startScale 0,7); zonder 5 kg was er hier geen advies
    const licht = startWeightAdvice(
      getExercise('lateral_raise_db'),
      { ...state, settings: { ...state.settings, bodyweightKg: 62 } },
      0.7,
    )
    expect(licht).not.toBeNull()
    expect(licht!.weight).toBe(5)
  })

  it('geeft geen advies als zelfs de lichtste dumbbell te zwaar is', () => {
    const state40 = { ...state, settings: { ...state.settings, bodyweightKg: 40 } }
    // 40 × 0,16 × 0,7 = 4,5 kg: dat ligt er niet, dus liever niets dan een verzonnen getal
    expect(startWeightAdvice(getExercise('lateral_raise_db'), state40, 0.7)).toBeNull()
  })
})
