import { ReviewFout } from './fouten'
import type { ReviewAdvies } from '../../src/types'

/**
 * De keuring van wat het model teruggaf.
 *
 * De opdracht is: liever niets dan half. Een advies met een lege lijst, een leeg veld of
 * een getal waar een zin hoort komt hier niet doorheen — dan gaat er een nette fout naar
 * de app en blijft het adviesblok stil. Dat is beter dan een blok met één zin erin waar
 * de rest had moeten staan.
 *
 * Het model krijgt al een schema mee. Dit is de tweede sluis: een schema is een verzoek,
 * geen garantie, en dit servertje geeft niets door dat het niet zelf gecontroleerd heeft.
 *
 * **Te weinig is stuk, te veel is niet stuk.** Die twee gaan hier bewust verschillend:
 *
 * - Een lege lijst betekent dat er iets ontbreekt wat er hoort te zijn. Dat is een fout,
 *   want een blok zonder advies is geen advies.
 * - Te veel regels betekent dat het model doorgeschreven is. Dat is geen fout maar
 *   breedsprakigheid, en daar hoort het blok niet op te verdwijnen: de eerste regels zijn
 *   de belangrijkste (dat staat ook zo in de opdracht), dus die houden we en de rest gaat
 *   eraf. Een 502 hierop zou een bruikbaar advies weggooien om een vormkwestie.
 *
 * De bovengrenzen stonden eerder als `maxItems` in het schema. Dat kan niet: structured
 * output kent `maxItems` niet en accepteert `minItems` alleen als 0 of 1 — zie de
 * toelichting bij `SCHEMA` in `prompt.ts`. Ze staan nu in de opdracht aan het model, en
 * hier als vangnet voor als het zich er niet aan houdt.
 */

/** De bedoelde aantallen: twee tot vijf signalen, één tot vier adviezen. */
export const MAX_SIGNALEN = 5
export const MAX_ADVIEZEN = 4

/** Grenzen die van een zin nog een zin maken. */
export const MAX_REGEL_LENGTE = 400
export const MAX_TOON_LENGTE = 240

export function parseAdvies(raw: unknown): ReviewAdvies {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ReviewFout('kapot_antwoord', 'Het antwoord was geen object.')
  }
  const v = raw as Record<string, unknown>

  const signalen = lijst(v.signalen, 'signalen', MAX_SIGNALEN)
  const advies = lijst(v.advies, 'advies', MAX_ADVIEZEN)
  const toon = tekst(v.toon, 'toon', MAX_TOON_LENGTE)

  return { signalen, advies, toon }
}

/**
 * Een lijst regels. Leeg of geen lijst is een fout; te lang wordt ingekort.
 *
 * Het inkorten gaat vóór de keuring van de losse regels. Wat afvalt komt niet in beeld,
 * dus of daar rommel tussen staat doet er niet toe — alleen wat er overblijft moet
 * kloppen.
 */
function lijst(raw: unknown, veld: string, max: number): string[] {
  if (!Array.isArray(raw)) {
    throw new ReviewFout('kapot_antwoord', `Veld '${veld}' is geen lijst.`)
  }
  if (raw.length === 0) {
    throw new ReviewFout('kapot_antwoord', `Veld '${veld}' is leeg.`)
  }
  return raw.slice(0, max).map((r, i) => tekst(r, `${veld}[${i}]`, MAX_REGEL_LENGTE))
}

function tekst(raw: unknown, veld: string, max: number): string {
  if (typeof raw !== 'string') {
    throw new ReviewFout('kapot_antwoord', `Veld '${veld}' is geen tekst.`)
  }
  const schoon = raw.trim()
  if (schoon === '') {
    throw new ReviewFout('kapot_antwoord', `Veld '${veld}' is leeg.`)
  }
  if (schoon.length > max) {
    throw new ReviewFout('kapot_antwoord', `Veld '${veld}' is langer dan ${max} tekens.`)
  }
  return schoon
}

/**
 * Hoeveel regels het model schreef, voor zover er iets te tellen valt.
 *
 * Alleen om te kunnen zien of het inkorten gevuurd heeft. Zonder dit is een advies van
 * vijf signalen niet te onderscheiden van een advies van acht waar er drie af gingen, en
 * dat verschil zegt precies of de opdracht aan het model aankomt.
 */
export function geschrevenRegels(raw: unknown): { signalen: number; advies: number } {
  const v = (raw ?? {}) as Record<string, unknown>
  return {
    signalen: Array.isArray(v.signalen) ? v.signalen.length : 0,
    advies: Array.isArray(v.advies) ? v.advies.length : 0,
  }
}
