import { describe, expect, it } from 'vitest'
import { MAX_REGELS, MAX_REGEL_LENGTE, MAX_TOON_LENGTE, parseAdvies } from '../src/advies'
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
    [
      'te veel regels',
      { signalen: Array.from({ length: MAX_REGELS + 1 }, () => 'x'), advies: ['y'], toon: 'z' },
    ],
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
