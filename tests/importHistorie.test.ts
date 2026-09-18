import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ANOUC,
  ROB,
  defaultUser,
  getRoot,
  getState,
  getUser,
  importJSON,
  replaceRoot,
  resetState,
  setCurrentUser,
  setPin,
} from '../src/store/store'
import { historyFor, loggedExercises } from '../src/logic/history'
import { completedRuns, completedSessions } from '../src/logic/stats'
import type { SessionLog, UserState } from '../src/types'

/**
 * Importeren neemt de historie mee: sessielogs, loops en dagchecks, per profiel.
 *
 * Twee echte exports als fixture: één van de Pages-versie (schema v14, met de oude
 * `checkins`) en één van nu (v18). En het geval dat in de praktijk telt: één profiel per
 * toestel. Een export bevat altijd beide profielen, en op een toestel dat maar door één
 * persoon gebruikt wordt is het andere profiel leeg. Zo'n leeg profiel mag de historie
 * van dit toestel niet overschrijven, en het bestand mag niet bepalen wie dit toestel
 * gebruikt.
 */

function fixture(naam: string): Record<string, any> {
  return JSON.parse(readFileSync(new URL(`./fixtures/${naam}`, import.meta.url), 'utf8'))
}

const V14 = fixture('export-pages-v14.json')
const V18 = fixture('export-v18.json')

/** Wat er in een bestand staat, geteld zoals de app het na import hoort te hebben. */
function verwacht(user: Record<string, any>) {
  return {
    sessies: Object.keys(user.sessions ?? {}).length,
    loops: Object.keys(user.runs ?? {}).length,
    // v14: één check-in (benen) per dag; v18: de dagchecks zelf
    checks: user.checkins
      ? Object.keys(user.checkins).length
      : Object.keys(user.dayChecks ?? {}).length,
  }
}

function geteld(user: UserState) {
  return {
    sessies: Object.keys(user.sessions).length,
    loops: Object.keys(user.runs).length,
    checks: Object.keys(user.dayChecks).length,
  }
}

/** Wat Historie en de pagina per oefening van het actieve profiel laten zien. */
function historie() {
  const s = getState()
  return {
    sessies: completedSessions(s),
    loops: completedRuns(s),
    oefeningen: loggedExercises(s).map((x) => [x.exerciseId, x.sessions]),
    legPress: historyFor(s, 'leg_press', 52, '2026-09-18').length,
  }
}

/** Een export zoals een toestel met één profiel hem maakt: het andere profiel is leeg. */
function exportVanEenToestel(bestand: Record<string, any>, van: string): Record<string, any> {
  const leeg = bestand.users[van === ROB ? ANOUC : ROB]
  return {
    ...bestand,
    currentUser: van,
    users: {
      ...bestand.users,
      [leeg.id]: defaultUser(leeg.id, leeg.naam, leeg.programId),
    },
  }
}

const EIGEN_SESSIE: SessionLog = {
  date: '2026-09-14',
  kind: 'legs_a',
  startedAt: '2026-09-14T18:00:00.000Z',
  completedAt: '2026-09-14T19:00:00.000Z',
  short: false,
  entries: { 'legs_a:0': [{ weight: 80, reps: 12, done: true }] },
  exercises: { 'legs_a:0': 'leg_press' },
  skippedSlots: [],
  completedSlots: ['legs_a:0'],
} as SessionLog

/** Een toestel dat door Anouc gebruikt wordt, met een eigen sessie en dagcheck. */
function toestelVanAnouc() {
  resetState()
  setCurrentUser(ANOUC)
  const root = getRoot()
  replaceRoot({
    ...root,
    users: {
      ...root.users,
      [ANOUC]: {
        ...root.users[ANOUC],
        sessions: { '2026-09-14:legs_a': EIGEN_SESSIE },
        dayChecks: { '2026-09-14': { legs: 'fris' } },
        activities: [
          {
            id: 'eigen-1',
            date: '2026-09-13',
            type: 'wandelen',
            minutes: 40,
            distanceKm: 3,
            intensity: 'rustig',
            note: null,
            createdAt: '2026-09-13T10:00:00.000Z',
          },
        ],
      },
    },
  })
}

beforeEach(() => resetState())

describe('importeren op een leeg toestel', () => {
  for (const [naam, bestand] of [
    ['v14', V14],
    ['v18', V18],
  ] as const) {
    it(`${naam}: alle sessies, loops en check-ins per profiel`, () => {
      expect(importJSON(JSON.stringify(bestand))).toEqual({ ok: true })
      for (const id of [ROB, ANOUC]) {
        expect(geteld(getUser(id)!), id).toEqual(verwacht(bestand.users[id]))
      }
    })

    it(`${naam}: Historie en historie per oefening tonen ze`, () => {
      importJSON(JSON.stringify(bestand))
      for (const id of [ROB, ANOUC]) {
        setCurrentUser(id)
        const h = historie()
        expect(h.sessies, id).toBeGreaterThanOrEqual(18)
        expect(h.loops, id).toBe(18)
        expect(h.oefeningen.length, id).toBeGreaterThan(0)
        expect(h.legPress, id).toBe(9)
      }
    })
  }
})

