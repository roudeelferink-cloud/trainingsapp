import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildDay, moveTargets } from '../src/logic/day'
import { addDays, mondayOf, today, weekday } from '../src/logic/dates'
import { Today } from '../src/screens/Today'
import { WeekScreen, dayActions } from '../src/screens/WeekScreen'
import * as A from '../src/store/actions'
import {
  ANOUC,
  ROB,
  getRoot,
  getState,
  migrate,
  replaceRoot,
  resetState,
  setCurrentUser,
  setState,
} from '../src/store/store'
import { DI, DO, MON, VR, WO, ZA, ZO } from './helpers'

/** Opnieuw opstarten met wat er in localStorage staat. */
function herlaad() {
  const opgeslagen = localStorage.getItem('trainingsapp.state.v1')
  expect(opgeslagen).not.toBeNull()
  replaceRoot(migrate(JSON.parse(opgeslagen!)))
}

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: MON }))
})

describe('een loop verplaatsen', () => {
  it('haalt de loop van de oorspronkelijke dag en zet hem op de nieuwe', () => {
    // dinsdag is een korte loop, vrijdag heeft er geen
    expect(buildDay(getState(), DI).run?.kind).toBe('short')
    expect(buildDay(getState(), VR).run).toBeNull()

    expect(A.moveRun(DI, VR).ok).toBe(true)

    const van = buildDay(getState(), DI)
    expect(van.run).toBeNull()
    expect(van.runMovedTo).toBe(VR)
    // de krachtsessie van dinsdag blijft gewoon staan
    expect(van.strength?.kind).toBe('push')

    const naar = buildDay(getState(), VR)
    expect(naar.run?.kind).toBe('short')
    expect(naar.run?.movedFrom).toBe(DI)
  })

  it('verplaatst ook de duurloop', () => {
    const maandagDaarna = addDays(ZO, 1)
    expect(A.moveRun(ZO, maandagDaarna).ok).toBe(true)
    expect(buildDay(getState(), ZO).run).toBeNull()
    expect(buildDay(getState(), maandagDaarna).run?.kind).toBe('long')
  })

  it('ruilt met de loop die er al stond', () => {
    // dinsdag en donderdag hebben allebei een korte loop; zondag is de duurloop
    expect(A.moveRun(DI, ZO).ok).toBe(true)

    expect(buildDay(getState(), ZO).run?.kind).toBe('short')
    expect(buildDay(getState(), DI).run?.kind).toBe('long')
    expect(getState().runMoves).toEqual({ [DI]: ZO, [ZO]: DI })
  })

  it('maakt de verplaatsing weer ongedaan', () => {
    A.moveRun(DI, VR)
    A.undoRunMove(DI)

    expect(getState().runMoves).toEqual({})
    expect(buildDay(getState(), DI).run?.kind).toBe('short')
    expect(buildDay(getState(), VR).run).toBeNull()
  })

  it('laat de krachtsessie met rust en andersom', () => {
    A.moveRun(DI, VR) // loop van dinsdag naar vrijdag
    A.moveSession(DI, DO) // krachtsessie van dinsdag ruilt met donderdag

    const di = buildDay(getState(), DI)
    expect(di.run).toBeNull() // loop is weg
    expect(di.runMovedTo).toBe(VR)
    expect(di.strength?.kind).toBe('pull') // en de geruilde krachtsessie staat er

    expect(buildDay(getState(), VR).run?.movedFrom).toBe(DI)
    expect(buildDay(getState(), DO).strength?.kind).toBe('push')
    // de twee lijsten staan los van elkaar
    expect(getState().moves).toEqual({ [DI]: DO, [DO]: DI })
    expect(getState().runMoves).toEqual({ [DI]: VR })
  })

  it('weigert een dag die niet mag', () => {
    // woensdag is de vaste rustdag van dit programma: hij staat er wel, maar geblokkeerd
    const woensdag = moveTargets(getState(), DI, 'run').filter((t) => weekday(t.date) === 3)
    expect(woensdag.length).toBeGreaterThan(0)
    expect(woensdag.every((t) => t.blocked !== null)).toBe(true)
    expect(A.moveRun(DI, WO).ok).toBe(false)
    expect(getState().runMoves).toEqual({})

    // en een dag zonder loop is geen vertrekpunt
    expect(A.moveRun(MON, VR).ok).toBe(false)
  })

  it('bouwt geen ketens: een al verplaatste dag valt af', () => {
    A.moveRun(DI, VR)
    // vrijdag heeft nu een verplaatste loop en dinsdag is zelf verplaatst
    expect(moveTargets(getState(), ZO, 'run').some((t) => t.date === VR)).toBe(false)
    expect(moveTargets(getState(), MON, 'run').some((t) => t.date === DI)).toBe(false)
  })

  it('houdt alleen de rustdag geblokkeerd; de rest is een keuze met uitleg', () => {
    // een beensessie naar zaterdag mag, maar niet zonder waarschuwing: zondag is de duurloop
    const zaterdag = moveTargets(getState(), MON, 'strength').find((t) => t.date === ZA)!
    expect(zaterdag.blocked).toBeNull()
    expect(zaterdag.warnings.length).toBeGreaterThan(0)
    expect(zaterdag.warnings.join(' ')).toContain('duurloop')

    // en de loop zelf heeft nergens een waarschuwing nodig
    const loopdagen = moveTargets(getState(), VR, 'run').filter((t) => t.blocked === null)
    expect(loopdagen.length).toBeGreaterThan(0)
  })
})

