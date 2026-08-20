import { getExercise } from '../data/exercises'
import { supportsDistance } from '../logic/activities'
import { programFor } from '../data/programs'
import { cycleInfo } from '../logic/cycle'
import { applyMove, buildDay, moveTargets, sessionKeyFor } from '../logic/day'
import { moveKey } from '../logic/order'
import type { ResolvedSlot } from '../logic/select'
import { applyProgression, stateFor } from '../logic/progression'
import { clampWarmupMinutes, warmupOf } from '../logic/warmup'
import { DELOAD_RISK, deloadFor } from '../logic/deload'
import { round05 } from '../logic/running'
import { plannedRunKm } from '../logic/runningLoad'
import { mondayOf } from '../logic/dates'
import type {
  Activity,
  ActivityIntensity,
  ActivityType,
  BarId,
  DayCheck,
  DayKind,
  DayScore,
  Deviation,
  DeviationKind,
  Feel,
  LoggedSet,
  RunKind,
  SessionLog,
  Settings,
  SkipReason,
  UserState,
  Warmup,
  WarmupType,
} from '../types'
import { normalizeSettings } from './settings'
import { getState, setState } from './store'

export function setCheckin(iso: string, value: number): void {
  setState((s) => ({ ...s, checkins: { ...s.checkins, [iso]: value } }))
}

export function clearCheckin(iso: string): void {
  setState((s) => {
    const checkins = { ...s.checkins }
    delete checkins[iso]
    return { ...s, checkins }
  })
}

/* ---- dagcheck en afwijkingen ---- */

/**
 * De optionele dagcheck: slaap en energie, allebei op een schaal van 3. Overslaan mag —
 * er staat niets in de weg als dit leeg blijft, en twee slechte weken op rij zijn pas een
 * signaal als er ook echt iets ingevuld is.
 */
export function setDayCheck(iso: string, check: DayCheck): void {
  setState((s) => ({ ...s, dayChecks: { ...s.dayChecks, [iso]: check } }))
}

export function setDayCheckPart(iso: string, part: 'sleep' | 'energy', value: DayScore): void {
  setState((s) => {
    const current = s.dayChecks?.[iso] ?? { sleep: 2, energy: 2 }
    return { ...s, dayChecks: { ...s.dayChecks, [iso]: { ...current, [part]: value } } }
  })
}

export function clearDayCheck(iso: string): void {
  setState((s) => {
    const dayChecks = { ...s.dayChecks }
    delete dayChecks[iso]
    return { ...s, dayChecks }
  })
}

let deviationSeq = 0

function deviationId(): string {
  deviationSeq += 1
  return `dev_${Date.now().toString(36)}_${deviationSeq.toString(36)}`
}

/**
 * Legt vast dat de gebruiker iets anders deed dan voorgesteld. Dit stuurt niets bij —
 * het is puur geheugen, zodat er later een patroon uit te lezen valt ("elke zondag twee
 * kilometer verder dan gepland").
 */
function recordDeviation(
  s: UserState,
  input: { date: string; kind: DeviationKind; suggested: number | null; chosen: number | null; note: string },
): UserState {
  const deviation: Deviation = {
    id: deviationId(),
    date: input.date,
    kind: input.kind,
    suggested: input.suggested,
    chosen: input.chosen,
    note: input.note,
    createdAt: new Date().toISOString(),
  }
  // 200 is ruim een half jaar aan afwijkingen; ouder dan dat zegt niets meer
  return { ...s, deviations: [...(s.deviations ?? []), deviation].slice(-200) }
}

function patchOverride(s: UserState, iso: string, patch: Partial<UserState['overrides'][string]>): UserState {
  return { ...s, overrides: { ...s.overrides, [iso]: { ...(s.overrides[iso] ?? {}), ...patch } } }
}

export function setShortVersion(iso: string, short: boolean): void {
  setState((s) => patchOverride(s, iso, { short }))
}

export function swapOnce(iso: string, slotKey: string, exerciseId: string): void {
  setState((s) => {
    const swaps = { ...(s.overrides[iso]?.swaps ?? {}), [slotKey]: exerciseId }
    return patchOverride(s, iso, { swaps })
  })
}

