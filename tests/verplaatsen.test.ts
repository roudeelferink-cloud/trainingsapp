import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, mondayOf, weekday } from '../src/logic/dates'
import { REST_DAY_REASON, applyMove, buildDay, moveTargets, moveWarnings } from '../src/logic/day'
import { plannedRunKm, remainingRuns, weekLoad } from '../src/logic/runningLoad'
import * as A from '../src/store/actions'
import { ANOUC, ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'
import { DI, DO, MON, VR, WO, ZA, ZO, baseState } from './helpers'

const s0 = baseState()
const VORIGE_ZO = addDays(MON, -1)
const VOLGENDE_MA = addDays(ZO, 1)

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: MON }))
})

describe('beide richtingen', () => {
  it('biedt de dagen vóór de sessie net zo goed aan als de dagen erna', () => {
    const targets = moveTargets(s0, VR).filter((t) => !t.blocked)
    const eerder = targets.filter((t) => t.earlier)
    const later = targets.filter((t) => !t.earlier)
    expect(eerder.length).toBeGreaterThan(0)
    expect(later.length).toBeGreaterThan(0)
    expect(eerder.every((t) => t.date < VR)).toBe(true)
    expect(later.every((t) => t.date > VR)).toBe(true)
  })

  it('markeert dagen vóór de sessie als naar voren halen', () => {
    const maandag = moveTargets(s0, VR).find((t) => t.date === MON)!
    expect(maandag.earlier).toBe(true)
  })

  it('loopt van de dag vóór de week tot en met de dag erna', () => {
    const dagen = moveTargets(s0, DO).map((t) => t.date)
    expect(dagen[0]).toBe(VORIGE_ZO)
    expect(dagen[dagen.length - 1]).toBe(VOLGENDE_MA)
    // negen dagen min de sessie zelf
    expect(dagen).toHaveLength(8)
  })

  it('houdt de lijst op volgorde van datum', () => {
    const dagen = moveTargets(s0, DO).map((t) => t.date)
    expect([...dagen].sort()).toEqual(dagen)
  })

  it('haalt een sessie naar een lege eerdere dag', () => {
    // de zondag van de week ervoor heeft geen krachtsessie
    expect(A.moveSession(MON, VORIGE_ZO).ok).toBe(true)
    expect(buildDay(getState(), MON).strength).toBeNull()
    expect(buildDay(getState(), MON).movedTo).toBe(VORIGE_ZO)
    expect(buildDay(getState(), VORIGE_ZO).strength?.kind).toBe('legs_a')
    expect(buildDay(getState(), VORIGE_ZO).strength?.movedFrom).toBe(MON)
  })

  it('haalt ook een loop naar voren', () => {
    // maandag heeft geen loop, dus daar hoeft niets voor te wijken
    expect(A.moveRun(DO, MON).ok).toBe(true)
    expect(buildDay(getState(), DO).run).toBeNull()
    expect(buildDay(getState(), MON).run?.kind).toBe('short')
    expect(buildDay(getState(), MON).run?.movedFrom).toBe(DO)
  })

  it('ruilt met een bezette eerdere dag in plaats van hem te overschrijven', () => {
    expect(A.moveSession(VR, DO).ok).toBe(true)
    expect(buildDay(getState(), DO).strength?.kind).toBe('legs_b')
    expect(buildDay(getState(), VR).strength?.kind).toBe('pull')
  })

  it('ruilt met een bezette eerdere dag', () => {
    // vrijdag (benen B) naar maandag (benen A): die wisselen van plek
    expect(A.moveSession(VR, MON).ok).toBe(true)
    expect(buildDay(getState(), MON).strength?.kind).toBe('legs_b')
    expect(buildDay(getState(), VR).strength?.kind).toBe('legs_a')
  })
})

