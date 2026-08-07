import type { Anchor, Pose, Prop } from '../components/Figure'

export interface FigureSpec {
  start: Pose
  end: Pose
  props?: { start: Prop[]; end: Prop[] }
}

/**
 * Houdingen voor het poppetje. Alleen samengestelde oefeningen krijgen er een;
 * isolatie, band- en kabelwerk en rompoefeningen blijven tekst.
 *
 * Elke houding is een complete set gewrichtshoeken. Varianten van dezelfde
 * beweging delen de hoeken en verschillen alleen in het getekende materiaal.
 */

/* ---------------- basishoudingen ---------------- */
/*
 * Deze hoekensets zijn afgeleid uit segmentrichtingen en gecontroleerd: elk
 * eindpunt valt binnen het kader en boven de vloer. Hoeken buiten 0-180 komen
 * voor bij liggende houdingen, waar de romp zelf al ver gedraaid is.
 */

const SQUAT_TOP: Pose = { root: [58, 70], torso: 8, neck: 0, hip: 174, knee: 176, ankle: 88, shoulder: -7, elbow: 45, elbowDir: 1, kneeDir: -1 }
const SQUAT_BOTTOM: Pose = { root: [50, 94], torso: 40, neck: 0, hip: 48, knee: 74, ankle: 72, shoulder: 60, elbow: 70, elbowDir: 1, kneeDir: -1 }
const SQUAT_TOP_FREE: Pose = { root: [58, 70], torso: 8, neck: 0, hip: 174, knee: 176, ankle: 88, shoulder: 10, elbow: 180, elbowDir: -1, kneeDir: -1 }
const SQUAT_BOTTOM_FREE: Pose = { root: [50, 94], torso: 40, neck: 0, hip: 48, knee: 74, ankle: 72, shoulder: 136, elbow: 180, elbowDir: -1, kneeDir: -1 }
const SQUAT_TOP_FRONT: Pose = { root: [58, 70], torso: 8, neck: 0, hip: 174, knee: 176, ankle: 88, shoulder: 38, elbow: 50, elbowDir: 1, kneeDir: -1 }
const SQUAT_BOTTOM_FRONT: Pose = { root: [50, 94], torso: 40, neck: 0, hip: 48, knee: 74, ankle: 72, shoulder: 80, elbow: 56, elbowDir: 1, kneeDir: -1 }
const HINGE_TOP: Pose = { root: [58, 70], torso: 5, neck: 0, hip: 178, knee: 176, ankle: 89, shoulder: 5, elbow: 180, elbowDir: -1, kneeDir: -1 }
const HINGE_BOTTOM: Pose = { root: [48, 76], torso: 70, neck: 12, hip: 106, knee: 168, ankle: 92, shoulder: 70, elbow: 180, elbowDir: -1, kneeDir: -1 }
const SWING_BACK: Pose = { root: [48, 76], torso: 70, neck: 12, hip: 106, knee: 168, ankle: 92, shoulder: 105, elbow: 180, elbowDir: -1, kneeDir: -1 }
const SWING_FRONT: Pose = { root: [58, 72], torso: 5, neck: 0, hip: 178, knee: 176, ankle: 89, shoulder: 85, elbow: 180, elbowDir: -1, kneeDir: -1 }
const SPLIT_TOP: Pose = { root: [56, 68], torso: 10, neck: 0, hip: -160, knee: 160, ankle: 70, hipR: 165, kneeR: 170, ankleR: 87, shoulder: 8, elbow: 180, elbowDir: -1, kneeDir: -1 }
const SPLIT_BOTTOM: Pose = { root: [58, 90], torso: 14, neck: 0, hip: -158, knee: 149, ankle: 43, hipR: 103, kneeR: 108, ankleR: 81, shoulder: 12, elbow: 180, elbowDir: -1, kneeDir: -1 }
const STEP_DOWN: Pose = { root: [44, 76], torso: 10, neck: 0, hip: 174, knee: 178, ankle: 90, hipR: 115.7, kneeR: 122.1, ankleR: 86.4, shoulder: 8, elbow: 180, elbowDir: -1, kneeDir: -1 }
const STEP_UP: Pose = { root: [60, 67], torso: 8, neck: 0, hip: -173, knee: 175, ankle: 100, hipR: 174, kneeR: 176, ankleR: 88, shoulder: 6, elbow: 180, elbowDir: -1, kneeDir: -1 }
const SL_HINGE_TOP: Pose = { root: [58, 70], torso: 5, neck: 0, hip: 178, knee: 176, ankle: 89, hipR: 178, kneeR: 176, ankleR: 89, shoulder: 5, elbow: 180, elbowDir: -1, kneeDir: -1 }
const SL_HINGE_BOTTOM: Pose = { root: [50, 72], torso: 76, neck: 10, hip: -2, knee: 176, ankle: 186, hipR: 98, kneeR: 168, ankleR: 96, shoulder: 76, elbow: 180, elbowDir: -1, kneeDir: -1 }
const THRUST_DOWN: Pose = { root: [72, 114], torso: -70, neck: 0, hip: 126, knee: 46, ankle: 80, shoulder: -140, elbow: 180, elbowDir: -1, kneeDir: -1 }
const THRUST_UP: Pose = { root: [72, 98], torso: -101, neck: 0, hip: -155, knee: 86, ankle: 72, shoulder: -171, elbow: 180, elbowDir: -1, kneeDir: -1 }
const LEG_PRESS_BENT: Pose = { root: [40, 106], torso: -55, neck: -7, hip: 87, knee: 94, ankle: 92, shoulder: -17, elbow: 173, elbowDir: 1, kneeDir: -1 }
const LEG_PRESS_STRAIGHT: Pose = { root: [40, 106], torso: -55, neck: -7, hip: 113, knee: 146, ankle: 118, shoulder: -17, elbow: 173, elbowDir: 1, kneeDir: -1 }
const BENCH_DOWN: Pose = { root: [40, 82], torso: 92, neck: -18, hip: 128, knee: 149, ankle: 81, shoulder: 29, elbow: 48, elbowDir: -1, kneeDir: 1 }
const BENCH_UP: Pose = { root: [40, 82], torso: 92, neck: -18, hip: 128, knee: 149, ankle: 81, shoulder: -88, elbow: 176, elbowDir: -1, kneeDir: 1 }
const FLOOR_DOWN: Pose = { root: [64, 124], torso: 92, neck: -18, hip: -162, knee: 140, ankle: 40, shoulder: 12, elbow: 70, elbowDir: -1, kneeDir: 1 }
const FLOOR_UP: Pose = { root: [64, 124], torso: 92, neck: -18, hip: -162, knee: 140, ankle: 40, shoulder: -88, elbow: 176, elbowDir: -1, kneeDir: 1 }
const PUSHUP_UP: Pose = { root: [57, 100], torso: 68, neck: -18, hip: 180, knee: 180, ankle: 112, shoulder: 68, elbow: 176, elbowDir: 1, kneeDir: -1 }
const PUSHUP_DOWN: Pose = { root: [59, 108], torso: 78, neck: -18, hip: 180, knee: 180, ankle: 102, shoulder: 19, elbow: 93, elbowDir: 1, kneeDir: -1 }
const OHP_DOWN: Pose = { root: [58, 72], torso: 4, neck: 0, hip: 180, knee: 178, ankle: 90, shoulder: 42, elbow: 52, elbowDir: 1, kneeDir: -1 }
const OHP_UP: Pose = { root: [58, 72], torso: 4, neck: 0, hip: 180, knee: 178, ankle: 90, shoulder: -174, elbow: 178, elbowDir: -1, kneeDir: -1 }
const PULLDOWN_TOP: Pose = { root: [46, 94], torso: 14, neck: 0, hip: 82, knee: 90, ankle: 84, shoulder: -176, elbow: 176, elbowDir: 1, kneeDir: -1 }
const PULLDOWN_BOTTOM: Pose = { root: [46, 94], torso: 22, neck: 0, hip: 74, knee: 90, ankle: 84, shoulder: 54, elbow: 48, elbowDir: 1, kneeDir: -1 }
const PULLUP_HANG: Pose = { root: [56, 78], torso: 4, neck: 0, hip: 180, knee: 176, ankle: 102, shoulder: -176, elbow: 178, elbowDir: -1, kneeDir: -1 }
const PULLUP_TOP: Pose = { root: [56, 94], torso: 8, neck: 0, hip: -170, knee: 52, ankle: 140, shoulder: 174, elbow: 136, elbowDir: 1, kneeDir: 1 }
const ROW_STRETCH: Pose = { root: [52, 76], torso: 60, neck: 8, hip: 110, knee: 160, ankle: 88, shoulder: 60, elbow: 180, elbowDir: -1, kneeDir: -1 }
const ROW_PULL: Pose = { root: [52, 76], torso: 60, neck: 8, hip: 110, knee: 160, ankle: 88, shoulder: 22, elbow: 92, elbowDir: 1, kneeDir: -1 }
const SEATED_ROW_STRETCH: Pose = { root: [42, 98], torso: 18, neck: 0, hip: 70, knee: 104, ankle: 110, shoulder: 90, elbow: 176, elbowDir: 1, kneeDir: -1 }
const SEATED_ROW_PULL: Pose = { root: [42, 98], torso: 2, neck: 0, hip: 86, knee: 104, ankle: 110, shoulder: -16, elbow: 78, elbowDir: 1, kneeDir: -1 }
const INVERTED_DOWN: Pose = { root: [74, 104], torso: 82, neck: -16, hip: 180, knee: 180, ankle: 108, shoulder: -96, elbow: 176, elbowDir: -1, kneeDir: -1 }
const INVERTED_UP: Pose = { root: [74, 98], torso: 80, neck: -16, hip: 180, knee: 180, ankle: 110, shoulder: -116, elbow: 124, elbowDir: 1, kneeDir: -1 }

