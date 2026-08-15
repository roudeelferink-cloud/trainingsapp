import { beforeEach, describe, expect, it } from 'vitest'
import { getExercise } from '../src/data/exercises'
import {
  BAR_IDS,
  DEFAULT_BAR_WEIGHTS,
  barFor,
  barTotalLabel,
  barWeightFor,
  platesFromTotal,
  totalFromPlates,
} from '../src/logic/barWeight'
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
import { MON } from './helpers'

beforeEach(() => {
  resetState()
  setState((s) => ({ ...s, startDate: MON }))
})

describe('welke oefening een stang gebruikt', () => {
  it('herkent de stang aan de uitrusting, mits er schijven op gaan', () => {
    expect(barFor(getExercise('rdl_trapbar'))).toBe('trap_bar')
    expect(barFor(getExercise('smith_squat'))).toBe('smith')
    expect(barFor(getExercise('bench_smith'))).toBe('smith')
    expect(barFor(getExercise('bb_row'))).toBe('barbell')
    expect(barFor(getExercise('rdl_barbell'))).toBe('deadlift_bar')
    expect(barFor(getExercise('curl_bar_curl'))).toBe('curl_bar')
  })

  it('rekent geen stang bij machines, dumbbells of lichaamsgewicht', () => {
    // schijven, maar geen stang
    expect(barFor(getExercise('leg_press'))).toBeNull()
    expect(barFor(getExercise('leg_extension'))).toBeNull()
    // hangt aan de smithstang, maar tilt lichaamsgewicht
    expect(barFor(getExercise('inverted_row_smith'))).toBeNull()
    // smith is hier hooguit steun; het gewicht zit in de dumbbells
    expect(barFor(getExercise('bulgarian_split_squat'))).toBeNull()
    expect(barFor(getExercise('db_shoulder_press'))).toBeNull()
  })
})

describe('stanggewicht uit de instellingen', () => {
  it('gebruikt de standaard: trap bar 20 kg', () => {
    expect(DEFAULT_BAR_WEIGHTS.trap_bar).toBe(20)
    expect(barWeightFor(getExercise('rdl_trapbar'), getState().settings)).toBe(20)
    expect(barWeightFor(getExercise('leg_press'), getState().settings)).toBe(0)
  })

  it('volgt een eigen instelling, ook voor de smithstang', () => {
    A.setBarWeight('smith', 11.5)
    expect(getState().settings.barWeights.smith).toBe(11.5)
    expect(barWeightFor(getExercise('smith_squat'), getState().settings)).toBe(11.5)
    // de andere stangen blijven staan
    expect(getState().settings.barWeights.trap_bar).toBe(20)
  })

  it('weigert een stang zonder gewicht', () => {
    A.setBarWeight('smith', 0)
    A.setBarWeight('smith', -5)
    A.setBarWeight('smith', Number.NaN)
    expect(getState().settings.barWeights.smith).toBe(DEFAULT_BAR_WEIGHTS.smith)
  })

  it('valt terug op de standaard als de opgeslagen waarde onbruikbaar is', () => {
    setState((s) => ({
      ...s,
      settings: { ...s.settings, barWeights: { ...s.settings.barWeights, trap_bar: 0 } },
    }))
    expect(barWeightFor(getExercise('rdl_trapbar'), getState().settings)).toBe(20)
  })
})

describe('schijven omrekenen naar totaal', () => {
  it('telt de stang bij de schijven op', () => {
    expect(totalFromPlates(20, 20)).toBe(40)
    expect(totalFromPlates(0, 20)).toBe(20) // kale stang
    expect(totalFromPlates(2.5, 7.5)).toBe(10)
  })

  it('rekent een gelogd totaal terug naar schijven', () => {
    expect(platesFromTotal(40, 20)).toBe(20)
    expect(platesFromTotal(20, 20)).toBe(0)
    // een totaal onder het stanggewicht levert nooit negatieve schijven op
    expect(platesFromTotal(10, 20)).toBe(0)
  })

  it('is heen en terug hetzelfde', () => {
    for (const bar of BAR_IDS) {
      const kg = DEFAULT_BAR_WEIGHTS[bar]
      for (const plates of [0, 2.5, 15, 62.5]) {
        expect(platesFromTotal(totalFromPlates(plates, kg), kg), `${bar} ${plates}`).toBe(plates)
      }
    }
  })

  it('toont het totaal uitgesplitst', () => {
    expect(barTotalLabel(20, 20)).toBe('40 kg totaal — 20 kg stang + 20 kg schijven')
    expect(barTotalLabel(0, 15)).toBe('15 kg totaal — 15 kg stang + 0 kg schijven')
    expect(barTotalLabel(5, 7.5)).toBe('12,5 kg totaal — 7,5 kg stang + 5 kg schijven')
  })
})

describe('opslag', () => {
  it('geeft data van vóór deze versie de standaardgewichten', () => {
    const v6 = {
      schemaVersion: 6,
      currentUser: 'rob',
      users: { rob: { id: 'rob', naam: 'Rob', startDate: MON, settings: { bodyweightKg: 80 } } },
    }
    const root = migrate(v6)
    expect(root.schemaVersion).toBe(SCHEMA_VERSION)
    expect(root.users.rob.settings.barWeights).toEqual(DEFAULT_BAR_WEIGHTS)
    expect(root.users.rob.settings.bodyweightKg).toBe(80)
  })

  it('houdt een eigen stanggewicht vast over export en import heen', () => {
    A.setBarWeight('smith', 12)
    const backup = exportJSON()

    resetState()
    expect(getState().settings.barWeights.smith).toBe(DEFAULT_BAR_WEIGHTS.smith)

    expect(importJSON(backup).ok).toBe(true)
    expect(getState().settings.barWeights.smith).toBe(12)
  })
})
