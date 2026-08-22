import { DAY_LABEL } from '../data/plan'
import { programFor } from '../data/programs'
import type { UserState, DayKind, RunKind, RunLog, SessionLog, SkipReason, Warmup } from '../types'
import { cycleInfo, type CycleInfo } from './cycle'
import { addDays, mondayOf, weekday } from './dates'
import { deloadFor, type DeloadPlan } from './deload'
import { durationWarning, sessionMinutes, type DurationWarning } from './duration'
import { dayGuardrails, legStackAround, rawLegRunConflict, type Guardrail } from './guardrails'
import { scaledRunKm } from './running'
import { plannedRunKm, runContext, weekProjection } from './runningLoad'
import { scheduledRun, scheduledStrength } from './schedule'
import { type ResolvedSlot } from './select'
import { resolveSession } from './sessionSlots'
import { warmupOf } from './warmup'

export interface RunBlock {
  kind: RunKind
  /** de geplande afstand: wat de app voorschrijft, of wat je zelf ingesteld hebt */
  plannedKm: number
  /** de afstand voor vandaag, na de check-in van vanochtend */
  km: number
  /** de geplande afstand is met de hand gezet */
  manualPlan: boolean
  bike: boolean
  /** de app schrijft geen afstand voor: jij loopt wat je wilt, de app registreert */
  free: boolean
  capped: boolean
  scaledDown: boolean
  done: boolean
  log: RunLog | null
  skipped: SkipReason | null
  /** deze loop stond oorspronkelijk op die datum */
  movedFrom: string | null
  /** per bijsturing één regel waarom de afstand is wat hij is */
  why: string[]
  /**
   * Eén feitelijke regel bij de afstand van vandaag: hoe hij zich verhoudt tot je
   * gemiddelde loop van deze soort en tot je langste loop. Leeg bij fietsen en bij een
   * programma dat geen afstand voorschrijft.
   */
  context: string
}

export interface StrengthBlock {
  kind: DayKind
  naam: string
  optional: boolean
  duurMin: number
  /** de oefeningen in de volgorde waarin ze gedaan worden */
  slots: ResolvedSlot[]
  /** het blok waar de sessie mee begint */
  warmup: Warmup
  /** de volgorde is met de hand aangepast; de sortering staat dus even opzij */
  manualOrder: boolean
  short: boolean
  done: boolean
  sessionKey: string
  log: SessionLog | null
  skipped: SkipReason | null
  movedFrom: string | null
  hiddenAccessories: number
  hiddenCalf: boolean
  /** geschatte duur in minuten, warming-up meegerekend */
  estimatedMin: number
  /** waarschuwing bij een sessie boven het uur, met wat eruit kan */
  tooLong: DurationWarning | null
}

export interface DayPlan {
  date: string
  weekday: number
  isRest: boolean
  cycle: CycleInfo
  /** de deloadweek waar deze dag in valt */
  deload: DeloadPlan
  checkin: number | undefined
  run: RunBlock | null
  strength: StrengthBlock | null
  /** krachtsessie van deze dag staat nu op die datum */
  movedTo: string | null
  /** loop van deze dag staat nu op die datum */
  runMovedTo: string | null
  notes: string[]
  /** alles wat de app vandaag bijstuurt, met per bijsturing één regel waarom */
  guardrails: Guardrail[]
}

export function sessionKeyFor(date: string, kind: DayKind): string {
  return `${date}:${kind}`
}

