import type { OrderCategory } from '../types'
import type { ResolvedSlot } from './select'

/**
 * De vaste volgorde binnen een krachtsessie, van voor naar achter. De rangorde
 * komt uit het veld `orderCategory` op de oefening zelf, dus een nieuwe oefening
 * in de bibliotheek valt automatisch op zijn plek: hier staat geen lijst met
 * oefeningnamen, en in de UI al helemaal niet.
 */
export const ORDER_CATEGORIES: OrderCategory[] = ['heavy_legs', 'compound', 'isolation', 'core']

export const ORDER_CATEGORY_LABEL: Record<OrderCategory, string> = {
  heavy_legs: 'Zware beenoefening',
  compound: 'Samengesteld',
  isolation: 'Isolatie',
  core: 'Romp',
}

/** De uitleg achter het vraagteken bij de volgorde. */
export const ORDER_RATIONALE =
  'Zwaar en technisch werk staat vooraan, licht en vermoeiend werk achteraan. ' +
  'Fris begin je met de zwaarste beenoefening, daarna de andere samengestelde ' +
  'oefeningen, dan de isolatie en als afsluiter de romp. Zo gaat je beste energie ' +
  'naar de oefeningen die je progressie bepalen en train je de technische ' +
  'bewegingen niet met een vermoeide romp of vermoeide grip — dat scheelt ' +
  'blessurerisico.'

export function orderRank(category: OrderCategory): number {
  const i = ORDER_CATEGORIES.indexOf(category)
  return i === -1 ? ORDER_CATEGORIES.length : i
}

/**
 * Standaardvolgorde: op categorie, en binnen een categorie blijft de volgorde
 * van het sjabloon staan. Sorteren gebeurt met een expliciete tiebreak op de
 * oorspronkelijke plek, zodat het resultaat niet afhangt van de sorteermethode.
 */
export function sortByCategory(slots: ResolvedSlot[]): ResolvedSlot[] {
  return slots
    .map((slot, i) => ({ slot, i }))
    .sort((a, b) => {
      const d = orderRank(a.slot.exercise.orderCategory) - orderRank(b.slot.exercise.orderCategory)
      return d !== 0 ? d : a.i - b.i
    })
    .map((x) => x.slot)
}

/**
 * De volgorde zoals de sessie hem toont. Een eigen volgorde (`order` op de dag)
 * wint van de sortering: die is de standaard, geen slot. Slots die niet in de
 * eigen volgorde voorkomen — bijvoorbeeld omdat ze pas later terugkwamen — volgen
 * erachter, onderling weer in de standaardvolgorde.
 */
export function orderSlots(slots: ResolvedSlot[], manual?: string[]): ResolvedSlot[] {
  const sorted = sortByCategory(slots)
  if (!manual || manual.length === 0) return sorted

  const first: ResolvedSlot[] = []
  for (const key of manual) {
    const found = sorted.find((r) => r.slot.key === key)
    if (found) first.push(found)
  }
  return [...first, ...sorted.filter((r) => !first.includes(r))]
}

/**
 * Eén oefening een plek naar voren (-1) of naar achteren (+1) in een lijst
 * slotKeys. Buiten de lijst schuiven kan niet; dan blijft de volgorde zoals hij is.
 */
export function moveKey(keys: string[], key: string, direction: -1 | 1): string[] {
  const from = keys.indexOf(key)
  const to = from + direction
  if (from === -1 || to < 0 || to >= keys.length) return keys
  const next = [...keys]
  next[from] = next[to]
  next[to] = key
  return next
}
