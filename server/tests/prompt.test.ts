import { describe, expect, it } from 'vitest'
import { SCHEMA, buildPrompt } from '../src/prompt'
import { MAX_ADVIEZEN, MAX_SIGNALEN } from '../src/advies'
import { buildSignalen } from '../src/signalen'
import { schemaOvertredingen } from './schemaRegels'
import { VANDAAG, robState } from './helpers'

/**
 * Het schema dat met de aanroep meegaat.
 *
 * De eerste echte aanroep liep hierop stuk: er stond `minItems: 2` en `maxItems` in, en
 * structured output kent dat niet — 400, geen advies. Deze test is er zodat dat er niet
 * nog eens insluipt, bijvoorbeeld door iemand die de aantallen "netjes in het schema"
 * wil zetten.
 */
describe('het antwoordschema', () => {
  it('bevat geen minItems boven 1 en geen maxItems', () => {
    expect(schemaOvertredingen(SCHEMA)).toEqual([])
  })

  it('bewaakt dat ook echt — de regel vindt een schema dat wél stuk is', () => {
    // zonder deze test zou een kapotte controle er groen uitzien
    const stuk = {
      type: 'object',
      properties: {
        signalen: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
      },
    }
    const gevonden = schemaOvertredingen(stuk)
    expect(gevonden).toHaveLength(2)
    expect(gevonden.map((o) => o.regel).join(' ')).toContain('maxItems')
    expect(gevonden.map((o) => o.regel).join(' ')).toContain('minItems')
    expect(gevonden[0].pad).toContain('signalen')
  })

  it('houdt de rest van de vorm: drie verplichte velden en niets erbij', () => {
    expect(SCHEMA.required).toEqual(['signalen', 'advies', 'toon'])
    expect(SCHEMA.additionalProperties).toBe(false)
    expect(SCHEMA.properties.signalen.minItems).toBe(1)
    expect(SCHEMA.properties.advies.minItems).toBe(1)
  })
})

/**
 * De aantallen kunnen niet in het schema, dus staan ze in de opdracht. Staan ze daar
 * niet, dan staan ze nergens meer — en dan schrijft het model er weer acht.
 */
describe('de opdracht aan het model', () => {
  const prompt = buildPrompt(buildSignalen(robState(), VANDAAG, 8))

  it('noemt de bedoelde aantallen', () => {
    expect(prompt).toContain('twee tot vijf regels')
    expect(prompt).toContain('één tot vier regels')
  })

  it('zegt erbij dat wat erboven komt afgekapt wordt', () => {
    expect(prompt).toMatch(/afgekapt|niet in beeld/)
  })

  it('zet de aantallen ook in de beschrijving per veld', () => {
    expect(SCHEMA.properties.signalen.description).toContain('Twee tot vijf')
    expect(SCHEMA.properties.advies.description).toContain('Eén tot vier')
  })

  it('noemt dezelfde aantallen als de keuring afdwingt', () => {
    expect(MAX_SIGNALEN).toBe(5)
    expect(MAX_ADVIEZEN).toBe(4)
  })
})
