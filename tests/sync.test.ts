import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as A from '../src/store/actions'
import {
  ANOUC,
  ROB,
  SCHEMA_VERSION,
  getRoot,
  getState,
  getUser,
  migrate,
  resetState,
  setCurrentUser,
  setHousehold,
  setState,
} from '../src/store/store'
import {
  COLLECTION,
  USERS_SUBCOLLECTION,
  docToUser,
  flushNow,
  pendingUsers,
  resetSyncForTests,
  setFirestoreForTests,
  shouldAcceptRemote,
  startLocalQueue,
  userToDoc,
  type SyncBackend,
} from '../src/store/sync'
import { MON } from './helpers'

const CODE = 'abcdef0123456789'

/** Nep-Firestore: onthoudt naar welk pad er geschreven is en met welke data. */
function fakeFirestore() {
  const writes: { path: string[]; data: Record<string, unknown> }[] = []
  const backend: SyncBackend = {
    db: {},
    doc: (...a: unknown[]) => ({ path: a.slice(1) as string[] }),
    collection: (...a: unknown[]) => ({ path: a.slice(1) as string[] }),
    setDoc: async (ref, data) => {
      writes.push({
        path: (ref as { path: string[] }).path,
        data: data as Record<string, unknown>,
      })
    },
    onSnapshot: () => () => {},
  }
  return { backend, writes }
}

beforeEach(() => {
  resetSyncForTests()
  resetState()
  setHousehold(CODE)
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: MON }))
})

afterEach(() => {
  resetSyncForTests()
})

describe('offline loggen en later syncen', () => {
  it('houdt wijzigingen vast zolang er geen verbinding is', () => {
    startLocalQueue()
    A.setProtein(MON, 170)
    A.addActivity(MON, { type: 'fietsen', minutes: 30, intensity: 'rustig' })

    // geen Firestore: niets weggeschreven, wel onthouden dat het nog moet
    expect(pendingUsers()).toEqual([ROB])
    flushNow()
    expect(pendingUsers()).toEqual([ROB])

    // ondertussen werkt de app gewoon door: alles staat lokaal
    expect(getState().protein[MON]).toBe(170)
    expect(localStorage.getItem('trainingsapp.state.v1')).toContain('170')
  })

  it('schrijft alles alsnog weg zodra de verbinding er is', () => {
    startLocalQueue()
    A.setProtein(MON, 170)

    const { backend, writes } = fakeFirestore()
    setFirestoreForTests(backend)
    flushNow()

    expect(pendingUsers()).toEqual([])
    expect(writes).toHaveLength(1)
    expect(writes[0].path).toEqual([COLLECTION, CODE, USERS_SUBCOLLECTION, ROB])
    expect((writes[0].data as { protein: Record<string, number> }).protein[MON]).toBe(170)
  })

  it('bundelt meerdere wijzigingen tot één schrijfactie per gebruiker', () => {
    startLocalQueue()
    const { backend, writes } = fakeFirestore()
    setFirestoreForTests(backend)

    A.setProtein(MON, 100)
    A.setProtein(MON, 150)
    A.setCheckin(MON, 4)
    flushNow()

    expect(writes).toHaveLength(1)
    expect((writes[0].data as { protein: Record<string, number> }).protein[MON]).toBe(150)
  })

  it('schrijft alleen naar het document van de gebruiker die iets wijzigde', () => {
    startLocalQueue()
    const { backend, writes } = fakeFirestore()
    setFirestoreForTests(backend)

    A.setProtein(MON, 120) // Rob
    setCurrentUser(ANOUC)
    A.setProtein(MON, 90) // Anouc
    flushNow()

    expect(writes.map((w) => w.path[3]).sort()).toEqual([ANOUC, ROB])
    const robWrite = writes.find((w) => w.path[3] === ROB)!
    expect((robWrite.data as { protein: Record<string, number> }).protein[MON]).toBe(120)
  })

  it('zet een tijdstempel op elke wijziging, zodat sync weet wat nieuwer is', () => {
    // een gebruiker waar nog niets mee gebeurd is heeft er geen
    expect(getUser(ANOUC)!.updatedAt).toBeNull()

    const voor = getState().updatedAt
    A.setProtein(MON, 130)
    const na = getState().updatedAt

    expect(na).not.toBeNull()
    expect(Date.parse(na!)).not.toBeNaN()
    expect(na! >= (voor ?? '')).toBe(true)
    // wie niets deed, krijgt ook geen stempel
    expect(getUser(ANOUC)!.updatedAt).toBeNull()
  })
})