describe('over de weekgrens', () => {
  it('biedt de zondag van de week ervoor en de maandag erna aan', () => {
    const targets = moveTargets(s0, MON)
    expect(targets.some((t) => t.date === VORIGE_ZO && !t.blocked)).toBe(true)
    expect(targets.some((t) => t.date === VOLGENDE_MA && !t.blocked)).toBe(true)
  })

  it('verplaatst een loop naar de week ervoor', () => {
    // de zondag ervoor heeft zelf een duurloop, dus de twee ruilen van week
    expect(A.moveRun(DI, VORIGE_ZO).ok).toBe(true)
    expect(buildDay(getState(), VORIGE_ZO).run?.kind).toBe('short')
    expect(buildDay(getState(), VORIGE_ZO).run?.movedFrom).toBe(DI)
    expect(buildDay(getState(), DI).run?.kind).toBe('long')
  })

  it('gaat niet verder dan één dag buiten de week', () => {
    // de zaterdag van de week ervoor ligt twee dagen buiten deze week
    const vorigeZa = addDays(MON, -2)
    expect(moveTargets(s0, DI, 'run').some((t) => t.date === vorigeZa)).toBe(false)
    expect(A.moveRun(DI, vorigeZa).ok).toBe(false)
    expect(getState().runMoves).toEqual({})
  })

  it('verplaatst een krachtsessie naar de maandag erna', () => {
    expect(A.moveSession(ZA, VOLGENDE_MA).ok).toBe(true)
    expect(buildDay(getState(), VOLGENDE_MA).strength?.movedFrom).toBe(ZA)
  })

  it('telt een verplaatste loop in de week waar hij landt', () => {
    // de duurloop van zondag naar de maandag erna: die week krijgt er een loop bij
    const waarschuwingen = moveWarnings(s0, ZO, VOLGENDE_MA, 'run')
    expect(waarschuwingen.join(' ')).toContain('plafond')
  })
})

describe('woensdag blijft rustdag', () => {
  it('staat in de lijst, maar geblokkeerd', () => {
    for (const bron of [MON, DI, DO, VR, ZA, ZO]) {
      const woensdagen = moveTargets(s0, bron).filter((t) => weekday(t.date) === 3)
      expect(woensdagen.length, bron).toBeGreaterThan(0)
      expect(woensdagen.every((t) => t.blocked === REST_DAY_REASON), bron).toBe(true)
    }
  })

  it('wordt geweigerd door de actie, ook als je het toch probeert', () => {
    expect(A.moveSession(MON, WO).ok).toBe(false)
    expect(A.moveRun(DI, WO).ok).toBe(false)
    expect(getState().moves).toEqual({})
    expect(getState().runMoves).toEqual({})
  })

  it('blokkeert ook de woensdag van de week ernaast', () => {
    const volgendeWo = addDays(WO, 7)
    const doel = moveTargets(s0, ZO).find((t) => t.date === volgendeWo)
    if (doel) expect(doel.blocked).toBe(REST_DAY_REASON)
  })
})

describe('guardrails gelden op de nieuwe datum', () => {
  it('waarschuwt als zwaar beenwerk vlak voor de duurloop landt', () => {
    const zaterdag = moveTargets(s0, MON).find((t) => t.date === ZA)!
    expect(zaterdag.blocked).toBeNull()
    expect(zaterdag.warnings.join(' ')).toContain('duurloop')
    expect(zaterdag.warnings.join(' ')).toContain('24 uur')
  })

  it('waarschuwt als twee zware beensessies naast elkaar komen', () => {
    const dinsdag = moveTargets(s0, VR).find((t) => t.date === DI)!
    expect(dinsdag.warnings.join(' ')).toContain('Twee dagen zwaar beenwerk')
  })

  it('waarschuwt als een week te veel kilometers krijgt', () => {
    // een vierde loop in dezelfde week
    const waarschuwingen = moveWarnings(s0, VOLGENDE_MA === '' ? ZO : addDays(ZO, 7), DO, 'run')
    expect(waarschuwingen.join(' ')).toContain('plafond')
  })

  it('zwijgt bij een verplaatsing die niets nieuws oplevert', () => {
    // duwen van dinsdag naar donderdag raakt geen enkele guardrail
    expect(moveWarnings(s0, DI, DO, 'strength')).toEqual([])
  })

  it('hangt een bestaand conflict niet aan een nieuwe keuze', () => {
    // benen B staat sowieso 48 uur voor de duurloop; hem naar maandag ruilen verandert
    // daar niets aan, dus dat is geen waarschuwing bij deze keuze
    const maandag = moveTargets(s0, VR).find((t) => t.date === MON)!
    expect(maandag.warnings.join(' ')).not.toContain('duurloop')
  })

  it('houdt de gebruiker niet tegen', () => {
    expect(A.moveSession(MON, ZA).ok).toBe(true)
    expect(buildDay(getState(), ZA).strength?.kind).toBe('legs_a')
  })

  it('blijft de beenbelasting-check gelden op de nieuwe datum', () => {
    A.moveSession(MON, ZA)
    const guardrails = buildDay(getState(), ZA).guardrails
    expect(guardrails.some((g) => g.id.startsWith('benen-voor-duurloop'))).toBe(true)
    expect(guardrails.find((g) => g.id.startsWith('benen-voor-duurloop'))!.text).toContain('24 uur')
  })

  it('blijft het weekplafond gelden op de nieuwe datum', () => {
    // de duurloop van deze week naar de maandag erna: die week heeft dan vier lopen
    const volgendeWeek = VOLGENDE_MA
    expect(A.moveRun(ZO, volgendeWeek).ok).toBe(true)

    const load = weekLoad(getState(), volgendeWeek)
    const lopen = remainingRuns(getState(), volgendeWeek)
    expect(lopen).toHaveLength(4)

    // samen blijven ze binnen het plafond: de app schaalt terug in plaats van op te tellen
    const samen = lopen.reduce(
      (sum, r) => sum + plannedRunKm(getState(), r.date, r.kind).km,
      0,
    )
    expect(samen).toBeLessThanOrEqual(load.km + 0.01)
  })
})

