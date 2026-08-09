import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { activitiesOn, recentActivities } from '../src/logic/activities'
import { buildDay } from '../src/logic/day'
import { today } from '../src/logic/dates'
import { oneRmSeries, weeklyRunVolume } from '../src/logic/stats'
import { ProgressScreen } from '../src/screens/ProgressScreen'
import { Today } from '../src/screens/Today'
import * as A from '../src/store/actions'
import {
  SCHEMA_VERSION,
  exportJSON,
  getState,
  importJSON,
  migrate,
  resetState,
  setState,
} from '../src/store/store'
import { DI, MON, WO } from './helpers'

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

beforeEach(() => {
  resetState()
  setState((s) => ({ ...s, startDate: MON }))
})

describe('losse activiteiten loggen', () => {
  it('voegt een activiteit toe met alle velden', () => {
    const id = A.addActivity(MON, {
      type: 'fietsen',
      minutes: 45,
      intensity: 'rustig',
      note: 'avondrondje',
    })

    const list = activitiesOn(getState(), MON)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id,
      date: MON,
      type: 'fietsen',
      minutes: 45,
      intensity: 'rustig',
      note: 'avondrondje',
    })
    expect(Date.parse(list[0].createdAt)).not.toBeNaN()
  })

  it('staat meerdere activiteiten op dezelfde dag toe, naast een geplande sessie', () => {
    A.addActivity(MON, { type: 'hardlopen', minutes: 35, intensity: 'normaal' })
    A.addActivity(MON, { type: 'fietsen', minutes: 40, intensity: 'rustig' })

    expect(activitiesOn(getState(), MON)).toHaveLength(2)
    // maandag heeft gewoon zijn eigen krachtsessie
    expect(buildDay(getState(), MON).strength).not.toBeNull()
  })

  it('kan ook op een rustdag en op een eerdere datum', () => {
    A.addActivity(WO, { type: 'wandelen', minutes: 60, intensity: 'rustig' })
    expect(buildDay(getState(), WO).isRest).toBe(true)
    expect(activitiesOn(getState(), WO)).toHaveLength(1)

    // achteraf invullen: de dag hoeft niet vandaag te zijn
    A.addActivity(DI, { type: 'zwemmen', minutes: 30, intensity: 'intensief' })
    expect(activitiesOn(getState(), DI)).toHaveLength(1)
    expect(activitiesOn(getState(), today())).toHaveLength(0)
  })

  it('maakt de invoer schoon: lege notitie wordt null, duur minstens 1 minuut', () => {
    A.addActivity(MON, { type: 'overig', minutes: 0, intensity: 'normaal', note: '   ' })
    const a = activitiesOn(getState(), MON)[0]
    expect(a.note).toBeNull()
    expect(a.minutes).toBe(1)
  })

  it('geeft elke activiteit een eigen id', () => {
    const ids = [
      A.addActivity(MON, { type: 'fietsen', minutes: 20, intensity: 'rustig' }),
      A.addActivity(MON, { type: 'fietsen', minutes: 20, intensity: 'rustig' }),
      A.addActivity(MON, { type: 'fietsen', minutes: 20, intensity: 'rustig' }),
    ]
    expect(new Set(ids).size).toBe(3)
  })
})

describe('bewerken en verwijderen', () => {
  it('past een bestaande activiteit aan', () => {
    const id = A.addActivity(MON, { type: 'fietsen', minutes: 40, intensity: 'rustig' })
    A.updateActivity(id, { minutes: 55, intensity: 'intensief', note: 'toch hard gegaan' })

    const a = activitiesOn(getState(), MON)[0]
    expect(a).toMatchObject({ id, type: 'fietsen', minutes: 55, intensity: 'intensief' })
    expect(a.note).toBe('toch hard gegaan')
  })

  it('kan een activiteit naar een andere dag verplaatsen', () => {
    const id = A.addActivity(MON, { type: 'wandelen', minutes: 30, intensity: 'rustig' })
    A.updateActivity(id, { date: DI })

    expect(activitiesOn(getState(), MON)).toHaveLength(0)
    expect(activitiesOn(getState(), DI)).toHaveLength(1)
  })

  it('laat de andere activiteiten met rust bij bewerken en verwijderen', () => {
    const eerste = A.addActivity(MON, { type: 'fietsen', minutes: 40, intensity: 'rustig' })
    const tweede = A.addActivity(MON, { type: 'zwemmen', minutes: 30, intensity: 'normaal' })

    A.updateActivity(eerste, { minutes: 50 })
    expect(activitiesOn(getState(), MON).find((a) => a.id === tweede)?.minutes).toBe(30)

    A.removeActivity(eerste)
    const over = activitiesOn(getState(), MON)
    expect(over).toHaveLength(1)
    expect(over[0].id).toBe(tweede)
  })

  it('doet niets bij een onbekend id', () => {
    A.addActivity(MON, { type: 'fietsen', minutes: 40, intensity: 'rustig' })
    A.updateActivity('bestaat-niet', { minutes: 999 })
    A.removeActivity('bestaat-niet')
    expect(activitiesOn(getState(), MON)).toHaveLength(1)
    expect(activitiesOn(getState(), MON)[0].minutes).toBe(40)
  })

  it('bewaart de wijziging over een herlaadbeurt heen', () => {
    const id = A.addActivity(MON, { type: 'spinning', minutes: 45, intensity: 'intensief' })
    A.updateActivity(id, { minutes: 50 })

    const opgeslagen = localStorage.getItem('trainingsapp.state.v1')
    expect(opgeslagen).not.toBeNull()
    const herladen = migrate(JSON.parse(opgeslagen!))
    expect(herladen.activities).toHaveLength(1)
    expect(herladen.activities[0].minutes).toBe(50)
  })
})

