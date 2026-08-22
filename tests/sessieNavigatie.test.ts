import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildDay } from '../src/logic/day'
import { addDays, mondayOf, today } from '../src/logic/dates'
import { SessionScreen } from '../src/screens/SessionScreen'
import * as A from '../src/store/actions'
import { getState, resetState, setState } from '../src/store/store'
import {
  editIndex,
  isLastSlot,
  sessionSteps,
  stepAfter,
  stepBefore,
  stepMark,
} from '../src/logic/sessionFlow'
import type { LoggedSet } from '../src/types'

/**
 * Navigeren binnen een sessie. Tot nu toe kon je alleen vooruit; deze regels maken
 * heen-en-weer lopen mogelijk zonder dat er iets terugvalt.
 */

const WARMUP = 'warmup'
const SLOTS = ['legs_a:0', 'legs_a:1', 'legs_a:2', 'legs_a:3', 'legs_a:4']
const STAPPEN = sessionSteps(WARMUP, SLOTS)

describe('de stappen van een sessie', () => {
  it('zet de warming-up vooraan en daarna de oefeningen', () => {
    expect(STAPPEN).toEqual([WARMUP, ...SLOTS])
  })

  it('loopt vooruit en achteruit, en niet rond', () => {
    expect(stepAfter(STAPPEN, WARMUP)).toBe('legs_a:0')
    expect(stepBefore(STAPPEN, 'legs_a:0')).toBe(WARMUP)
    expect(stepAfter(STAPPEN, 'legs_a:2')).toBe('legs_a:3')
    expect(stepBefore(STAPPEN, 'legs_a:2')).toBe('legs_a:1')
    // aan de randen houdt het op: geen sprong van het einde naar de warming-up
    expect(stepBefore(STAPPEN, WARMUP)).toBeNull()
    expect(stepAfter(STAPPEN, 'legs_a:4')).toBeNull()
  })

  it('geeft niets terug voor een stap die er niet is', () => {
    expect(stepAfter(STAPPEN, 'legs_a:9')).toBeNull()
    expect(stepBefore(STAPPEN, 'legs_a:9')).toBeNull()
  })
})

describe('de knop onderin — de bug bij terugspringen', () => {
  it('zegt "Sessie afronden" alleen op de laatste oefening', () => {
    expect(isLastSlot(SLOTS, 'legs_a:4')).toBe(true)
    for (const key of SLOTS.slice(0, -1)) {
      expect(isLastSlot(SLOTS, key), key).toBe(false)
    }
  })

  it('blijft "Volgende oefening" na een terugsprong naar 1 van 5 met de rest al gedaan', () => {
    // precies de gemelde situatie: alles behalve oefening 1 is afgerond en je springt terug
    const afgerond = ['legs_a:1', 'legs_a:2', 'legs_a:3', 'legs_a:4']
    expect(afgerond).toHaveLength(4)
    expect(isLastSlot(SLOTS, 'legs_a:0')).toBe(false)
  })

  it('houdt de laatste oefening de laatste, ook als er nog niets afgerond is', () => {
    expect(isLastSlot(SLOTS, 'legs_a:4')).toBe(true)
  })

  it('zegt niets over een lege sessie', () => {
    expect(isLastSlot([], 'legs_a:0')).toBe(false)
  })
})

describe('de voortgangsbalk laat zien waar je staat', () => {
  const afgerond = [WARMUP, 'legs_a:1', 'legs_a:2', 'legs_a:3', 'legs_a:4']

  it('markeert de stap waar je nu bent, ook als die al afgerond is', () => {
    // dit is wat er ontbrak: met alles gevuld was niet te zien waar je stond
    expect(stepMark('legs_a:4', 'legs_a:4', afgerond)).toBe('current')
    expect(stepMark('legs_a:2', 'legs_a:4', afgerond)).toBe('done')
  })

  it('onderscheidt gedaan, hier en nog te doen', () => {
    expect(stepMark(WARMUP, 'legs_a:0', afgerond)).toBe('done')
    expect(stepMark('legs_a:0', 'legs_a:0', afgerond)).toBe('current')
    expect(stepMark('legs_a:1', 'legs_a:0', afgerond)).toBe('done')
    expect(stepMark('legs_a:0', 'legs_a:1', afgerond)).toBe('todo')
  })
})

