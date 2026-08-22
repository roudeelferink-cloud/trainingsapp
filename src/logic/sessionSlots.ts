import { BY_ID } from '../data/exercises'
import { programFor } from '../data/programs'
import type { DayKind, SessionSlot, UserState } from '../types'
import { orderSlots } from './order'
import { isTravelSafe, offAreas, resolveSlot, type ResolvedSlot } from './select'

/**
 * Welke oefeningen er in de sessie van één dag zitten, en met hoeveel sets.
 *
 * Dit is de kern van wat `buildDay` doet, apart gezet omdat er meer dan één laag naar
 * kijkt: de dag zelf bouwt er zijn sessie mee, en de beenbelasting (`legLoad.ts`)
 * scoort er de sessie mee. Die score moet over dezelfde oefeningen gaan als wat er
 * straks op het scherm staat — inclusief de sets die er in een deloadweek af gaan en de
 * oefeningen die bij een lage check-in wegvallen. Anders waarschuwt de app over werk dat
 * je die dag helemaal niet doet.
 */

export interface SessionOptions {
  /** korte versie: alleen kernoefeningen */
  short: boolean
  /** check-in 1-2: een set minder en zwaar kuitwerk eruit */
  lowEnergy: boolean
  /** deloadweek: een set minder */
  deload: boolean
  /** rotatie-index van de oefeningselectie */
  rotation: number
  /** doorlopend weeknummer; de optionele zaterdag heeft per week een andere pool */
  week: number
}

export interface ResolvedSession {
  slots: ResolvedSlot[]
  /** aantal oefeningen vóór het filteren, voor "x accessoires verborgen" */
  before: number
  /** zwaar kuitwerk is weggelaten */
  hiddenCalf: boolean
}

export function resolveSession(
  state: UserState,
  iso: string,
  kind: DayKind,
  opts: SessionOptions,
): ResolvedSession {
  const template = programFor(state).templateFor(kind, opts.week)
  if (!template) return { slots: [], before: 0, hiddenCalf: false }

  const override = state.overrides?.[iso]

  // `taken` loopt mee zodat doorgegroeid bandwerk niet twee keer op dezelfde
  // belaste variant uitkomt binnen één sessie
  const taken = new Set<string>()
  let slots = template.slots.map((s) => {
    const r = resolveSlot(s, state, iso, opts.rotation, taken)
    taken.add(r.exercise.id)
    return r
  })

  const before = slots.length
  if (opts.short) slots = slots.filter((r) => r.slot.role === 'core')

  let hiddenCalf = false
  if (opts.lowEnergy) {
    const kept = slots.filter((r) => !(r.exercise.pattern === 'calf' && r.exercise.unit !== 'bw'))
    hiddenCalf = kept.length < slots.length
    slots = kept
  }

  if (state.settings?.travelMode && slots.length > 5) {
    const core = slots.filter((r) => r.slot.role === 'core')
    const rest = slots.filter((r) => r.slot.role !== 'core')
    slots = [...core, ...rest].slice(0, 5)
  }

  const setDrop = (opts.deload ? 1 : 0) + (opts.lowEnergy ? 1 : 0)
  if (setDrop > 0) slots = slots.map((r) => ({ ...r, sets: Math.max(1, r.sets - setDrop) }))

  slots = slots.filter((r) => !(override?.skippedSlots ?? []).includes(r.slot.key))
  // als laatste: de volgorde staat los van welke oefeningen er overblijven
  slots = orderSlots(slots, override?.order)

  // De extra oefening van een te makkelijke sessie komt er altijd achteraan, ook als er
  // zelf een volgorde gezet is: hij is er als toegift bij, niet als onderdeel van de opzet.
  const extra = extraSlotFor(state, iso, override?.extraSlot, slots)
  if (extra) slots = [...slots, extra]

  return { slots, before, hiddenCalf }
}

/**
 * Het slot van de extra oefening, of null. Bewust met dezelfde filters als de rest: een
 * oefening die vanwege een gevoelig gebied of de reismodus niet meer kan, hoort ook als
 * extra niet meer te verschijnen — ook niet als hij gisteren nog wel kon.
 */
function extraSlotFor(
  state: UserState,
  iso: string,
  extra: { key: string; exerciseId: string } | undefined,
  slots: ResolvedSlot[],
): ResolvedSlot | null {
  if (!extra) return null
  const ex = BY_ID[extra.exerciseId]
  if (!ex) return null
  if (slots.some((r) => r.exercise.id === ex.id)) return null
  if (ex.loads.some((l) => offAreas(state.settings?.sensitive).includes(l))) return null
  if (state.settings?.travelMode && !isTravelSafe(ex)) return null
  if ((state.overrides?.[iso]?.skippedSlots ?? []).includes(extra.key)) return null

  const slot: SessionSlot = {
    key: extra.key,
    exerciseId: ex.id,
    role: 'accessory',
    setsReps: ex.setsReps,
  }
  return {
    slot,
    exercise: ex,
    sets: ex.setsReps.sets,
    repMin: ex.setsReps.repMin,
    repMax: ex.setsReps.repMax,
    reasons: ['extra'],
  }
}
