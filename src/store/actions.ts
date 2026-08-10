import { getExercise } from '../data/exercises'
import { supportsDistance } from '../logic/activities'
import { programFor } from '../data/programs'
import { cycleInfo } from '../logic/cycle'
import { buildDay, moveBlockReason, sessionKeyFor } from '../logic/day'
import type { ResolvedSlot } from '../logic/select'
import { applyProgression, stateFor } from '../logic/progression'
import type {
  Activity,
  ActivityIntensity,
  ActivityType,
  BarId,
  DayKind,
  LoggedSet,
  RunKind,
  SkipReason,
  UserState,
} from '../types'
import { getState, setState } from './store'

export function setCheckin(iso: string, value: number): void {
  setState((s) => ({ ...s, checkins: { ...s.checkins, [iso]: value } }))
}

export function clearCheckin(iso: string): void {
  setState((s) => {
    const checkins = { ...s.checkins }
    delete checkins[iso]
    return { ...s, checkins }
  })
}

export function setProtein(iso: string, grams: number): void {
  setState((s) => ({ ...s, protein: { ...s.protein, [iso]: grams } }))
}

export function toggleMaintenance(iso: string, id: string): void {
  setState((s) => {
    const done = s.maintenance[iso] ?? []
    const next = done.includes(id) ? done.filter((x) => x !== id) : [...done, id]
    return { ...s, maintenance: { ...s.maintenance, [iso]: next } }
  })
}

function patchOverride(s: UserState, iso: string, patch: Partial<UserState['overrides'][string]>): UserState {
  return { ...s, overrides: { ...s.overrides, [iso]: { ...(s.overrides[iso] ?? {}), ...patch } } }
}

export function setShortVersion(iso: string, short: boolean): void {
  setState((s) => patchOverride(s, iso, { short }))
}

export function swapOnce(iso: string, slotKey: string, exerciseId: string): void {
  setState((s) => {
    const swaps = { ...(s.overrides[iso]?.swaps ?? {}), [slotKey]: exerciseId }
    return patchOverride(s, iso, { swaps })
  })
}

export function replacePermanently(iso: string, slotKey: string, exerciseId: string): void {
  setState((s) => {
    const swaps = { ...(s.overrides[iso]?.swaps ?? {}) }
    delete swaps[slotKey]
    const next = patchOverride(s, iso, { swaps })
    return { ...next, permanentReplacements: { ...s.permanentReplacements, [slotKey]: exerciseId } }
  })
}

export function undoPermanent(slotKey: string): void {
  setState((s) => {
    const perm = { ...s.permanentReplacements }
    delete perm[slotKey]
    return { ...s, permanentReplacements: perm }
  })
}

export function skipSlot(iso: string, slotKey: string): void {
  setState((s) => {
    const list = s.overrides[iso]?.skippedSlots ?? []
    if (list.includes(slotKey)) return s
    return patchOverride(s, iso, { skippedSlots: [...list, slotKey] })
  })
}

/**
 * Verplaatst een krachtsessie. Staat er op de doeldag al een sessie, dan ruilen ze van plek.
 * Geweigerde verplaatsingen (zoals een beensessie naar zaterdag) veranderen niets.
 */
export function moveSession(iso: string, target: string): { ok: boolean; reason?: string } {
  const reason = moveBlockReason(getState(), iso, target)
  if (reason) return { ok: false, reason }
  setState((s) => {
    const occupied = !!buildDay(s, target).strength
    const moves = { ...s.moves, [iso]: target }
    if (occupied) moves[target] = iso
    return { ...s, moves }
  })
  return { ok: true }
}

export function undoMove(iso: string): void {
  setState((s) => {
    const moves = { ...s.moves }
    const target = moves[iso]
    delete moves[iso]
    if (target && moves[target] === iso) delete moves[target]
    return { ...s, moves }
  })
}

export function skipSession(iso: string, what: 'strength' | 'run', reason: SkipReason): void {
  setState((s) => ({ ...s, skips: { ...s.skips, [`${iso}:${what}`]: { reason, what } } }))
}

