import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { MoveSheet } from '../src/components/MoveSheet'
import { moveTargets } from '../src/logic/day'
import { formatShort } from '../src/logic/dates'
import { getState, resetState, setState } from '../src/store/store'
import { DI, MON, VR, WO, baseState } from './helpers'

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

beforeEach(() => {
  resetState()
  setState((s) => ({ ...s, startDate: MON }))
})

const noop = () => {}

describe('de keuzelijst bij verplaatsen', () => {
  it('toont beide richtingen met een kopje', () => {
    const html = render(
      createElement(MoveSheet, {
        open: true,
        onClose: noop,
        targets: moveTargets(getState(), VR),
        hint: 'test',
        onPick: noop,
      }),
    )
    expect(html).toContain('Naar voren halen')
    expect(html).toContain('Later deze week')
    expect(html).toContain(formatShort(MON))
  })

  it('toont de rustdag grijs met de reden', () => {
    const html = render(
      createElement(MoveSheet, {
        open: true,
        onClose: noop,
        targets: moveTargets(getState(), VR),
        hint: 'test',
        onPick: noop,
      }),
    )
    expect(html).toContain(formatShort(WO))
    expect(html).toContain('Rustdag')
  })

  it('zet de waarschuwing bij de dag zelf, zonder hem uit te schakelen', () => {
    // benen B naar dinsdag: dan staan er twee zware beendagen achter elkaar
    const targets = moveTargets(baseState(), VR)
    const dinsdag = targets.find((t) => t.date === DI)!
    expect(dinsdag.warnings.length).toBeGreaterThan(0)

    const html = render(
      createElement(MoveSheet, { open: true, onClose: noop, targets, hint: 'test', onPick: noop }),
    )
    expect(html).toContain('zwaar beenwerk')
    // de dag is nog steeds een knop, geen uitgeschakelde regel; de waarschuwing
    // markeert hem met de accentrand in plaats van hem weg te zetten
    expect(html).toContain('<button class="btn-ghost w-full flex-col !items-start py-2 text-list border-accent"')
  })

  it('noemt de ruil als er al iets staat', () => {
    const html = render(
      createElement(MoveSheet, {
        open: true,
        onClose: noop,
        targets: moveTargets(getState(), MON),
        hint: 'test',
        onPick: noop,
      }),
    )
    expect(html).toContain('ruilt met')
  })
})
