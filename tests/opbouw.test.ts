import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getExercise } from '../src/data/exercises'
import { buildDay } from '../src/logic/day'
import { addDays } from '../src/logic/dates'
import {
  DREMPEL,
  MAX_VERHOGINGEN_PER_SESSIE,
  beoordeelSessie,
  drempelFor,
  kiesVerhogingen,
  stapVoor,
  tempoFor,
  verhogingsRegel,
  volgendeStreak,
  zoneOf,
} from '../src/logic/opbouw'
import { stateFor, targetFor } from '../src/logic/progression'
import { sessionVolumeKg, weeklyStrengthVolume } from '../src/logic/stats'
import { mondayOf } from '../src/logic/dates'
import { SessionScreen } from '../src/screens/SessionScreen'
import * as F from '../src/store/actions'
import * as A from '../src/store/actions'
import { ANOUC, ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'
import { defaultSettings } from '../src/store/settings'
import type { ExerciseState, LoggedSet } from '../src/types'
import { MON } from './helpers'

/**
 * Progressie op data in plaats van op een knop.
 *
 * De oude regel hing aan het als 'makkelijk' beoordelen van een sessie. Die knop werd
 * nooit ingedrukt, dus stonden streefgewichten weken stil terwijl de reps al lang
 * gehaald werden. Deze regel kijkt naar de gelogde sets en verder nergens naar.
 */

const LEG_PRESS = getExercise('leg_press')
const BENCH = getExercise('bench_smith')

function es(patch: Partial<ExerciseState> = {}): ExerciseState {
  return {
    targetWeight: 100,
    targetReps: 10,
    belowMinStreak: 0,
    lastNote: null,
    lastUpdated: null,
    hitStreak: 0,
    ...patch,
  }
}

function sets(n: number, weight: number, reps: number): LoggedSet[] {
  return Array.from({ length: n }, () => ({ weight, reps, rir: 2, done: true }))
}

describe('een sessie beoordelen', () => {
  const gepland = { sets: 4, repMin: 8 }

  it('telt mee als alle sets, alle reps en het gewicht gehaald zijn', () => {
    expect(beoordeelSessie(LEG_PRESS, gepland, sets(4, 100, 10), es())).toEqual({
      gehaald: true,
      uitkomst: 'gehaald',
    })
  })

  it('telt ook mee als je meer deed dan gevraagd', () => {
    expect(beoordeelSessie(LEG_PRESS, gepland, sets(5, 105, 12), es()).gehaald).toBe(true)
  })

  it('telt niet mee bij een afgebroken sessie', () => {
    expect(beoordeelSessie(LEG_PRESS, gepland, sets(3, 100, 10), es())).toEqual({
      gehaald: false,
      uitkomst: 'sets',
    })
  })

  it('telt niet mee als één set de reps niet haalt', () => {
    const gemengd = [...sets(3, 100, 10), ...sets(1, 100, 8)]
    expect(beoordeelSessie(LEG_PRESS, gepland, gemengd, es())).toEqual({
      gehaald: false,
      uitkomst: 'reps',
    })
  })

  it('telt niet mee als je een set naar beneden bijstelt', () => {
    const lichter = [...sets(3, 100, 10), ...sets(1, 95, 10)]
    expect(beoordeelSessie(LEG_PRESS, gepland, lichter, es())).toEqual({
      gehaald: false,
      uitkomst: 'gewicht',
    })
  })

  it('telt niets zolang er geen streefgewicht is', () => {
    const uitkomst = beoordeelSessie(LEG_PRESS, gepland, sets(4, 100, 10), es({ targetWeight: null }))
    expect(uitkomst).toEqual({ gehaald: false, uitkomst: 'geen_streef' })
  })

  it('laat bandwerk met rust: dat gaat per niveau', () => {
    const band = getExercise('band_lateral_walk')
    const uitkomst = beoordeelSessie(band, { sets: 3, repMin: 20 }, sets(3, 0, 20), es())
    expect(uitkomst.uitkomst).toBe('geen_streef')
  })

  it('zet de teller op nul zodra er niet gehaald wordt, zonder verder gevolg', () => {
    expect(volgendeStreak(es({ hitStreak: 2 }), true)).toBe(3)
    expect(volgendeStreak(es({ hitStreak: 2 }), false)).toBe(0)
    expect(volgendeStreak(es({ hitStreak: 0 }), true)).toBe(1)
  })
})

describe('de stap past bij het materiaal', () => {
  const settings = defaultSettings()

  it('gaat met 2,5 kg omhoog bij stangwerk, want de lichtste schijf is 1,25', () => {
    expect(stapVoor(getExercise('smith_squat'), 60, settings, 'opbouwen')).toBe(62.5)
    expect(stapVoor(BENCH, 60, settings, 'opbouwen')).toBe(62.5)
  })

  it('volgt het stanggewicht dat je zelf ingesteld hebt', () => {
    const zwaardereStang = { ...settings, barWeights: { ...settings.barWeights, smith: 20 } }
    // de stap blijft 2,5 kg; het totaal ligt alleen anders omdat de stang zwaarder is
    expect(stapVoor(getExercise('smith_squat'), 62.5, zwaardereStang, 'opbouwen')).toBe(65)
  })

  it('gaat met 5 kg omhoog op de leg press', () => {
    expect(stapVoor(LEG_PRESS, 140, settings, 'opbouwen')).toBe(145)
    expect(stapVoor(LEG_PRESS, 142.5, settings, 'opbouwen')).toBe(147.5)
  })

  it('pakt bij dumbbells de eerstvolgende maat in het rek', () => {
    const db = getExercise('db_shoulder_press')
    expect(stapVoor(db, 12.5, settings, 'opbouwen')).toBe(15)
    expect(stapVoor(db, 5, settings, 'opbouwen')).toBe(12.5)
    expect(stapVoor(db, 20, settings, 'opbouwen')).toBeNull()
  })

  it('houdt het op onderhoud bij de kleinste stap, ook op de leg press', () => {
    expect(stapVoor(LEG_PRESS, 140, settings, 'onderhoud')).toBe(142.5)
  })

  it('rondt af op wat er echt ligt: zonder 1,25 kg wordt de stap 5', () => {
    const grofRek = { ...settings, plates: [2.5, 5, 10, 20] }
    expect(stapVoor(getExercise('smith_squat'), 60, grofRek, 'opbouwen')).toBe(65)
  })
})

describe('tempo per spiergroep', () => {
  it('deelt de oefeningen in op hun bewegingspatroon', () => {
    expect(zoneOf(LEG_PRESS)).toBe('benen')
    expect(zoneOf(getExercise('standing_calf_smith'))).toBe('benen')
    expect(zoneOf(BENCH)).toBe('bovenlichaam')
    expect(zoneOf(getExercise('plank'))).toBe('romp')
  })

  it('leest de drempel uit de instellingen van het profiel', () => {
    const opbouw = { ...defaultSettings(), progressie: { benen: 'opbouwen', bovenlichaam: 'onderhoud', romp: 'onderhoud' } as const }
    expect(tempoFor(opbouw, LEG_PRESS)).toBe('opbouwen')
    expect(tempoFor(opbouw, BENCH)).toBe('onderhoud')
    expect(drempelFor(opbouw, LEG_PRESS)).toBe(DREMPEL.opbouwen)
    expect(drempelFor(opbouw, BENCH)).toBe(DREMPEL.onderhoud)
  })

  it('geeft Rob opbouwen en Anouc onderhoud als startpunt', () => {
    resetState()
    expect(getState().settings.progressie).toEqual({
      benen: 'opbouwen',
      bovenlichaam: 'opbouwen',
      romp: 'opbouwen',
    })
    setCurrentUser(ANOUC)
    expect(getState().settings.progressie).toEqual({
      benen: 'onderhoud',
      bovenlichaam: 'onderhoud',
      romp: 'onderhoud',
    })
  })

  it('is per spiergroep om te zetten', () => {
    resetState()
    A.setTempo('romp', 'onderhoud')
    expect(getState().settings.progressie).toEqual({
      benen: 'opbouwen',
      bovenlichaam: 'opbouwen',
      romp: 'onderhoud',
    })
  })
})

describe('de rem: hooguit twee per sessie, benen eerst', () => {
  const kandidaat = (id: string, zone: 'benen' | 'bovenlichaam' | 'romp', positie: number) => ({
    exerciseId: id,
    naam: id,
    zone,
    positie,
    streak: 3,
    van: 100,
    naar: 102.5,
    reps: 10,
  })

  it('laat er nooit meer dan twee omhoog gaan', () => {
    const uit = kiesVerhogingen(
      [kandidaat('a', 'benen', 0), kandidaat('b', 'benen', 1), kandidaat('c', 'benen', 2)],
      false,
    )
    expect(uit).toHaveLength(MAX_VERHOGINGEN_PER_SESSIE)
    expect(uit.map((v) => v.exerciseId)).toEqual(['a', 'b'])
  })

  it('geeft beenoefeningen voorrang, ook als ze later in de sessie staan', () => {
    const uit = kiesVerhogingen(
      [
        kandidaat('borst', 'bovenlichaam', 0),
        kandidaat('romp', 'romp', 1),
        kandidaat('benen', 'benen', 5),
      ],
      false,
    )
    expect(uit.map((v) => v.exerciseId)).toEqual(['benen', 'borst'])
  })

  it('verhoogt niets in een deloadweek', () => {
    expect(kiesVerhogingen([kandidaat('a', 'benen', 0)], true)).toEqual([])
  })

  it('schrijft één korte regel waarom', () => {
    expect(verhogingsRegel({ ...kandidaat('leg_press', 'benen', 0), van: 140, naar: 145, reps: 12 })).toBe(
      '3× 140 kg × 12 gehaald — nu 145',
    )
  })
})

/* -------------------------------------------------------------------------
 * De regel in het echt: sessies loggen en kijken wat er gebeurt
 * ---------------------------------------------------------------------- */

/** De maandagse beensessie, met alle sets op het voorgevulde gewicht en de reps gehaald. */
function logSessie(iso: string, opts: { reps?: number; gewicht?: number; setsMinder?: number } = {}) {
  const plan = buildDay(getState(), iso)
  const kind = plan.strength!.kind
  const slots = plan.strength!.slots
  const entries: Record<string, LoggedSet[]> = {}

  for (const r of slots) {
    const t = targetFor(r.exercise, r.repMin, getState(), { calibration: false, deload: false })
    const aantal = r.sets - (opts.setsMinder ?? 0)
    entries[r.slot.key] = Array.from({ length: Math.max(0, aantal) }, () => ({
      weight: opts.gewicht ?? t.weight ?? 0,
      reps: opts.reps ?? t.reps,
      rir: 2,
      done: true,
    }))
  }
  A.completeSession(iso, kind, slots, entries, false, slots.map((r) => r.slot.key))
}

/** Zet een startgewicht neer, zodat er iets te verhogen valt. */
function metStreefgewichten() {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({
    ...s,
    startDate: MON,
    exerciseState: {
      leg_press: es({ targetWeight: 140, targetReps: 10 }),
      smith_squat: es({ targetWeight: 60, targetReps: 10 }),
      rdl_trapbar: es({ targetWeight: 80, targetReps: 10 }),
      leg_curl: es({ targetWeight: 40, targetReps: 12 }),
      standing_calf_smith: es({ targetWeight: 50, targetReps: 15 }),
    },
  }))
}

