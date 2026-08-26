import { describe, expect, it, vi } from 'vitest'
import { MAX_POGINGEN, geheugenCache, type Cache } from '../src/cache'
import type { ModelClient } from '../src/claude'
import { ReviewFout, isReviewFout } from '../src/fouten'
import { handleReview, type Deps } from '../src/review'
import type { Signalen } from '../src/signalen'
import { GOED_ADVIES, VANDAAG, exportVorm, robState } from './helpers'
import { ROB } from '../../src/store/schema'

/**
 * De endpoint, met een client die niet het netwerk op gaat.
 *
 * Alles wat hier getest wordt is precies wat de echte aanroep óók doet: dezelfde
 * signalen, dezelfde keuring, dezelfde cache. Alleen het stuk dat een verbinding nodig
 * heeft is vervangen — en het pad waarop die verbinding er níét is, is een eigen test.
 */

function deps(over: Partial<Deps> = {}): Deps & { cache: Cache } {
  return {
    client: () => ({ vraag: async () => GOED_ADVIES }),
    cache: geheugenCache(),
    weken: 8,
    nu: () => new Date('2026-08-05T07:00:00.000Z'),
    ...over,
  }
}

const verzoek = (over: Record<string, unknown> = {}) => ({
  profiel: ROB,
  vandaag: VANDAAG,
  state: exportVorm(robState()),
  ...over,
})

