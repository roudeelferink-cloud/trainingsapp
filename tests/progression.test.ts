import { describe, expect, it } from 'vitest'
import { getExercise } from '../src/data/exercises'
import type { ExerciseState } from '../src/types'
import {
  CALIBRATION_TEXT,
  applyProgression,
  emptyExerciseState,
  estimate1RM,
  roundTo,
  targetFor,
} from '../src/logic/progression'
import { addDays } from '../src/logic/dates'
import { DO, MON, baseState } from './helpers'

const legPress = getExercise('leg_press') // progression 'weight', stap 1,25 kg
const dbPress = getExercise('db_shoulder_press') // progression 'reps', stap 2,5 kg
const s0 = baseState()

const sets = (n: number, weight: number, reps: number, rir: number) =>
  Array.from({ length: n }, () => ({ weight, reps, rir }))

describe('streefwaarden', () => {
  it('toont in de kalibratieweken geen gewicht maar een instructie', () => {
    const t = targetFor(legPress, 8, s0, { calibration: true, deload: false })
    expect(t.byFeel).toBe(true)
    expect(t.note).toBe(CALIBRATION_TEXT)
    expect(t.weight).toBeNull()
  })

  it('valt terug op gevoel zolang er nog niets gelogd is', () => {
    expect(targetFor(legPress, 8, s0, { calibration: false, deload: false }).byFeel).toBe(true)
  })

  it('toont een streefgewicht zodra er data is', () => {
    const state = baseState({
      exerciseState: { leg_press: { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 } },
    })
    const t = targetFor(legPress, 8, state, { calibration: false, deload: false })
    expect(t.byFeel).toBe(false)
    expect(t.weight).toBe(100)
  })

  it('haalt in de deloadweek 40% van het streefgewicht af', () => {
    const state = baseState({
      exerciseState: { leg_press: { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 } },
    })
    expect(targetFor(legPress, 8, state, { calibration: false, deload: true }).weight).toBe(60)
  })

  it('rondt de deloadkorting af op wat er te laden is', () => {
    // 95 × 0,6 = 57 kg, en met schijven vanaf 1,25 kg per stuk is 55 het eerste dat past
    const state = baseState({
      exerciseState: { leg_press: { ...emptyExerciseState(), targetWeight: 95, targetReps: 8 } },
      settings: { ...baseState().settings, plates: [2.5, 5, 10, 20] },
    })
    expect(targetFor(legPress, 8, state, { calibration: false, deload: true }).weight).toBe(55)
  })
})

describe('progressie op gewicht', () => {
  const base = { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 }

  it('verhoogt met de kleinste stap die te laden is', () => {
    // schijven gaan per paar: met 1,25 kg als lichtste schijf is 2,5 kg de kleinste stap
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(3, 100, 10, 1), base, {
      allowIncrease: true,
      iso: MON,
    })
    expect(r.next.targetWeight).toBe(102.5)
    expect(r.next.targetReps).toBe(8)
    expect(r.message).toContain('omhoog')
  })

  it('verhoogt niet bij RIR 3', () => {
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(3, 100, 10, 3), base, {
      allowIncrease: true,
      iso: MON,
    })
    expect(r.next.targetWeight).toBe(100)
  })

  it('verhoogt niet als één set de bovengrens niet haalt', () => {
    const mixed = [...sets(2, 100, 10, 1), { weight: 100, reps: 9, rir: 1 }]
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, mixed, base, { allowIncrease: true, iso: MON })
    expect(r.next.targetWeight).toBe(100)
  })

  it('verhoogt niet als de check-in op 3 stond', () => {
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(3, 100, 10, 1), base, {
      allowIncrease: false,
      iso: MON,
    })
    expect(r.next.targetWeight).toBe(100)
    expect(r.next.lastNote).toContain('geen nieuwe gewichtsverhoging')
  })
})