/** De maandagen van opeenvolgende weken: elke week dezelfde beensessie. */
const maandagen = (n: number) => Array.from({ length: n }, (_, i) => addDays(MON, 7 * i))

describe('drie sessies op rij gehaald, dan omhoog', () => {
  beforeEach(metStreefgewichten)

  it('verhoogt pas na de derde sessie', () => {
    const [w1, w2, w3] = maandagen(3)

    logSessie(w1)
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(140)
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(1)

    logSessie(w2)
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(140)
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(2)

    logSessie(w3)
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(145)
  })

  it('begint na een verhoging opnieuw te tellen', () => {
    for (const iso of maandagen(3)) logSessie(iso)
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(0)
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(145)

    // en dan duurt het weer drie sessies
    logSessie(maandagen(4)[3])
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(145)
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(1)
  })

  it('begint opnieuw als je een set naar beneden bijstelt', () => {
    const weken = maandagen(4)
    logSessie(weken[0])
    logSessie(weken[1])
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(2)

    // derde sessie 5 kg lichter: geen straf, alleen opnieuw opbouwen
    logSessie(weken[2], { gewicht: 135 })
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(0)
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(135)

    logSessie(weken[3])
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(1)
  })

  it('begint opnieuw bij een afgebroken sessie', () => {
    const weken = maandagen(3)
    logSessie(weken[0])
    logSessie(weken[1], { setsMinder: 1 })
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(0)
    logSessie(weken[2])
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(140)
  })

  it('verhoogt hooguit twee oefeningen per sessie, en benen eerst', () => {
    const weken = maandagen(3)
    for (const iso of weken) logSessie(iso)

    const verhoogd = ['leg_press', 'smith_squat', 'rdl_trapbar', 'leg_curl', 'standing_calf_smith']
      .map((id) => ({ id, es: stateFor(getState(), id) }))
      .filter((x) => (x.es.hitStreak ?? 0) === 0 && x.es.raiseNote)

    expect(verhoogd).toHaveLength(MAX_VERHOGINGEN_PER_SESSIE)
    // benen A is een beensessie, dus de voorrang loopt op de volgorde binnen de sessie
    expect(verhoogd.map((x) => x.id)).toEqual(['leg_press', 'smith_squat'])
  })

  it('verhoogt niets in een deloadweek', () => {
    // week 8 is de vaste deloadweek
    const deloadMaandag = addDays(MON, 49)
    setState((s) => ({
      ...s,
      exerciseState: {
        ...s.exerciseState,
        leg_press: es({ targetWeight: 140, targetReps: 10, hitStreak: 5 }),
      },
    }))
    expect(buildDay(getState(), deloadMaandag).deload.active).toBe(true)

    logSessie(deloadMaandag)
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(140)
  })

  it('wacht bij onderhoud zes sessies en pakt dan de kleinste stap', () => {
    A.setTempo('benen', 'onderhoud')
    const weken = maandagen(6)
    for (const iso of weken.slice(0, 5)) logSessie(iso)
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(140)

    logSessie(weken[5])
    expect(stateFor(getState(), 'leg_press').targetWeight).toBe(142.5)
  })
})

