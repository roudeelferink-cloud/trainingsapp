import type { Activity, BikeSwap, BikeVariant, DayKind, UserState } from '../types'
import { addDays } from './dates'
import { dayCheckOn, legsHeavy, painSpot } from './dayCheck'
import { deloadFor } from './deload'
import { scheduledStrength } from './schedule'

/**
 * Een krachtsessie vervangen door fietsen op de spinningfiets (ICG IC5).
 *
 * Twee varianten, allebei maximaal 45 minuten:
 *
 * - **kracht-duur** — 10 min inrijden, 5 × 4 min zware weerstand op cadans 75–85 met
 *   2 min rustig trappen ertussen, 5 min uitrijden. Voor als de benen iets moeten doen.
 * - **rustige duurrit** — 40 min licht tot matig op cadans 85–95, praten kan nog. Voor als
 *   de benen juist rust nodig hebben.
 *
 * De app stelt er één voor (zie `suggestVariant`); de andere is altijd één tik verder.
 *
 * Wat er bij vervangen gebeurt: de krachtsessie krijgt skip-reden `fietsen`, de keuze
 * staat in de override van die dag (`bikeSwap`), en na afloop komt de rit als activiteit
 * in de historie met de variant en de sessie die hij verving. Het schema schuift niet,
 * de streefgewichten blijven staan en de deloadtelling ook — er is geen krachtsessie
 * gelogd, dus er valt niets te tellen.
 *
 * Dit gaat uitsluitend over kracht. Een geplande loop die je fietst is iets anders (de
 * knop "Fiets in plaats van lopen" op de loop) en blijft precies wat hij was.
 */

export const BIKE_VARIANT_LABEL: Record<BikeVariant, string> = {
  kracht_duur: 'Kracht-duur',
  duurrit: 'Rustige duurrit',
}

/* -------------------------------------------------------------------------
 * Beenbelasting
 * ---------------------------------------------------------------------- */

/**
 * Wat een fietstraining meetelt in de beenbelasting (`legLoad.ts`), op dezelfde schaal als
 * de krachtsessies. Ter vergelijking: benen A ≈ 9, benen B ≈ 9, de drempel voor "zware
 * benen" is 3.
 *
 * - kracht-duur telt 0,6 per zwaar blok: 5 blokken is 3,0 — precies op de drempel. Matig
 *   beenzwaar: zwaar genoeg om naast een beensessie een waarschuwing te geven, een derde
 *   van een echte beensessie. In de deloadweek (3 blokken) is het 1,8.
 * - de duurrit telt 1,0: licht.
 */
export const BIKE_LOAD_PER_HARD_BLOCK = 0.6
export const BIKE_LOAD_EASY = 1

/** Fietsen en spinning zijn allebei fietsen: ze wegen hetzelfde. */
export function isBikeActivity(a: Activity): boolean {
  return a.type === 'fietsen' || a.type === 'spinning'
}

/** Hoeveel zware blokken kracht-duur heeft: 5, in een deloadweek 3. */
export function hardBlocks(deload: boolean): number {
  return deload ? 3 : 5
}

export function variantLoad(variant: BikeVariant, deload: boolean): number {
  return variant === 'kracht_duur' ? round(BIKE_LOAD_PER_HARD_BLOCK * hardBlocks(deload)) : BIKE_LOAD_EASY
}

/**
 * De variant waarmee een fietsactiviteit meetelt. Een vervangende rit heeft er een; een
 * losse rit is een duurrit, tenzij je bij het toevoegen "zwaar" koos.
 */
export function effectiveVariant(a: Activity): BikeVariant {
  if (a.variant) return a.variant
  return a.heavy ? 'kracht_duur' : 'duurrit'
}

export interface BikeLoadPart {
  naam: string
  variant: BikeVariant
  score: number
}

/**
 * De fietstrainingen die op deze dag meetellen in de beenbelasting.
 *
 * Een vervanging die nog niet gereden is telt al mee met de gekozen variant — net zoals een
 * geplande krachtsessie meetelt voor hij gedaan is. Is hij gereden, dan telt de rit zelf en
 * niet nog eens de planning.
 */
export function bikeLoadOn(state: UserState, iso: string): BikeLoadPart[] {
  const deload = deloadFor(state, iso).active
  const parts: BikeLoadPart[] = []
  const ritten = (state.activities ?? []).filter((a) => a.date === iso && isBikeActivity(a))
  for (const a of ritten) {
    const variant = effectiveVariant(a)
    parts.push({ naam: bikeName(variant), variant, score: variantLoad(variant, deload) })
  }
  const swap = activeSwap(state, iso)
  if (swap && !ritten.some((a) => a.replacesSession === swap.sessionKey)) {
    parts.push({ naam: bikeName(swap.variant), variant: swap.variant, score: variantLoad(swap.variant, deload) })
  }
  return parts
}

