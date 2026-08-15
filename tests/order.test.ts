import { beforeEach, describe, expect, it } from 'vitest'
import { EXERCISES, getExercise } from '../src/data/exercises'
import { programFor } from '../src/data/programs'
import { buildDay } from '../src/logic/day'
import { addDays } from '../src/logic/dates'
import {
  ORDER_CATEGORIES,
  ORDER_CATEGORY_LABEL,
  ORDER_RATIONALE,
  moveKey,
  orderRank,
  orderSlots,
  sortByCategory,
} from '../src/logic/order'
import type { ResolvedSlot } from '../src/logic/select'
import * as A from '../src/store/actions'
import {
  ANOUC,
  ROB,
  getRoot,
  getState,
  migrate,
  replaceRoot,
  resetState,
  setCurrentUser,
  setState,
} from '../src/store/store'
import type { OrderCategory } from '../src/types'
import { MON } from './helpers'

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: MON }))
})

/** Kale ResolvedSlot om de sorteerlogica los te kunnen testen. */
function slot(exerciseId: string, key = exerciseId): ResolvedSlot {
  const exercise = getExercise(exerciseId)
  return {
    slot: { key, exerciseId, role: exercise.role, setsReps: exercise.setsReps },
    exercise,
    sets: exercise.setsReps.sets,
    repMin: exercise.setsReps.repMin,
    repMax: exercise.setsReps.repMax,
    reasons: [],
  }
}

const ids = (slots: ResolvedSlot[]) => slots.map((r) => r.exercise.id)

describe('orderCategory op de oefening', () => {
  it('staat op elke oefening en is een bekende categorie', () => {
    for (const e of EXERCISES) {
      expect(ORDER_CATEGORIES, e.id).toContain(e.orderCategory)
    }
  })

  it('zet de zware samengestelde beenoefeningen vooraan', () => {
    for (const id of ['squat_bw', 'smith_squat', 'leg_press', 'rdl_trapbar', 'rdl_barbell']) {
      expect(getExercise(id).orderCategory, id).toBe('heavy_legs')
    }
  })

  it('zet het overige samengestelde werk in de tweede groep', () => {
    for (const id of ['bench_smith', 'cable_row_low', 'lat_pulldown', 'smith_ohp', 'db_shoulder_press']) {
      expect(getExercise(id).orderCategory, id).toBe('compound')
    }
  })

  it('zet isolatie in de derde groep', () => {
    for (const id of ['leg_extension', 'leg_curl', 'curl_bar_curl', 'db_curl', 'standing_calf_smith', 'seated_calf']) {
      expect(getExercise(id).orderCategory, id).toBe('isolation')
    }
  })

  it('zet rompwerk als afsluiter', () => {
    for (const e of EXERCISES.filter((x) => x.pattern === 'core')) {
      expect(e.orderCategory, e.id).toBe('core')
    }
    expect(getExercise('ab_roller_ex').orderCategory).toBe('core')
  })

  it('heeft voor elke categorie een label en een oplopende rang', () => {
    const ranks = ORDER_CATEGORIES.map(orderRank)
    expect(ranks).toEqual([0, 1, 2, 3])
    for (const c of ORDER_CATEGORIES) expect(ORDER_CATEGORY_LABEL[c].length).toBeGreaterThan(0)
  })

  it('legt de reden kort uit, in de app te tonen achter het vraagteken', () => {
    expect(ORDER_RATIONALE).toContain('Zwaar en technisch')
    expect(ORDER_RATIONALE.toLowerCase()).toContain('blessure')
  })
})

