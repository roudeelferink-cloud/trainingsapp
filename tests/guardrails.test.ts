import { describe, expect, it } from 'vitest'
import { addDays } from '../src/logic/dates'
import { buildDay, moveTargets } from '../src/logic/day'
import { dayGuardrails, isHeavyLegsSession, legStackAround } from '../src/logic/guardrails'
import { LEG_LOAD_HIGH, legLoadOn } from '../src/logic/legLoad'
import { scheduledRun, scheduledStrength } from '../src/logic/schedule'
import { ANOUC, defaultUser } from '../src/store/store'
import { DI, DO, MON, VR, WO, ZA, ZO, baseState } from './helpers'

const s0 = baseState()
const anouc = { ...defaultUser(ANOUC, 'Anouc', 'fullbody_hardlopen'), startDate: MON }

describe('schema uitlezen', () => {
  it('herkent een zware benensessie aan de oefeningen, niet aan de naam', () => {
    expect(isHeavyLegsSession(s0, MON)).toBe(true) // benen A
    expect(isHeavyLegsSession(s0, VR)).toBe(true) // benen B
    expect(isHeavyLegsSession(s0, DI)).toBe(false) // duwen
    expect(isHeavyLegsSession(s0, DO)).toBe(false) // trekken
    expect(isHeavyLegsSession(s0, WO)).toBe(false) // rustdag
  })

  it('volgt verplaatsingen', () => {
    // ruil: zaterdag is al bezet, dus de twee dagen wisselen van plek
    const state = baseState({ moves: { [MON]: ZA, [ZA]: MON } })
    expect(scheduledStrength(state, MON).kind).toBe('optional_upper')
    expect(scheduledStrength(state, ZA).kind).toBe('legs_a')
    expect(scheduledStrength(state, ZA).movedFrom).toBe(MON)
    expect(scheduledRun(state, ZO).kind).toBe('long')
  })
})

describe('beenbelasting scoren', () => {
  it('rekent een beensessie zwaar en een duwsessie niet mee', () => {
    expect(legLoadOn(s0, MON).level).toBe('zeer_hoog')
    expect(legLoadOn(s0, VR).level).toBe('zeer_hoog')
    expect(legLoadOn(s0, DI).score).toBe(0)
    expect(legLoadOn(s0, DO).score).toBe(0)
  })

  it('noemt de oefeningen die het werk doen', () => {
    const parts = legLoadOn(s0, MON).parts
    expect(parts[0].category).toBe('zwaar')
    expect(parts.map((p) => p.naam)).toContain('Leg press')
    // zwaarste eerst
    expect(parts[0].score).toBeGreaterThanOrEqual(parts[parts.length - 1].score)
  })

  it('laat een full body met één matige beenoefening onder de drempel', () => {
    // full body A: leg press plus glute bridge en bandwerk
    const load = legLoadOn(anouc, WO)
    expect(load.score).toBeGreaterThan(0)
    expect(load.score).toBeLessThan(LEG_LOAD_HIGH)
  })

  it('telt een full body met drie beenoefeningen wél als zwaar', () => {
    expect(legLoadOn(anouc, ZA).score).toBeGreaterThanOrEqual(LEG_LOAD_HIGH)
  })

  it('telt lichter in een deloadweek: minder sets en minder gewicht', () => {
    const week8 = addDays(MON, 49)
    expect(buildDay(s0, week8).deload.active).toBe(true)
    expect(legLoadOn(s0, week8).score).toBeLessThan(legLoadOn(s0, MON).score)
  })

  it('telt niet mee als de sessie overgeslagen is', () => {
    const state = baseState({ skips: { [`${MON}:strength`]: { reason: 'ziek', what: 'strength' } } })
    expect(legLoadOn(state, MON).score).toBe(0)
  })

  it('telt lichter in de korte versie', () => {
    const kort = baseState({ overrides: { [MON]: { short: true } } })
    expect(legLoadOn(kort, MON).score).toBeLessThan(legLoadOn(s0, MON).score)
  })
})

describe('twee zware beensessies achter elkaar', () => {
  it('ziet een beensessie die naast een andere beensessie landt', () => {
    // benen B naar dinsdag ruilen zet hem direct achter benen A van maandag
    const state = baseState({ moves: { [VR]: DI, [DI]: VR } })
    const stapel = legStackAround(state, DI)
    expect(stapel).not.toBeNull()
    expect(stapel!.first).toBe(MON)
    expect(stapel!.second).toBe(DI)
    expect(stapel!.hours).toBe(24)
    expect(stapel!.text).toContain('24 uur')
  })

  it('waarschuwt daarvoor bij het verplaatsen', () => {
    const doel = moveTargets(s0, VR).find((t) => t.date === DI)!
    expect(doel.warnings.join(' ')).toContain('Twee dagen zwaar beenwerk')
  })

  it('zwijgt bij de standaardweek', () => {
    for (const iso of [MON, DI, DO, VR, ZA]) {
      expect(legStackAround(s0, iso), iso).toBeNull()
    }
  })
})

describe('alles wat de app bijstuurt is uitlegbaar', () => {
  it('geeft per bijsturing één regel', () => {
    // twee zware beendagen achter elkaar is wat er nog te melden valt
    const state = baseState({ moves: { [VR]: DI, [DI]: VR } })
    const regels = dayGuardrails(state, DI)
    expect(regels.length).toBeGreaterThan(0)
    for (const r of regels) {
      expect(r.text.length).toBeGreaterThan(10)
      expect(r.id).toBeTruthy()
    }
  })

  it('legt de deloadweek uit', () => {
    const week8 = addDays(MON, 49)
    const regels = dayGuardrails(baseState(), week8)
    expect(regels.some((g) => g.id === 'deload' && g.text.includes('40%'))).toBe(true)
  })

  it('zet alle guardrails ook in de dagnotities', () => {
    const week8 = addDays(MON, 49)
    const plan = buildDay(baseState(), week8)
    for (const g of plan.guardrails) expect(plan.notes).toContain(g.text)
  })
})
