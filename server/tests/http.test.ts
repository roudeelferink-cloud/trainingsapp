import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { geheugenCache } from '../src/cache'
import { ReviewFout } from '../src/fouten'
import { maakServer } from '../src/http'
import type { Deps } from '../src/review'
import { GOED_ADVIES, VANDAAG, exportVorm } from './helpers'
import { ROB } from '../../src/store/schema'

/**
 * Dezelfde tests, maar dan over een echte socket: dat de fouten met de juiste status
 * naar buiten komen en dat er nooit iets half doorgegeven wordt.
 */

let server: Server | null = null

function start(over: Partial<Deps> = {}): Promise<string> {
  const deps: Deps = {
    client: () => ({ vraag: async () => GOED_ADVIES }),
    cache: geheugenCache(),
    weken: 8,
    nu: () => new Date('2026-08-05T07:00:00.000Z'),
    ...over,
  }
  server = maakServer(deps)
  return new Promise((resolve) => {
    server!.listen(0, '127.0.0.1', () => {
      const { port } = server!.address() as AddressInfo
      resolve(`http://127.0.0.1:${port}`)
    })
  })
}

afterEach(async () => {
  if (server) await new Promise((r) => server!.close(r))
  server = null
})

const body = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ profiel: ROB, vandaag: VANDAAG, state: exportVorm(), ...over })

const post = (url: string, tekst: string) =>
  fetch(`${url}/api/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: tekst,
  })

describe('het http-laagje', () => {
  it('geeft het advies terug op POST /api/review', async () => {
    const url = await start()
    const res = await post(url, body())

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    await expect(res.json()).resolves.toMatchObject({
      profiel: ROB,
      datum: VANDAAG,
      gecached: false,
      review: GOED_ADVIES,
    })
  })

  it('antwoordt op /healthz, zodat de container zichzelf kan controleren', async () => {
    const url = await start()
    const res = await fetch(`${url}/healthz`)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('kent verder niets', async () => {
    const url = await start()
    expect((await fetch(`${url}/`)).status).toBe(404)
    expect((await fetch(`${url}/api/review`)).status).toBe(405)
  })

  it('geeft 400 op onleesbare JSON', async () => {
    const url = await start()
    const res = await post(url, '{ dit is geen json')
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ fout: 'verzoek' })
  })

  it('geeft 502 en een bericht als de API onbereikbaar is', async () => {
    const url = await start({
      client: () => ({
        vraag: async () => {
          throw new ReviewFout('api_onbereikbaar', 'De Claude-API gaf geen antwoord: fetch failed')
        },
      }),
    })
    const res = await post(url, body())

    expect(res.status).toBe(502)
    const uit = (await res.json()) as Record<string, unknown>
    expect(uit.fout).toBe('api_onbereikbaar')
    expect(uit.bericht).toContain('geen antwoord')
    expect(uit.review).toBeUndefined()
  })

  it('geeft 503 zolang er geen sleutel staat', async () => {
    const url = await start({
      client: () => {
        throw new ReviewFout('geen_sleutel', 'Er staat geen ANTHROPIC_API_KEY in de omgeving.')
      },
    })
    const res = await post(url, body())
    expect(res.status).toBe(503)
    await expect(res.json()).resolves.toMatchObject({ fout: 'geen_sleutel' })
  })
})
