import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseAdvies } from './advies'
import type { ReviewAdvies } from '../../src/types'

/**
 * De dagcache, en daarmee de rem.
 *
 * Eén regel per profiel: van welke dag het advies is, hoe vaak er die dag al een aanroep
 * geprobeerd is, en het advies zelf. Daar liggen twee dingen tegelijk in vast:
 *
 * - **Opnieuw openen kost niets.** Is er een advies van vandaag, dan gaat het gewoon
 *   terug; er wordt niets opnieuw gevraagd.
 * - **Een kapotte dag kost ook niet veel.** Een mislukte aanroep levert geen advies op,
 *   dus zonder teller zou elke nieuwe poging een nieuwe aanroep zijn. De teller telt
 *   pogingen, niet successen, en gaat vóór de aanroep omhoog — een aanroep die halverwege
 *   sneuvelt telt dus gewoon mee.
 *
 * Het bestand is de hele opslag. Twee profielen, één regel per stuk: een database zou
 * hier meer onderhoud kosten dan hij oplost.
 */

/** Hoeveel aanroepen een profiel per dag maximaal mag doen. */
export const MAX_POGINGEN = 3

export interface CacheRegel {
  /** de dag waar deze regel over gaat */
  datum: string
  /** aantal aanroepen dat er die dag geprobeerd is */
  pogingen: number
  /** ISO-tijdstip van het advies; null zolang er geen advies is */
  gegenereerdOp: string | null
  review: ReviewAdvies | null
}

export interface Cache {
  lees(profiel: string): CacheRegel | null
  schrijf(profiel: string, regel: CacheRegel): void
}

/** Cache in het geheugen. Voor tests, en voor draaien zonder schrijfrechten. */
export function geheugenCache(): Cache {
  const regels = new Map<string, CacheRegel>()
  return {
    lees: (profiel) => regels.get(profiel) ?? null,
    schrijf: (profiel, regel) => void regels.set(profiel, regel),
  }
}

/**
 * Cache in een JSON-bestand. Schrijft eerst naast het bestand en hernoemt daarna, zodat
 * een herstart midden in het schrijven geen half bestand achterlaat.
 */
export function bestandsCache(pad: string): Cache {
  return {
    lees(profiel) {
      const alles = leesBestand(pad)
      return alles[profiel] ?? null
    },
    schrijf(profiel, regel) {
      const alles = leesBestand(pad)
      alles[profiel] = regel
      const map = dirname(pad)
      if (map && map !== '.') mkdirSync(map, { recursive: true })
      const tijdelijk = `${pad}.tmp`
      writeFileSync(tijdelijk, `${JSON.stringify(alles, null, 2)}\n`, 'utf8')
      renameSync(tijdelijk, pad)
    },
  }
}

/**
 * Leest het bestand. Een bestand dat er niet is, of dat niet te lezen valt, is een lege
 * cache: dan kost het hooguit een extra aanroep, en dat is beter dan een servertje dat
 * niet meer start omdat er een regel scheef staat.
 */
function leesBestand(pad: string): Record<string, CacheRegel> {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(pad, 'utf8'))
  } catch {
    return {}
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}

  const uit: Record<string, CacheRegel> = {}
  for (const [profiel, regel] of Object.entries(raw as Record<string, unknown>)) {
    const schoon = leesRegel(regel)
    if (schoon) uit[profiel] = schoon
  }
  return uit
}

function leesRegel(raw: unknown): CacheRegel | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.datum !== 'string') return null

  let review: ReviewAdvies | null = null
  if (r.review != null) {
    try {
      review = parseAdvies(r.review)
    } catch {
      // half advies uit een oud bestand telt als geen advies; er komt vandaag een nieuw
      review = null
    }
  }
  return {
    datum: r.datum,
    pogingen: typeof r.pogingen === 'number' && r.pogingen >= 0 ? Math.floor(r.pogingen) : 0,
    gegenereerdOp: typeof r.gegenereerdOp === 'string' ? r.gegenereerdOp : null,
    review,
  }
}
