import type { LoggedSet } from '../types'
import type { Target } from './progression'
import type { StartAdvice } from './startWeight'

/**
 * Voorvulling van de sets van één oefening, in aflopende volgorde van kennis:
 * 1. streefwaarden uit eerdere sessies (`targetFor`, de bestaande progressielogica);
 * 2. anders het startgewichtadvies (`startWeightAdvice`);
 * 3. anders een leeg gewichtsveld met het schema-aantal herhalingen.
 * `target.reps` valt zelf al terug op repMin zolang er geen historie is.
 *
 * Bandwerk krijgt een niveau in plaats van een gewicht; `weight` blijft daar 0.
 */
export function seedSets(count: number, target: Target, advice: StartAdvice | null): LoggedSet[] {
  if (target.level !== null) {
    const level = target.level
    return Array.from({ length: count }, () => ({
      weight: 0,
      level,
      reps: target.reps,
      rir: 2,
      done: false,
    }))
  }
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
    out[i + 1] = {
      ...next,
      weight: out[i].weight,
      level: out[i].level,
      reps: out[i].reps,
      rir: out[i].rir,
    }
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

/* -------------------------------------------------------------------------
 * Navigeren binnen een sessie
 * ---------------------------------------------------------------------- */

/**
 * De stappen van een sessie op volgorde: de warming-up en daarna de oefeningen. Eén
 * lijst, zodat vooruit, achteruit en het springen vanaf de voortgangsbalk allemaal
 * dezelfde volgorde gebruiken en er geen tweede waarheid over "waar ben ik" ontstaat.
 */
export function sessionSteps(warmupKey: string, slotKeys: string[]): string[] {
  return [warmupKey, ...slotKeys]
}

/** De stap ervoor; null als je al vooraan staat. Loopt niet rond. */
export function stepBefore(steps: string[], current: string): string | null {
  const i = steps.indexOf(current)
  return i > 0 ? steps[i - 1] : null
}

/** De stap erna; null als je al achteraan staat. Loopt niet rond. */
export function stepAfter(steps: string[], current: string): string | null {
  const i = steps.indexOf(current)
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null
}

/**
 * Staat deze oefening als laatste in de sessie?
 *
 * Bewust op de plek in de lijst en niet op "is de rest al afgerond". Dat laatste zette
 * de knop op "Sessie afronden" zodra je terugsprong naar oefening 1 van 5 met de rest al
 * gedaan — terwijl je daar juist niet aan het afronden was. Afronden hoort bij de
 * laatste oefening; overal daarvoor ga je naar de volgende.
 */
export function isLastSlot(slotKeys: string[], current: string): boolean {
  return slotKeys.length > 0 && slotKeys[slotKeys.length - 1] === current
}

/**
 * Welke set de invoer onderin bewerkt.
 *
 * 1. een set die je zelf aantikt wint altijd — zo corrigeer je een set van een al
 *    afgeronde oefening zonder die oefening terug te hoeven zetten;
 * 2. anders de eerste set die nog niet af is;
 * 3. is alles af, dan de laatste: die heb je net gedaan.
 */
export function editIndex(sets: LoggedSet[], selected: number | null): number {
  if (selected !== null && selected >= 0 && selected < sets.length) return selected
  const open = sets.findIndex((s) => !s.done)
  if (open !== -1) return open
  return Math.max(sets.length - 1, 0)
}

/** Hoe een segment van de voortgangsbalk erbij staat. */
export type StepMark = 'done' | 'current' | 'todo'

/**
 * De voortgangsbalk. De stap waar je nú staat krijgt een eigen markering, ook als hij
 * al afgerond is: anders is een balk met alles gevuld niet te onderscheiden van een
 * sessie waarin je halverwege teruggesprongen bent.
 */
export function stepMark(key: string, current: string, done: string[]): StepMark {
  if (key === current) return 'current'
  return done.includes(key) ? 'done' : 'todo'
}
