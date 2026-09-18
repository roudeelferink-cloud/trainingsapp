import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BikeSwapSheet } from '../src/components/BikeSwapSheet'
import { addDays, fromISO } from '../src/logic/dates'
import { BikeScreen } from '../src/screens/BikeScreen'
import { HistoryScreen } from '../src/screens/HistoryScreen'
import { PlanScreen } from '../src/screens/PlanScreen'
import { SessionScreen } from '../src/screens/SessionScreen'
import { Today } from '../src/screens/Today'
import { WeekScreen } from '../src/screens/WeekScreen'
import * as A from '../src/store/actions'
import { ANOUC, ROB, resetState, setCurrentUser, setState } from '../src/store/store'
import { DI, DO, MON, VR } from './helpers'

const render = (el: Parameters<typeof renderToString>[0]) => renderToString(el).replace(/<!-- -->/g, '')
const noop = () => {}

function klokOp(iso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(fromISO(iso).getTime() + 9 * 3600_000))
}

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: MON, settings: { ...s.settings, bodyweightKg: 82 } }))
  klokOp(MON)
})

afterEach(() => vi.useRealTimers())

const vandaag = () => render(createElement(Today, { onOpenSession: noop, onOpenRun: noop }))

describe('het keuzeblad', () => {
  it('stelt één variant voor met de reden, en biedt de andere eronder', () => {
    const html = render(createElement(BikeSwapSheet, { open: true, iso: MON, naam: 'Benen A', onClose: noop }))
    expect(html).toContain('Vervang door fietsen')
    expect(html).toContain('Voorstel')
    expect(html).toContain('Beensessie: kracht-duur houdt de benen aan het werk.')
    // het voorstel eerst, dan de ander
    expect(html.indexOf('Kracht-duur · ~43 min')).toBeLessThan(html.indexOf('Rustige duurrit · ~40 min'))
  })

  it('zet de duurrit voorop bij zware benen, met de extra regel', () => {
    A.setDayCheckLegs(MON, 'zwaar')
    const html = render(createElement(BikeSwapSheet, { open: true, iso: MON, naam: 'Benen A', onClose: noop }))
    expect(html.indexOf('Rustige duurrit · ~40 min')).toBeLessThan(html.indexOf('Kracht-duur'))
    expect(html).toContain('Lichte weerstand, cadans niet onder 85.')
  })
})

describe('Vandaag', () => {
  it('toont een vervangen sessie als fietstraining, met de knop naar de rit', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    const html = vandaag()
    expect(html).toContain('Kracht-duur · vervangt Benen A')
    expect(html).toContain('43')
    expect(html).toContain('min fietsen')
    expect(html).toContain('Start fietsen')
    expect(html).not.toContain('overgeslagen')
    expect(html).not.toContain('Start sessie')
  })

  it('zegt "Rit bekijken" als hij gereden is', () => {
    A.replaceWithBike(MON, 'duurrit')
    A.completeBikeSwap(MON, 42, null)
    expect(vandaag()).toContain('Rit bekijken')
  })

  it('zet een vervangen sessie niet onder "Nog open"', () => {
    A.replaceWithBike(MON, 'duurrit')
    klokOp(DI)
    const html = vandaag()
    // de week vóór de start staat wel open (die telt het venster mee); maandag niet
    expect(html).toContain('Nog open')
    expect(html).not.toContain('3 aug · Benen A')
    A.undoSkip(MON, 'strength') // zonder de vervanging zou hij er wél staan
    expect(vandaag()).toContain('3 aug · Benen A')
  })

  it('toont de beenprioriteitsregel bij twee vervangen beensessies', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    A.replaceWithBike(VR, 'kracht_duur')
    klokOp(VR)
    expect(vandaag()).toContain(
      '2 beensessies vervangen door fietsen in 14 dagen — fietsen vervangt geen zwaar beenwerk.',
    )
  })

  it('toont die regel niet bij Anouc', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    klokOp(addDays(MON, 2))
    A.replaceWithBike(addDays(MON, 2), 'duurrit')
    A.replaceWithBike(addDays(MON, 5), 'kracht_duur')
    klokOp(addDays(MON, 5))
    expect(vandaag()).not.toContain('beensessies vervangen')
  })
})

