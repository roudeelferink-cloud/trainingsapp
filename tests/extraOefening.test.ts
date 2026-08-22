import { beforeEach, describe, expect, it } from 'vitest'
import { buildDay } from '../src/logic/day'
import { addDays } from '../src/logic/dates'
import { actualSessionMinutes } from '../src/logic/duration'
import { afterEasySession, extraCandidates, extraSlotKey } from '../src/logic/extra'
import { stateFor } from '../src/logic/progression'
import * as A from '../src/store/actions'
import { getState, resetState, setState } from '../src/store/store'
import type { DayKind, Feel, SessionLog } from '../src/types'
import { MON } from './helpers'

/**
 * De extra oefening na een te makkelijke sessie: wanneer hij aangeboden wordt, wanneer
 * niet, en wat er in plaats daarvan gebeurt als het twee keer op rij te makkelijk was.
 */

beforeEach(() => {
  resetState()
  setState((s) => ({ ...s, startDate: MON, settings: { ...s.settings, bodyweightKg: 82 } }))
})

/** De eerste dag van de eerste week met een krachtsessie. */
function sessieDag(): { iso: string; kind: DayKind } {
  for (let d = 0; d < 7; d++) {
    const iso = addDays(MON, d)
    const plan = buildDay(getState(), iso)
    if (plan.strength) return { iso, kind: plan.strength.kind }
  }
  throw new Error('geen krachtsessie in week 1')
}

/** Schrijft een afgeronde sessie weg, met een zelf gekozen duur en beoordeling. */
function logSessie(
  iso: string,
  kind: DayKind,
  opts: { feel?: Feel; minuten: number; extra?: string },
): void {
  const slots = buildDay(getState(), iso).strength!.slots
  const start = new Date(`${iso}T18:00:00.000Z`)
  const eind = new Date(start.getTime() + opts.minuten * 60000)
  const log: SessionLog = {
    date: iso,
    kind,
    completedAt: eind.toISOString(),
    startedAt: start.toISOString(),
    short: false,
    entries: Object.fromEntries(
      slots.map((r) => [r.slot.key, [{ weight: 40, reps: r.repMax, rir: 2, done: true }]]),
    ),
    exercises: Object.fromEntries(slots.map((r) => [r.slot.key, r.exercise.id])),
    skippedSlots: [],
    completedSlots: slots.map((r) => r.slot.key),
    feel: opts.feel,
    extra: opts.extra,
  }
  setState((s) => ({ ...s, sessions: { ...s.sessions, [`${iso}:${kind}`]: log } }))
}

function uitkomst(iso: string, kind: DayKind, gepland = 60) {
  const slots = buildDay(getState(), iso).strength!.slots
  return afterEasySession(getState(), iso, kind, slots, gepland)
}

describe('de duur van een sessie wordt gemeten, niet geschat', () => {
  it('rekent start en afronding tegen elkaar weg', () => {
    const log = {
      startedAt: '2026-08-04T18:00:00.000Z',
      completedAt: '2026-08-04T18:42:00.000Z',
    } as SessionLog
    expect(actualSessionMinutes(log)).toBe(42)
  })

  it('zegt niets over een log zonder starttijd', () => {
    expect(actualSessionMinutes({ completedAt: 'x' } as SessionLog)).toBeNull()
    expect(actualSessionMinutes(null)).toBeNull()
  })

  it('zegt niets over een afronding die vóór de start ligt', () => {
    const log = {
      startedAt: '2026-08-04T19:00:00.000Z',
      completedAt: '2026-08-04T18:00:00.000Z',
    } as SessionLog
    expect(actualSessionMinutes(log)).toBeNull()
  })

  it('stempelt de starttijd bij de eerste aanraking van de sessie', () => {
    const { iso, kind } = sessieDag()
    A.setWarmupDone(iso, kind, true)
    const eerste = getState().sessions[`${iso}:${kind}`].startedAt
    expect(typeof eerste).toBe('string')

    // en verandert daarna niet meer
    A.setWarmupMinutes(iso, kind, 12)
    expect(getState().sessions[`${iso}:${kind}`].startedAt).toBe(eerste)
  })
})

