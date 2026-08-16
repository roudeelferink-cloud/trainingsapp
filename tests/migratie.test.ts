import { describe, expect, it } from 'vitest'
import { ANOUC, ROB, SCHEMA_VERSION, migrate } from '../src/store/store'
import { runMigrations } from '../src/store/migrations'
import { MON } from './helpers'

/**
 * Opgeslagen data van eerdere versies. Niets wordt geweigerd of gewist: elke oude vorm
 * wordt opgehoogd tot iets waar de app mee verder kan.
 *
 * De stappen tot en met v8 stonden eerder in de synctest; die is met de synclaag zelf
 * verdwenen, de migratiedekking hoort hier thuis.
 */

/** Zoals het toestel het opsloeg vóór er meerdere gebruikers waren: één platte gebruiker. */
const v5 = {
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

describe('migratie van bestaande localStorage-data', () => {
  it('zet bestaande data onder gebruiker Rob, zonder verlies', () => {
    const root = migrate(v5)
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
    const root = migrate(v5)
    expect(root.currentUser).toBe(ROB)
    expect(root.users[ROB].programId).toBe('kracht_hardlopen')
  })

  it('maakt Anouc erbij aan, leeg en met haar eigen programma', () => {
    const anouc = migrate(v5).users[ANOUC]
    expect(anouc.programId).toBe('fullbody_hardlopen')
    expect(anouc.sessions).toEqual({})
    expect(anouc.runs).toEqual({})
    expect(anouc.activities).toEqual([])
    expect(anouc.exerciseState).toEqual({})
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
    expect(rob.settings.barWeights.smith).toBe(15) // v6 -> v7
  })

  it('laat een al gemigreerde staat ongemoeid', () => {
    const eenmaal = migrate(v5)
    const tweemaal = migrate(eenmaal)
    expect(tweemaal.users[ROB].protein).toEqual(eenmaal.users[ROB].protein)
    expect(tweemaal.users[ROB].sessions).toEqual(eenmaal.users[ROB].sessions)
    expect(Object.keys(tweemaal.users).sort()).toEqual([ANOUC, ROB])
  })

  it('overleeft kapotte gebruikersdata', () => {
    const kapot = { schemaVersion: SCHEMA_VERSION, users: { rob: 'onzin', anouc: null } }
    const root = migrate(kapot)
    expect(root.users[ROB].sessions).toEqual({})
    expect(root.users[ANOUC].programId).toBe('fullbody_hardlopen')
  })
})

describe('v8 -> v9: de syncvelden eruit', () => {
  /** Zoals het toestel het opsloeg toen er nog een Firestore-sync was. */
  const v8 = {
    schemaVersion: 8,
    household: '00112233445566aa',
    currentUser: 'anouc',
    users: {
      rob: {
        id: 'rob',
        naam: 'Rob',
        startDate: MON,
        updatedAt: '2026-08-10T20:00:00.000Z',
        bijgewerkt: '2026-08-10T20:00:00.000Z',
        settings: { bodyweightKg: 84, barWeights: { smith: 7 } },
        protein: { [MON]: 165 },
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
        runs: { [MON]: { date: MON, kind: 'short', plannedKm: 6, km: 6.5, minutes: 38, bike: false, completedAt: 'x' } },
        activities: [
          { id: 'a1', date: MON, type: 'fietsen', minutes: 40, distanceKm: 12, intensity: 'rustig', note: null, createdAt: 'x' },
        ],
        exerciseState: {
          leg_press: {
            targetWeight: 121.25,
            targetReps: 8,
            belowMinStreak: 0,
            lastNote: null,
            lastUpdated: '2026-08-03T18:00:00.000Z',
          },
        },
        lastExportAt: '2026-08-01T10:00:00.000Z',
      },
      anouc: { id: 'anouc', naam: 'Anouc', updatedAt: '2026-08-09T09:00:00.000Z', protein: { [MON]: 95 } },
    },
  }

  it('ruimt de huishoudcode en de synctijdstempels op', () => {
    const out = runMigrations(structuredClone(v8), 8, 9) as Record<string, any>

    expect(out.schemaVersion).toBe(9)
    expect(out).not.toHaveProperty('household')
    expect(out.users.rob).not.toHaveProperty('updatedAt')
    expect(out.users.rob).not.toHaveProperty('bijgewerkt')
    expect(out.users.anouc).not.toHaveProperty('updatedAt')
  })

  it('laat de trainingshistorie en de instellingen ongemoeid', () => {
    const out = runMigrations(structuredClone(v8), 8, 9) as Record<string, any>
    const rob = out.users.rob

    expect(rob.sessions).toEqual(v8.users.rob.sessions)
    expect(rob.runs).toEqual(v8.users.rob.runs)
    expect(rob.activities).toEqual(v8.users.rob.activities)
    expect(rob.exerciseState).toEqual(v8.users.rob.exerciseState)
    expect(rob.protein).toEqual({ [MON]: 165 })
    expect(rob.settings).toEqual(v8.users.rob.settings)
    expect(rob.lastExportAt).toBe('2026-08-01T10:00:00.000Z')
    expect(out.users.anouc.protein).toEqual({ [MON]: 95 })
  })

  it('houdt wie dit toestel gebruikt en welke gebruikers er zijn', () => {
    const out = runMigrations(structuredClone(v8), 8, 9) as Record<string, any>
    expect(out.currentUser).toBe('anouc')
    expect(Object.keys(out.users).sort()).toEqual(['anouc', 'rob'])
  })

  it('levert via de volledige migratie een staat zonder syncsporen op', () => {
    const root = migrate(structuredClone(v8))

    expect(root.schemaVersion).toBe(SCHEMA_VERSION)
    expect(root).not.toHaveProperty('household')
    expect(JSON.stringify(root)).not.toContain('updatedAt')
    expect(root.currentUser).toBe(ANOUC)
    // en de historie staat er nog gewoon
    expect(root.users[ROB].sessions[`${MON}:legs_a`].entries['legs_a:0'][0].weight).toBe(120)
    expect(root.users[ROB].settings.barWeights.smith).toBe(7)
    expect(root.users[ANOUC].protein[MON]).toBe(95)
  })
})

describe('v10 -> v11: de guardrails-laag', () => {
  const v10 = {
    schemaVersion: 10,
    currentUser: 'rob',
    pin: '1234',
    users: {
      rob: {
        id: 'rob',
        naam: 'Rob',
        programId: 'kracht_hardlopen',
        startDate: MON,
        settings: { bodyweightKg: 84, barWeights: { smith: 7 } },
        checkins: { [MON]: 4 },
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
        runs: { [MON]: { date: MON, kind: 'short', plannedKm: 6, km: 6.5, minutes: 38, bike: false, completedAt: 'x' } },
      },
      anouc: { id: 'anouc', naam: 'Anouc', programId: 'fullbody_hardlopen', protein: { [MON]: 95 } },
    },
  }

  it('zet de nieuwe velden leeg klaar bij elke gebruiker', () => {
    const out = runMigrations(structuredClone(v10), 10, 11) as Record<string, any>

    expect(out.schemaVersion).toBe(11)
    for (const id of ['rob', 'anouc']) {
      expect(out.users[id].dayChecks).toEqual({})
      expect(out.users[id].runPlans).toEqual({})
      expect(out.users[id].deloadSkips).toEqual({})
      expect(out.users[id].deviations).toEqual([])
    }
  })

  it('vult de beschikbare schijven aan zonder de stanggewichten te raken', () => {
    const out = runMigrations(structuredClone(v10), 10, 11) as Record<string, any>
    expect(out.users.rob.settings.plates.length).toBeGreaterThan(0)
    expect(out.users.rob.settings.barWeights.smith).toBe(7)
    expect(out.users.rob.settings.bodyweightKg).toBe(84)
  })

  it('laat historie zonder beoordeling gewoon staan', () => {
    const root = migrate(structuredClone(v10))

    expect(root.schemaVersion).toBe(SCHEMA_VERSION)
    const log = root.users[ROB].sessions[`${MON}:legs_a`]
    expect(log.entries['legs_a:0'][0].weight).toBe(120)
    expect(log.feel).toBeUndefined()
    expect(root.users[ROB].runs[MON].feel).toBeUndefined()
    expect(root.users[ROB].checkins[MON]).toBe(4)
    expect(root.users[ANOUC].protein[MON]).toBe(95)
  })
})
