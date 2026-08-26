import type { AppState, ReviewAdvies, ReviewCache } from '../types'

/**
 * Het advies van de server, aan de kant van de app.
 *
 * De app rekent zelf niets uit met dit advies en stuurt er niets mee bij: alle
 * guardrails, gewichtsvoorstellen en loopafstanden komen precies zoals ze deden uit
 * `guardrails.ts`, `runningLoad.ts`, `deload.ts` en `progression.ts`. Dit komt
 * eróverheen, als een leesbare samenvatting van iemand die meekijkt.
 *
 * Twee regels, en meer is het niet:
 *
 * 1. **Hooguit één advies per dag.** Is het opgeslagen advies van vandaag, dan gaat er
 *    geen verzoek uit. De server bewaakt dezelfde grens nog een keer — dit spaart alleen
 *    het verzoek uit, het is niet de beveiliging.
 * 2. **Stil bij tegenslag.** Geen server, geen netwerk, een kapot antwoord: dan geeft
 *    `fetchReview` `null` terug en blijft er staan wat er stond. Er komt nooit een
 *    foutmelding in beeld — je staat misschien midden in een sessie in een kelder zonder
 *    bereik, en dan is de app níét stuk.
 */

/** Zelfde origin als de app: nginx zet dit door naar het servertje ernaast. */
export const REVIEW_ENDPOINT = '/api/review'

/** Hoe lang een advies meegaat. Eén dag: er is per dag hooguit één te halen. */
export function isFresh(cache: ReviewCache | null | undefined, iso: string): boolean {
  return !!cache && cache.datum === iso
}

/** Moet er vandaag een advies opgehaald worden? */
export function needsFetch(cache: ReviewCache | null | undefined, iso: string): boolean {
  return !isFresh(cache, iso)
}

/** Het antwoord van de server; alleen `review` doet ertoe voor het scherm. */
interface ReviewResponse {
  profiel?: unknown
  datum?: unknown
  gegenereerdOp?: unknown
  review?: unknown
}

/**
 * Is dit een compleet advies? De server valideert hetzelfde, maar dit is de kant die
 * het in de opslag zet: half advies hoort daar niet terecht te komen, ook niet als er
 * ooit iets anders aan die endpoint hangt.
 */
export function isAdvies(v: unknown): v is ReviewAdvies {
  if (!v || typeof v !== 'object') return false
  const a = v as Partial<ReviewAdvies>
  return (
    Array.isArray(a.signalen) &&
    a.signalen.length > 0 &&
    a.signalen.every((s) => typeof s === 'string' && s.trim() !== '') &&
    Array.isArray(a.advies) &&
    a.advies.length > 0 &&
    a.advies.every((s) => typeof s === 'string' && s.trim() !== '') &&
    typeof a.toon === 'string' &&
    a.toon.trim() !== ''
  )
}

export interface FetchOptions {
  /** id van het profiel waarvoor het advies is */
  profiel: string
  /** de dag waarover het gaat */
  vandaag: string
  /** de volledige staat, in dezelfde vorm als de JSON-export */
  state: AppState
  signal?: AbortSignal
  /** injecteerbaar voor tests */
  fetchImpl?: typeof fetch
}

/**
 * De staat in de vorm van de export, maar zonder de pincode.
 *
 * De server doet er niets mee — hij leest alleen de gebruiker waar het advies over gaat —
 * en dan hoort hij hem ook niet te krijgen. Verder gaat alles mee, precies zoals de
 * export het opschrijft: het servertje draait er dezelfde migratie op als de import, en
 * dat werkt alleen als het dezelfde vorm is.
 */
function zonderPin(state: AppState): AppState {
  return { ...state, pin: null }
}

/**
 * Haalt het advies op. Geeft `null` bij elk probleem — geen server, geen netwerk, een
 * foutcode, een antwoord dat niet klopt. De aanroeper hoeft dus niets af te vangen en
 * er is geen pad waarop dit een melding op het scherm oplevert.
 */
export async function fetchReview(opts: FetchOptions): Promise<ReviewCache | null> {
  const doFetch = opts.fetchImpl ?? (typeof fetch === 'function' ? fetch : null)
  if (!doFetch) return null

  let res: Response
  try {
    res = await doFetch(REVIEW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiel: opts.profiel,
        vandaag: opts.vandaag,
        state: zonderPin(opts.state),
      }),
      signal: opts.signal,
    })
  } catch {
    return null // offline, of de Pi staat uit
  }

  if (!res.ok) return null

  let body: ReviewResponse
  try {
    body = (await res.json()) as ReviewResponse
  } catch {
    return null
  }

  if (!isAdvies(body.review)) return null

  return {
    datum: typeof body.datum === 'string' ? body.datum : opts.vandaag,
    gegenereerdOp:
      typeof body.gegenereerdOp === 'string' ? body.gegenereerdOp : new Date().toISOString(),
    review: body.review,
  }
}
