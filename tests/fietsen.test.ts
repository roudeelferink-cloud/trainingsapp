import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BIKE_LOAD_EASY,
  EASY_CAUTION,
  activeSwap,
  bikeBlocks,
  blockAt,
  blocksMinutes,
  legPriorityNote,
  plannedMinutes,
  suggestVariant,
} from '../src/logic/bike'
import { bikeSuggestion, legFocusedOn } from '../src/logic/bikeSwap'
import { buildDay, countsAsDone, isRealSkip } from '../src/logic/day'
import { addDays, fromISO } from '../src/logic/dates'
import { deloadFor, deloadTrigger } from '../src/logic/deload'
import { missedSessions } from '../src/logic/gemist'
import { dayGuardrails, legStackAround } from '../src/logic/guardrails'
import { LEG_LOAD_HIGH, legLoadOn } from '../src/logic/legLoad'
import { averageRunKm, longestRunKm, weekRunFacts, weeklyKm } from '../src/logic/runningLoad'
import { scheduledStrength } from '../src/logic/schedule'
import { SKIP_CHOICES, SKIP_LABEL } from '../src/logic/skips'
import { replacedByBike, trainingStreak } from '../src/logic/stats'
import * as A from '../src/store/actions'
import {
  ANOUC,
  ROB,
  exportJSON,
  getState,
  importJSON,
  resetState,
  setCurrentUser,
  setState,
} from '../src/store/store'
import type { UserState } from '../src/types'
import { DI, DO, MON, VR, ZA, ZO } from './helpers'

/**
 * Een krachtsessie vervangen door fietsen. De klok staat op maandag 3 augustus: bij Rob
 * staat daar Benen A, bij Anouc niets (zij rust op maandag).
 */
function klokOp(iso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(fromISO(iso).getTime() + 9 * 3600_000))
}

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: MON, settings: { ...s.settings, bodyweightKg: 82 } }))
  klokOp(MON)
})

afterEach(() => vi.useRealTimers())

/* -------------------------------------------------------------------------
 * De keuzeregel
 * ---------------------------------------------------------------------- */

describe('welke variant de app voorstelt', () => {
  it('a: benen zwaar in de dagcheck → rustige duurrit, ook op een beendag', () => {
    A.setDayCheckLegs(MON, 'zwaar')
    expect(bikeSuggestion(getState(), MON).variant).toBe('duurrit')
    expect(bikeSuggestion(getState(), MON).reason).toContain('Benen zwaar')
  })

  it('a: pijn aan knie of heup → rustige duurrit', () => {
    A.setDayCheckPain(MON, 'knie')
    expect(bikeSuggestion(getState(), MON).variant).toBe('duurrit')
    A.setDayCheckPain(MON, 'heup')
    expect(bikeSuggestion(getState(), MON).variant).toBe('duurrit')
  })

  it('a geldt niet voor pijn elders: rug op een beendag blijft kracht-duur', () => {
    A.setDayCheckPain(MON, 'rug')
    expect(bikeSuggestion(getState(), MON).variant).toBe('kracht_duur')
  })

  it('a: hoge beenbelasting in de 48 uur ervoor → rustige duurrit', () => {
    // zaterdag 8 augustus: benen B stond vrijdag; op zaterdag is de sessie optioneel bovenlichaam
    expect(legLoadOn(getState(), VR).score).toBeGreaterThanOrEqual(LEG_LOAD_HIGH)
    expect(bikeSuggestion(getState(), ZA)).toEqual({
      variant: 'duurrit',
      reason: 'Zwaar beenwerk in de afgelopen 48 uur: rustig trappen.',
    })
    // en twee dagen erna ook nog
    expect(bikeSuggestion(getState(), addDays(MON, 9)).variant).toBe('duurrit') // woensdag na benen A
  })

  it('b: een beengerichte sessie zonder die signalen → kracht-duur', () => {
    expect(legFocusedOn(getState(), MON)).toBe(true)
    expect(bikeSuggestion(getState(), MON)).toEqual({
      variant: 'kracht_duur',
      reason: 'Beensessie: kracht-duur houdt de benen aan het werk.',
    })
  })

  it('b: beenzwaar volgens de belastingsscore telt ook, zonder dat het benen A/B heet', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    // zaterdag: full body B met de squat erin (≈ 5,8); de dagen ervoor zijn licht
    expect(legFocusedOn(getState(), ZA)).toBe(true)
    expect(bikeSuggestion(getState(), ZA).variant).toBe('kracht_duur')
  })

  it('c: anders → rustige duurrit', () => {
    // dinsdag is duwen, maar benen A staat maandag — dat is a. Zet benen A weg naar zondag,
    // dan is dinsdag een gewone bovenlichaamdag zonder beenwerk ervoor.
    const s: UserState = { ...getState(), moves: { [MON]: ZO, [ZO]: MON } }
    expect(legFocusedOn(s, DI)).toBe(false)
    expect(bikeSuggestion(s, DI)).toEqual({ variant: 'duurrit', reason: 'Geen beensessie: een rustige duurrit.' })
    expect(suggestVariant(s, DO, { legFocused: false, recentHigh: false }).variant).toBe('duurrit')
  })

  it('bij Anouc: full body A is niet beengericht', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    const wo = addDays(MON, 2)
    expect(legFocusedOn(getState(), wo)).toBe(false)
    expect(bikeSuggestion(getState(), wo).variant).toBe('duurrit')
  })
})