export function replacePermanently(iso: string, slotKey: string, exerciseId: string): void {
  setState((s) => {
    const swaps = { ...(s.overrides[iso]?.swaps ?? {}) }
    delete swaps[slotKey]
    const next = patchOverride(s, iso, { swaps })
    return { ...next, permanentReplacements: { ...s.permanentReplacements, [slotKey]: exerciseId } }
  })
}

export function undoPermanent(slotKey: string): void {
  setState((s) => {
    const perm = { ...s.permanentReplacements }
    delete perm[slotKey]
    return { ...s, permanentReplacements: perm }
  })
}

export function skipSlot(iso: string, slotKey: string): void {
  setState((s) => {
    const list = s.overrides[iso]?.skippedSlots ?? []
    if (list.includes(slotKey)) return s
    return patchOverride(s, iso, { skippedSlots: [...list, slotKey] })
  })
}

/* ---- volgorde van de oefeningen ---- */

/**
 * Schuift één oefening een plek naar voren of naar achteren. De sortering op
 * `orderCategory` is de standaard, geen slot: zodra je zelf schuift, legt de app
 * de hele volgorde van die dag vast en houdt zich daaraan.
 */
export function moveSlot(iso: string, slotKey: string, direction: -1 | 1): void {
  setState((s) => {
    const slots = buildDay(s, iso).strength?.slots ?? []
    const current = s.overrides[iso]?.order ?? slots.map((r) => r.slot.key)
    const next = moveKey(current, slotKey, direction)
    if (next === current) return s
    return patchOverride(s, iso, { order: next })
  })
}

/** Terug naar de automatische volgorde van die dag. */
export function resetSlotOrder(iso: string): void {
  setState((s) => {
    const override = s.overrides[iso]
    if (!override?.order) return s
    const { order: _eigen, ...rest } = override
    return { ...s, overrides: { ...s.overrides, [iso]: rest } }
  })
}

/* ---- warming-up ---- */

/**
 * Zet iets van de warming-up van deze sessie. Bestaat het sessielog nog niet —
 * je hebt nog niets gelogd — dan wordt het hier aangemaakt; de sessie geldt
 * daarmee nog niet als afgerond.
 */
function patchWarmup(iso: string, kind: DayKind, patch: Partial<Warmup>): void {
  const key = sessionKeyFor(iso, kind)
  setState((s) => {
    const cur = s.sessions[key]
    const warmup = { ...warmupOf(cur), ...patch }
    const base: SessionLog = cur ?? {
      date: iso,
      kind,
      short: s.overrides[iso]?.short ?? false,
      entries: {},
      exercises: {},
      skippedSlots: s.overrides[iso]?.skippedSlots ?? [],
      completedSlots: [],
      completedAt: null,
    }
    return { ...s, sessions: { ...s.sessions, [key]: { ...base, warmup } } }
  })
}

export function setWarmupType(iso: string, kind: DayKind, type: WarmupType): void {
  patchWarmup(iso, kind, { type })
}

export function setWarmupMinutes(iso: string, kind: DayKind, minutes: number): void {
  patchWarmup(iso, kind, { minutes: clampWarmupMinutes(minutes) })
}

export function setWarmupDone(iso: string, kind: DayKind, done: boolean): void {
  patchWarmup(iso, kind, { done })
}

/**
 * Verplaatst een krachtsessie, vooruit of naar voren. Staat er op de doeldag al een
 * sessie, dan ruilen ze van plek.
 *
 * Conflicten houden de verplaatsing niet tegen: de MoveSheet toont ze vooraf met de
 * reden, en de gebruiker beslist. Alleen een dag die geen geldige bestemming ís — de
 * vaste rustdag, of een dag die al aan een verplaatsing meedoet — wordt geweigerd.
 */
export function moveSession(iso: string, target: string): { ok: boolean; reason?: string } {
  const doel = moveTargets(getState(), iso, 'strength').find((t) => t.date === target)
  if (!doel) return { ok: false, reason: 'Die dag kan niet.' }
  if (doel.blocked) return { ok: false, reason: doel.blocked }
  setState((s) => applyMove(s, iso, target, 'strength'))
  return { ok: true }
}

