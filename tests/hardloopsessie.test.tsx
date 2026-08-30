import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { paceMinPerKm } from '../src/logic/activities'
import { backfillStart } from '../src/logic/backfill'
import { buildDay } from '../src/logic/day'
import { runContext } from '../src/logic/runningLoad'
import { addDays, mondayOf, today } from '../src/logic/dates'
import { RunScreen } from '../src/screens/RunScreen'
import { WeekScreen, dayActions } from '../src/screens/WeekScreen'
import * as A from '../src/store/actions'
import { ANOUC, ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'

/**
 * De loop als sessie: openen, invullen, afronden — net als een krachtsessie.
 *
 * Waar deze tests op letten is niet alleen dát het scherm er staat, maar ook dat de app
 * zich niet met het hardlopen bemoeit: geen voorgeschreven afstand, geen aftopping, en
 * hooguit één feitelijke constatering.
 */

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

const noop = () => {}

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: mondayOf(today()) }))
})

/** Een dag van deze week met een loop erop. */
function loopdag(offset = 1): string {
  return addDays(mondayOf(today()), offset)
}

describe('het loopscherm', () => {
  it('opent met de geplande afstand, de werkelijke afstand, de duur en het tempo', () => {
    const iso = loopdag()
    A.setPlannedRunKm(iso, 8)
    const html = render(createElement(RunScreen, { date: iso, onClose: noop }))

    expect(html).toContain('Korte loop')
    expect(html).toContain('Geplande afstand')
    expect(html).toContain('Werkelijk gelopen')
    expect(html).toContain('Duur')
    expect(html).toContain('gepland 8 km')
    // de knop die de sessie afsluit, net als bij kracht
    expect(html).toContain('Loop afronden')
  })

  it('rekent het tempo uit zodra afstand en duur er staan', () => {
    const iso = loopdag()
    A.completeRun(iso, 'short', { plannedKm: 8, km: 10, minutes: 55, bike: false })
    const html = render(createElement(RunScreen, { date: iso, onClose: noop }))

    expect(paceMinPerKm(10, 55)).toBe('5:30 min/km')
    expect(html).toContain('Tempo 5:30 min/km')
  })

  it('topt de werkelijke afstand niet af op wat er gepland stond', () => {
    const iso = loopdag()
    A.setPlannedRunKm(iso, 6)
    A.completeRun(iso, 'short', { plannedKm: 6, km: 14.5, minutes: 80, bike: false })

    expect(getState().runs[iso].km).toBe(14.5)
    expect(getState().runs[iso].plannedKm).toBe(6)
    expect(render(createElement(RunScreen, { date: iso, onClose: noop }))).toContain('14,5')
  })

  it('zegt één feitelijke ding over de afstand en geeft geen advies', () => {
    const iso = loopdag()
    A.completeRun(iso, 'short', { plannedKm: 0, km: 7, minutes: 42, bike: false })
    const html = render(createElement(RunScreen, { date: iso, onClose: noop }))

    // precies de regel uit runContext: een vergelijking, geen voorstel
    expect(html).toContain(runContext(getState(), iso, 'short', 7))
    expect(html).toContain('t.o.v. je gemiddelde')
    for (const sturend of ['Bouw op', 'te veel', 'te ver', 'advies', 'Advies', 'zou je']) {
      expect(html, sturend).not.toContain(sturend)
    }
  })

  it('houdt de afsluitende beoordeling achter het afrondblad', () => {
    const iso = loopdag()
    const html = render(createElement(RunScreen, { date: iso, onClose: noop }))
    // de knop opent het blad; de beoordeling zelf staat er pas als het open is
    expect(html).toContain('Loop afronden')
    expect(html).not.toContain('Hoe ging het?')
  })

  it('laat verplaatsen en overslaan zien op het scherm zelf', () => {
    const html = render(createElement(RunScreen, { date: loopdag(), onClose: noop }))
    expect(html).toContain('Verplaatsen')
    expect(html).toContain('Overslaan')
  })

  it('toont een fietsdag als fietsen, zonder kilometers', () => {
    const iso = loopdag()
    A.setBike(iso, true)
    const html = render(createElement(RunScreen, { date: iso, onClose: noop }))

    expect(html).toContain('Fietsen')
    expect(html).not.toContain('Werkelijk gelopen')
    expect(html).toContain('Fietsen afronden')
  })

  it('zegt het gewoon als er op die dag geen loop staat', () => {
    const rustdag = addDays(mondayOf(today()), 2) // woensdag bij Rob
    const html = render(createElement(RunScreen, { date: rustdag, onClose: noop }))
    expect(html).toContain('geen loop meer')
    expect(html).toContain('Terug')
  })

  it('weigert een dag die verder terug ligt dan het venster', () => {
    const teOud = addDays(backfillStart(), -1)
    const html = render(createElement(RunScreen, { date: teOud, onClose: noop }))
    expect(html).toContain('verder terug dan de vorige week')
  })
})

describe('een loop van een eerdere dag', () => {
  it('zegt erbij dat het om een eerdere datum gaat', () => {
    const gisteren = addDays(today(), -1)
    setState((s) => ({ ...s, startDate: mondayOf(gisteren) }))
    const plan = buildDay(getState(), gisteren)
    if (!plan.run) return // die dag heeft geen loop in dit programma

    const html = render(createElement(RunScreen, { date: gisteren, onClose: noop }))
    expect(html).toContain('Eerdere dag')
    expect(html).toContain('niet op vandaag')
  })

  it('landt op zijn eigen datum', () => {
    const gisteren = addDays(today(), -1)
    A.completeRun(gisteren, 'short', { plannedKm: 6, km: 6, minutes: 35, bike: false })
    expect(getState().runs[gisteren].date).toBe(gisteren)
    expect(getState().runs[today()]).toBeUndefined()
  })
})

describe('de weg naar het loopscherm', () => {
  it('opent vanaf de weekpagina, net als een krachtsessie', () => {
    const iso = loopdag()
    expect(dayActions(buildDay(getState(), iso)).some((a) => a.id === 'run')).toBe(true)
    expect(render(createElement(WeekScreen, { onOpenSession: noop, onOpenRun: noop })).length).toBeGreaterThan(500)
  })

  it('werkt voor het andere profiel met zijn eigen loopdagen', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: mondayOf(today()) }))
    const dinsdag = addDays(mondayOf(today()), 1)
    expect(buildDay(getState(), dinsdag).run?.kind).toBe('short')

    const html = render(createElement(RunScreen, { date: dinsdag, onClose: noop }))
    expect(html).toContain('Korte loop')
    expect(html).toContain('Werkelijk gelopen')
  })
})
