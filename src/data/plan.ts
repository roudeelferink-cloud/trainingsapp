import type { DayKind, RunKind, SessionSlot, SessionTemplate } from '../types'
import { getExercise } from './exercises'

function slot(kind: DayKind, i: number, exerciseId: string, role: 'core' | 'accessory', sets: number, repMin: number, repMax: number): SessionSlot {
  getExercise(exerciseId) // faalt hard bij typefout in de seed
  return { key: `${kind}:${i}`, exerciseId, role, setsReps: { sets, repMin, repMax } }
}

/**
 * De sjablonen. Een slotsleutel is `${dag}:${index}` en ligt vast: nieuwe oefeningen
 * komen er daarom achteraan bij, zodat gelogde sessies aan hun eigen slot gekoppeld
 * blijven. De volgorde binnen de sessie komt toch uit `orderCategory`, niet hieruit.
 *
 * Beide beensessies hebben glute medius-werk op twee niveaus. Dat sluit aan op de
 * instelling "let op" voor de zijkant van de heup: bandwerk begint per definitie op
 * de lichtste mini-band en klimt alleen op wat je haalt, en pas op de zwaarste band
 * neemt de kabel met enkelmanchet het over — de eerste abductie met echte kilo's.
 */
export const TEMPLATES: Partial<Record<DayKind, SessionTemplate>> = {
  legs_a: {
    id: 'legs_a',
    naam: 'Benen A (zwaar)',
    duurMin: 55,
    slots: [
      slot('legs_a', 0, 'leg_press', 'core', 4, 8, 10),
      // leg press dekt kniedominant al als kern, dus smith squat en leg curl zijn accessoire
      slot('legs_a', 1, 'smith_squat', 'accessory', 3, 8, 10),
      slot('legs_a', 2, 'rdl_trapbar', 'core', 3, 10, 10),
      slot('legs_a', 3, 'leg_curl', 'accessory', 3, 12, 12),
      slot('legs_a', 4, 'standing_calf_smith', 'core', 4, 12, 15),
      // Glute medius, twee lagen: staand bandwerk dat vanzelf doorgroeit naar de
      // kabel met enkelmanchet, plus vloeractivatie op de lichtste mini-band.
      slot('legs_a', 5, 'band_lateral_walk', 'core', 3, 20, 20),
      slot('legs_a', 6, 'clamshell', 'accessory', 3, 15, 20),
    ],
  },
  push: {
    id: 'push',
    naam: 'Duwen',
    duurMin: 30,
    slots: [
      slot('push', 0, 'bench_smith', 'core', 4, 8, 10),
      slot('push', 1, 'db_shoulder_press', 'core', 3, 10, 10),
      slot('push', 2, 'incline_db_press', 'accessory', 3, 10, 10),
      slot('push', 3, 'triceps_pushdown', 'accessory', 3, 12, 12),
      slot('push', 4, 'ab_roller_ex', 'accessory', 3, 10, 10),
    ],
  },
  pull: {
    id: 'pull',
    naam: 'Trekken',
    duurMin: 30,
    slots: [
      slot('pull', 0, 'lat_pulldown', 'core', 4, 10, 10),
      slot('pull', 1, 'cable_row_low', 'core', 3, 10, 10),
      slot('pull', 2, 'face_pull', 'accessory', 3, 15, 15),
      slot('pull', 3, 'curl_bar_curl', 'accessory', 3, 10, 10),
      slot('pull', 4, 'plank', 'accessory', 3, 30, 45),
    ],
  },
  legs_b: {
    id: 'legs_b',
    naam: 'Benen B (eenbenig/isolatie)',
    duurMin: 55,
    slots: [
      slot('legs_b', 0, 'bulgarian_split_squat', 'core', 3, 8, 8),
      slot('legs_b', 1, 'single_leg_press', 'core', 3, 10, 10),
      slot('legs_b', 2, 'hip_thrust_smith', 'core', 4, 10, 10),
      slot('legs_b', 3, 'leg_extension', 'accessory', 3, 12, 12),
      slot('legs_b', 4, 'seated_calf', 'core', 3, 15, 15),
      // zelfde opzet als in Benen A: bandwerk dat doorgroeit, plus vloeractivatie
      slot('legs_b', 5, 'band_hip_abduction_seated', 'core', 3, 20, 20),
      slot('legs_b', 6, 'side_lying_abduction_band', 'accessory', 3, 15, 20),
    ],
  },
}

/** Pool voor de optionele zaterdag: alleen bovenlichaam, geen zware beenbelasting. */
const SATURDAY_POOL: string[][] = [
  ['lat_pulldown_neutral', 'incline_db_press', 'face_pull', 'hammer_curl', 'band_pushdown'],
  ['inverted_row_smith', 'db_shoulder_press', 'straight_arm_pulldown', 'skullcrusher', 'side_plank'],
  ['chest_supported_row', 'flat_db_press', 'lateral_raise_db', 'cable_curl', 'pallof_press'],
  ['pullup', 'floor_press_db', 'band_face_pull', 'overhead_ext_db', 'dead_bug'],
]

export function saturdayTemplate(weekIndex: number): SessionTemplate {
  const ids = SATURDAY_POOL[(weekIndex - 1) % SATURDAY_POOL.length]
  return {
    id: 'optional_upper',
    naam: 'Bovenlichaam (optioneel)',
    duurMin: 35,
    optional: true,
    slots: ids.map((id, i) => {
      const e = getExercise(id)
      return {
        key: `optional_upper:${i}`,
        exerciseId: id,
        role: i < 2 ? ('core' as const) : ('accessory' as const),
        setsReps: e.setsReps,
      }
    }),
  }
}

export function templateFor(kind: DayKind, weekIndex: number): SessionTemplate | null {
  if (kind === 'rest') return null
  if (kind === 'optional_upper') return saturdayTemplate(weekIndex)
  return TEMPLATES[kind] ?? null
}

/** ISO-weekdag 1 = maandag ... 7 = zondag */
export interface DaySpec {
  weekday: number
  label: string
  short: string
  run: RunKind | null
  strength: DayKind | null
  optional?: boolean
}

export const WEEK: DaySpec[] = [
  { weekday: 1, label: 'Maandag', short: 'ma', run: null, strength: 'legs_a' },
  { weekday: 2, label: 'Dinsdag', short: 'di', run: 'short', strength: 'push' },
  { weekday: 3, label: 'Woensdag', short: 'wo', run: null, strength: null },
  { weekday: 4, label: 'Donderdag', short: 'do', run: 'short', strength: 'pull' },
  { weekday: 5, label: 'Vrijdag', short: 'vr', run: null, strength: 'legs_b' },
  { weekday: 6, label: 'Zaterdag', short: 'za', run: null, strength: 'optional_upper', optional: true },
  { weekday: 7, label: 'Zondag', short: 'zo', run: 'long', strength: null },
]

/** Woensdag is hardcoded rustdag. Hier wordt nooit iets gepland. */
export const REST_WEEKDAY = 3

export const DAY_LABEL: Record<DayKind, string> = {
  legs_a: 'Benen A',
  push: 'Duwen',
  pull: 'Trekken',
  legs_b: 'Benen B',
  optional_upper: 'Bovenlichaam (optioneel)',
  full_body_a: 'Full body A',
  full_body_b: 'Full body B',
  rest: 'Rust',
}
