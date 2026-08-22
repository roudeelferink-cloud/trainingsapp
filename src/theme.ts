/**
 * Thema-keuze: donker, licht, of meelopen met het toestel.
 *
 * De keuze staat bewust *niet* in de app-state. Die state is per gebruiker en gaat
 * mee in de export; welk thema dit toestel toont is een eigenschap van het toestel,
 * niet van je trainingsgeschiedenis. Vandaar een eigen sleutel in localStorage —
 * het datamodel en het exportbestand blijven ongemoeid.
 *
 * De waarden zelf staan in theme.css. Hier gaat het alleen om welke van de twee
 * sets aan staat: `data-theme` op <html> zet het vast, geen attribuut betekent
 * "volg het systeem".
 */

export type ThemeChoice = 'system' | 'dark' | 'light'

export const THEME_KEY = 'trainingsapp.theme'

export const THEME_OPTIONS: { id: ThemeChoice; label: string }[] = [
  { id: 'system', label: 'Systeem' },
  { id: 'light', label: 'Licht' },
  { id: 'dark', label: 'Donker' },
]

/** De schermachtergrond per thema; alleen voor de statusbalk van iOS. */
const BAR_COLOR: Record<'dark' | 'light', string> = {
  dark: '#131110',
  light: '#f3eee4',
}

function isChoice(v: unknown): v is ThemeChoice {
  return v === 'system' || v === 'dark' || v === 'light'
}

/** Wat er is opgeslagen; onleesbare of ontbrekende waarden vallen terug op 'system'. */
export function readTheme(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return isChoice(raw) ? raw : 'system'
  } catch {
    // privémodus of een geblokkeerde opslag mag de app niet tegenhouden
    return 'system'
  }
}

/** Welk thema er feitelijk staat, met 'system' al opgelost naar donker of licht. */
export function resolveTheme(choice: ThemeChoice): 'dark' | 'light' {
  if (choice !== 'system') return choice
  const mq = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)')
  return mq && mq.matches ? 'light' : 'dark'
}

/**
 * Zet het thema op het document. Bij 'system' verdwijnt het attribuut, zodat de
 * media query in theme.css het weer overneemt.
 */
export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)

  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
  if (meta) meta.setAttribute('content', BAR_COLOR[resolveTheme(choice)])
}

/** Bewaart de keuze en past hem meteen toe. */
export function setTheme(choice: ThemeChoice): void {
  try {
    localStorage.setItem(THEME_KEY, choice)
  } catch {
    // niet kunnen bewaren is vervelend, niet fataal: het thema staat wel goed
  }
  applyTheme(choice)
}
