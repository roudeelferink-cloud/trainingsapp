import { useState, type ReactNode } from 'react'
import { MoveSheet } from '../components/MoveSheet'
import { Sheet } from '../components/ui'
import { programFor, restDayHint } from '../data/programs'
import { activitiesOn, activityKm, activityTypeLabel } from '../logic/activities'
import { buildDay, canMove, moveTargets, type DayPlan, type MoveWhat } from '../logic/day'
import { addDays, formatShort, mondayOf, today } from '../logic/dates'
import { LEG_LOAD_VERY_HIGH, legLoadOn } from '../logic/legLoad'
import { fmt, weekLoad } from '../logic/runningLoad'
import { sessionVolumeKg } from '../logic/stats'
import { DELOAD_RUN_PCT, DELOAD_WEIGHT_PCT, weeksUntilDeload } from '../logic/deload'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { DayKind } from '../types'

/**
 * De week als lijst, niet als stapel kaarten: drie weekcijfers in een raster met
 * scheidingslijnen, daaronder zeven dagregels. Vandaag licht op, het verleden is
 * gedempt, en per dag staat rechts een vinkje (afgerond) of een ⋯ (acties).
 */
export function WeekScreen({ onOpenSession }: { onOpenSession: (date: string, kind: DayKind) => void }) {
  const state = useStore()
  const [offset, setOffset] = useState(0)
  /** datum waarvan de actielijst open staat; null = dicht */
  const [actieDag, setActieDag] = useState<string | null>(null)
  const monday = addDays(mondayOf(today()), offset * 7)
  const dag = buildDay(state, monday)
  const info = dag.cycle
  const deload = dag.deload
  const program = programFor(state)
  const vrijLopen = program.runMode === 'free'
  const week = weekLoad(state, monday)

  const dagen = program.week.map((spec, i) => {
    const iso = addDays(monday, i)
    return { spec, iso, plan: buildDay(state, iso) }
  })

  const stats = weekStats(dagen.map((d) => d.plan))

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4">
        <button aria-label="Vorige week" className="btn-ghost btn-sm" onClick={() => setOffset((o) => o - 1)}>
          ←
        </button>
        <div className="text-center">
          <p className="font-medium text-lg">
            Week <span className="num">{info.week}</span>
          </p>
          <p className="text-xs text-muted">
            cyclus {info.cycle} ·{' '}
            {deload.active ? 'deloadweek' : `deload over ${weeksUntilDeload(info.week)} wk`}
          </p>
        </div>
        <button aria-label="Volgende week" className="btn-ghost btn-sm" onClick={() => setOffset((o) => o + 1)}>
          →
        </button>
      </div>

      {/* de drie weekcijfers: gelopen tegen het plafond, sessies tegen gepland, volume */}
      <div className="grid grid-cols-3 divide-x divide-line border-y border-line mb-1">
        <WeekCijfer
          label={vrijLopen ? 'km gelopen' : 'km / plafond'}
          value={
            vrijLopen ? (
              <>{fmt(week.done)}</>
            ) : (
              <>
                {fmt(week.done)}
                <span className="text-muted">/{fmt(week.km)}</span>
              </>
            )
          }
        />
        <WeekCijfer
          label="sessies"
          value={
            <>
              {stats.done}
              <span className="text-muted">/{stats.planned}</span>
            </>
          }
        />
        <WeekCijfer label="volume kg" value={<>{stats.volumeKg}</>} />
      </div>

      {/* bijsturingen als gedempte regels, geen gekleurde balken */}
      <div className="mb-4">
        {deload.active && (
          <Regel>
            Deloadweek — 1 set minder, −{DELOAD_WEIGHT_PCT}% gewicht, −{DELOAD_RUN_PCT}% loopvolume.
          </Regel>
        )}
        {deload.skipped && <Regel>Deload overgeslagen.</Regel>}
        {info.calibration && <Regel>Kalibratie — op gevoel, RIR 2-3.</Regel>}
        {vrijLopen && <Regel>3 loopdagen · eigen afstand.</Regel>}
        {[...week.reasons, ...(week.overCapReason ? [week.overCapReason] : [])]
          .filter((r) => !r.startsWith('Deloadweek'))
          .map((reden, i) => (
            <Regel key={i}>{reden}</Regel>
          ))}
        {offset !== 0 && (
          <button className="btn-quiet btn-sm mt-1" onClick={() => setOffset(0)}>
            ← terug naar deze week
          </button>
        )}
      </div>

      {/* zeven dagregels met hairlines; vandaag licht op, het verleden is gedempt */}
      <div className="border-y border-line divide-y divide-line">
        {dagen.map(({ spec, iso, plan }) => (
          <DagRegel
            key={iso}
            afkorting={spec.short}
            iso={iso}
            plan={plan}
            score={legLoadOn(state, iso).score}
            onActies={() => setActieDag(iso)}
          />
        ))}
      </div>

      {actieDag !== null && (
        <DaySheet date={actieDag} onClose={() => setActieDag(null)} onOpenSession={onOpenSession} />
      )}
    </div>
  )
}