/** Bouwt alles wat er op één dag te doen is. Woensdag is altijd leeg. */
export function buildDay(state: UserState, iso: string): DayPlan {
  const program = programFor(state)
  const wd = weekday(iso)
  const cycle = cycleInfo(state.startDate, iso)
  const deload = deloadFor(state, iso)
  const checkin = state.checkins[iso]
  const notes: string[] = []
  const lowEnergy = checkin !== undefined && checkin <= 2

  if (wd === program.restWeekday) {
    return {
      date: iso, weekday: wd, isRest: true, cycle, deload, checkin,
      run: null, strength: null, movedTo: null, runMovedTo: null,
      notes: ['Rustdag. Hier plant de app nooit iets.'],
      guardrails: [],
    }
  }

  const override = state.overrides[iso]
  // de bijsturingen van vandaag; ze staan als losse regels op het scherm, dus wat hier al
  // in staat hoeft niet nog eens onder de loop herhaald te worden
  const guardrails = dayGuardrails(state, iso)

  /* ---- loop ---- */
  // een verplaatste loop werkt hetzelfde als een verplaatste krachtsessie: hij is
  // hier weg en staat op de doeldag, met de soort loop van zijn oorspronkelijke dag
  const runSlot = scheduledRun(state, iso)
  const runKind = runSlot.kind
  const runMovedTo = runSlot.movedTo

  let run: RunBlock | null = null
  if (runKind) {
    const log = state.runs[iso] ?? null
    const bike = override?.bike ?? log?.bike ?? false
    const skip = state.skips[`${iso}:run`]
    const manual = state.runPlans?.[iso]
    // een vrij programma schrijft niets voor, tenzij je zelf een afstand zet
    const free = program.runMode === 'free' && !(typeof manual === 'number' && manual > 0)
    const planned = free
      ? { km: 0, capped: false, manual: false, reasons: [] as string[], context: '' }
      : plannedRunKm(state, iso, runKind)
    const scaled = free ? 0 : scaledRunKm(planned.km, checkin)
    const why = planned.reasons.filter((r) => !guardrails.some((g) => g.text === r))
    if (scaled < planned.km) {
      why.push(`Check-in ${checkin}: 30% korter, ${planned.km} km wordt ${scaled} km.`)
    }
    // de afstand die er vandaag echt staat: het voorstel, na de check-in en na een
    // handmatige schaling van deze dag
    const vandaag = override?.runScale
      ? Math.round(planned.km * override.runScale * 2) / 2
      : scaled
    run = {
      kind: runKind,
      plannedKm: planned.km,
      km: vandaag,
      manualPlan: planned.manual,
      bike,
      free,
      capped: planned.capped,
      scaledDown: scaled < planned.km,
      done: !!log?.completedAt,
      log,
      skipped: skip?.what === 'run' ? skip.reason : null,
      movedFrom: runSlot.movedFrom,
      why,
      // de context hoort bij de afstand die er vandaag echt staat, dus na de check-in
      context: free || bike ? '' : runContext(state, iso, runKind, vandaag),
    }
    if (run.scaledDown) notes.push('Check-in laag: loop 30% korter, of vervang door 30 min fietsen.')
  }

  /* ---- kracht ---- */
  const strengthSlot = scheduledStrength(state, iso)
  const kind = strengthSlot.kind
  const movedFrom = strengthSlot.movedFrom
  const movedTo = strengthSlot.movedTo

  let strength: StrengthBlock | null = null
  if (kind && kind !== 'rest') {
    const optional = kind === 'optional_upper'
    const skipSaturday = optional && (deload.active || lowEnergy)
    if (skipSaturday) {
      notes.push(
        deload.active
          ? 'Deloadweek: de optionele zaterdagsessie staat automatisch uit.'
          : 'Check-in laag: de optionele zaterdagsessie staat vandaag uit.',
      )
    } else {
      const tpl = program.templateFor(kind, cycle.week)!
      const sessionKey = sessionKeyFor(iso, kind)
      const log = state.sessions[sessionKey] ?? null
      const short = override?.short ?? log?.short ?? false
      const skip = state.skips[`${iso}:strength`]

      const { slots, before, hiddenCalf } = resolveSession(state, iso, kind, {
        short,
        lowEnergy,
        deload: deload.active,
        rotation: cycle.rotation,
        week: cycle.week,
      })

      const warmup = warmupOf(log)
      const tooLong = durationWarning(slots, warmup.minutes)

      strength = {
        kind,
        naam: DAY_LABEL[kind],
        optional,
        duurMin: short ? 25 : tpl.duurMin,
        slots,
        warmup,
        manualOrder: (override?.order ?? []).length > 0,
        short,
        done: !!log?.completedAt,
        sessionKey,
        log,
        skipped: skip?.what === 'strength' ? skip.reason : null,
        movedFrom,
        hiddenAccessories: before - slots.length,
        hiddenCalf,
        estimatedMin: sessionMinutes(slots, warmup.minutes),
        tooLong,
      }

      if (deload.active) notes.push('Deloadweek: 1 set minder per oefening en 40% van het gewicht af.')
      if (lowEnergy) notes.push('Check-in laag: 1 set minder en zwaar kuitwerk eruit.')
      if (checkin === 3) notes.push('Check-in 3: normaal programma, maar vandaag geen nieuwe gewichtsverhogingen.')
      if (cycle.calibration) notes.push('Kalibratieweek: train op gevoel, stop bij RIR 2-3. Log wat je doet.')
      if (state.settings?.travelMode) notes.push('Reismodus: lichaamsgewicht en band, max 30 min.')
      if (tooLong) notes.push(tooLong.text)
    }
  }

  if (strength?.tooLong) {
    guardrails.push({ id: 'sessieduur', text: strength.tooLong.text, tone: 'warn' })
  }
  for (const g of guardrails) if (!notes.includes(g.text)) notes.push(g.text)

  return {
    date: iso, weekday: wd, isRest: false, cycle, deload, checkin,
    run, strength, movedTo, runMovedTo, notes, guardrails,
  }
}