export function undoMove(iso: string): void {
  setState((s) => {
    const moves = { ...s.moves }
    const target = moves[iso]
    delete moves[iso]
    if (target && moves[target] === iso) delete moves[target]
    return { ...s, moves }
  })
}

/**
 * Verplaatst een loopsessie. Werkt hetzelfde als bij kracht, maar met een eigen
 * lijst: een dag met loop én krachtsessie kan ze onafhankelijk verzetten. Staat er
 * op de doeldag al een loop, dan ruilen ze van plek.
 *
 * Loopdagen kennen geen blokkades — de zaterdagregel gaat over zware beenbelasting
 * vlak voor de duurloop, niet over de loop zelf.
 */
export function moveRun(iso: string, target: string): { ok: boolean; reason?: string } {
  const from = buildDay(getState(), iso)
  if (!from.run) return { ok: false, reason: 'Er staat op deze dag geen loop.' }
  const doel = moveTargets(getState(), iso, 'run').find((t) => t.date === target)
  if (!doel) return { ok: false, reason: 'Die dag kan niet.' }
  if (doel.blocked) return { ok: false, reason: doel.blocked }
  setState((s) => applyMove(s, iso, target, 'run'))
  return { ok: true }
}

export function undoRunMove(iso: string): void {
  setState((s) => {
    const runMoves = { ...s.runMoves }
    const target = runMoves[iso]
    delete runMoves[iso]
    if (target && runMoves[target] === iso) delete runMoves[target]
    return { ...s, runMoves }
  })
}

export function skipSession(iso: string, what: 'strength' | 'run', reason: SkipReason): void {
  setState((s) => ({ ...s, skips: { ...s.skips, [`${iso}:${what}`]: { reason, what } } }))
}

export function undoSkip(iso: string, what: 'strength' | 'run'): void {
  setState((s) => {
    const skips = { ...s.skips }
    delete skips[`${iso}:${what}`]
    return { ...s, skips }
  })
}

export function setBike(iso: string, bike: boolean): void {
  setState((s) => patchOverride(s, iso, { bike }))
}

/**
 * Zet de geplande afstand van één loop met de hand. Dit wint van alles wat de app
 * uitrekent — inclusief de +10%-bewaking — maar de afwijking wordt vastgelegd.
 */
export function setPlannedRunKm(iso: string, kind: RunKind, km: number): void {
  if (!Number.isFinite(km) || km <= 0) return
  const gekozen = round05(km)
  setState((s) => {
    const voorstel = plannedRunKm(s, iso, kind)
    const next = { ...s, runPlans: { ...s.runPlans, [iso]: gekozen } }
    if (Math.abs(voorstel.km - gekozen) < 0.01) return next
    return recordDeviation(next, {
      date: iso,
      kind: 'run_plan',
      suggested: voorstel.km,
      chosen: gekozen,
      note: `Geplande afstand zelf op ${gekozen} km gezet; de app stelde ${voorstel.km} km voor.`,
    })
  })
}

/** Terug naar de afstand die de app voorstelt. */
export function clearPlannedRunKm(iso: string): void {
  setState((s) => {
    const runPlans = { ...s.runPlans }
    delete runPlans[iso]
    return { ...s, runPlans }
  })
}

/**
 * Vinkt een loop af. Gepland en werkelijk worden apart bewaard: `plannedKm` is wat er
 * voorgeschreven stond, `km` is wat er echt gelopen is. Wijkt dat meer dan een halve
 * kilometer af, dan komt het als afwijking in de historie — daar stuurt het loopvolume
 * van volgende week op bij.
 */
