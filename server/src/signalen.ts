import { cycleInfo } from '../../src/logic/cycle'
import { addDays, mondayOf } from '../../src/logic/dates'
import { deloadFor, weeksUntilDeload } from '../../src/logic/deload'
import { dayChecksInWeek, heavyCountBefore, isPoorDay, weekIsPoor } from '../../src/logic/feel'
import { dayGuardrails, legRunConflict, legStackAround } from '../../src/logic/guardrails'
import {
  averageRunKm,
  longRunTarget,
  longestRunKm,
  risesInARow,
  rollingReference,
  weekLoad,
  weekProjection,
  weeklyKm,
} from '../../src/logic/runningLoad'
import { sessionVolumeKg } from '../../src/logic/stats'
import type { Feel, UserState } from '../../src/types'

/**
 * De feitelijke signalen: alles wat de app al weet, uitgerekend en op een rij.
 *
 * Dit is het hart van de afspraak met het model. De app rékent — plafond, rollend
 * gemiddelde, deloadtrigger, benen voor de duurloop, tilvolume per week — en het model
 * mag daar iets van vinden. Andersom niet: er gaat geen ruwe setjes-berg naartoe waar
 * het model zelf sommen op moet doen, want dan is elk getal in het advies een gok.
 *
 * Alles hier komt uit `guardrails.ts`, `feel.ts`, `runningLoad.ts`, `deload.ts` en
 * `stats.ts` — dezelfde functies die in de app zelf de guardrails maken. Wijkt het
 * advies af van wat de app toont, dan komt dat door het oordeel, nooit door een tweede
 * berekening.
 */

/** Hoeveel weken er in de samenvatting gaan. Acht is twee deloadcycli. */
export const WEKEN = 8

export interface WeekSignaal {
  weekVanaf: string
  week: number
  /** werkelijk gelopen kilometers, losse rondjes meegerekend */
  gelopenKm: number
  /** wat de app die week aanhield */
  richtlijnKm: number
  deloadweek: boolean
  langsteLoopKm: number
  krachtsessies: number
  tilvolumeKg: number
  /** beoordelingen van kracht én loop, in de volgorde waarin ze gelogd zijn */
  gevoel: Feel[]
  zwareSessies: number
  slaapGem: number | null
  energieGem: number | null
  benenGem: number | null
  dagchecks: number
  slechteDagen: number
  overwegendSlechteWeek: boolean
  overgeslagen: string[]
}

export interface Signalen {
  profiel: { id: string; naam: string; programma: string; startdatum: string }
  vandaag: string
  week: number
  deload: {
    week: number
    actief: boolean
    aanleiding: string | null
    uitleg: string | null
    overgeslagen: boolean
    wekenTotVasteDeload: number
    /** maandagen van bewust overgeslagen deloadweken */
    overgeslagenWeken: string[]
  }
  loopvolume: {
    referentieKm: number
    referentieWeken: number
    stapFactor: number
    stapToon: string
    stapGeblokkeerd: boolean
    stapReden: string
    plafondKm: number
    richtlijnKm: number
    gelopenKm: number
    afgetopt: boolean
    bovenPlafond: boolean
    redenen: string[]
    bovenPlafondReden: string | null
    wekenAchtereenGestegen: number
    prognoseKm: number
    prognoseBoven: boolean
    lopenNogTeGaan: number
    duurloop: { km: number; lijn: number; onderhoud: boolean; reden: string }
    langsteLoop4WkKm: number
    gemiddeldeDuurloopKm: number | null
    gemiddeldeKorteLoopKm: number | null
  }
  guardrails: { id: string; toon: string; tekst: string }[]
  benenVoorDuurloop: {
    beenDag: string
    loopDag: string
    uren: number
    niveau: string
    structureel: boolean
    tekst: string
  } | null
  beenStapeling: { eerste: string; tweede: string; tekst: string } | null
  herstel: {
    zwareSessies14Dagen: number
    vorigeWeekSlecht: boolean
    weekDaarvoorSlecht: boolean
  }
  weken: WeekSignaal[]
  streefgewichten: { oefening: string; kg: number; reps: number | null }[]
  afwijkingen: { datum: string; soort: string; voorgesteld: number | null; gekozen: number | null; notitie: string }[]
  meldingen: string[]
}

/**
 * Bouwt de signalen voor `iso`. Alle datums zijn expliciet: er wordt nergens naar de
 * echte klok gekeken, zodat dezelfde staat op dezelfde dag altijd hetzelfde oplevert —
 * en zodat een test er iets zinnigs over kan zeggen.
 */