describe('het aanbod komt er alleen als alles klopt', () => {
  it('biedt na een makkelijke, korte sessie één oefening aan', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 35 })

    const res = uitkomst(iso, kind)
    expect(res.kind).toBe('extra')
    if (res.kind !== 'extra') return
    expect(res.slotKey).toBe(extraSlotKey(kind))
    expect(res.text).toContain('35 minuten')
    expect(res.text).toContain(res.exercise.naam)
  })

  it('houdt de extra oefening in dezelfde categorie als de sessie', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 35 })
    const slots = buildDay(getState(), iso).strength!.slots
    const patronen = new Set(slots.map((r) => r.exercise.pattern))

    const res = uitkomst(iso, kind)
    if (res.kind !== 'extra') throw new Error('geen aanbod')
    expect(patronen).toContain(res.exercise.pattern)
    // en het is geen oefening die er al in zit
    expect(slots.map((r) => r.exercise.id)).not.toContain(res.exercise.id)
  })

  it('biedt licht werk aan, geen tweede zware beenoefening', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 35 })
    const res = uitkomst(iso, kind)
    if (res.kind !== 'extra') throw new Error('geen aanbod')
    expect(res.exercise.orderCategory).not.toBe('heavy_legs')
  })

  it('zwijgt bij een sessie die goed of zwaar viel', () => {
    const { iso, kind } = sessieDag()
    for (const feel of ['goed', 'zwaar'] as Feel[]) {
      logSessie(iso, kind, { feel, minuten: 35 })
      expect(uitkomst(iso, kind)).toEqual({ kind: 'niets', reason: 'niet_makkelijk' })
    }
  })

  it('zwijgt bij een sessie die de geplande duur vol maakte', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 65 })
    expect(uitkomst(iso, kind, 60)).toEqual({ kind: 'niets', reason: 'niet_korter' })
  })

  it('zwijgt zolang de sessie niet afgerond is', () => {
    const { iso, kind } = sessieDag()
    expect(uitkomst(iso, kind)).toEqual({ kind: 'niets', reason: 'niet_afgerond' })
  })

  it('zwijgt bij een log zonder starttijd, in plaats van de duur te gokken', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 35 })
    setState((s) => ({
      ...s,
      sessions: {
        ...s.sessions,
        [`${iso}:${kind}`]: { ...s.sessions[`${iso}:${kind}`], startedAt: undefined },
      },
    }))
    expect(uitkomst(iso, kind)).toEqual({ kind: 'niets', reason: 'geen_starttijd' })
  })

  it('zwijgt in een deloadweek', () => {
    // week 8 is de vaste deloadweek
    setState((s) => ({ ...s, startDate: addDays(MON, -49) }))
    const { iso, kind } = sessieDag()
    expect(buildDay(getState(), iso).deload.active).toBe(true)
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 30 })
    expect(uitkomst(iso, kind)).toEqual({ kind: 'niets', reason: 'deload' })
  })

  it('zwijgt op een dag met een openstaande waarschuwing', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 30 })
    // ruim over het weekvolume heen: dat is een waarschuwing, geen dag om werk bij te doen
    setState((s) => ({
      ...s,
      runs: {
        [addDays(MON, 1)]: {
          date: addDays(MON, 1), kind: 'short', plannedKm: 6, km: 40,
          minutes: 240, bike: false, completedAt: `${addDays(MON, 1)}T18:00:00.000Z`,
        },
      },
    }))
    expect(uitkomst(iso, kind)).toEqual({ kind: 'niets', reason: 'waarschuwing' })
  })

  it('zwijgt als de vorige sessie al een extra oefening kreeg', () => {
    const eerste = sessieDag()
    logSessie(eerste.iso, eerste.kind, { feel: 'goed', minuten: 35, extra: 'plank' })

    const tweede = volgendeSessieDag(eerste.iso)
    logSessie(tweede.iso, tweede.kind, { feel: 'makkelijk', minuten: 30 })
    expect(uitkomst(tweede.iso, tweede.kind)).toEqual({ kind: 'niets', reason: 'vorige_had_extra' })
  })

  it('zwijgt als deze sessie er al een gekregen heeft', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 30, extra: 'plank' })
    expect(uitkomst(iso, kind)).toEqual({ kind: 'niets', reason: 'al_een_extra' })
  })
})

