import { useState } from 'react'
import {
  Actions,
  Caps,
  Link,
  Primary,
  Screen,
  Secondary,
  Stats,
  type Stat,
} from '../components/logboek'
import { formatThousands, Sheet } from '../components/ui'
import { programFor } from '../data/programs'
import { activitiesOn, activityKm, activityTypeLabel, paceMinPerKm } from '../logic/activities'
import { missedInWeek, runName } from '../logic/backfill'
import { buildDay, type DayPlan } from '../logic/day'
import { addDays, dayNumber, formatRange, formatShort, mondayOf, today, weekdayShort } from '../logic/dates'
import { fmt, weekRunFacts } from '../logic/runningLoad'
import { sessionVolumeKg } from '../logic/stats'
import { weeksUntilDeload } from '../logic/deload'
import { PlanScreen } from './PlanScreen'
import { useStore } from '../store/store'
import type { DayKind, UserState } from '../types'

/**
 * Week: zeven dagregels onder de weekcijfers, met vandaag als enige gemarkeerde rij.
 *
 * De pijlen wisselen van week; "Naar vandaag" springt terug en is de enige okerknop
 * op dit scherm — oker zegt hier "hier ben je", en dat mag maar op één plek tegelijk.
 */
export function WeekScreen({
  onOpenSession,
  onOpenRun,
}: {
  onOpenSession: (date: string, kind: DayKind) => void
  onOpenRun: (date: string) => void
}) {
  const state = useStore()
  const [offset, setOffset] = useState(0)
  /** dag waarvan er meer dan één ding te doen is */
  const [keuze, setKeuze] = useState<string | null>(null)
  /** het planscherm van deze week staat open */
  const [plannen, setPlannen] = useState(false)

  const monday = addDays(mondayOf(today()), offset * 7)
  const dag = buildDay(state, monday)
  const info = dag.cycle
  const deload = dag.deload
  const program = programFor(state)
  const week = weekRunFacts(state, monday)
  const dagen = program.week.map((_, i) => addDays(monday, i))
  const dagplannen = dagen.map((iso) => buildDay(state, iso))
  const gemist = missedInWeek(state, monday)

  return (
    <Screen
      action={
        <Actions>
          <Secondary width="arrow" ariaLabel="Vorige week" onClick={() => setOffset((o) => o - 1)}>
            ←
          </Secondary>
          <Primary onClick={() => setOffset(0)}>Naar vandaag</Primary>
          <Secondary width="arrow" ariaLabel="Volgende week" onClick={() => setOffset((o) => o + 1)}>
            →
          </Secondary>
        </Actions>
      }
    >
      <div className="flex items-baseline justify-between gap-column">
        <h1 className="whitespace-nowrap font-serif text-screen-title text-ink">Week {info.week}</h1>
        <div className="flex flex-col items-end gap-tight whitespace-nowrap text-caps-lg uppercase tracking-caps text-dim">
          <div>{formatRange(monday, addDays(monday, 6))}</div>
          {markeringen(state, info.calibration, deload).map((m) => (
            <div key={m} className="text-faint">
              {m}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-block">
        <Stats variant="week" items={weekStats(dagplannen, week)} />
      </div>

      <div className="mt-block flex items-baseline justify-between gap-column">
        <Caps>{gemist.length > 0 ? `${gemist.length} nog in te vullen` : 'Dagen'}</Caps>
        <Link onClick={() => setPlannen(true)}>Plannen</Link>
      </div>

      <div className="mt-in-block flex flex-col">
        {dagen.map((iso, i) => (
          <DagRij
            key={iso}
            iso={iso}
            plan={dagplannen[i]}
            laatste={i === dagen.length - 1}
            onOpenSession={onOpenSession}
            onOpenRun={onOpenRun}
            onKeuze={setKeuze}
          />
        ))}
      </div>

      {/* meer dan één ding te doen op die dag: eerst kiezen, dan pas doen */}
      {keuze !== null && (
        <DagKeuze
          iso={keuze}
          plan={dagplannen[dagen.indexOf(keuze)]}
          onClose={() => setKeuze(null)}
          onOpenSession={(date, kind) => {
            setKeuze(null)
            onOpenSession(date, kind)
          }}
          onOpenRun={(date) => {
            setKeuze(null)
            onOpenRun(date)
          }}
        />
      )}

      {plannen && (
        <PlanScreen
          monday={monday}
          onClose={() => setPlannen(false)}
          onOpenSession={(date, kind) => {
            setPlannen(false)
            onOpenSession(date, kind)
          }}
          onOpenRun={(date) => {
            setPlannen(false)
            onOpenRun(date)
          }}
        />
      )}
    </Screen>
  )
}

/** Wat er deze week aan de hand is dat het programma anders maakt. */
function markeringen(state: UserState, kalibratie: boolean, deload: DayPlan['deload']): string[] {
  return [
    deload.active ? 'deloadweek' : null,
    deload.skipped ? 'deload overgeslagen' : null,
    !deload.active && !deload.skipped ? `deload over ${weeksUntilDeload(deload.week)} wk` : null,
    kalibratie ? 'kalibratie' : null,
    state.settings?.travelMode ? 'reismodus' : null,
  ].filter(Boolean) as string[]
}

/**
 * De drie weekcijfers. Gelopen tegen het plafond, sessies gedaan tegen gepland, en
 * het tilvolume — alle drie afgeleid uit wat er gelogd is, niets voorspeld.
 */
function weekStats(plannen: DayPlan[], week: ReturnType<typeof weekRunFacts>): Stat[] {
  let gepland = 0
  let gedaan = 0
  let volume = 0
  for (const plan of plannen) {
    for (const blok of [plan.run, plan.strength]) {
      if (!blok || blok.skipped) continue
      gepland++
      if (blok.done) gedaan++
    }
    if (plan.strength?.log) volume += sessionVolumeKg(plan.strength.log)
  }

  return [
    { label: 'Gelopen', value: `${week.aantal}×`, suffix: ` / ${fmt(week.km)} km`, flex: 1.2 },
    { label: 'Sessies', value: String(gedaan), suffix: ` / ${gepland}`, flex: 1 },
    { label: 'Volume', value: formatThousands(volume), suffix: ' kg', flex: 1.1 },
  ]
}

/* -------------------------------------------------------------------------
 * De dagregels
 * ---------------------------------------------------------------------- */

/**
 * Wat er op een dag te openen valt, in de volgorde waarin het gebeurt.
 *
 * Het ontwerp geeft een dagregel geen knoppen, dus is de regel zelf de knop. Is er
 * één ding te doen, dan gebeurt dat meteen; zijn het er twee, dan vraagt de app eerst
 * welke — anders is niet te zien of je de loop of de sessie aantikt.
 *
 * Sinds een loop een echt sessiescherm heeft, opent de dagregel hem net zo goed als een
 * krachtsessie: verplaatsen, overslaan en afvinken zitten dáár, en op de planpagina.
 * Een afgeronde sessie blijft te openen — terugkijken en bijstellen hoort erbij; een
 * overgeslagen sessie niet, die heeft zijn eigen weg terug op Vandaag.
 */
export function dayActions(plan: DayPlan): { id: 'run' | 'strength'; label: string }[] {
  const out: { id: 'run' | 'strength'; label: string }[] = []
  if (plan.run && !plan.run.skipped) {
    out.push({ id: 'run', label: `${runName(plan.run.kind, plan.run.bike)} openen` })
  }
  if (plan.strength && !plan.strength.skipped) {
    out.push({ id: 'strength', label: `${plan.strength.naam} openen` })
  }
  return out
}

function DagRij({
  iso,
  plan,
  laatste,
  onOpenSession,
  onOpenRun,
  onKeuze,
}: {
  iso: string
  plan: DayPlan
  laatste: boolean
  onOpenSession: (date: string, kind: DayKind) => void
  onOpenRun: (date: string) => void
  onKeuze: (date: string) => void
}) {
  const state = useStore()
  const isToday = iso === today()
  const verleden = iso < today()
  const blokken = [plan.run, plan.strength].filter(Boolean) as { done: boolean }[]
  const gedaan = blokken.length > 0 && blokken.every((b) => b.done)
  const keuzes = dayActions(plan)

  const doen = () => {
    if (keuzes.length === 0) return
    if (keuzes.length > 1) return onKeuze(iso)
    if (keuzes[0].id === 'strength') return onOpenSession(iso, plan.strength!.kind)
    onOpenRun(iso)
  }

  // afgerond en voorbij: alles een toon zachter, het vinkje zegt de rest
  const dof = gedaan && verleden
  const dagKleur = isToday ? 'text-accent' : dof ? 'text-faint' : 'text-dim'
  const titelKleur = isToday ? 'text-ink' : dof ? 'text-dim' : 'text-ink'
  const metaKleur = isToday ? 'text-muted' : dof ? 'text-faint' : 'text-dim'

  const rij = (
    <>
      <div className={`flex w-day-col flex-none flex-col ${dagKleur}`}>
        <div className="text-caps uppercase tracking-caps-day">{weekdayShort(iso)}</div>
        <div className={`font-serif text-day-number ${isToday ? 'text-accent' : dof ? 'text-faint' : 'text-muted'}`}>
          {dayNumber(iso)}
        </div>
      </div>

      {plan.isRest ? (
        <div className="flex-1 pt-tight font-serif text-note italic text-faint">Rustdag</div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-tight text-left">
          <div className={`${isToday ? 'font-serif text-lead' : 'text-list'} ${titelKleur}`}>
            {dagTitel(plan)}
          </div>
          {(() => {
            const meta = dagMeta(state, iso, plan)
            return meta ? <div className={`text-meta leading-meta ${metaKleur}`}>{meta}</div> : null
          })()}
        </div>
      )}

      {isToday ? (
        <Caps tone="accent" size="lg" className="shrink-0 pt-tight">
          Vandaag
        </Caps>
      ) : dof ? (
        <div className="shrink-0 pt-tight font-serif text-quote text-faint" aria-label="gedaan">
          ✓
        </div>
      ) : null}
    </>
  )

  const vorm = isToday
    ? '-mx-bleed border-y-hair border-accent bg-accent-wash px-bleed py-today-row'
    : `border-t-hair border-rule py-row ${laatste ? 'border-b-hair' : ''}`

  if (keuzes.length === 0) {
    return <div className={`flex gap-column ${vorm}`}>{rij}</div>
  }
  return (
    <button
      type="button"
      onClick={doen}
      aria-label={keuzes.length === 1 ? keuzes[0].label : `${formatShort(iso)} — kies wat je doet`}
      className={`flex w-full gap-column text-left ${vorm}`}
    >
      {rij}
    </button>
  )
}

/** Eén regel die zegt wat er die dag staat: eerst de loop, dan de kracht. */
function dagTitel(plan: DayPlan): string {
  const delen: string[] = []
  const run = plan.run
  if (run) {
    if (run.bike) delen.push('Fietsen')
    else if (run.free) delen.push(run.kind === 'long' ? 'Duurloop' : 'Hardlopen')
    else delen.push(`${run.kind === 'long' ? 'Duurloop' : 'Hardlopen'} ${fmt(run.km)} km`)
  }
  if (plan.strength) delen.push(plan.strength.naam)
  if (delen.length > 0) return delen.join(' · ')
  if (plan.movedTo) return 'Kracht verplaatst'
  if (plan.runMovedTo) return 'Loop verplaatst'
  return 'Niets ingepland'
}

/** De regel eronder: wat er verder over die dag te zeggen valt, of niets. */
function dagMeta(state: UserState, iso: string, plan: DayPlan): string | null {
  const delen: string[] = []
  const run = plan.run
  const s = plan.strength

  if (run?.log && !run.log.bike && run.log.minutes) {
    const tempo = paceMinPerKm(run.log.km, run.log.minutes)
    if (tempo) delen.push(tempo.replace(' min/km', '/km'))
  }
  if (s) {
    delen.push(`${s.slots.length} oefeningen`)
    if (s.log) delen.push(`${formatThousands(sessionVolumeKg(s.log))} kg`)
    else if (s.optional) delen.push('optioneel')
    if (s.short) delen.push('kort')
  }
  if (run?.skipped) delen.push('loop overgeslagen')
  if (s?.skipped) delen.push('sessie overgeslagen')
  if (plan.movedTo) delen.push(`kracht verplaatst naar ${formatShort(plan.movedTo)}`)
  if (plan.runMovedTo) delen.push(`loop verplaatst naar ${formatShort(plan.runMovedTo)}`)

  for (const a of activitiesOn(state, iso)) {
    const km = activityKm(a)
    const afstand = km === null ? '' : ` / ${fmt(km)} km`
    delen.push(`extra: ${activityTypeLabel(a.type)} ${a.minutes} min${afstand}`)
  }

  return delen.length > 0 ? delen.join(' · ') : null
}

/** Twee dingen te doen op één dag: dan kiezen, in plaats van gokken wat de rij bedoelt. */
function DagKeuze({
  iso,
  plan,
  onClose,
  onOpenSession,
  onOpenRun,
}: {
  iso: string
  plan: DayPlan
  onClose: () => void
  onOpenSession: (date: string, kind: DayKind) => void
  onOpenRun: (date: string) => void
}) {
  return (
    <Sheet open onClose={onClose} title={formatShort(iso)}>
      <div className="flex flex-col gap-in-block">
        {dayActions(plan).map((a) => (
          <button
            key={a.id}
            className="btn-ghost w-full"
            onClick={() => (a.id === 'strength' ? onOpenSession(iso, plan.strength!.kind) : onOpenRun(iso))}
          >
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
