import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PICK_UP_NOTHING,
  REST_DAY_REASON,
  buildDay,
  moveTargets,
  nextFreeDay,
  pickUpToday,
} from '../src/logic/day'
import { addDays, fromISO } from '../src/logic/dates'
import { missedSessions } from '../src/logic/gemist'
import * as A from '../src/store/actions'
import { ROB, getRoot, getState, migrate, resetState, setCurrentUser, setState } from '../src/store/store'

/**
 * Een gemiste sessie vandaag alsnog doen.
 *
 * De app kon een sessie van gisteren alleen achteraf invullen — "dit deed ik toen" — en
 * verplaatsen hielp niet: dat ruilt met de doeldag, en de sessie van vandaag zou dan naar
 * gisteren gaan. Bovendien liep het venster van verplaatsen van de dag vóór de week van de
 * bron tot de dag erna, dus vanuit vorige week kwam je hooguit op maandag uit.
 *
 * Wat hier bewaakt wordt: dat oppakken vooruit werkt en nooit achteruit, dat het over de
 * weekgrens heen gaat, dat de sessie die vandaag al staat niet stilletjes verdwijnt, en
 * dat er geen ketens ontstaan.
 */

/** Een week met vaste dagen; dinsdag is "vandaag" tenzij een test anders zegt. */
const MA = '2026-09-07'
const DI = '2026-09-08'
const WO = '2026-09-09'
const DO = '2026-09-10'
const VR = '2026-09-11'
const ZA = '2026-09-12'
const ZO = '2026-09-13'

const VORIGE_MA = addDays(MA, -7)
const VORIGE_VR = addDays(VR, -7)
const VORIGE_ZO = addDays(ZO, -7)
const VOLGENDE_MA = addDays(MA, 7)

/** Zet de klok op een vaste dag en de startdatum drie weken terug: week 4, geen deload. */
function opDag(iso: string): void {
  vi.useFakeTimers()
  vi.setSystemTime(fromISO(iso))
  resetState()
  setCurrentUser(ROB)
  setState((s) => ({ ...s, startDate: addDays(MA, -21) }))
}

beforeEach(() => opDag(DI))
afterEach(() => vi.useRealTimers())

describe('de opzet klopt', () => {
  it('staat in een gewone week: geen deload, geen kalibratie', () => {
    const plan = buildDay(getState(), DI)
    expect(plan.deload.active).toBe(false)
    expect(plan.cycle.calibration).toBe(false)
    // dinsdag heeft er twee: een korte loop en de duwsessie
    expect(plan.run?.kind).toBe('short')
    expect(plan.strength?.kind).toBe('push')
  })
})

describe('over de weekgrens', () => {
  it('haalt de duurloop van zondag naar de maandag erna', () => {
    opDag(MA)
    const res = pickUpToday(getState(), VORIGE_ZO, 'run')
    expect(res.kind).toBe('ok')
    if (res.kind !== 'ok') return

    expect(buildDay(res.next, MA).run?.kind).toBe('long')
    expect(buildDay(res.next, MA).run?.movedFrom).toBe(VORIGE_ZO)
    // en op zondag staat niets meer open
    expect(buildDay(res.next, VORIGE_ZO).run).toBeNull()
    expect(buildDay(res.next, VORIGE_ZO).runMovedTo).toBe(MA)
  })

  it('komt ook vanuit vorige week op vandaag uit, waar verplaatsen dat niet kon', () => {
    // het venster van verplaatsen loopt van zaterdag ervoor tot en met deze maandag
    expect(moveTargets(getState(), VORIGE_VR).some((t) => t.date === DI && !t.blocked)).toBe(true)

    const res = pickUpToday(getState(), VORIGE_VR, 'strength')
    // dinsdag heeft zelf een duwsessie, dus dit is een conflict en geen blokkade
    expect(res.kind).toBe('conflict')
  })

  it('zet vandaag als eerste doel in de verplaatslijst bij een bron in het verleden', () => {
    const doelen = moveTargets(getState(), VORIGE_ZO)
    const later = doelen.filter((t) => !t.earlier)
    expect(later[0].date).toBe(DI)
    // en bij een bron in de toekomst verandert er niets aan de lijst
    expect(moveTargets(getState(), VR).some((t) => t.date === DI && !t.earlier)).toBe(false)
  })
})

