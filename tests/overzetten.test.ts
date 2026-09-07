import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ANOUC,
  ROB,
  SCHEMA_VERSION,
  exportJSON,
  getRoot,
  getUser,
  hasPin,
  importJSON,
  resetState,
  verifyPin,
} from '../src/store/store'

/**
 * Verhuizen van GitHub Pages naar het adres op de Pi.
 *
 * Voor de browser is dat een nieuwe origin, en een nieuwe origin heeft een lege
 * localStorage. Alles wat er stond komt dus via één weg terug: Exporteer alles op het
 * oude adres, Importeer op het nieuwe. Deze test rijdt die weg met een echte export van
 * de Pages-versie — schemaVersion 14, gemaakt door de `exportJSON()` van die versie —
 * en controleert wat er aan de andere kant uitkomt.
 *
 * Het bestand in `fixtures/` is geen met de hand geschreven voorbeeld: het is de
 * uitvoer van de code zoals die op main stond, met historie van negen weken voor beide
 * profielen erin.
 */

const OUD = JSON.parse(
  readFileSync(new URL('./fixtures/export-pages-v14.json', import.meta.url), 'utf8'),
) as Record<string, any>

beforeEach(() => resetState())

/** Dezelfde sessies, maar zonder het RIR-veld dat de migratie naar v17 eruit haalt. */
function zonderRir(sessions: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(sessions).map(([key, log]) => [
      key,
      {
        ...log,
        entries: Object.fromEntries(
          Object.entries<any[]>(log.entries).map(([slotKey, sets]) => [
            slotKey,
            sets.map(({ rir: _weg, ...rest }) => rest),
          ]),
        ),
      },
    ]),
  )
}

