import { alternatives } from '../data/exercises'
import type { DayKind, Exercise, SessionLog, UserState } from '../types'
import { addDays } from './dates'
import { deloadFor } from './deload'
import { actualSessionMinutes } from './duration'
import { dayGuardrails } from './guardrails'
import { isTravelSafe, offAreas, type ResolvedSlot } from './select'

/**
 * Wat er gebeurt als een sessie te makkelijk was.
 *
 * Een sessie die als 'makkelijk' beoordeeld is én ruim binnen de tijd bleef, is een
 * sessie die te weinig gevraagd heeft. Er zijn twee antwoorden, en welk van de twee het
 * wordt hangt af van of het één keer of twee keer op rij gebeurde:
 *
 * 1. **Eén keer** — een extra oefening aanbieden, uit dezelfde categorie als de sessie.
 *    Eenmalig, voor deze dag, en hooguit één. Dat is de goedkoopste manier om er wat werk
 *    bij te doen zonder aan het schema te komen.
 * 2. **Twee keer op rij** — geen oefening erbij, maar melden dat het streefgewicht of
 *    het volume omhoog moet, en dat voorstel ook doorvoeren. Twee makkelijke sessies zijn
 *    geen toevallige goede dag; dan staat er structureel te weinig op de stang, en dáár
 *    los je het op — niet met een zevende oefening erachteraan.
 *
 * Het aanbod komt er alleen als de rest van de week er ook naar staat. Een deloadweek is
 * met opzet licht, en een dag met een openstaande waarschuwing (zware benen vlak voor de
 * duurloop, een overschreden weekvolume) is geen dag om werk bij te stapelen. En kreeg de
 * vorige sessie al een extra oefening, dan slaat de app deze over: anders groeit een
 * sessie ongemerkt door zonder dat er ooit een besluit over genomen is.
 */

/** Sleutel van het slot dat de extra oefening krijgt. Er is er hooguit één per dag. */
export function extraSlotKey(kind: DayKind): string {
  return `${kind}:extra`
}

export type EasyBlock =
  | 'niet_afgerond'
  | 'niet_makkelijk'
  | 'geen_starttijd'
  | 'niet_korter'
  | 'deload'
  | 'waarschuwing'
  | 'vorige_had_extra'
  | 'al_een_extra'
  | 'geen_kandidaat'

export interface ExtraOffer {
  kind: 'extra'
  exercise: Exercise
  slotKey: string
  text: string
}

export interface VolumeBump {
  kind: 'bump'
  /** de oefeningen waar het voorstel over gaat, kernwerk eerst */
  exerciseIds: string[]
  text: string
}

export interface NoOffer {
  kind: 'niets'
  reason: EasyBlock
}

export type EasyOutcome = ExtraOffer | VolumeBump | NoOffer

/**
 * Wat de app na deze sessie voorstelt. `niets` met de reden erbij, zodat er in de UI en
 * in een test altijd na te lezen valt waaróm er geen aanbod is.
 */
export function afterEasySession(
  state: UserState,
  iso: string,
  kind: DayKind,
  slots: ResolvedSlot[],
  plannedMinutes: number,
): EasyOutcome {
  const log = state.sessions?.[`${iso}:${kind}`]
  if (!log?.completedAt) return geen('niet_afgerond')
  if (log.feel !== 'makkelijk') return geen('niet_makkelijk')

  const geduurd = actualSessionMinutes(log)
  if (geduurd === null) return geen('geen_starttijd')
  if (geduurd >= plannedMinutes) return geen('niet_korter')

  // twee keer op rij makkelijk gaat over het gewicht, niet over een oefening erbij
  const vorige = previousStrengthLog(state, iso, kind)
  if (vorige?.feel === 'makkelijk') return bump(slots, geduurd, plannedMinutes)

  if (deloadFor(state, iso).active) return geen('deload')
  if (dayGuardrails(state, iso).some((g) => g.tone === 'warn')) return geen('waarschuwing')
  if (vorige?.extra) return geen('vorige_had_extra')
  if (log.extra) return geen('al_een_extra')

  const kandidaat = extraCandidates(state, slots)[0]
  if (!kandidaat) return geen('geen_kandidaat')

  return {
    kind: 'extra',
    exercise: kandidaat,
    slotKey: extraSlotKey(kind),
    text:
      `Deze sessie viel makkelijk en was in ${geduurd} minuten klaar, tegen ${plannedMinutes} gepland. ` +
      `Er kan één oefening bij: ${kandidaat.naam}. Alleen vandaag — morgen staat de sessie er weer zoals hij bedoeld is.`,
  }
}

