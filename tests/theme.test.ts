import { beforeEach, describe, expect, it } from 'vitest'
import { THEME_KEY, THEME_OPTIONS, readTheme, resolveTheme, setTheme } from '../src/theme'

describe('themakeuze', () => {
  beforeEach(() => localStorage.clear())

  it('staat standaard op volg-systeem', () => {
    expect(readTheme()).toBe('system')
  })

  it('bewaart een keuze en leest hem terug', () => {
    setTheme('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(readTheme()).toBe('light')

    setTheme('dark')
    expect(readTheme()).toBe('dark')

    setTheme('system')
    expect(readTheme()).toBe('system')
  })

  it('valt terug op volg-systeem bij rommel in de opslag', () => {
    localStorage.setItem(THEME_KEY, 'sepia')
    expect(readTheme()).toBe('system')
  })

  it('lost een vaste keuze op naar zichzelf', () => {
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })

  it('kiest donker als het toestel niets over een voorkeur zegt', () => {
    // zonder matchMedia (server, of een oude webview) is donker het standaardthema
    expect(resolveTheme('system')).toBe('dark')
  })

  it('biedt precies de drie keuzes die het instellingenscherm toont', () => {
    expect(THEME_OPTIONS.map((o) => o.id)).toEqual(['system', 'light', 'dark'])
  })

  it('raakt de opgeslagen gegevens van de app niet aan', () => {
    // het thema hoort bij het toestel, niet bij de trainingsgeschiedenis
    localStorage.setItem('trainingsapp.state.v1', '{"schemaVersion":13}')
    setTheme('light')
    expect(localStorage.getItem('trainingsapp.state.v1')).toBe('{"schemaVersion":13}')
  })
})
