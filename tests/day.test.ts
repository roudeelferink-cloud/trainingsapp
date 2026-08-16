import { describe, expect, it } from 'vitest'
import { TEMPLATES, saturdayTemplate } from '../src/data/plan'
import { buildDay, moveTargets } from '../src/logic/day'
import { addDays, weekday } from '../src/logic/dates'
import { durationWarning } from '../src/logic/duration'
import { resolveSlot } from '../src/logic/select'
import { DI, DO, MON, VR, WO, ZA, ZO, baseState } from './helpers'

const s0 = baseState()

describe('weekstructuur', () => {
  it('zet maandag op benen A zonder loop', () => {
    const day = buildDay(s0, MON)
    expect(day.strength?.kind).toBe('legs_a')
    expect(day.run).toBeNull()
  })

  it('zet dinsdag op korte loop plus duwen', () => {
    const day = buildDay(s0, DI)
    expect(day.run?.kind).toBe('short')
    expect(day.strength?.kind).toBe('push')
  })

  it('houdt woensdag altijd leeg', () => {
    const day = buildDay(s0, WO)
    expect(day.isRest).toBe(true)
    expect(day.run).toBeNull()
    expect(day.strength).toBeNull()
  })

  it('houdt woensdag ook leeg met check-in, deload en reismodus aan', () => {
    const state = baseState({
      checkins: { [WO]: 5 },
      settings: { ...s0.settings, travelMode: true },
    })
    const day = buildDay(state, addDays(WO, 21))
    expect(day.isRest).toBe(true)
    expect(day.strength).toBeNull()
  })

  it('zet donderdag op korte loop plus trekken', () => {
    const day = buildDay(s0, DO)
    expect(day.run?.kind).toBe('short')
    expect(day.strength?.kind).toBe('pull')
  })

  it('zet vrijdag op benen B zonder loop', () => {
    expect(buildDay(s0, VR).strength?.kind).toBe('legs_b')
    expect(buildDay(s0, VR).run).toBeNull()
  })

  it('markeert zaterdag als optioneel', () => {
    expect(buildDay(s0, ZA).strength?.optional).toBe(true)
  })

  it('zet zondag op de duurloop zonder krachtsessie', () => {
    expect(buildDay(s0, ZO).run?.kind).toBe('long')
    expect(buildDay(s0, ZO).strength).toBeNull()
  })
})

describe('deload', () => {
  // week 8 is de vaste deloadweek; die begint 7 weken na de start
  const deload = buildDay(s0, addDays(MON, 49))
  const normaal = buildDay(s0, MON)

  it('valt op de achtste trainingsweek', () => {
    expect(deload.deload.active).toBe(true)
    expect(deload.deload.reason).toBe('ritme')
    expect(buildDay(s0, addDays(MON, 21)).deload.active).toBe(false)
  })

  it('haalt één set per oefening weg', () => {
    expect(deload.strength!.slots[0].sets).toBe(normaal.strength!.slots[0].sets - 1)
  })

  it('zet de optionele zaterdagsessie automatisch uit', () => {
    expect(buildDay(s0, addDays(ZA, 49)).strength).toBeNull()
  })
})

describe('ochtend-check-in', () => {
  it('haalt bij 1-2 een set weg en gooit zwaar kuitwerk eruit', () => {
    const laag = buildDay(baseState({ checkins: { [MON]: 2 } }), MON)
    const normaal = buildDay(s0, MON)
    expect(laag.strength!.slots[0].sets).toBe(normaal.strength!.slots[0].sets - 1)
    expect(laag.strength!.hiddenCalf).toBe(true)
  })

  it('kort bij 1-2 de loop met 30% in', () => {
    const laag = buildDay(baseState({ checkins: { [DI]: 1 } }), DI)
    expect(laag.run!.km).toBeLessThan(laag.run!.plannedKm)
    expect(laag.run!.scaledDown).toBe(true)
  })

  it('zet bij 1-2 de zaterdagsessie uit', () => {
    expect(buildDay(baseState({ checkins: { [ZA]: 2 } }), ZA).strength).toBeNull()
  })

  it('laat bij 3 het programma staan en meldt dat er niet verhoogd wordt', () => {
    const day = buildDay(baseState({ checkins: { [MON]: 3 } }), MON)
    expect(day.strength!.slots.length).toBe(buildDay(s0, MON).strength!.slots.length)
    expect(day.notes.join(' ')).toContain('geen nieuwe gewichtsverhogingen')
  })

  it('draait bij 4-5 het normale programma', () => {
    const day = buildDay(baseState({ checkins: { [MON]: 5 } }), MON)
    expect(day.strength!.slots[0].sets).toBe(buildDay(s0, MON).strength!.slots[0].sets)
  })
})

