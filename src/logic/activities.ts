import type { Activity, ActivityIntensity, ActivityType, UserState } from '../types'

/**
 * Losse activiteiten staan naast het schema. Ze worden nergens in de
 * progressie- of gewichtsadvieslogica gelezen: die kijkt alleen naar
 * `sessions` (kracht) en `runs` (loop).
 */

export const ACTIVITY_TYPES: { id: ActivityType; label: string }[] = [
  { id: 'fietsen', label: 'Fietsen' },
  { id: 'wandelen', label: 'Wandelen' },
  { id: 'zwemmen', label: 'Zwemmen' },
  { id: 'hardlopen', label: 'Hardlopen' },
  { id: 'spinning', label: 'Spinning' },
  { id: 'overig', label: 'Overig' },
]

export const ACTIVITY_INTENSITIES: { id: ActivityIntensity; label: string }[] = [
  { id: 'rustig', label: 'Rustig' },
  { id: 'normaal', label: 'Normaal' },
  { id: 'intensief', label: 'Intensief' },
]

export const DEFAULT_ACTIVITY_MINUTES = 30

export function activityTypeLabel(type: ActivityType): string {
  return ACTIVITY_TYPES.find((t) => t.id === type)?.label ?? type
}

export function activityIntensityLabel(intensity: ActivityIntensity): string {
  return ACTIVITY_INTENSITIES.find((i) => i.id === intensity)?.label ?? intensity
}

/** Eén regel: "Fietsen 40 min · rustig". */
export function activitySummary(a: Activity): string {
  return `${activityTypeLabel(a.type)} ${a.minutes} min · ${activityIntensityLabel(a.intensity).toLowerCase()}`
}

/** Activiteiten van één dag, oudst ingevoerd eerst. */
export function activitiesOn(state: UserState, iso: string): Activity[] {
  return state.activities
    .filter((a) => a.date === iso)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Alle activiteiten voor de historie: nieuwste dag eerst. */
export function recentActivities(state: UserState, limit = 30): Activity[] {
  return [...state.activities]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

export function activityCount(state: UserState): number {
  return state.activities.length
}