function bikeName(variant: BikeVariant): string {
  return `Fietsen (${BIKE_VARIANT_LABEL[variant].toLowerCase()})`
}

/* -------------------------------------------------------------------------
 * De vervanging zelf
 * ---------------------------------------------------------------------- */

/**
 * De vervanging van deze dag, als die er nog staat: een `bikeSwap` in de override én de
 * skip met reden `fietsen`. Allebei, want dat is wat vervangen neerzet en ongedaan maken
 * weer weghaalt.
 */
export function activeSwap(state: UserState, iso: string): BikeSwap | null {
  const swap = state.overrides?.[iso]?.bikeSwap
  if (!swap) return null
  return state.skips?.[`${iso}:strength`]?.reason === 'fietsen' ? swap : null
}

/** De geregistreerde rit bij een vervanging, of null zolang hij nog niet gereden is. */
export function swapRide(state: UserState, sessionKey: string): Activity | null {
  return (state.activities ?? []).find((a) => a.replacesSession === sessionKey) ?? null
}

/**
 * Tot wanneer een vervanging terug te draaien is: tot en met de dag zelf. Daarna is het
 * historie — de krachtsessie komt dan niet meer terug, want die dag is voorbij.
 */
export function canUndoSwap(iso: string, vandaag: string): boolean {
  return vandaag <= iso
}

/** Vervangen kan vandaag en vooruit; een dag die voorbij is vul je in of sla je over. */
export function canSwap(iso: string, vandaag: string): boolean {
  return iso >= vandaag
}

/* -------------------------------------------------------------------------
 * Welke variant de app voorstelt
 * ---------------------------------------------------------------------- */

export interface VariantSuggestion {
  variant: BikeVariant
  /** waarom deze, in één regel */
  reason: string
}

/** De beensessies van het programma van Rob. */
const LEG_DAYS: DayKind[] = ['legs_a', 'legs_b']

/**
 * Beengericht: benen A of B, of een sessie die volgens de belastingsscore zwaar op de
 * benen is (bij Anouc de full body met de squat erin). Wordt uitgerekend op de sessie
 * zoals hij gepland stond; `strengthScore` is de score van alleen het krachtwerk.
 */
export function isLegFocused(kind: DayKind | null, strengthScore: number, high: number): boolean {
  if (!kind) return false
  return LEG_DAYS.includes(kind) || strengthScore >= high
}

/**
 * De keuzeregel, in deze volgorde:
 *
 * a. benen zwaar in de dagcheck, pijn aan knie of heup, of een hoge beenbelasting in de
 *    48 uur ervoor → rustige duurrit;
 * b. anders, bij een beengerichte sessie → kracht-duur;
 * c. anders → rustige duurrit.
 *
 * `recentHigh` en `legFocused` komen van buiten (`legLoad.ts`), zodat deze module de
 * belastingsscore niet zelf hoeft te kennen en er geen kring ontstaat.
 */
export function suggestVariant(
  state: UserState,
  iso: string,
  input: { legFocused: boolean; recentHigh: boolean },
): VariantSuggestion {
  const check = dayCheckOn(state, iso)
  const plek = painSpot(check)
  if (legsHeavy(check)) return { variant: 'duurrit', reason: 'Benen zwaar gemeld: rustig trappen.' }
  if (plek === 'knie' || plek === 'heup') {
    return { variant: 'duurrit', reason: `${plek === 'knie' ? 'Knie' : 'Heup'} gemeld: rustig trappen.` }
  }
  if (input.recentHigh) {
    return { variant: 'duurrit', reason: 'Zwaar beenwerk in de afgelopen 48 uur: rustig trappen.' }
  }
  if (input.legFocused) {
    return { variant: 'kracht_duur', reason: 'Beensessie: kracht-duur houdt de benen aan het werk.' }
  }
  return { variant: 'duurrit', reason: 'Geen beensessie: een rustige duurrit.' }
}

/**
 * De extra regel bij de duurrit: bij zware benen of pijn aan knie of heup moet de
 * weerstand echt licht blijven en de cadans hoog.
 */
export const EASY_CAUTION = 'Lichte weerstand, cadans niet onder 85.'

export function needsCaution(state: UserState, iso: string): boolean {
  const check = dayCheckOn(state, iso)
  const plek = painSpot(check)
  return legsHeavy(check) || plek === 'knie' || plek === 'heup'
}

/* -------------------------------------------------------------------------
 * De opbouw: blokken met een timer
 * ---------------------------------------------------------------------- */

export interface BikeBlock {
  /** korte naam boven de timer */
  label: string
  minutes: number
  /** weerstand, cadans en inspanning in één regel */
  text: string
  /** een zwaar blok: de wissel ernaartoe is de wissel die je moet merken */
  hard: boolean
}

