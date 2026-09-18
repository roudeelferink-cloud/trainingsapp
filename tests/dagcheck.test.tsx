import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getExercise } from '../src/data/exercises'
import { buildDay } from '../src/logic/day'
import { painNote, painReports, painSpotsFor } from '../src/logic/dayCheck'
import { mondayOf, today } from '../src/logic/dates'
import { MIGRATIONS, runMigrations } from '../src/store/migrations'
import { SCHEMA_VERSION, migrate } from '../src/store/schema'
import * as A from '../src/store/actions'
import { ROB, exportJSON, getState, importJSON, resetState, setState } from '../src/store/store'
import { HistoryScreen } from '../src/screens/HistoryScreen'
import { SessionScreen } from '../src/screens/SessionScreen'
import { MON, baseState } from './helpers'

const render = (el: Parameters<typeof renderToString>[0]) => renderToString(el).replace(/<!-- -->/g, '')
const noop = () => {}

/* -------------------------------------------------------------------------
 * Migratie v17 -> v18
 * ---------------------------------------------------------------------- */

const v17 = {
  schemaVersion: 17,
  currentUser: 'rob',
  pin: null,
  users: {
    rob: {
      id: 'rob',
      naam: 'Rob',
      programId: 'kracht_hardlopen',
      startDate: MON,
      checkins: {
        '2026-08-03': 1,
        '2026-08-04': 2,
        '2026-08-05': 3,
        '2026-08-06': 4,
        '2026-08-07': 5,
        '2026-08-08': 9, // onzin: valt weg
      },
      dayChecks: {
        '2026-08-03': { sleep: 1, energy: 1 },
        '2026-08-10': { sleep: 3, energy: 3 }, // alleen slaap en energie: valt weg
      },
    },
    anouc: { id: 'anouc', naam: 'Anouc', programId: 'fullbody_hardlopen' },
  },
}

describe('migratie v17 -> v18: de dagcheck', () => {
  it('bestaat als stap en tilt de versie op', () => {
    expect(SCHEMA_VERSION).toBe(18)
    expect(MIGRATIONS[17]).toBeTypeOf('function')
    const out = runMigrations(structuredClone(v17), 17, 18) as Record<string, any>
    expect(out.schemaVersion).toBe(18)
  })

  it('zet de oude benenschaal om: 1-2 zwaar, 3 normaal, 4-5 fris', () => {
    const out = runMigrations(structuredClone(v17), 17, 18) as Record<string, any>
    expect(out.users.rob.dayChecks).toEqual({
      '2026-08-03': { legs: 'zwaar' },
      '2026-08-04': { legs: 'zwaar' },
      '2026-08-05': { legs: 'normaal' },
      '2026-08-06': { legs: 'fris' },
      '2026-08-07': { legs: 'fris' },
    })
  })

  it('haalt slaap, energie en het veld checkins weg', () => {
    const root = migrate(structuredClone(v17))
    const rob = root.users[ROB] as unknown as Record<string, unknown>
    expect(Object.keys(rob)).not.toContain('checkins')
    expect(JSON.stringify(root)).not.toContain('sleep')
    expect(JSON.stringify(root)).not.toContain('energy')
    expect(root.users[ROB].dayChecks['2026-08-10']).toBeUndefined()
  })

  it('laat een gebruiker zonder dagcheck met een lege lijst achter', () => {
    const root = migrate(structuredClone(v17))
    expect(root.users.anouc.dayChecks).toEqual({})
  })

  it('doet twee keer migreren niets extra', () => {
    const eenmaal = migrate(structuredClone(v17))
    expect(migrate(structuredClone(eenmaal))).toEqual(eenmaal)
  })

  it('maakt een v18-bestand met rommel in de dagcheck schoon', () => {
    const root = migrate({
      schemaVersion: 18,
      users: {
        rob: {
          checkins: { [MON]: 1 },
          dayChecks: {
            [MON]: { legs: 'fris', pain: 'knie', sleep: 1 },
            '2026-08-04': { legs: 'moe', pain: 'teen' },
            '2026-08-05': { pain: null },
          },
        },
      },
    })
    expect(root.users[ROB].dayChecks).toEqual({
      [MON]: { legs: 'fris', pain: 'knie' },
      '2026-08-05': { pain: null },
    })
    expect(Object.keys(root.users[ROB])).not.toContain('checkins')
  })
})

/* -------------------------------------------------------------------------
 * Gebruik
 * ---------------------------------------------------------------------- */

