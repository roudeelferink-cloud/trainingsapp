import { describe, expect, it } from 'vitest'
import { EXERCISES, getExercise } from '../src/data/exercises'
import { COACHING, LEG_COMBI_NOTE } from '../src/data/coaching'
import { getFigure } from '../src/data/figures'

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

  it('dekt alle 94 oefeningen', () => {
    expect(EXERCISES).toHaveLength(94)
    expect(Object.keys(COACHING)).toHaveLength(94)
  })

  it('beschrijft leg curl en leg extension als zittende combimachine', () => {
    const curl = getExercise('leg_curl').coaching
    const ext = getExercise('leg_extension').coaching

    // beide starten zittend met de rug tegen de leuning en het draaipunt op de knie
    for (const c of [curl, ext]) {
      expect(c.setup).toMatch(/zitten/i)
      expect(c.setup).toMatch(/leuning/i)
      expect(c.setup).toMatch(/draaipunt/i)
      expect(c.note).toBe(LEG_COMBI_NOTE)
    }

    // geen restanten van de liggende (prone) variant
    const curlTekst = [curl.setup, curl.mistake, ...curl.execution].join(' ')
    expect(curlTekst).not.toMatch(/op de bank|liggen|buik/i)
    expect(curl.setup).toMatch(/hielen/)
    expect(curl.execution[0]).toMatch(/naar beneden/)
    expect(curl.mistake).toMatch(/bekken|stoel/i)

    expect(ext.setup).toMatch(/enkels/)
    expect(ext.execution[0]).toMatch(/strek/i)
    expect(ext.execution[1]).toMatch(/schijven niet af/i)
    expect(ext.mistake).toMatch(/zwaai|billen/i)
  })

  it('noemt in de notitie dat rolkussen en rugsteun omgesteld moeten worden', () => {
    expect(LEG_COMBI_NOTE).toMatch(/dezelfde combimachine/i)
    expect(LEG_COMBI_NOTE).toMatch(/rolkussen/i)
    expect(LEG_COMBI_NOTE).toMatch(/rugsteun/i)
  })

  it('heeft voor deze twee geen lijntekening die de oude houding laat zien', () => {
    // ze zijn isolatie en hebben dus nooit een poppetje gehad; er valt niets om te tekenen
    for (const id of ['leg_curl', 'leg_extension']) {
      expect(getExercise(id).hasFigure, id).toBe(false)
      expect(getFigure(id), id).toBeNull()
    }
  })

  it('verwijst nergens naar externe bronnen', () => {
    for (const ex of EXERCISES) {
      const alles = [ex.coaching.setup, ex.coaching.mistake, ...ex.coaching.execution].join(' ')
      expect(alles, ex.id).not.toMatch(/https?:\/\/|youtube|video|zie link/i)
    }
  })
})
