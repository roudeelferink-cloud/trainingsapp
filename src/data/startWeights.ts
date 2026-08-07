import type { RelatedRatio } from '../types'

export interface StartWeightSpec {
  /** vermenigvuldiger van het lichaamsgewicht; bewust aan de lage kant */
  startFactor: number
  /** verhouding tot de oefening met de meest vergelijkbare belastingsvorm */
  relatedRatio?: RelatedRatio
}

/**
 * Conservatieve startpunten. Te licht beginnen is beter dan te zwaar: de
 * progressielogica klimt vanzelf, een verrekte hamstring niet.
 *
 * `startFactor: 0` betekent lichaamsgewicht of band — daar valt geen gewicht te
 * adviseren, dus toont de app niets.
 *
 * `relatedRatio` verwijst naar de oefening met de meest vergelijkbare
 * belastingsvorm: hetzelfde apparaat, of anders dezelfde soort weerstand
 * (schijven, stang, dumbbells per hand, kabel, kettlebell, schouderzak). Het
 * bewegingspatroon speelt daarbij geen rol — een eenbenige leg press hoort bij de
 * gewone leg press, niet bij een split squat met dumbbells.
 *
 * De verwijzingen vormen een boom per weerstandssoort: elk anker hieronder heeft
 * zelf geen verwijzing en valt terug op het lichaamsgewicht. Er zitten dus geen
 * kringetjes in. De advieslogica doet één stap; heeft de verwante oefening nog
 * geen data, dan gaat hij terug naar lichaamsgewicht × startFactor.
 *
 * Ankers: leg_press (schijfmachine), smith_squat (smith), rdl_barbell (losse
 * stang), curl_bar_curl (curlstang), flat_db_press (dumbbells), lat_pulldown
 * (kabel), goblet_squat_kb (kettlebell), sandbag_squat (schouderzak).
 */