/* ---------------- materiaal ---------------- */

const smithRail = (x: number): Prop => ({ kind: 'rail', x, y1: 10, y2: 126 })
const bar = (anchor: Anchor, dy = 0): Prop => ({ kind: 'barbell', anchor, dy })
const dbs = (anchor: Anchor = 'hands'): Prop => ({ kind: 'dumbbells', anchor })
const bench = (x: number, y: number, w: number): Prop => ({ kind: 'bench', x, y, w })

const LAT_TOWER: Prop = { kind: 'outline', points: [[98, 128], [98, 12], [56, 12]] }
const PULLUP_BAR: Prop = { kind: 'outline', points: [[28, 13], [92, 13]] }
/** Voetplaat en rugleuning van de leg press. */
const LEG_PRESS_PLATE: Prop = { kind: 'outline', points: [[99, 110], [86, 64]] }
const LEG_PRESS_SEAT: Prop = { kind: 'outline', points: [[46, 112], [8, 86]] }
const LOW_CABLE: Prop = { kind: 'outline', points: [[106, 128], [106, 100], [92, 100]] }
const WALL: Prop = { kind: 'outline', points: [[22, 128], [22, 24]] }

/* ---------------- koppeling per oefening ---------------- */

const squat = (gear: Prop[]): FigureSpec => ({
  start: SQUAT_TOP, end: SQUAT_BOTTOM, props: { start: gear, end: gear },
})
const pair = (start: Pose, end: Pose, gear?: Prop[]): FigureSpec => ({
  start, end, props: gear ? { start: gear, end: gear } : undefined,
})

