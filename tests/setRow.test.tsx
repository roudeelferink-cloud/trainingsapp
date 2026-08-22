import { readFileSync } from 'node:fs'
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

/**
 * De maten staan in tokens en niet meer als px in de componenten, dus lezen we ze
 * hier uit theme.css. Zo blijft de eis ("een getal moet leesbaar en aanraakbaar
 * blijven") bewaakt, ook al staat het getal nu ergens anders.
 */
const THEME = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8')

function token(naam: string): number {
  const m = THEME.match(new RegExp(`\\n\\s*--${naam}:\\s*(\\d+)px`))
  if (!m) throw new Error(`token --${naam} niet gevonden in theme.css`)
  return Number(m[1])
}

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

describe('de maten van de invoer staan in tokens', () => {
  it('houdt het getalveld breed genoeg om te lezen en te bewerken', () => {
    expect(token('input-min-width')).toBeGreaterThanOrEqual(NUMBER_INPUT_MIN_PX)
  })

  it('houdt de waarde ruim boven 16px, anders zoomt iOS bij focus in op het veld', () => {
    expect(token('text-input')).toBeGreaterThanOrEqual(16)
  })

  it('houdt de − en + knoppen op de maat die met zweethanden nog te raken is', () => {
    // het ontwerp schrijft 64px voor en noemt dat een minimum, niet een voorkeur
    expect(token('stepper-button')).toBeGreaterThanOrEqual(token('tap-min'))
    expect(token('stepper-height')).toBeGreaterThanOrEqual(token('tap-min'))
  })
})

describe('invoervelden in een setrij', () => {
  it('geeft het getalveld een expliciete minimumbreedte', () => {
    const html = render(createElement(Stepper, { value: 40, onChange: () => {}, ariaLabel: 'Gewicht' }))
    const [field] = inputs(html)

    expect(field).toContain('min-w-number-field')
    expect(field).toContain('text-input')
    expect(field).toContain('inputMode="decimal"')
    expect(field).toContain('text-center')
  })

  it('laat de − en + knoppen niet meekrimpen met het veld', () => {
    const html = render(createElement(Stepper, { value: 40, onChange: () => {} }))
    const knoppen = html.match(/<button[^>]*>/g) ?? []

    expect(knoppen).toHaveLength(2)
    for (const knop of knoppen) {
      expect(knop).toContain('flex-none')
      expect(knop).toContain('w-stepper-btn')
      expect(knop).toContain('h-stepper')
    }
  })

  it('houdt het veld zelf breed genoeg binnen zijn omhulsel', () => {
    const html = render(createElement(Stepper, { value: 40, onChange: () => {} }))
    // het omhulsel draagt dezelfde minimumbreedte als het veld erin
    expect(html).toMatch(/min-w-number-field flex-1[^>]*border-field-border/)
  })
})

describe('elke setrij, niet alleen de eerste', () => {
  const monday = () => mondayOf(today())

  it('geeft alle kg- en repsvelden dezelfde minimumbreedte', () => {
    const iso = monday()
    const plan = buildDay(getState(), iso)
    const kind = plan.strength!.kind
    const sets = plan.strength!.slots[0].sets
    expect(sets).toBeGreaterThanOrEqual(3)

    const html = render(createElement(SessionScreen, { date: iso, kind, onClose: () => {} }))

    // de laatste setrij staat er ook echt
    expect(html).toContain(`Set ${sets}`)

    // alleen de setvelden; de warming-up heeft ook een getalveld, maar geen setrij
    const setVelden = inputs(html).filter((i) => /aria-label="(Gewicht|Reps) set/.test(i))
    expect(setVelden).toHaveLength(sets * 2) // kg + reps per set

    const velden = inputs(html).filter((i) => i.includes('inputMode="decimal"'))
    for (const veld of velden) {
      expect(veld).toContain('min-w-number-field')
      expect(veld).toContain('text-input')
    }
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
      for (const veld of velden) {
        expect(veld, plan.strength.naam).toContain('min-w-number-field')
      }
      gecontroleerd++
    }
    expect(gecontroleerd).toBeGreaterThanOrEqual(4)
  })

  it('zet kg en reps onder elkaar, zodat een smal scherm ze niet samenknijpt', () => {
    const iso = monday()
    const kind = buildDay(getState(), iso).strength!.kind
    const html = render(createElement(SessionScreen, { date: iso, kind, onClose: () => {} }))

    // vanaf de eerste setrij: alles daarboven (warming-up, volgorde) is geen setrij
    const setrijen = html.slice(html.indexOf('Set 1'))
    expect(setrijen).not.toBe('')
    // geen tweekolomsraster meer om de invoervelden heen
    expect(setrijen).not.toContain('grid-cols-2 gap-2')
  })
})
