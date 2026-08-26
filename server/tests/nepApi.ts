import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { schemaOvertredingen } from './schemaRegels'

/**
 * Een nagebootste Claude-API, streng op de dingen waar de echte streng op is.
 *
 * Waarom dit er is: alle andere tests vervangen `ModelClient` door een functie die een
 * object teruggeeft. Daarmee is alles getest behálve de aanroep zelf — en precies daar
 * zat de fout. Het schema bevatte `minItems: 2` en `maxItems`, structured output kent
 * dat niet, en de echte API gaf een 400. Duizend groene tests hebben dat gemist, omdat
 * geen enkele het schema ooit aan iets liet zien.
 *
 * Dit servertje kijkt er wél naar. Het weigert een verzoek met een schema dat de echte
 * API zou weigeren, met dezelfde vorm foutmelding, zodat `claude.ts` er echt tegenaan
 * praat over een echte verbinding.
 */

export interface Ontvangen {
  pad: string
  betaHeader: string | undefined
  body: Record<string, any>
}

export interface NepApi {
  url: string
  /** elk verzoek dat binnenkwam, op volgorde */
  verzoeken: Ontvangen[]
  stop(): Promise<void>
}

export interface NepApiOpties {
  /** wat het model teruggeeft; standaard een geldig advies als JSON-tekst */
  antwoord?: (body: Record<string, any>) => Record<string, unknown>
  /** geeft de eerste `n` aanroepen een 400, zoals een account dat een beta niet kent */
  weigerEersteAanroepen?: number
}

export const NEP_ADVIES = {
  signalen: ['Drie weken op rij meer gelopen: 29, 30 en 31 km.', 'Twee lopen als zwaar beoordeeld.'],
  advies: ['Houd de duurloop deze week op 13,5 km.'],
  toon: 'Het loopt, maar het herstel blijft achter.',
}

/** Een gewoon antwoord van het model: één tekstblok met de JSON erin. */
export function bericht(inhoud: unknown, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text: typeof inhoud === 'string' ? inhoud : JSON.stringify(inhoud) }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 3000, output_tokens: 200 },
    ...over,
  }
}

export async function startNepApi(opties: NepApiOpties = {}): Promise<NepApi> {
  const verzoeken: Ontvangen[] = []
  let geweigerd = 0

  const server: Server = createServer((req, res) => {
    let ruw = ''
    req.on('data', (c) => (ruw += c))
    req.on('end', () => {
      let body: Record<string, any> = {}
      try {
        body = JSON.parse(ruw || '{}')
      } catch {
        return fout(400, 'invalid_request_error', 'Onleesbare JSON.')
      }
      verzoeken.push({
        pad: req.url ?? '',
        betaHeader: req.headers['anthropic-beta'] as string | undefined,
        body,
      })

      if (geweigerd < (opties.weigerEersteAanroepen ?? 0)) {
        geweigerd++
        return fout(400, 'invalid_request_error', 'Unexpected parameter: fallbacks')
      }

      // Hier zit de hele reden dat dit bestaat: het schema keuren zoals de API dat doet.
      const schema = body?.output_config?.format?.schema
      if (schema !== undefined) {
        const overtredingen = schemaOvertredingen(schema)
        if (overtredingen.length > 0) {
          const uitleg = overtredingen.map((o) => `${o.pad}: ${o.regel}`).join('; ')
          return fout(400, 'invalid_request_error', `output_config.format.schema: ${uitleg}`)
        }
      }

      const uit = opties.antwoord ? opties.antwoord(body) : bericht(NEP_ADVIES)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(uit))
    })

    function fout(status: number, type: string, message: string) {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ type: 'error', error: { type, message } }))
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    verzoeken,
    stop: () => new Promise<void>((resolve) => void server.close(() => resolve())),
  }
}
