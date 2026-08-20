import type { Activity, ActivityIntensity, ActivityType, UserState } from '../types'

/**
 * Losse activiteiten staan naast het schema. Ze worden nergens in de progressie- of
 * gewichtsadvieslogica gelezen: die kijkt alleen naar `sessions` (kracht).
 *
 * Eén uitzondering, en die is bewust: een los rondje hardlopen telt wél mee in de
 * weekkilometers (`runningLoad.ts`). Anders zou de +10%-bewaking te omzeilen zijn door
 * je lopen buiten het schema om te loggen, terwijl je pezen niet weten of het in het
 * schema stond.
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

/**
 * Activiteiten waarbij een afstand betekenis heeft. Zwemmen gaat in banen en
 * spinning staat stil, dus die vragen niet om kilometers.
 */
export const DISTANCE_ACTIVITY_TYPES: ActivityType[] = ['hardlopen', 'fietsen', 'wandelen']

export function supportsDistance(type: ActivityType): boolean {
  return DISTANCE_ACTIVITY_TYPES.includes(type)
}

export function activityTypeLabel(type: ActivityType): string {
  return ACTIVITY_TYPES.find((t) => t.id === type)?.label ?? type
}

export function activityIntensityLabel(intensity: ActivityIntensity): string {
  return ACTIVITY_INTENSITIES.find((i) => i.id === intensity)?.label ?? intensity
}

/** Eén regel: "Fietsen 40 min · 12,5 km · rustig". */
export function activitySummary(a: Activity): string {
  const delen = [`${activityTypeLabel(a.type)} ${a.minutes} min`]
  const km = activityKm(a)
  if (km !== null) delen.push(`${fmtNumber(km)} km`)
  delen.push(activityIntensityLabel(a.intensity).toLowerCase())
  return delen.join(' · ')
}

/** De gelogde afstand, of null als er geen bruikbare afstand bij hoort. */
export function activityKm(a: Activity): number | null {
  if (!supportsDistance(a.type)) return null
  const km = a.distanceKm
  return typeof km === 'number' && Number.isFinite(km) && km > 0 ? km : null
}

/** Gemiddeld tempo in min/km, zoals het op een horloge staat: '5:30 min/km'. */
export function paceMinPerKm(km: number, minutes: number): string | null {
  if (km <= 0 || minutes <= 0) return null
  const secPerKm = Math.round((minutes * 60) / km)
  const min = Math.floor(secPerKm / 60)
  const sec = secPerKm % 60
  return `${min}:${String(sec).padStart(2, '0')} min/km`
}

/**
 * Gemiddeld tempo, alleen waar het iets zegt: min/km bij hardlopen en wandelen,
 * km/u bij fietsen. Zonder afstand of zonder tijd valt er niets te rekenen.
 */
export function activityPace(a: Activity): string | null {
  const km = activityKm(a)
  if (km === null || a.minutes <= 0) return null

  if (a.type === 'fietsen') {
    const kmh = (km / a.minutes) * 60
    return `${fmtNumber(Math.round(kmh * 10) / 10)} km/u`
  }

  return paceMinPerKm(km, a.minutes)
}

/** Nederlandse notatie: komma als decimaalteken, geen nullen die niets toevoegen. */
function fmtNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
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
