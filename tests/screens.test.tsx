import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildDay } from '../src/logic/day'
import { addDays, mondayOf, today } from '../src/logic/dates'
import { ProgressScreen } from '../src/screens/ProgressScreen'
import { SessionScreen } from '../src/screens/SessionScreen'
import { SettingsScreen } from '../src/screens/SettingsScreen'
import { Today } from '../src/screens/Today'
import { WeekScreen } from '../src/screens/WeekScreen'
import { getState, resetState, setState } from '../src/store/store'

const noop = () => {}

/** React zet <!-- --> tussen losse tekstknopen; die halen we weg om op tekst te kunnen matchen. */
const render = (el: Parameters<typeof renderToString>[0]) => renderToString(el).replace(/<!-- -->/g, '')

/** De schermen lezen de gedeelde store, dus die zetten we per test klaar. */
beforeEach(() => {
  resetState()
  setState((s) => ({
    ...s,
    startDate: mondayOf(today()),
    settings: { ...s.settings, bodyweightKg: 82 },
  }))
})

describe('schermen renderen', () => {
  it('rendert Vandaag', () => {
    const html = render(createElement(Today, { onOpenSession: noop }))
    expect(html.length).toBeGreaterThan(500)
    expect(html).toContain('Hoe voelen benen en pezen?')
  })

  it('zet de loop vóór de krachttraining met een pauze ertussen', () => {
    // dinsdag: korte loop + duwen
    const dinsdag = addDays(mondayOf(today()), 1)
    setState((s) => ({ ...s, startDate: mondayOf(dinsdag) }))
    const plan = buildDay(getState(), dinsdag)
    expect(plan.run).not.toBeNull()
    expect(plan.strength).not.toBeNull()
  })

  it('rendert Week', () => {
    const html = render(createElement(WeekScreen, { onOpenSession: noop }))
    expect(html).toContain('Rustdag')
  })

  it('rendert Voortgang', () => {
    expect(render(createElement(ProgressScreen)).length).toBeGreaterThan(200)
  })

  it('rendert Instellingen met de back-upknoppen', () => {
    const html = render(createElement(SettingsScreen))
    expect(html).toContain('Exporteer alles')
    expect(html).toContain('Importeer')
  })

  it('rendert elke krachtsessie van de week met ingevulde setvelden', () => {
    const monday = mondayOf(today())
    let gerenderd = 0
    for (let d = 0; d < 7; d++) {
      const iso = addDays(monday, d)
      const plan = buildDay(getState(), iso)
      if (!plan.strength) continue
      const html = render(
        createElement(SessionScreen, { date: iso, kind: plan.strength.kind, onClose: noop }),
      )
      expect(html, plan.strength.naam).toContain('Set 1')
      expect(html, plan.strength.naam).toContain('RIR')
      gerenderd++
    }
    expect(gerenderd).toBeGreaterThanOrEqual(4)
  })

  it('rendert Vandaag met reismodus, deload en een gevoelige knie', () => {
    setState((s) => ({
      ...s,
      startDate: addDays(mondayOf(today()), -21), // deloadweek
      settings: {
        ...s.settings,
        travelMode: true,
        sensitive: { ...s.settings.sensitive, knee_deep: 'off' },
      },
    }))
    const html = render(createElement(Today, { onOpenSession: noop }))
    expect(html).toContain('Reismodus')
    expect(render(createElement(WeekScreen, { onOpenSession: noop }))).toContain('Deload')
  })

  it('toont de exportherinnering in Instellingen als er nog nooit geëxporteerd is', () => {
    setState((s) => ({
      ...s,
      sessions: {
        'x:legs_a': {
          date: '2026-08-03',
          kind: 'legs_a',
          short: false,
          completedAt: 'x',
          skippedSlots: [],
          exercises: {},
          entries: {},
        },
      },
    }))
    expect(render(createElement(SettingsScreen))).toContain('nooit een back-up')
  })
})
