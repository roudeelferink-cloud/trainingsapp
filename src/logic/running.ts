/**
 * Wat er van het loopschema over is.
 *
 * Hier stond de rekenkunde die de week uitrekende: een startvolume van 22 km, 5% opbouw
 * per week, de verdeling over kort/kort/lang, en de eigen opbouwlijn van de duurloop van
 * 10 naar 15 km. Dat is er allemaal uit — de app schrijft geen afstanden meer voor, en
 * dus valt er ook niets meer te verdelen. Wie wil weten waarom: zie de kop van
 * `runningLoad.ts`.
 *
 * Wat blijft zijn twee afrondingen die overal gebruikt worden en één getal dat niets met
 * hardlopen te maken heeft maar hier historisch woont: de lengte van de deloadcyclus.
 */

export function round05(n: number): number {
  return Math.round(n * 2) / 2
}

/** Naar beneden op halve kilometers. */
export function floor05(n: number): number {
  return Math.floor(n * 2 + 1e-9) / 2
}

/**
 * Elke achtste trainingsweek is een deloadweek. Dit gaat over de krachtcyclus en niet
 * over hardlopen; `deload.ts` en `cycle.ts` lezen het hier.
 */
export const DELOAD_EVERY_WEEKS = 8

/** Fietsen in plaats van lopen duurt een half uur. */
export const BIKE_MINUTES = 30