describe('binnenkomende documenten', () => {
  it('overleeft een leeg of half document zonder data te wissen', () => {
    A.setProtein(MON, 175)
    const lokaal = getState()

    expect(docToUser(null, lokaal)).toEqual(lokaal)
    expect(docToUser({}, lokaal).protein[MON]).toBe(175)
    expect(docToUser({ sessions: 'kapot' }, lokaal).sessions).toEqual(lokaal.sessions)
    expect(docToUser({ activities: 'kapot' }, lokaal).activities).toEqual(lokaal.activities)
  })

  it('houdt id en programma van de lokale gebruiker aan', () => {
    const lokaal = getState()
    const binnen = docToUser({ id: 'iemand-anders', programId: 'onzin' }, lokaal)
    expect(binnen.id).toBe(ROB)
    expect(binnen.programId).toBe('kracht_hardlopen')
  })

  it('doet een volledige rondgang document -> gebruiker -> document', () => {
    A.setProtein(MON, 165)
    A.addActivity(MON, { type: 'wandelen', minutes: 45, intensity: 'rustig' })
    const lokaal = getState()

    const heen = userToDoc(lokaal)
    const terug = docToUser(JSON.parse(JSON.stringify(heen)), lokaal)

    expect(terug.protein).toEqual(lokaal.protein)
    expect(terug.activities).toEqual(lokaal.activities)
    expect(terug.sessions).toEqual(lokaal.sessions)
    expect(terug.updatedAt).toBe(lokaal.updatedAt)
  })

  it('laat het jongste tijdstempel winnen', () => {
    const oud = { ...getState(), updatedAt: '2026-08-01T10:00:00.000Z' }
    const nieuw = { ...getState(), updatedAt: '2026-08-02T10:00:00.000Z' }

    expect(shouldAcceptRemote(oud, nieuw)).toBe(true)
    expect(shouldAcceptRemote(nieuw, oud)).toBe(false)
    // gelijk: de bevestigde kant wint, anders blijven twee toestellen elkaar overschrijven
    expect(shouldAcceptRemote(nieuw, nieuw)).toBe(true)
  })

  it('neemt de cloud over als er lokaal nog nooit iets gewijzigd is', () => {
    const leeg = { ...getState(), updatedAt: null }
    const remote = { ...getState(), updatedAt: '2026-08-02T10:00:00.000Z' }
    expect(shouldAcceptRemote(leeg, remote)).toBe(true)
    // andersom: lokaal wel iets, cloud zonder stempel -> lokaal houden
    expect(shouldAcceptRemote(remote, leeg)).toBe(false)
  })
})

