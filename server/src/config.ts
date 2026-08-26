import { readFileSync } from 'node:fs'

/**
 * Instellingen, uit de omgeving.
 *
 * De sleutel staat in `server/.env` en nergens anders — dat is de hele reden dat dit
 * servertje bestaat. In de oude opzet ging de app als statische bundel naar GitHub
 * Pages, en alles wat een browser kan uitvoeren kan een bezoeker lezen; een key in die
 * bundel is een key die op straat ligt. Nu praat de browser met dit servertje, en het
 * servertje met de API.
 *
 * Er zit bewust geen dotenv-pakket in: een `.env` is een lijst `NAAM=waarde`, en dat is
 * twintig regels code die je zelf kunt lezen.
 */

export interface Config {
  /** null als er geen sleutel is; het servertje start dan wel, maar zegt dat eerlijk */
  apiKey: string | null
  model: string
  effort: string
  maxTokens: number
  /** hoeveel weken er in de samenvatting gaan */
  weken: number
  host: string
  port: number
  /** bestand waar de dagcache in staat */
  cacheFile: string
  /** hoe lang een API-aanroep mag duren */
  timeoutMs: number
}

/**
 * Claude Opus 5. Eén aanroep per profiel per dag over een samenvatting van een paar
 * duizend tokens; het oordeel ís hier het product, dus dat is niet waar je op bezuinigt.
 * Goedkoper kan met `claude-sonnet-5` via REVIEW_MODEL.
 */
export const STANDAARD_MODEL = 'claude-opus-5'

export function loadEnvFile(pad: string, env: NodeJS.ProcessEnv = process.env): void {
  let inhoud: string
  try {
    inhoud = readFileSync(pad, 'utf8')
  } catch {
    return // geen .env is geen fout: op een server mag alles uit de omgeving komen
  }
  for (const regel of inhoud.split('\n')) {
    const trimmed = regel.trim()
    if (trimmed === '' || trimmed.startsWith('#')) continue
    const is = trimmed.indexOf('=')
    if (is <= 0) continue
    const naam = trimmed.slice(0, is).trim()
    let waarde = trimmed.slice(is + 1).trim()
    if (
      (waarde.startsWith('"') && waarde.endsWith('"')) ||
      (waarde.startsWith("'") && waarde.endsWith("'"))
    ) {
      waarde = waarde.slice(1, -1)
    }
    // wat al in de omgeving staat wint: zo kan docker-compose of systemd erover heen
    if (env[naam] === undefined) env[naam] = waarde
  }
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    apiKey: nietLeeg(env.ANTHROPIC_API_KEY),
    model: nietLeeg(env.REVIEW_MODEL) ?? STANDAARD_MODEL,
    effort: nietLeeg(env.REVIEW_EFFORT) ?? 'high',
    maxTokens: getal(env.REVIEW_MAX_TOKENS, 8000),
    weken: getal(env.REVIEW_WEKEN, 8),
    host: nietLeeg(env.REVIEW_HOST) ?? '127.0.0.1',
    port: getal(env.REVIEW_PORT, 8098),
    cacheFile: nietLeeg(env.REVIEW_CACHE_FILE) ?? 'data/reviews.json',
    timeoutMs: getal(env.REVIEW_TIMEOUT_MS, 180_000),
  }
}

function nietLeeg(v: string | undefined): string | null {
  const s = (v ?? '').trim()
  return s === '' ? null : s
}

function getal(v: string | undefined, standaard: number): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : standaard
}
