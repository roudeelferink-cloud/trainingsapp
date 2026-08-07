import { describe, expect, it } from 'vitest'
import { EXERCISES, alternatives, getExercise } from '../src/data/exercises'
import { TEMPLATES, saturdayTemplate } from '../src/data/plan'
import type { Pattern } from '../src/types'

const PATTERNS: Pattern[] = [
  'knee_dominant',
  'hip_dominant',
  'push_horizontal',
  'push_vertical',
  'pull_horizontal',
  'pull_vertical',
  'calf',
  'abduction',
  'core',
  'single_leg',
]

describe('oefeningenbibliotheek', () => {
  it.each(PATTERNS)('heeft minstens 6 oefeningen voor %s', (pattern) => {
    expect(EXERCISES.filter((e) => e.pattern === pattern).length).toBeGreaterThanOrEqual(6)
  })

  it('heeft unieke ids', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length)
  })

  it('verwijst alleen naar bestaande bodyweightAlternatives', () => {
    const missing = EXERCISES.filter((e) => !EXERCISES.some((x) => x.id === e.bodyweightAlternative))
    expect(missing.map((e) => `${e.id} -> ${e.bodyweightAlternative}`)).toEqual([])
  })

  it('geeft elke oefening minstens één alternatief om naar te wisselen', () => {
    const stuck = EXERCISES.filter((e) => alternatives(e).length < 2)
    expect(stuck.map((e) => e.id)).toEqual([])
  })

  it('heeft geldige repbereiken', () => {
    for (const e of EXERCISES) {
      expect(e.setsReps.repMin, e.id).toBeLessThanOrEqual(e.setsReps.repMax)
      expect(e.setsReps.sets, e.id).toBeGreaterThan(0)
    }
  })
})

describe('sessiesjablonen', () => {
  it('verwijst alleen naar bestaande oefeningen', () => {
    for (const tpl of Object.values(TEMPLATES)) {
      for (const slot of tpl.slots) expect(() => getExercise(slot.exerciseId)).not.toThrow()
    }
  })

  it('houdt kuitwerk en heupabductie op core, zodat ze nooit vervallen bij tijdgebrek', () => {
    const calfAndAbduction = [...TEMPLATES.legs_a.slots, ...TEMPLATES.legs_b.slots].filter((s) =>
      ['standing_calf_smith', 'band_lateral_walk', 'seated_calf', 'band_hip_abduction_seated'].includes(
        s.exerciseId,
      ),
    )
    expect(calfAndAbduction).toHaveLength(4)
    expect(calfAndAbduction.every((s) => s.role === 'core')).toBe(true)
  })

  it('zet smith squat en leg curl in benen A op accessory', () => {
    const accessories = TEMPLATES.legs_a.slots.filter((s) =>
      ['smith_squat', 'leg_curl'].includes(s.exerciseId),
    )
    expect(accessories).toHaveLength(2)
    expect(accessories.every((s) => s.role === 'accessory')).toBe(true)
  })

  it('wisselt de optionele zaterdagsessie per week', () => {
    expect(saturdayTemplate(1).slots[0].exerciseId).not.toBe(saturdayTemplate(2).slots[0].exerciseId)
  })

  it('houdt zware beenbelasting uit de zaterdagsessie', () => {
    for (let week = 1; week <= 8; week++) {
      for (const slot of saturdayTemplate(week).slots) {
        const ex = getExercise(slot.exerciseId)
        expect(['knee_dominant', 'single_leg', 'hip_dominant'], `week ${week}: ${ex.id}`).not.toContain(
          ex.pattern,
        )
      }
    }
  })
})
