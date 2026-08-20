import { beforeEach, describe, expect, it } from 'vitest'
import {
  SCHEMA_VERSION,
  getRoot,
  defaultState,
  defaultRoot,
  exportJSON,
  getState,
  importJSON,
  migrate,
  replaceRoot,
  resetState,
  setState,
} from '../src/store/store'
import { moveTargets } from '../src/logic/day'
import { runMigrations } from '../src/store/migrations'
import * as A from '../src/store/actions'
import { MON, VR, WO, ZA } from './helpers'

const sessionLog = {
  [`${MON}:legs_a`]: {
    date: MON,
    kind: 'legs_a' as const,
    short: false,
    completedAt: '2026-08-03T18:00:00.000Z',
    skippedSlots: [],
    completedSlots: ['legs_a:0'],
    exercises: { 'legs_a:0': 'leg_press' },
    entries: { 'legs_a:0': [{ weight: 100, reps: 10, rir: 1, done: true }] },
  },
}

beforeEach(() => {
  resetState()
  setState((s) => ({ ...s, startDate: MON }))
})

describe('export en import', () => {
  it('herstelt de volledige staat na een roundtrip', () => {
    setState((s) => ({
      ...s,
      sessions: sessionLog,
      checkins: { [MON]: 4 },
      permanentReplacements: { 'legs_a:0': 'hack_squat_smith' },
      exerciseState: {
        leg_press: {
          targetWeight: 101.25,
          targetReps: 8,
          belowMinStreak: 0,
          lastNote: null,
          lastUpdated: '2026-08-03T18:00:00.000Z',
        },
      },
      settings: { ...s.settings, bodyweightKg: 82, travelMode: true },
    }))

    const backup = exportJSON()
    const before = getState()

    resetState()
    expect(getState().sessions).toEqual({})
    expect(getState().settings.bodyweightKg).toBeNull()

    const result = importJSON(backup)
    expect(result.ok).toBe(true)

    const after = getState()
    expect(after.sessions).toEqual(before.sessions)
    expect(after.checkins).toEqual(before.checkins)
    expect(after.permanentReplacements).toEqual(before.permanentReplacements)
    expect(after.exerciseState).toEqual(before.exerciseState)
    expect(after.settings).toEqual(before.settings)
    expect(after.startDate).toBe(MON)
  })

  it('exporteert geldige JSON met de huidige schemaVersion', () => {
    const parsed = JSON.parse(exportJSON())
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION)
    expect(typeof parsed.exportedAt).toBe('string')
  })

  it('onthoudt wanneer er voor het laatst geëxporteerd is', () => {
    expect(getState().lastExportAt).toBeNull()
    exportJSON()
    expect(getState().lastExportAt).not.toBeNull()
    expect(Date.parse(getState().lastExportAt!)).not.toBeNaN()
  })

  it('weigert onzin zonder de staat aan te tasten', () => {
    setState((s) => ({ ...s, sessions: sessionLog }))
    expect(importJSON('geen json').ok).toBe(false)
    expect(importJSON('"een string"').ok).toBe(false)
    expect(importJSON('{}')).toEqual({ ok: false, error: 'schemaVersion ontbreekt.' })
    expect(getState().sessions).toEqual(sessionLog)
  })

  it('weigert een export uit een nieuwere versie', () => {
    const toekomst = JSON.stringify({ ...defaultState(), schemaVersion: SCHEMA_VERSION + 5 })
    const res = importJSON(toekomst)
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.error).toContain('nieuwere versie')
  })

  it('overleeft een import die alleen schemaVersion bevat', () => {
    expect(importJSON(JSON.stringify({ schemaVersion: SCHEMA_VERSION })).ok).toBe(true)
    expect(getState().settings.plates.length).toBeGreaterThan(0)
    expect(getState().sessions).toEqual({})
  })
})

