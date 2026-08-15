import { beforeEach, describe, expect, it } from 'vitest'
import { programFor } from '../src/data/programs'
import { activitiesOn } from '../src/logic/activities'
import { applyProgression, emptyExerciseState } from '../src/logic/progression'
import { buildDay } from '../src/logic/day'
import { oneRmSeries, trainingStreak, weeklyRunVolume } from '../src/logic/stats'
import { startWeightAdvice } from '../src/logic/startWeight'
import { getExercise } from '../src/data/exercises'
import * as A from '../src/store/actions'
import {
  ANOUC,
  ROB,
  SCHEMA_VERSION,
  getRoot,
  getState,
  getUser,
  migrate,
  resetState,
  setCurrentUser,
  setState,
  setUserName,
} from '../src/store/store'
import { DI, DO, MON, VR, WO, ZA, ZO } from './helpers'

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: MON }))
})

/** Eerste oefening van de dag van de huidige gebruiker, zoals het sessiescherm hem aanlevert. */
function firstSlot(iso: string) {
  return buildDay(getState(), iso).strength!.slots.slice(0, 1)
}

function logSession(iso: string, weight: number) {
  const slots = firstSlot(iso)
  const key = slots[0].slot.key
  A.completeSession(iso, buildDay(getState(), iso).strength!.kind, slots, {
    [key]: [{ weight, reps: 10, rir: 1, done: true }],
  }, false, [key])
}

describe('twee gebruikers op één toestel', () => {
  it('start met beide gebruikers, elk met een eigen programma', () => {
    const root = getRoot()
    expect(Object.keys(root.users).sort()).toEqual([ANOUC, ROB])
    expect(root.users[ROB].programId).toBe('kracht_hardlopen')
    expect(root.users[ANOUC].programId).toBe('fullbody_hardlopen')
  })

  it('laat de geselecteerde gebruiker bepalen wat je ziet', () => {
    expect(getState().id).toBe(ROB)
    setCurrentUser(ANOUC)
    expect(getState().id).toBe(ANOUC)
  })

  it('houdt de naam los van het id, zodat hernoemen niets breekt', () => {
    setUserName(ANOUC, 'Anouc B.')
    expect(getUser(ANOUC)!.naam).toBe('Anouc B.')
    expect(getUser(ANOUC)!.id).toBe(ANOUC)
    expect(getUser(ANOUC)!.programId).toBe('fullbody_hardlopen')
  })
})

describe('data van de twee gebruikers blijft gescheiden', () => {
  it('schrijft loggen alleen naar de gebruiker die actief is', () => {
    A.setProtein(MON, 180)
    A.addActivity(MON, { type: 'fietsen', minutes: 40, intensity: 'rustig' })
    A.setCheckin(MON, 4)

    expect(getUser(ROB)!.protein[MON]).toBe(180)
    expect(getUser(ANOUC)!.protein).toEqual({})
    expect(activitiesOn(getUser(ANOUC)!, MON)).toHaveLength(0)
    expect(getUser(ANOUC)!.checkins).toEqual({})

    setCurrentUser(ANOUC)
    A.setProtein(MON, 110)
    expect(getUser(ANOUC)!.protein[MON]).toBe(110)
    expect(getUser(ROB)!.protein[MON]).toBe(180) // ongemoeid
  })

  it('houdt sessielogs, loops en instellingen uit elkaar', () => {
    logSession(MON, 100)
    A.completeRun(DI, 'short', { plannedKm: 6, km: 6, minutes: 36, bike: false })
    A.setBodyweight(84)

    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    A.setBodyweight(62)
    A.completeRun(DI, 'short', { plannedKm: 0, km: 8, minutes: 45, bike: false })

    expect(Object.keys(getUser(ROB)!.sessions)).toHaveLength(1)
    expect(Object.keys(getUser(ANOUC)!.sessions)).toHaveLength(0)
    expect(getUser(ROB)!.runs[DI].km).toBe(6)
    expect(getUser(ANOUC)!.runs[DI].km).toBe(8)
    expect(getUser(ROB)!.settings.bodyweightKg).toBe(84)
    expect(getUser(ANOUC)!.settings.bodyweightKg).toBe(62)
  })

  it('rekent progressie en gewichtsadvies strikt per gebruiker', () => {
    logSession(MON, 100)
    const robTargets = getUser(ROB)!.exerciseState
    expect(Object.keys(robTargets).length).toBeGreaterThan(0)

    // Anouc heeft van dezelfde oefening niets: geen streefgewicht, geen 1RM-punt
    expect(getUser(ANOUC)!.exerciseState).toEqual({})
    expect(oneRmSeries(getUser(ANOUC)!)).toEqual([])

    // en haar eigen sessie verandert niets aan die van Rob
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    logSession(WO, 40)
    expect(getUser(ROB)!.exerciseState).toEqual(robTargets)
    expect(Object.keys(getUser(ANOUC)!.exerciseState).length).toBeGreaterThan(0)
  })

  it('laat het startgewichtadvies alleen de eigen historie gebruiken', () => {
    const ex = getExercise('leg_press')
    A.setBodyweight(84)
    logSession(MON, 120) // Rob heeft nu historie op leg press

    setCurrentUser(ANOUC)
    A.setBodyweight(62)
    const advies = startWeightAdvice(ex, getState(), programFor(getState()).startScale)

    // gebaseerd op háár lichaamsgewicht, niet op de 120 kg van Rob
    expect(advies).not.toBeNull()
    expect(advies!.source).toBe('bodyweight')
    expect(advies!.weight).toBeLessThan(62)
  })

  it('houdt streak en weekvolume per gebruiker', () => {
    A.completeRun(DI, 'short', { plannedKm: 6, km: 10, minutes: 55, bike: false })
    expect(weeklyRunVolume(getUser(ROB)!, 12).some((w) => w.km === 10)).toBe(true)
    expect(weeklyRunVolume(getUser(ANOUC)!, 12).every((w) => w.km === 0)).toBe(true)
    expect(typeof trainingStreak(getUser(ANOUC)!)).toBe('number')
  })

  it('bewaart beide gebruikers over een herlaadbeurt heen', () => {
    A.setProtein(MON, 175)
    setCurrentUser(ANOUC)
    A.setProtein(MON, 95)

    const opgeslagen = localStorage.getItem('trainingsapp.state.v1')
    const herladen = migrate(JSON.parse(opgeslagen!))

    expect(herladen.schemaVersion).toBe(SCHEMA_VERSION)
    expect(herladen.currentUser).toBe(ANOUC)
    expect(herladen.users[ROB].protein[MON]).toBe(175)
    expect(herladen.users[ANOUC].protein[MON]).toBe(95)
  })
})

