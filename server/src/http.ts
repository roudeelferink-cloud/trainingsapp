import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { isReviewFout } from './fouten'
import { handleReview, type Deps } from './review'

/**
 * Het HTTP-laagje.
 *
 * Twee routes en verder niets: `POST /api/review` en `GET /healthz` voor de
 * containercontrole. Geen framework — dit is het hele oppervlak, en `node:http` doet het
 * prima.
 *
 * Er staat bewust geen CORS in. De app wordt door dezelfde nginx uitgeserveerd als deze
 * endpoint, dus alles komt van dezelfde origin; een verzoek van elders hoort hier niet
 * te lukken en krijgt dus ook geen toestemming.
 */

/** De staat van twee gebruikers met jaren historie is groot, maar niet zó groot. */
export const MAX_BODY_BYTES = 8 * 1024 * 1024

export function maakServer(deps: Deps): Server {
  return createServer((req, res) => {
    void route(req, res, deps).catch((e) => {
      // laatste vangnet: hier komt alleen iets terecht wat nergens anders gevangen is
      log('onverwachte fout', e)
      stuur(res, 500, { fout: 'onbekend', bericht: 'Er ging iets mis in de server.' })
    })
  })
}

async function route(req: IncomingMessage, res: ServerResponse, deps: Deps): Promise<void> {
  const pad = (req.url ?? '').split('?')[0]

  if (req.method === 'GET' && pad === '/healthz') {
    stuur(res, 200, { ok: true })
    return
  }

  if (pad !== '/api/review') {
    stuur(res, 404, { fout: 'onbekend_pad', bericht: 'Deze server kent alleen /api/review.' })
    return
  }
  if (req.method !== 'POST') {
    stuur(res, 405, { fout: 'verkeerde_methode', bericht: 'Gebruik POST.' })
    return
  }

  let raw: unknown
  try {
    const body = await leesBody(req)
    raw = JSON.parse(body)
  } catch (e) {
    stuur(res, 400, { fout: 'verzoek', bericht: e instanceof Error ? e.message : 'Onleesbaar verzoek.' })
    return
  }

  try {
    const antwoord = await handleReview(raw, deps)
    log(`advies voor ${antwoord.profiel} (${antwoord.datum})${antwoord.gecached ? ', uit de cache' : ''}`)
    stuur(res, 200, antwoord)
  } catch (e) {
    if (isReviewFout(e)) {
      log(`${e.code}: ${e.message}`)
      stuur(res, e.status, { fout: e.code, bericht: e.message })
      return
    }
    throw e
  }
}

function leesBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const delen: Buffer[] = []
    let bytes = 0
    req.on('data', (deel: Buffer) => {
      bytes += deel.length
      if (bytes > MAX_BODY_BYTES) {
        reject(new Error('Het verzoek is te groot.'))
        req.destroy()
        return
      }
      delen.push(deel)
    })
    req.on('end', () => resolve(Buffer.concat(delen).toString('utf8')))
    req.on('error', reject)
  })
}

function stuur(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return
  const tekst = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(tekst),
    // een advies is van vandaag en van dit profiel; niets ervan hoort in een cache
    'Cache-Control': 'no-store',
  })
  res.end(tekst)
}

export function log(bericht: string, e?: unknown): void {
  const stamp = new Date().toISOString()
  if (e !== undefined) console.error(`[${stamp}] ${bericht}`, e)
  else console.log(`[${stamp}] ${bericht}`)
}
