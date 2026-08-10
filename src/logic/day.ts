import { DAY_LABEL } from '../data/plan'
import { programFor } from '../data/programs'
import type { UserState, DayKind, RunKind, RunLog, SessionLog, SkipReason } from '../types'
import { cycleInfo, type CycleInfo } from './cycle'
import { weekday } from './dates'
import { plannedRunKm, scaledRunKm } from './running'
import { resolveSlot, type ResolvedSlot } from './select'

export interface RunBlock {
  kind: RunKind
  plannedKm: number
  km: number
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
}

export interface StrengthBlock {
  kind: DayKind
  naam: string
  optional: boolean
  duurMin: number
  slots: ResolvedSlot[]
  short: boolean
  done: boolean
  sessionKey: string
  log: SessionLog | null
  skipped: SkipReason | null
  movedFrom: string | null
  hiddenAccessories: number
  hiddenCalf: boolean
}

export interface DayPlan {
  date: string
  weekday: number
  isRest: boolean
  cycle: CycleInfo
  checkin: number | undefined
  run: RunBlock | null
  strength: StrengthBlock | null
  /** krachtsessie van deze dag staat nu op die datum */
  movedTo: string | null
  /** loop van deze dag staat nu op die datum */
  runMovedTo: string | null
  notes: string[]
}

export function sessionKeyFor(date: string, kind: DayKind): string {
  return `${date}:${kind}`
}

/** Bouwt alles wat er op één dag te doen is. Woensdag is altijd leeg. */
export function buildDay(state: UserState, iso: string): DayPlan {
  const program = programFor(state)
  const wd = weekday(iso)
  const cycle = cycleInfo(state.startDate, iso)
  const checkin = state.checkins[iso]
  const notes: string[] = []
  const lowEnergy = checkin !== undefined && checkin <= 2

  if (wd === program.restWeekday) {
    return {
      date: iso, weekday: wd, isRest: true, cycle, checkin,
      run: null, strength: null, movedTo: null, runMovedTo: null,
      notes: ['Rustdag. Hier plant de app nooit iets.'],
    }
  }

  const spec = program.week[wd - 1]
  const override = state.overrides[iso]

  /* ---- loop ---- */
  // een verplaatste loop werkt hetzelfde als een verplaatste krachtsessie: hij is
  // hier weg en staat op de doeldag, met de soort loop van zijn oorspronkelijke dag
  let runKind: RunKind | null = spec.run
  let runMovedFrom: string | null = null
  const runMovedTo = state.runMoves[iso] ?? null
  if (runMovedTo) runKind = null

  if (!runKind) {
    const incoming = Object.entries(state.runMoves).find(([, to]) => to === iso)
    if (incoming) {
      const origin = incoming[0]
      const originKind = program.week[weekday(origin) - 1].run
      if (originKind) {
        runKind = originKind
        runMovedFrom = origin
      }
    }
  }

  let run: RunBlock | null = null
  if (runKind) {
    const log = state.runs[iso] ?? null
    const bike = override?.bike ?? log?.bike ?? false
    const skip = state.skips[`${iso}:run`]
    const free = program.runMode === 'free'
    const planned = free ? { km: 0, capped: false } : plannedRunKm(state, iso, runKind)
    const scaled = free ? 0 : scaledRunKm(planned.km, checkin)
    run = {
      kind: runKind,
      plannedKm: planned.km,
      km: override?.runScale ? Math.round(planned.km * override.runScale * 2) / 2 : scaled,
      bike,
      free,
      capped: planned.capped,
      scaledDown: scaled < planned.km,
      done: !!log?.completedAt,
      log,
      skipped: skip?.what === 'run' ? skip.reason : null,
      movedFrom: runMovedFrom,
    }
    if (planned.capped) notes.push('Loopvolume automatisch teruggeschaald: max +10% t.o.v. vorige week.')
    if (run.scaledDown) notes.push('Check-in laag: loop 30% korter, of vervang door 30 min fietsen.')
  }

  /* ---- kracht ---- */
  let kind: DayKind | null = spec.strength
  let movedFrom: string | null = null
  const movedTo = state.moves[iso] ?? null
  if (movedTo) kind = null

  if (!kind) {
    const incoming = Object.entries(state.moves).find(([, to]) => to === iso)
    if (incoming) {
      const origin = incoming[0]
      const originKind = program.week[weekday(origin) - 1].strength
      if (originKind) {
        kind = originKind
        movedFrom = origin
      }
    }
  }

  let strength: StrengthBlock | null = null
  if (kind && kind !== 'rest') {
    const optional = kind === 'optional_upper'
    const skipSaturday = optional && (cycle.deload || lowEnergy)
    if (skipSaturday) {
      notes.push(
        cycle.deload
          ? 'Deloadweek: de optionele zaterdagsessie staat automatisch uit.'
          : 'Check-in laag: de optionele zaterdagsessie staat vandaag uit.',
      )
    } else {
      const tpl = program.templateFor(kind, cycle.week)!
      const sessionKey = sessionKeyFor(iso, kind)
      const log = state.sessions[sessionKey] ?? null
      const short = override?.short ?? log?.short ?? false
      const skip = state.skips[`${iso}:strength`]

      let slots = tpl.slots.map((s) => resolveSlot(s, state, iso, cycle.rotation))

      const before = slots.length
      if (short) slots = slots.filter((r) => r.slot.role === 'core')
      let hiddenCalf = false
      if (lowEnergy) {
        const kept = slots.filter((r) => !(r.exercise.pattern === 'calf' && r.exercise.unit !== 'bw'))
        hiddenCalf = kept.length < slots.length
        slots = kept
      }
      if (state.settings.travelMode && slots.length > 5) {
        const core = slots.filter((r) => r.slot.role === 'core')
        const rest = slots.filter((r) => r.slot.role !== 'core')
        slots = [...core, ...rest].slice(0, 5)
      }

      const setDrop = (cycle.deload ? 1 : 0) + (lowEnergy ? 1 : 0)
      if (setDrop > 0) {
        slots = slots.map((r) => ({ ...r, sets: Math.max(1, r.sets - setDrop) }))
      }
      slots = slots.filter((r) => !(override?.skippedSlots ?? []).includes(r.slot.key))

      strength = {
        kind,
        naam: DAY_LABEL[kind],
        optional,
        duurMin: short ? 25 : tpl.duurMin,
        slots,
        short,
        done: !!log?.completedAt,
        sessionKey,
        log,
        skipped: skip?.what === 'strength' ? skip.reason : null,
        movedFrom,
        hiddenAccessories: before - slots.length,
        hiddenCalf,
      }

      if (cycle.deload) notes.push('Deloadweek: 1 set minder per oefening en 10% van het gewicht af.')
      if (lowEnergy) notes.push('Check-in laag: 1 set minder en zwaar kuitwerk eruit.')
      if (checkin === 3) notes.push('Check-in 3: normaal programma, maar vandaag geen nieuwe gewichtsverhogingen.')
      if (cycle.calibration) notes.push('Kalibratieweek: train op gevoel, stop bij RIR 2-3. Log wat je doet.')
      if (state.settings.travelMode) notes.push('Reismodus: lichaamsgewicht en band, max 30 min.')
    }
  }

  return {
    date: iso, weekday: wd, isRest: false, cycle, checkin,
    run, strength, movedTo, runMovedTo, notes,
  }
}

