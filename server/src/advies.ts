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
 */

/** Grenzen die van een zin nog een zin maken. */
export const MAX_REGELS = 8
export const MAX_REGEL_LENGTE = 400
export const MAX_TOON_LENGTE = 240

export function parseAdvies(raw: unknown): ReviewAdvies {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ReviewFout('kapot_antwoord', 'Het antwoord was geen object.')
  }
  const v = raw as Record<string, unknown>

  const signalen = lijst(v.signalen, 'signalen')
  const advies = lijst(v.advies, 'advies')
  const toon = tekst(v.toon, 'toon', MAX_TOON_LENGTE)

  return { signalen, advies, toon }
}

function lijst(raw: unknown, veld: string): string[] {
  if (!Array.isArray(raw)) {
    throw new ReviewFout('kapot_antwoord', `Veld '${veld}' is geen lijst.`)
  }
  if (raw.length === 0) {
    throw new ReviewFout('kapot_antwoord', `Veld '${veld}' is leeg.`)
  }
  if (raw.length > MAX_REGELS) {
    throw new ReviewFout('kapot_antwoord', `Veld '${veld}' heeft meer dan ${MAX_REGELS} regels.`)
  }
  return raw.map((r, i) => tekst(r, `${veld}[${i}]`, MAX_REGEL_LENGTE))
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
