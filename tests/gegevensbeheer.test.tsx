import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../src/App'
import { Onboarding } from '../src/screens/Onboarding'
import { SettingsScreen, WisDialoog } from '../src/screens/SettingsScreen'
import {
  BLOCK_MS,
  MAX_ATTEMPTS,
  attempt,
  blockSecondsLeft,
  canConfirm,
  currentGuard,
  emptyGuard,
  isBlocked,
  isValidPin,
  registerAttempt,
  resetGuardForTests,
  sanitizePin,
} from '../src/logic/wipeGuard'
import { dataSummary, exportWarning } from '../src/logic/stats'
import * as A from '../src/store/actions'
import {
  ANOUC,
  ROB,
  changePin,
  getRoot,
  getState,
  getUser,
  hasPin,
  migrate,
  resetState,
  setCurrentUser,
  setPin,
  setState,
  setUserName,
  verifyPin,
  wipeUsers,
} from '../src/store/store'
import { DI, MON, baseState } from './helpers'

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

beforeEach(() => {
  resetState()
  resetGuardForTests()
})

/** Een gelogde sessie, loop en losse activiteit voor de huidige gebruiker. */
function vulHistorie(datum = MON) {
  setState((s) => ({
    ...s,
    startDate: MON,
    sessions: {
      [`${datum}:legs_a`]: {
        date: datum,
        kind: 'legs_a',
        short: false,
        completedAt: `${datum}T18:00:00.000Z`,
        skippedSlots: [],
        completedSlots: [],
        exercises: { 'legs_a:0': 'leg_press' },
        entries: { 'legs_a:0': [{ weight: 100, reps: 10, rir: 1, done: true }] },
      },
    },
    runs: {
      [DI]: { date: DI, kind: 'short', plannedKm: 6, km: 6.2, minutes: 35, bike: false, completedAt: 'x' },
    },
    activities: [
      {
        id: 'a1',
        date: DI,
        type: 'fietsen',
        minutes: 40,
        distanceKm: 12,
        intensity: 'rustig',
        note: null,
        createdAt: 'x',
      },
    ],
  }))
}

describe('eerste start: één keer kiezen wie je bent', () => {
  it('toont de keuze zolang er geen gebruiker gekozen is', () => {
    expect(getRoot().currentUser).toBe('')
    const html = render(createElement(App))
    expect(html).toContain('Welkom')
    expect(html).toContain('Wie ben je?')
    expect(html).toContain('Rob')
    expect(html).toContain('Anouc')
  })

  it('gaat na de keuze door naar de app, zonder de keuze te herhalen', () => {
    setCurrentUser(ANOUC)
    const html = render(createElement(App))
    expect(html).not.toContain('Welkom')
    expect(html).toContain('Vandaag')
  })

  it('laat het startscherm alleen de gebruikerskeuze zien', () => {
    const html = render(createElement(Onboarding, { onDone: () => {} }))
    expect(html).toContain('Wie ben je?')
    expect(html).toContain('Beginnen')
  })
})

describe('de onderbalk is van één gebruiker', () => {
  it('heeft geen gebruikersschakelaar meer', () => {
    setCurrentUser(ROB)
    setUserName(ANOUC, 'Anouc')
    const html = render(createElement(App))

    // drie bestemmingen, en de naam van de ander staat er niet tussen
    expect(html).toContain('Vandaag')
    expect(html).toContain('Week')
    expect(html).toContain('Historie')
    expect(html).not.toContain('Anouc')
    // instellingen hangt aan Historie en hoort niet in de balk
    expect(html).not.toContain('aria-current="page">Instellingen')
  })

  it('houdt het wisselen in de instellingen, onderaan', () => {
    setCurrentUser(ROB)
    const html = render(createElement(SettingsScreen))
    expect(html).toContain('Ander profiel gebruiken')
    // en het staat achter de gewone instellingen, niet erboven
    expect(html.indexOf('Ander profiel gebruiken')).toBeGreaterThan(html.indexOf('Gevoelige gebieden'))
  })
})