describe('migratie van bestaande localStorage-data', () => {
  /** Precies wat er vóór deze update op het toestel stond: één platte gebruiker. */
  const bestaand = {
    schemaVersion: 5,
    startDate: MON,
    settings: {
      bodyweightKg: 84,
      sensitive: { knee_deep: 'off', lateral_hip: 'careful' },
      travelMode: false,
      proteinFactor: 1.8,
      maintenanceItems: [{ id: 'heeldrops', label: 'Excentrische heel drops (3x15 per been)' }],
    },
    permanentReplacements: { 'legs_a:0': 'hack_squat_smith' },
    checkins: { [MON]: 4 },
    protein: { [MON]: 165 },
    maintenance: { [MON]: ['heeldrops'] },
    sessions: {
      [`${MON}:legs_a`]: {
        date: MON,
        kind: 'legs_a',
        short: false,
        completedAt: '2026-08-03T18:00:00.000Z',
        skippedSlots: [],
        completedSlots: ['legs_a:0'],
        exercises: { 'legs_a:0': 'leg_press' },
        entries: { 'legs_a:0': [{ weight: 120, reps: 10, rir: 1, done: true }] },
      },
    },
    runs: {
      [MON]: { date: MON, kind: 'short', plannedKm: 6, km: 6.5, minutes: 38, bike: false, completedAt: 'x' },
    },
    activities: [
      { id: 'a1', date: MON, type: 'fietsen', minutes: 40, intensity: 'rustig', note: null, createdAt: 'x' },
    ],
    skips: {},
    moves: {},
    overrides: {},
    exerciseState: {
      leg_press: {
        targetWeight: 121.25,
        targetReps: 8,
        belowMinStreak: 0,
        lastNote: null,
        lastUpdated: '2026-08-03T18:00:00.000Z',
      },
    },
    notices: [{ date: MON, text: 'Leg press: omhoog naar 121,25 kg.' }],
    lastExportAt: '2026-08-01T10:00:00.000Z',
  }

  it('zet bestaande data onder gebruiker Rob, zonder verlies', () => {
    const root = migrate(bestaand)
    const rob = root.users[ROB]

    expect(root.schemaVersion).toBe(SCHEMA_VERSION)
    expect(rob.startDate).toBe(MON)
    expect(rob.settings.bodyweightKg).toBe(84)
    expect(rob.settings.sensitive.knee_deep).toBe('off')
    expect(rob.permanentReplacements).toEqual({ 'legs_a:0': 'hack_squat_smith' })
    expect(rob.checkins).toEqual({ [MON]: 4 })
    expect(rob.protein).toEqual({ [MON]: 165 })
    expect(rob.maintenance).toEqual({ [MON]: ['heeldrops'] })
    expect(rob.sessions[`${MON}:legs_a`].entries['legs_a:0']).toHaveLength(1)
    expect(rob.runs[MON].km).toBe(6.5)
    expect(rob.activities).toHaveLength(1)
    expect(rob.exerciseState.leg_press.targetWeight).toBe(121.25)
    expect(rob.notices).toHaveLength(1)
    expect(rob.lastExportAt).toBe('2026-08-01T10:00:00.000Z')
  })

  it('zet dit toestel meteen op Rob, zodat er na de update niets verandert', () => {
    const root = migrate(bestaand)
    expect(root.currentUser).toBe(ROB)
    expect(root.users[ROB].programId).toBe('kracht_hardlopen')
  })

  it('maakt Anouc erbij aan, leeg en met haar eigen programma', () => {
    const anouc = migrate(bestaand).users[ANOUC]
    expect(anouc.programId).toBe('fullbody_hardlopen')
    expect(anouc.sessions).toEqual({})
    expect(anouc.runs).toEqual({})
    expect(anouc.activities).toEqual([])
    expect(anouc.exerciseState).toEqual({})
  })

  it('vraagt nog wel om een huishoudcode: die had de oude versie niet', () => {
    expect(migrate(bestaand).household).toBe('')
  })

  it('migreert ook een heel oude versie in één keer door naar gebruikers', () => {
    const v1 = {
      schemaVersion: 1,
      startDate: MON,
      sessions: {
        [`${MON}:legs_a`]: {
          date: MON,
          kind: 'legs_a',
          short: false,
          completedAt: '2026-08-03T18:00:00.000Z',
          skippedSlots: [],
          entries: { 'legs_a:0': [{ weight: 100, reps: 10, rir: 1 }] },
        },
      },
    }
    const rob = migrate(v1).users[ROB]
    expect(rob.sessions[`${MON}:legs_a`].exercises['legs_a:0']).toBe('leg_press') // v1 -> v2
    expect(rob.sessions[`${MON}:legs_a`].entries['legs_a:0'][0].done).toBe(true) // v3 -> v4
    expect(rob.activities).toEqual([]) // v4 -> v5
    expect(migrate(v1).currentUser).toBe(ROB) // v5 -> v6
  })

  it('laat een al gemigreerde staat ongemoeid', () => {
    const eenmaal = migrate(bestaand)
    const tweemaal = migrate(eenmaal)
    expect(tweemaal.users[ROB].protein).toEqual(eenmaal.users[ROB].protein)
    expect(tweemaal.users[ROB].sessions).toEqual(eenmaal.users[ROB].sessions)
    expect(Object.keys(tweemaal.users).sort()).toEqual([ANOUC, ROB])
  })

  it('weigert een onzinnige huishoudcode in opgeslagen data', () => {
    expect(migrate({ ...bestaand, household: 'te-kort' }).household).toBe('')
    expect(migrate({ schemaVersion: SCHEMA_VERSION, household: CODE }).household).toBe(CODE)
  })

  it('overleeft kapotte gebruikersdata', () => {
    const kapot = { schemaVersion: SCHEMA_VERSION, users: { rob: 'onzin', anouc: null } }
    const root = migrate(kapot)
    expect(root.users[ROB].sessions).toEqual({})
    expect(root.users[ANOUC].programId).toBe('fullbody_hardlopen')
  })
})

describe('koppelen aan een huishouden', () => {
  it('accepteert alleen een geldige code', () => {
    resetState()
    setHousehold('te kort')
    expect(getRoot().household).toBe('')
    setHousehold(CODE.toUpperCase())
    expect(getRoot().household).toBe(CODE)
  })

  it('laat gebruikerswissel de gegevens van beiden intact', () => {
    A.setProtein(MON, 150)
    setCurrentUser(ANOUC)
    A.setProtein(MON, 90)
    setCurrentUser(ROB)

    expect(getUser(ROB)!.protein[MON]).toBe(150)
    expect(getUser(ANOUC)!.protein[MON]).toBe(90)
    expect(getState().id).toBe(ROB)
  })
})
