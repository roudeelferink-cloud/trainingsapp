import Anthropic from '@anthropic-ai/sdk'
import type { Config } from './config'
import { ReviewFout } from './fouten'
import { SCHEMA, SYSTEM, buildPrompt } from './prompt'
import type { Signalen } from './signalen'

/**
 * De aanroep naar Claude.
 *
 * Dit is de enige plek in het servertje die het netwerk op gaat, en dat is met opzet:
 * de rest — signalen bouwen, het antwoord keuren, de dagcache — is gewone code die je
 * zonder API kunt draaien en testen. De naad is `ModelClient`.
 *
 * Wat hier terugkomt is rúw. De keuring staat in `advies.ts`, zodat een antwoord dat
 * niet klopt precies dezelfde weg volgt of het nu van het model komt of van een test.
 */
export interface ModelClient {
  vraag(signalen: Signalen): Promise<unknown>
}

/** Beta-vlag voor de terugval bij een weigering; zie `maakClaudeClient`. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export function maakClaudeClient(config: Config): ModelClient {
  if (!config.apiKey) {
    throw new ReviewFout(
      'geen_sleutel',
      'Er staat geen ANTHROPIC_API_KEY in de omgeving. Zet hem in server/.env.',
    )
  }
  const client = new Anthropic({
    apiKey: config.apiKey,
    timeout: config.timeoutMs,
    maxRetries: 2,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  })

  return {
    async vraag(signalen: Signalen): Promise<unknown> {
      const params = {
        model: config.model,
        max_tokens: config.maxTokens,
        system: SYSTEM,
        messages: [{ role: 'user' as const, content: buildPrompt(signalen) }],
        thinking: { type: 'adaptive' as const },
        output_config: { effort: config.effort, format: { type: 'json_schema', schema: SCHEMA } },
      }

      let response: Anthropic.Messages.Message
      try {
        // Terugval aan de serverkant: weigert het model de vraag — onwaarschijnlijk bij
        // trainingsgegevens, maar het kost niets om het af te vangen — dan draait
        // dezelfde vraag binnen dezelfde aanroep op een ander model, in plaats van dat
        // het adviesblok met lege handen eindigt. Kent het account de parameter niet,
        // dan geeft de API een 400 en gaat het gewoon zonder.
        try {
          response = (await client.beta.messages.create({
            betas: [FALLBACK_BETA],
            fallbacks: 'default',
            ...params,
          } as never)) as Anthropic.Messages.Message
        } catch (e) {
          if (!(e instanceof Anthropic.BadRequestError)) throw e
          response = await client.messages.create(params as never)
        }
      } catch (e) {
        throw new ReviewFout('api_onbereikbaar', `De Claude-API gaf geen antwoord: ${uitleg(e)}`)
      }

      if (response.stop_reason === 'refusal') {
        throw new ReviewFout('kapot_antwoord', 'Het model weigerde de vraag.')
      }
      if (response.stop_reason === 'max_tokens') {
        throw new ReviewFout('kapot_antwoord', 'Het antwoord liep tegen de tokengrens aan.')
      }

      const tekst = response.content
        .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim()

      if (tekst === '') {
        throw new ReviewFout('kapot_antwoord', 'Het antwoord bevatte geen tekst.')
      }
      try {
        return JSON.parse(tekst)
      } catch {
        throw new ReviewFout('kapot_antwoord', 'Het antwoord was geen geldige JSON.')
      }
    },
  }
}

function uitleg(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
