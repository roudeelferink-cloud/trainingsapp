import { useState } from 'react'
import { Card, Chip } from '../components/ui'
import { programFor } from '../data/programs'
import { activitiesOn, activityTypeLabel } from '../logic/activities'
import { buildDay } from '../logic/day'
import { addDays, formatShort, mondayOf, today } from '../logic/dates'
import { plannedWeekKm } from '../logic/running'
import { useStore } from '../store/store'
import type { DayKind } from '../types'

export function WeekScreen({ onOpenSession }: { onOpenSession: (date: string, kind: DayKind) => void }) {
  const state = useStore()
  const [offset, setOffset] = useState(0)
  const monday = addDays(mondayOf(today()), offset * 7)
  const info = buildDay(state, monday).cycle
  const program = programFor(state)
  const vrijLopen = program.runMode === 'free'
  const week = plannedWeekKm(state, monday)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button className="btn-ghost btn-sm" onClick={() => setOffset((o) => o - 1)}>
          ←
        </button>
        <div className="text-center">
          <p className="font-bold text-lg">Week {info.week}</p>
          <p className="text-xs text-slate-400">
            cyclus {info.cycle} · week {info.cycleWeek}/4
          </p>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => setOffset((o) => o + 1)}>
          →
        </button>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {info.deload && <Chip tone="warn">Deloadweek — 1 set minder, −10% gewicht, −20% loopvolume</Chip>}
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

      <div className="space-y-2">
        {program.week.map((spec, i) => {
          const iso = addDays(monday, i)
          const plan = buildDay(state, iso)
          const extras = activitiesOn(state, iso)
          const isToday = iso === today()
          return (
            <Card key={iso} className={isToday ? 'border-accent/60' : ''}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-400">
                    {spec.label} · {formatShort(iso)}
                    {isToday && <span className="text-accent font-semibold"> · vandaag</span>}
                  </p>
                  {plan.isRest ? (
                    <p className="font-semibold text-slate-400">Rustdag</p>
                  ) : (
                    <div className="mt-1 space-y-0.5">
                      {plan.run && (
                        <p className="font-semibold">
                          <span className="text-amber-300">1.</span>{' '}
                          {plan.run.bike
                            ? 'Fietsen 30 min'
                            : plan.run.free
                              ? 'Hardlopen'
                              : `Hardlopen ${plan.run.km} km`}
                        </p>
                      )}
                      {plan.strength && (
                        <p className="font-semibold">
                          <span className="text-sky-300">{plan.run ? '2.' : '1.'}</span> {plan.strength.naam}
                          {plan.strength.short && <span className="text-slate-400 text-sm"> · kort</span>}
                        </p>
                      )}
                      {plan.movedTo && (
                        <p className="text-sm text-slate-400">verplaatst naar {formatShort(plan.movedTo)}</p>
                      )}
                      {!plan.run && !plan.strength && !plan.movedTo && (
                        <p className="text-slate-400">Niets ingepland</p>
                      )}
                    </div>
                  )}
                  {extras.length > 0 && (
                    <p className="text-sm text-slate-300 mt-1">
                      <span className="text-slate-500">extra: </span>
                      {extras.map((a) => `${activityTypeLabel(a.type)} ${a.minutes} min`).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusChip plan={plan} />
                  {plan.strength && !plan.strength.skipped && (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => onOpenSession(iso, plan.strength!.kind)}
                    >
                      Open
                    </button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
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
