import { beforeEach, describe, expect, it } from 'vitest'
import { buildDay } from '../src/logic/day'
import * as A from '../src/store/actions'
import { getState, migrate, replaceRoot, resetState, setState } from '../src/store/store'
import { MON } from './helpers'

const key = `${MON}:legs_a`

beforeEach(() => {
  resetState()
  setState((s) => ({ ...s, startDate: MON }))
})

describe('afgeronde oefeningen bewaren en herstellen', () => {
  const draftEntries = { 'legs_a:0': [{ weight: 100, reps: 10, rir: 2, done: true }] }
  const draftExercises = { 'legs_a:0': 'leg_press' }

  it('bewaart de afgeronde status in het concept en herstelt die uit localStorage', () => {
    A.saveSessionDraft(MON, 'legs_a', draftEntries, draftExercises, false, ['legs_a:0'])
    expect(getState().sessions[key].completedSlots).toEqual(['legs_a:0'])
    expect(getState().sessions[key].completedAt).toBeNull() // sessie zelf nog open

    // herlaadbeurt: opnieuw inladen wat er in localStorage staat
    const raw = localStorage.getItem('trainingsapp.state.v1')
    expect(raw).not.toBeNull()
    replaceRoot(migrate(JSON.parse(raw!)))
    expect(getState().sessions[key].completedSlots).toEqual(['legs_a:0'])
    expect(getState().sessions[key].entries['legs_a:0'][0].done).toBe(true)
  })

  it('kan een afgeronde oefening weer op niet-afgerond zetten', () => {
    A.saveSessionDraft(MON, 'legs_a', draftEntries, draftExercises, false, ['legs_a:0'])
    A.saveSessionDraft(MON, 'legs_a', draftEntries, draftExercises, false, [])
    expect(getState().sessions[key].completedSlots).toEqual([])
  })

  it('houdt de afgeronde oefeningen vast bij heropenen van de sessie', () => {
    const slots = buildDay(getState(), MON).strength!.slots
    const slotKey = slots[0].slot.key
    A.completeSession(
      MON,
      'legs_a',
      slots,
      { [slotKey]: [{ weight: 100, reps: 10, rir: 3, done: true }] },
      false,
      [slotKey],
    )
    expect(getState().sessions[key].completedAt).not.toBeNull()

    A.reopenSession(MON, 'legs_a')
    expect(getState().sessions[key].completedAt).toBeNull()
    expect(getState().sessions[key].completedSlots).toEqual([slotKey])
  })
})

describe('alleen afgevinkte sets tellen mee', () => {
  it('negeert voorgevulde maar niet-afgevinkte sets bij het afronden', () => {
    const slots = buildDay(getState(), MON).strength!.slots
    const slot = slots[0]
    const entries = {
      [slot.slot.key]: [
        { weight: 100, reps: 10, rir: 3, done: true },
        { weight: 180, reps: 10, rir: 3, done: false }, // voorgevuld, niet gedaan
      ],
    }

    A.completeSession(MON, 'legs_a', slots, entries, false, [slot.slot.key])

    const log = getState().sessions[key]
    expect(log.completedSlots).toEqual([slot.slot.key])
    // de niet-afgevinkte set is niet opgeslagen…
    expect(log.entries[slot.slot.key]).toEqual([{ weight: 100, reps: 10, rir: 3, done: true }])
    // …en stuurt de progressie ook niet: het streefgewicht volgt de gedane set
    expect(getState().exerciseState[slot.exercise.id].targetWeight).toBe(100)
  })

  it('telt een afgevinkte set zonder reps niet als gelogd', () => {
    const slots = buildDay(getState(), MON).strength!.slots
    const slot = slots[0]
    A.completeSession(
      MON,
      'legs_a',
      slots,
      { [slot.slot.key]: [{ weight: 100, reps: 0, rir: 2, done: true }] },
      false,
      [],
    )
    expect(getState().sessions[key].entries[slot.slot.key]).toEqual([])
    expect(getState().exerciseState[slot.exercise.id]).toBeUndefined()
  })
})

describe('migratie v3 -> v4', () => {
  it('vinkt oude sets met reps af en vult completedSlots aan', () => {
    const v3 = {
      schemaVersion: 3,
      startDate: MON,
      sessions: {
        [key]: {
          date: MON,
          kind: 'legs_a',
          short: false,
          completedAt: '2026-08-03T18:00:00.000Z',
          skippedSlots: [],
          exercises: { 'legs_a:0': 'leg_press' },
          entries: {
            'legs_a:0': [
              { weight: 100, reps: 10, rir: 1 },
              { weight: 100, reps: 0, rir: 2 },
            ],
          },
        },
      },
    }

    const s = migrate(v3).users.rob
    expect(s.sessions[key].completedSlots).toEqual([])
    expect(s.sessions[key].entries['legs_a:0']).toEqual([
      { weight: 100, reps: 10, rir: 1, done: true },
      { weight: 100, reps: 0, rir: 2, done: false },
    ])
  })
})
