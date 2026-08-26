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
  'Je bent een nuchtere krachtcoach die één keer per dag meekijkt met een trainingsapp. ' +
  'Je krijgt de signalen die de app zelf heeft uitgerekend: de deloadbeslissing en de ' +
  'aanleiding, de guardrails van vandaag, de beoordeling van de sessies, slaap, energie en ' +
  'benen, per week het tilvolume en de gelopen kilometers, en hoe de gewichtsprogressie ' +
  'voor dit profiel is afgesteld.\n\n' +
  'ADVIEZEN GAAN UITSLUITEND OVER KRACHTTRAINING. De app plant het hardlopen niet: ze ' +
  'schrijft geen afstand voor, kent geen weekplafond en bouwt de duurloop niet op. Die ' +
  'planning doet de gebruiker zelf, en daar heb je geen mening over. Gelopen kilometers ' +
  'mag je noemen als feit en als context — drie zware lopen in een week zeggen iets over ' +
  'wat er nog in de benen zit — maar adviseer nooit een afstand, een aantal lopen, een ' +
  'opbouw of een rustdag voor het hardlopen. Ook niet voorzichtig, ook niet als suggestie.' +
  '\n\n' +
  'De gewichtsprogressie loopt op wat er gelogd is: haal je een oefening een aantal sessies ' +
  'op rij helemaal (alle sets, alle reps, niets naar beneden bijgesteld), dan verhoogt de ' +
  'app het gewicht zelf. Hoeveel sessies dat zijn staat per spiergroep in de signalen, en ' +
  'per oefening staat erbij hoe ver de teller staat. Houd je advies daarbij: zeg niet dat ' +
  'er zwaarder getild moet worden als de app dat over twee sessies uit zichzelf doet.\n\n' +
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
 *
 * **Wat hier niet in mag.** Structured output ondersteunt `maxItems` niet, en `minItems`
 * alleen als 0 of 1; een schema met `minItems: 2` of met een `maxItems` erin wordt door
 * de API geweigerd met een 400, en dan komt er helemaal geen advies. De bedoelde grenzen
 * — twee tot vijf signalen, één tot vier adviezen — staan daarom op de twee plekken waar
 * ze wél werken: in de opdracht aan het model (`buildPrompt` en de `description` per
 * veld), en als inkorting achteraf in `advies.ts`. Zet ze hier niet terug;
 * `tests/prompt.test.ts` houdt dat tegen.
 */
export const SCHEMA = {
  type: 'object',
  properties: {
    signalen: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
      description:
        'Twee tot vijf regels: wat opvalt in de gegevens, per regel één ding, met het ' +
        'getal erbij waar de uitspraak op rust. Eén zin per regel.',
    },
    advies: {
      type: 'array',
      minItems: 1,
      items: { type: 'string' },
      description:
        'Eén tot vier regels: wat je ermee zou doen, uitsluitend over krachttraining. ' +
        'Concreet: welke oefening en welke stap. Geen adviezen over hardlopen. Eén zin ' +
        'per regel.',
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

- \`signalen\`: **twee tot vijf regels.** Wat valt op in het patroon over de weken? Wat
  verandert er, en aan welk getal zie je dat?
- \`advies\`: **één tot vier regels, uitsluitend over krachttraining.** Waar bouwt de
  belasting sneller op dan het herstel bijhoudt, en waar is juist ruimte? Kijk naar de
  combinatie van tilvolume, sessies die als 'zwaar' beoordeeld zijn, slaap, energie en
  benen, en de opbouwtellers per oefening. Gelopen kilometers mag je meewegen als
  context, maar geef er geen advies over: welke afstand er gelopen wordt is niet aan de
  app. Zeg per regel wat je zou doen.
- \`toon\`: één zin die de stand samenvat.

Houd je aan die aantallen. Wat je erboven schrijft wordt afgekapt en komt niet in beeld,
dus zet het belangrijkste bovenaan: liever drie regels die ergens over gaan dan acht die
elkaar aanvullen.

De guardrails die de app vandaag zelf toont staan er al; herhaal ze niet woordelijk, maar
gebruik ze wel als context. Is er weinig gelogd, zeg dat dan en houd het kort.

Kijk bij het advies naar \`progressie\`: daar staat of dit profiel opbouwt of onderhoudt,
na hoeveel gehaalde sessies het gewicht omhoog gaat, en hoe ver elke oefening is. Een
advies dat de app tegenspreekt — zwaarder tillen terwijl de teller nog niet vol is — is
erger dan geen advies.`
}
