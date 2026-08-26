import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Advies } from '../src/components/Advies'
import { HistoryScreen } from '../src/screens/HistoryScreen'
import { today } from '../src/logic/dates'
import { REVIEW_ENDPOINT, fetchReview, isAdvies, isFresh, needsFetch } from '../src/logic/review'
import { saveReview } from '../src/store/actions'
import {
  ANOUC,
  ROB,
  getRoot,
  getState,
  getUser,
  resetState,
  setCurrentUser,
  setPin,
} from '../src/store/store'
import type { ReviewCache } from '../src/types'

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

const ADVIES = {
  signalen: ['Vier weken op rij meer gelopen: van 24 naar 31 km.'],
  advies: ['Houd deze week op 30 km.'],
  toon: 'Het loopt, maar de rek is eruit.',
}

const cache = (over: Partial<ReviewCache> = {}): ReviewCache => ({
  datum: today(),
  gegenereerdOp: `${today()}T07:00:00.000Z`,
  review: ADVIES,
  ...over,
})

/** Een fetch die precies één antwoord geeft. */
function nepFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  ) as unknown as typeof fetch
}

beforeEach(() => {
  resetState()
  setCurrentUser(ROB)
})

describe('wanneer er een advies gehaald wordt', () => {
  it('haalt niets op zolang het advies van vandaag is', () => {
    expect(isFresh(cache(), today())).toBe(true)
    expect(needsFetch(cache(), today())).toBe(false)
  })

  it('haalt wel op als het advies van gisteren is, of als er niets staat', () => {
    expect(needsFetch(cache({ datum: '2020-01-01' }), today())).toBe(true)
    expect(needsFetch(null, today())).toBe(true)
    expect(needsFetch(undefined, today())).toBe(true)
  })
})

describe('het advies ophalen', () => {
  it('stuurt profiel, dag en de volledige staat naar de endpoint', async () => {
    const fetchImpl = nepFetch(200, { datum: today(), gegenereerdOp: 'toen', review: ADVIES })
    const uit = await fetchReview({
      profiel: ROB,
      vandaag: today(),
      state: getRoot(),
      fetchImpl,
    })

    expect(uit).toEqual({ datum: today(), gegenereerdOp: 'toen', review: ADVIES })
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe(REVIEW_ENDPOINT)
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string)
    expect(body.profiel).toBe(ROB)
    expect(body.vandaag).toBe(today())
    expect(body.state.schemaVersion).toBe(getRoot().schemaVersion)
    expect(body.state.users[ROB]).toBeTruthy()
  })

  it('stuurt de pincode niet mee: de server doet er niets mee', async () => {
    setPin('4321')
    const fetchImpl = nepFetch(200, { review: ADVIES })
    await fetchReview({ profiel: ROB, vandaag: today(), state: getRoot(), fetchImpl })

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(JSON.parse(init.body as string).state.pin).toBeNull()
    expect(init.body as string).not.toContain('4321')
    // en op het toestel staat hij er gewoon nog
    expect(getRoot().pin).toBe('4321')
  })

  it('geeft null bij een onbereikbare Pi, zonder te gooien', async () => {
    const stuk = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch

    await expect(
      fetchReview({ profiel: ROB, vandaag: today(), state: getRoot(), fetchImpl: stuk }),
    ).resolves.toBeNull()
  })

  const mislukt: [string, number, unknown][] = [
    ['een 502 van de server', 502, { fout: 'api_onbereikbaar' }],
    ['een 503 zonder sleutel', 503, { fout: 'geen_sleutel' }],
    ['een 429 als de dag op is', 429, { fout: 'te_vaak' }],
    ['een antwoord dat geen JSON is', 200, 'gewoon wat tekst'],
    ['een half advies', 200, { review: { signalen: ['x'] } }],
    ['een leeg advies', 200, { review: { signalen: [], advies: [], toon: '' } }],
  ]

  for (const [wat, status, body] of mislukt) {
    it(`geeft null bij ${wat}`, async () => {
      await expect(
        fetchReview({
          profiel: ROB,
          vandaag: today(),
          state: getRoot(),
          fetchImpl: nepFetch(status, body),
        }),
      ).resolves.toBeNull()
    })
  }

  it('keurt een advies pas goed als alle drie de velden gevuld zijn', () => {
    expect(isAdvies(ADVIES)).toBe(true)
    expect(isAdvies({ ...ADVIES, toon: '  ' })).toBe(false)
    expect(isAdvies({ ...ADVIES, advies: [] })).toBe(false)
    expect(isAdvies({ ...ADVIES, signalen: [3] })).toBe(false)
    expect(isAdvies(null)).toBe(false)
  })
})

describe('het advies bewaren', () => {
  it('zet het bij de gebruiker waar het over gaat', () => {
    saveReview(ROB, cache())
    expect(getState().review?.review).toEqual(ADVIES)
    expect(getUser(ANOUC)?.review).toBeNull()
  })

  it('gooit een advies weg dat bij een ander profiel hoort', () => {
    saveReview(ANOUC, cache())
    expect(getState().review).toBeNull()
    expect(getUser(ANOUC)?.review).toBeNull()
  })

  it('houdt het advies van allebei de profielen apart', () => {
    saveReview(ROB, cache({ review: { ...ADVIES, toon: 'voor Rob' } }))
    setCurrentUser(ANOUC)
    saveReview(ANOUC, cache({ review: { ...ADVIES, toon: 'voor Anouc' } }))

    expect(getUser(ROB)?.review?.review.toon).toBe('voor Rob')
    expect(getUser(ANOUC)?.review?.review.toon).toBe('voor Anouc')
  })
})

describe('het adviesblok', () => {
  it('zwijgt zolang er geen advies is', () => {
    expect(render(createElement(Advies))).toBe('')
  })

  it('toont de toon, de signalen en het advies', () => {
    saveReview(ROB, cache())
    const html = render(createElement(Advies))

    expect(html).toContain('Het loopt, maar de rek is eruit.')
    expect(html).toContain('Vier weken op rij meer gelopen: van 24 naar 31 km.')
    expect(html).toContain('Houd deze week op 30 km.')
    expect(html).toContain('Advies')
  })

  it('zet er de datum bij zodra het advies niet meer van vandaag is', () => {
    saveReview(ROB, cache({ datum: '2026-01-05' }))
    const html = render(createElement(Advies))
    expect(html).toContain('Houd deze week op 30 km.')
    expect(html).toMatch(/5 jan/i)
  })

  it('gebruikt alleen tokenklassen, geen eigen kleuren of maten', () => {
    saveReview(ROB, cache())
    const html = render(createElement(Advies))
    expect(html).not.toMatch(/#[0-9a-f]{3,6}/i)
    expect(html).not.toMatch(/style="/)
    expect(html).toContain('text-ink-quote')
    expect(html).toContain('border-rule')
  })

  it('staat op Historie, boven de grafieken', () => {
    saveReview(ROB, cache())
    const html = render(createElement(HistoryScreen, { onOpenSettings: () => {} }))

    expect(html.indexOf('Het loopt, maar de rek is eruit.')).toBeGreaterThan(-1)
    expect(html.indexOf('Het loopt, maar de rek is eruit.')).toBeLessThan(
      html.indexOf('Hardloopvolume per week'),
    )
  })

  it('laat Historie gewoon werken zonder advies', () => {
    const html = render(createElement(HistoryScreen, { onOpenSettings: () => {} }))
    expect(html).toContain('Hardloopvolume per week')
    expect(html).not.toContain('Wat je ermee doet')
  })
})