describe('wat je ervan ziet', () => {
  beforeEach(metStreefgewichten)

  it('vult gewicht en reps van elke set voor met het voorstel', () => {
    const slots = buildDay(getState(), MON).strength!.slots
    const legPress = slots.find((r) => r.exercise.id === 'leg_press')!
    const t = targetFor(legPress.exercise, legPress.repMin, getState(), {
      calibration: false,
      deload: false,
    })
    expect(t.weight).toBe(140)
    expect(t.reps).toBe(10)
    expect(t.byFeel).toBe(false)
  })

  it('zet er één korte regel bij waarom het gewicht omhoog ging', () => {
    for (const iso of maandagen(3)) logSessie(iso)

    const legPress = getExercise('leg_press')
    const t = targetFor(legPress, 8, getState(), { calibration: false, deload: false })
    expect(t.weight).toBe(145)
    expect(t.note).toBe('3× 140 kg × 10 gehaald — nu 145')
  })

  it('haalt die regel weg zodra er weer een sessie gelogd is', () => {
    const weken = maandagen(4)
    for (const iso of weken.slice(0, 3)) logSessie(iso)
    expect(stateFor(getState(), 'leg_press').raiseNote).toBeTruthy()

    logSessie(weken[3])
    expect(stateFor(getState(), 'leg_press').raiseNote).toBeNull()
    const t = targetFor(getExercise('leg_press'), 8, getState(), {
      calibration: false,
      deload: false,
    })
    expect(t.note).toBeUndefined()
  })

  it('zet die regel ook op het sessiescherm, tussen de andere contextregels', () => {
    const weken = maandagen(4)
    for (const iso of weken.slice(0, 3)) logSessie(iso)

    // de warming-up eerst: daarna staat de eerste oefening in beeld
    const kind = buildDay(getState(), weken[3]).strength!.kind
    F.setWarmupDone(weken[3], kind, true)
    const html = renderToString(
      createElement(SessionScreen, { date: weken[3], kind, onClose: () => {} }),
    ).replace(/<!-- -->/g, '')

    expect(html).toContain('3× 140 kg × 10 gehaald — nu 145')
  })

  it('zet de verhoging ook in de meldingen', () => {
    for (const iso of maandagen(3)) logSessie(iso)
    const laatste = getState().notices.map((n) => n.text).join(' ')
    expect(laatste).toContain('Leg press: 3× 140 kg × 10 gehaald — nu 145 kg.')
  })
})