describe('POST /api/review', () => {
  it('geeft een advies terug en stuurt de signalen mee, niet de rauwe staat', async () => {
    let gezien: Signalen | null = null
    const client: ModelClient = {
      vraag: async (s) => {
        gezien = s
        return GOED_ADVIES
      },
    }
    const uit = await handleReview(verzoek(), deps({ client: () => client }))

    expect(uit.review).toEqual(GOED_ADVIES)
    expect(uit.profiel).toBe(ROB)
    expect(uit.datum).toBe(VANDAAG)
    expect(uit.gecached).toBe(false)
    expect(gezien).not.toBeNull()
    expect(gezien!.vandaag).toBe(VANDAAG)
    expect(gezien!.weken).toHaveLength(8)
    // wat er heen gaat is uitgerekend, niet rauw: geen setjes, geen entries
    expect(JSON.stringify(gezien)).not.toContain('entries')
  })

  it('kost een tweede keer openen geen aanroep', async () => {
    const vraag = vi.fn(async () => GOED_ADVIES)
    const d = deps({ client: () => ({ vraag }) })

    const eerste = await handleReview(verzoek(), d)
    const tweede = await handleReview(verzoek(), d)

    expect(vraag).toHaveBeenCalledTimes(1)
    expect(eerste.gecached).toBe(false)
    expect(tweede.gecached).toBe(true)
    expect(tweede.review).toEqual(eerste.review)
    expect(tweede.gegenereerdOp).toBe(eerste.gegenereerdOp)
  })

  it('houdt de cache per profiel uit elkaar', async () => {
    const vraag = vi.fn(async (s: Signalen) => ({ ...GOED_ADVIES, toon: `voor ${s.profiel.id}` }))
    const d = deps({ client: () => ({ vraag }) })

    const rob = await handleReview(verzoek(), d)
    const anouc = await handleReview(verzoek({ profiel: 'anouc' }), d)

    expect(vraag).toHaveBeenCalledTimes(2)
    expect(rob.review.toon).toBe('voor rob')
    expect(anouc.review.toon).toBe('voor anouc')
    // en allebei blijven ze staan
    expect((await handleReview(verzoek(), d)).review.toon).toBe('voor rob')
    expect(vraag).toHaveBeenCalledTimes(2)
  })

  it('is een nieuwe dag een nieuw advies', async () => {
    const vraag = vi.fn(async () => GOED_ADVIES)
    const d = deps({ client: () => ({ vraag }) })

    await handleReview(verzoek(), d)
    const morgen = await handleReview(verzoek({ vandaag: '2026-08-06' }), d)

    expect(vraag).toHaveBeenCalledTimes(2)
    expect(morgen.datum).toBe('2026-08-06')
    expect(morgen.gecached).toBe(false)
  })

  it('geeft een nette fout als de API niet bereikbaar is, en geen half advies', async () => {
    const client: ModelClient = {
      vraag: async () => {
        throw new ReviewFout('api_onbereikbaar', 'De Claude-API gaf geen antwoord: fetch failed')
      },
    }
    const d = deps({ client: () => client })

    await expect(handleReview(verzoek(), d)).rejects.toMatchObject({
      code: 'api_onbereikbaar',
      status: 502,
    })
    // er staat niets in de cache dat op een advies lijkt
    expect(d.cache.lees(ROB)?.review).toBeNull()
  })

  it('geeft een nette fout bij een kapot antwoord', async () => {
    const d = deps({ client: () => ({ vraag: async () => ({ signalen: [], advies: [] }) }) })
    await expect(handleReview(verzoek(), d)).rejects.toMatchObject({ code: 'kapot_antwoord' })
    expect(d.cache.lees(ROB)?.review).toBeNull()
  })

  it('stopt na een paar mislukte pogingen op dezelfde dag', async () => {
    const vraag = vi.fn(async () => {
      throw new ReviewFout('api_onbereikbaar', 'stuk')
    })
    const d = deps({ client: () => ({ vraag }) })

    for (let i = 0; i < MAX_POGINGEN; i++) {
      await expect(handleReview(verzoek(), d)).rejects.toMatchObject({ code: 'api_onbereikbaar' })
    }
    await expect(handleReview(verzoek(), d)).rejects.toMatchObject({ code: 'te_vaak', status: 429 })
    expect(vraag).toHaveBeenCalledTimes(MAX_POGINGEN)

    // morgen mag het weer
    await expect(handleReview(verzoek({ vandaag: '2026-08-06' }), d)).rejects.toMatchObject({
      code: 'api_onbereikbaar',
    })
    expect(vraag).toHaveBeenCalledTimes(MAX_POGINGEN + 1)
  })

  it('zegt het eerlijk als er geen sleutel is', async () => {
    const d = deps({
      client: () => {
        throw new ReviewFout('geen_sleutel', 'Er staat geen ANTHROPIC_API_KEY in de omgeving.')
      },
    })
    await expect(handleReview(verzoek(), d)).rejects.toMatchObject({
      code: 'geen_sleutel',
      status: 503,
    })
  })

  const kromme: [string, unknown][] = [
    ['geen object', 'hoi'],
    ['zonder profiel', { state: exportVorm() }],
    ['zonder staat', { profiel: ROB }],
    ['met een onbekend profiel', { profiel: 'thom', state: exportVorm() }],
    ['met een rare datum', { profiel: ROB, vandaag: '5 augustus', state: exportVorm() }],
    ['zonder schemaVersion', { profiel: ROB, state: { users: {} } }],
    [
      'uit een nieuwere versie',
      { profiel: ROB, state: { ...exportVorm(), schemaVersion: 99 } },
    ],
  ]

  for (const [wat, body] of kromme) {
    it(`weigert een verzoek ${wat}`, async () => {
      try {
        await handleReview(body, deps())
        throw new Error('had moeten falen')
      } catch (e) {
        expect(isReviewFout(e)).toBe(true)
        if (isReviewFout(e)) expect(e.status).toBe(400)
      }
    })
  }

  it('accepteert een staat van een toestel dat nog achterloopt', async () => {
    // een export van vóór de gebruikers bestonden: één platte gebruiker op versie 5
    const oud = {
      schemaVersion: 5,
      sessions: {},
      runs: {},
      checkins: { '2026-08-03': 4 },
      settings: { bodyweightKg: 84 },
    }
    const uit = await handleReview({ profiel: ROB, vandaag: VANDAAG, state: oud }, deps())
    expect(uit.review).toEqual(GOED_ADVIES)
  })
})