describe('nooit ruilen met een verleden dag', () => {
  it('laat de sessie van vandaag nooit naar de brondag verhuizen', () => {
    // donderdag vorige week: trekken. Vandaag staat duwen.
    const vorigeDo = addDays(DO, -7)
    const res = A.pickUpToday(vorigeDo, 'strength', 'shift')
    expect(res.ok).toBe(true)

    const s = getState()
    expect(s.moves[DI]).not.toBe(vorigeDo)
    expect(buildDay(s, vorigeDo).strength).toBeNull()
    expect(buildDay(s, DI).strength?.kind).toBe('pull')
    expect(buildDay(s, DI).strength?.movedFrom).toBe(vorigeDo)
  })
})

describe('vandaag is een rustdag', () => {
  it('blokkeert met dezelfde reden als de verplaatslijst', () => {
    opDag(WO)
    const res = pickUpToday(getState(), VORIGE_ZO, 'run')
    expect(res).toEqual({ kind: 'blocked', reason: REST_DAY_REASON })
    expect(A.pickUpToday(VORIGE_ZO, 'run')).toEqual({ ok: false, reason: REST_DAY_REASON })
  })
})

describe('er staat vandaag al zo\'n sessie', () => {
  it('geeft het conflict terug in plaats van te kiezen', () => {
    const res = pickUpToday(getState(), VORIGE_VR, 'strength')
    expect(res.kind).toBe('conflict')
    if (res.kind !== 'conflict') return
    expect(res.conflict.naam).toBe('Duwen')
    // woensdag is rustdag, donderdag/vrijdag/zaterdag zijn bezet: zondag is de eerste vrije
    expect(res.conflict.shiftTo).toBe(ZO)
  })

  it('doet zonder keuze niets aan de opgeslagen staat', () => {
    const res = A.pickUpToday(VORIGE_VR, 'strength')
    expect(res.ok).toBe(false)
    expect(getState().moves).toEqual({})
    expect(getState().skips).toEqual({})
  })

  it('schuift de sessie van vandaag door met "shift"', () => {
    expect(A.pickUpToday(VORIGE_VR, 'strength', 'shift').ok).toBe(true)
    const s = getState()

    // benen B van vorige vrijdag staat vandaag
    expect(buildDay(s, DI).strength?.kind).toBe('legs_b')
    expect(buildDay(s, DI).strength?.movedFrom).toBe(VORIGE_VR)
    // en duwen staat op zondag
    expect(buildDay(s, ZO).strength?.kind).toBe('push')
    expect(buildDay(s, ZO).strength?.movedFrom).toBe(DI)
    // niets overgeslagen
    expect(s.skips).toEqual({})
  })

  it('slaat de sessie van vandaag over met "skip", met "ingehaald" als reden', () => {
    expect(A.pickUpToday(VORIGE_VR, 'strength', 'skip').ok).toBe(true)
    const s = getState()

    // benen B van vorige vrijdag staat vandaag
    expect(buildDay(s, DI).strength?.kind).toBe('legs_b')
    expect(buildDay(s, DI).strength?.movedFrom).toBe(VORIGE_VR)

    /*
      Duwen staat op de dag waar de opgepakte sessie vandaan komt, als overgeslagen. Dat
      is de enige plek waar ruilen met het verleden mag: die sessie gebeurt niet meer, dus
      een dag die al voorbij is doet hem geen kwaad — en zo blijft zichtbaar dát hij er
      was en waarom hij niet doorging.
    */
    expect(buildDay(s, VORIGE_VR).strength?.kind).toBe('push')
    expect(buildDay(s, VORIGE_VR).strength?.skipped).toBe('ingehaald')
    expect(s.skips[`${VORIGE_VR}:strength`]).toEqual({ reason: 'ingehaald', what: 'strength' })
  })

  it('wordt "skip" zodra er geen dag meer vrij is om naar door te schuiven', () => {
    // zaterdag naar zondag: dan is er deze week geen krachtvrije dag meer over
    A.moveSession(ZA, ZO)
    expect(nextFreeDay(getState(), DI, 'strength')).toBeNull()

    expect(A.pickUpToday(VORIGE_VR, 'strength', 'shift').ok).toBe(true)
    const s = getState()
    expect(s.skips[`${VORIGE_VR}:strength`]).toEqual({ reason: 'ingehaald', what: 'strength' })
    expect(buildDay(s, DI).strength?.movedFrom).toBe(VORIGE_VR)
  })
})

