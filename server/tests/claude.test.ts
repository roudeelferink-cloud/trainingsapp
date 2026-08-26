import { afterEach, describe, expect, it } from 'vitest'
import { maakClaudeClient } from '../src/claude'
import type { Config } from '../src/config'
import { isReviewFout } from '../src/fouten'
import { SCHEMA } from '../src/prompt'
import { buildSignalen } from '../src/signalen'
import { NEP_ADVIES, bericht, startNepApi, type NepApi } from './nepApi'
import { VANDAAG, robState } from './helpers'

/**
 * De aanroep zelf, over een echte verbinding naar een nagebootste API.
 *
 * Elke andere test in deze map vervangt `ModelClient` door een functie. Handig, maar het
 * betekent dat `claude.ts` — het enige stuk dat het netwerk op gaat en het enige stuk dat
 * het schema meestuurt — nergens geraakt werd. Daar zat de fout die pas bij de eerste
 * echte aanroep boven kwam. Deze tests dekken dat gat.
 */

let api: NepApi | null = null

afterEach(async () => {
  if (api) await api.stop()
  api = null
})

function config(over: Partial<Config> = {}): Config {
  return {
    apiKey: 'sk-test',
    model: 'claude-opus-5',
    effort: 'high',
    maxTokens: 8000,
    weken: 8,
    host: '127.0.0.1',
    port: 8098,
    cacheFile: 'data/reviews.json',
    // kort, zodat een test die op een dood adres praat niet minutenlang wacht
    timeoutMs: 5_000,
    baseUrl: null,
    ...over,
  }
}

const signalen = () => buildSignalen(robState(), VANDAAG, 8)

describe('de echte aanroep', () => {
  it('wordt door de API geaccepteerd met het schema zoals het nu is', async () => {
    api = await startNepApi()
    const uit = await maakClaudeClient(config({ baseUrl: api.url })).vraag(signalen())

    expect(uit).toEqual(NEP_ADVIES)
    expect(api.verzoeken).toHaveLength(1)
  })

  it('stuurt het verzoek zoals bedoeld: model, denkwerk, effort en het antwoordformaat', async () => {
    api = await startNepApi()
    await maakClaudeClient(config({ baseUrl: api.url })).vraag(signalen())

    const { body, betaHeader } = api.verzoeken[0]
    expect(body.model).toBe('claude-opus-5')
    expect(body.max_tokens).toBe(8000)
    expect(body.thinking).toEqual({ type: 'adaptive' })
    expect(body.output_config.effort).toBe('high')
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.output_config.format.schema).toEqual(JSON.parse(JSON.stringify(SCHEMA)))
    expect(body.fallbacks).toBe('default')
    expect(betaHeader).toContain('server-side-fallback')
  })

  it('stuurt de uitgerekende signalen mee en geen rauwe setjes', async () => {
    api = await startNepApi()
    await maakClaudeClient(config({ baseUrl: api.url })).vraag(signalen())

    const prompt = api.verzoeken[0].body.messages[0].content as string
    expect(prompt).toContain('progressie')
    expect(prompt).toContain('hardlopen')
    expect(prompt).not.toContain('entries')
  })

  /**
   * De regressie waar het om begonnen is. Zou iemand `maxItems` of `minItems: 2`
   * terugzetten, dan valt deze test om in plaats van de eerste echte aanroep.
   */
  it('loopt stuk op een schema met maxItems of minItems boven 1', async () => {
    api = await startNepApi({
      antwoord: () => bericht(NEP_ADVIES),
    })
    // dezelfde client, maar met een schema zoals het was toen het misging
    const stukSchema = {
      type: 'object',
      properties: {
        signalen: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
      },
      required: ['signalen'],
      additionalProperties: false,
    }
    const res = await fetch(`${api.url}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-5',
        output_config: { format: { type: 'json_schema', schema: stukSchema } },
      }),
    })

    expect(res.status).toBe(400)
    const uit = (await res.json()) as { error: { message: string } }
    expect(uit.error.message).toContain('maxItems')
    expect(uit.error.message).toContain('minItems')
  })

  it('valt terug op een aanroep zonder de terugvalparameter als het account die niet kent', async () => {
    api = await startNepApi({ weigerEersteAanroepen: 1 })
    const uit = await maakClaudeClient(config({ baseUrl: api.url })).vraag(signalen())

    expect(uit).toEqual(NEP_ADVIES)
    expect(api.verzoeken).toHaveLength(2)
    expect(api.verzoeken[0].body.fallbacks).toBe('default')
    expect(api.verzoeken[1].body.fallbacks).toBeUndefined()
    expect(api.verzoeken[1].body.output_config.format.type).toBe('json_schema')
  })

  const stukke: [string, () => Record<string, unknown>][] = [
    ['het model weigert', () => bericht('', { stop_reason: 'refusal' })],
    ['het antwoord tegen de tokengrens loopt', () => bericht('{"sig', { stop_reason: 'max_tokens' })],
    ['er geen tekst in staat', () => bericht('', { content: [] })],
    ['de tekst geen JSON is', () => bericht('Hier komt geen JSON, alleen een zin.')],
  ]

  for (const [wat, antwoord] of stukke) {
    it(`geeft een kapot_antwoord als ${wat}`, async () => {
      api = await startNepApi({ antwoord })
      try {
        await maakClaudeClient(config({ baseUrl: api.url })).vraag(signalen())
        throw new Error('had moeten falen')
      } catch (e) {
        expect(isReviewFout(e)).toBe(true)
        if (isReviewFout(e)) expect(e.code).toBe('kapot_antwoord')
      }
    })
  }

  it('geeft een api_onbereikbaar als er niets luistert, met de reden erbij', async () => {
    // poort 1 is gereserveerd en luistert nergens; geen retries, anders duurt dit lang
    const client = maakClaudeClient(config({ baseUrl: 'http://127.0.0.1:1', timeoutMs: 2_000 }))
    try {
      await client.vraag(signalen())
      throw new Error('had moeten falen')
    } catch (e) {
      expect(isReviewFout(e)).toBe(true)
      if (isReviewFout(e)) {
        expect(e.code).toBe('api_onbereikbaar')
        expect(e.status).toBe(502)
        expect(e.message).toContain('geen antwoord')
      }
    }
  }, 30_000)

  it('geeft een api_onbereikbaar als de API het verzoek blijft weigeren', async () => {
    // twee weigeringen: de eerste aanroep én de herkansing zonder terugvalparameter.
    // Zo zou een schema dat de API niet accepteert er ook uitzien.
    api = await startNepApi({ weigerEersteAanroepen: 2 })
    try {
      await maakClaudeClient(config({ baseUrl: api.url })).vraag(signalen())
      throw new Error('had moeten falen')
    } catch (e) {
      expect(isReviewFout(e)).toBe(true)
      if (isReviewFout(e)) {
        expect(e.code).toBe('api_onbereikbaar')
        // de melding van de API staat erin, anders is dit niet te vinden in de log
        expect(e.message).toContain('fallbacks')
      }
    }
  })

  it('vraagt niets zolang er geen sleutel is', () => {
    try {
      maakClaudeClient(config({ apiKey: null }))
      throw new Error('had moeten falen')
    } catch (e) {
      expect(isReviewFout(e)).toBe(true)
      if (isReviewFout(e)) expect(e.code).toBe('geen_sleutel')
    }
  })
})
