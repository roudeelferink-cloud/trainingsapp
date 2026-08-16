import { describe, expect, it } from 'vitest'
import { buildDay } from '../src/logic/day'
import {
  MAX_SESSION_MINUTES,
  dropCandidate,
  durationWarning,
  sessionMinutes,
  slotMinutes,
} from '../src/logic/duration'
import type { ResolvedSlot } from '../src/logic/select'
import { DI, MON, baseState } from './helpers'

const s0 = baseState()
const benenA = buildDay(s0, MON).strength!.slots
const duwen = buildDay(s0, DI).strength!.slots

describe('geschatte duur', () => {
  it('schat een korte sessie ruim binnen het uur', () => {
    expect(sessionMinutes(duwen, 10)).toBeLessThan(MAX_SESSION_MINUTES)
  })

  it('telt de warming-up mee', () => {
    expect(sessionMinutes(duwen, 15) - sessionMinutes(duwen, 5)).toBe(10)
  })

  it('rekent meer tijd voor meer sets', () => {
    const eenSet = duwen.map((r) => ({ ...r, sets: 1 }))
    expect(sessionMinutes(duwen)).toBeGreaterThan(sessionMinutes(eenSet))
  })

  it('rekent kernwerk zwaarder dan accessoires door de langere rust', () => {
    const kern = duwen.filter((r) => r.slot.role === 'core')[0]
    const alsAccessoire: ResolvedSlot = { ...kern, slot: { ...kern.slot, role: 'accessory' } }
    expect(slotMinutes(kern)).toBeGreaterThan(slotMinutes(alsAccessoire))
  })

  it('telt werk per kant dubbel', () => {
    const perKant = duwen[0]
    const dubbel: ResolvedSlot = {
      ...perKant,
      exercise: { ...perKant.exercise, perSide: true },
    }
    expect(slotMinutes(dubbel)).toBeGreaterThanOrEqual(slotMinutes(perKant))
  })
})

describe('waarschuwing boven het uur', () => {
  it('zwijgt zolang de sessie past', () => {
    expect(durationWarning(duwen, 10)).toBeNull()
  })

  it('waarschuwt met een concreet voorstel zodra het te lang wordt', () => {
    const langeSessie = benenA.map((r) => ({ ...r, sets: r.sets + 2 }))
    const waarschuwing = durationWarning(langeSessie, 10)
    expect(waarschuwing).not.toBeNull()
    expect(waarschuwing!.minutes).toBeGreaterThan(MAX_SESSION_MINUTES)
    expect(waarschuwing!.dropName).not.toBeNull()
    expect(waarschuwing!.minutesWithoutDrop).toBeLessThan(waarschuwing!.minutes)
    expect(waarschuwing!.text).toContain(waarschuwing!.dropName!)
  })

  it('offert nooit een kernoefening op', () => {
    const kandidaat = dropCandidate(benenA)
    expect(kandidaat).not.toBeNull()
    expect(kandidaat!.slot.role).toBe('accessory')
  })

  it('houdt het bij minder sets als er alleen kernwerk over is', () => {
    const alleenKern = benenA.filter((r) => r.slot.role === 'core').map((r) => ({ ...r, sets: 6 }))
    const waarschuwing = durationWarning(alleenKern, 15)
    expect(waarschuwing).not.toBeNull()
    expect(waarschuwing!.dropKey).toBeNull()
    expect(waarschuwing!.text).toContain('minder sets')
  })

  it('kiest het accessoire dat de meeste tijd kost', () => {
    const zwaarste = { ...benenA.filter((r) => r.slot.role === 'accessory')[0], sets: 9 }
    const aangepast = benenA.map((r) => (r.slot.key === zwaarste.slot.key ? zwaarste : r))
    expect(dropCandidate(aangepast)!.slot.key).toBe(zwaarste.slot.key)
  })
})