export function undoSkip(iso: string, what: 'strength' | 'run'): void {
  setState((s) => {
    const skips = { ...s.skips }
    delete skips[`${iso}:${what}`]
    return { ...s, skips }
  })
}

export function setBike(iso: string, bike: boolean): void {
  setState((s) => patchOverride(s, iso, { bike }))
}

export function completeRun(
  iso: string,
  kind: RunKind,
  data: { plannedKm: number; km: number; minutes: number | null; bike: boolean },
): void {
  setState((s) => ({
    ...s,
    runs: {
      ...s.runs,
      [iso]: { date: iso, kind, ...data, completedAt: new Date().toISOString() },
    },
  }))
}

/* ---- losse activiteiten ---- */

export interface ActivityInput {
  type: ActivityType
  minutes: number
  intensity: ActivityIntensity
  /** alleen zinvol bij hardlopen, fietsen en wandelen; anders (of leeg) null */
  distanceKm?: number | null
  note?: string | null
}

let activitySeq = 0

function activityId(): string {
  activitySeq += 1
  return `act_${Date.now().toString(36)}_${activitySeq.toString(36)}`
}

function cleanNote(note: string | null | undefined): string | null {
  const trimmed = (note ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Afstand hoort alleen bij een activiteit waar kilometers iets betekenen. Bij de
 * rest (zwemmen, spinning, overig) verdwijnt hij, ook als het type later wijzigt.
 */
function cleanDistance(type: ActivityType, km: number | null | undefined): number | null {
  if (!supportsDistance(type)) return null
  if (km === null || km === undefined || !Number.isFinite(km) || km <= 0) return null
  return Math.round(km * 100) / 100
}

/**
 * Logt iets buiten het schema om. Mag op elke dag, ook op een rustdag, ook naast een
 * al afgeronde sessie, en meerdere keren per dag. Raakt de progressie niet aan.
 * Geeft het id terug zodat de UI meteen kan doorschakelen naar bewerken.
 */
export function addActivity(iso: string, input: ActivityInput): string {
  const activity: Activity = {
    id: activityId(),
    date: iso,
    type: input.type,
    minutes: Math.max(1, Math.round(input.minutes)),
    distanceKm: cleanDistance(input.type, input.distanceKm),
    intensity: input.intensity,
    note: cleanNote(input.note),
    createdAt: new Date().toISOString(),
  }
  setState((s) => ({ ...s, activities: [...s.activities, activity] }))
  return activity.id
}

/** Bewerkt een gelogde activiteit. De datum mag mee veranderen. */
export function updateActivity(
  id: string,
  patch: Partial<ActivityInput> & { date?: string },
): void {
  setState((s) => ({
    ...s,
    activities: s.activities.map((a) => {
      if (a.id !== id) return a
      const type = patch.type ?? a.type
      return {
        ...a,
        ...patch,
        type,
        minutes: patch.minutes === undefined ? a.minutes : Math.max(1, Math.round(patch.minutes)),
        // het type kan mee veranderen, dus de afstand wordt altijd opnieuw gewogen
        distanceKm: cleanDistance(type, patch.distanceKm === undefined ? a.distanceKm : patch.distanceKm),
        note: patch.note === undefined ? a.note : cleanNote(patch.note),
      }
    }),
  }))
}

export function removeActivity(id: string): void {
  setState((s) => ({ ...s, activities: s.activities.filter((a) => a.id !== id) }))
}

export function saveSessionDraft(
  iso: string,
  kind: DayKind,
  entries: Record<string, LoggedSet[]>,
  exercises: Record<string, string>,
  short: boolean,
  completedSlots: string[] = [],
): void {
  const key = sessionKeyFor(iso, kind)
  setState((s) => ({
    ...s,
    sessions: {
      ...s.sessions,
      [key]: {
        date: iso,
        kind,
        short,
        entries,
        exercises,
        skippedSlots: s.overrides[iso]?.skippedSlots ?? [],
        completedSlots,
        completedAt: s.sessions[key]?.completedAt ?? null,
      },
    },
  }))
}

/**
 * Sluit de sessie af en laat de progressielogica de streefwaarden bijwerken.
 * Alleen afgevinkte sets tellen mee: voorgevulde maar niet-gedane sets worden
 * niet opgeslagen en sturen de progressie niet.
 */
export function completeSession(
  iso: string,
  kind: DayKind,
  slots: ResolvedSlot[],
  entries: Record<string, LoggedSet[]>,
  short: boolean,
  completedSlots: string[] = [],
): string[] {
  const messages: string[] = []
  const doneOnly = Object.fromEntries(
    slots.map((r) => [r.slot.key, (entries[r.slot.key] ?? []).filter((x) => x.done && x.reps > 0)]),
  )
  setState((s) => {
    const info = cycleInfo(s.startDate, iso)
    const checkin = s.checkins[iso]
    const pace = programFor(s).pace
    const allowIncrease = !info.calibration && !info.deload && checkin !== 3
    const exerciseState = { ...s.exerciseState }

    for (const r of slots) {
      const sets = doneOnly[r.slot.key]
      if (sets.length === 0) continue
      const ex = getExercise(r.exercise.id)
      const res = applyProgression(
        ex,
        { repMin: r.repMin, repMax: r.repMax },
        sets,
        stateFor({ ...s, exerciseState }, ex.id),
        { allowIncrease, pace },
      )
      exerciseState[ex.id] = res.next
      if (res.message) messages.push(res.message)
    }

    const key = sessionKeyFor(iso, kind)
    const notices = [...s.notices, ...messages.map((text) => ({ date: iso, text }))].slice(-50)

    return {
      ...s,
      exerciseState,
      notices,
      sessions: {
        ...s.sessions,
        [key]: {
          date: iso,
          kind,
          short,
          entries: doneOnly,
          exercises: Object.fromEntries(slots.map((r) => [r.slot.key, r.exercise.id])),
          skippedSlots: s.overrides[iso]?.skippedSlots ?? [],
          completedSlots,
          completedAt: new Date().toISOString(),
        },
      },
    }
  })
  return messages
}

export function reopenSession(iso: string, kind: DayKind): void {
  const key = sessionKeyFor(iso, kind)
  setState((s) => {
    const cur = s.sessions[key]
    if (!cur) return s
    return { ...s, sessions: { ...s.sessions, [key]: { ...cur, completedAt: null } } }
  })
}

/* ---- instellingen ---- */

export function setBodyweight(kg: number | null): void {
  setState((s) => ({ ...s, settings: { ...s.settings, bodyweightKg: kg } }))
}

export function setSensitivity(area: keyof UserState['settings']['sensitive'], value: 'ok' | 'careful' | 'off'): void {
  setState((s) => ({
    ...s,
    settings: { ...s.settings, sensitive: { ...s.settings.sensitive, [area]: value } },
  }))
}

/**
 * Eigen gewicht van een stang. 0 of minder wordt geweigerd: een stang zonder
 * gewicht bestaat niet en zou het getoonde totaal stilletjes fout maken.
 */
export function setBarWeight(bar: BarId, kg: number): void {
  if (!Number.isFinite(kg) || kg <= 0) return
  setState((s) => ({
    ...s,
    settings: {
      ...s.settings,
      barWeights: { ...s.settings.barWeights, [bar]: Math.round(kg * 100) / 100 },
    },
  }))
}

export function setTravelMode(on: boolean): void {
  setState((s) => ({ ...s, settings: { ...s.settings, travelMode: on } }))
}

export function addMaintenanceItem(label: string): void {
  setState((s) => ({
    ...s,
    settings: {
      ...s.settings,
      maintenanceItems: [
        ...s.settings.maintenanceItems,
        { id: `m${Date.now().toString(36)}`, label },
      ],
    },
  }))
}

export function removeMaintenanceItem(id: string): void {
  setState((s) => ({
    ...s,
    settings: { ...s.settings, maintenanceItems: s.settings.maintenanceItems.filter((m) => m.id !== id) },
  }))
}