function WeekCijfer({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="py-3 px-2 text-center">
      <p className="num text-2xl leading-tight">{value}</p>
      <p className="label mt-0.5">{label}</p>
    </div>
  )
}

/** Gedempte informatieregel met een subtiel markeringsteken. */
function Regel({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-muted py-0.5">
      <span aria-hidden>▲ </span>
      {children}
    </p>
  )
}

function DagRegel({
  afkorting,
  iso,
  plan,
  score,
  onActies,
}: {
  afkorting: string
  iso: string
  plan: DayPlan
  score: number
  onActies: () => void
}) {
  const state = useStore()
  const isToday = iso === today()
  const verleden = iso < today()
  const klaar = dagKlaar(plan)
  const heeftSessie = !!plan.run || !!plan.strength
  const extras = activitiesOn(state, iso)

  return (
    <div
      className={`flex items-center gap-3 min-h-[56px] px-2 ${isToday ? 'bg-raised' : ''} ${
        verleden ? 'text-muted' : ''
      }`}
    >
      <span className={`num text-xs w-6 shrink-0 ${isToday ? 'text-fg' : 'text-faint'}`}>
        {afkorting}
      </span>

      <div className="flex-1 min-w-0 py-2">
        <p className={`truncate text-sm ${klaar && heeftSessie ? 'text-muted' : ''}`}>{dagLabel(plan)}</p>
        {plan.movedTo && (
          <p className="text-xs text-faint truncate">kracht verplaatst naar {formatShort(plan.movedTo)}</p>
        )}
        {plan.runMovedTo && (
          <p className="text-xs text-faint truncate">loop verplaatst naar {formatShort(plan.runMovedTo)}</p>
        )}
        {extras.length > 0 && (
          <p className="text-xs text-faint truncate">
            extra:{' '}
            {extras
              .map((a) => {
                const km = activityKm(a)
                return `${activityTypeLabel(a.type)} ${a.minutes} min${km === null ? '' : ` / ${fmt(km)} km`}`
              })
              .join(' · ')}
          </p>
        )}
        {/* de beenbelasting van de sessie: breedte = zwaarte, geen kleur, geen cijfer */}
        {score > 0 && (
          <span
            aria-hidden
            className="block h-[3px] rounded-full bg-faint mt-1"
            style={{ width: `${Math.min(100, (score / LEG_LOAD_VERY_HIGH) * 60)}%`, maxWidth: '8rem' }}
          />
        )}
      </div>

      {klaar && heeftSessie ? (
        <span className="text-muted px-3" aria-hidden>
          ✓
        </span>
      ) : heeftSessie ? (
        <button
          aria-label={`Acties ${formatShort(iso)}`}
          className="min-w-[44px] min-h-[44px] shrink-0 text-muted text-xl"
          onClick={onActies}
        >
          ⋯
        </button>
      ) : null}
    </div>
  )
}