describe('twee keer op rij te makkelijk gaat over gewicht', () => {
  function tweeMakkelijke() {
    const eerste = sessieDag()
    logSessie(eerste.iso, eerste.kind, { feel: 'makkelijk', minuten: 32 })
    const tweede = volgendeSessieDag(eerste.iso)
    logSessie(tweede.iso, tweede.kind, { feel: 'makkelijk', minuten: 34 })
    return tweede
  }

  it('biedt geen oefening aan maar meldt dat het gewicht omhoog moet', () => {
    const { iso, kind } = tweeMakkelijke()
    const res = uitkomst(iso, kind)
    expect(res.kind).toBe('bump')
    if (res.kind !== 'bump') return
    expect(res.text).toContain('Twee sessies op rij makkelijk')
    expect(res.text).toContain('streefgewicht')
    expect(res.exerciseIds.length).toBeGreaterThan(0)
  })

  it('voert dat voorstel ook door in de progressie', () => {
    const { iso, kind } = tweeMakkelijke()
    const res = uitkomst(iso, kind)
    if (res.kind !== 'bump') throw new Error('geen voorstel')

    // een streefgewicht om vanaf te verhogen
    setState((s) => ({
      ...s,
      exerciseState: Object.fromEntries(
        res.exerciseIds.map((id) => [
          id,
          { targetWeight: 60, targetReps: 8, belowMinStreak: 0, lastNote: null, lastUpdated: null },
        ]),
      ),
    }))

    const slots = buildDay(getState(), iso).strength!.slots
    const messages = A.applyEasyBump(iso, kind, slots)
    expect(messages.length).toBeGreaterThan(0)

    const omhoog = res.exerciseIds.filter((id) => (stateFor(getState(), id).targetWeight ?? 0) > 60)
    expect(omhoog.length).toBeGreaterThan(0)
  })

  it('blijft binnen de maximale sprong per week', () => {
    const { iso, kind } = tweeMakkelijke()
    const res = uitkomst(iso, kind)
    if (res.kind !== 'bump') throw new Error('geen voorstel')
    setState((s) => ({
      ...s,
      exerciseState: Object.fromEntries(
        res.exerciseIds.map((id) => [
          id,
          { targetWeight: 60, targetReps: 8, belowMinStreak: 0, lastNote: null, lastUpdated: null },
        ]),
      ),
    }))

    const slots = buildDay(getState(), iso).strength!.slots
    A.applyEasyBump(iso, kind, slots)
    for (const id of res.exerciseIds) {
      expect(stateFor(getState(), id).targetWeight ?? 0, id).toBeLessThanOrEqual(62.5)
    }
  })

  it('sluit de sessie daarmee af: er komt geen aanbod meer over', () => {
    const { iso, kind } = tweeMakkelijke()
    const slots = buildDay(getState(), iso).strength!.slots
    A.applyEasyBump(iso, kind, slots)
    expect(getState().sessions[`${iso}:${kind}`].extra).toBeTruthy()
  })
})

