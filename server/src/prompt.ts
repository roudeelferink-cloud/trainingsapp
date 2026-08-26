import type { Signalen } from './signalen'

/**
 * De prompt.
 *
 * Vertrekpunt is de wekelijkse review uit `~/trainingsreview`: dezelfde nuchtere toon,
 * dezelfde drie vragen (wat valt op / waar bouw ik te snel op / wat mag omhoog), en
 * dezelfde regel dat "niets bijzonders" een geldig antwoord is. Twee dingen zijn anders,
 * en allebei met opzet:
 *
 * 1. **De app rekent, het model oordeelt.** De review las een ruwe export en liet het
 *    model zelf optellen. Hier gaan de guardrails van de app zelf mee — plafond,
 *    rollend gemiddelde, deloadtrigger, benen voor de duurloop — en staat er hard in de
 *    opdracht dat er niets bijgerekend mag worden. Een advies dat andere getallen noemt
 *    dan het scherm ernaast is erger dan geen advies.
 * 2. **Vaste vorm terug.** Geen Markdown met kopjes voor in een mail, maar drie velden
 *    voor een blok in de app. Dat scheelt parsen en het scheelt half advies: `validate.ts`
 *    keurt het antwoord af als er iets ontbreekt.
 */

export const SYSTEM =
  'Je bent een nuchtere hardloop- en krachtcoach die één keer per dag meekijkt met een ' +
  'trainingsapp. Je krijgt de signalen die de app zelf heeft uitgerekend: het weekplafond ' +
  'voor het hardlopen en waar dat op rust, de deloadbeslissing en de aanleiding, de ' +
  'guardrails van vandaag, de beoordeling van de sessies, slaap, energie en benen, en per ' +
  'week de kilometers en het tilvolume.\n\n' +
  'Alle getallen zijn al uitgerekend. Neem ze over zoals ze er staan, reken er niets bij ' +
  'en noem geen getal dat niet in de gegevens voorkomt: de app toont dezelfde cijfers op ' +
  'het scherm ernaast, en twee verschillende versies van hetzelfde getal maken het advies ' +
  'waardeloos.\n\n' +
  'Schrijf in het Nederlands, in de je-vorm, kort en concreet. Geen slagen om de arm, geen ' +
  'algemene trainingswijsheid, geen aanmoediging. Is er niets te melden, zeg dat dan — ' +
  '"niets bijzonders deze week" is een geldig antwoord en beter dan iets verzinnen.'

/**
 * De vorm die terugkomt. Bewust klein en volledig verplicht: drie velden, allemaal
 * gevuld, geen open uiteinden. `additionalProperties: false` houdt er een veld dat
 * niemand verwacht uit.
 */
export const SCHEMA = {
  type: 'object',
  properties: {
    signalen: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: { type: 'string' },
      description:
        'Wat opvalt in de gegevens, per regel één ding, met het getal erbij waar de ' +
        'uitspraak op rust. Eén zin per regel.',
    },
    advies: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: { type: 'string' },
      description:
        'Wat je ermee zou doen. Concreet: welke oefening of welke loop, en welke stap. ' +
        'Eén zin per regel.',
    },
    toon: {
      type: 'string',
      description:
        'Eén korte zin die samenvat hoe het ervoor staat, als opening boven de rest.',
    },
  },
  required: ['signalen', 'advies', 'toon'],
  additionalProperties: false,
} as const

export function buildPrompt(signalen: Signalen): string {
  return `Hieronder de signalen van vandaag, als JSON. De app heeft ze zelf uitgerekend.

${JSON.stringify(signalen, null, 1)}

Beantwoord deze drie vragen, in deze volgorde, met de velden van het antwoordformaat:

- \`signalen\`: wat valt op in het patroon over de weken? Wat verandert er, en aan welk
  getal zie je dat?
- \`advies\`: waar bouwt de belasting sneller op dan het herstel bijhoudt, en waar is juist
  ruimte? Kijk naar de combinatie van kilometers, tilvolume, sessies die als 'zwaar'
  beoordeeld zijn, en slaap, energie en benen. Zeg per regel wat je zou doen.
- \`toon\`: één zin die de stand samenvat.

De guardrails die de app vandaag zelf toont staan er al; herhaal ze niet woordelijk, maar
gebruik ze wel als context. Is er weinig gelogd, zeg dat dan en houd het kort.`
}