export function completeRun(
  iso: string,
  kind: RunKind,
  data: { plannedKm: number; km: number; minutes: number | null; bike: boolean; feel?: Feel },
): void {
  setState((s) => {
    const next: UserState = {
      ...s,
      runs: {
        ...s.runs,
        [iso]: { date: iso, kind, ...data, completedAt: new Date().toISOString() },
      },
    }
    if (data.bike || Math.abs(data.km - data.plannedKm) < 0.5) return next
    const verder = data.km > data.plannedKm
    return recordDeviation(next, {
      date: iso,
      kind: 'run_distance',
      suggested: data.plannedKm,
      chosen: data.km,
      note: `${data.km} km gelopen tegen ${data.plannedKm} km gepland — ${verder ? 'verder' : 'korter'} dan voorgesteld.`,
    })
  })
}

/* ---- deload ---- */

/**
 * Slaat de deloadweek van `iso` over. Dit lukt alleen met `acknowledged: true`: de
 * gebruiker moet in de dialoog eerst bevestigen dat hij het risico gelezen heeft. Eén
 * tik is bewust niet genoeg — zie `DELOAD_RISK`.
 */
export function skipDeload(iso: string, acknowledged: boolean): { ok: boolean; reason?: string } {
  if (!acknowledged) return { ok: false, reason: 'Bevestig eerst dat je het risico gelezen hebt.' }
  const plan = deloadFor(getState(), iso)
  if (!plan.reason) return { ok: false, reason: 'Deze week is geen deloadweek.' }

  setState((s) => {
    const weekStart = mondayOf(iso)
    const next: UserState = {
      ...s,
      deloadSkips: {
        ...s.deloadSkips,
        [weekStart]: { weekStart, confirmedAt: new Date().toISOString(), acknowledged: DELOAD_RISK },
      },
    }
    return recordDeviation(next, {
      date: weekStart,
      kind: 'deload_skip',
      suggested: null,
      chosen: null,
      note: `Deloadweek overgeslagen (aanleiding: ${plan.reason}).`,
    })
  })
  return { ok: true }
}

/* ---- meldingen wegklikken ---- */

/**
 * Klikt een structurele melding weg. De sleutel ís het patroon, dus zodra de combinatie
 * verandert komt de melding vanzelf terug; verandert er niets, dan blijft hij vier weken
 * stil. Zie `isDismissed` in `guardrails.ts`.
 */
export function dismissWarning(signature: string, iso: string): void {
  if (!signature) return
  setState((s) => ({ ...s, dismissedWarnings: { ...s.dismissedWarnings, [signature]: iso } }))
}

export function undismissWarning(signature: string): void {
  setState((s) => {
    const dismissedWarnings = { ...s.dismissedWarnings }
    delete dismissedWarnings[signature]
    return { ...s, dismissedWarnings }
  })
}

/** Toch de deload doen. Kan altijd, zonder drempel. */
export function undoSkipDeload(iso: string): void {
  setState((s) => {
    const deloadSkips = { ...s.deloadSkips }
    delete deloadSkips[mondayOf(iso)]
    return { ...s, deloadSkips }
  })
}

/* ---- losse activiteiten ---- */

export interface ActivityInput {
  type: ActivityType
  minutes: number
  intensity: ActivityIntensity
  /** alleen zinvol bij hardlopen, fietsen en wandelen; anders (of leeg) null */
  distanceKm?: number | null
  note?: string | null
}

let activitySeq = 0

function activityId(): string {
  activitySeq += 1
  return `act_${Date.now().toString(36)}_${activitySeq.toString(36)}`
}