describe('sorteren binnen een sessie', () => {
  it('zet de vier groepen in de vaste volgorde', () => {
    const gemengd = [
      slot('ab_roller_ex'),
      slot('curl_bar_curl'),
      slot('bench_smith'),
      slot('leg_press'),
    ]
    expect(ids(sortByCategory(gemengd))).toEqual([
      'leg_press',
      'bench_smith',
      'curl_bar_curl',
      'ab_roller_ex',
    ])
  })

  it('houdt binnen een groep de volgorde van het sjabloon aan', () => {
    const compound = [slot('lat_pulldown'), slot('bench_smith'), slot('cable_row_low')]
    expect(ids(sortByCategory(compound))).toEqual(['lat_pulldown', 'bench_smith', 'cable_row_low'])
    // en andersom net zo goed: er is geen verborgen tweede sortering
    const anders = [slot('cable_row_low'), slot('lat_pulldown'), slot('bench_smith')]
    expect(ids(sortByCategory(anders))).toEqual(['cable_row_low', 'lat_pulldown', 'bench_smith'])
  })

  it('laat een eigen volgorde winnen van de sortering', () => {
    const slots = [slot('leg_press'), slot('bench_smith'), slot('ab_roller_ex')]
    expect(ids(orderSlots(slots, ['ab_roller_ex', 'leg_press', 'bench_smith']))).toEqual([
      'ab_roller_ex',
      'leg_press',
      'bench_smith',
    ])
  })

  it('zet oefeningen buiten de eigen volgorde erachter, in de standaardvolgorde', () => {
    const slots = [slot('leg_press'), slot('ab_roller_ex'), slot('bench_smith')]
    expect(ids(orderSlots(slots, ['ab_roller_ex']))).toEqual([
      'ab_roller_ex',
      'leg_press',
      'bench_smith',
    ])
  })

  it('negeert sleutels uit een eigen volgorde die er niet meer zijn', () => {
    const slots = [slot('bench_smith'), slot('leg_press')]
    expect(ids(orderSlots(slots, ['weg', 'bench_smith', 'ook_weg']))).toEqual([
      'bench_smith',
      'leg_press',
    ])
  })

  it('schuift één oefening op met moveKey en laat de rest staan', () => {
    expect(moveKey(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(moveKey(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
    // aan de randen en bij een onbekende sleutel verandert er niets
    expect(moveKey(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveKey(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
    expect(moveKey(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'b', 'c'])
  })
})

describe('de volgorde van elke echte sessie', () => {
  /** Alle krachtsessies van vier weken, voor beide gebruikers. */
  function alleSessies(): OrderCategory[][] {
    const out: OrderCategory[][] = []
    for (const user of [ROB, ANOUC]) {
      setCurrentUser(user)
      setState((s) => ({ ...s, startDate: MON }))
      for (let d = 0; d < 28; d++) {
        const plan = buildDay(getState(), addDays(MON, d))
        if (plan.strength) out.push(plan.strength.slots.map((r) => r.exercise.orderCategory))
      }
    }
    setCurrentUser(ROB)
    return out
  }

  it('loopt nooit van licht naar zwaar', () => {
    const sessies = alleSessies()
    expect(sessies.length).toBeGreaterThan(10)
    for (const categorieën of sessies) {
      const rangen = categorieën.map(orderRank)
      expect([...rangen].sort((a, b) => a - b), categorieën.join(' > ')).toEqual(rangen)
    }
  })

  it('begint benen A met de zware beenoefeningen en eindigt met de isolatie', () => {
    const slots = buildDay(getState(), MON).strength!.slots
    expect(ids(slots)).toEqual([
      'leg_press',
      'smith_squat',
      'rdl_trapbar',
      'leg_curl',
      'standing_calf_smith',
      'band_lateral_walk',
    ])
  })

  it('sluit duwen af met de ab roller, na het triceps-werk', () => {
    const di = addDays(MON, 1)
    const slots = buildDay(getState(), di).strength!.slots
    expect(slots[slots.length - 1].exercise.id).toBe('ab_roller_ex')
    expect(slots[0].exercise.orderCategory).toBe('compound')
  })

  it('trekt bij Anouc het beenwerk naar voren, vóór het bovenlichaam', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    const zaterdag = addDays(MON, 5)
    const plan = buildDay(getState(), zaterdag)
    expect(plan.strength!.kind).toBe('full_body_b')

    const volgorde = ids(plan.strength!.slots)
    // sjabloonvolgorde had de pull-through en de step-up achter het bovenlichaam
    const tpl = programFor(getState()).templateFor('full_body_b', 1)!
    expect(tpl.slots.map((x) => x.exerciseId)).not.toEqual(volgorde)
    expect(volgorde.slice(0, 3)).toEqual(['smith_squat', 'cable_pullthrough', 'step_up_bw'])
    expect(volgorde[volgorde.length - 1]).toBe('standing_calf_bw')
  })
})

describe('zelf herordenen', () => {
  const keys = () => buildDay(getState(), MON).strength!.slots.map((r) => r.slot.key)

  it('schuift een oefening naar voren en houdt dat vast', () => {
    const voor = keys()
    const legCurl = voor[3]
    expect(buildDay(getState(), MON).strength!.slots[3].exercise.id).toBe('leg_curl')

    A.moveSlot(MON, legCurl, -1)

    expect(keys()).toEqual([voor[0], voor[1], legCurl, voor[2], voor[4], voor[5]])
    expect(getState().overrides[MON]?.order).toHaveLength(6)
    expect(buildDay(getState(), MON).strength!.manualOrder).toBe(true)
  })

  it('schuift ook terug en niet voorbij de rand', () => {
    const voor = keys()
    A.moveSlot(MON, voor[0], -1) // al de eerste
    expect(keys()).toEqual(voor)
    expect(getState().overrides[MON]?.order).toBeUndefined()

    A.moveSlot(MON, voor[0], 1)
    expect(keys()[0]).toBe(voor[1])
    A.moveSlot(MON, voor[0], -1)
    expect(keys()).toEqual(voor)
  })

  it('gaat met één druk terug naar de standaardvolgorde', () => {
    const voor = keys()
    A.moveSlot(MON, voor[5], -1)
    expect(keys()).not.toEqual(voor)

    A.resetSlotOrder(MON)
    expect(keys()).toEqual(voor)
    expect(getState().overrides[MON]?.order).toBeUndefined()
    expect(buildDay(getState(), MON).strength!.manualOrder).toBe(false)
  })

  it('blijft werken als er daarna een oefening overgeslagen wordt', () => {
    const voor = keys()
    A.moveSlot(MON, voor[4], -1) // kuitwerk naar voren
    A.skipSlot(MON, voor[0]) // en de leg press eruit

    const na = keys()
    expect(na).not.toContain(voor[0])
    expect(na).toEqual([voor[1], voor[2], voor[4], voor[3], voor[5]])
  })

  it('bewaart de eigen volgorde per gebruiker en over een herlaadbeurt heen', () => {
    const voor = keys()
    A.moveSlot(MON, voor[3], -1)
    const robsVolgorde = keys()

    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    expect(getState().overrides[MON]?.order).toBeUndefined()

    const opgeslagen = localStorage.getItem('trainingsapp.state.v1')
    replaceRoot(migrate(JSON.parse(opgeslagen!)))

    const root = getRoot()
    expect(root.users[ANOUC].overrides[MON]?.order).toBeUndefined()
    expect(buildDay(root.users[ROB], MON).strength!.slots.map((r) => r.slot.key)).toEqual(
      robsVolgorde,
    )
  })
})