describe('per gebruiker', () => {
  it('raakt het schema van de ander niet', () => {
    A.moveRun(DI, VR)
    expect(getState().runMoves).toEqual({ [DI]: VR })

    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    expect(getState().runMoves).toEqual({})
    expect(buildDay(getState(), DI).run?.kind).toBe('short')
  })

  it('werkt ook in het schema van de tweede gebruiker', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))

    // Anouc loopt dinsdag, vrijdag en zondag; maandag is haar rustdag
    expect(buildDay(getState(), DI).run).not.toBeNull()
    expect(buildDay(getState(), MON).isRest).toBe(true)
    expect(
      moveTargets(getState(), DI, 'run')
        .filter((t) => weekday(t.date) === 1)
        .every((t) => t.blocked !== null),
    ).toBe(true)

    expect(A.moveRun(DI, DO).ok).toBe(true)
    expect(buildDay(getState(), DO).run?.movedFrom).toBe(DI)
    expect(buildDay(getState(), DI).run).toBeNull()

    // en de staat van Rob is er niet door veranderd
    setCurrentUser(ROB)
    expect(getState().runMoves).toEqual({})
  })

  it('houdt de verplaatsing van beide gebruikers uit elkaar na een herlaadbeurt', () => {
    A.moveRun(DI, VR) // Rob: dinsdag naar vrijdag

    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    A.moveRun(DI, DO) // Anouc: dinsdag naar donderdag

    herlaad()

    const root = getRoot()
    expect(root.users[ROB].runMoves).toEqual({ [DI]: VR })
    expect(root.users[ANOUC].runMoves).toEqual({ [DI]: DO })

    // en beide schema's rekenen na de herlaadbeurt met hun eigen verplaatsing
    expect(buildDay(root.users[ROB], VR).run?.movedFrom).toBe(DI)
    expect(buildDay(root.users[ROB], DO).run?.movedFrom).toBeNull() // eigen donderdagloop
    expect(buildDay(root.users[ANOUC], DO).run?.movedFrom).toBe(DI)
    expect(buildDay(root.users[ANOUC], VR).run?.movedFrom).toBeNull()
  })
})

