import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { NUMBER_INPUT_MIN_PX, Stepper } from '../src/components/ui'
import { buildDay } from '../src/logic/day'
import { addDays, mondayOf, today } from '../src/logic/dates'
import { SessionScreen } from '../src/screens/SessionScreen'
import { getState, resetState, setState } from '../src/store/store'

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

const MIN_WIDTH_CLASS = `min-w-[${NUMBER_INPUT_MIN_PX}px]`

beforeEach(() => {
  resetState()
  setState((s) => ({
    ...s,
    startDate: mondayOf(today()),
    settings: { ...s.settings, bodyweightKg: 82 },
  }))
})

/** Alle <input>-tags uit een stuk HTML, zodat we per veld kunnen kijken. */
function inputs(html: string): string[] {
  return html.match(/<input[^>]*>/g) ?? []
}

describe('invoervelden in een setrij', () => {
  it('geeft het getalveld een expliciete minimumbreedte', () => {
    const html = render(createElement(Stepper, { value: 40, onChange: () => {}, ariaLabel: 'Gewicht' }))
    const [field] = inputs(html)

    expect(field).toContain(MIN_WIDTH_CLASS)
    // 16px of groter, anders zoomt iOS bij focus in op het veld
    expect(field).toContain('text-base')
    expect(field).toContain('inputMode="decimal"')
    expect(field).toContain('text-center')
  })

  it('laat de − en + knoppen niet meekrimpen met het veld', () => {
    const html = render(createElement(Stepper, { value: 40, onChange: () => {} }))
    const knoppen = html.match(/<button[^>]*>/g) ?? []

    expect(knoppen).toHaveLength(2)
    // flex-none = flex: 0 0 auto, met een vaste breedte van 44px (w-11)
    for (const knop of knoppen) {
      expect(knop).toContain('flex-none')
      expect(knop).toContain('w-11')
    }
    // de rij mag wrappen in plaats van de velden samen te knijpen
    expect(html).toContain('flex-wrap')
  })

  it('houdt het veld zelf breed genoeg binnen zijn omhulsel', () => {
    const html = render(createElement(Stepper, { value: 40, onChange: () => {} }))
    // het omhulsel is minstens zo breed als het veld plus zijn padding
    const wrapper = html.match(/min-w-\[(\d+)px\][^>]*flex items-center rounded/)
    expect(wrapper).not.toBeNull()
    expect(Number(wrapper![1])).toBeGreaterThanOrEqual(NUMBER_INPUT_MIN_PX)
  })
})

describe('één set tegelijk bewerkbaar', () => {
  const monday = () => mondayOf(today())

  it('toont alleen de actieve set als velden en houdt die breed en groot genoeg', () => {
    const iso = monday()
    const plan = buildDay(getState(), iso)
    const kind = plan.strength!.kind
    const sets = plan.strength!.slots[0].sets
    expect(sets).toBeGreaterThanOrEqual(3)

    const html = render(createElement(SessionScreen, { date: iso, kind, onClose: () => {} }))

    // de teller laat zien hoeveel sets er in totaal zijn
    expect(html).toContain(`Set 1 van ${sets}`)

    // alleen de actieve set is bewerkbaar: precies één kg- en één repsveld
    const setVelden = inputs(html).filter((i) => /aria-label="(Gewicht|Reps) set/.test(i))
    expect(setVelden).toHaveLength(2)
    expect(html).not.toContain('aria-label="Gewicht set 2"')

    // alle decimale velden houden hun minimumbreedte en zijn 16px of groter,
    // anders zoomt iOS bij focus in op het veld
    const velden = inputs(html).filter((i) => i.includes('inputMode="decimal"'))
    for (const veld of velden) {
      expect(veld).toContain(MIN_WIDTH_CLASS)
      expect(veld).toMatch(/text-(base|lg|xl|2xl)/)
      expect(veld).toContain('inputMode="decimal"')
    }
    // de getallen staan in monospace
    for (const veld of setVelden) expect(veld).toContain('num')
  })

  it('geldt voor iedere krachtsessie van de week', () => {
    const start = monday()
    let gecontroleerd = 0
    for (let d = 0; d < 7; d++) {
      const iso = addDays(start, d)
      const plan = buildDay(getState(), iso)
      if (!plan.strength) continue
      const html = render(
        createElement(SessionScreen, { date: iso, kind: plan.strength.kind, onClose: () => {} }),
      )
      const velden = inputs(html).filter((i) => i.includes('inputMode="decimal"'))
      expect(velden.length, plan.strength.naam).toBeGreaterThan(0)
      for (const veld of velden) expect(veld, plan.strength.naam).toContain(MIN_WIDTH_CLASS)
      // en per sessie is er precies één set tegelijk bewerkbaar
      const setVelden = velden.filter((i) => /aria-label="(Gewicht|Reps|Bandniveau) set/.test(i))
      expect(setVelden.length, plan.strength.naam).toBe(2)
      gecontroleerd++
    }
    expect(gecontroleerd).toBeGreaterThanOrEqual(4)
  })

  it('zet de komende sets als voorgevulde regels klaar, met de opslagknop bij de actieve set', () => {
    const iso = monday()
    const plan = buildDay(getState(), iso)
    const kind = plan.strength!.kind
    const sets = plan.strength!.slots[0].sets
    const html = render(createElement(SessionScreen, { date: iso, kind, onClose: () => {} }))

    expect(html).toContain('Set opslaan')
    // de laatste set staat als regel klaar (regelnummer in monospace)
    expect(html).toContain(`<span class="num w-5 shrink-0">${sets}</span>`)
  })
})
