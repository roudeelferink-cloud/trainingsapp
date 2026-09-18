import type { AppState, RunLog, SessionLog, UserState } from '../types'

/**
 * Een importbestand samenvoegen met wat er op dit toestel staat.
 *
 * Tot nu toe verving een import de hele staat. Dat ging goed zolang er één toestel was
 * met allebei de profielen erop. Maar elk toestel wordt door één persoon gebruikt, en een
 * export bevat altijd beide profielen — het profiel dat op dat toestel niet in gebruik is
 * staat er leeg in. Vervangen betekende dan: de historie van dit toestel overschreven door
 * dat lege profiel, en het toestel omgezet naar wie het bestand maakte. Wat je daarna zag
 * was de (lege of andermans) historie van een profiel dat je niet gekozen had.
 *
 * Nu voegt de import samen, per profiel:
 *
 * - **Historie** (sessies, loops, dagchecks, activiteiten, afwijkingen, meldingen, en de
 *   planning per dag) is de vereniging van beide kanten, op sleutel of id. Dezelfde
 *   sessie twee keer importeren geeft dus één sessie, geen twee.
 * - Staat dezelfde sessie of loop aan beide kanten, dan wint de afgeronde van een
 *   concept, en van twee afgeronde de laatst afgeronde. Bij gelijkspel blijft de lokale.
 * - **De rest** (instellingen, streefgewichten, startdatum) komt van de kant met de
 *   jongste historie: dat is de kant die weet waar je nu staat. Een profiel dat hier nog
 *   niets gelogd heeft neemt het bestand in zijn geheel over, zoals voorheen.
 * - **Wie dit toestel gebruikt** en **de pincode** horen bij het toestel: die komen alleen
 *   uit het bestand als ze hier nog niet gezet zijn.
 */
export function mergeImport(local: AppState, incoming: AppState): AppState {
  const users: Record<string, UserState> = { ...local.users }
  for (const [id, inUser] of Object.entries(incoming.users)) {
    const localUser = local.users[id]
    users[id] = localUser ? mergeUser(localUser, inUser) : inUser
  }
  return {
    ...incoming,
    currentUser: local.currentUser || incoming.currentUser,
    pin: local.pin ?? incoming.pin,
    users,
  }
}

function mergeUser(local: UserState, incoming: UserState): UserState {
  if (!hasHistory(local)) return incoming
  if (!hasHistory(incoming)) return local

  // de kant met de jongste historie levert instellingen en streefgewichten
  const incomingNewer = latest(incoming) > latest(local)
  const [base, other] = incomingNewer ? [incoming, local] : [local, incoming]

  return {
    ...base,
    sessions: mergeLogs(local.sessions, incoming.sessions),
    runs: mergeLogs(local.runs, incoming.runs),
    dayChecks: mergeDayChecks(local.dayChecks, incoming.dayChecks),
    activities: unionById(local.activities, incoming.activities),
    deviations: unionById(local.deviations, incoming.deviations),
    notices: unionNotices(local.notices, incoming.notices),
    // planning per dag: wat hier staat wint, het bestand vult aan
    runPlans: { ...incoming.runPlans, ...local.runPlans },
    deloadSkips: { ...incoming.deloadSkips, ...local.deloadSkips },
    skips: { ...incoming.skips, ...local.skips },
    moves: { ...incoming.moves, ...local.moves },
    runMoves: { ...incoming.runMoves, ...local.runMoves },
    overrides: { ...incoming.overrides, ...local.overrides },
    // streefgewichten van de jongste kant; een oefening die alleen de ander kent blijft
    exerciseState: { ...other.exerciseState, ...base.exerciseState },
    permanentReplacements: { ...other.permanentReplacements, ...base.permanentReplacements },
  }
}

/** Heeft dit profiel iets gelogd? Instellingen alleen tellen niet als historie. */
function hasHistory(u: UserState): boolean {
  return (
    Object.keys(u.sessions).length > 0 ||
    Object.keys(u.runs).length > 0 ||
    Object.keys(u.dayChecks).length > 0 ||
    u.activities.length > 0
  )
}

/** Het jongste moment waarop er in dit profiel iets gelogd is. */
function latest(u: UserState): string {
  let max = ''
  for (const log of [...Object.values(u.sessions), ...Object.values(u.runs)]) {
    const t = log?.completedAt || log?.date || ''
    if (t > max) max = t
  }
  for (const a of u.activities) if (a.createdAt > max) max = a.createdAt
  for (const datum of Object.keys(u.dayChecks)) if (datum > max) max = datum
  return max
}

/** Per sleutel de beste versie: afgerond boven concept, daarna de laatst afgeronde. */
function mergeLogs<T extends SessionLog | RunLog>(
  local: Record<string, T>,
  incoming: Record<string, T>,
): Record<string, T> {
  const out: Record<string, T> = { ...local }
  for (const [key, log] of Object.entries(incoming)) {
    const mine = out[key]
    if (!mine || beats(log, mine)) out[key] = log
  }
  return out
}

function beats(a: SessionLog | RunLog, b: SessionLog | RunLog): boolean {
  const ta = a?.completedAt ?? ''
  const tb = b?.completedAt ?? ''
  return ta > tb
}

function mergeDayChecks(
  local: UserState['dayChecks'],
  incoming: UserState['dayChecks'],
): UserState['dayChecks'] {
  const out: UserState['dayChecks'] = { ...incoming }
  for (const [datum, check] of Object.entries(local)) out[datum] = { ...incoming[datum], ...check }
  return out
}

/** Lokaal eerst, in de volgorde waarin het stond; wat alleen het bestand kent erachter. */
function unionById<T extends { id: string }>(local: T[], incoming: T[]): T[] {
  const seen = new Set(local.map((x) => x.id))
  return [...local, ...incoming.filter((x) => !seen.has(x.id))]
}

/** Een melding is dezelfde als datum en tekst gelijk zijn; er is geen id. */
function unionNotices(local: UserState['notices'], incoming: UserState['notices']): UserState['notices'] {
  const seen = new Set(local.map((n) => `${n.date}|${n.text}`))
  const extra = incoming.filter((n) => !seen.has(`${n.date}|${n.text}`))
  return [...local, ...extra]
}
