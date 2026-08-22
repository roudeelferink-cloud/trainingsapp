import { DAY_LABEL } from '../data/plan'
import { programFor } from '../data/programs'
import type { UserState } from '../types'
import { addDays, daysBetween, formatShort, mondayOf, weekday } from './dates'
import { deloadFor } from './deload'
import { LEG_LOAD_HIGH, legLoadOn, mainCulprits, type LegLoad } from './legLoad'
import { fmt as fmtKm, weekLoad, weekProjection } from './runningLoad'
import { scheduledRun } from './schedule'

/**
 * De guardrails van een dag op één hoop.
 *
 * Alles wat de app uit zichzelf bijstuurt hoort zichtbaar en uitlegbaar te zijn: per
 * bijsturing één regel waarom. Deze module verzamelt de regels die je met alleen een
 * datum al kunt bepalen — deload, weekplafond en zware benen vlak voor de duurloop. De
 * bijsturingen die de sessie van vandaag zelf nodig hebben (de geschatte duur, het
 * gewichtsvoorstel per oefening) komen uit `duration.ts` en `progression.ts` en worden
 * in `day.ts` toegevoegd.
 */

export type GuardrailTone = 'info' | 'warn'

export interface Guardrail {
  id: string
  text: string
  tone: GuardrailTone
  /** knop die de sessie van die dag verplaatst; de MoveSheet doet de rest */
  move?: { date: string; what: 'strength' | 'run' }
  /** sleutel om deze melding weg te klikken; alleen bij een structureel patroon */
  dismissKey?: string
}

/* -------------------------------------------------------------------------
 * Zware benen vlak voor de duurloop
 * ---------------------------------------------------------------------- */

/**
 * Het tijdvenster, in uren tussen de krachtsessie en de duurloop. Dagen tellen als
 * 24 uur; de grenswaarden horen bij de strengere band, zodat precies 24 en precies 48
 * uur voorspelbaar afgehandeld worden in plaats van net buiten de regel te vallen.
 *
 * - tot en met 24 uur: melden zodra de benen zwaar belast worden;
 * - 24 tot en met 48 uur: alleen melden bij heel zware belasting;
 * - daarboven: niets.
 */
export const NEAR_HOURS = 24
export const FAR_HOURS = 48

/** Vier weken stil na het wegklikken, tenzij het patroon eerder verandert. */
export const DISMISS_DAYS = 28

export interface LegRunConflict {
  /** de dag met het beenwerk */
  legsDate: string
  /** de dag van de duurloop */
  runDate: string
  /** uren tussen de sessie en de duurloop */
  hours: number
  load: LegLoad
  /** deze combinatie staat er elke week zo */
  structural: boolean
  /** sleutel van het patroon; verandert zodra de combinatie verandert */
  signature: string
  /**
   * Grovere sleutel: welke dag, hoe zwaar, hoeveel uur — zonder wélke sessie het is. Twee
   * beensessies die van dag ruilen leveren hetzelfde probleem op, en dat is geen nieuws.
   */
  situation: string
  /** een dag eerder in de week waar de sessie wel kan; null als die er niet is */
  suggestion: string | null
  /** één regel: welke sessie, hoeveel uur ertussen, en welke oefeningen het doen */
  text: string
}

/** Is deze belasting op deze afstand van de duurloop een probleem? */
export function conflicts(load: LegLoad, hours: number): boolean {
  if (hours <= NEAR_HOURS) return load.score >= LEG_LOAD_HIGH
  if (hours <= FAR_HOURS) return load.level === 'zeer_hoog'
  return false
}

/** De dag van de duurloop in de week van `iso`, of null. */
export function longRunDay(state: UserState, iso: string): string | null {
  const mon = mondayOf(iso)
  for (let i = 0; i < 7; i++) {
    const date = addDays(mon, i)
    if (scheduledRun(state, date).kind === 'long') return date
  }
  return null
}

/**
 * Het conflict van deze week, zonder te kijken of het er vorige weken ook stond.
 *
 * Geëxporteerd omdat het vooruitkijken naar een verplaatsing alleen dit nodig heeft: of
 * er een conflict is en of dat er al stond. Of het patroon structureel is kost drie keer
 * zoveel rekenwerk en zegt bij een kandidaatdag niets — daar gaat het over deze keuze.
 */