describe('één profiel per toestel', () => {
  it('het bestand bepaalt niet wie dit toestel gebruikt', () => {
    toestelVanAnouc()
    importJSON(JSON.stringify(V18)) // gemaakt op een toestel dat op Rob stond
    expect(getRoot().currentUser).toBe(ANOUC)
  })

  it('de historie van het actieve profiel komt uit het bestand erbij', () => {
    toestelVanAnouc()
    importJSON(JSON.stringify(V18))
    const s = getState()
    expect(s.id).toBe(ANOUC)
    expect(Object.keys(s.sessions)).toHaveLength(18 + 1)
    expect(Object.keys(s.runs)).toHaveLength(18)
    expect(s.sessions['2026-09-14:legs_a']).toEqual(EIGEN_SESSIE)
    expect(historie().legPress).toBe(9 + 1)
  })

  it('een leeg profiel in het bestand wist de lokale historie niet', () => {
    toestelVanAnouc()
    // Rob exporteert op zijn eigen telefoon: Anouc staat daar leeg in
    importJSON(JSON.stringify(exportVanEenToestel(V18, ROB)))
    const anouc = getUser(ANOUC)!
    expect(anouc.sessions['2026-09-14:legs_a']).toEqual(EIGEN_SESSIE)
    expect(anouc.dayChecks['2026-09-14']).toEqual({ legs: 'fris' })
    expect(anouc.activities.map((a) => a.id)).toContain('eigen-1')
    // en Robs historie staat er nu ook
    expect(geteld(getUser(ROB)!)).toEqual(verwacht(V18.users[ROB]))
  })

  it('een v14-export komt ook bij het actieve profiel terecht', () => {
    toestelVanAnouc()
    importJSON(JSON.stringify(V14))
    expect(getRoot().currentUser).toBe(ANOUC)
    const anouc = getUser(ANOUC)!
    expect(Object.keys(anouc.sessions)).toHaveLength(18 + 1)
    expect(Object.keys(anouc.runs)).toHaveLength(18)
    // 18 benen uit de oude check-ins, plus de eigen dagcheck
    expect(Object.keys(anouc.dayChecks)).toHaveLength(18 + 1)
  })

  it('de pincode van dit toestel blijft staan', () => {
    toestelVanAnouc()
    setPin('9876')
    importJSON(JSON.stringify(V18))
    expect(getRoot().pin).toBe('9876')
  })
})

describe('opnieuw importeren', () => {
  for (const [naam, bestand] of [
    ['v14', V14],
    ['v18', V18],
  ] as const) {
    it(`${naam}: tweemaal hetzelfde bestand geeft geen dubbele historie`, () => {
      toestelVanAnouc()
      importJSON(JSON.stringify(bestand))
      const eerste = getRoot()
      importJSON(JSON.stringify(bestand))
      const tweede = getRoot()
      for (const id of [ROB, ANOUC]) {
        expect(tweede.users[id].sessions, id).toEqual(eerste.users[id].sessions)
        expect(tweede.users[id].runs, id).toEqual(eerste.users[id].runs)
        expect(tweede.users[id].dayChecks, id).toEqual(eerste.users[id].dayChecks)
        expect(tweede.users[id].activities, id).toEqual(eerste.users[id].activities)
        expect(tweede.users[id].deviations, id).toEqual(eerste.users[id].deviations)
        expect(tweede.users[id].notices, id).toEqual(eerste.users[id].notices)
      }
    })
  }

  it('een afgeronde sessie uit het bestand wint van een lokaal concept', () => {
    resetState()
    setCurrentUser(ROB)
    const sleutel = '2026-06-01:legs_a'
    const concept = { ...V18.users[ROB].sessions[sleutel], completedAt: null, entries: {} }
    const root = getRoot()
    replaceRoot({
      ...root,
      users: { ...root.users, [ROB]: { ...root.users[ROB], sessions: { [sleutel]: concept } } },
    })
    importJSON(JSON.stringify(V18))
    expect(getState().sessions[sleutel]).toEqual(V18.users[ROB].sessions[sleutel])
  })

  it('een later bijgewerkte lokale sessie blijft staan', () => {
    resetState()
    setCurrentUser(ROB)
    const sleutel = '2026-06-01:legs_a'
    const later = {
      ...V18.users[ROB].sessions[sleutel],
      completedAt: '2026-06-02T08:00:00.000Z',
      entries: { 'legs_a:0': [{ weight: 145, reps: 10, done: true }] },
    }
    const root = getRoot()
    replaceRoot({
      ...root,
      users: { ...root.users, [ROB]: { ...root.users[ROB], sessions: { [sleutel]: later } } },
    })
    importJSON(JSON.stringify(V18))
    expect(getState().sessions[sleutel]).toEqual(later)
    expect(Object.keys(getState().sessions)).toHaveLength(18)
  })
})
