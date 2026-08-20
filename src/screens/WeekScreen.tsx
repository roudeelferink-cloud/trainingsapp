import { useState } from 'react'
import { MoveSheet } from '../components/MoveSheet'
import { Card, Chip } from '../components/ui'
import { programFor, restDayHint } from '../data/programs'
import { activitiesOn, activityKm, activityTypeLabel } from '../logic/activities'
import { buildDay, moveTargets } from '../logic/day'
import { addDays, formatShort, mondayOf, today } from '../logic/dates'
import { weekLoad } from '../logic/runningLoad'
import { DELOAD_RUN_PCT, DELOAD_WEIGHT_PCT, weeksUntilDeload } from '../logic/deload'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { DayKind } from '../types'

export function WeekScreen({ onOpenSession }: { onOpenSession: (date: string, kind: DayKind) => void }) {
  const state = useStore()
  const [offset, setOffset] = useState(0)
  /** datum waarvan de loop verplaatst wordt; null = geen keuzelijst open */
  const [runMoveFrom, setRunMoveFrom] = useState<string | null>(null)
  const monday = addDays(mondayOf(today()), offset * 7)
  const dag = buildDay(state, monday)
  const info = dag.cycle
  const deload = dag.deload
  const program = programFor(state)
  const vrijLopen = program.runMode === 'free'
  const week = weekLoad(state, monday)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button aria-label="Vorige week" className="btn-ghost btn-sm" onClick={() => setOffset((o) => o - 1)}>
          ←
        </button>
        <div className="text-center">
          <p className="font-bold text-lg">Week {info.week}</p>
          <p className="text-xs text-slate-400">
            cyclus {info.cycle} ·{' '}
            {deload.active ? 'deloadweek' : `deload over ${weeksUntilDeload(info.week)} wk`}
          </p>
        </div>
        <button aria-label="Volgende week" className="btn-ghost btn-sm" onClick={() => setOffset((o) => o + 1)}>
          →
        </button>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {deload.active && (
          <Chip tone="deload">
            Deloadweek — 1 set minder, −{DELOAD_WEIGHT_PCT}% gewicht, −{DELOAD_RUN_PCT}% loopvolume
          </Chip>
        )}
        {deload.skipped && <Chip tone="off">Deload overgeslagen</Chip>}
        {info.calibration && <Chip tone="lift">Kalibratie — op gevoel, RIR 2-3</Chip>}
        {vrijLopen ? (
          <Chip tone="run">3 loopdagen · eigen afstand</Chip>
        ) : (
          <Chip tone="run">loopvolume ~{week.km} km{week.capped ? ' (teruggeschaald)' : ''}</Chip>
        )}
        {offset !== 0 && (
          <button className="chip bg-ink-600 text-slate-200" onClick={() => setOffset(0)}>
            terug naar deze week
          </button>
        )}
      </div>

      {/* waarom het weekvolume is wat het is: één regel per bijsturing */}
      {(week.reasons.length > 0 || week.overCapReason) && (
        <ul className="space-y-1">
          {[...week.reasons, ...(week.overCapReason ? [week.overCapReason] : [])].map((reden, i) => (
            <li key={i} className="text-sm text-slate-400 flex gap-2">
              <span aria-hidden>•</span>
              <span>{reden}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        {program.week.map((spec, i) => {
          const iso = addDays(monday, i)
          const plan = buildDay(state, iso)
          const extras = activitiesOn(state, iso)
          const isToday = iso === today()
          return (
            <Card key={iso} className={isToday ? 'border-accent/60' : ''}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-slate-400 min-w-0">
                  {spec.label} · {formatShort(iso)}
                  {isToday && <span className="text-accent font-semibold"> · vandaag</span>}
                </p>
                <span className="shrink-0">
                  <StatusChip plan={plan} />
                </span>
              </div>

              {plan.isRest ? (
                <p className="font-semibold text-slate-400 mt-1">Rustdag</p>
              ) : (
                /*
                 * Elke sessie krijgt zijn eigen regel mét eigen knop. Eén knop naast
                 * de hele kaart was niet te plaatsen: op een dag met loop én kracht
                 * was niet te zien bij welke van de twee hij hoorde.
                 */
                <div className="mt-1 space-y-1">
                  {plan.run && (
                    <div className="flex items-center justify-between gap-2 min-h-[36px]">
                      <p className="font-semibold min-w-0 truncate">
                        <span className="text-amber-300">1.</span>{' '}
                        {plan.run.bike
                          ? 'Fietsen 30 min'
                          : plan.run.free
                            ? 'Hardlopen'
                            : `Hardlopen ${plan.run.km} km`}
                      </p>
                      {!plan.run.done && !plan.run.skipped && (
                        <button
                          className="btn-ghost btn-sm shrink-0"
                          onClick={() => setRunMoveFrom(iso)}
                        >
                          Verplaatsen
                        </button>
                      )}
                    </div>
                  )}
                  {plan.strength && (
                    <div className="flex items-center justify-between gap-2 min-h-[36px]">
                      <p className="font-semibold min-w-0 truncate">
                        <span className="text-sky-300">{plan.run ? '2.' : '1.'}</span>{' '}
                        {plan.strength.naam}
                        {plan.strength.short && <span className="text-slate-400 text-sm"> · kort</span>}
                      </p>
                      {!plan.strength.skipped && (
                        <button
                          className="btn-ghost btn-sm shrink-0"
                          onClick={() => onOpenSession(iso, plan.strength!.kind)}
                        >
                          Open
                        </button>
                      )}
                    </div>
                  )}
                  {plan.movedTo && (
                    <p className="text-sm text-slate-400">
                      kracht verplaatst naar {formatShort(plan.movedTo)}
                    </p>
                  )}
                  {plan.runMovedTo && (
                    <p className="text-sm text-slate-400">
                      loop verplaatst naar {formatShort(plan.runMovedTo)}
                    </p>
                  )}
                  {!plan.run && !plan.strength && !plan.movedTo && !plan.runMovedTo && (
                    <p className="text-slate-400">Niets ingepland</p>
                  )}
                </div>
              )}

              {extras.length > 0 && (
                <p className="text-sm text-slate-300 mt-1">
                  <span className="text-slate-500">extra: </span>
                  {extras
                    .map((a) => {
                      const km = activityKm(a)
                      const afstand = km === null ? '' : ` / ${String(km).replace('.', ',')} km`
                      return `${activityTypeLabel(a.type)} ${a.minutes} min${afstand}`
                    })
                    .join(' · ')}
                </p>
              )}
            </Card>
          )
        })}
      </div>

      {/* de doellijst hangt aan de gekozen dag, dus hij wordt pas berekend als hij nodig is */}
      {runMoveFrom !== null && (
        <MoveSheet
          open
          onClose={() => setRunMoveFrom(null)}
          targets={moveTargets(state, runMoveFrom, 'run')}
          hint={`De krachtsessie van die dag blijft staan.${restDayHint(program)}`}
          onPick={(target) => {
            A.moveRun(runMoveFrom, target)
            setRunMoveFrom(null)
          }}
        />
      )}
    </div>
  )
}

function StatusChip({ plan }: { plan: ReturnType<typeof buildDay> }) {
  if (plan.isRest) return <Chip tone="off">rust</Chip>
  const skipped = plan.strength?.skipped || plan.run?.skipped
  if (skipped) return <Chip tone="off">overgeslagen</Chip>
  const items = [plan.run, plan.strength].filter(Boolean) as { done: boolean }[]
  if (items.length === 0) return <Chip tone="off">vrij</Chip>
  if (items.every((x) => x.done)) return <Chip tone="ok">gedaan</Chip>
  if (items.some((x) => x.done)) return <Chip tone="lift">deels</Chip>
  if (plan.strength?.optional) return <Chip tone="off">optioneel</Chip>
  return <Chip tone="neutral">open</Chip>
}