/* -------------------------------------------------------------------------
 * Vervangen, en ongedaan maken
 * ---------------------------------------------------------------------- */

describe('vervangen door fietsen', () => {
  it('zet in één actie de skip-reden en de variant', () => {
    expect(A.replaceWithBike(MON, 'kracht_duur')).toEqual({ ok: true })
    const s = getState()
    expect(s.skips[`${MON}:strength`]).toEqual({ reason: 'fietsen', what: 'strength' })
    expect(s.overrides[MON].bikeSwap).toEqual({
      variant: 'kracht_duur',
      sessionKey: `${MON}:legs_a`,
      legFocused: true,
    })
    const strength = buildDay(s, MON).strength!
    expect(strength.skipped).toBe('fietsen')
    expect(strength.bike?.variant).toBe('kracht_duur')
    expect(strength.bike?.ride).toBeNull()
  })

  it('heeft een eigen skip-reden die je niet zelf kiest', () => {
    expect(SKIP_LABEL.fietsen).toBe('Vervangen door fietsen')
    expect(SKIP_CHOICES.map((c) => c.id)).not.toContain('fietsen')
  })

  it('werkt ook voor Anouc', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    klokOp(addDays(MON, 2))
    expect(A.replaceWithBike(addDays(MON, 2), 'duurrit').ok).toBe(true)
    expect(buildDay(getState(), addDays(MON, 2)).strength!.bike?.variant).toBe('duurrit')
  })

  it('weigert een dag die voorbij is, en een sessie waar al iets van gelogd is', () => {
    klokOp(DI)
    expect(A.replaceWithBike(MON, 'duurrit').ok).toBe(false)
    const strength = buildDay(getState(), DI).strength!
    A.saveSessionDraft(DI, 'push', { 'push:0': [{ weight: 50, reps: 8, done: true }] }, {}, false)
    expect(A.replaceWithBike(DI, 'duurrit')).toEqual({ ok: false, reason: 'Van deze sessie is al iets gelogd.' })
    expect(strength.kind).toBe('push')
  })

  it('laat de andere variant kiezen zolang de rit nog niet geregistreerd is', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    A.setBikeVariant(MON, 'duurrit')
    expect(activeSwap(getState(), MON)?.variant).toBe('duurrit')
  })

  it('registreert de rit als activiteit met variant, duur, km en de vervangen sessie', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    A.completeBikeSwap(MON, 45, 18.5)
    const rit = getState().activities
    expect(rit).toHaveLength(1)
    expect(rit[0]).toMatchObject({
      date: MON,
      type: 'fietsen',
      variant: 'kracht_duur',
      minutes: 45,
      distanceKm: 18.5,
      replacesSession: `${MON}:legs_a`,
    })
    // nog een keer afronden werkt dezelfde rit bij
    A.completeBikeSwap(MON, 40, null)
    expect(getState().activities).toHaveLength(1)
    expect(getState().activities[0]).toMatchObject({ minutes: 40, distanceKm: null })
  })

  it('is dezelfde dag ongedaan te maken: sessie terug, rit uit de historie', () => {
    const voor = getState()
    A.replaceWithBike(MON, 'kracht_duur')
    A.completeBikeSwap(MON, 43, null)
    A.addActivity(MON, { type: 'wandelen', minutes: 20, intensity: 'rustig' })

    expect(A.undoBikeSwap(MON)).toEqual({ ok: true })
    const s = getState()
    expect(s.skips[`${MON}:strength`]).toBeUndefined()
    expect(s.overrides[MON]?.bikeSwap).toBeUndefined()
    expect(s.activities.map((a) => a.type)).toEqual(['wandelen'])
    const strength = buildDay(s, MON).strength!
    expect(strength.skipped).toBeNull()
    expect(strength.bike).toBeNull()
    expect(strength.slots.map((r) => r.exercise.id)).toEqual(
      buildDay(voor, MON).strength!.slots.map((r) => r.exercise.id),
    )
  })

  it('is een dag later niet meer ongedaan te maken', () => {
    A.replaceWithBike(MON, 'duurrit')
    klokOp(DI)
    expect(A.undoBikeSwap(MON).ok).toBe(false)
    expect(activeSwap(getState(), MON)).not.toBeNull()
  })

  it('kan vooruit gepland worden en tot en met die dag teruggedraaid', () => {
    expect(A.replaceWithBike(VR, 'kracht_duur').ok).toBe(true)
    klokOp(VR)
    expect(A.undoBikeSwap(VR).ok).toBe(true)
  })
})