describe('het sessiescherm', () => {
  it('biedt "Vervang door fietsen" naast verplaatsen', () => {
    const html = render(createElement(SessionScreen, { date: MON, kind: 'legs_a', onClose: noop }))
    expect(html).toContain('Vervang door fietsen')
  })
})

describe('Plannen', () => {
  it('biedt fietsen voor vandaag en later, en toont een vervangen sessie als rit', () => {
    let html = render(
      createElement(PlanScreen, { monday: MON, onClose: noop, onOpenSession: noop, onOpenRun: noop }),
    )
    expect(html).toContain('>Fietsen<')

    A.replaceWithBike(DO, 'duurrit')
    html = render(
      createElement(PlanScreen, { monday: MON, onClose: noop, onOpenSession: noop, onOpenRun: noop }),
    )
    expect(html).toContain('Fietsen · rustige duurrit')
    expect(html).toContain('vervangt Trekken')
    expect(html).toContain('Terughalen')
  })
})

describe('het fietsscherm', () => {
  it('toont het blokkenschema met een startknop', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    const html = render(createElement(BikeScreen, { date: MON, onClose: noop }))
    expect(html).toContain('Kracht-duur')
    expect(html).toContain('vervangt Benen A')
    expect(html).toContain('Inrijden')
    expect(html).toContain('Zwaar blok 1 van 5')
    expect(html).toContain('Zwaar blok 5 van 5')
    expect(html).toContain('Uitrijden')
    expect(html).toContain('Nooit onder cadans 75')
    expect(html).toContain('>Start<')
  })

  it('neemt een lopende rit op waar hij was, ook na scherm-uit of herladen', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    const start = Date.now() - 11 * 60_000 // 11 minuten geleden gestart: blok 1, 3 min over
    localStorage.setItem(`trainingsapp.fietsrit.${ROB}.${MON}`, String(start))
    const html = render(createElement(BikeScreen, { date: MON, onClose: noop }))
    expect(html).toContain('3:00')
    expect(html).toContain('Afronden')
    expect(html).toContain('Hierna: rustig trappen · 2 min')
    localStorage.removeItem(`trainingsapp.fietsrit.${ROB}.${MON}`)
  })

  it('heeft in de deloadweek drie zware blokken', () => {
    const deload = addDays(MON, 49)
    klokOp(deload)
    A.replaceWithBike(deload, 'kracht_duur')
    const html = render(createElement(BikeScreen, { date: deload, onClose: noop }))
    expect(html).toContain('Zwaar blok 3 van 3')
    expect(html).not.toContain('van 5')
    expect(html).toContain('deloadweek: 3 blokken')
  })

  it('zet de extra regel bij de duurrit als de knie gemeld is', () => {
    A.setDayCheckPain(MON, 'knie')
    A.replaceWithBike(MON, 'duurrit')
    const html = render(createElement(BikeScreen, { date: MON, onClose: noop }))
    expect(html).toContain('Lichte weerstand, cadans niet onder 85.')
  })
})

describe('week en historie', () => {
  it('telt een vervangen sessie als gedaan en toont de fietsminuten', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    A.completeBikeSwap(MON, 43, 18)
    A.addActivity(DI, { type: 'fietsen', minutes: 30, intensity: 'rustig' })
    const html = render(createElement(WeekScreen, { onOpenSession: noop, onOpenRun: noop }))
    expect(html).toContain('Fietsen (kracht-duur)')
    expect(html).toContain('vervangt Benen A')
    // 43 + 30 minuten fietsen deze week
    expect(html).toContain('73')
    expect(html).toMatch(/Sessies<\/div><div[^>]*>1<span[^>]*> \/ \d+/)
  })

  it('zet de rit in de historie als activiteit die kracht vervangt', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    A.completeBikeSwap(MON, 43, 18)
    const html = render(createElement(HistoryScreen, { onOpenSettings: noop }))
    expect(html).toContain('Vervangt kracht')
    expect(html).toContain('Fietsen 43 min · 18 km · kracht-duur')
  })
})
