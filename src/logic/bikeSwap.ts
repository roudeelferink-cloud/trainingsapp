import type { UserState } from '../types'
import { suggestVariant, strengthKindOn, isLegFocused, type VariantSuggestion } from './bike'
import { LEG_LOAD_HIGH, recentHighLegLoad, strengthLegLoad } from './legLoad'

/**
 * De keuzeregel van `bike.ts` met de beenbelasting erbij. Staat apart omdat `legLoad.ts`
 * zelf de fietsbelasting uit `bike.ts` leest; zo loopt er geen kring.
 */

/**
 * Is de krachtsessie van deze dag beengericht? Benen A/B, of zwaar op de benen volgens de
 * belastingsscore. Gerekend op de sessie zoals hij gepland staat, ook als hij al vervangen
 * of overgeslagen is.
 */
export function legFocusedOn(state: UserState, iso: string): boolean {
  const kind = strengthKindOn(state, iso)
  return isLegFocused(kind, strengthLegLoad(state, iso, true).score, LEG_LOAD_HIGH)
}

/** Welke variant de app voor deze dag voorstelt, met de reden. */
export function bikeSuggestion(state: UserState, iso: string): VariantSuggestion {
  return suggestVariant(state, iso, {
    legFocused: legFocusedOn(state, iso),
    recentHigh: recentHighLegLoad(state, iso),
  })
}