/* -------------------------------------------------------------------------
 * Wat er níét verandert
 * ---------------------------------------------------------------------- */

describe('wat vervangen niet raakt', () => {
  function metStreefgewichten() {
    setState((s) => ({
      ...s,
      exerciseState: {
        leg_press: { targetWeight: 140, targetReps: 10, belowMinStreak: 0, lastNote: null, lastUpdated: null, hitStreak: 2 },
        rdl_trapbar: { targetWeight: 90, targetReps: 10, belowMinStreak: 0, lastNote: null, lastUpdated: null, hitStreak: 1 },
      },
    }))
  }

  it('verandert geen streefgewichten', () => {
    metStreefgewichten()
    const voor = structuredClone(getState().exerciseState)
    A.replaceWithBike(MON, 'kracht_duur')
    A.completeBikeSwap(MON, 43, 17)
    expect(getState().exerciseState).toEqual(voor)
    A.undoBikeSwap(MON)
    expect(getState().exerciseState).toEqual(voor)
  })

  it('schuift de volgende beensessie niet op en haalt niets in', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    const s = getState()
    expect(s.moves).toEqual({})
    expect(scheduledStrength(s, VR).kind).toBe('legs_b')
    expect(scheduledStrength(s, addDays(MON, 7)).kind).toBe('legs_a')
    // en een dag later staat hij niet als gemist: niet in "Nog open"
    expect(missedSessions(s, DI).filter((m) => m.date === MON)).toEqual([])
    const pakOp = A.pickUpToday(MON, 'strength')
    expect(pakOp.ok).toBe(false)
  })

  it('laat de deloadtelling ongewijzigd', () => {
    const weken = [7, 14, 21, 49].map((d) => addDays(MON, d))
    const voor = weken.map((w) => deloadTrigger(getState(), w))
    A.replaceWithBike(MON, 'kracht_duur')
    A.completeBikeSwap(MON, 43, null)
    expect(weken.map((w) => deloadTrigger(getState(), w))).toEqual(voor)
  })
})

