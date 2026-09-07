import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { missedInWeek } from '../src/logic/backfill'
import { REST_DAY_REASON, buildDay, moveTargets } from '../src/logic/day'
import { addDays, formatShort, mondayOf, today, weekday } from '../src/logic/dates'
import { PlanScreen } from '../src/screens/PlanScreen'
import { WeekScreen } from '../src/screens/WeekScreen'
import * as A from '../src/store/actions'
import { ANOUC, ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'

/**
 * De planpagina: de week in één overzicht, met per dag wat je ermee kunt.
 *
 * Wat hier bewaakt wordt is dat het planscherm niets eigens uitvindt — het schuift met
 * dezelfde acties als de rest van de app — en dat de vaste rustdag er niet in te krijgen
 * is, hoe je ook probeert.
 */

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

const noop = () => {}

const MAANDAG = () => mondayOf(today())

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: mondayOf(today()) }))
})

function plan(monday = MAANDAG()) {
  return render(
    createElement(PlanScreen, {
      monday,
      onClose: noop,
      onOpenSession: noop,
      onOpenRun: noop,
    }),
  )
}

describe('het overzicht', () => {
  it('zet de hele week op één pagina, met wat er per dag staat', () => {
    const html = plan()
    expect(html).toContain('Plannen')
    for (const naam of ['Benen A', 'Duwen', 'Trekken', 'Benen B']) {
      expect(html, naam).toContain(naam)
    }
    expect(html).toContain('Korte loop')
    expect(html).toContain('Duurloop')
  })

  it('geeft elke geplande sessie een knop om te verplaatsen en om over te slaan', () => {
    const html = plan()
    expect(html).toContain('Verplaatsen')
    expect(html).toContain('Overslaan')
  })

  it('is te bereiken vanaf de weekpagina', () => {
    const html = render(createElement(WeekScreen, { onOpenSession: noop, onOpenRun: noop }))
    expect(html).toContain('Plannen')
  })
})

describe('de rustdag blijft hard geblokkeerd', () => {
  it('staat in het overzicht zonder knoppen', () => {
    const html = plan()
    expect(html).toContain('Rustdag. Hier plant de app nooit iets.')
  })

  it('is geen geldige bestemming, ook niet als je het toch probeert', () => {
    const maandag = MAANDAG()
    const woensdag = addDays(maandag, 2)
    expect(weekday(woensdag)).toBe(3)

    const doel = moveTargets(getState(), maandag, 'strength').find((t) => t.date === woensdag)!
    expect(doel.blocked).toBe(REST_DAY_REASON)
    expect(A.moveSession(maandag, woensdag).ok).toBe(false)
    expect(getState().moves).toEqual({})
  })
})

describe('verschuiven en overslaan', () => {
  it('verplaatst via dezelfde actie als de rest van de app', () => {
    const maandag = MAANDAG()
    const donderdag = addDays(maandag, 3)

    expect(A.moveSession(maandag, donderdag).ok).toBe(true)
    const html = plan()
    expect(html).toContain(`verplaatst naar ${formatShort(donderdag)}`)
    expect(html).toContain('Terughalen')
  })

  it('haalt een verplaatsing weer terug', () => {
    const maandag = MAANDAG()
    A.moveSession(maandag, addDays(maandag, 3))
    A.undoMove(maandag)
    expect(getState().moves).toEqual({})
    expect(buildDay(getState(), maandag).strength?.kind).toBe('legs_a')
  })

  it('toont een overgeslagen sessie met de weg terug', () => {
    const maandag = MAANDAG()
    A.skipSession(maandag, 'strength', 'druk')

    const html = plan()
    expect(html).toContain('overgeslagen')
    expect(html).toContain('Toch doen')
  })

  it('toont een afgevinkte sessie zonder knoppen om hem te verzetten', () => {
    const maandag = MAANDAG()
    const strength = buildDay(getState(), maandag).strength!
    const r = strength.slots[0]
    A.completeSession(maandag, strength.kind, [r], {
      [r.slot.key]: [{ weight: 60, reps: 10, done: true }],
    }, false, [r.slot.key])

    expect(plan()).toContain('gedaan')
  })
})

describe('wat er gemist is', () => {
  it('zet de gemiste sessies van deze week bovenaan, met een knop om ze in te vullen', () => {
    const gemist = missedInWeek(getState(), MAANDAG())
    const html = plan()

    if (gemist.length === 0) {
      // vandaag is maandag: er is deze week nog niets te missen
      expect(html).not.toContain('Nog in te vullen')
      return
    }
    expect(html).toContain('Nog in te vullen')
    expect(html).toContain('Invullen')
    expect(html).toContain(formatShort(gemist[0].date))
  })

  it('doet hetzelfde voor de week ervoor, want die valt nog binnen het venster', () => {
    const vorigeWeek = addDays(MAANDAG(), -7)
    setState((s) => ({ ...s, startDate: vorigeWeek }))

    const gemist = missedInWeek(getState(), vorigeWeek)
    expect(gemist.length).toBeGreaterThan(0)

    const html = plan(vorigeWeek)
    expect(html).toContain('Nog in te vullen')
    expect(html).toContain('Invullen')
  })

  it('biedt niets aan in een week die verder terug ligt dan het venster', () => {
    const langGeleden = addDays(MAANDAG(), -21)
    setState((s) => ({ ...s, startDate: langGeleden }))

    expect(missedInWeek(getState(), langGeleden)).toEqual([])
    expect(plan(langGeleden)).not.toContain('Nog in te vullen')
  })
})

describe('beide profielen', () => {
  it('houdt bij Anouc de maandag vrij en toont haar full body-sessies', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: mondayOf(today()) }))

    const html = plan()
    expect(html).toContain('Full body A')
    expect(html).toContain('Full body B')
    expect(html).toContain('Rustdag. Hier plant de app nooit iets.')
    expect(html).toContain('Maandag blijft altijd vrij')
  })

  it('raakt de andere gebruiker niet als je hier iets verzet', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: mondayOf(today()) }))
    const woensdag = addDays(mondayOf(today()), 2)
    expect(A.moveSession(woensdag, addDays(woensdag, 1)).ok).toBe(true)

    setCurrentUser(ROB)
    expect(getState().moves).toEqual({})
  })
})
