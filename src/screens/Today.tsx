import { useState } from 'react'
import { ActivityList, ActivitySheet } from '../components/Activities'
import { MoveSheet } from '../components/MoveSheet'
import { Bar, Card, Chip, Empty, SectionTitle, Sheet, Stepper } from '../components/ui'
import { programFor, restDayHint } from '../data/programs'
import { activitiesOn } from '../logic/activities'
import { buildDay, moveTargets, type DayPlan } from '../logic/day'
import { formatLong, formatShort, today } from '../logic/dates'
import { maintenanceStreak, proteinGoal, trainingStreak } from '../logic/stats'
import { BIKE_MINUTES } from '../logic/running'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { Activity, DayKind, SkipReason } from '../types'

const REASONS: { id: SkipReason; label: string }[] = [
  { id: 'druk', label: 'Druk' },
  { id: 'etentje', label: 'Etentje' },
  { id: 'geen_zin', label: 'Geen zin' },
  { id: 'ziek', label: 'Ziek' },
]

export function Today({ onOpenSession }: { onOpenSession: (date: string, kind: DayKind) => void }) {
  const state = useStore()
  const iso = today()
  const plan = buildDay(state, iso)

  return (
    <div className="space-y-4">
      <Header plan={plan} />
      <CheckIn iso={iso} value={plan.checkin} />

      {plan.notes.length > 0 && (
        <ul className="space-y-1">
          {plan.notes.map((n, i) => (
            <li key={i} className="text-sm text-slate-400 flex gap-2">
              <span aria-hidden>•</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      {plan.isRest && (
        <Card className="text-center py-8">
          <p className="text-2xl font-bold mb-1">Rustdag</p>
          <p className="text-slate-400">Woensdag. Niks doen is vandaag het programma.</p>
        </Card>
      )}

      {plan.movedTo && !plan.strength && (
        <Card>
          <p className="text-sm text-slate-300">
            Krachtsessie verplaatst naar <b>{formatShort(plan.movedTo)}</b>.
          </p>
          <button className="btn-quiet btn-sm mt-3 w-full" onClick={() => A.undoMove(iso)}>
            Verplaatsing ongedaan maken
          </button>
        </Card>
      )}

      {plan.runMovedTo && !plan.run && (
        <Card>
          <p className="text-sm text-slate-300">
            Loop verplaatst naar <b>{formatShort(plan.runMovedTo)}</b>.
          </p>
          <button className="btn-quiet btn-sm mt-3 w-full" onClick={() => A.undoRunMove(iso)}>
            Verplaatsing ongedaan maken
          </button>
        </Card>
      )}

      {plan.run && <RunCard iso={iso} plan={plan} />}

      {plan.run && plan.strength && (
        <div className="flex items-center gap-3 px-1">
          <div className="h-px flex-1 bg-ink-600" />
          <span className="text-sm font-semibold text-slate-400">10-15 min pauze</span>
          <div className="h-px flex-1 bg-ink-600" />
        </div>
      )}

      {plan.strength && <StrengthCard iso={iso} plan={plan} onOpenSession={onOpenSession} />}

      {!plan.isRest && !plan.run && !plan.strength && (
        <Card>
          <Empty>Geen sessie ingepland vandaag.</Empty>
        </Card>
      )}

      <ExtraActivities iso={iso} />
      <Maintenance iso={iso} />
      <Protein iso={iso} />
    </div>
  )
}

/**
 * Alles wat je buiten het schema om gedaan hebt. Staat er elke dag, ook op een
 * rustdag en ook als de geplande sessie al afgerond is.
 */
function ExtraActivities({ iso }: { iso: string }) {
  const state = useStore()
  const items = activitiesOn(state, iso)
  const [sheet, setSheet] = useState<{ activity?: Activity } | null>(null)

  return (
    <Card>
      <SectionTitle
        right={items.length > 0 ? <Chip tone="neutral">{items.length}</Chip> : undefined}
      >
        Extra activiteiten
      </SectionTitle>
      <p className="text-sm text-slate-400 mb-3">
        Naast het schema. Telt niet mee in je krachtprogressie of gewichtsadvies.
      </p>

      {items.length === 0 ? (
        <Empty>Nog niets extra gelogd vandaag.</Empty>
      ) : (
        <ActivityList items={items} onEdit={(a) => setSheet({ activity: a })} />
      )}

      <button className="btn-ghost w-full mt-3" onClick={() => setSheet({})}>
        Activiteit toevoegen
      </button>

      <ActivitySheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        date={iso}
        activity={sheet?.activity}
      />
    </Card>
  )
}

function Header({ plan }: { plan: DayPlan }) {
  const state = useStore()
  const streak = trainingStreak(state)
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-slate-400 capitalize">{formatLong(plan.date)}</p>
        <h1 className="text-2xl font-bold leading-tight">
          Week {plan.cycle.week}
          <span className="text-slate-400 font-medium text-lg"> · cyclusweek {plan.cycle.cycleWeek}/4</span>
        </h1>
        <div className="flex gap-2 mt-2 flex-wrap">
          {plan.cycle.deload && <Chip tone="warn">Deload</Chip>}
          {plan.cycle.calibration && <Chip tone="lift">Kalibratie</Chip>}
          {state.settings.travelMode && <Chip tone="off">Reismodus</Chip>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-3xl font-bold tabular-nums">{streak}</p>
        <p className="text-xs text-slate-400">dagen streak</p>
      </div>
    </div>
  )
}

function CheckIn({ iso, value }: { iso: string; value: number | undefined }) {
  return (
    <Card>
      <p className="font-semibold mb-1">Hoe voelen benen en pezen?</p>
      <p className="text-xs text-slate-400 mb-3">Optioneel. Niet invullen = normaal programma.</p>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => (value === n ? A.clearCheckin(iso) : A.setCheckin(iso, n))}
            className={`btn min-h-[56px] text-xl ${
              value === n ? 'bg-accent text-ink-900' : 'bg-ink-700 border border-ink-600'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-2">1 = brak · 5 = fris</p>
    </Card>
  )
}

function RunCard({ iso, plan }: { iso: string; plan: DayPlan }) {
  const state = useStore()
  const run = plan.run!
  const [logOpen, setLogOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [km, setKm] = useState(run.km)
  const [min, setMin] = useState(Math.round(run.km * 6))
  const targets = moveTargets(state, iso, 'run')

  if (run.skipped) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300">Loop overgeslagen</span>
          <Chip tone="off">{REASONS.find((r) => r.id === run.skipped)?.label}</Chip>
        </div>
        <button className="btn-quiet btn-sm mt-3 w-full" onClick={() => A.undoSkip(iso, 'run')}>
          Toch doen
        </button>
      </Card>
    )
  }

  return (
    <Card className="border-amber-500/30">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <Chip tone="run">1 · Hardlopen</Chip>
          <p className="text-xl font-bold mt-2">
            {run.bike
              ? `Fietsen ${BIKE_MINUTES} min`
              : run.free
                ? run.kind === 'long'
                  ? 'Duurloop'
                  : 'Hardlopen'
                : `${run.kind === 'long' ? 'Duurloop' : 'Korte loop'} ${run.km} km`}
          </p>
          {run.free && !run.bike && (
            <p className="text-sm text-slate-400">Eigen afstand en tempo — log wat je gelopen hebt.</p>
          )}
          {!run.free && !run.bike && run.km !== run.plannedKm && (
            <p className="text-sm text-slate-400">Gepland was {run.plannedKm} km</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {run.done && <Chip tone="ok">Gedaan</Chip>}
          {run.movedFrom && <Chip tone="neutral">van {formatShort(run.movedFrom)}</Chip>}
        </div>
      </div>

      {run.done ? (
        <p className="text-sm text-slate-400">
          Gelogd: {run.log?.bike ? `${run.log.minutes ?? BIKE_MINUTES} min fietsen` : `${run.log?.km} km`}
        </p>
      ) : (
        <div className="space-y-2">
          <button
            className="btn-primary w-full"
            onClick={() => {
              setKm(run.bike ? 0 : run.km)
              setMin(run.bike ? BIKE_MINUTES : Math.round(run.km * 6))
              setLogOpen(true)
            }}
          >
            {run.bike ? 'Fietsen afvinken' : 'Loop afvinken'}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-ghost btn-sm" onClick={() => A.setBike(iso, !run.bike)}>
              {run.bike ? 'Toch lopen' : 'Fiets'}
            </button>
            <button
              className="btn-ghost btn-sm disabled:opacity-40"
              disabled={targets.length === 0}
              onClick={() => setMoveOpen(true)}
            >
              Verplaatsen
            </button>
            <button className="btn-quiet btn-sm" onClick={() => setSkipOpen(true)}>
              Overslaan
            </button>
          </div>
        </div>
      )}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={run.bike ? 'Fietsen loggen' : 'Loop loggen'}>
        <div className="space-y-4">
          {!run.bike && (
            <div>
              <p className="label mb-1">Afstand (km)</p>
              <Stepper value={km} onChange={setKm} step={0.5} decimals={1} suffix="km" max={60} />
            </div>
          )}
          <div>
            <p className="label mb-1">Duur (min)</p>
            <Stepper value={min} onChange={setMin} step={5} max={300} suffix="min" />
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => {
              A.completeRun(iso, run.kind, {
                plannedKm: run.plannedKm,
                km: run.bike ? 0 : km,
                minutes: min,
                bike: run.bike,
              })
              setLogOpen(false)
            }}
          >
            Opslaan
          </button>
        </div>
      </Sheet>

      <MoveSheet
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        targets={targets}
        hint={`De krachtsessie van vandaag blijft staan.${restDayHint(programFor(state))}`}
        onPick={(target) => {
          A.moveRun(iso, target)
          setMoveOpen(false)
        }}
      />

      <SkipSheet
        open={skipOpen}
        onClose={() => setSkipOpen(false)}
        onPick={(r) => {
          A.skipSession(iso, 'run', r)
          setSkipOpen(false)
        }}
      />
    </Card>
  )
}

function StrengthCard({
  iso,
  plan,
  onOpenSession,
}: {
  iso: string
  plan: DayPlan
  onOpenSession: (date: string, kind: DayKind) => void
}) {
  const state = useStore()
  const s = plan.strength!
  const [skipOpen, setSkipOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const targets = moveTargets(state, iso)

  if (s.skipped) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-300">{s.naam} overgeslagen</span>
          <Chip tone="off">{REASONS.find((r) => r.id === s.skipped)?.label}</Chip>
        </div>
        <button className="btn-quiet btn-sm mt-3 w-full" onClick={() => A.undoSkip(iso, 'strength')}>
          Toch doen
        </button>
      </Card>
    )
  }

  return (
    <Card className="border-sky-500/30">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Chip tone="lift">{plan.run ? '2 · Kracht' : '1 · Kracht'}</Chip>
          <p className="text-xl font-bold mt-2">{s.naam}</p>
          <p className="text-sm text-slate-400">
            ~{s.duurMin} min · {s.slots.length} oefeningen
            {s.short && ' · korte versie'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {s.done && <Chip tone="ok">Gedaan</Chip>}
          {s.optional && <Chip tone="off">Optioneel</Chip>}
          {s.movedFrom && <Chip tone="neutral">van {formatShort(s.movedFrom)}</Chip>}
        </div>
      </div>

      <ul className="mt-3 mb-4 space-y-1">
        {s.slots.map((r) => (
          <li key={r.slot.key} className="flex justify-between text-sm">
            <span className="truncate pr-2">
              {r.exercise.naam}
              {r.slot.role === 'accessory' && <span className="text-slate-500"> ·</span>}
            </span>
            <span className="text-slate-400 tabular-nums shrink-0">
              {r.sets}×{r.repMin === r.repMax ? r.repMin : `${r.repMin}-${r.repMax}`}
            </span>
          </li>
        ))}
      </ul>

      <button className="btn-primary w-full" onClick={() => onOpenSession(iso, s.kind)}>
        {s.done ? 'Sessie bekijken' : 'Start sessie'}
      </button>

      <div className="grid grid-cols-3 gap-2 mt-2">
        <button className="btn-ghost btn-sm" onClick={() => A.setShortVersion(iso, !s.short)}>
          {s.short ? 'Volledig' : 'Korte versie'}
        </button>
        <button
          className="btn-ghost btn-sm disabled:opacity-40"
          disabled={targets.length === 0}
          onClick={() => setMoveOpen(true)}
        >
          Verplaatsen
        </button>
        <button className="btn-quiet btn-sm" onClick={() => setSkipOpen(true)}>
          Overslaan
        </button>
      </div>

      <MoveSheet
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        targets={targets}
        hint={`De loop van vandaag blijft staan; die verplaats je apart.${restDayHint(programFor(state))}`}
        onPick={(target) => {
          A.moveSession(iso, target)
          setMoveOpen(false)
        }}
      />

      <SkipSheet
        open={skipOpen}
        onClose={() => setSkipOpen(false)}
        onPick={(r) => {
          A.skipSession(iso, 'strength', r)
          setSkipOpen(false)
        }}
      />
    </Card>
  )
}

export function SkipSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (r: SkipReason) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Overslaan — waarom?">
      <p className="text-sm text-slate-400 mb-3">Wordt gelogd, verder geen gevolgen.</p>
      <div className="grid grid-cols-2 gap-2">
        {REASONS.map((r) => (
          <button key={r.id} className="btn-ghost" onClick={() => onPick(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function Maintenance({ iso }: { iso: string }) {
  const state = useStore()
  const done = state.maintenance[iso] ?? []
  const items = state.settings.maintenanceItems
  const streak = maintenanceStreak(state)

  return (
    <Card>
      <SectionTitle right={<span className="text-sm text-slate-400">{streak} dagen op rij</span>}>
        Dagelijks onderhoud
      </SectionTitle>
      {items.length === 0 && <Empty>Geen items. Toevoegen kan bij Instellingen.</Empty>}
      <div className="space-y-2">
        {items.map((m) => {
          const on = done.includes(m.id)
          return (
            <button
              key={m.id}
              onClick={() => A.toggleMaintenance(iso, m.id)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 min-h-[52px] text-left border ${
                on ? 'bg-emerald-500/15 border-emerald-500/40' : 'bg-ink-700 border-ink-600'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-md border-2 shrink-0 flex items-center justify-center ${
                  on ? 'bg-emerald-400 border-emerald-400 text-ink-900' : 'border-ink-500'
                }`}
              >
                {on ? '✓' : ''}
              </span>
              <span className={on ? 'line-through text-slate-400' : ''}>{m.label}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function Protein({ iso }: { iso: string }) {
  const state = useStore()
  const goal = proteinGoal(state)
  const value = state.protein[iso] ?? 0

  return (
    <Card>
      <SectionTitle right={goal ? <span className="text-sm text-slate-400">doel {goal} g</span> : undefined}>
        Eiwit vandaag
      </SectionTitle>
      {goal === null ? (
        <p className="text-sm text-slate-400">Vul je lichaamsgewicht in bij Instellingen voor een dagdoel.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold tabular-nums">{value}</span>
            <span className="text-slate-400">/ {goal} g</span>
          </div>
          <Bar value={value} max={goal} tone={value >= goal ? 'bg-emerald-400' : 'bg-accent'} />
          <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
            <input
              className="field"
              type="number"
              inputMode="numeric"
              value={value || ''}
              placeholder="gram"
              onChange={(e) => A.setProtein(iso, Math.max(0, Number(e.target.value) || 0))}
            />
            <button className="btn-ghost btn-sm" onClick={() => A.setProtein(iso, value + 25)}>
              +25
            </button>
            <button className="btn-ghost btn-sm" onClick={() => A.setProtein(iso, value + 50)}>
              +50
            </button>
          </div>
        </>
      )}
    </Card>
  )
}