export interface MoveTarget {
  date: string
  /** staat hier al zo'n sessie, dan wordt het een ruil */
  swapWith: string | null
  /** reden waarom dit doel niet kan; null = toegestaan */
  blocked: string | null
  /** deze dag ligt vóór de huidige: de sessie wordt naar voren gehaald */
  earlier: boolean
  /**
   * Wat deze verplaatsing oplevert aan conflicten: te veel kilometers in die week, of
   * zwaar beenwerk te dicht op de duurloop of op een andere beensessie. Geen blokkade —
   * de gebruiker kiest zelf — maar hij hoort het vooraf te weten.
   */
  warnings: string[]
}

/** Wat er verplaatst wordt. Kracht en loop verhuizen los van elkaar. */
export type MoveWhat = 'strength' | 'run'

export const REST_DAY_REASON = 'Rustdag — hier plant de app nooit iets.'

/**
 * Past de verplaatsing toe op een kopie van de staat, zonder iets op te slaan.
 *
 * Dit is de enige plek waar staat wat verplaatsen precies doet: de brondag wijst naar de
 * doeldag, en staat daar al zo'n sessie, dan ruilen de twee. De acties in de store
 * gebruiken hem om te schrijven, en `moveTargets` om vooruit te kijken naar wat een
 * verplaatsing zou betekenen.
 */
export function applyMove(
  state: UserState,
  iso: string,
  target: string,
  what: MoveWhat,
): UserState {
  const key = what === 'run' ? 'runMoves' : 'moves'
  const moves = { ...(state[key] ?? {}) }
  // wat er volgens het schema op de doeldag staat, ook als het die week niet getoond
  // wordt (de optionele zaterdag valt in een deloadweek weg). Zonder ruil zou de sessie
  // die je verplaatst anders verdwijnen achter de sessie die daar al hoort.
  const bezet =
    what === 'run' ? scheduledRun(state, target).kind : scheduledStrength(state, target).kind

  moves[iso] = target
  if (bezet) moves[target] = iso
  return { ...state, [key]: moves }
}

/**
 * Dagen waar deze sessie naartoe kan: de hele week waar hij in staat, plus de dag ervoor
 * en de dag erna — zo is een sessie ook naar voren te halen en over een weekgrens heen te
 * verzetten. De vaste rustdag komt wel in de lijst, maar geblokkeerd: hij is nooit een
 * geldige bestemming en dat is duidelijker dan hem weg te laten.
 *
 * Staat er op de doeldag al zo'n sessie, dan ruilen de twee van plek. Dagen die al aan
 * een verplaatsing meedoen vallen af: geen ketens.
 */
