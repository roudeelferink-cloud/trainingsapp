import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import config, { pwaOptions } from '../vite.config'

/**
 * De PWA moet installeerbaar blijven op het nieuwe adres.
 *
 * Op GitHub Pages stond de app onder een subpad; op de Pi staat hij op de wortel. Drie
 * dingen moeten daarbij hetzelfde pad hebben — het basispad van de bundel, `start_url`
 * en `scope` — anders weigert de browser hem te installeren, of installeert hij hem en
 * opent de snelkoppeling een leeg scherm. Dat is precies het soort fout dat je pas merkt
 * als je hem op je telefoon zet, dus staat hij hier.
 */

describe('zelf-hosten: bundel, manifest en service worker', () => {
  it('bouwt vanaf de wortel, niet vanaf een subpad', () => {
    expect((config as any).base).toBe('/')
  })

  it('zet start_url en scope op hetzelfde pad als de bundel', () => {
    const manifest = pwaOptions.manifest
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.id).toBe('/')
  })

  it('houdt de iconen relatief, zodat ze het op elk adres doen', () => {
    for (const icon of pwaOptions.manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(false)
      expect(icon.src.startsWith('http')).toBe(false)
    }
  })

  it('laat de service worker /api met rust', () => {
    const workbox = pwaOptions.workbox
    expect(workbox.navigateFallback).toBe('/index.html')
    const denylist: RegExp[] = workbox.navigateFallbackDenylist
    expect(denylist.some((r) => r.test('/api/review'))).toBe(true)
    expect(denylist.some((r) => r.test('/historie'))).toBe(false)
  })

  it('zet /api tijdens ontwikkelen door naar het servertje', () => {
    expect((config as any).server.proxy['/api'].target).toContain('127.0.0.1')
  })

  it('heeft geen GitHub Pages-deploy meer die stilletjes doordraait', () => {
    let workflows: string[] = []
    try {
      workflows = readFileSync(new URL('../.github/workflows/tests.yml', import.meta.url), 'utf8').split('\n')
    } catch {
      workflows = []
    }
    expect(workflows.join('\n')).not.toContain('deploy-pages')
    expect(() =>
      readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8'),
    ).toThrow()
  })
})
