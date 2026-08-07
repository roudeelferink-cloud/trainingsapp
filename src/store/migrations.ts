import { TEMPLATES } from '../data/plan'

/**
 * Migratiepad voor opgeslagen data.
 *
 * Elke functie tilt de staat van versie N naar N+1. Oude data wordt dus opgehoogd,
 * nooit geweigerd of gewist. Nieuwe versie toevoegen: verhoog SCHEMA_VERSION in
 * store.ts en zet hier de stap erbij onder de oude versienummer als sleutel.
 *
 * De functies werken op losse `unknown`-data, niet op AppState: oude vormen voldoen
 * per definitie niet aan het huidige type.
 */
export type RawState = Record<string, unknown>

/**
 * v1 -> v2: sessielogs kregen een `exercises`-map (slotKey -> exerciseId), zodat de
 * voortgangsgrafiek weet welke oefening er daadwerkelijk gedaan is. Oude logs vullen
 * we aan met de standaardoefening van dat slot.
 */
function v1_to_v2(state: RawState): RawState {
  const sessions = (state.sessions ?? {}) as Record<string, Record<string, unknown>>
  const next: Record<string, Record<string, unknown>> = {}

  for (const [key, log] of Object.entries(sessions)) {
    if (log && typeof log === 'object' && !log.exercises) {
      const entries = (log.entries ?? {}) as Record<string, unknown>
      const exercises: Record<string, string> = {}
      for (const slotKey of Object.keys(entries)) {
        const id = defaultExerciseForSlot(slotKey)
        if (id) exercises[slotKey] = id
      }
      next[key] = { ...log, exercises }
    } else {
      next[key] = log
    }
  }

  return { ...state, sessions: next, lastExportAt: state.lastExportAt ?? null }
}

/** Standaardoefening van een slot, op basis van de sjablonen. */
function defaultExerciseForSlot(slotKey: string): string | null {
  const [kind, index] = slotKey.split(':')
  const tpl = (TEMPLATES as Record<string, { slots: { exerciseId: string }[] } | undefined>)[kind]
  const slot = tpl?.slots[Number(index)]
  return slot?.exerciseId ?? null
}

export const MIGRATIONS: Record<number, (s: RawState) => RawState> = {
  1: v1_to_v2,
}

/**
 * Draait alle migratiestappen tussen `from` en `to`.
 * Ontbreekt er een stap, dan stopt hij daar; de daaropvolgende default-aanvulling
 * in migrate() zorgt dat de staat alsnog bruikbaar is.
 */
export function runMigrations(state: RawState, from: number, to: number): RawState {
  let out = state
  for (let v = from; v < to; v++) {
    const step = MIGRATIONS[v]
    if (!step) break
    out = step(out)
    out.schemaVersion = v + 1
  }
  return out
}