export function moveTargets(state: UserState, iso: string, what: MoveWhat = 'strength'): MoveTarget[] {
  return moveCandidates(state, iso, what).map((t) => ({
    ...t,
    warnings: t.blocked ? [] : moveWarnings(state, iso, t.date, what),
  }))
}

/** Is er überhaupt een dag om naartoe te verplaatsen? Zonder de conflicten uit te rekenen. */
export function canMove(state: UserState, iso: string, what: MoveWhat = 'strength'): boolean {
  return moveCandidates(state, iso, what).some((t) => !t.blocked)
}

/**
 * De dagen zelf, zonder de conflicten erbij. Dat scheelt: uitrekenen wat een
 * verplaatsing zou betekenen kost per dag een hele doorrekening van de week, en dat is
 * zonde als je alleen wilt weten of de knop aan mag.
 */
function moveCandidates(
  state: UserState,
  iso: string,
  what: MoveWhat,
): Omit<MoveTarget, 'warnings'>[] {
  const rest = programFor(state).restWeekday
  const moves = (what === 'run' ? state.runMoves : state.moves) ?? {}
  const monday = mondayOf(iso)
  const out: Omit<MoveTarget, 'warnings'>[] = []

  // van de dag vóór deze week tot en met de dag erna
  for (let d = -1; d <= 7; d++) {
    const target = addDays(monday, d)
    if (target === iso) continue
    if (moves[target]) continue // al verplaatst, geen ketens

    if (weekday(target) === rest) {
      out.push({ date: target, swapWith: null, blocked: REST_DAY_REASON, earlier: target < iso })
      continue
    }

    // bewust niet via `buildDay`: die bouwt de hele dag inclusief guardrails, en dat maal
    // negen kandidaten maakt het openen van de lijst traag. Wie er staat is genoeg.
    const bezet = what === 'run' ? scheduledRun(state, target) : scheduledStrength(state, target)
    if (bezet.movedFrom) continue

    out.push({
      date: target,
      swapWith: bezet.kind ? blockName(bezet.kind, what) : null,
      blocked: null,
      earlier: target < iso,
    })
  }

  return out
}

/**
 * Wat er misgaat als je deze sessie naar die dag verplaatst.
 *
 * De guardrails gelden op de nieuwe datum, ook bij naar voren halen: het weekplafond voor
 * hardloopkilometers en de beenbelasting worden opnieuw beoordeeld op de staat ná de
 * verplaatsing. Alleen wat er níét al stond telt mee — een conflict dat er sowieso is,
 * hoort niet aan deze keuze te hangen.
 */
export function moveWarnings(
  state: UserState,
  iso: string,
  target: string,
  what: MoveWhat,
): string[] {
  const next = applyMove(state, iso, target, what)
  const out: string[] = []

  // loopvolume: valt de week waar hij naartoe gaat boven het plafond?
  if (what === 'run') {
    const na = weekProjection(next, target)
    const voor = weekProjection(state, target)
    if (na.over && na.planned > voor.planned + 0.01) {
      out.push(
        `Die week komt daarmee op ${fmtKm(na.planned)} km, boven het plafond van ${fmtKm(na.cap)} km — de andere lopen worden ingekort.`,
      )
    }
  }

  // zware benen te dicht op de duurloop, in beide betrokken weken
  const weken = [mondayOf(iso), mondayOf(target)].filter((w, i, a) => a.indexOf(w) === i)
  const voorConflicts = new Set(
    weken.map((w) => rawLegRunConflict(state, w)?.situation).filter(Boolean),
  )
  for (const week of weken) {
    const na = rawLegRunConflict(next, week)
    if (na && !voorConflicts.has(na.situation)) out.push(na.text)
  }

  // twee zware beensessies achter elkaar
  const stapel = legStackAround(next, target)
  if (stapel && !legStackAround(state, target)) out.push(stapel.text)

  return out
}

function fmtKm(km: number): string {
  return String(Math.round(km * 10) / 10).replace('.', ',')
}

function blockName(kind: DayKind | RunKind, what: MoveWhat): string {
  if (what === 'run') return kind === 'long' ? 'Duurloop' : 'Korte loop'
  return DAY_LABEL[kind as DayKind]
}
