import { cycleInfo } from '../../src/logic/cycle'
import { addDays, mondayOf } from '../../src/logic/dates'
import { deloadFor, weeksUntilDeload } from '../../src/logic/deload'
import { dayChecksInWeek, heavyCountBefore, isPoorDay, weekIsPoor } from '../../src/logic/feel'
import { dayGuardrails, legStackAround } from '../../src/logic/guardrails'
import { DREMPEL, MAX_VERHOGINGEN_PER_SESSIE, zoneOf } from '../../src/logic/opbouw'
import { averageRunKm, longestRunKm, weekRunFacts } from '../../src/logic/runningLoad'
import { sessionVolumeKg } from '../../src/logic/stats'
import { BY_ID } from '../../src/data/exercises'
import { BUMP_MARKER } from '../../src/logic/extra'
import type { Feel, MuscleZone, Tempo, UserState } from '../../src/types'

/**
 * De feitelijke signalen: alles wat de app al weet, uitgerekend en op een rij.
 *
 * Dit is het hart van de afspraak met het model. De app rékent — deloadtrigger, de
 * opbouwteller per oefening, tilvolume per week, gelopen kilometers — en het model mag
 * daar iets van vinden. Andersom niet: er gaat geen ruwe setjes-berg naartoe waar het
 * model zelf sommen op moet doen, want dan is elk getal in het advies een gok.
 *
 * Alles hier komt uit `guardrails.ts`, `feel.ts`, `opbouw.ts`, `runningLoad.ts`,
 * `deload.ts` en `stats.ts` — dezelfde functies die in de app zelf de guardrails maken.
 * Wijkt het advies af van wat de app toont, dan komt dat door het oordeel, nooit door een
 * tweede berekening.
 *
 * **Hardlopen staat er als feit in, niet als onderwerp.** De app plant het hardlopen niet
 * meer: geen weekplafond, geen opbouwlijn voor de duurloop, geen waarschuwing over benen
 * vlak voor een loop. Wat er hieronder over lopen staat is geteld en niet bedacht, en de
 * opdracht in `prompt.ts` zegt erbij dat het advies zelf uitsluitend over kracht gaat.
 */

/** Hoeveel weken er in de samenvatting gaan. Acht is twee deloadcycli. */
export const WEKEN = 8

