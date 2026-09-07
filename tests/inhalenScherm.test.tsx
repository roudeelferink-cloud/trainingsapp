import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MoveSheet } from '../src/components/MoveSheet'
import { buildDay, moveTargets } from '../src/logic/day'
import { addDays, formatShort, fromISO } from '../src/logic/dates'
import { missedSessions } from '../src/logic/gemist'
import { PlanScreen } from '../src/screens/PlanScreen'
import { Today } from '../src/screens/Today'
import * as A from '../src/store/actions'
import { ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'

/**
 * Inhalen op het scherm.
 *
 * Het venster en de verplaatsing zijn in `inhalen.test.ts` afgedekt; hier gaat het over
 * de plek. Een gemiste sessie die je alleen op de planpagina achter "Plannen" tegenkomt
 * is een gemiste sessie die je niet ziet — dus staat hij op Vandaag, boven de sessie van
 * vandaag, met wat je ermee kunt.
 */

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

const MA = '2026-09-07'
const DI = '2026-09-08'
const VORIGE_ZO = addDays(MA, -1)
const VORIGE_VR = addDays(MA, -3)

const noop = () => {}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(fromISO(DI))
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: addDays(MA, -21) }))
})

afterEach(() => vi.useRealTimers())

const vandaag = () => render(createElement(Today, { onOpenSession: noop, onOpenRun: noop }))

describe('het blok "Nog open" op Vandaag', () => {
  it('staat er met datum, naam en de drie dingen die je ermee kunt', () => {
    const html = vandaag()
    expect(html).toContain('Nog open')
    expect(html).toContain(formatShort(VORIGE_ZO))
    expect(html).toContain('Duurloop')
    expect(html).toContain('Vandaag doen')
    expect(html).toContain('Achteraf invullen')
    expect(html).toContain('Overslaan')
  })

  it('valt volledig weg als er niets meer open staat', () => {
    for (const m of missedSessions(getState())) A.skipSession(m.date, m.what, 'druk')
    expect(missedSessions(getState())).toEqual([])
    expect(vandaag()).not.toContain('Nog open')
  })

  it('haalt een opgepakte sessie meteen uit de lijst', () => {
    // maandag was benen A; vandaag staat duwen, dus dat is een conflict — schuif door
    expect(A.pickUpToday(MA, 'strength', 'shift').ok).toBe(true)
    const html = vandaag()
    expect(html).not.toContain(`${formatShort(MA)} · Benen A`)
  })
})

describe('een opgepakte sessie ziet eruit als een verplaatsing', () => {
  it('zet de dag waar hij vandaan komt boven de kop', () => {
    expect(A.pickUpToday(VORIGE_VR, 'strength', 'skip').ok).toBe(true)
    expect(buildDay(getState(), DI).strength?.movedFrom).toBe(VORIGE_VR)

    const html = vandaag()
    expect(html).toContain(`van ${formatShort(VORIGE_VR)}`)
    expect(html).toContain('Benen B')
  })
})

describe('de verplaatslijst', () => {
  it('noemt de kop "Vandaag of later" zodra vandaag erbij staat', () => {
    const html = render(
      createElement(MoveSheet, {
        open: true,
        onClose: noop,
        targets: moveTargets(getState(), VORIGE_ZO),
        hint: 'test',
        onPick: noop,
      }),
    )
    expect(html).toContain('Vandaag of later')
    expect(html).not.toContain('Later deze week')
  })

  it('houdt "Later deze week" bij een sessie die nog moet komen', () => {
    const html = render(
      createElement(MoveSheet, {
        open: true,
        onClose: noop,
        targets: moveTargets(getState(), addDays(DI, 3)),
        hint: 'test',
        onPick: noop,
      }),
    )
    expect(html).toContain('Later deze week')
    expect(html).not.toContain('Vandaag of later')
  })
})

describe('de planpagina', () => {
  it('biedt dezelfde drie acties bij wat er nog open staat', () => {
    const html = render(
      createElement(PlanScreen, {
        monday: MA,
        onClose: noop,
        onOpenSession: noop,
        onOpenRun: noop,
      }),
    )
    expect(html).toContain('Nog in te vullen')
    expect(html).toContain('Vandaag doen')
    expect(html).toContain('Invullen')
    expect(html).toContain('Overslaan')
  })

  it('telt op de pagina van deze week ook wat er van vorige week open staat', () => {
    const html = render(
      createElement(PlanScreen, {
        monday: MA,
        onClose: noop,
        onOpenSession: noop,
        onOpenRun: noop,
      }),
    )
    expect(html).toContain(formatShort(VORIGE_VR))
  })
})
