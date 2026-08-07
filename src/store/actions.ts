import { getExercise } from '../data/exercises'
import { cycleInfo } from '../logic/cycle'
import { buildDay, moveBlockReason, sessionKeyFor } from '../logic/day'
import type { ResolvedSlot } from '../logic/select'
import { applyProgression, stateFor } from '../logic/progression'
import type { AppState, DayKind, LoggedSet, RunKind, SkipReason } from '../types'
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

function patchOverride(s: AppState, iso: string, patch: Partial<AppState['overrides'][string]>): AppState {
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

export function saveSessionDraft(
  iso: string,
  kind: DayKind,
  entries: Record<string, LoggedSet[]>,
  exercises: Record<string, string>,
  short: boolean,
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
        completedAt: s.sessions[key]?.completedAt ?? null,
      },
    },
  }))
}

/** Sluit de sessie af en laat de progressielogica de streefwaarden bijwerken. */
export function completeSession(
  iso: string,
  kind: DayKind,
  slots: ResolvedSlot[],
  entries: Record<string, LoggedSet[]>,
  short: boolean,
): string[] {
  const messages: string[] = []
  setState((s) => {
    const info = cycleInfo(s.startDate, iso)
    const checkin = s.checkins[iso]
    const allowIncrease = !info.calibration && !info.deload && checkin !== 3
    const exerciseState = { ...s.exerciseState }

    for (const r of slots) {
      const sets = (entries[r.slot.key] ?? []).filter((x) => x.reps > 0)
      if (sets.length === 0) continue
      const ex = getExercise(r.exercise.id)
      const res = applyProgression(
        ex,
        { repMin: r.repMin, repMax: r.repMax },
        sets,
        stateFor({ ...s, exerciseState }, ex.id),
        { allowIncrease },
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
          entries,
          exercises: Object.fromEntries(slots.map((r) => [r.slot.key, r.exercise.id])),
          skippedSlots: s.overrides[iso]?.skippedSlots ?? [],
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

export function setSensitivity(area: keyof AppState['settings']['sensitive'], value: 'ok' | 'careful' | 'off'): void {
  setState((s) => ({
    ...s,
    settings: { ...s.settings, sensitive: { ...s.settings.sensitive, [area]: value } },
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