export function rawLegRunConflict(
  state: UserState,
  iso: string,
): Omit<LegRunConflict, 'structural'> | null {
  const raw = rawSituation(state, iso)
  if (!raw) return null
  const suggestion = swapSuggestion(state, raw.legsDate, raw.runDate)
  return { ...raw, suggestion, text: conflictText(state, raw, false, suggestion) }
}

function rawSituation(
  state: UserState,
  iso: string,
): Omit<LegRunConflict, 'structural' | 'text' | 'suggestion'> | null {
  const runDate = longRunDay(state, iso)
  if (!runDate) return null
  if (state.skips?.[`${runDate}:run`]) return null

  const maxDaysBefore = Math.floor(FAR_HOURS / 24)
  for (let back = 0; back <= maxDaysBefore; back++) {
    const legsDate = addDays(runDate, -back)
    const load = legLoadOn(state, legsDate)
    const hours = back * 24
    if (!conflicts(load, hours)) continue
    return {
      legsDate,
      runDate,
      hours,
      load,
      signature: signatureOf(legsDate, runDate, load),
      situation: `${weekday(legsDate)}-${weekday(runDate)}:${load.level}`,
    }
  }
  return null
}

function signatureOf(legsDate: string, runDate: string, load: LegLoad): string {
  return `benen-duurloop:${weekday(legsDate)}-${weekday(runDate)}:${load.kind}:${load.level}`
}

/**
 * Zware benen te kort voor de duurloop.
 *
 * Staat dezelfde combinatie er de twee weken ervoor ook, dan is het geen incident maar de
 * opzet van de week. Dan komt er een andere melding: eenmalig, met de suggestie de sessie
 * te verplaatsen, in plaats van elke week hetzelfde regeltje. Een melding die altijd
 * aanstaat leest niemand meer.
 */
export function legRunConflict(state: UserState, iso: string): LegRunConflict | null {
  const raw = rawSituation(state, iso)
  if (!raw) return null

  const monday = mondayOf(iso)
  const vorige = rawSituation(state, addDays(monday, -7))?.signature
  const eerder = rawSituation(state, addDays(monday, -14))?.signature
  const structural = vorige === raw.signature && eerder === raw.signature

  const suggestion = swapSuggestion(state, raw.legsDate, raw.runDate)
  return { ...raw, structural, suggestion, text: conflictText(state, raw, structural, suggestion) }
}

function sessionName(state: UserState, load: LegLoad): string {
  if (!load.kind) return 'De krachtsessie'
  const program = programFor(state)
  return program.templateFor(load.kind, 1)?.naam ?? DAY_LABEL[load.kind]
}

function conflictText(
  state: UserState,
  raw: Omit<LegRunConflict, 'structural' | 'text' | 'suggestion'>,
  structural: boolean,
  suggestion: string | null,
): string {
  const naam = sessionName(state, raw.load)
  const oefeningen = mainCulprits(raw.load)
  const door = oefeningen.length > 0 ? ` — ${lijst(oefeningen)} ${oefeningen.length === 1 ? 'doet' : 'doen'} het meeste werk` : ''
  const uren = raw.hours === 0 ? 'op dezelfde dag als' : `${raw.hours} uur voor`
  const ruil = suggestion ? ` Verplaats hem naar ${formatShort(suggestion)} voor twee dagen herstel.` : ''

  if (structural) {
    return (
      `Elke week hetzelfde: ${naam} staat ${uren} de duurloop van ${formatShort(raw.runDate)}${door}.` +
      ruil
    )
  }
  return (
    `${naam} op ${formatShort(raw.legsDate)} staat ${uren} de duurloop van ${formatShort(raw.runDate)}${door}.` +
    ruil
  )
}

function lijst(namen: string[]): string {
  if (namen.length <= 1) return namen[0] ?? ''
  return `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`
}

/**
 * Een dag eerder in dezelfde week waar de beensessie wel kan: minstens twee dagen voor
 * de duurloop, geen rustdag, en er staat nog geen zwaar beenwerk.
 */
function swapSuggestion(state: UserState, legsDate: string, runDate: string): string | null {
  const program = programFor(state)
  const mon = mondayOf(runDate)
  for (let i = 0; i < 7; i++) {
    const date = addDays(mon, i)
    if (date === legsDate) continue
    if (daysBetween(date, runDate) < 2) continue
    if (program.restWeekday !== null && weekday(date) === program.restWeekday) continue
    if (legLoadOn(state, date).score >= LEG_LOAD_HIGH) continue
    return date
  }
  return null
}

