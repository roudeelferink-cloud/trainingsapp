import { beforeEach, describe, expect, it } from 'vitest'
import { resolveTheme, setThemePreference, themePreference } from '../src/theme'

/**
 * De themakeuze: systeem volgen (standaard), of vast donker/licht. De voorkeur
 * staat in zijn eigen localStorage-sleutel, los van de gebruikersdata — hij hoort
 * bij het toestel en reist niet mee in een export.
 */

const KEY = 'trainingsapp.theme'

beforeEach(() => {
  localStorage.removeItem(KEY)
})

describe('themavoorkeur', () => {
  it('is standaard "volg systeem"', () => {
    expect(themePreference()).toBe('system')
  })

  it('onthoudt een vaste keuze en kan terug naar systeem', () => {
    setThemePreference('light')
    expect(themePreference()).toBe('light')
    expect(localStorage.getItem(KEY)).toBe('light')

    setThemePreference('dark')
    expect(themePreference()).toBe('dark')

    // terug naar systeem: de sleutel verdwijnt in plaats van 'system' op te slaan,
    // zodat het inline script in index.html met dezelfde afwezigheid kan rekenen
    setThemePreference('system')
    expect(themePreference()).toBe('system')
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('valt op systeem terug bij een onleesbare waarde', () => {
    localStorage.setItem(KEY, 'paars')
    expect(themePreference()).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('volgt het systeem alleen bij de voorkeur "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })
})
