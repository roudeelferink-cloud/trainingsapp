/**
 * Themakeuze: systeem volgen (standaard), of vast donker/licht.
 *
 * De voorkeur staat los van de gebruikersdata in zijn eigen localStorage-sleutel:
 * hij hoort bij het toestel, net als de themakeuze van het OS zelf, en hoort dus
 * niet in een export of migratie thuis. index.html zet vóór de eerste paint al een
 * `data-theme` op basis van dezelfde sleutel, zodat er geen verkeerde flits is.
 */

export type ThemePreference = 'system' | 'dark' | 'light'

const KEY = 'trainingsapp.theme'

export function themePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === 'dark' || raw === 'light' ? raw : 'system'
  } catch {
    return 'system'
  }
}

/** Wat er daadwerkelijk getoond wordt, gegeven de voorkeur en het systeem. */
export function resolveTheme(pref: ThemePreference, systemDark: boolean): 'dark' | 'light' {
  if (pref === 'system') return systemDark ? 'dark' : 'light'
  return pref
}

function systemDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

/** Zet het thema op <html> en houdt de browserbalk (theme-color) gelijk aan de achtergrond. */
export function applyTheme(): void {
  if (typeof document === 'undefined') return
  const theme = resolveTheme(themePreference(), systemDark())
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim())
  }
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    /* private mode: de keuze geldt dan alleen voor deze sessie */
  }
  applyTheme()
}

/** Eén keer bij het opstarten: thema zetten en meebewegen met het systeem. */
export function initTheme(): void {
  applyTheme()
  if (typeof matchMedia === 'undefined') return
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (themePreference() === 'system') applyTheme()
  })
}
