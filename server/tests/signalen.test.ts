import { describe, expect, it } from 'vitest'
import { buildSignalen } from '../src/signalen'
import type { Feel } from '../../src/types'
import { deloadFor } from '../../src/logic/deload'
import { dayGuardrails } from '../../src/logic/guardrails'
import { weekLoad } from '../../src/logic/runningLoad'
import { DEZE_MAANDAG, VANDAAG, WEKEN, leegState, robState } from './helpers'

/**
 * De afspraak met het model: de app rekent, het model oordeelt. Deze tests bewaken dat
 * van twee kanten — de getallen die meegaan zijn precies die van de app zelf, en er zit
 * geen tweede berekening in dit bestand.
 */
describe('signalen', () => {
  it('neemt de getallen letterlijk over uit de guardrails van de app', () => {
    const state = robState()
    const s = buildSignalen(state, VANDAAG)
    const load = weekLoad(state, VANDAAG)

    expect(s.loopvolume.referentieKm).toBe(load.reference)
    expect(s.loopvolume.plafondKm).toBe(load.cap)
    expect(s.loopvolume.richtlijnKm).toBe(load.km)
    expect(s.loopvolume.gelopenKm).toBe(load.done)
    expect(s.loopvolume.stapFactor).toBe(load.growth.factor)
    expect(s.loopvolume.redenen).toEqual(load.reasons)
    expect(s.guardrails.map((g) => g.tekst)).toEqual(dayGuardrails(state, VANDAAG).map((g) => g.text))
  })

  it('rekent alles op de meegegeven dag, niet op de echte klok', () => {
    const state = robState()
    const nu = buildSignalen(state, VANDAAG)
    const eerder = buildSignalen(state, '2026-07-01')

    expect(nu.vandaag).toBe(VANDAAG)
    expect(eerder.vandaag).toBe('2026-07-01')
    expect(nu.week).toBeGreaterThan(eerder.week)
    expect(buildSignalen(state, VANDAAG)).toEqual(nu)
  })

  it('geeft de weken oudste eerst mee, met kilometers, tilvolume en gevoel', () => {
    const s = buildSignalen(robState(), VANDAAG, 8)

    expect(s.weken).toHaveLength(8)
    expect(s.weken[0].weekVanaf < s.weken[7].weekVanaf).toBe(true)
    expect(s.weken[7].weekVanaf).toBe(DEZE_MAANDAG)

    const vorige = s.weken[6]
    expect(vorige.gelopenKm).toBeGreaterThan(0)
    expect(vorige.krachtsessies).toBe(2)
    expect(vorige.tilvolumeKg).toBeGreaterThan(0)
    expect(vorige.gevoel).toEqual(['goed', 'goed'])
    expect(vorige.langsteLoopKm).toBeGreaterThan(0)
  })

  it('telt zware sessies en slechte dagen zoals feel.ts dat doet', () => {
    const zwaar = robState({
      gevoel: Array.from({ length: WEKEN }, (_, w) =>
        w >= WEKEN - 3 ? (['zwaar', 'zwaar'] as Feel[]) : (['goed', 'goed'] as Feel[]),
      ),
      dagchecks: Array.from({ length: WEKEN }, () => [
        [1, 1],
        [1, 2],
      ]) as [number, number][][],
    })
    const s = buildSignalen(zwaar, VANDAAG)

    expect(s.herstel.zwareSessies14Dagen).toBeGreaterThanOrEqual(3)
    expect(s.weken[6].slechteDagen).toBe(2)
    expect(s.weken[6].overwegendSlechteWeek).toBe(true)
    // en de deload die daaruit volgt staat er als feit bij, niet als suggestie
    expect(s.deload.aanleiding).toBe(deloadFor(zwaar, VANDAAG).reason)
    expect(s.deload.actief).toBe(true)
  })

  it('houdt een lege staat leeg in plaats van er getallen bij te verzinnen', () => {
    const s = buildSignalen(leegState(), VANDAAG)

    expect(s.weken.every((w) => w.gelopenKm === 0)).toBe(true)
    expect(s.weken.every((w) => w.krachtsessies === 0)).toBe(true)
    expect(s.weken.every((w) => w.slaapGem === null)).toBe(true)
    expect(s.loopvolume.gemiddeldeDuurloopKm).toBeNull()
    expect(s.streefgewichten).toEqual([])
  })

  it('zet de streefgewichten zwaarste eerst', () => {
    const s = buildSignalen(robState(), VANDAAG)
    expect(s.streefgewichten.map((x) => x.oefening)).toEqual(['leg_press', 'bench_smith'])
    expect(s.streefgewichten[0].kg).toBe(140)
  })

  it('is JSON, en niets anders — alles moet door JSON.stringify heen kunnen', () => {
    const s = buildSignalen(robState(), VANDAAG)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})
