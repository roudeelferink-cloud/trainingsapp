import { toISO } from '../../src/logic/dates'
import { SCHEMA_VERSION, migrate } from '../../src/store/schema'
import { ReviewFout } from './fouten'
import type { UserState } from '../../src/types'

/**
 * Het verzoek uitpakken.
 *
 * De app stuurt de volledige staat mee, in exact dezelfde vorm als de JSON-export. Dat
 * is met opzet: het is de vorm die de app al maakt, die al een migratiepad heeft en die
 * al getest is. Hier gaat hij door `migrate()` — dezelfde functie als bij het importeren
 * van een back-up — zodat een toestel dat nog een versie achterloopt gewoon een advies
 * krijgt in plaats van een foutmelding.
 *
 * Er gaat niets terug naar het toestel behalve het advies, en er blijft hier niets van de
 * staat achter: alleen het advies zelf gaat de dagcache in.
 */

export interface Verzoek {
  profiel: string
  vandaag: string
  user: UserState
}

const DATUM = /^\d{4}-\d{2}-\d{2}$/

export function parseVerzoek(raw: unknown, nu: Date): Verzoek {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ReviewFout('verzoek', 'Het verzoek is geen object.')
  }
  const body = raw as Record<string, unknown>

  const profiel = typeof body.profiel === 'string' ? body.profiel.trim() : ''
  if (profiel === '') {
    throw new ReviewFout('verzoek', "Veld 'profiel' ontbreekt.")
  }

  let vandaag = toISO(nu)
  if (body.vandaag !== undefined) {
    if (typeof body.vandaag !== 'string' || !DATUM.test(body.vandaag)) {
      throw new ReviewFout('verzoek', "Veld 'vandaag' moet een datum zijn als 2026-08-26.")
    }
    vandaag = body.vandaag
  }

  const state = body.state
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new ReviewFout('verzoek', "Veld 'state' ontbreekt of is geen object.")
  }
  const versie = (state as { schemaVersion?: unknown }).schemaVersion
  if (typeof versie !== 'number') {
    throw new ReviewFout('verzoek', "In 'state' ontbreekt schemaVersion.")
  }
  if (versie > SCHEMA_VERSION) {
    throw new ReviewFout(
      'verzoek',
      `De staat komt uit een nieuwere versie (${versie}) dan deze server kent (${SCHEMA_VERSION}).`,
    )
  }

  const root = migrate(state)
  const user = root.users[profiel]
  if (!user) {
    throw new ReviewFout('verzoek', `Profiel '${profiel}' staat niet in de meegestuurde staat.`)
  }

  return { profiel, vandaag, user }
}
