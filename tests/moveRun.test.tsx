import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildDay, moveTargets } from '../src/logic/day'
import { addDays, mondayOf, today, weekday } from '../src/logic/dates'
import { Today } from '../src/screens/Today'
import { WeekScreen } from '../src/screens/WeekScreen'
import * as A from '../src/store/actions'
import { ANOUC, ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'
import { DI, DO, MON, VR, WO, ZA, ZO } from './helpers'

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
    // woensdag is de vaste rustdag van dit programma
    expect(moveTargets(getState(), DI, 'run').some((t) => weekday(t.date) === 3)).toBe(false)
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

  it('blokkeert loopdagen niet zoals beensessies op zaterdag', () => {
    // een beensessie mag niet naar zaterdag, een loop wel
    expect(moveTargets(getState(), MON, 'strength').find((t) => t.date === ZA)?.blocked).not.toBeNull()
    expect(moveTargets(getState(), VR, 'run').every((t) => t.blocked === null)).toBe(true)
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
    expect(moveTargets(getState(), DI, 'run').every((t) => weekday(t.date) !== 1)).toBe(true)

    expect(A.moveRun(DI, DO).ok).toBe(true)
    expect(buildDay(getState(), DO).run?.movedFrom).toBe(DI)
    expect(buildDay(getState(), DI).run).toBeNull()

    // en de staat van Rob is er niet door veranderd
    setCurrentUser(ROB)
    expect(getState().runMoves).toEqual({})
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
