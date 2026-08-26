/**
 * Wat structured output van een schema accepteert.
 *
 * Dit is nagebouwd, niet verzonnen: de echte API weigert een schema met `maxItems` erin
 * en accepteert `minItems` alleen als 0 of 1. Dat kwam pas boven water bij de eerste
 * echte aanroep — de tests draaiden allemaal groen, want ze mockten de client en zagen
 * het schema dus nooit.
 *
 * Deze regels staan hier apart zodat twee dingen ze delen: de test die `SCHEMA` bewaakt
 * (`prompt.test.ts`) en de nagebootste API waar `claude.test.ts` echt tegenaan praat.
 * Eén definitie, op allebei de plekken — anders bewaakt de test iets anders dan de stub
 * afdwingt, en dan zijn we terug bij af.
 */

export interface Overtreding {
  /** waar in het schema het zit, als pad */
  pad: string
  regel: string
}

/**
 * Loopt het hele schema af en geeft terug wat structured output zou weigeren. Lege lijst
 * betekent: dit schema komt er doorheen.
 */
export function schemaOvertredingen(schema: unknown, pad = '#'): Overtreding[] {
  if (Array.isArray(schema)) {
    return schema.flatMap((v, i) => schemaOvertredingen(v, `${pad}[${i}]`))
  }
  if (!schema || typeof schema !== 'object') return []

  const uit: Overtreding[] = []
  const node = schema as Record<string, unknown>

  if ('maxItems' in node) {
    uit.push({ pad, regel: 'maxItems wordt niet ondersteund' })
  }
  if ('minItems' in node && node.minItems !== 0 && node.minItems !== 1) {
    uit.push({ pad, regel: `minItems mag alleen 0 of 1 zijn, niet ${String(node.minItems)}` })
  }

  for (const [sleutel, waarde] of Object.entries(node)) {
    uit.push(...schemaOvertredingen(waarde, `${pad}/${sleutel}`))
  }
  return uit
}
