import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bestandsCache, geheugenCache } from '../src/cache'
import { GOED_ADVIES, VANDAAG } from './helpers'

describe('dagcache', () => {
  let map: string
  let pad: string

  beforeEach(() => {
    map = mkdtempSync(join(tmpdir(), 'trainingsapp-cache-'))
    pad = join(map, 'nog', 'niet', 'reviews.json')
  })
  afterEach(() => rmSync(map, { recursive: true, force: true }))

  it('geeft niets terug zolang er niets in staat', () => {
    expect(bestandsCache(pad).lees('rob')).toBeNull()
  })

  it('maakt de map aan en overleeft een herstart', () => {
    const eerste = bestandsCache(pad)
    eerste.schrijf('rob', {
      datum: VANDAAG,
      pogingen: 1,
      gegenereerdOp: '2026-08-05T07:00:00.000Z',
      review: GOED_ADVIES,
    })

    // een tweede cache op hetzelfde bestand is wat er na een herstart gebeurt
    const tweede = bestandsCache(pad)
    expect(tweede.lees('rob')).toEqual({
      datum: VANDAAG,
      pogingen: 1,
      gegenereerdOp: '2026-08-05T07:00:00.000Z',
      review: GOED_ADVIES,
    })
  })

  it('houdt de profielen uit elkaar', () => {
    const cache = bestandsCache(pad)
    cache.schrijf('rob', { datum: VANDAAG, pogingen: 1, gegenereerdOp: null, review: GOED_ADVIES })
    cache.schrijf('anouc', { datum: VANDAAG, pogingen: 2, gegenereerdOp: null, review: null })

    expect(cache.lees('rob')?.review).toEqual(GOED_ADVIES)
    expect(cache.lees('anouc')?.review).toBeNull()
    expect(cache.lees('anouc')?.pogingen).toBe(2)
  })

  it('leest een kapot bestand als een lege cache in plaats van te struikelen', () => {
    const stuk = join(map, 'reviews.json')
    writeFileSync(stuk, '{ dit is geen json', 'utf8')
    const cache = bestandsCache(stuk)

    expect(cache.lees('rob')).toBeNull()
    cache.schrijf('rob', { datum: VANDAAG, pogingen: 1, gegenereerdOp: null, review: GOED_ADVIES })
    expect(cache.lees('rob')?.review).toEqual(GOED_ADVIES)
  })

  it('gooit een half advies uit een oud bestand weg', () => {
    const stuk = join(map, 'reviews.json')
    writeFileSync(
      stuk,
      JSON.stringify({ rob: { datum: VANDAAG, pogingen: 1, review: { signalen: ['x'] } } }),
      'utf8',
    )
    const regel = bestandsCache(stuk).lees('rob')

    expect(regel?.datum).toBe(VANDAAG)
    expect(regel?.review).toBeNull()
  })

  it('doet in het geheugen precies hetzelfde', () => {
    const cache = geheugenCache()
    expect(cache.lees('rob')).toBeNull()
    cache.schrijf('rob', { datum: VANDAAG, pogingen: 1, gegenereerdOp: null, review: GOED_ADVIES })
    expect(cache.lees('rob')?.review).toEqual(GOED_ADVIES)
    expect(cache.lees('anouc')).toBeNull()
  })
})