describe('progressie op reps', () => {
  it('groeit eerst door tot repMax + 2', () => {
    const start = { ...emptyExerciseState(), targetWeight: 15, targetReps: 12 }
    const r = applyProgression(dbPress, { repMin: 8, repMax: 12 }, sets(1, 15, 12, 1), start, {
      allowIncrease: true,
      iso: MON,
    })
    expect(r.next.targetReps).toBe(13)
    expect(r.next.targetWeight).toBe(15)
  })

  it('gaat pas daarna omhoog in gewicht en terug naar de ondergrens', () => {
    const start = { ...emptyExerciseState(), targetWeight: 15, targetReps: 14 }
    const r = applyProgression(dbPress, { repMin: 8, repMax: 12 }, sets(1, 15, 14, 1), start, {
      allowIncrease: true,
      iso: MON,
    })
    expect(r.next.targetWeight).toBe(17.5)
    expect(r.next.targetReps).toBe(8)
  })
})

describe('double progression op gevoel', () => {
  const base = { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 }
  const bounds = { repMin: 8, repMax: 10 }

  it('verhoogt bij alle sets op de bovengrens en een sessie die goed voelde', () => {
    const r = applyProgression(legPress, bounds, sets(3, 100, 10, 3), base, {
      allowIncrease: true,
      iso: MON,
      feel: 'goed',
    })
    // RIR 3 zou vroeger tegenhouden; de beoordeling is nu leidend
    expect(r.next.targetWeight).toBe(102.5)
  })

  it('verhoogt ook als het makkelijk ging', () => {
    const r = applyProgression(legPress, bounds, sets(3, 100, 10, 2), base, {
      allowIncrease: true,
      iso: MON,
      feel: 'makkelijk',
    })
    expect(r.next.targetWeight).toBe(102.5)
  })

  it('laat het gewicht staan als de sessie zwaar viel, ook met alle reps gehaald', () => {
    const r = applyProgression(legPress, bounds, sets(3, 100, 10, 0), base, {
      allowIncrease: true,
      iso: MON,
      feel: 'zwaar',
    })
    expect(r.next.targetWeight).toBe(100)
    expect(r.next.lastNote).toContain('zwaar')
  })

  it('valt zonder beoordeling terug op de gelogde RIR', () => {
    const metRir = applyProgression(legPress, bounds, sets(3, 100, 10, 1), base, {
      allowIncrease: true,
      iso: MON,
    })
    const teZwaar = applyProgression(legPress, bounds, sets(3, 100, 10, 3), base, {
      allowIncrease: true,
      iso: MON,
    })
    expect(metRir.next.targetWeight).toBe(102.5)
    expect(teZwaar.next.targetWeight).toBe(100)
  })
})

describe('een deloadweek kost geen voortgang', () => {
  const base = { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 }
  const bounds = { repMin: 8, repMax: 10 }

  it('laat het streefgewicht staan als er met opzet lichter getild is', () => {
    const r = applyProgression(legPress, bounds, sets(3, 60, 10, 1), base, {
      allowIncrease: false,
      iso: MON,
      feel: 'makkelijk',
      deload: true,
    })
    expect(r.next.targetWeight).toBe(100)
  })

  it('neemt een zwaardere set wél over, ook in een deloadweek', () => {
    const r = applyProgression(legPress, bounds, sets(3, 105, 10, 1), base, {
      allowIncrease: false,
      iso: MON,
      feel: 'goed',
      deload: true,
    })
    expect(r.next.targetWeight).toBe(105)
  })

  it('zakt buiten een deloadweek wél mee met wat er getild is', () => {
    const r = applyProgression(legPress, bounds, sets(3, 60, 10, 1), base, {
      allowIncrease: true,
      iso: MON,
      feel: 'goed',
    })
    expect(r.next.targetWeight).toBeGreaterThanOrEqual(60)
    expect(r.next.targetWeight).toBeLessThan(100)
  })
})