describe('van profiel wisselen wist niets', () => {
  it('houdt de historie van allebei', () => {
    setCurrentUser(ROB)
    vulHistorie()
    A.setCheckin(MON, 4)

    setCurrentUser(ANOUC)
    expect(getState().id).toBe(ANOUC)
    expect(Object.keys(getState().sessions)).toHaveLength(0)
    A.setCheckin(MON, 2)

    setCurrentUser(ROB)
    expect(Object.keys(getUser(ROB)!.sessions)).toHaveLength(1)
    expect(getUser(ROB)!.checkins[MON]).toBe(4)
    expect(getUser(ANOUC)!.checkins[MON]).toBe(2)
  })

  it('overleeft een herlaadbeurt', () => {
    setCurrentUser(ROB)
    vulHistorie()
    setCurrentUser(ANOUC)

    const herladen = migrate(JSON.parse(localStorage.getItem('trainingsapp.state.v1')!))
    expect(herladen.currentUser).toBe(ANOUC)
    expect(Object.keys(herladen.users[ROB].sessions)).toHaveLength(1)
  })
})

describe('pincode voor het wissen', () => {
  it('accepteert alleen vier cijfers', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12345')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
    expect(sanitizePin('1a2b3c4d5')).toBe('1234')
  })

  it('is er niet totdat je hem instelt', () => {
    expect(hasPin()).toBe(false)
    expect(verifyPin('0000')).toBe(false)
    expect(setPin('12')).toBe(false)
    expect(setPin('1234')).toBe(true)
    expect(hasPin()).toBe(true)
    expect(verifyPin('1234')).toBe(true)
    expect(verifyPin('4321')).toBe(false)
  })

  it('wijzigt alleen met de oude code erbij', () => {
    setPin('1234')
    expect(changePin('0000', '5678')).toBe(false)
    expect(verifyPin('1234')).toBe(true)
    expect(changePin('1234', '5678')).toBe(true)
    expect(verifyPin('5678')).toBe(true)
  })

  it('blijft staan na het wissen van gegevens', () => {
    setCurrentUser(ROB)
    setPin('1234')
    vulHistorie()
    wipeUsers([ROB])
    expect(hasPin()).toBe(true)
  })

  it('overleeft een herlaadbeurt en weigert onzin uit opgeslagen data', () => {
    setPin('1234')
    const herladen = migrate(JSON.parse(localStorage.getItem('trainingsapp.state.v1')!))
    expect(herladen.pin).toBe('1234')
    expect(migrate({ schemaVersion: 9, currentUser: '', users: {} }).pin).toBeNull()
    expect(migrate({ schemaVersion: 10, pin: 'abcd', users: {} }).pin).toBeNull()
  })
})

