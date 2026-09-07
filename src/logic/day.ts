import { DAY_LABEL } from '../data/plan'
import { programFor } from '../data/programs'
import type { UserState, DayKind, RunKind, RunLog, SessionLog, SkipReason, Warmup } from '../types'
import { cycleInfo, type CycleInfo } from './cycle'
import { isBackfillDate, TOO_OLD_TEXT } from './backfill'
import { addDays, mondayOf, today, weekday } from './dates'
import { deloadFor, type DeloadPlan } from './deload'
import { durationWarning, sessionMinutes, type DurationWarning } from './duration'
import { dayGuardrails, legStackAround, type Guardrail } from './guardrails'
import { CALIBRATION_TEXT } from './progression'
import { round05 } from './running'
import { runContext } from './runningLoad'
import { scheduledRun, scheduledStrength } from './schedule'
import { PICKED_UP_REASON } from './skips'
import { type ResolvedSlot } from './select'
import { resolveSession } from './sessionSlots'
import { warmupOf } from './warmup'

export interface RunBlock {
  kind: RunKind
  /**
   * De afstand die jij zelf voor deze dag gezet hebt; 0 als je niets gezet hebt. De app
   * vult hier nooit een eigen getal in — de loopplanning is niet aan haar.
   */
  plannedKm: number
  /** hetzelfde getal, voor de schermen die de afstand van vandaag tonen */
  km: number
  /** er staat een zelfgezette afstand voor deze dag */
  manualPlan: boolean
  bike: boolean
  /** er staat geen afstand: jij loopt wat je wilt, de app registreert */
  free: boolean
  done: boolean
  log: RunLog | null
  skipped: SkipReason | null
  /** deze loop stond oorspronkelijk op die datum */
  movedFrom: string | null
  /**
   * Eén feitelijke regel bij een zelfgezette afstand: hoe hij zich verhoudt tot je
   * gemiddelde loop van deze soort en tot je langste loop. Leeg bij fietsen en zolang
   * je zelf niets ingevuld hebt.
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

/** Hoe een loop op het scherm heet. Fietsen is geen loop, en dat hoort er te staan. */
export function runName(kind: RunKind, bike: boolean): string {
  if (bike) return 'Fietsen'
  return kind === 'long' ? 'Duurloop' : 'Korte loop'
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
    // De enige afstand die de app kent is de afstand die jij gezet hebt. Er wordt niets
    // voorgerekend, niets afgetopt en niets teruggeschaald: dit blok zegt dát er een loop
    // staat, en verder registreert het wat je gedaan hebt.
    const manual = state.runPlans?.[iso]
    const planned = typeof manual === 'number' && Number.isFinite(manual) && manual > 0 ? round05(manual) : 0

    run = {
      kind: runKind,
      plannedKm: planned,
      km: planned,
      manualPlan: planned > 0,
      bike,
      free: planned <= 0,
      done: !!log?.completedAt,
      log,
      skipped: skip?.what === 'run' ? skip.reason : null,
      movedFrom: runSlot.movedFrom,
      context: planned > 0 && !bike ? runContext(state, iso, runKind, planned) : '',
    }
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
      if (cycle.calibration) notes.push(`Kalibratieweek: ${CALIBRATION_TEXT}. Log wat je doet.`)
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
  vandaag: string = today(),
): Omit<MoveTarget, 'warnings'>[] {
  const monday = mondayOf(iso)
  const out: Omit<MoveTarget, 'warnings'>[] = []

  // van de dag vóór deze week tot en met de dag erna
  for (let d = -1; d <= 7; d++) {
    const target = addDays(monday, d)
    if (target === iso) continue
    const kandidaat = candidateFor(state, iso, target, what)
    if (kandidaat) out.push(kandidaat)
  }

  /*
    Een sessie die je gemist hebt staat in het verleden, en dan is de dag waar je hem
    naartoe wilt hebben bijna altijd vandaag. Die valt buiten de week van de bron zodra
    het om vorige week gaat, en stond dus precies niet in de lijst op het moment dat je
    hem nodig had. Hij komt er nu bij, en vooraan: bovenaan de dagen die nog komen.
  */
  if (isBackfillDate(iso, vandaag)) {
    const eerder = out.filter((t) => t.date < iso)
    const later = out.filter((t) => t.date > iso && t.date !== vandaag)
    const nu = out.find((t) => t.date === vandaag) ?? candidateFor(state, iso, vandaag, what)
    if (nu) return [...eerder, nu, ...later]
  }

  return out
}

/** Eén kandidaatdag, of null als hij helemaal niet in de lijst hoort. */
function candidateFor(
  state: UserState,
  iso: string,
  target: string,
  what: MoveWhat,
): Omit<MoveTarget, 'warnings'> | null {
  const moves = (what === 'run' ? state.runMoves : state.moves) ?? {}
  if (moves[target]) return null // al verplaatst, geen ketens

  if (weekday(target) === programFor(state).restWeekday) {
    return { date: target, swapWith: null, blocked: REST_DAY_REASON, earlier: target < iso }
  }

  // bewust niet via `buildDay`: die bouwt de hele dag inclusief guardrails, en dat maal
  // negen kandidaten maakt het openen van de lijst traag. Wie er staat is genoeg.
  const bezet = what === 'run' ? scheduledRun(state, target) : scheduledStrength(state, target)
  if (bezet.movedFrom) return null

  return {
    date: target,
    swapWith: bezet.kind ? blockName(bezet.kind, what) : null,
    blocked: null,
    earlier: target < iso,
  }
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

  // twee zware beensessies achter elkaar
  const stapel = legStackAround(next, target)
  if (stapel && !legStackAround(state, target)) out.push(stapel.text)

  return out
}

/* -------------------------------------------------------------------------
 * Een gemiste sessie vandaag oppakken
 * ---------------------------------------------------------------------- */

/** Wat er met de sessie van vandaag gebeurt als er al een staat. */
export type PickUpResolve = 'shift' | 'skip'

export interface PickUpConflict {
  /** de sessie die vandaag al staat, zoals hij op het scherm heet */
  naam: string
  /** de eerstvolgende dag waar hij naartoe kan; null = alleen overslaan */
  shiftTo: string | null
}

export type PickUpResult =
  | { kind: 'ok'; next: UserState; warnings: string[] }
  | { kind: 'blocked'; reason: string }
  | { kind: 'conflict'; conflict: PickUpConflict }

export const PICK_UP_NOTHING = 'Op die dag staat niets meer open.'
export const PICK_UP_FUTURE = 'Alleen een sessie van een eerdere dag is vandaag op te pakken.'

/**
 * Een gemiste sessie van een eerdere dag vandaag alsnog doen.
 *
 * Dit is bewust geen verplaatsing. Verplaatsen ruilt met de doeldag, en dat is precies
 * wat hier niet mag: de sessie van vandaag zou dan naar gisteren gaan, en gisteren is
 * voorbij. En het venster van verplaatsen loopt van de dag vóór de week van de bron tot
 * de dag erna — vanuit vorige week kom je daarmee hooguit op maandag, terwijl het juist
 * om vandaag gaat.
 *
 * Dus: de brondag wijst naar vandaag, en verder niets. Staat er vandaag al zo'n sessie,
 * dan wijkt die niet vanzelf — dat is een keuze, en deze functie geeft hem terug als
 * `conflict` in plaats van hem zelf te maken. Met `resolve` erbij wordt hij uitgevoerd:
 *
 * - `shift` — de sessie van vandaag schuift door naar de eerstvolgende vrije dag;
 * - `skip`  — hij ruilt van plek met de opgepakte sessie en staat daar overgeslagen. Dat
 *   is de enige plek waar ruilen met het verleden wél mag: een sessie die niet meer
 *   gebeurt kun je op een dag zetten die al voorbij is, een sessie die je nog moet doen
 *   niet.
 *
 * De sessie landt op vandaag en wordt dus op vandaag gelogd — geen `backfilledOn`, en hij
 * telt gewoon mee voor de progressie. Dat is het verschil met achteraf invullen: daar zeg
 * je "dit deed ik toen", hier zeg je "dit doe ik nu".
 */
export function pickUpToday(
  state: UserState,
  iso: string,
  what: MoveWhat,
  vandaag: string = today(),
  resolve?: PickUpResolve,
): PickUpResult {
  if (iso >= vandaag) return { kind: 'blocked', reason: PICK_UP_FUTURE }
  if (!isBackfillDate(iso, vandaag)) return { kind: 'blocked', reason: TOO_OLD_TEXT }

  const bron = buildDay(state, iso)
  const blok = what === 'run' ? bron.run : bron.strength
  if (!blok || blok.done || blok.skipped) return { kind: 'blocked', reason: PICK_UP_NOTHING }

  if (buildDay(state, vandaag).isRest) return { kind: 'blocked', reason: REST_DAY_REASON }

  /*
    De brondag is niet altijd de dag waar de sessie oorspronkelijk hoort: hij kan daar zelf
    naartoe verplaatst zijn. Die verplaatsing wordt eerst teruggedraaid — anders komt er
    een tweede schakel aan de ketting en verdwijnt de sessie die op de brondag hoorde. Wat
    daardoor terugvalt op zijn eigen dag staat daar gewoon weer open.
  */
  const oorsprong = blok.movedFrom ?? iso
  let basis = blok.movedFrom ? undoMoveIn(state, oorsprong, iso, what) : state

  /*
    Kwam de sessie van vandaag — je had hem naar een eerdere dag gehaald en daar laten
    liggen — dan is het terugdraaien hierboven het hele antwoord. Hij staat weer waar hij
    hoort, en er valt niets te verplaatsen.
  */
  if (oorsprong === vandaag) {
    return { kind: 'ok', next: basis, warnings: pickUpWarnings(state, basis, vandaag, what) }
  }

  const hier = buildDay(basis, vandaag)
  const staat = what === 'run' ? hier.run : hier.strength
  if (staat && !staat.skipped) {
    // geen ketens: een sessie die hier zelf al een verplaatsing is, schuift niet verder
    const shiftTo = staat.movedFrom ? null : nextFreeDay(basis, vandaag, what)
    const naam = what === 'run' ? runName(hier.run!.kind, hier.run!.bike) : hier.strength!.naam
    if (!resolve) return { kind: 'conflict', conflict: { naam, shiftTo } }

    basis =
      resolve === 'shift' && shiftTo
        ? applyMove(basis, vandaag, shiftTo, what)
        : vacateToday(basis, vandaag, oorsprong, what)
  }

  const key = what === 'run' ? 'runMoves' : 'moves'
  const next: UserState = {
    ...basis,
    [key]: { ...(basis[key] ?? {}), [oorsprong]: vandaag },
  }

  return { kind: 'ok', next, warnings: pickUpWarnings(state, next, vandaag, what) }
}

/** Draait één verplaatsing terug, inclusief de ruil die er de andere kant op bij hoort. */
function undoMoveIn(state: UserState, from: string, to: string, what: MoveWhat): UserState {
  const key = what === 'run' ? 'runMoves' : 'moves'
  const moves = { ...(state[key] ?? {}) }
  delete moves[from]
  if (moves[to] === from) delete moves[to]
  return { ...state, [key]: moves }
}

/**
 * Maakt de dag van vandaag vrij voor de sessie die opgepakt wordt, en legt vast dat wat
 * er weg moest niet gebeurd is.
 *
 * Twee lagen kunnen in de weg staan. Een sessie die hier naartoe verplaatst is gaat terug
 * naar zijn eigen dag en staat daar overgeslagen — hij stond vandaag, en vandaag gebeurt
 * iets anders. Wat er daarna nog van deze dag zelf overblijft ruilt van plek met de
 * opgepakte sessie: die dag is voorbij, dus daar staat hij als overgeslagen.
 *
 * Beide krijgen "ingehaald" als reden. Niet "geen zin": er kwam iets anders voor in de
 * plaats, en dat hoort er over een maand nog te staan.
 */
function vacateToday(
  state: UserState,
  vandaag: string,
  oorsprong: string,
  what: MoveWhat,
): UserState {
  const key = what === 'run' ? 'runMoves' : 'moves'
  const moves = { ...(state[key] ?? {}) }
  const skips = { ...state.skips }

  const inkomend = Object.keys(moves).find((from) => moves[from] === vandaag)
  if (inkomend) {
    delete moves[inkomend]
    if (moves[vandaag] === inkomend) delete moves[vandaag]
    skips[`${inkomend}:${what}`] = { reason: PICKED_UP_REASON, what }
  }

  const tussen: UserState = { ...state, [key]: moves, skips }
  const eigen = what === 'run' ? scheduledRun(tussen, vandaag) : scheduledStrength(tussen, vandaag)
  if (!eigen.kind) return tussen

  moves[vandaag] = oorsprong
  skips[`${oorsprong}:${what}`] = { reason: PICKED_UP_REASON, what }
  return { ...state, [key]: moves, skips }
}

/**
 * De eerstvolgende dag waar de sessie van vandaag naartoe kan: geen rustdag, nog geen
 * sessie van deze soort, en niet al aan een verplaatsing bezig. Tot en met de dag na deze
 * week — verder vooruit schuiven maakt van één gemiste sessie een gemiste week.
 */
export function nextFreeDay(state: UserState, vandaag: string, what: MoveWhat): string | null {
  const laatste = addDays(mondayOf(vandaag), 7)
  for (let d = addDays(vandaag, 1); d <= laatste; d = addDays(d, 1)) {
    const kandidaat = candidateFor(state, vandaag, d, what)
    if (kandidaat && !kandidaat.blocked && !kandidaat.swapWith) return d
  }
  return null
}

/**
 * Wat er misgaat als deze sessie vandaag gedaan wordt. Dezelfde beoordeling als bij
 * verplaatsen — de guardrails gelden op de nieuwe datum — plus de geschatte duur, want
 * twee sessies op één dag is precies het geval waarin die uit de hand loopt. Niets
 * hiervan houdt iets tegen; je hoort het alleen te weten.
 */
function pickUpWarnings(
  state: UserState,
  next: UserState,
  vandaag: string,
  what: MoveWhat,
): string[] {
  const out: string[] = []

  const stapel = legStackAround(next, vandaag)
  if (stapel && !legStackAround(state, vandaag)) out.push(stapel.text)

  if (what === 'strength') {
    const tooLong = buildDay(next, vandaag).strength?.tooLong
    if (tooLong && !buildDay(state, vandaag).strength?.tooLong) out.push(tooLong.text)
  }

  return out
}

function blockName(kind: DayKind | RunKind, what: MoveWhat): string {
  if (what === 'run') return kind === 'long' ? 'Duurloop' : 'Korte loop'
  return DAY_LABEL[kind as DayKind]
}
