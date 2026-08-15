/**
 * De drempel voor "alles wissen".
 *
 * Wissen is de enige actie in deze app die niet terug te draaien is, dus staat er een
 * pincode van vier cijfers voor. Dat is **misklikbeveiliging, geen echte beveiliging**:
 * de code staat leesbaar in localStorage (zie `AppState.pin`). Hij is er om te
 * voorkomen dat een verdwaalde tik een jaar historie kost.
 *
 * Drie foute pogingen sluiten de dialoog en zetten de actie een minuut op slot. Die
 * teller staat hier op moduleniveau en niet in een component: een dialoog opnieuw
 * openen mag de blokkade niet wissen.
 */

export const PIN_LENGTH = 4
export const MAX_ATTEMPTS = 3
export const BLOCK_MS = 60_000

export interface GuardState {
  /** foute pogingen sinds de laatste blokkade of goede code */
  attempts: number
  /** tijdstip (ms) waarop de blokkade afloopt; null = niet geblokkeerd */
  blockedUntil: number | null
}

export function emptyGuard(): GuardState {
  return { attempts: 0, blockedUntil: null }
}

export function isValidPin(code: string): boolean {
  return new RegExp(`^[0-9]{${PIN_LENGTH}}$`).test(code)
}

/** Alleen cijfers, afgekapt op de lengte van een pincode. */
export function sanitizePin(input: string): string {
  return input.replace(/\D/g, '').slice(0, PIN_LENGTH)
}

/**
 * Mag de bevestigknop aan? Alleen bij een volledige, juiste code. Zolang dit false is
 * blijft de knop uit — er is dus geen enkel pad waarop een verkeerde code wist.
 */
export function canConfirm(expected: string | null, code: string): boolean {
  return expected !== null && isValidPin(expected) && isValidPin(code) && code === expected
}

export function isBlocked(guard: GuardState, now = Date.now()): boolean {
  return guard.blockedUntil !== null && guard.blockedUntil > now
}

/** Hele seconden tot de blokkade voorbij is; 0 als er niets loopt. */
export function blockSecondsLeft(guard: GuardState, now = Date.now()): number {
  if (!isBlocked(guard, now)) return 0
  return Math.ceil((guard.blockedUntil! - now) / 1000)
}

export interface AttemptResult {
  ok: boolean
  guard: GuardState
  /** deze poging heeft de blokkade in gang gezet */
  blocked: boolean
  /** pogingen die nog over zijn voordat het op slot gaat */
  left: number
}

/**
 * Eén poging. Een goede code zet de teller terug; de derde foute zet de blokkade aan.
 * Tijdens een lopende blokkade telt niets mee — daar komt geen enkele code doorheen.
 */
export function attempt(
  guard: GuardState,
  expected: string | null,
  code: string,
  now = Date.now(),
): AttemptResult {
  if (isBlocked(guard, now)) return { ok: false, guard, blocked: true, left: 0 }

  if (expected !== null && isValidPin(expected) && code === expected) {
    return { ok: true, guard: emptyGuard(), blocked: false, left: MAX_ATTEMPTS }
  }

  const attempts = guard.attempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      guard: { attempts: 0, blockedUntil: now + BLOCK_MS },
      blocked: true,
      left: 0,
    }
  }
  return { ok: false, guard: { ...guard, attempts }, blocked: false, left: MAX_ATTEMPTS - attempts }
}

/* ---------------- de teller van dit toestel ---------------- */

let guard: GuardState = emptyGuard()

export function currentGuard(): GuardState {
  return guard
}

export function registerAttempt(expected: string | null, code: string, now = Date.now()): AttemptResult {
  const res = attempt(guard, expected, code, now)
  guard = res.guard
  return res
}

/** Alleen voor tests: de teller terug naar nul. */
export function resetGuardForTests(): void {
  guard = emptyGuard()
}