describe('pijnregel', () => {
  it('leest de plek uit de belastingstags van de oefening', () => {
    expect(painSpotsFor(getExercise('leg_press'))).toEqual(['knie'])
    expect(painSpotsFor(getExercise('rdl_trapbar')).sort()).toEqual(['heup', 'rug'])
    expect(painSpotsFor(getExercise('bench_smith'))).toEqual(['schouder'])
  })

  it('geeft één feitelijke regel bij een oefening die de gemelde plek belast', () => {
    const knie = { legs: 'normaal' as const, pain: 'knie' as const }
    expect(painNote(getExercise('leg_press'), knie)).toBe(
      'knie gemeld — kies eventueel een lichter gewicht',
    )
    expect(painNote(getExercise('bench_smith'), knie)).toBeNull()
  })

  it('zwijgt bij geen pijn, bij niets ingevuld en bij "anders"', () => {
    const ex = getExercise('leg_press')
    expect(painNote(ex, undefined)).toBeNull()
    expect(painNote(ex, { legs: 'fris', pain: null })).toBeNull()
    expect(painNote(ex, { pain: 'anders' })).toBeNull()
  })
})

describe('pijnregel in het sessiescherm', () => {
  beforeEach(() => {
    resetState()
    setState((s) => ({ ...s, startDate: mondayOf(today()), settings: { ...s.settings, bodyweightKg: 82 } }))
  })

  function sessieOpMaandag(): string {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    A.setWarmupDone(monday, plan.strength!.kind, true)
    return render(createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }))
  }

  it('staat bij de oefening als de plek gemeld is, en past niets aan', () => {
    const monday = mondayOf(today())
    const zonder = buildDay(getState(), monday).strength!.slots.map((r) => [r.exercise.id, r.sets])
    A.setDayCheckPain(monday, 'knie')
    const html = sessieOpMaandag()
    expect(html).toContain('Leg press')
    expect(html).toContain('knie gemeld — kies eventueel een lichter gewicht')
    // niet blokkerend en geen gewichtsaanpassing: dezelfde oefeningen, dezelfde sets
    expect(buildDay(getState(), monday).strength!.slots.map((r) => [r.exercise.id, r.sets])).toEqual(zonder)
    expect(html).toContain('Set 1 klaar')
  })

  it('staat er niet bij een plek die deze oefening niet belast', () => {
    A.setDayCheckPain(mondayOf(today()), 'schouder')
    expect(sessieOpMaandag()).not.toContain('gemeld —')
  })

  it('staat er niet zonder pijn', () => {
    A.setDayCheckPain(mondayOf(today()), null)
    expect(sessieOpMaandag()).not.toContain('gemeld —')
  })
})

describe('de gemelde plek in historie en export', () => {
  beforeEach(() => resetState())

  it('staat in de historie, nieuwste eerst', () => {
    A.setDayCheck('2026-08-03', { legs: 'normaal', pain: 'knie' })
    A.setDayCheck('2026-08-05', { legs: 'fris', pain: null })
    A.setDayCheck('2026-08-06', { pain: 'rug' })
    expect(painReports(getState())).toEqual([
      { date: '2026-08-06', spot: 'rug' },
      { date: '2026-08-03', spot: 'knie' },
    ])
    const html = render(createElement(HistoryScreen, { onOpenSettings: noop }))
    expect(html).toContain('Gemelde pijn')
    expect(html).toContain('Knie')
    expect(html).toContain('Rug')
  })

  it('gaat mee in de export en komt terug bij import', () => {
    A.setDayCheck(MON, { legs: 'zwaar', pain: 'heup' })
    const backup = exportJSON()
    expect(JSON.parse(backup).users.rob.dayChecks[MON]).toEqual({ legs: 'zwaar', pain: 'heup' })
    resetState()
    expect(importJSON(backup)).toEqual({ ok: true })
    expect(getState().dayChecks[MON]).toEqual({ legs: 'zwaar', pain: 'heup' })
  })
})

describe('benen in de dagcheck', () => {
  it('halen bij zwaar een set af, net als een lage check-in vroeger', () => {
    const normaal = buildDay(baseState(), MON).strength!
    const zwaar = buildDay(baseState({ dayChecks: { [MON]: { legs: 'zwaar' } } }), MON).strength!
    expect(zwaar.slots[0].sets).toBe(normaal.slots[0].sets - 1)
  })
})