function cleanNote(note: string | null | undefined): string | null {
  const trimmed = (note ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Afstand hoort alleen bij een activiteit waar kilometers iets betekenen. Bij de
 * rest (zwemmen, spinning, overig) verdwijnt hij, ook als het type later wijzigt.
 */
function cleanDistance(type: ActivityType, km: number | null | undefined): number | null {
  if (!supportsDistance(type)) return null
  if (km === null || km === undefined || !Number.isFinite(km) || km <= 0) return null
  return Math.round(km * 100) / 100
}

/**
 * Logt iets buiten het schema om. Mag op elke dag, ook op een rustdag, ook naast een
 * al afgeronde sessie, en meerdere keren per dag. Raakt de progressie niet aan.
 * Geeft het id terug zodat de UI meteen kan doorschakelen naar bewerken.
 */
export function addActivity(iso: string, input: ActivityInput): string {
  const activity: Activity = {
    id: activityId(),
    date: iso,
    type: input.type,
    minutes: Math.max(1, Math.round(input.minutes)),
    distanceKm: cleanDistance(input.type, input.distanceKm),
    intensity: input.intensity,
    note: cleanNote(input.note),
    createdAt: new Date().toISOString(),
  }
  setState((s) => ({ ...s, activities: [...s.activities, activity] }))
  return activity.id
}

/** Bewerkt een gelogde activiteit. De datum mag mee veranderen. */
export function updateActivity(
  id: string,
  patch: Partial<ActivityInput> & { date?: string },
): void {
  setState((s) => ({
    ...s,
    activities: s.activities.map((a) => {
      if (a.id !== id) return a
      const type = patch.type ?? a.type
      return {
        ...a,
        ...patch,
        type,
        minutes: patch.minutes === undefined ? a.minutes : Math.max(1, Math.round(patch.minutes)),
        // het type kan mee veranderen, dus de afstand wordt altijd opnieuw gewogen
        distanceKm: cleanDistance(type, patch.distanceKm === undefined ? a.distanceKm : patch.distanceKm),
        note: patch.note === undefined ? a.note : cleanNote(patch.note),
      }
    }),
  }))
}

export function removeActivity(id: string): void {
  setState((s) => ({ ...s, activities: s.activities.filter((a) => a.id !== id) }))
}

export function saveSessionDraft(
  iso: string,
  kind: DayKind,
  entries: Record<string, LoggedSet[]>,
  exercises: Record<string, string>,
  short: boolean,
  completedSlots: string[] = [],
): void {
  const key = sessionKeyFor(iso, kind)
  setState((s) => ({
    ...s,
    sessions: {
      ...s.sessions,
      [key]: {
        date: iso,
        kind,
        short,
        entries,
        exercises,
        skippedSlots: s.overrides[iso]?.skippedSlots ?? [],
        completedSlots,
        completedAt: s.sessions[key]?.completedAt ?? null,
        // de warming-up hoort bij de sessie en mag niet door een setwijziging vervallen
        warmup: s.sessions[key]?.warmup,
      },
    },
  }))
}

/**
 * Sluit de sessie af en laat de progressielogica de streefwaarden bijwerken.
 * Alleen afgevinkte sets tellen mee: voorgevulde maar niet-gedane sets worden
 * niet opgeslagen en sturen de progressie niet.
 *
 * De afsluitende beoordeling (`feel`) gaat mee de progressie in: die beslist samen met
 * de gehaalde reps of het gewicht omhoog mag. Hij hoort bij de sessie, dus hij wordt ook
 * op het log bewaard. Wie hem overslaat, valt terug op de gelogde RIR.
 */
export function completeSession(
  iso: string,
  kind: DayKind,
  slots: ResolvedSlot[],
  entries: Record<string, LoggedSet[]>,
  short: boolean,
  completedSlots: string[] = [],
  feel?: Feel,
): string[] {
  const messages: string[] = []
  const doneOnly = Object.fromEntries(
    slots.map((r) => [r.slot.key, (entries[r.slot.key] ?? []).filter((x) => x.done && x.reps > 0)]),
  )
  setState((s) => {
    const info = cycleInfo(s.startDate, iso)
    const checkin = s.checkins[iso]
    const pace = programFor(s).pace
    const deload = deloadFor(s, iso).active
    const allowIncrease = !info.calibration && !deload && checkin !== 3
    const exerciseState = { ...s.exerciseState }
    let next = s

    for (const r of slots) {
      const sets = doneOnly[r.slot.key]
      if (sets.length === 0) continue
      const ex = getExercise(r.exercise.id)
      const before = stateFor({ ...s, exerciseState }, ex.id)
      const res = applyProgression(ex, { repMin: r.repMin, repMax: r.repMax }, sets, before, {
        allowIncrease,
        pace,
        iso,
        feel,
        deload,
        settings: s.settings,
      })
      exerciseState[ex.id] = res.next
      if (res.message) messages.push(res.message)

      // zwaarder getild dan voorgesteld: dat mag, maar het wordt onthouden
      const heaviest = Math.max(...sets.map((x) => x.weight))
      if (before.targetWeight !== null && heaviest > before.targetWeight + 0.01) {
        next = recordDeviation(next, {
          date: iso,
          kind: 'lift_weight',
          suggested: before.targetWeight,
          chosen: heaviest,
          note: `${ex.naam}: ${heaviest} kg getild, voorstel was ${before.targetWeight} kg.`,
        })
      }
    }

    const key = sessionKeyFor(iso, kind)
    const notices = [...s.notices, ...messages.map((text) => ({ date: iso, text }))].slice(-50)

    return {
      ...next,
      exerciseState,
      notices,
      sessions: {
        ...s.sessions,
        [key]: {
          date: iso,
          kind,
          short,
          entries: doneOnly,
          exercises: Object.fromEntries(slots.map((r) => [r.slot.key, r.exercise.id])),
          skippedSlots: s.overrides[iso]?.skippedSlots ?? [],
          completedSlots,
          completedAt: new Date().toISOString(),
          warmup: s.sessions[key]?.warmup,
          feel,
        },
      },
    }
  })
  return messages
}

/** Beoordeling van een al afgeronde sessie bijstellen. */
export function setSessionFeel(iso: string, kind: DayKind, feel: Feel): void {
  const key = sessionKeyFor(iso, kind)
  setState((s) => {
    const log = s.sessions[key]
    if (!log) return s
    return { ...s, sessions: { ...s.sessions, [key]: { ...log, feel } } }
  })
}

export function reopenSession(iso: string, kind: DayKind): void {
  const key = sessionKeyFor(iso, kind)
  setState((s) => {
    const cur = s.sessions[key]
    if (!cur) return s
    return { ...s, sessions: { ...s.sessions, [key]: { ...cur, completedAt: null } } }
  })
}

/* ---- instellingen ---- */

/**
 * Instellingen wijzigen gaat altijd over een compleet `Settings`-object heen. Zo kan
 * een schakelaar nooit een half opgeslagen instelling verder uithollen, en staat na
 * één tik alles er weer volledig in.
 */
function patchSettings(s: UserState, patch: (current: Settings) => Partial<Settings>): UserState {
  const current = normalizeSettings(s.settings)
  return { ...s, settings: { ...current, ...patch(current) } }
}

export function setBodyweight(kg: number | null): void {
  setState((s) => patchSettings(s, () => ({ bodyweightKg: kg })))
}

export function setSensitivity(area: keyof UserState['settings']['sensitive'], value: 'ok' | 'careful' | 'off'): void {
  setState((s) => patchSettings(s, (c) => ({ sensitive: { ...c.sensitive, [area]: value } })))
}

/**
 * Eigen gewicht van een stang. 0 of minder wordt geweigerd: een stang zonder
 * gewicht bestaat niet en zou het getoonde totaal stilletjes fout maken.
 */
export function setBarWeight(bar: BarId, kg: number): void {
  if (!Number.isFinite(kg) || kg <= 0) return
  setState((s) =>
    patchSettings(s, (c) => ({
      barWeights: { ...c.barWeights, [bar]: Math.round(kg * 100) / 100 },
    })),
  )
}

/**
 * Zet een schijfmaat aan of uit. De laatste schijf kan er niet uit: zonder schijven
 * valt er niets af te ronden en zou elk gewichtsvoorstel betekenisloos worden.
 */
export function togglePlate(kg: number): void {
  if (!Number.isFinite(kg) || kg <= 0) return
  setState((s) =>
    patchSettings(s, (c) => {
      const heeft = c.plates.includes(kg)
      if (heeft && c.plates.length <= 1) return {}
      const plates = heeft ? c.plates.filter((p) => p !== kg) : [...c.plates, kg].sort((a, b) => a - b)
      return { plates }
    }),
  )
}

export function setTravelMode(on: boolean): void {
  setState((s) => patchSettings(s, () => ({ travelMode: on })))
}