/* -------------------------------------------------------------------------
 * Naleving
 * ---------------------------------------------------------------------- */

describe('naleving: vervangen telt als uitgevoerd', () => {
  it('is geen echte skip en telt als gedaan', () => {
    A.replaceWithBike(MON, 'duurrit')
    const strength = buildDay(getState(), MON).strength!
    expect(isRealSkip(strength)).toBe(false)
    expect(countsAsDone(strength)).toBe(true)
    expect(replacedByBike(getState())).toBe(1)
  })

  it('een gewone skip blijft een skip', () => {
    A.skipSession(MON, 'strength', 'druk')
    const strength = buildDay(getState(), MON).strength!
    expect(isRealSkip(strength)).toBe(true)
    expect(countsAsDone(strength)).toBe(false)
  })

  it('verlengt de streak in plaats van hem neutraal te laten', () => {
    // een week later terugkijken: maandag vervangen, dinsdag loop en duwen gedaan
    A.replaceWithBike(MON, 'kracht_duur')
    klokOp(DI)
    A.completeRun(DI, 'short', { plannedKm: 0, km: 6, minutes: 35, bike: false })
    A.completeSession(DI, 'push', buildDay(getState(), DI).strength!.slots, {}, false)
    klokOp(addDays(DI, 1))
    const met = trainingStreak(getState())
    expect(met).toBe(2)

    // hetzelfde met een gewone skip op maandag: die dag telt niet mee
    resetState()
    setState((s) => ({ ...s, startDate: MON }))
    klokOp(MON)
    A.skipSession(MON, 'strength', 'druk')
    klokOp(DI)
    A.completeRun(DI, 'short', { plannedKm: 0, km: 6, minutes: 35, bike: false })
    A.completeSession(DI, 'push', buildDay(getState(), DI).strength!.slots, {}, false)
    klokOp(addDays(DI, 1))
    expect(trainingStreak(getState())).toBe(1)
  })
})

/* -------------------------------------------------------------------------
 * Beenbelasting
 * ---------------------------------------------------------------------- */

describe('beenbelasting van fietsen', () => {
  it('kracht-duur telt 3,0 (matig: op de drempel), de duurrit 1,0 (licht)', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    expect(legLoadOn(getState(), MON).score).toBe(3)
    expect(legLoadOn(getState(), MON).level).toBe('hoog')
    A.setBikeVariant(MON, 'duurrit')
    expect(legLoadOn(getState(), MON).score).toBe(BIKE_LOAD_EASY)
    expect(legLoadOn(getState(), MON).level).toBe('licht')
  })

  it('vervangt de belasting van de krachtsessie in plaats van erbij op te tellen', () => {
    const benen = legLoadOn(getState(), MON).score
    expect(benen).toBeGreaterThan(6)
    A.replaceWithBike(MON, 'kracht_duur')
    expect(legLoadOn(getState(), MON).score).toBe(3)
  })

  it('telt de gereden rit, niet nog eens de planning', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    A.completeBikeSwap(MON, 43, null)
    expect(legLoadOn(getState(), MON).score).toBe(3)
  })

  it('een losse fietsactiviteit telt als duurrit, of als kracht-duur als hij zwaar was', () => {
    A.addActivity(addDays(MON, 2), { type: 'fietsen', minutes: 60, intensity: 'normaal' })
    expect(legLoadOn(getState(), addDays(MON, 2)).score).toBe(1)
    A.addActivity(addDays(MON, 2), { type: 'spinning', minutes: 45, intensity: 'intensief', heavy: true })
    expect(legLoadOn(getState(), addDays(MON, 2)).score).toBe(4)
    // en telt op bij de krachtsessie van die dag
    A.addActivity(DI, { type: 'fietsen', minutes: 30, intensity: 'rustig' })
    expect(legLoadOn(getState(), DI).score).toBe(1)
  })

  it('"zwaar" is alleen iets bij fietsen', () => {
    const id = A.addActivity(DI, { type: 'wandelen', minutes: 30, intensity: 'rustig', heavy: true })
    expect(getState().activities.find((a) => a.id === id)!.heavy).toBeUndefined()
  })
})