describe('korte versie', () => {
  const kort = buildDay(baseState({ overrides: { [MON]: { short: true } } }), MON)

  it('toont alleen kernoefeningen', () => {
    expect(kort.strength!.slots.every((r) => r.slot.role === 'core')).toBe(true)
  })

  it('laat vier oefeningen over bij benen A', () => {
    expect(kort.strength!.slots).toHaveLength(4)
    expect(kort.strength!.slots.map((r) => r.slot.exerciseId)).toEqual([
      'leg_press',
      'rdl_trapbar',
      'standing_calf_smith',
      'band_lateral_walk',
    ])
  })

  it('houdt de volledige benen A op zeven oefeningen', () => {
    // vijf hoofdoefeningen plus twee keer glute medius: bandwerk en vloeractivatie
    expect(buildDay(s0, MON).strength!.slots).toHaveLength(7)
  })

  it('laat accessoires vallen bij duwen', () => {
    const kortDi = buildDay(baseState({ overrides: { [DI]: { short: true } } }), DI)
    expect(kortDi.strength!.slots.length).toBeLessThan(buildDay(s0, DI).strength!.slots.length)
  })
})

describe('gevoelige gebieden', () => {
  it('filtert oefeningen met een gevoelig gebied weg', () => {
    const state = baseState({
      settings: { ...s0.settings, sensitive: { ...s0.settings.sensitive, knee_deep: 'off' } },
    })
    const day = buildDay(state, MON)
    expect(day.strength!.slots.every((r) => !r.exercise.loads.includes('knee_deep'))).toBe(true)
  })

  it('zet lateral_hip standaard op let op', () => {
    expect(s0.settings.sensitive.lateral_hip).toBe('careful')
  })

  it('laat werk op let op gewoon staan', () => {
    expect(buildDay(s0, VR).strength!.slots.some((r) => r.exercise.pattern === 'abduction')).toBe(true)
  })
})

describe('reismodus', () => {
  const travel = baseState({ settings: { ...s0.settings, travelMode: true } })

  it('vervangt alles door lichaamsgewicht of band', () => {
    const day = buildDay(travel, MON)
    for (const r of day.strength!.slots) {
      expect(
        r.exercise.equipment.every(
          (q) => q === 'bodyweight' || q === 'band' || q === 'mini_band',
        ),
        r.exercise.id,
      ).toBe(true)
    }
  })

  it('houdt de sessie kort', () => {
    expect(buildDay(travel, MON).strength!.slots.length).toBeLessThanOrEqual(5)
  })

  it('laat loopdagen ongewijzigd', () => {
    expect(buildDay(travel, DI).run!.km).toBe(buildDay(s0, DI).run!.km)
  })
})

describe('rotatie van de selectie', () => {
  it('kiest na drie cycli andere varianten', () => {
    const week1 = buildDay(s0, MON).strength!.slots.map((r) => r.exercise.id)
    const week13 = buildDay(s0, addDays(MON, 12 * 7)).strength!.slots.map((r) => r.exercise.id)
    expect(week13).not.toEqual(week1)
  })

  it('laat permanent vervangen oefeningen staan', () => {
    const state = baseState({ permanentReplacements: { 'legs_a:0': 'hack_squat_smith' } })
    expect(buildDay(state, addDays(MON, 12 * 7)).strength!.slots[0].exercise.id).toBe(
      'hack_squat_smith',
    )
  })
})

describe('verplaatsen', () => {
  it('maakt de brondag leeg', () => {
    const state = baseState({ moves: { [MON]: ZO } })
    expect(buildDay(state, MON).strength).toBeNull()
    expect(buildDay(state, MON).movedTo).toBe(ZO)
  })

  it('zet de sessie op de doeldag naast de loop', () => {
    const day = buildDay(baseState({ moves: { [MON]: ZO } }), ZO)
    expect(day.run).not.toBeNull()
    expect(day.strength?.kind).toBe('legs_a')
    expect(day.strength?.movedFrom).toBe(MON)
  })

  it('ruilt twee bezette dagen van plek', () => {
    const state = baseState({ moves: { [MON]: VR, [VR]: MON } })
    expect(buildDay(state, MON).strength?.kind).toBe('legs_b')
    expect(buildDay(state, VR).strength?.kind).toBe('legs_a')
  })

  it('biedt woensdag nooit aan als geldige doeldag', () => {
    const woensdagen = moveTargets(s0, MON).filter((t) => weekday(t.date) === 3)
    expect(woensdagen.length).toBeGreaterThan(0)
    expect(woensdagen.every((t) => t.blocked !== null)).toBe(true)
  })

  it('biedt bezette dagen aan als ruil', () => {
    expect(moveTargets(s0, MON).some((t) => t.swapWith !== null && !t.blocked)).toBe(true)
  })
})