describe('migratie van oudere data', () => {
  /** Zoals v1 het opsloeg: sessielogs zonder exercises-map, geen lastExportAt. */
  const v1 = {
    schemaVersion: 1,
    startDate: MON,
    settings: {
      bodyweightKg: 80,
      sensitive: { knee_deep: 'off' },
      travelMode: false,
      proteinFactor: 1.8,
      maintenanceItems: [{ id: 'heeldrops', label: 'Excentrische heel drops (3x15 per been)' }],
    },
    permanentReplacements: {},
    checkins: { [MON]: 4 },
    protein: { [MON]: 150 },
    maintenance: {},
    sessions: {
      [`${MON}:legs_a`]: {
        date: MON,
        kind: 'legs_a',
        short: false,
        completedAt: '2026-08-03T18:00:00.000Z',
        skippedSlots: [],
        entries: {
          'legs_a:0': [{ weight: 100, reps: 10, rir: 1 }],
          'legs_a:4': [{ weight: 40, reps: 15, rir: 2 }],
        },
      },
    },
    runs: {},
    skips: {},
    moves: {},
    overrides: {},
    exerciseState: {},
    notices: [],
  }

  it('hoogt de versie op in plaats van te weigeren', () => {
    const res = importJSON(JSON.stringify(v1))
    expect(res.ok).toBe(true)
    expect(getRoot().schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('houdt alle bestaande data overeind', () => {
    importJSON(JSON.stringify(v1))
    const s = getState()
    expect(s.startDate).toBe(MON)
    expect(s.checkins).toEqual({ [MON]: 4 })
    // het eiwitveld uit de oude data is sinds v13 opgeruimd
    expect(Object.keys(s)).not.toContain('protein')
    expect(s.settings.bodyweightKg).toBe(80)
    expect(s.settings.sensitive.knee_deep).toBe('off')
    expect(s.sessions[`${MON}:legs_a`].entries['legs_a:0']).toEqual([
      { weight: 100, reps: 10, rir: 1, done: true },
    ])
  })

  it('vult de ontbrekende oefeningmap aan uit de sjablonen', () => {
    importJSON(JSON.stringify(v1))
    const log = getState().sessions[`${MON}:legs_a`]
    expect(log.exercises).toEqual({
      'legs_a:0': 'leg_press',
      'legs_a:4': 'standing_calf_smith',
    })
  })

  it('maakt de 1RM-grafiek daardoor alsnog bruikbaar voor oude sessies', async () => {
    importJSON(JSON.stringify(v1))
    const { oneRmSeries } = await import('../src/logic/stats')
    expect(oneRmSeries(getState()).map((s) => s.exerciseId).sort()).toEqual([
      'leg_press',
      'standing_calf_smith',
    ])
  })

  it('vult velden aan die in v1 nog niet bestonden', () => {
    importJSON(JSON.stringify(v1))
    expect(getState().lastExportAt).toBeNull()
    expect(getState().settings.sensitive.lateral_hip).toBe('careful')
  })

  it('behandelt data zonder schemaVersion als v1', () => {
    const { schemaVersion, ...zonderVersie } = v1
    expect(schemaVersion).toBe(1)
    const migrated = migrate(zonderVersie)
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated.users.rob.sessions[`${MON}:legs_a`].exercises['legs_a:0']).toBe('leg_press')
  })

  it('laat data die al actueel is ongemoeid', () => {
    const actueel = { ...defaultRoot(), users: { rob: { ...defaultState(), startDate: MON, sessions: sessionLog } } }
    expect(migrate(actueel).users.rob.sessions).toEqual(sessionLog)
  })

  it('overleeft kapotte of half-lege data', () => {
    expect(migrate(null).schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrate('kapot').users.rob.settings.plates.length).toBeGreaterThan(0)
    expect(migrate({ schemaVersion: 1 }).users.rob.sessions).toEqual({})
    expect(migrate({ schemaVersion: 1, sessions: { kapot: null } }).users.rob.sessions).toEqual({
      kapot: null,
    })
  })

  it('normaliseert kapotte setwaarden uit oudere versies (v2 -> v3)', () => {
    const v2 = {
      ...v1,
      schemaVersion: 2,
      sessions: {
        [`${MON}:legs_a`]: {
          date: MON,
          kind: 'legs_a',
          short: false,
          completedAt: '2026-08-03T18:00:00.000Z',
          skippedSlots: [],
          exercises: { 'legs_a:0': 'leg_press' },
          entries: {
            'legs_a:0': [
              { weight: '100', reps: 10, rir: 1 },
              { weight: null, reps: undefined, rir: 2 },
              { weight: 0, reps: 0, rir: 2 },
            ],
          },
        },
      },
    }
    expect(importJSON(JSON.stringify(v2)).ok).toBe(true)
    const sets = getState().sessions[`${MON}:legs_a`].entries['legs_a:0']
    // tekst wordt een getal, onbruikbare waarden worden 0, lege sets vervallen
    expect(sets).toEqual([{ weight: 100, reps: 10, rir: 1, done: true }])
    expect(getRoot().schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('laat lopende concepten met lege sets ongemoeid', () => {
    const draft = {
      ...v1,
      schemaVersion: 2,
      sessions: {
        [`${MON}:legs_a`]: {
          date: MON, kind: 'legs_a', short: false, completedAt: null, skippedSlots: [],
          exercises: {}, entries: { 'legs_a:0': [{ weight: 0, reps: 0, rir: 2 }] },
        },
      },
    }
    expect(importJSON(JSON.stringify(draft)).ok).toBe(true)
    expect(getState().sessions[`${MON}:legs_a`].entries['legs_a:0']).toHaveLength(1)
  })

  it('draait beide migratiestappen achter elkaar vanaf v1', () => {
    importJSON(JSON.stringify(v1))
    expect(getRoot().schemaVersion).toBe(SCHEMA_VERSION)
    const log = getState().sessions[`${MON}:legs_a`]
    expect(log.exercises['legs_a:0']).toBe('leg_press') // v1 -> v2
    expect(log.entries['legs_a:0'].every((s) => typeof s.weight === 'number')).toBe(true) // v2 -> v3
  })

  it('stopt netjes als er een migratiestap ontbreekt', () => {
    const out = runMigrations({ schemaVersion: 99 }, 99, 200)
    expect(out.schemaVersion).toBe(99)
  })

  it('vult in v7 → v8 de ontbrekende instellingen per gebruiker aan', () => {
    const out = runMigrations(
      {
        schemaVersion: 7,
        users: {
          // stanggewichten en gevoelige gebieden ontbreken; dit gaf het zwarte scherm
          rob: { id: 'rob', settings: { bodyweightKg: 82 } },
          anouc: { id: 'anouc' }, // helemaal geen settings
        },
      },
      7,
      8,
    ) as { schemaVersion: number; users: Record<string, { settings: Record<string, any> }> }

    expect(out.schemaVersion).toBe(8)
    expect(out.users.rob.settings.barWeights).toEqual({
      trap_bar: 20,
      smith: 15,
      barbell: 20,
      deadlift_bar: 20,
      curl_bar: 7.5,
    })
    expect(out.users.rob.settings.bodyweightKg).toBe(82)
    // wat er nooit is geweest krijgt het startpunt van die gebruiker
    expect(out.users.rob.settings.sensitive.lateral_hip).toBe('careful')
    expect(out.users.anouc.settings.sensitive.lateral_hip).toBe('ok')
    expect(out.users.anouc.settings.travelMode).toBe(false)
  })
})

describe('acties op de gedeelde staat', () => {
  it('verplaatst een beensessie naar zaterdag, maar niet zonder waarschuwing vooraf', () => {
    const zaterdag = moveTargets(getState(), MON, 'strength').find((t) => t.date === ZA)!
    expect(zaterdag.warnings.join(' ')).toContain('duurloop')

    // de waarschuwing houdt de gebruiker niet tegen
    expect(A.moveSession(MON, ZA).ok).toBe(true)
    expect(getState().moves[MON]).toBe(ZA)
  })

  it('weigert de vaste rustdag als bestemming', () => {
    const res = A.moveSession(MON, WO)
    expect(res.ok).toBe(false)
    expect(res.reason).toContain('Rustdag')
    expect(getState().moves).toEqual({})
  })

  it('ruilt maandag en vrijdag, en draait dat weer terug', () => {
    expect(A.moveSession(MON, VR).ok).toBe(true)
    expect(getState().moves).toEqual({ [MON]: VR, [VR]: MON })
    A.undoMove(MON)
    expect(getState().moves).toEqual({})
  })

  it('bewaart de staat over een herlaadbeurt heen', () => {
    A.setCheckin(MON, 4)
    const opgeslagen = localStorage.getItem('trainingsapp.state.v1')
    expect(opgeslagen).not.toBeNull()
    replaceRoot(migrate(JSON.parse(opgeslagen!)))
    expect(getState().checkins[MON]).toBe(4)
  })
})