/** Alles wat er die dag gepland stond is gedaan of bewust overgeslagen. */
function dagKlaar(plan: DayPlan): boolean {
  const runOk = !plan.run || plan.run.done || !!plan.run.skipped
  const strengthOk = !plan.strength || plan.strength.done || !!plan.strength.skipped
  return runOk && strengthOk
}

function dagLabel(plan: DayPlan): string {
  if (plan.isRest) return 'Rustdag'
  const delen: string[] = []
  if (plan.run) {
    const naam = plan.run.bike
      ? 'Fietsen 30 min'
      : plan.run.free
        ? 'Hardlopen'
        : `Hardlopen ${fmt(plan.run.km)} km`
    delen.push(plan.run.skipped ? `${naam} (overgeslagen)` : naam)
  }
  if (plan.strength) {
    const naam = `${plan.strength.naam}${plan.strength.short ? ' · kort' : ''}`
    delen.push(plan.strength.skipped ? `${naam} (overgeslagen)` : naam)
  }
  if (delen.length === 0) return '—'
  return delen.join(' + ')
}

/** De weekcijfers bovenaan: afgerond tegen gepland, en het tilvolume. */
function weekStats(plans: DayPlan[]): { planned: number; done: number; volumeKg: number } {
  let planned = 0
  let done = 0
  let volumeKg = 0
  for (const plan of plans) {
    if (plan.run && !plan.run.skipped) {
      planned++
      if (plan.run.done) done++
    }
    if (plan.strength && !plan.strength.skipped) {
      // de optionele zaterdag telt pas als gepland zodra hij ook echt gedaan is
      if (!plan.strength.optional || plan.strength.done) {
        planned++
        if (plan.strength.done) done++
      }
    }
    if (plan.strength?.log?.completedAt) volumeKg += sessionVolumeKg(plan.strength.log)
  }
  return { planned, done, volumeKg }
}

/**
 * De acties achter de ⋯ van een dagregel: sessie openen en verplaatsen. Elke
 * sessie houdt zijn eigen verplaatsknop, zodat een dag met loop én kracht ze
 * onafhankelijk kan verzetten.
 */
export function DaySheet({
  date,
  onClose,
  onOpenSession,
}: {
  date: string
  onClose: () => void
  onOpenSession: (date: string, kind: DayKind) => void
}) {
  const state = useStore()
  const [verplaats, setVerplaats] = useState<MoveWhat | null>(null)
  const plan = buildDay(state, date)
  const program = programFor(state)

  if (verplaats !== null) {
    return (
      <MoveSheet
        open
        onClose={() => {
          setVerplaats(null)
          onClose()
        }}
        targets={moveTargets(state, date, verplaats)}
        hint={
          verplaats === 'run'
            ? `De krachtsessie van die dag blijft staan.${restDayHint(program)}`
            : `De loop van die dag blijft staan.${restDayHint(program)}`
        }
        onPick={(target) => {
          if (verplaats === 'run') A.moveRun(date, target)
          else A.moveSession(date, target)
          setVerplaats(null)
          onClose()
        }}
      />
    )
  }

  const run = plan.run
  const strength = plan.strength

  return (
    <Sheet open onClose={onClose} title={formatShort(date)}>
      <div className="space-y-2">
        {strength && !strength.skipped && (
          <button
            className="btn-ghost w-full"
            onClick={() => {
              onClose()
              onOpenSession(date, strength.kind)
            }}
          >
            {strength.done ? `Bekijk ${strength.naam}` : `Open ${strength.naam}`}
          </button>
        )}
        {run && !run.done && !run.skipped && canMove(state, date, 'run') && (
          <button className="btn-ghost w-full" onClick={() => setVerplaats('run')}>
            Verplaats loop
          </button>
        )}
        {strength && !strength.done && !strength.skipped && canMove(state, date, 'strength') && (
          <button className="btn-ghost w-full" onClick={() => setVerplaats('strength')}>
            Verplaats kracht
          </button>
        )}
        <button className="btn-quiet w-full" onClick={onClose}>
          Sluiten
        </button>
      </div>
    </Sheet>
  )
}
