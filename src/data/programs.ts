import type { DayKind, ProgramId, SessionSlot, SessionTemplate, UserState } from '../types'
import { getExercise } from './exercises'
import { REST_WEEKDAY, TEMPLATES, WEEK, saturdayTemplate, type DaySpec } from './plan'

/**
 * Een programma is alles wat de week van één gebruiker bepaalt: welke dag wat is,
 * welke sjablonen daarbij horen, hoe de loop wordt ingevuld en hoe hard de
 * progressie klimt. Twee gebruikers kunnen dus totaal verschillende schema's
 * volgen zonder dat hun data of berekeningen elkaar raken.
 */
export interface Program {
  id: ProgramId
  naam: string
  omschrijving: string
  week: DaySpec[]
  /** weekdag die altijd leeg blijft (1 = maandag); null = geen vaste rustdag */
  restWeekday: number | null
  /** 'planned' = de app rekent afstanden voor; 'free' = jij bepaalt, de app registreert */
  runMode: 'planned' | 'free'
  /**
   * 'standard' = gewicht omhoog zodra de bovenste rep gehaald is;
   * 'gentle'   = eerst reps opbouwen tot boven de bovengrens, pas dan gewicht erbij.
   */
  pace: 'standard' | 'gentle'
  /** schaalt het geadviseerde startgewicht; < 1 start lichter */
  startScale: number
  templateFor: (kind: DayKind, weekIndex: number) => SessionTemplate | null
}

function slot(
  kind: DayKind,
  i: number,
  exerciseId: string,
  role: 'core' | 'accessory',
  sets: number,
  repMin: number,
  repMax: number,
): SessionSlot {
  getExercise(exerciseId) // faalt hard bij een typefout in de seed
  return { key: `${kind}:${i}`, exerciseId, role, setsReps: { sets, repMin, repMax } }
}

/* ---------------------------------------------------------------------------
 * Full body voor een beginner naast 3x hardlopen.
 *
 * Twee sessies per week, woensdag en zaterdag, elk 45-60 min. De keuze van de
 * oefeningen houdt rekening met het materiaal: de lichtste dumbbell is 12,5 kg,
 * dus het duw- en schouderwerk gaat via kabel, band of lichaamsgewicht. Zo kan
 * er echt licht begonnen worden en klopt de opbouw van onder af.
 * ------------------------------------------------------------------------- */

const FULL_BODY_A: SessionTemplate = {
  id: 'full_body_a',
  naam: 'Full body A',
  duurMin: 50,
  slots: [
    // leg press: kleinste schijf is een prima startpunt, veel lichter dan een stang
    slot('full_body_a', 0, 'leg_press', 'core', 3, 10, 12),
    slot('full_body_a', 1, 'lat_pulldown', 'core', 3, 10, 12),
    // kabel in plaats van dumbbells: de 12,5 kg-dumbbells zijn hier te zwaar om mee te starten
    slot('full_body_a', 2, 'cable_chest_press', 'core', 3, 10, 12),
    slot('full_body_a', 3, 'glute_bridge_bw', 'accessory', 3, 12, 15),
    slot('full_body_a', 4, 'band_hip_abduction_seated', 'accessory', 3, 15, 20),
    slot('full_body_a', 5, 'dead_bug', 'accessory', 3, 10, 10),
  ],
}

const FULL_BODY_B: SessionTemplate = {
  id: 'full_body_b',
  naam: 'Full body B',
  duurMin: 50,
  slots: [
    // smith: de stang alleen weegt al weinig en je kunt hem overal vastzetten
    slot('full_body_b', 0, 'smith_squat', 'core', 3, 8, 10),
    slot('full_body_b', 1, 'cable_row_low', 'core', 3, 10, 12),
    // band voor het bovenhoofdse werk; weerstand loopt vanaf vrijwel niets op
    slot('full_body_b', 2, 'band_ohp', 'core', 3, 10, 12),
    slot('full_body_b', 3, 'cable_pullthrough', 'accessory', 3, 12, 15),
    slot('full_body_b', 4, 'step_up_bw', 'accessory', 3, 10, 10),
    slot('full_body_b', 5, 'standing_calf_bw', 'accessory', 3, 15, 15),
  ],
}

const FULL_BODY_TEMPLATES: Partial<Record<DayKind, SessionTemplate>> = {
  full_body_a: FULL_BODY_A,
  full_body_b: FULL_BODY_B,
}

/**
 * Loopdagen blijven zoals ze al waren: 3x per week, eigen tempo en afstand.
 * De app schrijft daar niets voor en registreert alleen wat er gelopen is.
 */
const FULL_BODY_WEEK: DaySpec[] = [
  { weekday: 1, label: 'Maandag', short: 'ma', run: null, strength: null },
  { weekday: 2, label: 'Dinsdag', short: 'di', run: 'short', strength: null },
  { weekday: 3, label: 'Woensdag', short: 'wo', run: null, strength: 'full_body_a' },
  { weekday: 4, label: 'Donderdag', short: 'do', run: 'short', strength: null },
  { weekday: 5, label: 'Vrijdag', short: 'vr', run: null, strength: null },
  { weekday: 6, label: 'Zaterdag', short: 'za', run: null, strength: 'full_body_b' },
  { weekday: 7, label: 'Zondag', short: 'zo', run: 'long', strength: null },
]

export const PROGRAMS: Record<ProgramId, Program> = {
  kracht_hardlopen: {
    id: 'kracht_hardlopen',
    naam: 'Kracht + hardlopen',
    omschrijving: '4 krachtsessies (benen/duwen/trekken), optionele zaterdag, 3 loopdagen met opbouw.',
    week: WEEK,
    restWeekday: REST_WEEKDAY,
    runMode: 'planned',
    pace: 'standard',
    startScale: 1,
    templateFor: (kind, weekIndex) => {
      if (kind === 'rest') return null
      if (kind === 'optional_upper') return saturdayTemplate(weekIndex)
      return TEMPLATES[kind] ?? null
    },
  },
  fullbody_hardlopen: {
    id: 'fullbody_hardlopen',
    naam: 'Full body + hardlopen',
    omschrijving: '2x full body (woensdag en zaterdag) van 45-60 min, naast 3x hardlopen in eigen tempo.',
    week: FULL_BODY_WEEK,
    restWeekday: 1,
    runMode: 'free',
    pace: 'gentle',
    startScale: 0.7,
    templateFor: (kind) => FULL_BODY_TEMPLATES[kind] ?? null,
  },
}

export function programById(id: ProgramId): Program {
  return PROGRAMS[id] ?? PROGRAMS.kracht_hardlopen
}

export function programFor(user: UserState): Program {
  return programById(user.programId)
}