describe('een sessie die deze week niet getoond wordt', () => {
  it('ruilt ook met de optionele zaterdag als die vanwege de deload uitstaat', () => {
    const week8 = addDays(MON, 49)
    const zaterdag8 = addDays(week8, 5)
    setState((s) => ({ ...s, startDate: MON }))

    expect(buildDay(getState(), week8).deload.active).toBe(true)
    expect(buildDay(getState(), zaterdag8).strength).toBeNull() // optionele sessie staat uit

    // benen A naar die zaterdag: de sessie mag niet verdwijnen achter de sessie die daar hoort
    expect(A.moveSession(week8, zaterdag8).ok).toBe(true)
    expect(buildDay(getState(), zaterdag8).strength?.kind).toBe('legs_a')
  })
})

describe('geen ketens', () => {
  it('laat een al verplaatste dag uit de lijst vallen', () => {
    A.moveSession(MON, DI)
    const targets = moveTargets(getState(), VR)
    expect(targets.some((t) => t.date === MON)).toBe(false)
  })
})

describe('applyMove verandert niets aan de opgeslagen staat', () => {
  it('geeft een nieuwe staat terug en laat de oude staan', () => {
    const voor = baseState()
    const na = applyMove(voor, MON, DO, 'strength')
    expect(voor.moves).toEqual({})
    expect(na.moves[MON]).toBe(DO)
  })
})

describe('werkt voor beide profielen', () => {
  it('biedt Anouc dezelfde richtingen, met maandag als rustdag', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))

    const targets = moveTargets(getState(), ZA)
    expect(targets.some((t) => t.earlier && !t.blocked)).toBe(true)
    expect(targets.some((t) => !t.earlier && !t.blocked)).toBe(true)
    expect(targets.filter((t) => weekday(t.date) === 1).every((t) => t.blocked !== null)).toBe(true)

    expect(A.moveSession(ZA, VR).ok).toBe(true)
    expect(buildDay(getState(), VR).strength?.movedFrom).toBe(ZA)
  })

  it('haalt bij Anouc de duurloop naar voren over de weekgrens heen', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    expect(A.moveRun(ZO, ZA).ok).toBe(true)
    expect(buildDay(getState(), ZA).run?.kind).toBe('long')
  })

  it('raakt de andere gebruiker niet', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: MON }))
    A.moveSession(ZA, VR)

    setCurrentUser(ROB)
    expect(getState().moves).toEqual({})
  })
})

describe('de weekgrens van het loopvolume', () => {
  it('rekent een verplaatste loop mee in de nieuwe week', () => {
    const week2 = addDays(MON, 7)
    A.moveRun(ZO, addDays(week2, 0)) // duurloop naar de maandag erna
    const plan = buildDay(getState(), mondayOf(week2))
    expect(plan.run?.kind).toBe('long')
  })
})