describe('historie en volgorde', () => {
  it('zet de nieuwste dag bovenaan in de historie', () => {
    A.addActivity(MON, { type: 'fietsen', minutes: 40, intensity: 'rustig' })
    A.addActivity(WO, { type: 'wandelen', minutes: 60, intensity: 'rustig' })
    A.addActivity(DI, { type: 'zwemmen', minutes: 30, intensity: 'normaal' })

    expect(recentActivities(getState()).map((a) => a.date)).toEqual([WO, DI, MON])
  })

  it('kapt de historie af op de gevraagde lengte', () => {
    for (let i = 0; i < 5; i++) {
      A.addActivity(MON, { type: 'overig', minutes: 10, intensity: 'normaal' })
    }
    expect(recentActivities(getState(), 3)).toHaveLength(3)
  })
})

describe('krachtprogressie blijft onaangeroerd', () => {
  /** De eerste oefening van maandag, zoals het sessiescherm hem ook zou aanleveren. */
  const slot = () => buildDay(getState(), MON).strength!.slots.slice(0, 1)
  const slotKey = () => slot()[0].slot.key
  const entries = () => ({ [slotKey()]: [{ weight: 100, reps: 10, rir: 1, done: true }] })

  /** lastUpdated is een wandkloktijd; die zegt niets over de progressie zelf. */
  const targets = () =>
    Object.fromEntries(
      Object.entries(getState().exerciseState).map(([id, es]) => {
        const { lastUpdated: _, ...rest } = es
        return [id, rest]
      }),
    )

  it('geeft exact dezelfde streefwaarden met en zonder losse activiteiten', () => {
    // zonder activiteiten
    A.completeSession(MON, 'legs_a', slot(), entries(), false, [slotKey()])
    const zonder = targets()
    expect(Object.keys(zonder).length).toBeGreaterThan(0)

    // met een stapel activiteiten eromheen
    resetState()
    setState((s) => ({ ...s, startDate: MON }))
    A.addActivity(MON, { type: 'fietsen', minutes: 90, intensity: 'intensief' })
    A.addActivity(MON, { type: 'spinning', minutes: 60, intensity: 'intensief' })
    A.addActivity(DI, { type: 'hardlopen', minutes: 45, intensity: 'intensief' })
    A.completeSession(MON, 'legs_a', slot(), entries(), false, [slotKey()])

    expect(targets()).toEqual(zonder)
  })

  it('laat de 1RM-grafiek en het loopvolume ongemoeid', () => {
    A.completeSession(MON, 'legs_a', slot(), entries(), false, [slotKey()])
    const serieVoor = oneRmSeries(getState())
    const volumeVoor = weeklyRunVolume(getState(), 12)
    expect(serieVoor.length).toBeGreaterThan(0)

    A.addActivity(MON, { type: 'hardlopen', minutes: 60, intensity: 'intensief' })
    A.addActivity(MON, { type: 'fietsen', minutes: 90, intensity: 'intensief' })

    expect(oneRmSeries(getState())).toEqual(serieVoor)
    expect(weeklyRunVolume(getState(), 12)).toEqual(volumeVoor)
  })

  it('verandert het schema en de rustdag niet', () => {
    const voor = buildDay(getState(), MON)
    const rustVoor = buildDay(getState(), WO)

    A.addActivity(MON, { type: 'fietsen', minutes: 45, intensity: 'intensief' })
    A.addActivity(WO, { type: 'wandelen', minutes: 60, intensity: 'rustig' })

    expect(buildDay(getState(), MON)).toEqual(voor)
    const rustNa = buildDay(getState(), WO)
    expect(rustNa).toEqual(rustVoor)
    expect(rustNa.isRest).toBe(true)
    expect(rustNa.strength).toBeNull()
    expect(rustNa.run).toBeNull()
  })

  it('houdt de sessielog vrij van activiteiten', () => {
    const key = slotKey()
    A.addActivity(MON, { type: 'fietsen', minutes: 45, intensity: 'rustig' })
    A.completeSession(MON, 'legs_a', slot(), entries(), false, [key])

    const log = getState().sessions[`${MON}:legs_a`]
    expect(Object.keys(log.entries)).toEqual([key])
    expect(JSON.stringify(log)).not.toContain('fietsen')
  })
})