function geen(reason: EasyBlock): NoOffer {
  return { kind: 'niets', reason }
}

function bump(slots: ResolvedSlot[], geduurd: number, gepland: number): VolumeBump {
  const kern = bumpTargets(slots)
  return {
    kind: 'bump',
    exerciseIds: kern.map((r) => r.exercise.id),
    text:
      `Twee sessies op rij makkelijk — deze duurde ${geduurd} van de ${gepland} geplande minuten. ` +
      'Dan is er geen oefening tekort maar gewicht: het streefgewicht gaat omhoog op ' +
      `${namen(kern.map((r) => r.exercise.naam))}. Lukt dat gewicht deze week niet, dan komen er reps bij.`,
  }
}

/**
 * Waar het streefgewicht omhoog gaat: het kernwerk van de sessie. Daar zit de belasting,
 * en daar is een stap ook echt te laden. Is er geen kernwerk, dan alles wat er staat.
 */
export function bumpTargets(slots: ResolvedSlot[]): ResolvedSlot[] {
  const kern = slots.filter((r) => r.slot.role === 'core')
  return kern.length > 0 ? kern : slots
}

function namen(lijst: string[]): string {
  if (lijst.length <= 1) return lijst[0] ?? 'de oefeningen van deze sessie'
  return `${lijst.slice(0, -1).join(', ')} en ${lijst[lijst.length - 1]}`
}

/** De laatste afgeronde krachtsessie vóór deze, binnen een redelijke terugblik. */
export function previousStrengthLog(
  state: UserState,
  iso: string,
  kind: DayKind,
  days = 14,
): SessionLog | null {
  const eerder = Object.values(state.sessions ?? {})
    .filter((log) => log.completedAt && (log.date < iso || (log.date === iso && log.kind !== kind)))
    .filter((log) => log.date >= addDays(iso, -days))
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1))
  return eerder[0] ?? null
}

/**
 * Wat er als extra oefening bij kan: hetzelfde soort werk als er al in de sessie zit,
 * zonder wat er al in staat, en zonder wat er vanwege een gevoelig gebied of reismodus
 * uit hoort te blijven.
 *
 * De volgorde is licht-eerst. Een oefening die er na afloop bij komt hoort het einde van
 * de sessie te zijn, geen tweede zware kniebuiging op benen die al gedaan hebben.
 */
export function extraCandidates(state: UserState, slots: ResolvedSlot[]): Exercise[] {
  const inSessie = new Set(slots.map((r) => r.exercise.id))
  const off = offAreas(state.settings?.sensitive)
  const travel = state.settings?.travelMode ?? false
  const uit = new Map<string, Exercise>()

  for (const r of slots) {
    for (const kandidaat of alternatives(r.exercise)) {
      if (inSessie.has(kandidaat.id) || uit.has(kandidaat.id)) continue
      if (kandidaat.loads.some((l) => off.includes(l))) continue
      if (travel && !isTravelSafe(kandidaat)) continue
      uit.set(kandidaat.id, kandidaat)
    }
  }

  return [...uit.values()].sort(lichtstEerst)
}

/** Isolatie en romp voor samengesteld werk, aanvullend voor kernwerk, daarna op naam. */
const ZWAARTE: Record<Exercise['orderCategory'], number> = {
  core: 0,
  isolation: 1,
  compound: 2,
  heavy_legs: 3,
}

function lichtstEerst(a: Exercise, b: Exercise): number {
  const rol = (a.role === 'core' ? 1 : 0) - (b.role === 'core' ? 1 : 0)
  if (rol !== 0) return rol
  const zwaarte = ZWAARTE[a.orderCategory] - ZWAARTE[b.orderCategory]
  if (zwaarte !== 0) return zwaarte
  return a.id.localeCompare(b.id)
}
