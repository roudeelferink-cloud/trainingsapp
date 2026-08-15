import { BAR_IDS, DEFAULT_BAR_WEIGHTS } from '../logic/barWeight'
import type { LoadArea, MaintenanceItem, Sensitivity, Settings } from '../types'

/**
 * Eén plek waar een `Settings`-object heel gemaakt wordt.
 *
 * Instellingen groeien mee met de app: er kwamen gevoelige gebieden bij, later de
 * stanggewichten. Data die van eerder komt — localStorage, een importbestand, of een
 * toestel van de ander dat nog op een oudere versie draait — mist die velden dan. De
 * schermen lezen er zonder omhaal op door (`settings.sensitive[gebied]`), dus een
 * ontbrekend veld sloopt de hele render.
 *
 * Daarom gaat alles wat van buiten binnenkomt hier eerst doorheen: de migratie, de
 * store bij het laden, en de synclaag bij een binnengekomen document. Ontbrekende of
 * onleesbare velden krijgen de standaard, ingevulde waarden blijven staan.
 */

export const ALL_AREAS: LoadArea[] = [
  'knee_deep',
  'hip_deep',
  'achilles',
  'calf',
  'lateral_hip',
  'lower_back',
  'shoulder',
]

const SENSITIVITIES: string[] = ['ok', 'careful', 'off']

export const DEFAULT_PROTEIN_FACTOR = 1.8

/**
 * Vaste gebruikersids van dit huishouden. Ze staan hier omdat de startinstellingen
 * per gebruiker verschillen; store.ts exporteert ze door voor de rest van de app.
 */
export const ROB = 'rob'
export const ANOUC = 'anouc'

/** Vaste startlijst van de dagelijkse onderhoudschecklist. */
export function defaultMaintenanceItems(): MaintenanceItem[] {
  return [
    { id: 'heeldrops', label: 'Excentrische heel drops (3x15 per been)' },
    { id: 'heupmobiliteit', label: 'Mobiliteit heup 5 min' },
  ]
}

export function defaultSettings(): Settings {
  return {
    bodyweightKg: null,
    sensitive: Object.fromEntries(ALL_AREAS.map((a) => [a, 'ok'])) as Record<LoadArea, Sensitivity>,
    travelMode: false,
    maintenanceItems: defaultMaintenanceItems(),
    proteinFactor: DEFAULT_PROTEIN_FACTOR,
    barWeights: { ...DEFAULT_BAR_WEIGHTS },
  }
}

/**
 * Startinstellingen van één gebruiker. Alleen dit is de plek waar een voorkeur bij het
 * begin gezet wordt; migratie en normalisatie vullen daarna nooit méér in dan wat er
 * ontbreekt.
 */
export function defaultSettingsFor(userId: string): Settings {
  const settings = defaultSettings()
  // Rob traint met een gevoelige zijkant van de heup; dat is zijn startpunt, geen regel.
  if (userId === ROB) settings.sensitive.lateral_hip = 'careful'
  return settings
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Alleen items met een bruikbaar id en label; ontbreekt de lijst, dan de terugval. */
function normalizeMaintenance(raw: unknown, terugval: MaintenanceItem[]): MaintenanceItem[] {
  if (!Array.isArray(raw)) return terugval
  const out: MaintenanceItem[] = []
  for (const item of raw) {
    if (!isObject(item)) continue
    const { id, label } = item
    if (typeof id === 'string' && id && typeof label === 'string' && label.trim()) {
      out.push({ id, label: label.trim() })
    }
  }
  return out
}

/**
 * Maakt van willekeurige opgeslagen data een volledig `Settings`-object. Crasht nooit:
 * wat niet klopt valt terug op `fallback`, standaard de kale standaardinstellingen. Geef
 * de instellingen mee die er al zijn en een half binnengekomen object wist ze niet.
 * Onbekende velden — bijvoorbeeld van een toestel dat al een nieuwere versie draait —
 * blijven bewaard, zodat een rondje door deze app ze niet stilletjes weggooit.
 */
export function normalizeSettings(raw: unknown, fallback?: Settings): Settings {
  const base = fallback ?? defaultSettings()
  const s = isObject(raw) ? raw : {}

  const rawSensitive = isObject(s.sensitive) ? s.sensitive : {}
  const sensitive = { ...base.sensitive }
  for (const area of ALL_AREAS) {
    const v = rawSensitive[area]
    if (typeof v === 'string' && SENSITIVITIES.includes(v)) sensitive[area] = v as Sensitivity
  }

  const rawBars = isObject(s.barWeights) ? s.barWeights : {}
  const barWeights = { ...base.barWeights }
  for (const bar of BAR_IDS) {
    const kg = Number(rawBars[bar])
    if (Number.isFinite(kg) && kg > 0) barWeights[bar] = kg
  }

  const bodyweight = Number(s.bodyweightKg)
  const factor = Number(s.proteinFactor)

  return {
    ...s,
    bodyweightKg: Number.isFinite(bodyweight) && bodyweight > 0 ? bodyweight : null,
    sensitive,
    travelMode: s.travelMode === true,
    maintenanceItems: normalizeMaintenance(s.maintenanceItems, base.maintenanceItems),
    proteinFactor: Number.isFinite(factor) && factor > 0 ? factor : base.proteinFactor,
    barWeights,
  }
}