describe('de bevestigknop gaat pas aan bij de juiste code', () => {
  it('blijft uit bij een verkeerde, halve of ontbrekende code', () => {
    expect(canConfirm('1234', '1234')).toBe(true)
    expect(canConfirm('1234', '4321')).toBe(false)
    expect(canConfirm('1234', '12')).toBe(false)
    expect(canConfirm('1234', '')).toBe(false)
    // zonder ingestelde code kan er niets bevestigd worden
    expect(canConfirm(null, '1234')).toBe(false)
  })

  it('rendert de dialoog met een uitgeschakelde wisknop', () => {
    setCurrentUser(ROB)
    setPin('1234')
    vulHistorie()

    const html = render(
      createElement(WisDialoog, {
        open: true,
        onClose: () => {},
        onBlocked: () => {},
        onDone: () => {},
        gebruikerId: ROB,
      }),
    )

    // het veld is leeg, dus de knop staat uit
    expect(html).toContain('Definitief wissen')
    const knop = html.slice(html.indexOf('Definitief wissen') - 200, html.indexOf('Definitief wissen'))
    expect(knop).toContain('disabled=""')
  })

  it('vertelt in de dialoog wat er verdwijnt en waarschuwt over de back-up', () => {
    setCurrentUser(ROB)
    setPin('1234')
    vulHistorie()

    const html = render(
      createElement(WisDialoog, {
        open: true,
        onClose: () => {},
        onBlocked: () => {},
        onDone: () => {},
        gebruikerId: ROB,
      }),
    )

    expect(html).toContain('1 gelogde krachtsessies')
    expect(html).toContain('1 hardloopsessies')
    expect(html).toContain('1 losse activiteiten')
    expect(html).toContain('oudste log')
    // nooit geëxporteerd: waarschuwing met de exportknop bovenaan
    expect(html).toContain('nog nooit een back-up')
    expect(html).toContain('Eerst exporteren')
    expect(html.indexOf('Eerst exporteren')).toBeLessThan(html.indexOf('Definitief wissen'))
    // en het andere profiel blijft standaard staan
    expect(html).toContain('Ook het profiel van Anouc wissen')
    expect(html).toContain('aria-checked="false"')
  })

  it('laat de waarschuwing weg zodra er net geëxporteerd is', () => {
    setCurrentUser(ROB)
    setPin('1234')
    vulHistorie()
    setState((s) => ({ ...s, lastExportAt: new Date().toISOString() }))

    const html = render(
      createElement(WisDialoog, {
        open: true,
        onClose: () => {},
        onBlocked: () => {},
        onDone: () => {},
        gebruikerId: ROB,
      }),
    )
    expect(html).not.toContain('Eerst exporteren')
  })
})

describe('drie pogingen, daarna een minuut op slot', () => {
  const t0 = 1_000_000

  it('telt fouten en laat de goede code er meteen door', () => {
    let g = emptyGuard()
    const eerste = attempt(g, '1234', '0000', t0)
    expect(eerste.ok).toBe(false)
    expect(eerste.left).toBe(MAX_ATTEMPTS - 1)
    g = eerste.guard

    const goed = attempt(g, '1234', '1234', t0)
    expect(goed.ok).toBe(true)
    expect(goed.guard.attempts).toBe(0) // teller weer schoon
  })

  it('blokkeert na drie fouten en laat daarna niets door', () => {
    let g = emptyGuard()
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) g = attempt(g, '1234', '0000', t0).guard

    const derde = attempt(g, '1234', '9999', t0)
    expect(derde.blocked).toBe(true)
    expect(isBlocked(derde.guard, t0)).toBe(true)
    expect(blockSecondsLeft(derde.guard, t0)).toBe(60)

    // ook de juiste code komt er tijdens de blokkade niet doorheen
    expect(attempt(derde.guard, '1234', '1234', t0 + 1000).ok).toBe(false)
    expect(blockSecondsLeft(derde.guard, t0 + 30_000)).toBe(30)

    // en na een minuut mag het weer
    expect(isBlocked(derde.guard, t0 + BLOCK_MS + 1)).toBe(false)
    expect(attempt(derde.guard, '1234', '1234', t0 + BLOCK_MS + 1).ok).toBe(true)
  })

  it('houdt de blokkade vast buiten de dialoog om', () => {
    setPin('1234')
    for (let i = 0; i < MAX_ATTEMPTS; i++) registerAttempt('1234', '0000', t0)
    // de dialoog kan dicht en weer open: de teller van dit toestel loopt door
    expect(isBlocked(currentGuard(), t0)).toBe(true)
    expect(blockSecondsLeft(currentGuard(), t0)).toBe(60)
    expect(registerAttempt('1234', '1234', t0).ok).toBe(false)
  })
})