describe('de extra oefening toevoegen', () => {
  it('zet hem achteraan de sessie van die dag en zet de sessie weer open', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 30 })
    const res = uitkomst(iso, kind)
    if (res.kind !== 'extra') throw new Error('geen aanbod')
    const voor = buildDay(getState(), iso).strength!.slots.length

    expect(A.addExtraExercise(iso, kind, res.exercise.id).ok).toBe(true)

    const na = buildDay(getState(), iso).strength!
    expect(na.slots).toHaveLength(voor + 1)
    expect(na.slots[na.slots.length - 1].exercise.id).toBe(res.exercise.id)
    expect(na.slots[na.slots.length - 1].reasons).toContain('extra')
    expect(na.done).toBe(false)
  })

  it('laat er maar één toe', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 30 })
    const res = uitkomst(iso, kind)
    if (res.kind !== 'extra') throw new Error('geen aanbod')

    A.addExtraExercise(iso, kind, res.exercise.id)
    const tweede = A.addExtraExercise(iso, kind, 'plank')
    expect(tweede.ok).toBe(false)
    expect(buildDay(getState(), iso).strength!.slots.filter((r) => r.reasons.includes('extra'))).toHaveLength(1)
  })

  it('geldt alleen voor die dag', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 30 })
    const res = uitkomst(iso, kind)
    if (res.kind !== 'extra') throw new Error('geen aanbod')
    A.addExtraExercise(iso, kind, res.exercise.id)

    const volgende = volgendeSessieDag(iso)
    expect(
      buildDay(getState(), volgende.iso).strength!.slots.some((r) => r.reasons.includes('extra')),
    ).toBe(false)
  })

  it('is er ook weer af te halen', () => {
    const { iso, kind } = sessieDag()
    logSessie(iso, kind, { feel: 'makkelijk', minuten: 30 })
    const res = uitkomst(iso, kind)
    if (res.kind !== 'extra') throw new Error('geen aanbod')
    const voor = buildDay(getState(), iso).strength!.slots.length

    A.addExtraExercise(iso, kind, res.exercise.id)
    A.removeExtraExercise(iso, kind)
    expect(buildDay(getState(), iso).strength!.slots).toHaveLength(voor)
    expect(getState().sessions[`${iso}:${kind}`].extra).toBeUndefined()
  })

  it('laat het opnieuw afronden de al getelde oefeningen niet nóg een keer verhogen', () => {
    const { iso, kind } = sessieDag()
    const slots = buildDay(getState(), iso).strength!.slots
    const eersteId = slots[0].exercise.id
    const entries = Object.fromEntries(
      slots.map((r) => [r.slot.key, [{ weight: 60, reps: r.repMax, rir: 1, done: true }]]),
    )

    A.setWarmupDone(iso, kind, true)
    A.completeSession(iso, kind, slots, entries, false, slots.map((r) => r.slot.key), 'makkelijk')
    const naEerste = stateFor(getState(), eersteId).targetWeight

    // tweede keer afronden met exact dezelfde sets: de progressie hoort stil te staan
    A.completeSession(iso, kind, slots, entries, false, slots.map((r) => r.slot.key), 'makkelijk')
    expect(stateFor(getState(), eersteId).targetWeight).toBe(naEerste)
  })
})

describe('de kandidatenlijst', () => {
  it('laat een gevoelig gebied buiten het aanbod', () => {
    const { iso } = sessieDag()
    setState((s) => ({
      ...s,
      settings: { ...s.settings, sensitive: { ...s.settings.sensitive, knee_deep: 'off' } },
    }))
    const slots = buildDay(getState(), iso).strength!.slots
    for (const kandidaat of extraCandidates(getState(), slots)) {
      expect(kandidaat.loads, kandidaat.id).not.toContain('knee_deep')
    }
  })

  it('houdt in reismodus alleen wat zonder sportschool kan', () => {
    const { iso } = sessieDag()
    setState((s) => ({ ...s, settings: { ...s.settings, travelMode: true } }))
    const slots = buildDay(getState(), iso).strength!.slots
    const lijst = extraCandidates(getState(), slots)
    for (const kandidaat of lijst) {
      expect(
        kandidaat.equipment.every((q) => ['bodyweight', 'band', 'mini_band'].includes(q)),
        kandidaat.id,
      ).toBe(true)
    }
  })
})

/** De eerstvolgende dag ná `iso` met een krachtsessie. */
function volgendeSessieDag(iso: string): { iso: string; kind: DayKind } {
  for (let d = 1; d <= 7; d++) {
    const datum = addDays(iso, d)
    const plan = buildDay(getState(), datum)
    if (plan.strength) return { iso: datum, kind: plan.strength.kind }
  }
  throw new Error('geen volgende krachtsessie')
}
