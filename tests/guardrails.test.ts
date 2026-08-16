import { describe, expect, it } from 'vitest'
import { addDays } from '../src/logic/dates'
import { buildDay, moveTargets } from '../src/logic/day'
import {
  DISMISS_DAYS,
  conflicts,
  dayGuardrails,
  isDismissed,
  isHeavyLegsSession,
  legRunConflict,
  legStackAround,
  longRunDay,
} from '../src/logic/guardrails'
import { LEG_LOAD_HIGH, LEG_LOAD_VERY_HIGH, legLoadOn } from '../src/logic/legLoad'
import { scheduledRun, scheduledStrength } from '../src/logic/schedule'
import { ANOUC, defaultUser } from '../src/store/store'
import { DI, DO, MON, VR, WO, ZA, ZO, baseState } from './helpers'

const s0 = baseState()
const anouc = { ...defaultUser(ANOUC, 'Anouc', 'fullbody_hardlopen'), startDate: MON }

describe('schema uitlezen', () => {
  it('vindt de duurloop van de week', () => {
    expect(longRunDay(s0, MON)).toBe(ZO)
    expect(longRunDay(s0, ZO)).toBe(ZO)
  })

  it('herkent een zware benensessie aan de oefeningen, niet aan de naam', () => {
    expect(isHeavyLegsSession(s0, MON)).toBe(true) // benen A
    expect(isHeavyLegsSession(s0, VR)).toBe(true) // benen B
    expect(isHeavyLegsSession(s0, DI)).toBe(false) // duwen
    expect(isHeavyLegsSession(s0, DO)).toBe(false) // trekken
    expect(isHeavyLegsSession(s0, WO)).toBe(false) // rustdag
  })

  it('volgt verplaatsingen', () => {
    // ruil: zaterdag is al bezet, dus de twee dagen wisselen van plek
    const state = baseState({ moves: { [MON]: ZA, [ZA]: MON } })
    expect(scheduledStrength(state, MON).kind).toBe('optional_upper')
    expect(scheduledStrength(state, ZA).kind).toBe('legs_a')
    expect(scheduledStrength(state, ZA).movedFrom).toBe(MON)
    expect(scheduledRun(state, ZO).kind).toBe('long')
  })
})

describe('het tijdvenster', () => {
  const zwaar = { score: LEG_LOAD_HIGH, level: 'hoog' as const, date: MON, kind: null, parts: [] }
  const heelZwaar = { ...zwaar, score: LEG_LOAD_VERY_HIGH, level: 'zeer_hoog' as const }
  const licht = { ...zwaar, score: LEG_LOAD_HIGH - 0.1, level: 'licht' as const }

  it('meldt onder de 24 uur bij zware benen', () => {
    expect(conflicts(zwaar, 0)).toBe(true)
    expect(conflicts(zwaar, 24)).toBe(true)
  })

  it('meldt tussen 24 en 48 uur alleen bij heel zware benen', () => {
    expect(conflicts(zwaar, 48)).toBe(false)
    expect(conflicts(heelZwaar, 48)).toBe(true)
  })

  it('houdt de grenswaarden bij de strengere band, dus 24 en 48 tellen mee', () => {
    // precies 24 uur valt in de eerste band, precies 48 in de tweede
    expect(conflicts(zwaar, 24)).toBe(true)
    expect(conflicts(heelZwaar, 24)).toBe(true)
    expect(conflicts(heelZwaar, 48)).toBe(true)
    expect(conflicts(heelZwaar, 49)).toBe(false)
    expect(conflicts(heelZwaar, 72)).toBe(false)
  })

  it('zwijgt onder de drempel, hoe dichtbij ook', () => {
    expect(conflicts(licht, 0)).toBe(false)
    expect(conflicts(licht, 24)).toBe(false)
  })
})