export function buildSignalen(state: UserState, iso: string, weken = WEKEN): Signalen {
  const load = weekLoad(state, iso)
  const vooruit = weekProjection(state, iso)
  const duur = longRunTarget(state, iso)
  const ref = rollingReference(state, iso)
  const deload = deloadFor(state, iso)
  const legs = legRunConflict(state, iso)
  const stapel = legStackAround(state, iso)

  return {
    profiel: {
      id: state.id,
      naam: state.naam,
      programma: state.programId,
      startdatum: state.startDate,
    },
    vandaag: iso,
    week: cycleInfo(state.startDate, iso).week,
    deload: {
      week: deload.week,
      actief: deload.active,
      aanleiding: deload.reason,
      uitleg: deload.explanation,
      overgeslagen: deload.skipped,
      wekenTotVasteDeload: weeksUntilDeload(deload.week),
      overgeslagenWeken: Object.keys(state.deloadSkips ?? {}).sort(),
    },
    loopvolume: {
      referentieKm: load.reference,
      referentieWeken: ref.weeks,
      stapFactor: load.growth.factor,
      stapToon: load.growth.tone,
      stapGeblokkeerd: load.growth.blocking,
      stapReden: load.growth.reason,
      plafondKm: load.cap,
      richtlijnKm: load.km,
      gelopenKm: load.done,
      afgetopt: load.capped,
      bovenPlafond: load.overCap,
      redenen: load.reasons,
      bovenPlafondReden: load.overCapReason,
      wekenAchtereenGestegen: risesInARow(state, iso),
      prognoseKm: vooruit.planned,
      prognoseBoven: vooruit.over,
      lopenNogTeGaan: vooruit.remaining,
      duurloop: { km: duur.km, lijn: duur.line, onderhoud: duur.maintenance, reden: duur.reason },
      langsteLoop4WkKm: longestRunKm(state, iso),
      gemiddeldeDuurloopKm: averageRunKm(state, iso, 'long'),
      gemiddeldeKorteLoopKm: averageRunKm(state, iso, 'short'),
    },
    guardrails: dayGuardrails(state, iso).map((g) => ({ id: g.id, toon: g.tone, tekst: g.text })),
    benenVoorDuurloop: legs
      ? {
          beenDag: legs.legsDate,
          loopDag: legs.runDate,
          uren: legs.hours,
          niveau: legs.load.level,
          structureel: legs.structural,
          tekst: legs.text,
        }
      : null,
    beenStapeling: stapel ? { eerste: stapel.first, tweede: stapel.second, tekst: stapel.text } : null,
    herstel: {
      zwareSessies14Dagen: heavyCountBefore(state, mondayOf(iso), 14),
      vorigeWeekSlecht: weekIsPoor(state, addDays(mondayOf(iso), -7)),
      weekDaarvoorSlecht: weekIsPoor(state, addDays(mondayOf(iso), -14)),
    },
    weken: wekenReeks(state, iso, weken),
    streefgewichten: streefgewichten(state),
    afwijkingen: (state.deviations ?? []).slice(-25).map((d) => ({
      datum: d.date,
      soort: d.kind,
      voorgesteld: d.suggested,
      gekozen: d.chosen,
      notitie: d.note,
    })),
    meldingen: (state.notices ?? []).slice(-25).map((n) => `${n.date} — ${n.text}`),
  }
}

/**
 * De weken zelf: kilometers uit dezelfde functie als de grafiek op Historie, met het
 * krachtwerk en de gevoelsregistratie ernaast.
 */
function wekenReeks(state: UserState, iso: string, weken: number): WeekSignaal[] {
  return weeklyKm(state, iso, weken).map((w) => {
    const dagen = new Set(Array.from({ length: 7 }, (_, d) => addDays(w.weekStart, d)))
    const gevoel: Feel[] = []
    let krachtsessies = 0
    let tilvolume = 0
    let langste = 0
    const overgeslagen: string[] = []

    for (const log of Object.values(state.sessions ?? {})) {
      if (!log.completedAt || !dagen.has(log.date)) continue
      krachtsessies++
      tilvolume += sessionVolumeKg(log)
      if (log.feel) gevoel.push(log.feel)
    }
    for (const run of Object.values(state.runs ?? {})) {
      if (!run.completedAt || !dagen.has(run.date)) continue
      if (!run.bike) langste = Math.max(langste, run.km)
      if (run.feel) gevoel.push(run.feel)
    }
    for (const a of state.activities ?? []) {
      if (a.type !== 'hardlopen' || !dagen.has(a.date)) continue
      langste = Math.max(langste, a.distanceKm ?? 0)
    }
    for (const [sleutel, skip] of Object.entries(state.skips ?? {})) {
      const datum = sleutel.split(':')[0]
      if (dagen.has(datum)) overgeslagen.push(`${skip.what}: ${skip.reason}`)
    }

    const checks = dayChecksInWeek(state, w.weekStart)
    const benen: number[] = []
    for (const dag of dagen) {
      const v = state.checkins?.[dag]
      if (typeof v === 'number') benen.push(v)
    }

    return {
      weekVanaf: w.weekStart,
      week: w.week,
      gelopenKm: w.km,
      richtlijnKm: w.planned,
      deloadweek: w.deload,
      langsteLoopKm: rond(langste),
      krachtsessies,
      tilvolumeKg: Math.round(tilvolume),
      gevoel,
      zwareSessies: gevoel.filter((f) => f === 'zwaar').length,
      slaapGem: gemiddelde(checks.map((c) => c.sleep)),
      energieGem: gemiddelde(checks.map((c) => c.energy)),
      benenGem: gemiddelde(benen),
      dagchecks: checks.length,
      slechteDagen: checks.filter(isPoorDay).length,
      overwegendSlechteWeek: weekIsPoor(state, w.weekStart),
      overgeslagen,
    }
  })
}

/** De twintig zwaarste streefgewichten; de rest zegt niets over het patroon. */
function streefgewichten(state: UserState): { oefening: string; kg: number; reps: number | null }[] {
  return Object.entries(state.exerciseState ?? {})
    .filter(([, es]) => typeof es.targetWeight === 'number' && es.targetWeight > 0)
    .map(([oefening, es]) => ({
      oefening,
      kg: es.targetWeight as number,
      reps: es.targetReps ?? null,
    }))
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 20)
}

function gemiddelde(xs: number[]): number | null {
  if (xs.length === 0) return null
  return rond(xs.reduce((a, b) => a + b, 0) / xs.length)
}

function rond(n: number): number {
  return Math.round(n * 100) / 100
}