describe('de oude makkelijk-regel verhoogt niet dubbel', () => {
  beforeEach(metStreefgewichten)

  it('telt een verhoging van de oude regel als de stap van deze sessie', () => {
    const weken = maandagen(3)
    logSessie(weken[0])
    logSessie(weken[1])
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(2)

    // derde sessie op de bovengrens van de reps én als makkelijk beoordeeld: dat is
    // precies wat de oude regel laat vuren
    const plan = buildDay(getState(), weken[2])
    const slots = plan.strength!.slots
    const entries: Record<string, LoggedSet[]> = {}
    for (const r of slots) {
      const t = targetFor(r.exercise, r.repMin, getState(), { calibration: false, deload: false })
      entries[r.slot.key] = Array.from({ length: r.sets }, () => ({
        weight: t.weight ?? 0,
        reps: r.repMax,
        rir: 1,
        done: true,
      }))
    }
    const voor = stateFor(getState(), 'leg_press').targetWeight!
    A.completeSession(weken[2], plan.strength!.kind, slots, entries, false, slots.map((r) => r.slot.key), 'makkelijk')

    const na = stateFor(getState(), 'leg_press')
    // één stap, niet twee: de oude regel deed hem, en de teller staat weer op nul
    expect(na.targetWeight!).toBeGreaterThan(voor)
    expect(na.targetWeight!).toBeLessThanOrEqual(voor + 5)
    expect(na.hitStreak).toBe(0)
    expect(na.raiseNote ?? null).toBeNull()
  })
})

