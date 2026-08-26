import { describe, expect, it } from 'vitest'
import {
  MAX_ADVIEZEN,
  MAX_REGEL_LENGTE,
  MAX_SIGNALEN,
  MAX_TOON_LENGTE,
  parseAdvies,
} from '../src/advies'
import { isReviewFout } from '../src/fouten'
import { GOED_ADVIES } from './helpers'

/**
 * Liever niets dan half. Elke test hier is een manier waarop een antwoord stuk kan zijn,
 * en het antwoord op alle is hetzelfde: een `kapot_antwoord`, geen advies.
 */
describe('advies keuren', () => {
  it('laat een compleet advies door en haalt de witruimte eraf', () => {
    const uit = parseAdvies({
      signalen: ['  Vier weken op rij meer.  ', 'Twee zware sessies.'],
      advies: ['Houd deze week op 30 km.'],
      toon: '  Het loopt.  ',
    })
    expect(uit).toEqual({
      signalen: ['Vier weken op rij meer.', 'Twee zware sessies.'],
      advies: ['Houd deze week op 30 km.'],
      toon: 'Het loopt.',
    })
  })

  const stuk: [string, unknown][] = [
    ['geen object', 'gewoon wat tekst'],
    ['null', null],
    ['een lijst', [1, 2, 3]],
    ['zonder signalen', { advies: ['x'], toon: 'y' }],
    ['zonder advies', { signalen: ['x'], toon: 'y' }],
    ['zonder toon', { signalen: ['x'], advies: ['y'] }],
    ['lege signalen', { signalen: [], advies: ['y'], toon: 'z' }],
    ['leeg advies', { signalen: ['x'], advies: [], toon: 'z' }],
    ['lege toon', { signalen: ['x'], advies: ['y'], toon: '   ' }],
    ['signalen als tekst', { signalen: 'x', advies: ['y'], toon: 'z' }],
    ['een getal tussen de signalen', { signalen: ['x', 3], advies: ['y'], toon: 'z' }],
    ['null tussen het advies', { signalen: ['x'], advies: [null], toon: 'z' }],
    ['een regel die geen regel meer is', { signalen: ['x'.repeat(MAX_REGEL_LENGTE + 1)], advies: ['y'], toon: 'z' }],
    ['een toon van een alinea', { signalen: ['x'], advies: ['y'], toon: 'z'.repeat(MAX_TOON_LENGTE + 1) }],
  ]

  for (const [wat, waarde] of stuk) {
    it(`weigert ${wat}`, () => {
      try {
        parseAdvies(waarde)
        throw new Error('had moeten falen')
      } catch (e) {
        expect(isReviewFout(e)).toBe(true)
        if (isReviewFout(e)) {
          expect(e.code).toBe('kapot_antwoord')
          expect(e.status).toBe(502)
          expect(e.message).not.toBe('')
        }
      }
    })
  }

  it('laat een veld dat niemand verwacht gewoon weg', () => {
    expect(parseAdvies({ ...GOED_ADVIES, kosten: 12, notitie: 'hoi' })).toEqual(GOED_ADVIES)
  })
})

/**
 * Te weinig is stuk, te veel niet. Het model hield zich in de praktijk niet aan de
 * aantallen — acht signalen en zes adviezen — en dat hoort een korter blok op te leveren,
 * geen weggevallen blok.
 */
describe('te veel regels', () => {
  const veel = {
    signalen: ['een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht'],
    advies: ['a', 'b', 'c', 'd', 'e', 'f'],
    toon: 'Het loopt.',
  }

  it('kort in tot de bedoelde aantallen in plaats van te weigeren', () => {
    const uit = parseAdvies(veel)
    expect(uit.signalen).toEqual(['een', 'twee', 'drie', 'vier', 'vijf'])
    expect(uit.advies).toEqual(['a', 'b', 'c', 'd'])
    expect(uit.toon).toBe('Het loopt.')
  })

  it('houdt de eerste regels, want daar staat het belangrijkste', () => {
    const uit = parseAdvies(veel)
    expect(uit.signalen[0]).toBe('een')
    expect(uit.advies[0]).toBe('a')
    expect(uit.signalen).toHaveLength(MAX_SIGNALEN)
    expect(uit.advies).toHaveLength(MAX_ADVIEZEN)
  })

  it('kijkt niet meer naar wat er afvalt', () => {
    // rommel voorbij de grens komt toch niet in beeld; dat hoort het blok niet te slopen
    const uit = parseAdvies({
      signalen: ['een', 'twee', 'drie', 'vier', 'vijf', 42, null, 'x'.repeat(9999)],
      advies: ['a', 'b', 'c', 'd', { nee: true }],
      toon: 'Het loopt.',
    })
    expect(uit.signalen).toHaveLength(MAX_SIGNALEN)
    expect(uit.advies).toHaveLength(MAX_ADVIEZEN)
  })

  it('blijft wel streng op wat er overblijft', () => {
    expect(() =>
      parseAdvies({ signalen: ['een', 42, 'drie'], advies: ['a'], toon: 'z' }),
    ).toThrowError(/signalen\[1\]/)
  })

  it('laat een advies dat binnen de aantallen blijft ongemoeid', () => {
    const net = { signalen: ['een', 'twee'], advies: ['a'], toon: 'z' }
    expect(parseAdvies(net)).toEqual(net)
  })
})