/**
 * De blokken van een variant. In de deloadweek heeft kracht-duur drie zware blokken in
 * plaats van vijf; de rest blijft gelijk. De duurrit verandert niet — die is al licht.
 */
export function bikeBlocks(variant: BikeVariant, opts: { deload: boolean; caution: boolean }): BikeBlock[] {
  if (variant === 'duurrit') {
    const duur =
      'Lichte tot matige weerstand, cadans 85–95, inspanning 3–4/10: praten kan nog.' +
      (opts.caution ? ` ${EASY_CAUTION}` : '')
    return [
      { label: 'Inrijden', minutes: 5, text: 'Lichte weerstand, cadans 85–90.', hard: false },
      { label: 'Duurrit', minutes: 30, text: duur, hard: false },
      { label: 'Uitrijden', minutes: 5, text: 'Lichte weerstand, rustig uittrappen.', hard: false },
    ]
  }

  const n = hardBlocks(opts.deload)
  const out: BikeBlock[] = [
    { label: 'Inrijden', minutes: 10, text: 'Lichte weerstand, cadans 90.', hard: false },
  ]
  for (let i = 1; i <= n; i++) {
    out.push({
      label: `Zwaar blok ${i} van ${n}`,
      minutes: 4,
      text: 'Zware weerstand, cadans 75–85, inspanning 7/10. Nooit onder cadans 75.',
      hard: true,
    })
    if (i < n) {
      out.push({ label: 'Rustig trappen', minutes: 2, text: 'Lichte weerstand, rustig doortrappen.', hard: false })
    }
  }
  out.push({ label: 'Uitrijden', minutes: 5, text: 'Lichte weerstand, rustig uittrappen.', hard: false })
  return out
}

export function blocksMinutes(blocks: BikeBlock[]): number {
  return blocks.reduce((sum, b) => sum + b.minutes, 0)
}

/** De geplande duur van een variant op die dag, in minuten. */
export function plannedMinutes(state: UserState, iso: string, variant: BikeVariant): number {
  return blocksMinutes(
    bikeBlocks(variant, { deload: deloadFor(state, iso).active, caution: needsCaution(state, iso) }),
  )
}

export interface BlockPosition {
  /** index van het blok waar je nu in zit; gelijk aan de lengte als de rit af is */
  index: number
  /** milliseconden die er van dit blok nog over zijn */
  remainingMs: number
  /** de hele rit is voorbij */
  finished: boolean
}

/**
 * Waar je in de rit zit, uitgerekend uit het starttijdstip en de klok — niet uit een
 * teller die doorliep of niet. Hetzelfde principe als de rusttimer: gaat het scherm uit,
 * dan klopt de positie zodra het weer aangaat.
 */
export function blockAt(blocks: BikeBlock[], startedAt: number, now: number): BlockPosition {
  let t = Math.max(0, now - startedAt)
  for (let i = 0; i < blocks.length; i++) {
    const ms = blocks[i].minutes * 60_000
    if (t < ms) return { index: i, remainingMs: ms - t, finished: false }
    t -= ms
  }
  return { index: blocks.length, remainingMs: 0, finished: true }
}

/* -------------------------------------------------------------------------
 * Tellen
 * ---------------------------------------------------------------------- */

/** Minuten fietsen op deze dagen: vervangende ritten en losse ritten samen. */
export function weekBikeMinutes(state: UserState, days: string[]): number {
  const set = new Set(days)
  return (state.activities ?? [])
    .filter((a) => isBikeActivity(a) && set.has(a.date))
    .reduce((sum, a) => sum + a.minutes, 0)
}

/**
 * Beengerichte krachtsessies die in de `days` dagen tot en met `iso` door fietsen vervangen
 * zijn. Telt wat er vervangen is, ook als de rit nog niet geregistreerd is: de beensessie
 * is dan net zo goed niet gedaan.
 */
export function replacedLegSessions(state: UserState, iso: string, days: number): number {
  let n = 0
  for (let i = 0; i < days; i++) {
    const swap = activeSwap(state, addDays(iso, -i))
    if (swap?.legFocused) n++
  }
  return n
}

/**
 * De regel over beenprioriteit, of null. Eén feitelijke regel, niet blokkerend; aantal en
 * periode staan per profiel in de instellingen.
 */
export function legPriorityNote(state: UserState, iso: string): string | null {
  const rule = state.settings?.bikeLegPriority
  if (!rule) return null
  const n = replacedLegSessions(state, iso, rule.days)
  if (n < rule.count) return null
  return `${n} beensessies vervangen door fietsen in ${rule.days} dagen — fietsen vervangt geen zwaar beenwerk.`
}

/** De krachtsessie die op deze dag gepland staat, voor de sessiesleutel. */
export function strengthKindOn(state: UserState, iso: string): DayKind | null {
  const kind = scheduledStrength(state, iso).kind
  return kind && kind !== 'rest' ? kind : null
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