export const FIGURES: Record<string, FigureSpec> = {
  /* squat-varianten */
  smith_squat: squat([smithRail(74), bar('shoulders')]),
  hack_squat_smith: squat([smithRail(74), bar('shoulders')]),
  sandbag_squat: squat([bar('shoulders', -4)]),
  smith_front_squat: pair(SQUAT_TOP_FRONT, SQUAT_BOTTOM_FRONT, [smithRail(74), bar('shoulders', -3)]),
  goblet_squat_kb: pair(SQUAT_TOP_FRONT, SQUAT_BOTTOM_FRONT, [dbs()]),
  squat_bw: pair(SQUAT_TOP_FREE, SQUAT_BOTTOM_FREE),
  wall_sit: pair(SQUAT_TOP_FREE, SQUAT_BOTTOM_FREE, [WALL]),

  /* heupscharnier */
  rdl_trapbar: pair(HINGE_TOP, HINGE_BOTTOM, [bar('hands')]),
  rdl_barbell: pair(HINGE_TOP, HINGE_BOTTOM, [bar('hands')]),
  good_morning_smith: pair(HINGE_TOP, HINGE_BOTTOM, [smithRail(74), bar('shoulders')]),
  kb_swing: pair(SWING_BACK, SWING_FRONT, [dbs()]),

  /* leg press */
  leg_press: pair(LEG_PRESS_BENT, LEG_PRESS_STRAIGHT, [LEG_PRESS_PLATE, LEG_PRESS_SEAT]),
  single_leg_press: {
    start: { ...LEG_PRESS_BENT, hipR: 130, kneeR: 60, ankleR: 92 },
    end: { ...LEG_PRESS_STRAIGHT, hipR: 130, kneeR: 60, ankleR: 92 },
    props: {
      start: [LEG_PRESS_PLATE, LEG_PRESS_SEAT],
      end: [LEG_PRESS_PLATE, LEG_PRESS_SEAT],
    },
  },

  /* hip thrust */
  hip_thrust_smith: pair(THRUST_DOWN, THRUST_UP, [bench(8, 106, 44), smithRail(72), bar('hips')]),
  glute_bridge_bw: pair(THRUST_DOWN, THRUST_UP, [bench(8, 106, 44)]),

  /* bankdrukken */
  bench_smith: pair(BENCH_DOWN, BENCH_UP, [bench(14, 86, 60), smithRail(58), bar('hands')]),
  close_grip_smith: pair(BENCH_DOWN, BENCH_UP, [bench(14, 86, 60), smithRail(58), bar('hands')]),
  flat_db_press: pair(BENCH_DOWN, BENCH_UP, [bench(14, 86, 60), dbs()]),
  incline_db_press: pair(
    { ...BENCH_DOWN, torso: 72 },
    { ...BENCH_UP, torso: 72 },
    [bench(14, 90, 60), dbs()],
  ),
  floor_press_db: pair(FLOOR_DOWN, FLOOR_UP, [dbs()]),

  /* push-up */
  pushup: pair(PUSHUP_UP, PUSHUP_DOWN),
  pushup_decline: pair(
    { ...PUSHUP_UP, root: [57, 94] },
    { ...PUSHUP_DOWN, root: [59, 102] },
    [bench(4, 112, 30)],
  ),

  /* schouderdrukken */
  db_shoulder_press: pair(OHP_DOWN, OHP_UP, [dbs()]),
  kb_press: pair(OHP_DOWN, OHP_UP, [dbs()]),
  sandbag_press: pair(OHP_DOWN, OHP_UP, [dbs()]),
  smith_ohp: pair(OHP_DOWN, OHP_UP, [smithRail(60), bar('hands')]),

  /* lat pulldown */
  lat_pulldown: pair(PULLDOWN_TOP, PULLDOWN_BOTTOM, [
    LAT_TOWER,
    { kind: 'cable', anchor: 'hands', to: [58, 12] },
    bar('hands'),
  ]),
  lat_pulldown_neutral: pair(PULLDOWN_TOP, PULLDOWN_BOTTOM, [
    LAT_TOWER,
    { kind: 'cable', anchor: 'hands', to: [58, 12] },
    bar('hands'),
  ]),

  /* optrekken */
  pullup: pair(PULLUP_HANG, PULLUP_TOP, [PULLUP_BAR]),
  chinup: pair(PULLUP_HANG, PULLUP_TOP, [PULLUP_BAR]),
  negative_pullup: pair(PULLUP_TOP, PULLUP_HANG, [PULLUP_BAR]),

  /* roeien */
  bb_row: pair(ROW_STRETCH, ROW_PULL, [bar('hands')]),
  db_row_1arm: {
    start: { ...ROW_STRETCH, shoulderR: 60, elbowR: 180 },
    end: { ...ROW_PULL, shoulderR: 22, elbowR: 92 },
    props: { start: [bench(10, 96, 40), dbs()], end: [bench(10, 96, 40), dbs()] },
  },
  chest_supported_row: pair(
    { ...ROW_STRETCH, torso: 50 },
    { ...ROW_PULL, torso: 50 },
    [bench(16, 84, 52), dbs()],
  ),
  inverted_row_smith: pair(INVERTED_DOWN, INVERTED_UP, [smithRail(102), bar('hands')]),
  cable_row_low: pair(SEATED_ROW_STRETCH, SEATED_ROW_PULL, [
    LOW_CABLE,
    { kind: 'cable', anchor: 'hands', to: [106, 100] },
  ]),

  /* eenbenig */
  bulgarian_split_squat: pair(SPLIT_TOP, SPLIT_BOTTOM, [bench(6, 110, 32), dbs()]),
  split_squat_bw: pair(SPLIT_TOP, SPLIT_BOTTOM),
  walking_lunge_db: pair(SPLIT_TOP, SPLIT_BOTTOM, [dbs()]),
  reverse_lunge_sandbag: pair(SPLIT_TOP, SPLIT_BOTTOM, [bar('shoulders', -4)]),
  step_up_db: pair(STEP_DOWN, STEP_UP, [bench(52, 114, 46), dbs()]),
  step_up_bw: pair(STEP_DOWN, STEP_UP, [bench(52, 114, 46)]),
  single_leg_rdl_db: pair(SL_HINGE_TOP, SL_HINGE_BOTTOM, [dbs()]),
}

export function getFigure(exerciseId: string): FigureSpec | null {
  return FIGURES[exerciseId] ?? null
}