export const START_WEIGHTS: Record<string, StartWeightSpec> = {
  /* ---------------- schijfmachines: leg press en leg ext/curl ---------------- */
  leg_press: { startFactor: 0.5 }, // anker
  single_leg_press: { startFactor: 0.25, relatedRatio: { exerciseId: 'leg_press', ratio: 0.5 } },
  leg_press_calf: { startFactor: 0.8, relatedRatio: { exerciseId: 'leg_press', ratio: 1.4 } },
  leg_extension: { startFactor: 0.2, relatedRatio: { exerciseId: 'leg_press', ratio: 0.35 } },
  // leg curl en leg extension delen hetzelfde gecombineerde apparaat
  leg_curl: { startFactor: 0.2, relatedRatio: { exerciseId: 'leg_extension', ratio: 0.8 } },

  /* ---------------- smith machine ---------------- */
  smith_squat: { startFactor: 0.4 }, // anker
  smith_front_squat: { startFactor: 0.3, relatedRatio: { exerciseId: 'smith_squat', ratio: 0.8 } },
  hack_squat_smith: { startFactor: 0.35, relatedRatio: { exerciseId: 'smith_squat', ratio: 0.85 } },
  hip_thrust_smith: { startFactor: 0.5, relatedRatio: { exerciseId: 'smith_squat', ratio: 1.2 } },
  good_morning_smith: { startFactor: 0.25, relatedRatio: { exerciseId: 'smith_squat', ratio: 0.45 } },
  standing_calf_smith: { startFactor: 0.5, relatedRatio: { exerciseId: 'smith_squat', ratio: 1 } },
  bench_smith: { startFactor: 0.4, relatedRatio: { exerciseId: 'smith_squat', ratio: 0.6 } },
  close_grip_smith: { startFactor: 0.3, relatedRatio: { exerciseId: 'bench_smith', ratio: 0.8 } },
  smith_ohp: { startFactor: 0.25, relatedRatio: { exerciseId: 'bench_smith', ratio: 0.6 } },
  // schijven op schoot: zelfde soort belasting als de staande kuitheffing
  seated_calf: { startFactor: 0.25, relatedRatio: { exerciseId: 'standing_calf_smith', ratio: 0.5 } },

  /* ---------------- losse stang met schijven ---------------- */
  rdl_barbell: { startFactor: 0.45 }, // anker
  rdl_trapbar: { startFactor: 0.5, relatedRatio: { exerciseId: 'rdl_barbell', ratio: 1.05 } },
  bb_row: { startFactor: 0.4, relatedRatio: { exerciseId: 'rdl_barbell', ratio: 0.55 } },

  /* ---------------- curlstang met schijven ---------------- */
  curl_bar_curl: { startFactor: 0.15 }, // anker
  skullcrusher: { startFactor: 0.15, relatedRatio: { exerciseId: 'curl_bar_curl', ratio: 0.75 } },

  /* ---------------- dumbbells, gewicht per hand ---------------- */
  flat_db_press: { startFactor: 0.18 }, // anker
  incline_db_press: { startFactor: 0.16, relatedRatio: { exerciseId: 'flat_db_press', ratio: 0.85 } },
  floor_press_db: { startFactor: 0.18, relatedRatio: { exerciseId: 'flat_db_press', ratio: 1 } },
  db_shoulder_press: { startFactor: 0.16, relatedRatio: { exerciseId: 'flat_db_press', ratio: 0.6 } },
  lateral_raise_db: { startFactor: 0.16, relatedRatio: { exerciseId: 'db_shoulder_press', ratio: 0.35 } },
  overhead_ext_db: { startFactor: 0.16, relatedRatio: { exerciseId: 'db_shoulder_press', ratio: 0.5 } },
  db_row_1arm: { startFactor: 0.2, relatedRatio: { exerciseId: 'flat_db_press', ratio: 1.1 } },
  chest_supported_row: { startFactor: 0.16, relatedRatio: { exerciseId: 'db_row_1arm', ratio: 0.8 } },
  db_curl: { startFactor: 0.16, relatedRatio: { exerciseId: 'flat_db_press', ratio: 0.55 } },
  hammer_curl: { startFactor: 0.16, relatedRatio: { exerciseId: 'db_curl', ratio: 1.1 } },
  single_leg_calf_db: { startFactor: 0.16, relatedRatio: { exerciseId: 'flat_db_press', ratio: 1 } },
  // eenbenig werk met dumbbells is grip-beperkt, net als drukken per hand
  bulgarian_split_squat: { startFactor: 0.16, relatedRatio: { exerciseId: 'flat_db_press', ratio: 1.2 } },
  walking_lunge_db: { startFactor: 0.16, relatedRatio: { exerciseId: 'bulgarian_split_squat', ratio: 1 } },
  step_up_db: { startFactor: 0.16, relatedRatio: { exerciseId: 'bulgarian_split_squat', ratio: 1 } },
  single_leg_rdl_db: { startFactor: 0.16, relatedRatio: { exerciseId: 'bulgarian_split_squat', ratio: 1 } },

  /* ---------------- kabel: lat toren en lage kabel ---------------- */
  lat_pulldown: { startFactor: 0.5 }, // anker
  lat_pulldown_neutral: { startFactor: 0.5, relatedRatio: { exerciseId: 'lat_pulldown', ratio: 1 } },
  cable_row_low: { startFactor: 0.45, relatedRatio: { exerciseId: 'lat_pulldown', ratio: 0.9 } },
  straight_arm_pulldown: { startFactor: 0.2, relatedRatio: { exerciseId: 'lat_pulldown', ratio: 0.4 } },
  triceps_pushdown: { startFactor: 0.2, relatedRatio: { exerciseId: 'lat_pulldown', ratio: 0.4 } },
  cable_curl: { startFactor: 0.15, relatedRatio: { exerciseId: 'lat_pulldown', ratio: 0.3 } },
  cable_chest_press: { startFactor: 0.3, relatedRatio: { exerciseId: 'lat_pulldown', ratio: 0.6 } },
  cable_crunch: { startFactor: 0.25, relatedRatio: { exerciseId: 'lat_pulldown', ratio: 0.5 } },
  cable_hip_abduction: { startFactor: 0.08, relatedRatio: { exerciseId: 'lat_pulldown', ratio: 0.15 } },
  face_pull: { startFactor: 0.15, relatedRatio: { exerciseId: 'cable_row_low', ratio: 0.35 } },
  cable_pullthrough: { startFactor: 0.25, relatedRatio: { exerciseId: 'cable_row_low', ratio: 0.8 } },

  /* ---------------- kettlebell ---------------- */
  goblet_squat_kb: { startFactor: 0.15 }, // anker
  kb_swing: { startFactor: 0.15, relatedRatio: { exerciseId: 'goblet_squat_kb', ratio: 1 } },
  kb_press: { startFactor: 0.15, relatedRatio: { exerciseId: 'goblet_squat_kb', ratio: 0.75 } },
  kb_curl: { startFactor: 0.15, relatedRatio: { exerciseId: 'goblet_squat_kb', ratio: 0.75 } },

  /* ---------------- schouderzak ---------------- */
  sandbag_squat: { startFactor: 0.25 }, // anker
  sandbag_press: { startFactor: 0.25, relatedRatio: { exerciseId: 'sandbag_squat', ratio: 0.8 } },
  reverse_lunge_sandbag: { startFactor: 0.25, relatedRatio: { exerciseId: 'sandbag_squat', ratio: 0.7 } },

  /* ---------------- lichaamsgewicht en band: geen gewichtsadvies ---------------- */
  squat_bw: { startFactor: 0 },
  wall_sit: { startFactor: 0 },
  nordic_curl_band: { startFactor: 0 },
  glute_bridge_bw: { startFactor: 0 },
  pushup: { startFactor: 0 },
  pushup_decline: { startFactor: 0 },
  band_chest_press: { startFactor: 0 },
  bench_dip: { startFactor: 0 },
  band_pushdown: { startFactor: 0 },
  band_lateral_raise: { startFactor: 0 },
  pike_pushup: { startFactor: 0 },
  band_ohp: { startFactor: 0 },
  inverted_row_smith: { startFactor: 0 },
  band_face_pull: { startFactor: 0 },
  band_row: { startFactor: 0 },
  band_curl: { startFactor: 0 },
  pullup: { startFactor: 0 },
  chinup: { startFactor: 0 },
  negative_pullup: { startFactor: 0 },
  band_pulldown: { startFactor: 0 },
  heel_drop_ecc: { startFactor: 0 },
  standing_calf_bw: { startFactor: 0 },
  seated_calf_bw: { startFactor: 0 },
  tibialis_raise: { startFactor: 0 },
  band_lateral_walk: { startFactor: 0 },
  band_hip_abduction_seated: { startFactor: 0 },
  standing_band_abduction: { startFactor: 0 },
  clamshell: { startFactor: 0 },
  monster_walk: { startFactor: 0 },
  side_lying_abduction: { startFactor: 0 },
  side_plank_leg_lift: { startFactor: 0 },
  ab_roller_ex: { startFactor: 0 },
  plank: { startFactor: 0 },
  dead_bug: { startFactor: 0 },
  side_plank: { startFactor: 0 },
  hanging_knee_raise: { startFactor: 0 },
  pallof_press: { startFactor: 0 },
  split_squat_bw: { startFactor: 0 },
  step_up_bw: { startFactor: 0 },
  single_leg_glute_bridge: { startFactor: 0 },
}
