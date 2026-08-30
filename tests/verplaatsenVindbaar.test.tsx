import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDay } from '../src/logic/day'
import { addDays, formatShort, fromISO, mondayOf, today } from '../src/logic/dates'
import { RunScreen } from '../src/screens/RunScreen'
import { SessionScreen } from '../src/screens/SessionScreen'
import { Today } from '../src/screens/Today'
import * as A from '../src/store/actions'
import { ANOUC, ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'

/**
 * Verplaatsen was gebouwd maar werd niet gevonden.
 *
 * Het zat op precies twee plekken: in het blad achter de knop "Meer" onderin Vandaag, en
 * als knop bij een bijsturing die zelden vuurt. Vanaf de sessie zelf was er geen weg
 * naartoe, en op de weekpagina alleen voor een loop. Deze tests leggen vast dát het op de
 * pagina staat — niet in een blad dat je eerst moet openen.
 */

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

const noop = () => {}

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: mondayOf(today()) }))
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Zet de klok op de dinsdag van deze week: bij Rob staat daar een korte loop én de
 * duwsessie. Zonder dat hangt "wat er vandaag staat" af van de dag waarop de suite draait.
 */
function opDinsdag(): string {
  const dinsdag = addDays(mondayOf(today()), 1)
  vi.useFakeTimers()
  vi.setSystemTime(fromISO(dinsdag))
  return dinsdag
}

/** De eerstvolgende dag van deze week met een krachtsessie. */
function sessiedag(): string {
  const maandag = mondayOf(today())
  for (let d = 0; d < 7; d++) {
    const iso = addDays(maandag, d)
    if (buildDay(getState(), iso).strength) return iso
  }
  throw new Error('geen krachtsessie deze week')
}

describe('vanaf Vandaag', () => {
  it('zet verplaatsen in de pagina zelf, niet alleen in het blad onder Meer', () => {
    opDinsdag()
    const html = render(createElement(Today, { onOpenSession: noop, onOpenRun: noop }))

    expect(html).toContain('Niet vandaag?')
    expect(html).toContain('Verplaatsen')
  })

  it('noemt per ding van die dag wat je verplaatst', () => {
    const dinsdag = opDinsdag()
    const plan = buildDay(getState(), dinsdag)
    expect(plan.run).not.toBeNull()
    expect(plan.strength).not.toBeNull()

    const html = render(createElement(Today, { onOpenSession: noop, onOpenRun: noop }))
    // twee regels: de loop en de krachtsessie, elk met een eigen knop
    expect(html).toContain('Korte loop')
    expect(html).toContain(plan.strength!.naam)
    expect(html.split('>Verplaatsen<').length - 1).toBe(2)
  })

  it('zegt waar het naartoe ging en biedt de weg terug', () => {
    const iso = opDinsdag()
    setState((s) => ({ ...s, runMoves: { [iso]: addDays(iso, 1) }, moves: { [iso]: addDays(iso, 1) } }))
    const html = render(createElement(Today, { onOpenSession: noop, onOpenRun: noop }))

    expect(html).toContain('Verplaatst')
    expect(html).toContain(`Loop verplaatst naar ${formatShort(addDays(iso, 1))}`)
    expect(html).toContain('Krachtsessie verplaatst naar')
    expect(html).toContain('Verplaatsing ongedaan maken')
  })

  it('laat het blok weg op een dag zonder iets te verplaatsen', () => {
    const iso = opDinsdag()
    A.skipSession(iso, 'run', 'druk')
    A.skipSession(iso, 'strength', 'druk')

    const html = render(createElement(Today, { onOpenSession: noop, onOpenRun: noop }))
    expect(html).not.toContain('Niet vandaag?')
  })
})

describe('vanaf de sessie zelf', () => {
  it('staat op de warming-up, de eerste stap van de sessie', () => {
    const iso = sessiedag()
    const kind = buildDay(getState(), iso).strength!.kind
    const html = render(createElement(SessionScreen, { date: iso, kind, onClose: noop }))

    expect(html).toContain('Deze sessie')
    expect(html).toContain('Verplaatsen')
  })

  it('gaat op slot zodra er sets afgevinkt zijn', () => {
    const iso = sessiedag()
    const strength = buildDay(getState(), iso).strength!
    const r = strength.slots[0]

    A.saveSessionDraft(
      iso,
      strength.kind,
      { [r.slot.key]: [{ weight: 40, reps: 10, rir: 2, done: true }] },
      { [r.slot.key]: r.exercise.id },
      strength.short,
      [],
    )

    const html = render(createElement(SessionScreen, { date: iso, kind: strength.kind, onClose: noop }))
    // de knop staat er nog wel, maar uitgeschakeld: het log hangt aan deze datum
    expect(html).toContain('Verplaatsen')
    expect(html).toContain('disabled=""')
  })

  it('doet hetzelfde op het loopscherm', () => {
    const maandag = mondayOf(today())
    const loopdag = [0, 1, 2, 3, 4, 5, 6]
      .map((d) => addDays(maandag, d))
      .find((iso) => buildDay(getState(), iso).run)!

    const html = render(createElement(RunScreen, { date: loopdag, onClose: noop }))
    expect(html).toContain('Verplaatsen')
  })
})

describe('het blijft één implementatie', () => {
  it('verplaatst overal via dezelfde acties en dezelfde staat', () => {
    const iso = sessiedag()
    const doel = [1, 2, 3].map((d) => addDays(iso, d)).find((d) => {
      const plan = buildDay(getState(), d)
      return !plan.isRest
    })!

    expect(A.moveSession(iso, doel).ok).toBe(true)
    expect(getState().moves[iso]).toBe(doel)
    expect(buildDay(getState(), doel).strength?.movedFrom).toBe(iso)
  })

  it('werkt voor het andere profiel met zijn eigen rustdag', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: mondayOf(today()) }))
    const woensdag = addDays(mondayOf(today()), 2)
    const kind = buildDay(getState(), woensdag).strength!.kind

    const html = render(createElement(SessionScreen, { date: woensdag, kind, onClose: noop }))
    expect(html).toContain('Deze sessie')
    expect(html).toContain('Verplaatsen')
  })
})