describe('in de schermen', () => {
  /** Deze week, zodat de weekpagina de dagen ook echt toont. */
  const dezeWeek = (dagen: number) => addDays(mondayOf(today()), dagen)

  it('zet op de weekpagina waar de loop naartoe ging', () => {
    const di = dezeWeek(1)
    const do_ = dezeWeek(3)
    setState((s) => ({ ...s, startDate: mondayOf(today()), runMoves: { [di]: do_ } }))

    const html = render(createElement(WeekScreen, { onOpenSession: () => {} }))
    expect(html).toContain('loop verplaatst naar')
    // de krachtsessie van die dinsdag staat er nog gewoon
    expect(buildDay(getState(), di).strength?.kind).toBe('push')
  })

  it('laat elke loop van de week vanaf de weekpagina verplaatsen', () => {
    setState((s) => ({ ...s, startDate: mondayOf(today()) }))
    const loopdagen = [1, 3, 6].map((d) => dezeWeek(d))

    // de dagregel ís de knop; wat je ermee kunt staat in dayActions
    for (const iso of loopdagen) {
      const plan = buildDay(getState(), iso)
      expect(plan.run, iso).not.toBeNull()
      expect(dayActions(plan).map((a) => a.id), iso).toContain('move')
    }
    // en op een dag met loop én kracht kun je allebei bereiken
    const dinsdag = buildDay(getState(), dezeWeek(1))
    expect(dinsdag.strength).not.toBeNull()
    expect(dayActions(dinsdag).map((a) => a.id)).toEqual(['move', 'open'])

    // de regels staan ook echt als knop op het scherm
    const html = render(createElement(WeekScreen, { onOpenSession: () => {} }))
    expect(html).toContain('kies wat je doet')
  })

  it('laat een verplaatste loop op de weekpagina op de nieuwe dag zien', () => {
    const zondag = dezeWeek(6)
    const maandag = dezeWeek(0)
    setState((s) => ({ ...s, startDate: mondayOf(today()) }))

    // dit is precies wat de knop op de weekpagina doet
    expect(A.moveRun(zondag, addDays(zondag, 1)).ok).toBe(true)

    const html = render(createElement(WeekScreen, { onOpenSession: () => {} }))
    expect(html).toContain('loop verplaatst naar')
    expect(buildDay(getState(), maandag).run).toBeNull() // maandag van dezelfde week, niet de volgende
    expect(buildDay(getState(), addDays(zondag, 1)).run?.movedFrom).toBe(zondag)
  })

  it('toont geen verplaatsknop bij een afgevinkte of overgeslagen loop', () => {
    const dinsdag = dezeWeek(1)
    setState((s) => ({ ...s, startDate: mondayOf(today()) }))
    const run = buildDay(getState(), dinsdag).run!

    A.completeRun(dinsdag, run.kind, { plannedKm: run.km, km: run.km, minutes: 30, bike: false })
    A.skipSession(dezeWeek(3), 'run', 'druk')

    // alleen de zondagloop is nog te verplaatsen
    const teVerplaatsen = [0, 1, 2, 3, 4, 5, 6]
      .map((d) => dezeWeek(d))
      .filter((iso) => dayActions(buildDay(getState(), iso)).some((a) => a.id === 'move'))
    expect(teVerplaatsen).toEqual([dezeWeek(6)])

    // het scherm rendert die stand zonder te struikelen
    expect(render(createElement(WeekScreen, { onOpenSession: () => {} })).length).toBeGreaterThan(500)
  })

  it('geeft de loop van vandaag een verplaatsknop en een terugknop', () => {
    setState((s) => ({ ...s, startDate: mondayOf(today()) }))
    const iso = today()
    const html = render(createElement(Today, { onOpenSession: () => {} }))

    // staat er vandaag geen loop (rustdag of een dag zonder loop), dan valt er ook
    // niets te verplaatsen en hoort er geen melding te staan
    if (!buildDay(getState(), iso).run) {
      expect(html).not.toContain('Loop verplaatst naar')
      return
    }

    expect(html).toContain('Verplaatsen')

    setState((s) => ({ ...s, runMoves: { [iso]: addDays(iso, 1) } }))
    const na = render(createElement(Today, { onOpenSession: () => {} }))
    expect(buildDay(getState(), iso).run).toBeNull()
    expect(na).toContain('Loop verplaatst naar')
    expect(na).toContain('Verplaatsing ongedaan maken')
  })
})