describe('waarschuwing over de back-up', () => {
  const nu = new Date('2026-08-15T12:00:00.000Z')

  it('waarschuwt als er nog nooit geëxporteerd is', () => {
    expect(exportWarning(baseState({ lastExportAt: null }), nu)).toContain('nooit')
  })

  it('waarschuwt vanaf zeven dagen oud, en niet daarvoor', () => {
    const dagen = (n: number) =>
      baseState({ lastExportAt: new Date(nu.getTime() - n * 86400000).toISOString() })

    expect(exportWarning(dagen(6), nu)).toBeNull()
    expect(exportWarning(dagen(7), nu)).toContain('7 dagen')
    expect(exportWarning(dagen(30), nu)).toContain('30 dagen')
  })

  it('waarschuwt bij een onleesbare datum', () => {
    expect(exportWarning(baseState({ lastExportAt: 'onzin' }), nu)).toContain('Onbekend')
  })
})

describe('wat er precies verdwijnt', () => {
  it('telt sessies, loops en activiteiten en vindt de oudste log', () => {
    setCurrentUser(ROB)
    vulHistorie()
    const s = dataSummary(getState())
    expect(s.sessions).toBe(1)
    expect(s.runs).toBe(1)
    expect(s.activities).toBe(1)
    expect(s.oldest).toBe(MON)
  })

  it('meldt netjes dat er niets is', () => {
    expect(dataSummary(baseState())).toEqual({ sessions: 0, runs: 0, activities: 0, oldest: null })
  })
})

describe('wissen geldt per gebruiker', () => {
  beforeEach(() => {
    setCurrentUser(ROB)
    vulHistorie()
    setCurrentUser(ANOUC)
    vulHistorie()
    setCurrentUser(ROB)
    setPin('1234')
  })

  it('wist alleen de actieve gebruiker', () => {
    wipeUsers([ROB])

    expect(Object.keys(getUser(ROB)!.sessions)).toHaveLength(0)
    expect(Object.keys(getUser(ROB)!.runs)).toHaveLength(0)
    expect(getUser(ROB)!.activities).toHaveLength(0)
    // de ander blijft volledig staan
    expect(Object.keys(getUser(ANOUC)!.sessions)).toHaveLength(1)
    expect(getUser(ANOUC)!.activities).toHaveLength(1)
  })

  it('wist allebei als daar expliciet om gevraagd wordt', () => {
    wipeUsers([ROB, ANOUC])
    expect(Object.keys(getUser(ROB)!.sessions)).toHaveLength(0)
    expect(Object.keys(getUser(ANOUC)!.sessions)).toHaveLength(0)
  })

  it('houdt de naam van het profiel, want dat is geen historie', () => {
    setUserName(ROB, 'Robbert')
    wipeUsers([ROB])
    expect(getUser(ROB)!.naam).toBe('Robbert')
  })

  it('keert terug naar de eerste-start-keuze in plaats van een leeg scherm', () => {
    wipeUsers([ROB])
    expect(getRoot().currentUser).toBe('')
    expect(render(createElement(App))).toContain('Wie ben je?')
  })

  it('bewaart alles ook echt in localStorage', () => {
    wipeUsers([ROB])
    const herladen = migrate(JSON.parse(localStorage.getItem('trainingsapp.state.v1')!))
    expect(Object.keys(herladen.users[ROB].sessions)).toHaveLength(0)
    expect(Object.keys(herladen.users[ANOUC].sessions)).toHaveLength(1)
  })
})

describe('het wisscherm in de instellingen', () => {
  it('staat onderaan, apart en dichtgeklapt', () => {
    setCurrentUser(ROB)
    const html = render(createElement(SettingsScreen))

    expect(html).toContain('Gegevensbeheer')
    expect(html).toContain('aria-expanded="false"')
    // de knop zelf zit nog achter het dichtgeklapte blok
    expect(html).not.toContain('Gegevens wissen')
    expect(html).not.toContain('Definitief wissen')
    // en het staat helemaal onderaan
    expect(html.indexOf('Gegevensbeheer')).toBeGreaterThan(html.indexOf('Back-up'))
  })
})
