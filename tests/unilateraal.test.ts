import { describe, expect, it } from 'vitest'
import { EXERCISES, getExercise } from '../src/data/exercises'
import { isBilateralDumbbell, isDumbbell, isUnilateral, setVolumeKg, sideFactor } from '../src/logic/dumbbell'
import { loadHint, repsHint, repsInputLabel } from '../src/logic/load'
import { slotMinutes } from '../src/logic/duration'
import type { ResolvedSlot } from '../src/logic/select'
import { defaultState } from '../src/store/store'
import type { LoggedSet } from '../src/types'

/**
 * De dumbbell-conventie zei "gewicht per dumbbell, reps per zijde" over álle
 * dumbbelloefeningen. Dat klopte alleen voor eenarmig werk: bij bankdrukken met twee
 * dumbbells is een rep gewoon een rep. `unilateral` staat nu per oefening expliciet in
 * de bibliotheek en label, uitleg en rekenwerk volgen die vlag.
 */

/** Wat er per kant gedaan wordt. De rest van de bibliotheek is tweezijdig. */
const PER_KANT = [
  'db_row_1arm',
  'single_leg_calf_db',
  'heel_drop_ecc',
  'cable_hip_abduction',
  'standing_band_abduction',
  'clamshell',
  'side_lying_abduction_band',
  'side_lying_abduction',
  'side_plank_leg_lift',
  'side_plank',
  'pallof_press',
  'bulgarian_split_squat',
  'single_leg_press',
  'walking_lunge_db',
  'step_up_db',
  'reverse_lunge_sandbag',
  'single_leg_rdl_db',
  'split_squat_bw',
  'step_up_bw',
  'single_leg_glute_bridge',
]

describe('de vlag staat expliciet op elke oefening', () => {
  it('heeft nergens een ontbrekende of geraden waarde', () => {
    for (const ex of EXERCISES) {
      expect(typeof ex.unilateral, ex.id).toBe('boolean')
    }
  })

  it('staat precies op het werk dat per kant gaat', () => {
    const gevonden = EXERCISES.filter((e) => e.unilateral).map((e) => e.id).sort()
    expect(gevonden).toEqual([...PER_KANT].sort())
  })

  it('zet hem aan bij alles wat zichzelf eenbenig of eenarmig noemt', () => {
    for (const ex of EXERCISES) {
      const naam = ex.naam.toLowerCase()
      if (naam.startsWith('eenbenig') || naam.startsWith('eenarmig')) {
        expect(ex.unilateral, ex.id).toBe(true)
      }
    }
  })
})

describe('label en uitleg bewegen mee', () => {
  it('zegt bij tweearmig werk alleen "reps", zonder per zijde', () => {
    for (const id of ['flat_db_press', 'lateral_raise_db', 'db_shoulder_press', 'leg_press']) {
      const ex = getExercise(id)
      expect(repsInputLabel(ex), id).toBe('reps')
      expect(repsHint(ex), id).toBeNull()
    }
  })

  it('zegt bij eenzijdig werk "reps per zijde" met de uitlegregel erbij', () => {
    for (const id of PER_KANT) {
      const ex = getExercise(id)
      expect(repsInputLabel(ex), id).toBe('reps per zijde')
      expect(repsHint(ex), id).toContain('Per kant')
    }
  })

  it('legt uit dat 10 links en 10 rechts samen 10 reps zijn', () => {
    expect(repsHint(getExercise('db_row_1arm'))).toBe(
      'Per kant tellen: 10 links en 10 rechts is 10 reps, niet 20.',
    )
  })

  it('houdt de helperregel over het gewicht van één dumbbell zoals hij was', () => {
    const settings = defaultState().settings
    expect(loadHint(getExercise('flat_db_press'), settings)).toBe(
      'Gewicht van één dumbbell, niet van twee samen.',
    )
    expect(loadHint(getExercise('db_row_1arm'), settings)).toBe(
      'Gewicht van de dumbbell in je hand; reps per kant.',
    )
  })

  it('geldt ook voor eenzijdig werk zonder dumbbells', () => {
    // eenbenige leg press en side plank zijn per kant, maar niet van een rek
    for (const id of ['single_leg_press', 'side_plank']) {
      expect(isDumbbell(getExercise(id)), id).toBe(false)
      expect(repsInputLabel(getExercise(id)), id).toBe('reps per zijde')
    }
  })
})

describe('het rekenwerk gebruikt dezelfde vlag', () => {
  const set = (weight: number, reps: number): LoggedSet => ({ weight, reps, rir: 2, done: true })

  it('telt een set eenzijdig werk dubbel en tweezijdig werk enkel', () => {
    expect(sideFactor(getExercise('db_row_1arm'))).toBe(2)
    expect(sideFactor(getExercise('flat_db_press'))).toBe(1)
    expect(setVolumeKg(getExercise('single_leg_press'), set(60, 10))).toBe(1200)
    expect(setVolumeKg(getExercise('leg_press'), set(60, 10))).toBe(600)
  })

  it('scheidt tweezijdig dumbbellwerk van eenzijdig', () => {
    expect(isBilateralDumbbell(getExercise('flat_db_press'))).toBe(true)
    expect(isBilateralDumbbell(getExercise('db_row_1arm'))).toBe(false)
    expect(isUnilateral(getExercise('db_row_1arm'))).toBe(true)
  })

  it('rekent voor de duurschatting twee kanten bij eenzijdig werk', () => {
    const slot = (id: string): ResolvedSlot => {
      const exercise = getExercise(id)
      return {
        slot: { key: 'x:0', exerciseId: id, role: 'accessory', setsReps: exercise.setsReps },
        exercise,
        sets: 3,
        repMin: 10,
        repMax: 10,
        reasons: [],
      }
    }
    // zelfde reps, zelfde sets: per kant kost het meer tijd
    expect(slotMinutes(slot('single_leg_press'))).toBeGreaterThan(slotMinutes(slot('leg_press')))
  })
})