describe('maximale sprong per week', () => {
  const bounds = { repMin: 8, repMax: 10 }
  const base0: ExerciseState = { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 }
  const goed = (prev: ExerciseState, iso: string) =>
    applyProgression(legPress, bounds, sets(3, prev.targetWeight ?? 0, 10, 1), prev, {
      allowIncrease: true,
      iso,
      feel: 'goed',
    })

  it('stopt bij 2,5 kg op samengesteld werk, ook na twee goede sessies in één week', () => {
    const eerste = goed(base0, MON)
    expect(eerste.next.targetWeight).toBe(102.5)
    const tweede = goed(eerste.next, DO)
    expect(tweede.next.targetWeight).toBe(102.5)
    expect(tweede.message).toContain('maximum')
  })

  it('geeft in de week erna weer ruimte', () => {
    const eerste = goed(base0, MON)
    const week2 = goed(eerste.next, addDays(MON, 7))
    expect(week2.next.targetWeight).toBe(105)
  })

  it('smeert een stap die niet in één week past uit over meer weken', () => {
    // isolatie mag 1,25 kg per week, maar de kleinste stap op deze machine is 2,5 kg
    // (schijven van 1,25 gaan per paar). Dan mag hij eens per twee weken.
    const curl = getExercise('leg_curl')
    const start = { ...emptyExerciseState(), targetWeight: 40, targetReps: 12 }
    const stap = (prev: ExerciseState, iso: string) =>
      applyProgression(curl, { repMin: 12, repMax: 12 }, sets(3, prev.targetWeight ?? 0, 12, 1), prev, {
        allowIncrease: true,
        iso,
        feel: 'goed',
      })

    const eerste = stap(start, MON)
    expect(eerste.next.targetWeight).toBe(42.5)

    const weekLater = stap(eerste.next, addDays(MON, 7))
    expect(weekLater.next.targetWeight).toBe(42.5)
    expect(weekLater.message).toContain('over 1 week')

    const tweeWekenLater = stap(eerste.next, addDays(MON, 14))
    expect(tweeWekenLater.next.targetWeight).toBe(45)
  })

  it('verhoogt niet als de kleinste laadbare stap net verhoogd is en niet past', () => {
    // alleen schijven van 5 kg: de kleinste stap is 10 kg, vier weken aan weekruimte
    const settings = { ...baseState().settings, plates: [5, 10, 20] }
    const start = { ...emptyExerciseState(), targetWeight: 100, targetReps: 8, increaseWeek: MON, increasedKg: 10 }
    const r = applyProgression(legPress, bounds, sets(3, 100, 10, 1), start, {
      allowIncrease: true,
      iso: addDays(MON, 7),
      feel: 'goed',
      settings,
    })
    expect(r.next.targetWeight).toBe(100)
    expect(r.next.targetReps).toBe(9)
    expect(r.message).toContain('kleinste stap')
  })
})

describe('terugschakelen', () => {
  const base = { ...emptyExerciseState(), targetWeight: 100, targetReps: 8 }

  it('verlaagt nog niet na één sessie onder de ondergrens', () => {
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(1, 100, 6, 0), base, {
      allowIncrease: true,
      iso: MON,
    })
    expect(r.next.targetWeight).toBe(100)
    expect(r.next.belowMinStreak).toBe(1)
  })

  it('verlaagt met 10% na twee sessies onder de ondergrens en meldt dat', () => {
    const eerste = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(1, 100, 6, 0), base, {
      allowIncrease: true,
      iso: MON,
    })
    const tweede = applyProgression(
      legPress,
      { repMin: 8, repMax: 10 },
      sets(1, 100, 6, 0),
      eerste.next,
      { allowIncrease: true, iso: MON },
    )
    expect(tweede.next.targetWeight).toBe(90)
    expect(tweede.next.belowMinStreak).toBe(0)
    expect(tweede.message).toContain('10%')
  })

  it('zet de teller terug zodra de ondergrens weer gehaald wordt', () => {
    const eerste = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(1, 100, 6, 0), base, {
      allowIncrease: true,
      iso: MON,
    })
    const herstel = applyProgression(
      legPress,
      { repMin: 8, repMax: 10 },
      sets(1, 100, 9, 1),
      eerste.next,
      { allowIncrease: true, iso: MON },
    )
    expect(herstel.next.belowMinStreak).toBe(0)
  })

  it('negeert lege sets', () => {
    const r = applyProgression(legPress, { repMin: 8, repMax: 10 }, sets(3, 0, 0, 2), base, {
      allowIncrease: true,
      iso: MON,
    })
    expect(r.next).toEqual(base)
  })
})

describe('rekenhulpjes', () => {
  it('rondt af op de kleinste stap', () => {
    expect(roundTo(101.3, 1.25)).toBe(101.25)
    expect(roundTo(16.4, 2.5)).toBe(17.5)
  })

  it('schat 1RM volgens Epley', () => {
    expect(estimate1RM(100, 10)).toBeCloseTo(133.3, 1)
    expect(estimate1RM(0, 10)).toBe(0)
    expect(estimate1RM(100, 0)).toBe(0)
  })
})