describe('zware benen naar zaterdag: een keuze met uitleg', () => {
  it('blokkeert de verplaatsing niet meer, maar waarschuwt wel', () => {
    const zaterdag = moveTargets(s0, MON).find((t) => t.date === ZA)!
    expect(zaterdag.blocked).toBeNull()
    expect(zaterdag.warnings.join(' ')).toContain('duurloop')
  })

  it('waarschuwt ook bij de ruil vanaf zaterdag', () => {
    // za -> ma zet benen A op zaterdag, één dag voor de duurloop
    const maandag = moveTargets(s0, ZA).find((t) => t.date === MON)!
    expect(maandag.warnings.join(' ')).toContain('duurloop')
  })

  it('laat ma -> vr en ma -> zo zonder waarschuwing over de duurloop', () => {
    const vrijdag = moveTargets(s0, MON).find((t) => t.date === VR)!
    // vrijdag is al een beendag: daar staat de waarschuwing over twee zware dagen los van
    expect(vrijdag.warnings.join(' ')).not.toContain('duurloop')
  })

  it('waarschuwt niet bij een sessie zonder beenwerk', () => {
    expect(moveTargets(s0, DI).find((t) => t.date === ZA)!.warnings).toEqual([])
  })
})

describe('overslaan', () => {
  it('logt de reden en laat de sessie als overgeslagen zien', () => {
    const state = baseState({ skips: { [`${MON}:strength`]: { reason: 'druk', what: 'strength' } } })
    expect(buildDay(state, MON).strength!.skipped).toBe('druk')
  })

  it('markeert een overgeslagen loop apart van de krachtsessie', () => {
    const state = baseState({ skips: { [`${DI}:run`]: { reason: 'ziek', what: 'run' } } })
    const day = buildDay(state, DI)
    expect(day.run!.skipped).toBe('ziek')
    expect(day.strength!.skipped).toBeNull()
  })
})

describe('fietsen in plaats van lopen', () => {
  it('vervangt de loop', () => {
    expect(buildDay(baseState({ overrides: { [DI]: { bike: true } } }), DI).run!.bike).toBe(true)
  })
})

describe('resolveSlot', () => {
  it('levert voor elk slot en elke rotatie een oefening op', () => {
    const templates = [
      TEMPLATES.legs_a,
      TEMPLATES.push,
      TEMPLATES.pull,
      TEMPLATES.legs_b,
      saturdayTemplate(1),
    ]
    for (const tpl of templates) {
      for (const slot of tpl!.slots) {
        for (let rotation = 0; rotation < 8; rotation++) {
          const r = resolveSlot(slot, s0, MON, rotation)
          expect(r.exercise, `${slot.key} rotatie ${rotation}`).toBeTruthy()
          expect(r.repMin).toBeLessThanOrEqual(r.repMax)
        }
      }
    }
  })
})

describe('de loop van de dag', () => {
  it('schrijft dinsdag en donderdag 5-8 km voor en zondag de duurloop', () => {
    for (const iso of [DI, DO]) {
      const run = buildDay(s0, iso).run!
      expect(run.km, iso).toBeGreaterThanOrEqual(5)
      expect(run.km, iso).toBeLessThanOrEqual(8)
    }
    expect(buildDay(s0, ZO).run!.km).toBe(10)
  })

  it('houdt de zondagse duurloop altijd langer dan de korte lopen', () => {
    // ook na een week waarin er veel minder gelopen is dan gepland
    const state = baseState({
      runs: {
        [addDays(DI, 7)]: {
          date: addDays(DI, 7), kind: 'short', plannedKm: 6, km: 4, minutes: 26,
          bike: false, completedAt: 'x',
        },
      },
    })
    const derdeWeek = addDays(MON, 14)
    const kort = buildDay(state, addDays(derdeWeek, 1)).run!.km
    const lang = buildDay(state, addDays(derdeWeek, 6)).run!.km
    expect(lang).toBeGreaterThan(kort)
  })

  it('laat de geplande afstand met de hand overschrijven', () => {
    const state = baseState({ runPlans: { [ZO]: 13 } })
    const run = buildDay(state, ZO).run!
    expect(run.plannedKm).toBe(13)
    expect(run.km).toBe(13)
    expect(run.manualPlan).toBe(true)
    expect(run.why.join(' ')).toContain('Zelf ingesteld')
  })

  it('legt per bijsturing uit waarom de afstand is wat hij is', () => {
    const laag = buildDay(baseState({ checkins: { [DI]: 1 } }), DI)
    expect(laag.run!.why.join(' ')).toContain('30% korter')
  })

  it('haalt in de deloadweek kilometers weg', () => {
    const normaal = buildDay(s0, ZO).run!.km
    const deload = buildDay(s0, addDays(ZO, 49)).run!.km
    expect(deload).toBeLessThan(normaal)
  })
})

describe('geschatte duur van de sessie', () => {
  it('staat op elke krachtsessie', () => {
    const strength = buildDay(s0, MON).strength!
    expect(strength.estimatedMin).toBeGreaterThan(20)
  })

  it('waarschuwt boven het uur en wijst een accessoire aan', () => {
    const state = baseState({ sessions: {} })
    const plan = buildDay(state, MON)
    const langer = plan.strength!.slots.map((r) => ({ ...r, sets: r.sets + 3 }))
    // de sessie zelf is nog binnen het uur; met drie sets extra per oefening niet meer
    expect(plan.strength!.tooLong).toBeNull()
    expect(durationWarning(langer, plan.strength!.warmup.minutes)).not.toBeNull()
  })
})