describe('sets bijstellen zonder de oefening terug te zetten', () => {
  const sets = (done: boolean[]): LoggedSet[] =>
    done.map((d) => ({ weight: 40, reps: 8, rir: 2, done: d }))

  it('pakt zonder keuze de eerste set die nog open staat', () => {
    expect(editIndex(sets([true, false, false]), null)).toBe(1)
    expect(editIndex(sets([false, false, false]), null)).toBe(0)
  })

  it('pakt zonder keuze de laatste set als alles af is', () => {
    expect(editIndex(sets([true, true, true]), null)).toBe(2)
  })

  it('laat een aangetikte set van een afgeronde oefening winnen', () => {
    // alle sets af, maar set 1 moet nog gecorrigeerd worden
    expect(editIndex(sets([true, true, true]), 0)).toBe(0)
    expect(editIndex(sets([true, true, true]), 1)).toBe(1)
  })

  it('negeert een keuze die buiten de sets valt', () => {
    expect(editIndex(sets([true, false]), 5)).toBe(1)
    expect(editIndex(sets([true, false]), -1)).toBe(1)
  })

  it('valt terug op 0 bij een oefening zonder sets', () => {
    expect(editIndex([], null)).toBe(0)
  })
})

describe('het sessiescherm biedt de navigatie ook echt aan', () => {
  const render = (el: Parameters<typeof renderToString>[0]) =>
    renderToString(el).replace(/<!-- -->/g, '')

  beforeEach(() => {
    resetState()
    setState((s) => ({
      ...s,
      startDate: mondayOf(today()),
      settings: { ...s.settings, bodyweightKg: 82 },
    }))
  })

  /** De eerste dag van deze week met een krachtsessie, na de warming-up. */
  function eersteSessie() {
    const monday = mondayOf(today())
    for (let d = 0; d < 7; d++) {
      const iso = addDays(monday, d)
      const plan = buildDay(getState(), iso)
      if (!plan.strength) continue
      A.setWarmupDone(iso, plan.strength.kind, true)
      return { iso, kind: plan.strength.kind, slots: plan.strength.slots }
    }
    throw new Error('geen krachtsessie deze week')
  }

  it('zet vorige en volgende naast elkaar', () => {
    const { iso, kind } = eersteSessie()
    const html = render(createElement(SessionScreen, { date: iso, kind, onClose: () => {} }))
    expect(html).toContain('← Vorige')
    expect(html).toContain('Volgende →')
  })

  it('maakt van elk segment van de voortgangsbalk een knop naar die oefening', () => {
    const { iso, kind, slots } = eersteSessie()
    const html = render(createElement(SessionScreen, { date: iso, kind, onClose: () => {} }))
    expect(html).toContain('aria-label="Naar Warming-up"')
    for (const [i, r] of slots.entries()) {
      expect(html, r.exercise.naam).toContain(`aria-label="Naar Oefening ${i + 1}: ${r.exercise.naam}"`)
    }
    // en waar je staat is te zien, niet alleen wat af is
    expect(html).toContain('aria-current="step"')
  })

  it('laat elke setrij aantikken om hem bij te stellen', () => {
    const { iso, kind } = eersteSessie()
    const html = render(createElement(SessionScreen, { date: iso, kind, onClose: () => {} }))
    expect(html).toContain('aria-label="Set 1 bijstellen"')
    // het vinkje blijft een aparte knop, zodat bijstellen niets afvinkt
    expect(html).toContain('aria-label="Set 1 afvinken"')
  })

  it('houdt de knop op "Volgende oefening" zolang je niet op de laatste staat', () => {
    const { iso, kind, slots } = eersteSessie()
    expect(slots.length).toBeGreaterThan(1)
    const html = render(createElement(SessionScreen, { date: iso, kind, onClose: () => {} }))
    expect(html).not.toContain('Sessie afronden</button>')
  })
})