describe('geen ketens', () => {
  it('biedt alleen overslaan aan als de sessie van vandaag zelf al verplaatst is', () => {
    // benen B van vrijdag naar dinsdag halen; dan staat er een verplaatsing op vandaag
    A.moveSession(VR, DI)
    expect(buildDay(getState(), DI).strength?.movedFrom).toBe(VR)

    const res = pickUpToday(getState(), VORIGE_VR, 'strength')
    expect(res.kind).toBe('conflict')
    if (res.kind !== 'conflict') return
    expect(res.conflict.shiftTo).toBeNull()

    expect(A.pickUpToday(VORIGE_VR, 'strength', 'skip').ok).toBe(true)
    const s = getState()

    // vandaag staat de opgepakte sessie
    expect(buildDay(s, DI).strength?.movedFrom).toBe(VORIGE_VR)
    // benen B valt terug op zijn eigen vrijdag en staat daar overgeslagen
    expect(s.skips[`${VR}:strength`].reason).toBe('ingehaald')
    // en de duwsessie die vandaag hoorde staat overgeslagen op de dag van de opgepakte sessie
    expect(s.skips[`${VORIGE_VR}:strength`].reason).toBe('ingehaald')
  })

  it('verhuist de oorspronkelijke dag mee als de bron zelf een verplaatsing was', () => {
    // vorige donderdag (trekken) stond verplaatst naar vorige zaterdag; die is gemist
    const vorigeDo = addDays(DO, -7)
    const vorigeZa = addDays(ZA, -7)
    setState((s) => ({ ...s, moves: { [vorigeDo]: vorigeZa, [vorigeZa]: vorigeDo } }))
    expect(buildDay(getState(), vorigeZa).strength?.movedFrom).toBe(vorigeDo)

    expect(A.pickUpToday(vorigeZa, 'strength', 'shift').ok).toBe(true)
    const s = getState()

    // de ketting blijft één schakel lang: donderdag wijst nu naar vandaag
    expect(s.moves[vorigeDo]).toBe(DI)
    expect(buildDay(s, DI).strength?.kind).toBe('pull')
    // en de sessie die op donderdag hoorde is niet zoekgeraakt
    expect(buildDay(s, vorigeZa).strength?.kind).toBe('optional_upper')
  })

  it('draait de verplaatsing terug als de sessie van vandaag zelf was', () => {
    // duwen van vandaag naar afgelopen zondag gehaald, en daar laten liggen
    expect(A.moveSession(DI, VORIGE_ZO).ok).toBe(true)
    expect(buildDay(getState(), VORIGE_ZO).strength?.movedFrom).toBe(DI)

    expect(A.pickUpToday(VORIGE_ZO, 'strength').ok).toBe(true)
    const s = getState()
    expect(s.moves).toEqual({})
    expect(buildDay(s, DI).strength?.kind).toBe('push')
    expect(buildDay(s, DI).strength?.movedFrom).toBeNull()
  })
})

describe('loop en kracht op dezelfde dag', () => {
  it('pakt de loop op zonder de krachtsessie van vandaag te raken', () => {
    // vorige zondag: duurloop. Vandaag staat een korte loop én duwen.
    const res = A.pickUpToday(VORIGE_ZO, 'run')
    expect(res.ok).toBe(false)
    if (res.ok || !res.conflict) return
    expect(res.conflict.naam).toBe('Korte loop')

    expect(A.pickUpToday(VORIGE_ZO, 'run', 'shift').ok).toBe(true)
    const s = getState()
    expect(buildDay(s, DI).run?.kind).toBe('long')
    expect(buildDay(s, DI).run?.movedFrom).toBe(VORIGE_ZO)
    // de duwsessie van vandaag staat er nog, onaangeroerd
    expect(buildDay(s, DI).strength?.kind).toBe('push')
    expect(s.moves).toEqual({})
  })

  it('pakt de krachtsessie op zonder de loop van vandaag te raken', () => {
    expect(A.pickUpToday(VORIGE_VR, 'strength', 'shift').ok).toBe(true)
    const s = getState()
    expect(buildDay(s, DI).run?.kind).toBe('short')
    expect(s.runMoves).toEqual({})
  })
})

