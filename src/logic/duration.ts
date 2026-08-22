import type { ResolvedSlot } from './select'

/**
 * Hoe lang een krachtsessie gaat duren.
 *
 * De schatting telt drie dingen bij elkaar: het werk zelf (reps × tempo, per kant
 * dubbel), de rust tussen de sets, en het opzoeken en instellen van het apparaat. De
 * getallen hieronder zijn afgestemd op de rusttijden die de sessie zelf voorstelt
 * (`RestTimer`), maar iets krapper: niemand zit de klok helemaal uit.
 *
 * Boven het uur waarschuwt de app en wijst hij aan wat eruit kan. Dat is altijd een
 * accessoire — de kernoefeningen zijn waar de sessie om draait.
 */

/** Tempo van één rep, in seconden. */
export const SECONDS_PER_REP = 3
/** Een set duurt nooit korter of langer dan dit, wat de reps ook zeggen. */
export const MIN_SET_SECONDS = 20
export const MAX_SET_SECONDS = 90
/** Rust tussen twee sets. */
export const REST_CORE_SECONDS = 120
export const REST_ACCESSORY_SECONDS = 75
/** Apparaat opzoeken, instellen, schijven erop. */
export const SETUP_SECONDS = 60

/** Boven deze duur gaat de waarschuwing aan. */
export const MAX_SESSION_MINUTES = 60

function setSeconds(slot: ResolvedSlot): number {
  const reps = Math.max(1, slot.repMax) * (slot.exercise.unilateral ? 2 : 1)
  return Math.min(MAX_SET_SECONDS, Math.max(MIN_SET_SECONDS, reps * SECONDS_PER_REP))
}

/** Geschatte duur van één oefening in seconden, inclusief opbouw en rust. */
export function slotSeconds(slot: ResolvedSlot): number {
  const sets = Math.max(1, slot.sets)
  const rest = slot.slot.role === 'core' ? REST_CORE_SECONDS : REST_ACCESSORY_SECONDS
  return SETUP_SECONDS + sets * setSeconds(slot) + (sets - 1) * rest
}

export function slotMinutes(slot: ResolvedSlot): number {
  return Math.round(slotSeconds(slot) / 60)
}

/** Geschatte duur van de hele sessie in minuten, warming-up meegerekend. */
export function sessionMinutes(slots: ResolvedSlot[], warmupMinutes = 0): number {
  const seconds = slots.reduce((sum, s) => sum + slotSeconds(s), 0)
  return Math.round(seconds / 60) + Math.max(0, Math.round(warmupMinutes))
}

export interface DurationWarning {
  minutes: number
  /** de oefening die eruit kan; null als er alleen kernwerk over is */
  dropKey: string | null
  dropName: string | null
  /** wat de sessie zonder die oefening duurt */
  minutesWithoutDrop: number
  text: string
}

/**
 * Waarschuwing bij een sessie boven het uur, met een concreet voorstel: het zwaarste
 * accessoire eruit. Blijft null zolang de sessie binnen het uur past.
 */
export function durationWarning(
  slots: ResolvedSlot[],
  warmupMinutes = 0,
): DurationWarning | null {
  const minutes = sessionMinutes(slots, warmupMinutes)
  if (minutes <= MAX_SESSION_MINUTES) return null

  const drop = dropCandidate(slots)
  const minutesWithoutDrop = drop
    ? sessionMinutes(
        slots.filter((s) => s.slot.key !== drop.slot.key),
        warmupMinutes,
      )
    : minutes

  const text = drop
    ? `Geschat ${minutes} min — boven het uur. Zonder ${drop.exercise.naam} is het ${minutesWithoutDrop} min.`
    : `Geschat ${minutes} min — boven het uur. Alleen kernoefeningen over; doe minder sets als het te lang wordt.`

  return {
    minutes,
    dropKey: drop?.slot.key ?? null,
    dropName: drop?.exercise.naam ?? null,
    minutesWithoutDrop,
    text,
  }
}

/**
 * Wat eruit kan: het accessoire dat de meeste tijd kost. Bij gelijke tijd het laatste
 * in de sessie, want dat is het werk dat er het minst toe doet.
 */
export function dropCandidate(slots: ResolvedSlot[]): ResolvedSlot | null {
  let best: ResolvedSlot | null = null
  let bestSeconds = -1
  for (const slot of slots) {
    if (slot.slot.role === 'core') continue
    const seconds = slotSeconds(slot)
    if (seconds >= bestSeconds) {
      best = slot
      bestSeconds = seconds
    }
  }
  return best
}