describe('de beenwaarschuwing na kracht-duur', () => {
  it('kracht-duur staat op de drempel van "zware benen" en kan dus waarschuwen', () => {
    // donderdag (trekken) vervangen door kracht-duur, vrijdag benen B: twee dagen zwaar
    expect(legStackAround(getState(), VR)).toBeNull()
    A.replaceWithBike(DO, 'kracht_duur')
    const stapel = legStackAround(getState(), VR)
    expect(stapel).not.toBeNull()
    expect(stapel!.text).toContain('Fietsen (kracht-duur)')
    expect(dayGuardrails(getState(), VR).map((g) => g.id)).toContain('benen-stapeling')
  })

  it('de rustige duurrit doet dat niet', () => {
    A.replaceWithBike(DO, 'duurrit')
    expect(legStackAround(getState(), VR)).toBeNull()
  })

  it('een zware losse rit vlak voor een beendag telt net zo goed', () => {
    A.addActivity(DO, { type: 'fietsen', minutes: 45, intensity: 'intensief', heavy: true })
    expect(legStackAround(getState(), VR)).not.toBeNull()
  })

  it('en de rit stuurt verder niets aan het hardlopen: geen guardrail over de loop', () => {
    A.replaceWithBike(VR, 'kracht_duur')
    const ids = [ZA, ZO].flatMap((d) => dayGuardrails(getState(), d).map((g) => g.id))
    expect(ids.some((id) => /loop|duurloop|km/.test(id))).toBe(false)
  })
})

/* -------------------------------------------------------------------------
 * Hardlopen blijft los
 * ---------------------------------------------------------------------- */

describe('fiets-km tellen niet als hardlopen', () => {
  it('niet in de weekkilometers, het gemiddelde of de langste loop', () => {
    A.completeRun(ZO, 'long', { plannedKm: 0, km: 12, minutes: 70, bike: false })
    const voor = {
      week: weekRunFacts(getState(), ZO),
      gem: averageRunKm(getState(), ZO, 'long'),
      langste: longestRunKm(getState(), ZO),
      reeks: weeklyKm(getState(), ZO, 4),
    }
    A.replaceWithBike(VR, 'kracht_duur')
    A.completeBikeSwap(VR, 43, 25)
    A.addActivity(ZA, { type: 'fietsen', minutes: 90, intensity: 'normaal', distanceKm: 40 })
    A.addActivity(ZA, { type: 'spinning', minutes: 45, intensity: 'normaal' })
    expect(weekRunFacts(getState(), ZO)).toEqual(voor.week)
    expect(averageRunKm(getState(), ZO, 'long')).toBe(voor.gem)
    expect(longestRunKm(getState(), ZO)).toBe(voor.langste)
    expect(weeklyKm(getState(), ZO, 4)).toEqual(voor.reeks)
  })
})

/* -------------------------------------------------------------------------
 * Beenprioriteit
 * ---------------------------------------------------------------------- */