export interface WeekSignaal {
  weekVanaf: string
  week: number
  /** werkelijk gelopen kilometers, losse rondjes meegerekend */
  gelopenKm: number
  /** hoe vaak er die week gelopen is; fietsen telt niet mee */
  lopen: number
  deloadweek: boolean
  langsteLoopKm: number
  krachtsessies: number
  tilvolumeKg: number
  /** beoordelingen van kracht én loop, in de volgorde waarin ze gelogd zijn */
  gevoel: Feel[]
  zwareSessies: number
  /**
   * Oefeningen die er binnen een sessie bij gedaan zijn, met hun naam. Het tilvolume
   * hierboven telt ze al mee; dit staat er apart bij omdat het iets anders betekent dan
   * een zware sessie — dit is werk dat er bewust bij is gezet.
   */
  extraOefeningen: string[]
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
  /**
   * Wat er gelopen is. Alleen tellingen: de app schrijft geen kilometers voor en heeft er
   * geen mening over. Dit staat erbij als context bij de krachttraining — drie zware
   * lopen in een week zeggen iets over hoeveel er nog in de benen zit.
   */
  hardlopen: {
    dezeWeekLopen: number
    dezeWeekKm: number
    langsteLoop4WkKm: number
    gemiddeldeDuurloopKm: number | null
    gemiddeldeKorteLoopKm: number | null
  }
  /**
   * Hoe de gewichtsprogressie voor dit profiel staat afgesteld, en hoe ver elke oefening
   * van zijn volgende stap af is. Zonder dit zou het model adviseren alsof iedereen
   * hetzelfde tempo heeft, en dat is precies het verschil tussen de twee gebruikers.
   */
  progressie: {
    /** per spiergroep: 'opbouwen' of 'onderhoud' */
    tempo: Record<MuscleZone, Tempo>
    /** hoeveel sessies op rij er gehaald moet worden voor een stap, per spiergroep */
    drempel: Record<MuscleZone, number>
    /** hooguit zoveel oefeningen gaan er per sessie omhoog */
    maxPerSessie: number
    /** welke spiergroep voorgaat als er meer kandidaten zijn dan stappen */
    voorrang: MuscleZone
    /** per oefening met een streefgewicht: hoe ver de teller staat */
    tellers: {
      oefening: string
      zone: MuscleZone
      gehaaldOpRij: number
      drempel: number
      kg: number
    }[]
  }
  guardrails: { id: string; toon: string; tekst: string }[]
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
  const week = weekRunFacts(state, iso)
  const deload = deloadFor(state, iso)
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
    hardlopen: {
      dezeWeekLopen: week.aantal,
      dezeWeekKm: week.km,
      langsteLoop4WkKm: longestRunKm(state, iso),
      gemiddeldeDuurloopKm: averageRunKm(state, iso, 'long'),
      gemiddeldeKorteLoopKm: averageRunKm(state, iso, 'short'),
    },
    progressie: progressieSignaal(state),
    guardrails: dayGuardrails(state, iso).map((g) => ({ id: g.id, toon: g.tone, tekst: g.text })),
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
  const maandagen = Array.from({ length: weken }, (_, i) =>
    weekRunFacts(state, addDays(mondayOf(iso), -7 * (weken - 1 - i))),
  )
  return maandagen.map((w) => {
    const dagen = new Set(Array.from({ length: 7 }, (_, d) => addDays(w.weekStart, d)))
    const gevoel: Feel[] = []
    let krachtsessies = 0
    let tilvolume = 0
    let langste = 0
    const overgeslagen: string[] = []

    const extraOefeningen: string[] = []
    for (const log of Object.values(state.sessions ?? {})) {
      if (!log.completedAt || !dagen.has(log.date)) continue
      krachtsessies++
      tilvolume += sessionVolumeKg(log)
      if (log.feel) gevoel.push(log.feel)
      // `extra` houdt óf de oefening vast die erbij kwam, óf de markering dat er in
      // plaats daarvan volume bij is gezet. Alleen het eerste is een oefening.
      const bij = log.extra && log.extra !== BUMP_MARKER ? BY_ID[log.extra] : undefined
      if (bij) extraOefeningen.push(bij.naam)
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
      lopen: w.aantal,
      deloadweek: w.deload,
      langsteLoopKm: rond(langste),
      krachtsessies,
      tilvolumeKg: Math.round(tilvolume),
      gevoel,
      zwareSessies: gevoel.filter((f) => f === 'zwaar').length,
      extraOefeningen,
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

/**
 * De progressie-instelling van dit profiel, met per oefening hoe ver de teller staat.
 *
 * Dit is wat het advies nodig heeft om niet naast de app te praten: bij Anouc staat alles
 * op onderhoud — zes sessies en dan de kleinste stap — en bij Rob op opbouwen met benen
 * vooraan. Een advies dat "ga wat zwaarder tillen" zegt terwijl de app zelf pas over vier
 * sessies verhoogt, is een advies dat de app tegenspreekt.
 */
function progressieSignaal(state: UserState): Signalen['progressie'] {
  const tempo = state.settings.progressie
  const drempel = Object.fromEntries(
    (Object.keys(tempo) as MuscleZone[]).map((z) => [z, DREMPEL[tempo[z]]]),
  ) as Record<MuscleZone, number>

  const tellers = Object.entries(state.exerciseState ?? {})
    .map(([oefening, es]) => {
      const ex = BY_ID[oefening]
      if (!ex || typeof es.targetWeight !== 'number' || es.targetWeight <= 0) return null
      const zone = zoneOf(ex)
      return {
        oefening,
        zone,
        gehaaldOpRij: es.hitStreak ?? 0,
        drempel: drempel[zone],
        kg: es.targetWeight,
      }
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    // dichtst bij een stap eerst: dat is wat er als eerste gaat gebeuren
    .sort((a, b) => b.gehaaldOpRij - a.gehaaldOpRij || b.kg - a.kg)
    .slice(0, 20)

  return {
    tempo,
    drempel,
    maxPerSessie: MAX_VERHOGINGEN_PER_SESSIE,
    voorrang: 'benen',
    tellers,
  }
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
