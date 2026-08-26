import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STANDAARD_MODEL, loadEnvFile, readConfig } from '../src/config'

describe('instellingen', () => {
  let map: string
  beforeEach(() => {
    map = mkdtempSync(join(tmpdir(), 'trainingsapp-env-'))
  })
  afterEach(() => rmSync(map, { recursive: true, force: true }))

  it('luistert standaard alleen op de loopback', () => {
    const c = readConfig({})
    expect(c.host).toBe('127.0.0.1')
    expect(c.model).toBe(STANDAARD_MODEL)
    expect(c.apiKey).toBeNull()
  })

  it('leest een .env', () => {
    const pad = join(map, '.env')
    writeFileSync(
      pad,
      ['# een opmerking', 'ANTHROPIC_API_KEY=sk-test-123', '', 'REVIEW_MODEL="claude-sonnet-5"', 'REVIEW_PORT=9000'].join('\n'),
      'utf8',
    )
    const env: NodeJS.ProcessEnv = {}
    loadEnvFile(pad, env)
    const c = readConfig(env)

    expect(c.apiKey).toBe('sk-test-123')
    expect(c.model).toBe('claude-sonnet-5')
    expect(c.port).toBe(9000)
  })

  it('laat de omgeving winnen van het bestand', () => {
    const pad = join(map, '.env')
    writeFileSync(pad, 'ANTHROPIC_API_KEY=uit-het-bestand\n', 'utf8')
    const env: NodeJS.ProcessEnv = { ANTHROPIC_API_KEY: 'uit-de-omgeving' }
    loadEnvFile(pad, env)

    expect(readConfig(env).apiKey).toBe('uit-de-omgeving')
  })

  it('doet niet moeilijk over een .env die er niet is', () => {
    const env: NodeJS.ProcessEnv = {}
    expect(() => loadEnvFile(join(map, 'bestaat-niet'), env)).not.toThrow()
    expect(env).toEqual({})
  })

  it('negeert onzin en valt terug op de standaardwaarde', () => {
    const c = readConfig({ REVIEW_PORT: 'acht', REVIEW_WEKEN: '-3', ANTHROPIC_API_KEY: '   ' })
    expect(c.port).toBe(8098)
    expect(c.weken).toBe(8)
    expect(c.apiKey).toBeNull()
  })
})