describe('opslag, export en migratie', () => {
  it('neemt activiteiten mee in de export en import', () => {
    A.addActivity(MON, { type: 'fietsen', minutes: 40, intensity: 'rustig', note: 'avondrondje' })
    A.addActivity(WO, { type: 'wandelen', minutes: 60, intensity: 'normaal' })
    const voor = getState().activities

    const backup = exportJSON()
    expect(JSON.parse(backup).activities).toHaveLength(2)

    resetState()
    expect(getState().activities).toEqual([])

    expect(importJSON(backup).ok).toBe(true)
    expect(getState().activities).toEqual(voor)
  })

  it('geeft oude data zonder activiteiten een lege lijst', () => {
    const v4 = {
      schemaVersion: 4,
      startDate: MON,
      sessions: {
        [`${MON}:legs_a`]: {
          date: MON,
          kind: 'legs_a',
          short: false,
          completedAt: '2026-08-03T18:00:00.000Z',
          skippedSlots: [],
          completedSlots: ['legs_a:0'],
          exercises: { 'legs_a:0': 'leg_press' },
          entries: { 'legs_a:0': [{ weight: 100, reps: 10, rir: 1, done: true }] },
        },
      },
      protein: { [MON]: 150 },
    }

    expect(importJSON(JSON.stringify(v4)).ok).toBe(true)
    const s = getState()
    expect(s.schemaVersion).toBe(SCHEMA_VERSION)
    expect(s.activities).toEqual([])
    // bestaande data blijft overeind
    expect(s.sessions[`${MON}:legs_a`].entries['legs_a:0']).toHaveLength(1)
    expect(s.protein[MON]).toBe(150)
  })

  it('migreert vanaf v1 helemaal door naar een staat met activiteiten', () => {
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

    expect(importJSON(JSON.stringify(v1)).ok).toBe(true)
    expect(getState().schemaVersion).toBe(SCHEMA_VERSION)
    expect(getState().activities).toEqual([])
    expect(getState().sessions[`${MON}:legs_a`].exercises['legs_a:0']).toBe('leg_press')
  })

  it('repareert kapotte activiteiten uit een handgeschreven bestand', () => {
    const rommel = {
      schemaVersion: 4,
      startDate: MON,
      activities: [
        { id: 'a1', date: MON, type: 'onzin', minutes: '40', intensity: 'heel hard', note: '  ' },
        { id: 'a2', date: DI, type: 'zwemmen', minutes: 30, intensity: 'rustig', createdAt: 'x' },
        { date: MON, type: 'fietsen' }, // geen id: vervalt
        null,
        'kapot',
      ],
    }

    expect(importJSON(JSON.stringify(rommel)).ok).toBe(true)
    const list = getState().activities
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({
      id: 'a1',
      type: 'overig',
      minutes: 40,
      intensity: 'normaal',
      note: null,
    })
    expect(list[1]).toMatchObject({ id: 'a2', type: 'zwemmen', intensity: 'rustig' })
  })

  it('overleeft een activities-veld dat geen lijst is', () => {
    expect(migrate({ schemaVersion: SCHEMA_VERSION, activities: 'kapot' }).activities).toEqual([])
    expect(migrate({ schemaVersion: 4, activities: { a: 1 } }).activities).toEqual([])
  })
})

describe('schermen tonen losse activiteiten apart', () => {
  beforeEach(() => {
    setState((s) => ({ ...s, startDate: today() }))
  })

  it('toont de knop op het dagoverzicht, ook zonder gelogde activiteit', () => {
    const html = render(createElement(Today, { onOpenSession: () => {} }))
    expect(html).toContain('Activiteit toevoegen')
    expect(html).toContain('Extra activiteiten')
  })

  it('zet een gelogde activiteit met eigen label naast het schema', () => {
    A.addActivity(today(), { type: 'fietsen', minutes: 40, intensity: 'rustig', note: 'avondrondje' })
    const html = render(createElement(Today, { onOpenSession: () => {} }))

    expect(html).toContain('Extra')
    expect(html).toContain('Fietsen 40 min')
    expect(html).toContain('avondrondje')
    // de knop blijft staan: meerdere per dag mogen
    expect(html).toContain('Activiteit toevoegen')
  })

  it('toont ze in de historie met datum', () => {
    A.addActivity(MON, { type: 'zwemmen', minutes: 30, intensity: 'intensief' })
    const html = render(createElement(ProgressScreen))
    expect(html).toContain('Losse activiteiten')
    expect(html).toContain('Zwemmen 30 min')
    expect(html).toContain('extra activiteiten')
  })
})
