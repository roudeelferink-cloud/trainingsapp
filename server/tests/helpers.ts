import { addDays } from '../../src/logic/dates'
import { ANOUC, ROB, SCHEMA_VERSION, defaultRoot } from '../../src/store/schema'
import type { AppState, Feel, UserState } from '../../src/types'

/**
 * Een staat met echte historie, zodat de signalen ergens over gaan.
 *
 * De datums staan vast. Een test die vandaag draait en morgen anders uitpakt is geen
 * test, en de hele signalenbouw krijgt de dag expliciet mee juist om dat te voorkomen.
 */

/** Maandag. Negen weken voor DEZE_MAANDAG, dus week 10 loopt. */
export const START = '2026-06-01'
/** Woensdag in week 10. */
export const VANDAAG = '2026-08-05'
/** De maandag van de week waar VANDAAG in valt. */
export const DEZE_MAANDAG = '2026-08-03'
/** Aantal weken dat de opbouw standaard vult: tot en met de lopende week. */
export const WEKEN = 10

export interface Opbouw {
  /** kilometers per week, oudste eerst; 0 = niets gelogd */
  km?: number[]
  /** beoordelingen van krachtsessies, per week */
  gevoel?: Feel[][]
  /** dagchecks per week: [slaap, energie] per ingevulde dag */
  dagchecks?: [number, number][][]
}

/**
 * Bouwt de staat van Rob op: per week één duurloop op zondag, één korte loop op
 * dinsdag, en twee krachtsessies. Wat er per week in gaat is instelbaar, zodat een test
 * precies één ding kan veranderen.
 */
export function robState(opbouw: Opbouw = {}): UserState {
  const basis = defaultRoot().users[ROB]
  const weken = opbouw.km ?? [24, 26, 27, 28, 29, 30, 31, 20, 22, 24]

  const runs: UserState['runs'] = {}
  const sessions: UserState['sessions'] = {}
  const dayChecks: UserState['dayChecks'] = {}
  const checkins: UserState['checkins'] = {}

  weken.forEach((km, w) => {
    const maandag = addDays(START, 7 * w)
    if (km > 0) {
      const lang = Math.round(km * 0.45 * 2) / 2
      const kort = Math.round((km - lang) * 2) / 2
      loop(runs, addDays(maandag, 1), 'short', kort, '18:30')
      loop(runs, addDays(maandag, 6), 'long', lang, '09:30')
    }

    const gevoelens = opbouw.gevoel?.[w] ?? ['goed', 'goed']
    gevoelens.forEach((feel, i) => {
      const datum = addDays(maandag, i === 0 ? 0 : 3)
      if (datum > VANDAAG) return
      sessions[`${datum}:${i === 0 ? 'legs_a' : 'push'}`] = krachtsessie(datum, i === 0, feel)
    })

    const checks = opbouw.dagchecks?.[w] ?? [
      [3, 3],
      [2, 3],
    ]
    checks.forEach(([slaap, energie], i) => {
      const datum = addDays(maandag, i)
      if (datum > VANDAAG) return
      dayChecks[datum] = { sleep: slaap as 1 | 2 | 3, energy: energie as 1 | 2 | 3 }
      checkins[datum] = 4
    })
  })

  return {
    ...basis,
    startDate: START,
    runs,
    sessions,
    dayChecks,
    checkins,
    exerciseState: {
      leg_press: {
        targetWeight: 140,
        targetReps: 10,
        belowMinStreak: 0,
        lastNote: null,
        lastUpdated: null,
      },
      bench_smith: {
        targetWeight: 62.5,
        targetReps: 8,
        belowMinStreak: 0,
        lastNote: null,
        lastUpdated: null,
      },
    },
    notices: [{ date: DEZE_MAANDAG, text: 'Leg press: streefgewicht naar 140 kg.' }],
  }
}

/** Een gelopen loop, tenzij de dag nog moet komen: de toekomst is niet gelogd. */
function loop(
  runs: UserState['runs'],
  datum: string,
  kind: 'short' | 'long',
  km: number,
  tijd: string,
): void {
  if (datum > VANDAAG) return
  runs[datum] = {
    date: datum,
    kind,
    plannedKm: km,
    km,
    minutes: Math.round(km * 6),
    bike: false,
    completedAt: `${datum}T${tijd}:00.000Z`,
  }
}

function krachtsessie(datum: string, benen: boolean, feel: Feel): UserState['sessions'][string] {
  const slotKey = benen ? 'legs_a:0' : 'push:0'
  const exercise = benen ? 'leg_press' : 'bench_smith'
  return {
    date: datum,
    kind: benen ? 'legs_a' : 'push',
    completedAt: `${datum}T19:15:00.000Z`,
    startedAt: `${datum}T18:20:00.000Z`,
    short: false,
    entries: {
      [slotKey]: [
        { weight: benen ? 140 : 60, reps: 10, done: true },
        { weight: benen ? 140 : 60, reps: 9, done: true },
      ],
    },
    exercises: { [slotKey]: exercise },
    skippedSlots: [],
    completedSlots: [slotKey],
    feel,
  }
}

/** Anouc met dezelfde historie: haar instellingen verschillen, niet haar logboek. */
export function anoucState(opbouw: Opbouw = {}): UserState {
  const basis = defaultRoot().users[ANOUC]
  return { ...robState(opbouw), id: ANOUC, naam: basis.naam, programId: basis.programId, settings: basis.settings }
}

/** Een gebruiker zonder één gelogde regel; alleen een startdatum. */
export function leegState(): UserState {
  return { ...defaultRoot().users[ROB], startDate: START }
}

/** De volledige staat, in de vorm die de app exporteert en opstuurt. */
export function exportVorm(rob: UserState = robState()): AppState {
  const root = defaultRoot()
  return {
    ...root,
    schemaVersion: SCHEMA_VERSION,
    currentUser: ROB,
    users: { ...root.users, [ROB]: rob, [ANOUC]: { ...root.users[ANOUC], startDate: START } },
  }
}

export const GOED_ADVIES = {
  signalen: ['Je loopt vier weken op rij meer: van 24 naar 31 km.', 'Twee zware sessies in twee weken.'],
  advies: ['Houd deze week op 30 km en laat de duurloop op 13,5 km staan.'],
  toon: 'Het loopt, maar de rek is eruit.',
}