describe('beenbelasting scoren', () => {
  it('rekent een beensessie zwaar en een duwsessie niet mee', () => {
    expect(legLoadOn(s0, MON).level).toBe('zeer_hoog')
    expect(legLoadOn(s0, VR).level).toBe('zeer_hoog')
    expect(legLoadOn(s0, DI).score).toBe(0)
    expect(legLoadOn(s0, DO).score).toBe(0)
  })

  it('noemt de oefeningen die het werk doen', () => {
    const parts = legLoadOn(s0, MON).parts
    expect(parts[0].category).toBe('zwaar')
    expect(parts.map((p) => p.naam)).toContain('Leg press')
    // zwaarste eerst
    expect(parts[0].score).toBeGreaterThanOrEqual(parts[parts.length - 1].score)
  })

  it('laat een full body met één matige beenoefening onder de drempel', () => {
    // full body A: leg press plus glute bridge en bandwerk
    const load = legLoadOn(anouc, WO)
    expect(load.score).toBeGreaterThan(0)
    expect(load.score).toBeLessThan(LEG_LOAD_HIGH)
  })

  it('telt een full body met drie beenoefeningen wél als zwaar', () => {
    expect(legLoadOn(anouc, ZA).score).toBeGreaterThanOrEqual(LEG_LOAD_HIGH)
  })

  it('telt lichter in een deloadweek: minder sets en minder gewicht', () => {
    const week8 = addDays(MON, 49)
    expect(buildDay(s0, week8).deload.active).toBe(true)
    expect(legLoadOn(s0, week8).score).toBeLessThan(legLoadOn(s0, MON).score)
  })

  it('telt niet mee als de sessie overgeslagen is', () => {
    const state = baseState({ skips: { [`${MON}:strength`]: { reason: 'ziek', what: 'strength' } } })
    expect(legLoadOn(state, MON).score).toBe(0)
  })

  it('telt lichter in de korte versie', () => {
    const kort = baseState({ overrides: { [MON]: { short: true } } })
    expect(legLoadOn(kort, MON).score).toBeLessThan(legLoadOn(s0, MON).score)
  })
})

describe('zware benen vlak voor de duurloop', () => {
  it('meldt de standaardweek van Rob: benen B op 48 uur is heel zwaar', () => {
    const conflict = legRunConflict(s0, ZO)!
    expect(conflict).not.toBeNull()
    expect(conflict.legsDate).toBe(VR)
    expect(conflict.hours).toBe(48)
    expect(conflict.load.level).toBe('zeer_hoog')
  })

  it('noemt de sessie, de uren en de oefeningen die het doen', () => {
    const conflict = legRunConflict(anouc, ZO)!
    expect(conflict.hours).toBe(24)
    expect(conflict.text).toContain('Full body B')
    expect(conflict.text).toContain('24 uur')
    expect(conflict.text).toContain('Smith squat')
  })

  it('zwijgt als de duurloop overgeslagen is', () => {
    const state = baseState({ skips: { [`${ZO}:run`]: { reason: 'ziek', what: 'run' } } })
    expect(legRunConflict(state, ZO)).toBeNull()
  })

  it('zwijgt zodra de beensessie ver genoeg weg staat', () => {
    // benen B van vrijdag naar dinsdag: dan zit er meer dan 48 uur tussen
    const state = baseState({ moves: { [VR]: DI, [DI]: VR } })
    expect(legRunConflict(state, ZO)).toBeNull()
  })

  it('staat op de beendag én op de loopdag', () => {
    expect(buildDay(anouc, ZA).guardrails.some((g) => g.id.startsWith('benen-voor-duurloop'))).toBe(true)
    expect(buildDay(anouc, ZO).guardrails.some((g) => g.id.startsWith('benen-voor-duurloop'))).toBe(true)
    expect(buildDay(anouc, WO).guardrails.some((g) => g.id.startsWith('benen-voor-duurloop'))).toBe(false)
  })

  it('geeft een knop om de sessie te verplaatsen', () => {
    const g = buildDay(anouc, ZO).guardrails.find((x) => x.id.startsWith('benen-voor-duurloop'))!
    expect(g.move).toEqual({ date: ZA, what: 'strength' })
  })
})