/* -------------------------------------------------------------------------
 * Twee zware beensessies vlak na elkaar
 * ---------------------------------------------------------------------- */

export interface LegStack {
  first: string
  second: string
  hours: number
  text: string
}

/**
 * Twee dagen zwaar beenwerk direct achter elkaar. Dat is de andere manier om je knieën
 * en pezen te overvragen, en hij komt vooral in beeld bij het naar voren halen van een
 * sessie.
 */
export function legStackAround(state: UserState, iso: string): LegStack | null {
  const here = legLoadOn(state, iso)
  if (here.score < LEG_LOAD_HIGH) return null

  for (const richting of [-1, 1] as const) {
    const buur = addDays(iso, richting)
    const other = legLoadOn(state, buur)
    if (other.score < LEG_LOAD_HIGH) continue
    const first = richting === -1 ? buur : iso
    const second = richting === -1 ? iso : buur
    return {
      first,
      second,
      hours: 24,
      text:
        `Twee dagen zwaar beenwerk achter elkaar: ${sessionName(state, legLoadOn(state, first))} op ` +
        `${formatShort(first)} en ${sessionName(state, legLoadOn(state, second))} op ${formatShort(second)}, ` +
        '24 uur ertussen.',
    }
  }
  return null
}

/* -------------------------------------------------------------------------
 * Wegklikken
 * ---------------------------------------------------------------------- */

/**
 * Is deze melding weggeklikt? Alleen zolang het patroon hetzelfde is — de sleutel ís het
 * patroon — en niet langer dan vier weken.
 */
export function isDismissed(state: UserState, signature: string, iso: string): boolean {
  const at = state.dismissedWarnings?.[signature]
  if (!at) return false
  const dagen = daysBetween(at, iso)
  return dagen >= 0 && dagen < DISMISS_DAYS
}

/* -------------------------------------------------------------------------
 * Alles bij elkaar
 * ---------------------------------------------------------------------- */

/** Alles wat er vandaag bijgestuurd wordt, met per bijsturing één regel waarom. */
export function dayGuardrails(state: UserState, iso: string): Guardrail[] {
  const out: Guardrail[] = []

  const deload = deloadFor(state, iso)
  if (deload.explanation) {
    out.push({ id: 'deload', text: deload.explanation, tone: deload.skipped ? 'warn' : 'info' })
  }

  const load = weekLoad(state, iso)
  for (const [i, text] of load.reasons.entries()) {
    if (text.startsWith('Deloadweek')) continue // staat al bij de deload zelf
    // Bewust zonder `dismissKey`: de weekstap en de rem op doorstijgen zijn geen
    // structurele meldingen die na drie keer lezen wel bekend zijn, maar de reden
    // waarom er vandaag staat wat er staat. Die hoort niet weg te klikken te zijn.
    out.push({ id: `loopvolume-${i}`, text, tone: load.growth.blocking ? 'warn' : 'info' })
  }
  if (load.overCapReason) out.push({ id: 'loopvolume-over', text: load.overCapReason, tone: 'warn' })

  // wat er nog op de rol staat kan de week boven de richtlijn tillen — bijvoorbeeld
  // doordat de duurloop zijn eigen lijn volgt of er een loop bij is gekomen. De app
  // blokkeert dat niet, ze zegt het.
  const vooruit = weekProjection(state, iso)
  if (vooruit.over && !load.overCap) {
    out.push({
      id: 'loopvolume-vooruit',
      text: `Wat er deze week staat komt samen op ${fmtKm(vooruit.planned)} km, boven de richtlijn van ${fmtKm(vooruit.cap)} km.`,
      tone: 'info',
    })
  }

  const legs = legRunConflict(state, iso)
  if (legs && (iso === legs.legsDate || iso === legs.runDate)) {
    if (!(legs.structural && isDismissed(state, legs.signature, iso))) {
      out.push({
        id: legs.structural ? 'benen-voor-duurloop-structureel' : 'benen-voor-duurloop',
        text: legs.text,
        tone: 'warn',
        move: { date: legs.legsDate, what: 'strength' },
        dismissKey: legs.structural ? legs.signature : undefined,
      })
    }
  }

  return out
}

/** Belast de sessie van deze dag de benen zwaar? */
export function isHeavyLegsSession(state: UserState, iso: string): boolean {
  return legLoadOn(state, iso).score >= LEG_LOAD_HIGH
}
