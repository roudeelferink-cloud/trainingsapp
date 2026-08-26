import { parseAdvies } from './advies'
import { MAX_POGINGEN, type Cache } from './cache'
import type { ModelClient } from './claude'
import { ReviewFout } from './fouten'
import { buildSignalen } from './signalen'
import { parseVerzoek } from './verzoek'
import type { ReviewAdvies } from '../../src/types'

/**
 * De endpoint zelf, zonder HTTP eromheen.
 *
 * Alles wat er te beslissen valt staat hier, en het is met opzet weinig: is er een advies
 * van vandaag, geef dat terug; anders, als de daglimiet het toelaat, één aanroep, keuren,
 * bewaren, teruggeven. Faalt er iets, dan komt er een `ReviewFout` uit met een code, en
 * nooit een half advies.
 */

export interface Antwoord {
  profiel: string
  datum: string
  gegenereerdOp: string
  /** kwam dit uit de dagcache in plaats van uit een nieuwe aanroep? */
  gecached: boolean
  review: ReviewAdvies
}

export interface Deps {
  /** de client wordt pas gemaakt als hij nodig is; zonder sleutel gooit hij meteen */
  client: () => ModelClient
  cache: Cache
  /** hoeveel weken er in de samenvatting gaan */
  weken: number
  nu: () => Date
}

export async function handleReview(raw: unknown, deps: Deps): Promise<Antwoord> {
  const { profiel, vandaag, user } = parseVerzoek(raw, deps.nu())

  const bestaand = deps.cache.lees(profiel)
  const vanVandaag = bestaand && bestaand.datum === vandaag ? bestaand : null

  if (vanVandaag?.review) {
    return {
      profiel,
      datum: vandaag,
      gegenereerdOp: vanVandaag.gegenereerdOp ?? deps.nu().toISOString(),
      gecached: true,
      review: vanVandaag.review,
    }
  }

  const pogingen = vanVandaag?.pogingen ?? 0
  if (pogingen >= MAX_POGINGEN) {
    throw new ReviewFout(
      'te_vaak',
      `Vandaag al ${pogingen} keer geprobeerd voor ${profiel}. Morgen weer.`,
    )
  }

  // de teller gaat omhoog vóór de aanroep: een aanroep die halverwege sneuvelt is ook
  // een aanroep, en anders is de daglimiet met een kapot netwerk zo omzeild
  deps.cache.schrijf(profiel, {
    datum: vandaag,
    pogingen: pogingen + 1,
    gegenereerdOp: vanVandaag?.gegenereerdOp ?? null,
    review: null,
  })

  const signalen = buildSignalen(user, vandaag, deps.weken)
  const ruw = await deps.client().vraag(signalen)
  const review = parseAdvies(ruw)

  const gegenereerdOp = deps.nu().toISOString()
  deps.cache.schrijf(profiel, {
    datum: vandaag,
    pogingen: pogingen + 1,
    gegenereerdOp,
    review,
  })

  return { profiel, datum: vandaag, gegenereerdOp, gecached: false, review }
}