describe('structureel patroon dempen', () => {
  // week 3 en verder: de twee weken ervoor zien er hetzelfde uit
  const derdeWeek = addDays(ZO, 14)

  it('noemt een patroon dat er drie weken op rij zo staat structureel', () => {
    const conflict = legRunConflict(anouc, derdeWeek)!
    expect(conflict.structural).toBe(true)
    expect(conflict.text).toContain('Elke week hetzelfde')
  })

  it('noemt een conflict dat uit een verplaatsing van deze week komt geen patroon', () => {
    // benen B van vrijdag naar zaterdag: dat is deze week zo, niet elke week
    const state = baseState({ moves: { [VR]: ZA, [ZA]: VR } })
    const conflict = legRunConflict(state, ZO)!
    expect(conflict.legsDate).toBe(ZA)
    expect(conflict.structural).toBe(false)
    expect(conflict.text).not.toContain('Elke week hetzelfde')
  })

  it('herkent het vaste schema meteen als patroon, ook in week 1', () => {
    // de opzet van de week herhaalt zich per definitie; daar is geen historie voor nodig
    expect(legRunConflict(anouc, ZO)!.structural).toBe(true)
  })

  it('is weg te klikken en blijft dan vier weken stil', () => {
    const conflict = legRunConflict(anouc, derdeWeek)!
    const weggeklikt = {
      ...anouc,
      dismissedWarnings: { [conflict.signature]: derdeWeek },
    }
    expect(isDismissed(weggeklikt, conflict.signature, derdeWeek)).toBe(true)
    expect(
      buildDay(weggeklikt, derdeWeek).guardrails.some((g) => g.id.startsWith('benen-voor-duurloop')),
    ).toBe(false)

    // een dag voor het einde van de termijn nog stil
    const bijna = addDays(derdeWeek, DISMISS_DAYS - 1)
    expect(isDismissed(weggeklikt, conflict.signature, bijna)).toBe(true)
    // en daarna weer aan
    const later = addDays(derdeWeek, DISMISS_DAYS)
    expect(isDismissed(weggeklikt, conflict.signature, later)).toBe(false)
  })

  it('meldt meteen weer zodra het patroon verandert', () => {
    const conflict = legRunConflict(anouc, derdeWeek)!
    const weggeklikt = { ...anouc, dismissedWarnings: { [conflict.signature]: derdeWeek } }

    // de sessie verhuist naar vrijdag: andere dag, dus een andere sleutel
    const verplaatst = {
      ...weggeklikt,
      moves: { [addDays(derdeWeek, -1)]: addDays(derdeWeek, -2) },
    }
    const nieuw = legRunConflict(verplaatst, derdeWeek)
    if (nieuw) expect(isDismissed(verplaatst, nieuw.signature, derdeWeek)).toBe(false)
  })

  it('houdt het wegklikken bij die ene melding, niet bij alle', () => {
    const conflict = legRunConflict(anouc, derdeWeek)!
    const weggeklikt = { ...anouc, dismissedWarnings: { [conflict.signature]: derdeWeek } }
    expect(isDismissed(weggeklikt, 'iets-anders', derdeWeek)).toBe(false)
  })
})

describe('twee zware beensessies achter elkaar', () => {
  it('ziet een beensessie die naast een andere beensessie landt', () => {
    // benen B naar dinsdag ruilen zet hem direct achter benen A van maandag
    const state = baseState({ moves: { [VR]: DI, [DI]: VR } })
    const stapel = legStackAround(state, DI)
    expect(stapel).not.toBeNull()
    expect(stapel!.first).toBe(MON)
    expect(stapel!.second).toBe(DI)
    expect(stapel!.hours).toBe(24)
    expect(stapel!.text).toContain('24 uur')
  })

  it('waarschuwt daarvoor bij het verplaatsen', () => {
    const doel = moveTargets(s0, VR).find((t) => t.date === DI)!
    expect(doel.warnings.join(' ')).toContain('Twee dagen zwaar beenwerk')
  })

  it('zwijgt bij de standaardweek', () => {
    for (const iso of [MON, DI, DO, VR, ZA]) {
      expect(legStackAround(s0, iso), iso).toBeNull()
    }
  })
})

describe('alles wat de app bijstuurt is uitlegbaar', () => {
  it('geeft per bijsturing één regel', () => {
    const state = baseState({ runs: { [DI]: run(DI, 25) } })
    const regels = dayGuardrails(state, DO)
    expect(regels.length).toBeGreaterThan(0)
    for (const r of regels) {
      expect(r.text.length).toBeGreaterThan(10)
      expect(r.id).toBeTruthy()
    }
  })

  it('legt de deloadweek uit', () => {
    const week8 = addDays(MON, 49)
    const regels = dayGuardrails(baseState(), week8)
    expect(regels.some((g) => g.id === 'deload' && g.text.includes('40%'))).toBe(true)
  })

  it('zet alle guardrails ook in de dagnotities', () => {
    const week8 = addDays(MON, 49)
    const plan = buildDay(baseState(), week8)
    for (const g of plan.guardrails) expect(plan.notes).toContain(g.text)
  })
})

function run(date: string, km: number) {
  return {
    date,
    kind: 'short' as const,
    plannedKm: 6,
    km,
    minutes: 60,
    bike: false,
    completedAt: `${date}T18:00:00.000Z`,
  }
}