describe('beenprioriteit', () => {
  const REGEL = '2 beensessies vervangen door fietsen in 14 dagen — fietsen vervangt geen zwaar beenwerk.'

  it('zwijgt bij één vervangen beensessie', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    expect(legPriorityNote(getState(), MON)).toBeNull()
  })

  it('meldt het bij twee binnen 14 dagen, als één feitelijke regel op Vandaag', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    A.replaceWithBike(VR, 'duurrit')
    expect(legPriorityNote(getState(), VR)).toBe(REGEL)
    const g = dayGuardrails(getState(), VR).find((x) => x.id === 'beenprioriteit')
    expect(g).toMatchObject({ text: REGEL, tone: 'info' })
    expect(g!.move).toBeUndefined()
    // na 14 dagen valt maandag eruit
    expect(legPriorityNote(getState(), addDays(MON, 14))).toBeNull()
  })

  it('telt alleen beengerichte sessies', () => {
    A.replaceWithBike(MON, 'kracht_duur')
    A.replaceWithBike(DI, 'duurrit') // duwen
    A.replaceWithBike(DO, 'duurrit') // trekken
    expect(legPriorityNote(getState(), DO)).toBeNull()
  })

  it('is per profiel in te stellen, en staat bij Anouc uit', () => {
    setState((s) => ({ ...s, settings: { ...s.settings, bikeLegPriority: { count: 3, days: 21 } } }))
    A.replaceWithBike(MON, 'kracht_duur')
    A.replaceWithBike(VR, 'kracht_duur')
    expect(legPriorityNote(getState(), VR)).toBeNull()

    setCurrentUser(ANOUC)
    expect(getState().settings.bikeLegPriority).toBeNull()
  })
})

/* -------------------------------------------------------------------------
 * Opbouw, deload en de timer
 * ---------------------------------------------------------------------- */

describe('de opbouw van de varianten', () => {
  it('kracht-duur: 10 in, 5 × 4 zwaar met 2 rustig ertussen, 5 uit — 43 min', () => {
    const blokken = bikeBlocks('kracht_duur', { deload: false, caution: false })
    expect(blokken.map((b) => b.minutes)).toEqual([10, 4, 2, 4, 2, 4, 2, 4, 2, 4, 5])
    expect(blokken.filter((b) => b.hard)).toHaveLength(5)
    expect(blocksMinutes(blokken)).toBe(43)
    expect(blokken.every((b) => !/cadans (6|70)/.test(b.text))).toBe(true)
    expect(blokken.find((b) => b.hard)!.text).toContain('Nooit onder cadans 75')
  })

  it('duurrit: 40 minuten, en de extra regel alleen bij zware benen of knie/heup', () => {
    expect(blocksMinutes(bikeBlocks('duurrit', { deload: false, caution: false }))).toBe(40)
    const zonder = bikeBlocks('duurrit', { deload: false, caution: false }).map((b) => b.text).join(' ')
    expect(zonder).not.toContain(EASY_CAUTION)
    const met = bikeBlocks('duurrit', { deload: false, caution: true }).map((b) => b.text).join(' ')
    expect(met).toContain('Lichte weerstand, cadans niet onder 85.')
  })

  it('blijft onder de 50 minuten', () => {
    for (const v of ['kracht_duur', 'duurrit'] as const) {
      for (const deload of [false, true]) {
        expect(blocksMinutes(bikeBlocks(v, { deload, caution: false }))).toBeLessThanOrEqual(50)
      }
    }
  })

  it('in de deloadweek: kracht-duur 3 × 4 min, en lichter in de beenbelasting', () => {
    const deloadMaandag = addDays(MON, 49) // week 8: vaste deload
    expect(deloadFor(getState(), deloadMaandag).active).toBe(true)
    const blokken = bikeBlocks('kracht_duur', { deload: true, caution: false })
    expect(blokken.filter((b) => b.hard)).toHaveLength(3)
    expect(blocksMinutes(blokken)).toBe(31)
    expect(plannedMinutes(getState(), deloadMaandag, 'kracht_duur')).toBe(31)
    expect(plannedMinutes(getState(), MON, 'kracht_duur')).toBe(43)

    klokOp(deloadMaandag)
    A.replaceWithBike(deloadMaandag, 'kracht_duur')
    expect(legLoadOn(getState(), deloadMaandag).score).toBe(1.8)
    // en de duurrit wordt ook in de deloadweek gewoon aangeboden
    expect(plannedMinutes(getState(), deloadMaandag, 'duurrit')).toBe(40)
  })

  it('rekent de positie uit de klok: scherm-uit maakt niet uit', () => {
    const blokken = bikeBlocks('kracht_duur', { deload: false, caution: false })
    const start = 1_000_000
    expect(blockAt(blokken, start, start)).toEqual({ index: 0, remainingMs: 600_000, finished: false })
    expect(blockAt(blokken, start, start + 10 * 60_000 + 30_000)).toEqual({
      index: 1,
      remainingMs: 210_000,
      finished: false,
    })
    expect(blockAt(blokken, start, start + 43 * 60_000).finished).toBe(true)
  })
})