describe('een export van de Pages-versie inlezen', () => {
  it('leest hem in en hoogt hem op naar de huidige versie', () => {
    expect(OUD.schemaVersion).toBe(14)
    expect(importJSON(JSON.stringify(OUD))).toEqual({ ok: true })
    expect(getRoot().schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('houdt de historie van allebei de profielen compleet', () => {
    importJSON(JSON.stringify(OUD))

    for (const id of [ROB, ANOUC]) {
      const oud = OUD.users[id]
      const nieuw = getUser(id)!

      expect(Object.keys(nieuw.sessions)).toEqual(Object.keys(oud.sessions))
      expect(Object.keys(nieuw.runs)).toEqual(Object.keys(oud.runs))
      // de RIR per set is sinds v17 uit de app; verder komt elke sessie er ongewijzigd uit
      expect(nieuw.sessions).toEqual(zonderRir(oud.sessions))
      expect(nieuw.runs).toEqual(oud.runs)
      expect(nieuw.activities).toEqual(oud.activities)
      expect(nieuw.deviations).toEqual(oud.deviations)
      expect(nieuw.notices).toEqual(oud.notices)
    }
  })

  it('haalt de RIR per set eruit en laat de rest van de set staan', () => {
    // de fixture komt uit v14: daar stond op elke set nog een RIR
    const voor = Object.values<any>(OUD.users[ROB].sessions).flatMap((log: any) =>
      Object.values<any[]>(log.entries).flat(),
    )
    expect(voor.some((s) => 'rir' in s)).toBe(true)

    importJSON(JSON.stringify(OUD))
    const na = Object.values(getUser(ROB)!.sessions).flatMap((log) =>
      Object.values(log.entries).flat(),
    )
    expect(na.some((s) => 'rir' in s)).toBe(false)
    expect(na).toHaveLength(voor.length)
    // gewicht, reps en het vinkje blijven precies zoals ze waren
    expect(na[0]).toEqual({ weight: voor[0].weight, reps: voor[0].reps, done: voor[0].done })
  })

  it('houdt de streefgewichten, check-ins en dagchecks compleet', () => {
    importJSON(JSON.stringify(OUD))

    for (const id of [ROB, ANOUC]) {
      const oud = OUD.users[id]
      const nieuw = getUser(id)!

      // de streefwaarden blijven, met de teller van de opbouwregel erbij (op 0)
      for (const [oefening, es] of Object.entries<Record<string, unknown>>(oud.exerciseState)) {
        expect(nieuw.exerciseState[oefening], oefening).toMatchObject(es)
        expect(nieuw.exerciseState[oefening].hitStreak, oefening).toBe(0)
      }
      expect(nieuw.checkins).toEqual(oud.checkins)
      expect(nieuw.dayChecks).toEqual(oud.dayChecks)
      expect(nieuw.runPlans).toEqual(oud.runPlans)
    }
  })

  it('houdt ook de kleine dingen die makkelijk wegvallen', () => {
    importJSON(JSON.stringify(OUD))

    for (const id of [ROB, ANOUC]) {
      const oud = OUD.users[id]
      const nieuw = getUser(id)!

      expect(nieuw.startDate).toBe(oud.startDate)
      expect(nieuw.naam).toBe(oud.naam)
      expect(nieuw.programId).toBe(oud.programId)
      // de instellingen zijn erbij ingegroeid: `progressie` bestond in v14 nog niet en
      // wordt door de migratie ingevuld. Alles wat er stond hoort er nog te staan.
      expect(nieuw.settings).toMatchObject(oud.settings)
      expect(nieuw.settings.progressie).toBeTruthy()
      expect(nieuw.permanentReplacements).toEqual(oud.permanentReplacements)
      expect(nieuw.skips).toEqual(oud.skips)
      expect(nieuw.moves).toEqual(oud.moves)
      expect(nieuw.runMoves).toEqual(oud.runMoves)
      expect(nieuw.overrides).toEqual(oud.overrides)
      expect(nieuw.deloadSkips).toEqual(oud.deloadSkips)
      // `dismissedWarnings` is er in v16 uit: de melding die erin stond bestaat niet meer
      expect('dismissedWarnings' in nieuw).toBe(false)
    }
  })

  it('neemt de pincode en het gekozen profiel mee', () => {
    importJSON(JSON.stringify(OUD))
    expect(getRoot().currentUser).toBe(OUD.currentUser)
    expect(hasPin()).toBe(true)
    expect(verifyPin(OUD.pin)).toBe(true)
  })

  it('zet het adviesveld op leeg: dat bestond op Pages nog niet', () => {
    importJSON(JSON.stringify(OUD))
    expect(getUser(ROB)!.review).toBeNull()
    expect(getUser(ANOUC)!.review).toBeNull()
  })

  it('overleeft een tweede rondje export-import zonder verlies', () => {
    importJSON(JSON.stringify(OUD))
    const eerste = getRoot()
    const opnieuw = exportJSON()

    resetState()
    expect(importJSON(opnieuw)).toEqual({ ok: true })

    for (const id of [ROB, ANOUC]) {
      const heen = eerste.users[id]
      const terug = getUser(id)!
      expect(terug.sessions).toEqual(heen.sessions)
      expect(terug.runs).toEqual(heen.runs)
      expect(terug.exerciseState).toEqual(heen.exerciseState)
      expect(terug.checkins).toEqual(heen.checkins)
      expect(terug.dayChecks).toEqual(heen.dayChecks)
    }
  })

  it('telt na: geen enkele sessie, loop of check onderweg kwijtgeraakt', () => {
    importJSON(JSON.stringify(OUD))

    const tel = (u: Record<string, any>) => ({
      sessies: Object.keys(u.sessions ?? {}).length,
      loops: Object.keys(u.runs ?? {}).length,
      checkins: Object.keys(u.checkins ?? {}).length,
      dagchecks: Object.keys(u.dayChecks ?? {}).length,
      streef: Object.keys(u.exerciseState ?? {}).length,
      activiteiten: (u.activities ?? []).length,
    })

    for (const id of [ROB, ANOUC]) {
      expect(tel(getUser(id)! as unknown as Record<string, any>)).toEqual(tel(OUD.users[id]))
    }
    // en het gaat echt ergens over
    expect(tel(OUD.users[ROB]).sessies).toBeGreaterThan(10)
    expect(tel(OUD.users[ROB]).loops).toBeGreaterThan(10)
  })
})
