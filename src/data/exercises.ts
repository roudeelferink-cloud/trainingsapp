import type { Coaching, Exercise, LoadArea, Pattern } from '../types'
import { COACHING } from './coaching'
import { FIGURES } from './figures'
import { START_WEIGHTS } from './startWeights'

/** Velden die per oefening in aparte bestanden staan en hier worden samengevoegd. */
type Derived = 'coaching' | 'hasFigure' | 'startFactor' | 'relatedRatio'
type Defaulted = 'setsReps' | 'bodyweightAlternative' | 'minIncrement' | 'progression' | 'role'

type Def = Omit<Exercise, Defaulted | Derived> & Partial<Pick<Exercise, Defaulted>>

const MISSING: Coaching = { setup: '', execution: [], mistake: '' }

function ex(d: Def): Exercise {
  return {
    role: 'accessory',
    progression: 'weight',
    minIncrement: 1.25,
    setsReps: { sets: 3, repMin: 8, repMax: 12 },
    bodyweightAlternative: d.id,
    ...d,
    // uitleg, poppetje en startgewicht staan per oefening in eigen bestanden
    coaching: COACHING[d.id] ?? MISSING,
    hasFigure: d.id in FIGURES,
    startFactor: START_WEIGHTS[d.id]?.startFactor ?? 0,
    relatedRatio: START_WEIGHTS[d.id]?.relatedRatio,
  }
}

const L = (...a: LoadArea[]) => a

/**
 * Bibliotheek. Alles is uitvoerbaar met het aanwezige materiaal.
 * Minimaal 6 oefeningen per pattern, zodat wisselen altijd kan.
 */