/* -------------------------------------------------------------------------
 * Export en import
 * ---------------------------------------------------------------------- */

describe('export en import', () => {
  it('neemt de vervanging, de rit en de dagcheck mee', () => {
    A.setDayCheck(MON, { legs: 'normaal', pain: 'schouder' })
    A.replaceWithBike(MON, 'kracht_duur')
    A.completeBikeSwap(MON, 44, 19)
    A.addActivity(DI, { type: 'fietsen', minutes: 30, intensity: 'normaal', heavy: true })
    const voor = getState()

    const backup = exportJSON()
    const json = JSON.parse(backup)
    expect(json.schemaVersion).toBe(18)
    expect(json.users.rob.activities[0]).toMatchObject({ variant: 'kracht_duur', replacesSession: `${MON}:legs_a` })
    expect(json.users.rob.overrides[MON].bikeSwap.variant).toBe('kracht_duur')
    expect(json.users.rob.skips[`${MON}:strength`].reason).toBe('fietsen')

    resetState()
    expect(importJSON(backup)).toEqual({ ok: true })
    const na = getState()
    expect(na.activities).toEqual(voor.activities)
    expect(na.skips).toEqual(voor.skips)
    expect(na.overrides[MON].bikeSwap).toEqual(voor.overrides[MON].bikeSwap)
    expect(na.dayChecks).toEqual(voor.dayChecks)
    expect(buildDay(na, MON).strength!.bike?.ride?.minutes).toBe(44)
  })

  it('laadt een export van vóór het fietsen gewoon', () => {
    const oud = {
      schemaVersion: 17,
      currentUser: 'rob',
      pin: null,
      users: {
        rob: {
          startDate: MON,
          checkins: { [MON]: 2 },
          skips: { [`${DI}:strength`]: { reason: 'druk', what: 'strength' } },
          activities: [
            { id: 'a1', date: DI, type: 'fietsen', minutes: 30, distanceKm: 12, intensity: 'normaal', note: null, createdAt: 'x' },
          ],
        },
      },
    }
    expect(importJSON(JSON.stringify(oud))).toEqual({ ok: true })
    const s = getState()
    expect(s.dayChecks[MON]).toEqual({ legs: 'zwaar' })
    expect(s.activities).toHaveLength(1)
    expect(s.settings.bikeLegPriority).toEqual({ count: 2, days: 14 })
    // een losse rit van toen telt nu als duurrit in de beenbelasting
    expect(legLoadOn(s, DI).parts.some((p) => p.naam === 'Fietsen (rustige duurrit)')).toBe(true)
  })

  it('gooit een onbekende skip-reden nog steeds weg, maar houdt "fietsen"', () => {
    const root = {
      schemaVersion: 18,
      users: {
        rob: {
          skips: {
            [`${MON}:strength`]: { reason: 'fietsen', what: 'strength' },
            [`${DI}:strength`]: { reason: 'verzonnen', what: 'strength' },
          },
        },
      },
    }
    importJSON(JSON.stringify(root))
    expect(Object.keys(getState().skips)).toEqual([`${MON}:strength`])
  })
})
