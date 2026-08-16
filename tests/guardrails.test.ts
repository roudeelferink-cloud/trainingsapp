import { describe, expect, it } from 'vitest'
import { addDays } from '../src/logic/dates'
import { buildDay } from '../src/logic/day'
import { dayGuardrails, isHeavyLegsSession, legsBeforeLongRun, longRunDay } from '../src/logic/guardrails'
import { scheduledRun, scheduledStrength } from '../src/logic/schedule'
import { ANOUC, defaultUser } from '../src/store/store'
import { DI, DO, MON, VR, ZA, ZO, baseState } from './helpers'

const s0 = baseState()
const anouc = { ...defaultUser(ANOUC, 'Anouc', 'fullbody_hardlopen'), startDate: MON }

describe('schema uitlezen', () => {
  it('vindt de duurloop van de week', () => {
    expect(longRunDay(s0, MON)).toBe(ZO)
    expect(longRunDay(s0, ZO)).toBe(ZO)
  })

  it('herkent een zware benensessie aan de oefeningen', () => {
    expect(isHeavyLegsSession(s0, 'legs_a', 1)).toBe(true)
    expect(isHeavyLegsSession(s0, 'legs_b', 1)).toBe(true)
    expect(isHeavyLegsSession(s0, 'push', 1)).toBe(false)
    expect(isHeavyLegsSession(s0, 'pull', 1)).toBe(false)
    expect(isHeavyLegsSession(s0, null, 1)).toBe(false)
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

describe('zware benen vlak voor de duurloop', () => {
  it('zwijgt bij de standaardweek: benen B staat op vrijdag, precies 48 uur ervoor', () => {
    expect(legsBeforeLongRun(s0, ZO)).toBeNull()
    expect(buildDay(s0, VR).guardrails.some((g) => g.id === 'benen-voor-duurloop')).toBe(false)
  })

  it('waarschuwt zodra een beensessie op zaterdag landt', () => {
    // verplaatsen naar zaterdag wordt geweigerd door moveBlockReason, maar data uit een
    // oudere versie of een import kan het wel bevatten
    const state = baseState({ moves: { [VR]: ZA, [ZA]: VR } })
    const waarschuwing = legsBeforeLongRun(state, ZO)
    expect(waarschuwing).not.toBeNull()
    expect(waarschuwing!.legsDate).toBe(ZA)
    expect(waarschuwing!.runDate).toBe(ZO)
    expect(waarschuwing!.text).toContain('duurloop')
  })

  it('stelt een dag voor om mee te ruilen', () => {
    const state = baseState({ moves: { [VR]: ZA, [ZA]: VR } })
    const waarschuwing = legsBeforeLongRun(state, ZO)!
    expect(waarschuwing.suggestion).not.toBeNull()
    // minstens twee dagen voor de duurloop
    expect(waarschuwing.suggestion! <= VR).toBe(true)
    expect(waarschuwing.text).toContain('Ruilen')
  })

  it('staat op de beendag én op de loopdag', () => {
    const state = baseState({ moves: { [VR]: ZA, [ZA]: VR } })
    expect(buildDay(state, ZA).guardrails.some((g) => g.id === 'benen-voor-duurloop')).toBe(true)
    expect(buildDay(state, ZO).guardrails.some((g) => g.id === 'benen-voor-duurloop')).toBe(true)
    expect(buildDay(state, DI).guardrails.some((g) => g.id === 'benen-voor-duurloop')).toBe(false)
  })

  it('zwijgt als de duurloop overgeslagen is', () => {
    const state = baseState({
      moves: { [VR]: ZA, [ZA]: VR },
      skips: { [`${ZO}:run`]: { reason: 'ziek', what: 'run' } },
    })
    expect(legsBeforeLongRun(state, ZO)).toBeNull()
  })

  it('waarschuwt ook bij het full body-programma, waar de zware sessie op zaterdag staat', () => {
    const waarschuwing = legsBeforeLongRun(anouc, ZO)
    expect(waarschuwing).not.toBeNull()
    expect(waarschuwing!.legsDate).toBe(ZA)
  })
})

describe('alles wat de app bijstuurt is uitlegbaar', () => {
  it('geeft per bijsturing één regel', () => {
    const state = baseState({ runs: { [DI]: run(DI, 25) } })
    const regels = dayGuardrails(state, DO)
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

function run(date: string, km: number) {
  return {
    date,
    kind: 'short' as const,
    plannedKm: 6,
    km,
    minutes: 60,
    bike: false,
    completedAt: `${date}T18:00:00.000Z`,
  }
}