describe('het schema van Anouc', () => {
  beforeEach(() => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
  })

  it('plant full body op woensdag en zaterdag', () => {
    expect(buildDay(getState(), WO).strength?.kind).toBe('full_body_a')
    expect(buildDay(getState(), ZA).strength?.kind).toBe('full_body_b')
  })

  it('houdt maandag leeg en laat woensdag juist niet als rustdag gelden', () => {
    expect(buildDay(getState(), MON).isRest).toBe(true)
    expect(buildDay(getState(), WO).isRest).toBe(false)
  })

  it('loopt op dinsdag, vrijdag en zondag, zonder afstand voor te schrijven', () => {
    for (const iso of [DI, VR, ZO]) {
      const run = buildDay(getState(), iso).run
      expect(run, iso).not.toBeNull()
      expect(run!.free, iso).toBe(true)
      expect(run!.plannedKm, iso).toBe(0)
    }
  })

  it('houdt donderdag vrij van hardlopen', () => {
    const donderdag = buildDay(getState(), DO)
    expect(donderdag.run).toBeNull()
    expect(donderdag.strength).toBeNull()
  })

  it('laat de krachtdagen staan waar ze stonden', () => {
    expect(buildDay(getState(), WO).strength?.kind).toBe('full_body_a')
    expect(buildDay(getState(), ZA).strength?.kind).toBe('full_body_b')
    // en de loopdagen komen niet bovenop een krachtdag
    expect(buildDay(getState(), WO).run).toBeNull()
    expect(buildDay(getState(), ZA).run).toBeNull()
  })

  it('past binnen 45-60 min en gebruikt licht te belasten oefeningen', () => {
    for (const iso of [WO, ZA]) {
      const s = buildDay(getState(), iso).strength!
      expect(s.duurMin).toBeGreaterThanOrEqual(45)
      expect(s.duurMin).toBeLessThanOrEqual(60)
      expect(s.slots.length).toBeLessThanOrEqual(7)
      // geen dumbbells: de lichtste is 12,5 kg en dat is te zwaar om mee te starten
      for (const r of s.slots) {
        expect(r.exercise.equipment, `${iso} ${r.exercise.id}`).not.toContain('dumbbells')
      }
    }
  })

  it('start lichter dan het programma van Rob', () => {
    const ex = getExercise('leg_press')
    A.setBodyweight(70)
    const hare = startWeightAdvice(ex, getState(), programFor(getState()).startScale)

    setCurrentUser(ROB)
    A.setBodyweight(70)
    const zijne = startWeightAdvice(ex, getState(), programFor(getState()).startScale)

    expect(hare!.weight).toBeLessThan(zijne!.weight)
  })

  it('klimt rustiger dan het standaardtempo bij precies dezelfde sessie', () => {
    const ex = getExercise('leg_press')
    const bounds = { repMin: 10, repMax: 12 }
    const sets = [{ weight: 40, reps: 12, rir: 1, done: true }]
    const start = emptyExerciseState()

    const standaard = applyProgression(ex, bounds, sets, start, { allowIncrease: true })
    const rustig = applyProgression(ex, bounds, sets, start, {
      allowIncrease: true,
      pace: 'gentle',
    })

    // standaard: bovengrens gehaald, dus meteen een schijf erbij
    expect(standaard.next.targetWeight).toBeGreaterThan(40)
    // rustig: eerst een herhaling erbij, het gewicht blijft staan
    expect(rustig.next.targetWeight).toBe(40)
    expect(rustig.next.targetReps!).toBeGreaterThan(start.targetReps ?? bounds.repMin)
  })

  it('verhoogt het gewicht niet na één goede sessie', () => {
    const kind = buildDay(getState(), WO).strength!.kind
    const slot = buildDay(getState(), WO).strength!.slots[0]
    const key = slot.slot.key

    // buiten de kalibratieweken, alle sets op de bovengrens met RIR 1
    setState((s) => ({ ...s, startDate: '2026-07-06' }))
    A.completeSession(WO, kind, [slot], {
      [key]: [{ weight: 40, reps: slot.repMax, rir: 1, done: true }],
    }, false, [key])

    expect(getState().exerciseState[slot.exercise.id].targetWeight).toBe(40)
  })
})