/**
 * Werk dat er binnen een sessie bij komt.
 *
 * De app biedt na een te makkelijke sessie één extra oefening aan; die komt in het
 * sessielog terecht als een gewoon slot. Deze tests leggen vast dat hij daarna ook als
 * gewoon werk telt — in het tilvolume en in de opbouwteller — want dat is iets wat
 * ongemerkt kan wegvallen zodra er aan de sessieopbouw gesleuteld wordt.
 */
describe('een extra oefening binnen een sessie', () => {
  beforeEach(metStreefgewichten)

  /** Voegt de extra oefening toe en logt hem, met de rest van de sessie ongemoeid. */
  function metExtra(iso: string, exerciseId: string) {
    const kind = buildDay(getState(), iso).strength!.kind
    expect(A.addExtraExercise(iso, kind, exerciseId)).toEqual({ ok: true })

    const slots = buildDay(getState(), iso).strength!.slots
    const bestaand = getState().sessions[`${iso}:${kind}`]?.entries ?? {}
    const entries: Record<string, LoggedSet[]> = { ...bestaand }
    for (const r of slots) {
      if (entries[r.slot.key]) continue
      const t = targetFor(r.exercise, r.repMin, getState(), { calibration: false, deload: false })
      entries[r.slot.key] = Array.from({ length: r.sets }, () => ({
        weight: t.weight ?? 0,
        reps: t.reps,
        rir: 2,
        done: true,
      }))
    }
    A.completeSession(iso, kind, slots, entries, false, slots.map((r) => r.slot.key))
    return kind
  }

  it('komt als gewoon slot in het sessielog terecht', () => {
    logSessie(MON)
    const kind = buildDay(getState(), MON).strength!.kind
    metExtra(MON, 'plank')

    const log = getState().sessions[`${MON}:${kind}`]
    expect(Object.keys(log.entries)).toContain(`${kind}:extra`)
    expect(log.exercises[`${kind}:extra`]).toBe('plank')
    expect(log.extra).toBe('plank')
  })

  it('telt mee in het tilvolume van die week', () => {
    setState((s) => ({
      ...s,
      exerciseState: {
        ...s.exerciseState,
        db_shoulder_press: es({ targetWeight: 12.5, targetReps: 8 }),
      },
    }))
    logSessie(MON)
    const kind = buildDay(getState(), MON).strength!.kind
    const voor = sessionVolumeKg(getState().sessions[`${MON}:${kind}`])
    const voorWeek = weeklyStrengthVolume(getState(), 1)[0].kg

    metExtra(MON, 'db_shoulder_press')

    expect(sessionVolumeKg(getState().sessions[`${MON}:${kind}`])).toBeGreaterThan(voor)
    // en de weekgrafiek rekent met dezelfde functie, dus die schuift mee
    if (weeklyStrengthVolume(getState(), 1)[0].weekStart === mondayOf(MON)) {
      expect(weeklyStrengthVolume(getState(), 1)[0].kg).toBeGreaterThan(voorWeek)
    }
  })

  it('telt mee in de opbouwteller van die oefening', () => {
    // een oefening met een streefgewicht, zodat er iets te tellen valt
    setState((s) => ({
      ...s,
      exerciseState: {
        ...s.exerciseState,
        db_shoulder_press: es({ targetWeight: 12.5, targetReps: 8 }),
      },
    }))

    logSessie(MON)
    expect(stateFor(getState(), 'db_shoulder_press').hitStreak ?? 0).toBe(0)

    metExtra(MON, 'db_shoulder_press')
    expect(stateFor(getState(), 'db_shoulder_press').hitStreak).toBe(1)
  })

  it('telt niet dubbel als de rest van de sessie ongemoeid blijft', () => {
    logSessie(MON)
    const voor = stateFor(getState(), 'leg_press').hitStreak
    metExtra(MON, 'plank')
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(voor)
  })
})

/**
 * Losse activiteiten staan hier volledig buiten. Een avondrondje op de fiets is geen
 * krachtwerk, en het hoort de opbouw van een oefening niet aan te raken.
 */
describe('losse activiteiten raken de krachtprogressie niet', () => {
  beforeEach(metStreefgewichten)

  it('verandert niets aan tilvolume of teller', () => {
    logSessie(MON)
    const volume = weeklyStrengthVolume(getState(), 1)[0].kg
    const teller = stateFor(getState(), 'leg_press').hitStreak

    A.addActivity(MON, { type: 'fietsen', minutes: 65, distanceKm: 22, intensity: 'rustig', note: null })
    A.addActivity(MON, { type: 'wandelen', minutes: 40, distanceKm: 3, intensity: 'rustig', note: null })

    expect(weeklyStrengthVolume(getState(), 1)[0].kg).toBe(volume)
    expect(stateFor(getState(), 'leg_press').hitStreak).toBe(teller)
    expect(getState().activities).toHaveLength(2)
  })
})
