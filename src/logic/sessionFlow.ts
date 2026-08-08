import type { LoggedSet } from '../types'
import type { Target } from './progression'
import type { StartAdvice } from './startWeight'

/**
 * Voorvulling van de sets van één oefening, in aflopende volgorde van kennis:
 * 1. streefwaarden uit eerdere sessies (`targetFor`, de bestaande progressielogica);
 * 2. anders het startgewichtadvies (`startWeightAdvice`);
 * 3. anders een leeg gewichtsveld met het schema-aantal herhalingen.
 * `target.reps` valt zelf al terug op repMin zolang er geen historie is.
 */
export function seedSets(count: number, target: Target, advice: StartAdvice | null): LoggedSet[] {
  const weight = target.weight ?? advice?.weight ?? 0
  return Array.from({ length: count }, () => ({ weight, reps: target.reps, rir: 2, done: false }))
}

/**
 * Vinkt set `i` af en zet de waarden door naar de eerstvolgende set, zodat die
 * alleen nog bijgesteld hoeft te worden. Een al afgevinkte set blijft ongemoeid.
 */
export function checkSet(sets: LoggedSet[], i: number): LoggedSet[] {
  const out = sets.map((s, idx) => (idx === i ? { ...s, done: true } : s))
  const next = out[i + 1]
  if (next && !next.done) {
    out[i + 1] = { ...next, weight: out[i].weight, reps: out[i].reps, rir: out[i].rir }
  }
  return out
}

export function uncheckSet(sets: LoggedSet[], i: number): LoggedSet[] {
  return sets.map((s, idx) => (idx === i ? { ...s, done: false } : s))
}

export function allSetsDone(sets: LoggedSet[]): boolean {
  return sets.length > 0 && sets.every((s) => s.done)
}

/** Sleutel van de volgende niet-afgeronde oefening ná `afterKey`, met doorloop naar het begin. */
export function nextUncompleted(keys: string[], completed: string[], afterKey: string): string | null {
  const i = keys.indexOf(afterKey)
  const order = i === -1 ? keys : [...keys.slice(i + 1), ...keys.slice(0, i)]
  return order.find((k) => !completed.includes(k)) ?? null
}

export function toggleCompleted(completed: string[], key: string): string[] {
  return completed.includes(key) ? completed.filter((k) => k !== key) : [...completed, key]
}