export interface MoveTarget {
  date: string
  /** staat hier al een krachtsessie, dan wordt het een ruil */
  swapWith: string | null
  /** reden waarom dit doel niet mag; null = toegestaan */
  blocked: string | null
}

const SATURDAY = 6

export const SATURDAY_LEGS_REASON =
  'Zondag is de duurloop — een beensessie kan niet op zaterdag.'

export function isLegsSession(kind: DayKind | null | undefined): boolean {
  return kind === 'legs_a' || kind === 'legs_b'
}

/**
 * Waarom een verplaatsing niet mag, of null als hij mag.
 * Beensessies mogen nooit op zaterdag landen: zondag is de duurloop.
 * Dat geldt in beide richtingen, want een bezette doeldag betekent ruilen.
 */
export function moveBlockReason(state: UserState, iso: string, target: string): string | null {
  const sourceKind = buildDay(state, iso).strength?.kind ?? null
  if (weekday(target) === SATURDAY && isLegsSession(sourceKind)) return SATURDAY_LEGS_REASON
  if (weekday(iso) === SATURDAY) {
    const targetKind = buildDay(state, target).strength?.kind ?? null
    if (isLegsSession(targetKind)) return SATURDAY_LEGS_REASON
  }
  return null
}

/** Wat er verplaatst wordt. Kracht en loop verhuizen los van elkaar. */
export type MoveWhat = 'strength' | 'run'

/**
 * Dagen waarheen een sessie verplaatst mag worden. Nooit de vaste rustdag.
 * Staat er op de doeldag al zo'n sessie, dan ruilen de twee van plek.
 * Geblokkeerde dagen komen wél terug, met reden, zodat de UI kan uitleggen waarom.
 *
 * Voor loopsessies gelden geen blokkades: de zaterdagregel gaat over zware
 * beenbelasting vlak voor de duurloop, niet over de loop zelf.
 */
export function moveTargets(state: UserState, iso: string, what: MoveWhat = 'strength'): MoveTarget[] {
  const rest = programFor(state).restWeekday
  const moves = what === 'run' ? state.runMoves : state.moves
  const out: MoveTarget[] = []
  for (let d = 1; d <= 6; d++) {
    const target = shift(iso, d)
    if (weekday(target) === rest) continue
    if (moves[target]) continue // al verplaatst, geen ketens
    const plan = buildDay(state, target)
    const bezet = what === 'run' ? plan.run : plan.strength
    if (bezet?.movedFrom) continue
    out.push({
      date: target,
      swapWith: bezet ? blockName(bezet) : null,
      blocked: what === 'run' ? null : moveBlockReason(state, iso, target),
    })
  }
  return out
}

function blockName(block: RunBlock | StrengthBlock): string {
  if ('naam' in block) return block.naam
  return block.kind === 'long' ? 'Duurloop' : 'Korte loop'
}

function shift(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}