describe('wat er open staat', () => {
  it('laat een opgepakte sessie uit de lijst vallen', () => {
    const voor = missedSessions(getState())
    expect(voor.some((m) => m.date === VORIGE_VR && m.what === 'strength')).toBe(true)

    A.pickUpToday(VORIGE_VR, 'strength', 'shift')
    const na = missedSessions(getState())
    expect(na.some((m) => m.date === VORIGE_VR && m.what === 'strength')).toBe(false)
  })

  it('weigert een dag waar niets meer open staat', () => {
    A.skipSession(VORIGE_VR, 'strength', 'ziek')
    expect(pickUpToday(getState(), VORIGE_VR, 'strength')).toEqual({
      kind: 'blocked',
      reason: PICK_UP_NOTHING,
    })
  })

  it('weigert een dag die verder terug ligt dan het venster', () => {
    const teOud = addDays(VORIGE_MA, -1)
    const res = pickUpToday(getState(), teOud, 'strength')
    expect(res.kind).toBe('blocked')
  })

  it('weigert een dag die nog moet komen', () => {
    expect(pickUpToday(getState(), VR, 'strength').kind).toBe('blocked')
    expect(pickUpToday(getState(), DI, 'strength').kind).toBe('blocked')
  })
})

describe('de sessie telt gewoon mee', () => {
  it('logt op vandaag, zonder stempel dat hij achteraf ingevuld is', () => {
    A.pickUpToday(VORIGE_VR, 'strength', 'shift')
    const strength = buildDay(getState(), DI).strength!
    expect(strength.kind).toBe('legs_b')

    const r = strength.slots[0]
    A.completeSession(DI, strength.kind, [r], {
      [r.slot.key]: [{ weight: 100, reps: 10, done: true }],
    }, false, [r.slot.key], 'goed')

    const log = getState().sessions[`${DI}:legs_b`]
    expect(log.date).toBe(DI)
    expect(log.backfilledOn).toBeUndefined()
    expect(log.completedAt).not.toBeNull()
  })
})

describe('guardrails gelden op de nieuwe datum', () => {
  it('waarschuwt over twee zware beendagen achter elkaar, zonder tegen te houden', () => {
    // maandag is benen A; benen B van vorige vrijdag naar dinsdag zet ze achter elkaar
    opDag(DI)
    const res = pickUpToday(getState(), VORIGE_VR, 'strength')
    expect(res.kind).toBe('conflict')

    // met de sessie van vandaag overgeslagen komt benen B naast benen A van maandag
    const na = A.pickUpToday(VORIGE_VR, 'strength', 'skip')
    expect(na.ok).toBe(true)
    if (!na.ok) return
    expect(na.warnings.join(' ')).toContain('zwaar beenwerk')
    // en de sessie staat er gewoon
    expect(buildDay(getState(), DI).strength?.kind).toBe('legs_b')
  })
})

describe('het venster van de weekpagina', () => {
  it('houdt de duurloop van zondag zichtbaar op dinsdag', () => {
    const gemist = missedSessions(getState())
    expect(gemist.some((m) => m.date === VORIGE_ZO && m.what === 'run')).toBe(true)
    expect(gemist.some((m) => m.date === VOLGENDE_MA)).toBe(false)
  })
})

describe('de opgeslagen redenen', () => {
  it('houdt "ingehaald" heel door de migratie heen', () => {
    A.pickUpToday(VORIGE_VR, 'strength', 'skip')
    const bewaard = JSON.parse(JSON.stringify(getRoot()))
    expect(migrate(bewaard).users[ROB].skips[`${VORIGE_VR}:strength`]).toEqual({
      reason: 'ingehaald',
      what: 'strength',
    })
  })

  it('gooit een reden weg die de app niet kent', () => {
    setState((s) => ({
      ...s,
      skips: {
        [`${VORIGE_VR}:strength`]: { reason: 'onzin', what: 'strength' } as never,
        [`${VORIGE_ZO}:run`]: { reason: 'ziek', what: 'run' },
      },
    }))
    const na = migrate(JSON.parse(JSON.stringify(getRoot()))).users[ROB].skips
    expect(na[`${VORIGE_VR}:strength`]).toBeUndefined()
    expect(na[`${VORIGE_ZO}:run`]).toEqual({ reason: 'ziek', what: 'run' })
  })
})
