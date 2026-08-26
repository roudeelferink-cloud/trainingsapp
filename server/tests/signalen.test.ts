import { describe, expect, it } from 'vitest'
import { buildSignalen } from '../src/signalen'
import type { Feel } from '../../src/types'
import { deloadFor } from '../../src/logic/deload'
import { dayGuardrails } from '../../src/logic/guardrails'
import { averageRunKm, longestRunKm, weekRunFacts } from '../../src/logic/runningLoad'
import { DREMPEL, MAX_VERHOGINGEN_PER_SESSIE } from '../../src/logic/opbouw'
import { ANOUC } from '../../src/store/schema'
import { DEZE_MAANDAG, VANDAAG, WEKEN, anoucState, leegState, robState } from './helpers'

/**
 * De afspraak met het model: de app rekent, het model oordeelt. Deze tests bewaken dat
 * van twee kanten — de getallen die meegaan zijn precies die van de app zelf, en er zit
 * geen tweede berekening in dit bestand.
 */
describe('signalen', () => {
  it('neemt de getallen letterlijk over uit de logica van de app', () => {
    const state = robState()
    const s = buildSignalen(state, VANDAAG)
    const week = weekRunFacts(state, VANDAAG)

    expect(s.hardlopen.dezeWeekKm).toBe(week.km)
    expect(s.hardlopen.dezeWeekLopen).toBe(week.aantal)
    expect(s.hardlopen.langsteLoop4WkKm).toBe(longestRunKm(state, VANDAAG))
    expect(s.hardlopen.gemiddeldeDuurloopKm).toBe(averageRunKm(state, VANDAAG, 'long'))
    expect(s.guardrails.map((g) => g.tekst)).toEqual(dayGuardrails(state, VANDAAG).map((g) => g.text))
  })

  /**
   * De app plant het hardlopen niet meer. Wat er over lopen meegaat is geteld; er hoort
   * geen getal in te staan dat de app zelf bedacht heeft, want dan zou het model daar
   * een advies op bouwen dat nergens op het scherm terugkomt.
   */
  it('stuurt over hardlopen alleen tellingen mee, geen voorstellen', () => {
    const s = buildSignalen(robState(), VANDAAG)

    expect(Object.keys(s.hardlopen).sort()).toEqual([
      'dezeWeekKm',
      'dezeWeekLopen',
      'gemiddeldeDuurloopKm',
      'gemiddeldeKorteLoopKm',
      'langsteLoop4WkKm',
    ])
    // geen plafond, geen richtlijn, geen duurloopdoel, geen benen-voor-de-duurloop
    const alles = JSON.stringify(s)
    for (const woord of ['plafond', 'richtlijn', 'duurloopDoel', 'benenVoorDuurloop']) {
      expect(alles, woord).not.toContain(woord)
    }
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
    expect(s.hardlopen.gemiddeldeDuurloopKm).toBeNull()
    expect(s.hardlopen.dezeWeekLopen).toBe(0)
    expect(s.streefgewichten).toEqual([])
  })

  it('zet de streefgewichten zwaarste eerst', () => {
    const s = buildSignalen(robState(), VANDAAG)
    expect(s.streefgewichten.map((x) => x.oefening)).toEqual(['leg_press', 'bench_smith'])
    expect(s.streefgewichten[0].kg).toBe(140)
  })

  it('stuurt het tempo van dit profiel mee, met de teller per oefening', () => {
    const s = buildSignalen(robState(), VANDAAG)

    expect(s.progressie.tempo).toEqual({
      benen: 'opbouwen',
      bovenlichaam: 'opbouwen',
      romp: 'opbouwen',
    })
    expect(s.progressie.drempel.benen).toBe(DREMPEL.opbouwen)
    expect(s.progressie.maxPerSessie).toBe(MAX_VERHOGINGEN_PER_SESSIE)
    expect(s.progressie.voorrang).toBe('benen')

    const legPress = s.progressie.tellers.find((t) => t.oefening === 'leg_press')!
    expect(legPress.zone).toBe('benen')
    expect(legPress.drempel).toBe(DREMPEL.opbouwen)
    expect(legPress.kg).toBe(140)
  })

  it('laat zien dat Anouc op onderhoud staat en Rob op opbouwen', () => {
    const rob = buildSignalen(robState(), VANDAAG)
    const anouc = buildSignalen(anoucState(), VANDAAG)

    expect(rob.profiel.id).not.toBe(anouc.profiel.id)
    expect(anouc.profiel.id).toBe(ANOUC)
    expect(anouc.progressie.tempo.benen).toBe('onderhoud')
    expect(anouc.progressie.drempel.benen).toBe(DREMPEL.onderhoud)
    expect(rob.progressie.drempel.benen).toBe(DREMPEL.opbouwen)
  })

  it('zet de oefening die het dichtst bij een stap staat vooraan', () => {
    const state = robState()
    state.exerciseState = {
      ...state.exerciseState,
      leg_press: { ...state.exerciseState.leg_press, hitStreak: 2 },
      bench_smith: { ...state.exerciseState.bench_smith, hitStreak: 0 },
    }
    const s = buildSignalen(state, VANDAAG)
    expect(s.progressie.tellers[0].oefening).toBe('leg_press')
    expect(s.progressie.tellers[0].gehaaldOpRij).toBe(2)
  })

  it('is JSON, en niets anders — alles moet door JSON.stringify heen kunnen', () => {
    const s = buildSignalen(robState(), VANDAAG)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })
})
