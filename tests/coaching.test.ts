import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../src/data/exercises'
import { COACHING } from '../src/data/coaching'

describe('uitleg per oefening', () => {
  it.each(EXERCISES.map((e) => [e.id, e] as const))('%s heeft een volledige uitleg', (_id, ex) => {
    expect(ex.coaching, 'coaching ontbreekt').toBeDefined()
    expect(ex.coaching.setup.trim().length, 'setup is leeg').toBeGreaterThan(20)
    expect(ex.coaching.execution.length, 'execution heeft te weinig punten').toBeGreaterThanOrEqual(2)
    expect(ex.coaching.execution.length, 'execution heeft te veel punten').toBeLessThanOrEqual(3)
    expect(ex.coaching.mistake.trim().length, 'mistake is leeg').toBeGreaterThan(20)
  })

  it('heeft geen lege regels in de uitvoering', () => {
    for (const ex of EXERCISES) {
      for (const line of ex.coaching.execution) {
        expect(line.trim().length, `${ex.id}: lege regel`).toBeGreaterThan(10)
      }
    }
  })

  it('bevat geen uitleg voor oefeningen die niet bestaan', () => {
    const ids = new Set(EXERCISES.map((e) => e.id))
    expect(Object.keys(COACHING).filter((k) => !ids.has(k))).toEqual([])
  })

  it('dekt alle 93 oefeningen', () => {
    expect(EXERCISES).toHaveLength(93)
    expect(Object.keys(COACHING)).toHaveLength(93)
  })

  it('verwijst nergens naar externe bronnen', () => {
    for (const ex of EXERCISES) {
      const alles = [ex.coaching.setup, ex.coaching.mistake, ...ex.coaching.execution].join(' ')
      expect(alles, ex.id).not.toMatch(/https?:\/\/|youtube|video|zie link/i)
    }
  })
})