export const EXERCISES: Exercise[] = [
  /* ---------------- knee_dominant ---------------- */
  ex({
    id: 'leg_press', naam: 'Leg press', pattern: 'knee_dominant', group: 'quad',
    orderCategory: 'heavy_legs',
    equipment: ['leg_press', 'plates'], role: 'core', loads: L('knee_deep'),
    setsReps: { sets: 4, repMin: 8, repMax: 10 }, bodyweightAlternative: 'squat_bw',
    cue: 'Voeten middenhoog, knieën volgen tenen.',
  }),
  ex({
    id: 'smith_squat', naam: 'Smith squat', pattern: 'knee_dominant', group: 'quad',
    orderCategory: 'heavy_legs',
    equipment: ['smith', 'plates'], role: 'core', loads: L('knee_deep', 'lower_back'),
    setsReps: { sets: 3, repMin: 8, repMax: 10 }, bodyweightAlternative: 'squat_bw',
  }),
  ex({
    id: 'smith_front_squat', naam: 'Front squat (smith)', pattern: 'knee_dominant', group: 'quad',
    orderCategory: 'heavy_legs',
    equipment: ['smith', 'plates'], role: 'core', loads: L('knee_deep'),
    setsReps: { sets: 3, repMin: 6, repMax: 8 }, bodyweightAlternative: 'squat_bw',
  }),
  ex({
    id: 'hack_squat_smith', naam: 'Hack squat (smith)', pattern: 'knee_dominant', group: 'quad',
    orderCategory: 'heavy_legs',
    equipment: ['smith', 'plates'], role: 'core', loads: L('knee_deep'),
    setsReps: { sets: 3, repMin: 8, repMax: 12 }, bodyweightAlternative: 'squat_bw',
  }),
  ex({
    id: 'goblet_squat_kb', naam: 'Goblet squat (kettlebell)', pattern: 'knee_dominant', group: 'quad',
    orderCategory: 'heavy_legs',
    equipment: ['kettlebell'], role: 'core', progression: 'reps', minIncrement: 4,
    loads: L('knee_deep'), setsReps: { sets: 3, repMin: 10, repMax: 15 },
    bodyweightAlternative: 'squat_bw',
  }),
  ex({
    id: 'sandbag_squat', naam: 'Schouderzak squat', pattern: 'knee_dominant', group: 'quad',
    orderCategory: 'heavy_legs',
    equipment: ['sandbag'], role: 'core', progression: 'reps', minIncrement: 5,
    loads: L('knee_deep'), setsReps: { sets: 3, repMin: 10, repMax: 15 },
    bodyweightAlternative: 'squat_bw',
  }),
  ex({
    id: 'leg_extension', naam: 'Leg extension', pattern: 'knee_dominant', group: 'quad',
    orderCategory: 'isolation',
    equipment: ['leg_ext_curl', 'plates'], loads: L('knee_deep'),
    setsReps: { sets: 3, repMin: 10, repMax: 15 }, bodyweightAlternative: 'squat_bw',
  }),
  ex({
    id: 'squat_bw', naam: 'Squat (lichaamsgewicht)', pattern: 'knee_dominant', group: 'quad',
    orderCategory: 'heavy_legs',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L('knee_deep'), setsReps: { sets: 3, repMin: 15, repMax: 25 },
  }),
  ex({
    id: 'wall_sit', naam: 'Wall sit', pattern: 'knee_dominant', group: 'quad',
    orderCategory: 'isolation',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L(), setsReps: { sets: 3, repMin: 30, repMax: 60 },
    cue: 'Reps = seconden.',
  }),

  /* ---------------- hip_dominant ---------------- */
  ex({
    id: 'rdl_trapbar', naam: 'Romanian deadlift (trap bar)', pattern: 'hip_dominant', group: 'ham',
    orderCategory: 'heavy_legs',
    equipment: ['trap_bar', 'plates'], role: 'core', loads: L('hip_deep', 'lower_back'),
    setsReps: { sets: 3, repMin: 8, repMax: 10 }, bodyweightAlternative: 'glute_bridge_bw',
    cue: 'Heupen naar achteren, rug neutraal.',
  }),
  ex({
    id: 'rdl_barbell', naam: 'Romanian deadlift (stang)', pattern: 'hip_dominant', group: 'ham',
    orderCategory: 'heavy_legs',
    equipment: ['deadlift_bar', 'plates'], role: 'core', loads: L('hip_deep', 'lower_back'),
    setsReps: { sets: 3, repMin: 8, repMax: 10 }, bodyweightAlternative: 'glute_bridge_bw',
  }),
  ex({
    id: 'leg_curl', naam: 'Leg curl', pattern: 'hip_dominant', group: 'ham',
    orderCategory: 'isolation',
    equipment: ['leg_ext_curl', 'plates'], role: 'core', loads: L(),
    setsReps: { sets: 3, repMin: 10, repMax: 12 }, bodyweightAlternative: 'nordic_curl_band',
  }),
  ex({
    id: 'hip_thrust_smith', naam: 'Hip thrust (smith)', pattern: 'hip_dominant', group: 'ham',
    orderCategory: 'heavy_legs',
    equipment: ['smith', 'bench', 'plates'], role: 'core', loads: L('hip_deep'),
    setsReps: { sets: 4, repMin: 8, repMax: 10 }, bodyweightAlternative: 'glute_bridge_bw',
  }),
  ex({
    id: 'good_morning_smith', naam: 'Good morning (smith)', pattern: 'hip_dominant', group: 'ham',
    orderCategory: 'heavy_legs',
    equipment: ['smith', 'plates'], loads: L('hip_deep', 'lower_back'),
    setsReps: { sets: 3, repMin: 10, repMax: 12 }, bodyweightAlternative: 'glute_bridge_bw',
  }),
  ex({
    id: 'kb_swing', naam: 'Kettlebell swing', pattern: 'hip_dominant', group: 'ham',
    orderCategory: 'heavy_legs',
    equipment: ['kettlebell'], progression: 'reps', minIncrement: 4, loads: L('lower_back'),
    setsReps: { sets: 4, repMin: 12, repMax: 20 }, bodyweightAlternative: 'glute_bridge_bw',
  }),
  ex({
    id: 'cable_pullthrough', naam: 'Kabel pull-through', pattern: 'hip_dominant', group: 'ham',
    orderCategory: 'heavy_legs',
    equipment: ['low_cable'], role: 'core', loads: L('hip_deep'),
    setsReps: { sets: 3, repMin: 12, repMax: 15 }, bodyweightAlternative: 'glute_bridge_bw',
  }),
  ex({
    id: 'nordic_curl_band', naam: 'Nordic curl met band', pattern: 'hip_dominant', group: 'ham',
    orderCategory: 'isolation',
    equipment: ['band', 'bodyweight'], progression: 'reps', minIncrement: 0, unit: 'band',
    loads: L(), setsReps: { sets: 3, repMin: 5, repMax: 10 },
  }),
  ex({
    id: 'glute_bridge_bw', naam: 'Glute bridge (lichaamsgewicht)', pattern: 'hip_dominant', group: 'ham',
    orderCategory: 'isolation',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L(), setsReps: { sets: 3, repMin: 15, repMax: 25 },
  }),

  /* ---------------- push_horizontal ---------------- */
  ex({
    id: 'bench_smith', naam: 'Bankdrukken smith', pattern: 'push_horizontal',
    orderCategory: 'compound',
    equipment: ['smith', 'bench', 'plates'], role: 'core', loads: L('shoulder'),
    setsReps: { sets: 4, repMin: 8, repMax: 10 }, bodyweightAlternative: 'pushup',
  }),
  ex({
    id: 'incline_db_press', naam: 'Incline dumbbell press', pattern: 'push_horizontal',
    orderCategory: 'compound',
    equipment: ['dumbbells', 'bench'], progression: 'reps', minIncrement: 2.5,
    loads: L('shoulder'), setsReps: { sets: 3, repMin: 8, repMax: 12 },
    bodyweightAlternative: 'pushup_decline',
  }),
  ex({
    id: 'flat_db_press', naam: 'Bankdrukken dumbbell', pattern: 'push_horizontal',
    orderCategory: 'compound',
    equipment: ['dumbbells', 'bench'], role: 'core', progression: 'reps', minIncrement: 2.5,
    loads: L('shoulder'), setsReps: { sets: 3, repMin: 8, repMax: 12 },
    bodyweightAlternative: 'pushup',
  }),
  ex({
    id: 'floor_press_db', naam: 'Floor press (dumbbell)', pattern: 'push_horizontal',
    orderCategory: 'compound',
    equipment: ['dumbbells'], progression: 'reps', minIncrement: 2.5, loads: L(),
    setsReps: { sets: 3, repMin: 8, repMax: 12 }, bodyweightAlternative: 'pushup',
    cue: 'Schouderveilig: elleboog stopt op de vloer.',
  }),
  ex({
    id: 'cable_chest_press', naam: 'Kabel chest press', pattern: 'push_horizontal',
    orderCategory: 'compound',
    equipment: ['low_cable'], loads: L(), setsReps: { sets: 3, repMin: 10, repMax: 15 },
    bodyweightAlternative: 'band_chest_press',
  }),
  ex({
    id: 'pushup', naam: 'Push-up', pattern: 'push_horizontal',
    orderCategory: 'compound',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L(), setsReps: { sets: 3, repMin: 10, repMax: 25 },
  }),
  ex({
    id: 'pushup_decline', naam: 'Push-up voeten hoog', pattern: 'push_horizontal',
    orderCategory: 'compound',
    equipment: ['bodyweight', 'bench'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L('shoulder'), setsReps: { sets: 3, repMin: 8, repMax: 20 },
  }),
  ex({
    id: 'band_chest_press', naam: 'Bandpers', pattern: 'push_horizontal',
    orderCategory: 'compound',
    equipment: ['band'], progression: 'reps', minIncrement: 0, unit: 'band',
    loads: L(), setsReps: { sets: 3, repMin: 12, repMax: 20 },
  }),
  // triceps (zelfde pattern, eigen groep)
  ex({
    id: 'triceps_pushdown', naam: 'Triceps pushdown (kabel)', pattern: 'push_horizontal', group: 'triceps',
    orderCategory: 'isolation',
    equipment: ['lat_tower'], loads: L(), setsReps: { sets: 3, repMin: 10, repMax: 15 },
    bodyweightAlternative: 'band_pushdown',
  }),
  ex({
    id: 'skullcrusher', naam: 'Skullcrusher (curlstang)', pattern: 'push_horizontal', group: 'triceps',
    orderCategory: 'isolation',
    equipment: ['curl_bar', 'bench', 'plates'], loads: L(),
    setsReps: { sets: 3, repMin: 10, repMax: 12 }, bodyweightAlternative: 'band_pushdown',
  }),
  ex({
    id: 'overhead_ext_db', naam: 'Overhead triceps extensie (dumbbell)', pattern: 'push_horizontal', group: 'triceps',
    orderCategory: 'isolation',
    equipment: ['dumbbells'], progression: 'reps', minIncrement: 2.5, loads: L('shoulder'),
    setsReps: { sets: 3, repMin: 10, repMax: 15 }, bodyweightAlternative: 'band_pushdown',
  }),
  ex({
    id: 'close_grip_smith', naam: 'Close grip bankdrukken (smith)', pattern: 'push_horizontal', group: 'triceps',
    orderCategory: 'compound',
    equipment: ['smith', 'bench', 'plates'], loads: L('shoulder'),
    setsReps: { sets: 3, repMin: 8, repMax: 12 }, bodyweightAlternative: 'bench_dip',
  }),
  ex({
    id: 'bench_dip', naam: 'Bankdip', pattern: 'push_horizontal', group: 'triceps',
    orderCategory: 'isolation',
    equipment: ['bench', 'bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L('shoulder'), setsReps: { sets: 3, repMin: 10, repMax: 20 },
  }),
  ex({
    id: 'band_pushdown', naam: 'Triceps pushdown (band)', pattern: 'push_horizontal', group: 'triceps',
    orderCategory: 'isolation',
    equipment: ['band'], progression: 'reps', minIncrement: 0, unit: 'band',
    loads: L(), setsReps: { sets: 3, repMin: 12, repMax: 20 },
  }),

  /* ---------------- push_vertical ---------------- */
  ex({
    id: 'db_shoulder_press', naam: 'Schouderdrukken dumbbell', pattern: 'push_vertical',
    orderCategory: 'compound',
    equipment: ['dumbbells', 'bench'], role: 'core', progression: 'reps', minIncrement: 2.5,
    loads: L('shoulder'), setsReps: { sets: 3, repMin: 8, repMax: 12 },
    bodyweightAlternative: 'pike_pushup',
  }),
  ex({
    id: 'smith_ohp', naam: 'Overhead press (smith)', pattern: 'push_vertical',
    orderCategory: 'compound',
    equipment: ['smith', 'plates'], role: 'core', loads: L('shoulder', 'lower_back'),
    setsReps: { sets: 3, repMin: 6, repMax: 10 }, bodyweightAlternative: 'pike_pushup',
  }),
  ex({
    id: 'kb_press', naam: 'Kettlebell press', pattern: 'push_vertical',
    orderCategory: 'compound',
    equipment: ['kettlebell'], progression: 'reps', minIncrement: 4, loads: L('shoulder'),
    setsReps: { sets: 3, repMin: 8, repMax: 12 }, bodyweightAlternative: 'pike_pushup',
  }),
  ex({
    id: 'sandbag_press', naam: 'Schouderzak press', pattern: 'push_vertical',
    orderCategory: 'compound',
    equipment: ['sandbag'], progression: 'reps', minIncrement: 5, loads: L('shoulder'),
    setsReps: { sets: 3, repMin: 10, repMax: 15 }, bodyweightAlternative: 'pike_pushup',
  }),
  ex({
    id: 'lateral_raise_db', naam: 'Laterale raise (dumbbell)', pattern: 'push_vertical', group: 'delts',
    orderCategory: 'isolation',
    equipment: ['dumbbells'], progression: 'reps', minIncrement: 2.5, loads: L(),
    setsReps: { sets: 3, repMin: 12, repMax: 20 }, bodyweightAlternative: 'band_lateral_raise',
  }),
  ex({
    id: 'band_lateral_raise', naam: 'Laterale raise (band)', pattern: 'push_vertical', group: 'delts',
    orderCategory: 'isolation',
    equipment: ['band'], progression: 'reps', minIncrement: 0, unit: 'band', loads: L(),
    setsReps: { sets: 3, repMin: 15, repMax: 25 },
  }),
  ex({
    id: 'pike_pushup', naam: 'Pike push-up', pattern: 'push_vertical',
    orderCategory: 'compound',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L('shoulder'), setsReps: { sets: 3, repMin: 8, repMax: 15 },
  }),
  ex({
    id: 'band_ohp', naam: 'Overhead press (band)', pattern: 'push_vertical',
    orderCategory: 'compound',
    equipment: ['band'], progression: 'reps', minIncrement: 0, unit: 'band', loads: L(),
    setsReps: { sets: 3, repMin: 12, repMax: 20 },
  }),

  /* ---------------- pull_horizontal ---------------- */
  ex({
    id: 'cable_row_low', naam: 'Kabelroeien laag', pattern: 'pull_horizontal',
    orderCategory: 'compound',
    equipment: ['low_cable'], role: 'core', loads: L(),
    setsReps: { sets: 3, repMin: 8, repMax: 12 }, bodyweightAlternative: 'band_row',
  }),
  ex({
    id: 'bb_row', naam: 'Bent-over roeien (stang)', pattern: 'pull_horizontal',
    orderCategory: 'compound',
    equipment: ['barbell', 'plates'], role: 'core', loads: L('lower_back'),
    setsReps: { sets: 3, repMin: 8, repMax: 10 }, bodyweightAlternative: 'band_row',
  }),
  ex({
    id: 'db_row_1arm', naam: 'Eenarmig dumbbell roeien', pattern: 'pull_horizontal',
    orderCategory: 'compound',
    equipment: ['dumbbells', 'bench'], role: 'core', progression: 'reps', minIncrement: 2.5,
    perSide: true, loads: L(), setsReps: { sets: 3, repMin: 8, repMax: 12 },
    bodyweightAlternative: 'band_row',
  }),
  ex({
    id: 'chest_supported_row', naam: 'Borstondersteund roeien (bank)', pattern: 'pull_horizontal',
    orderCategory: 'compound',
    equipment: ['dumbbells', 'bench'], progression: 'reps', minIncrement: 2.5, loads: L(),
    setsReps: { sets: 3, repMin: 10, repMax: 15 }, bodyweightAlternative: 'band_row',
  }),
  ex({
    id: 'inverted_row_smith', naam: 'Inverted row (smith)', pattern: 'pull_horizontal',
    orderCategory: 'compound',
    equipment: ['smith', 'bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L(), setsReps: { sets: 3, repMin: 8, repMax: 15 }, bodyweightAlternative: 'band_row',
  }),
  ex({
    id: 'face_pull', naam: 'Face pull', pattern: 'pull_horizontal',
    orderCategory: 'isolation',
    equipment: ['lat_tower', 'low_cable'], loads: L(),
    setsReps: { sets: 3, repMin: 12, repMax: 20 }, bodyweightAlternative: 'band_face_pull',
  }),
  ex({
    id: 'band_face_pull', naam: 'Face pull (band)', pattern: 'pull_horizontal',
    orderCategory: 'isolation',
    equipment: ['band'], progression: 'reps', minIncrement: 0, unit: 'band', loads: L(),
    setsReps: { sets: 3, repMin: 15, repMax: 25 },
  }),
  ex({
    id: 'band_row', naam: 'Roeien met band', pattern: 'pull_horizontal',
    orderCategory: 'compound',
    equipment: ['band'], progression: 'reps', minIncrement: 0, unit: 'band', loads: L(),
    setsReps: { sets: 3, repMin: 12, repMax: 20 },
  }),
  // biceps
  ex({
    id: 'curl_bar_curl', naam: 'Biceps curl (curlstang)', pattern: 'pull_horizontal', group: 'biceps',
    orderCategory: 'isolation',
    equipment: ['curl_bar', 'plates'], loads: L(),
    setsReps: { sets: 3, repMin: 8, repMax: 12 }, bodyweightAlternative: 'band_curl',
  }),
  ex({
    id: 'db_curl', naam: 'Biceps curl (dumbbell)', pattern: 'pull_horizontal', group: 'biceps',
    orderCategory: 'isolation',
    equipment: ['dumbbells'], progression: 'reps', minIncrement: 2.5, loads: L(),
    setsReps: { sets: 3, repMin: 8, repMax: 12 }, bodyweightAlternative: 'band_curl',
  }),
  ex({
    id: 'hammer_curl', naam: 'Hamercurl (dumbbell)', pattern: 'pull_horizontal', group: 'biceps',
    orderCategory: 'isolation',
    equipment: ['dumbbells'], progression: 'reps', minIncrement: 2.5, loads: L(),
    setsReps: { sets: 3, repMin: 10, repMax: 15 }, bodyweightAlternative: 'band_curl',
  }),
  ex({
    id: 'cable_curl', naam: 'Biceps curl (lage kabel)', pattern: 'pull_horizontal', group: 'biceps',
    orderCategory: 'isolation',
    equipment: ['low_cable'], loads: L(), setsReps: { sets: 3, repMin: 10, repMax: 15 },
    bodyweightAlternative: 'band_curl',
  }),
  ex({
    id: 'kb_curl', naam: 'Biceps curl (kettlebell)', pattern: 'pull_horizontal', group: 'biceps',
    orderCategory: 'isolation',
    equipment: ['kettlebell'], progression: 'reps', minIncrement: 4, loads: L(),
    setsReps: { sets: 3, repMin: 10, repMax: 15 }, bodyweightAlternative: 'band_curl',
  }),
  ex({
    id: 'band_curl', naam: 'Biceps curl (band)', pattern: 'pull_horizontal', group: 'biceps',
    orderCategory: 'isolation',
    equipment: ['band'], progression: 'reps', minIncrement: 0, unit: 'band', loads: L(),
    setsReps: { sets: 3, repMin: 15, repMax: 25 },
  }),

  /* ---------------- pull_vertical ---------------- */
  ex({
    id: 'lat_pulldown', naam: 'Lat pulldown', pattern: 'pull_vertical',
    orderCategory: 'compound',
    equipment: ['lat_tower'], role: 'core', loads: L(),
    setsReps: { sets: 4, repMin: 8, repMax: 12 }, bodyweightAlternative: 'band_pulldown',
  }),
  ex({
    id: 'lat_pulldown_neutral', naam: 'Lat pulldown neutrale greep', pattern: 'pull_vertical',
    orderCategory: 'compound',
    equipment: ['lat_tower'], role: 'core', loads: L(),
    setsReps: { sets: 4, repMin: 8, repMax: 12 }, bodyweightAlternative: 'band_pulldown',
  }),
  ex({
    id: 'pullup', naam: 'Optrekken', pattern: 'pull_vertical',
    orderCategory: 'compound',
    equipment: ['pullup_bar', 'bodyweight'], role: 'core', progression: 'reps', minIncrement: 0,
    unit: 'bw', loads: L('shoulder'), setsReps: { sets: 4, repMin: 4, repMax: 10 },
    bodyweightAlternative: 'pullup',
  }),
  ex({
    id: 'chinup', naam: 'Chin-up', pattern: 'pull_vertical',
    orderCategory: 'compound',
    equipment: ['pullup_bar', 'bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L('shoulder'), setsReps: { sets: 3, repMin: 4, repMax: 10 },
    bodyweightAlternative: 'chinup',
  }),
  ex({
    id: 'negative_pullup', naam: 'Negatieve optrekken', pattern: 'pull_vertical',
    orderCategory: 'compound',
    equipment: ['pullup_bar', 'bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L(), setsReps: { sets: 3, repMin: 4, repMax: 8 }, bodyweightAlternative: 'negative_pullup',
  }),
  ex({
    id: 'straight_arm_pulldown', naam: 'Straight-arm pulldown', pattern: 'pull_vertical',
    orderCategory: 'isolation',
    equipment: ['lat_tower'], loads: L('shoulder'),
    setsReps: { sets: 3, repMin: 12, repMax: 15 }, bodyweightAlternative: 'band_pulldown',
  }),
  ex({
    id: 'band_pulldown', naam: 'Pulldown met band', pattern: 'pull_vertical',
    orderCategory: 'compound',
    equipment: ['band'], progression: 'reps', minIncrement: 0, unit: 'band', loads: L(),
    setsReps: { sets: 3, repMin: 15, repMax: 25 },
  }),

  /* ---------------- calf ---------------- */
  ex({
    id: 'standing_calf_smith', naam: 'Staande kuitheffing (smith)', pattern: 'calf',
    orderCategory: 'isolation',
    equipment: ['smith', 'plates'], role: 'core', loads: L('achilles', 'calf'),
    setsReps: { sets: 4, repMin: 12, repMax: 15 }, bodyweightAlternative: 'standing_calf_bw',
    cue: 'Volledige rek onderin, 1 sec knijpen boven.',
  }),
  ex({
    id: 'seated_calf', naam: 'Zittende kuitheffing', pattern: 'calf',
    orderCategory: 'isolation',
    equipment: ['bench', 'plates', 'dumbbells'], role: 'core', loads: L('calf'),
    setsReps: { sets: 3, repMin: 12, repMax: 15 }, bodyweightAlternative: 'seated_calf_bw',
  }),
  ex({
    id: 'leg_press_calf', naam: 'Kuitheffing op leg press', pattern: 'calf',
    orderCategory: 'isolation',
    equipment: ['leg_press', 'plates'], role: 'core', loads: L('achilles', 'calf'),
    setsReps: { sets: 4, repMin: 12, repMax: 15 }, bodyweightAlternative: 'standing_calf_bw',
  }),
  ex({
    id: 'single_leg_calf_db', naam: 'Eenbenige kuitheffing (dumbbell)', pattern: 'calf',
    orderCategory: 'isolation',
    equipment: ['dumbbells'], role: 'core', progression: 'reps', minIncrement: 2.5, perSide: true,
    loads: L('achilles', 'calf'), setsReps: { sets: 3, repMin: 12, repMax: 18 },
    bodyweightAlternative: 'standing_calf_bw',
  }),
  ex({
    id: 'heel_drop_ecc', naam: 'Excentrische heel drops', pattern: 'calf',
    orderCategory: 'isolation',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw', perSide: true,
    loads: L('achilles'), setsReps: { sets: 3, repMin: 12, repMax: 15 },
  }),
  ex({
    id: 'standing_calf_bw', naam: 'Staande kuitheffing (lichaamsgewicht)', pattern: 'calf',
    orderCategory: 'isolation',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L('calf'), setsReps: { sets: 3, repMin: 20, repMax: 30 },
  }),
  ex({
    id: 'seated_calf_bw', naam: 'Zittende kuitheffing (lichaamsgewicht)', pattern: 'calf',
    orderCategory: 'isolation',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L('calf'), setsReps: { sets: 3, repMin: 20, repMax: 30 },
  }),
  ex({
    id: 'tibialis_raise', naam: 'Tibialis raise', pattern: 'calf',
    orderCategory: 'isolation',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L(), setsReps: { sets: 3, repMin: 15, repMax: 25 },
  }),

  /* ---------------- abduction ---------------- */
  ex({
    id: 'band_lateral_walk', naam: 'Laterale bandwalk', pattern: 'abduction',
    orderCategory: 'isolation',
    equipment: ['band'], role: 'core', progression: 'reps', minIncrement: 0, unit: 'band',
    loads: L('lateral_hip'), setsReps: { sets: 3, repMin: 15, repMax: 20 },
    bodyweightAlternative: 'side_lying_abduction',
    cue: 'Laagste weerstand eerst, knieën niet naar binnen.',
  }),
  ex({
    id: 'band_hip_abduction_seated', naam: 'Heupabductie met band (zittend)', pattern: 'abduction',
    orderCategory: 'isolation',
    equipment: ['band'], role: 'core', progression: 'reps', minIncrement: 0, unit: 'band',
    loads: L('lateral_hip'), setsReps: { sets: 3, repMin: 15, repMax: 25 },
    bodyweightAlternative: 'side_lying_abduction',
  }),
  ex({
    id: 'cable_hip_abduction', naam: 'Heupabductie kabel', pattern: 'abduction',
    orderCategory: 'isolation',
    equipment: ['low_cable'], role: 'core', perSide: true, loads: L('lateral_hip'),
    setsReps: { sets: 3, repMin: 12, repMax: 20 }, bodyweightAlternative: 'side_lying_abduction',
  }),
  ex({
    id: 'standing_band_abduction', naam: 'Staande abductie met band', pattern: 'abduction',
    orderCategory: 'isolation',
    equipment: ['band'], role: 'core', progression: 'reps', minIncrement: 0, unit: 'band',
    perSide: true, loads: L('lateral_hip'), setsReps: { sets: 3, repMin: 15, repMax: 20 },
    bodyweightAlternative: 'side_lying_abduction',
  }),
  ex({
    id: 'clamshell', naam: 'Clamshell (band)', pattern: 'abduction',
    orderCategory: 'isolation',
    equipment: ['band'], role: 'core', progression: 'reps', minIncrement: 0, unit: 'band',
    perSide: true, loads: L('lateral_hip'), setsReps: { sets: 3, repMin: 15, repMax: 25 },
    bodyweightAlternative: 'side_lying_abduction',
  }),
  ex({
    id: 'monster_walk', naam: 'Monster walk (band)', pattern: 'abduction',
    orderCategory: 'isolation',
    equipment: ['band'], role: 'core', progression: 'reps', minIncrement: 0, unit: 'band',
    loads: L('lateral_hip'), setsReps: { sets: 3, repMin: 15, repMax: 20 },
    bodyweightAlternative: 'side_lying_abduction',
  }),
  ex({
    id: 'side_lying_abduction', naam: 'Zijligging beenheffen', pattern: 'abduction',
    orderCategory: 'isolation',
    equipment: ['bodyweight'], role: 'core', progression: 'reps', minIncrement: 0, unit: 'bw',
    perSide: true, loads: L(), setsReps: { sets: 3, repMin: 15, repMax: 25 },
  }),
  ex({
    id: 'side_plank_leg_lift', naam: 'Side plank met beenheffen', pattern: 'abduction',
    orderCategory: 'isolation',
    equipment: ['bodyweight'], role: 'core', progression: 'reps', minIncrement: 0, unit: 'bw',
    perSide: true, loads: L('shoulder'), setsReps: { sets: 3, repMin: 8, repMax: 15 },
  }),

  /* ---------------- core (romp) ---------------- */
  ex({
    id: 'ab_roller_ex', naam: 'Ab roller', pattern: 'core', group: 'abs',
    orderCategory: 'core',
    equipment: ['ab_roller'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L('lower_back', 'shoulder'), setsReps: { sets: 3, repMin: 8, repMax: 12 },
    bodyweightAlternative: 'dead_bug',
  }),
  ex({
    id: 'plank', naam: 'Plank', pattern: 'core', group: 'abs',
    orderCategory: 'core',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L(), setsReps: { sets: 3, repMin: 30, repMax: 60 }, cue: 'Reps = seconden.',
  }),
  ex({
    id: 'dead_bug', naam: 'Dead bug', pattern: 'core', group: 'abs',
    orderCategory: 'core',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L(), setsReps: { sets: 3, repMin: 10, repMax: 20 },
  }),
  ex({
    id: 'side_plank', naam: 'Side plank', pattern: 'core', group: 'abs',
    orderCategory: 'core',
    equipment: ['bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    perSide: true, loads: L('shoulder'), setsReps: { sets: 3, repMin: 20, repMax: 45 },
    cue: 'Reps = seconden.',
  }),
  ex({
    id: 'hanging_knee_raise', naam: 'Hangend knieheffen', pattern: 'core', group: 'abs',
    orderCategory: 'core',
    equipment: ['pullup_bar', 'bodyweight'], progression: 'reps', minIncrement: 0, unit: 'bw',
    loads: L('shoulder'), setsReps: { sets: 3, repMin: 8, repMax: 15 },
    bodyweightAlternative: 'dead_bug',
  }),
  ex({
    id: 'cable_crunch', naam: 'Kabelcrunch', pattern: 'core', group: 'abs',
    orderCategory: 'core',
    equipment: ['lat_tower'], loads: L('lower_back'),
    setsReps: { sets: 3, repMin: 12, repMax: 15 }, bodyweightAlternative: 'dead_bug',
  }),
  ex({
    id: 'pallof_press', naam: 'Pallof press (band)', pattern: 'core', group: 'abs',
    orderCategory: 'core',
    equipment: ['band', 'low_cable'], progression: 'reps', minIncrement: 0, unit: 'band',
    perSide: true, loads: L(), setsReps: { sets: 3, repMin: 10, repMax: 15 },
  }),

  /* ---------------- single_leg ---------------- */
  ex({
    id: 'bulgarian_split_squat', naam: 'Bulgarian split squat', pattern: 'single_leg',
    orderCategory: 'heavy_legs',
    equipment: ['dumbbells', 'bench', 'smith'], role: 'core', progression: 'reps', minIncrement: 2.5,
    perSide: true, loads: L('knee_deep', 'lateral_hip'), setsReps: { sets: 3, repMin: 6, repMax: 10 },
    bodyweightAlternative: 'split_squat_bw',
  }),
  ex({
    id: 'single_leg_press', naam: 'Eenbenige leg press', pattern: 'single_leg',
    orderCategory: 'heavy_legs',
    equipment: ['leg_press', 'plates'], role: 'core', perSide: true, loads: L('knee_deep'),
    setsReps: { sets: 3, repMin: 8, repMax: 12 }, bodyweightAlternative: 'split_squat_bw',
  }),
  ex({
    id: 'walking_lunge_db', naam: 'Lunge met dumbbells', pattern: 'single_leg',
    orderCategory: 'heavy_legs',
    equipment: ['dumbbells'], role: 'core', progression: 'reps', minIncrement: 2.5, perSide: true,
    loads: L('knee_deep'), setsReps: { sets: 3, repMin: 8, repMax: 12 },
    bodyweightAlternative: 'split_squat_bw',
  }),
  ex({
    id: 'step_up_db', naam: 'Step-up op bank', pattern: 'single_leg',
    orderCategory: 'heavy_legs',
    equipment: ['dumbbells', 'bench'], role: 'core', progression: 'reps', minIncrement: 2.5,
    perSide: true, loads: L('knee_deep', 'lateral_hip'), setsReps: { sets: 3, repMin: 8, repMax: 12 },
    bodyweightAlternative: 'step_up_bw',
  }),
  ex({
    id: 'reverse_lunge_sandbag', naam: 'Reverse lunge (schouderzak)', pattern: 'single_leg',
    orderCategory: 'heavy_legs',
    equipment: ['sandbag'], role: 'core', progression: 'reps', minIncrement: 5, perSide: true,
    loads: L('knee_deep'), setsReps: { sets: 3, repMin: 8, repMax: 12 },
    bodyweightAlternative: 'split_squat_bw',
  }),
  ex({
    id: 'single_leg_rdl_db', naam: 'Eenbenige RDL (dumbbell)', pattern: 'single_leg',
    orderCategory: 'heavy_legs',
    equipment: ['dumbbells'], role: 'core', progression: 'reps', minIncrement: 2.5, perSide: true,
    loads: L('hip_deep', 'lateral_hip'), setsReps: { sets: 3, repMin: 8, repMax: 12 },
    bodyweightAlternative: 'single_leg_glute_bridge',
  }),
  ex({
    id: 'split_squat_bw', naam: 'Split squat (lichaamsgewicht)', pattern: 'single_leg',
    orderCategory: 'heavy_legs',
    equipment: ['bodyweight'], role: 'core', progression: 'reps', minIncrement: 0, unit: 'bw',
    perSide: true, loads: L('knee_deep'), setsReps: { sets: 3, repMin: 10, repMax: 20 },
  }),
  ex({
    id: 'step_up_bw', naam: 'Step-up (lichaamsgewicht)', pattern: 'single_leg',
    orderCategory: 'heavy_legs',
    equipment: ['bodyweight'], role: 'core', progression: 'reps', minIncrement: 0, unit: 'bw',
    perSide: true, loads: L('lateral_hip'), setsReps: { sets: 3, repMin: 12, repMax: 20 },
  }),
  ex({
    id: 'single_leg_glute_bridge', naam: 'Eenbenige glute bridge', pattern: 'single_leg',
    orderCategory: 'isolation',
    equipment: ['bodyweight'], role: 'core', progression: 'reps', minIncrement: 0, unit: 'bw',
    perSide: true, loads: L(), setsReps: { sets: 3, repMin: 12, repMax: 20 },
  }),
]

export const BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]))

export function getExercise(id: string): Exercise {
  const e = BY_ID[id]
  if (!e) throw new Error(`Onbekende oefening: ${id}`)
  return e
}

export const PATTERN_LABEL: Record<Pattern, string> = {
  knee_dominant: 'Kniedominant',
  hip_dominant: 'Heupdominant',
  push_horizontal: 'Duwen horizontaal',
  push_vertical: 'Duwen verticaal',
  pull_horizontal: 'Trekken horizontaal',
  pull_vertical: 'Trekken verticaal',
  calf: 'Kuit',
  abduction: 'Abductie',
  core: 'Romp',
  single_leg: 'Eenbenig',
}

export const LOAD_LABEL: Record<LoadArea, string> = {
  knee_deep: 'Diepe kniebuiging',
  hip_deep: 'Diepe heupbuiging',
  achilles: 'Achillespees',
  calf: 'Kuit',
  lateral_hip: 'Zijkant heup',
  lower_back: 'Onderrug',
  shoulder: 'Schouder',
}

/** Kandidaten voor wisselen: zelfde pattern, en zelfde groep als die er is. */
export function alternatives(ex: Exercise): Exercise[] {
  return EXERCISES.filter(
    (c) => c.pattern === ex.pattern && (ex.group ? c.group === ex.group : !c.group),
  )
}
