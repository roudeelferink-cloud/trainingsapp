import { useState, type ReactNode } from 'react'
import { Actions, Caps, Link, Primary, Screen, TopLine } from '../components/logboek'
import { MoveSheet } from '../components/MoveSheet'
import { ChoiceGrid, Sheet } from '../components/ui'
import { DAY_LABEL } from '../data/plan'
import { programFor, restDayHint, restDayLabel } from '../data/programs'
import { isBackfillDate, missedInWeek, runName } from '../logic/backfill'
import { buildDay, canMove, moveTargets, type DayPlan, type MoveWhat } from '../logic/day'
import {
  addDays,
  dayNumber,
  formatRange,
  formatShort,
  mondayOf,
  today,
  weekdayShort,
} from '../logic/dates'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { DayKind, SkipReason } from '../types'

/**
 * Plannen: de week in één overzicht, met per dag wat je ermee kunt.
 *
 * De weekpagina laat zien wat er staat; hier verzet je het. Dat onderscheid is bewust —
 * de weekpagina is om te lezen en heeft daarom geen knoppen in de dagregels, en een
 * planscherm is om te schuiven en bestaat juist uit knoppen. Ze delen de dagopbouw
 * (`buildDay`) en het verplaatsen (`moveTargets`, `applyMove`, de MoveSheet); er is niets
 * dubbel gebouwd.
 *
 * Drie dingen kun je hier: een sessie naar een andere dag zetten, een sessie overslaan,
 * en zien wat er gemist is en nog achteraf in te vullen valt. De vaste rustdag doet niet
 * mee — die staat er wel, zodat het overzicht een hele week blijft, maar zonder knoppen.
 * Een conflict houdt niets tegen: het staat in de verplaatslijst bij de dag waar het
 * over gaat, en jij kiest.
 */
export function PlanScreen({
  monday,
  onClose,
  onOpenSession,
  onOpenRun,
}: {
  monday: string
  onClose: () => void
  onOpenSession: (date: string, kind: DayKind) => void
  onOpenRun: (date: string) => void
}) {
  const state = useStore()
  const program = programFor(state)
  const start = mondayOf(monday)
  const dagen = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const plannen = dagen.map((iso) => buildDay(state, iso))
  const gemist = missedInWeek(state, start)

  /** de sessie waarvan de verplaatslijst open staat */
  const [moveFrom, setMoveFrom] = useState<{ date: string; what: MoveWhat } | null>(null)
  /** de sessie die overgeslagen wordt */
  const [skipFor, setSkipFor] = useState<{ date: string; what: MoveWhat } | null>(null)

  return (
    <div className="safe-top fixed inset-0 z-40 flex flex-col bg-bg">
      <Screen
        bottom="free"
        action={
          <Actions>
            <Primary onClick={onClose}>Klaar</Primary>
          </Actions>
        }
      >
        <TopLine
          left={
            <button type="button" onClick={onClose} className="text-muted">
              ← Week
            </button>
          }
          right={formatRange(start, addDays(start, 6))}
        />

        <h1 className="mt-block font-serif text-exercise leading-exercise text-ink">Plannen</h1>
        <p className="quote mt-in-block">
          Schuif een sessie naar een andere dag of sla hem over.
          {restDayLabel(program) ? ` ${restDayLabel(program)} blijft altijd vrij.` : ''}
        </p>

        {gemist.length > 0 && (
          <div className="mt-block flex flex-col gap-in-block">
            <Caps tone="accent">Nog in te vullen</Caps>
            {gemist.map((m) => (
              <div key={`${m.date}:${m.what}`} className="flex items-baseline justify-between gap-column">
                <p className="min-w-0 truncate text-body text-muted">
                  {formatShort(m.date)} · {m.naam}
                </p>
                <Link
                  onClick={() =>
                    m.what === 'run' ? onOpenRun(m.date) : onOpenSession(m.date, m.kind!)
                  }
                >
                  Invullen
                </Link>
              </div>
            ))}
          </div>
        )}

        <div className="mt-block flex flex-col">
          {dagen.map((iso, i) => (
            <PlanRij
              key={iso}
              iso={iso}
              plan={plannen[i]}
              laatste={i === dagen.length - 1}
              onMove={(what) => setMoveFrom({ date: iso, what })}
              onSkip={(what) => setSkipFor({ date: iso, what })}
              onOpenSession={onOpenSession}
              onOpenRun={onOpenRun}
            />
          ))}
        </div>
      </Screen>

      {moveFrom && (
        <MoveSheet
          open
          onClose={() => setMoveFrom(null)}
          targets={moveTargets(state, moveFrom.date, moveFrom.what)}
          hint={`${
            moveFrom.what === 'run'
              ? 'De krachtsessie van die dag blijft staan.'
              : 'De loop van die dag blijft staan; die verplaats je apart.'
          }${restDayHint(program)}`}
          onPick={(target) => {
            if (moveFrom.what === 'run') A.moveRun(moveFrom.date, target)
            else A.moveSession(moveFrom.date, target)
            setMoveFrom(null)
          }}
        />
      )}

      <Sheet open={skipFor !== null} onClose={() => setSkipFor(null)} title="Overslaan — waarom?">
        <p className="mb-block text-body text-muted">Wordt gelogd, verder geen gevolgen.</p>
        <ChoiceGrid
          columns={2}
          options={SKIP_REASONS}
          onChange={(reden) => {
            if (skipFor) A.skipSession(skipFor.date, skipFor.what, reden)
            setSkipFor(null)
          }}
        />
      </Sheet>
    </div>
  )
}

const SKIP_REASONS: { id: SkipReason; label: string }[] = [
  { id: 'druk', label: 'Druk' },
  { id: 'etentje', label: 'Etentje' },
  { id: 'geen_zin', label: 'Geen zin' },
  { id: 'ziek', label: 'Ziek' },
]

/* -------------------------------------------------------------------------
 * Eén dag
 * ---------------------------------------------------------------------- */

function PlanRij({
  iso,
  plan,
  laatste,
  onMove,
  onSkip,
  onOpenSession,
  onOpenRun,
}: {
  iso: string
  plan: DayPlan
  laatste: boolean
  onMove: (what: MoveWhat) => void
  onSkip: (what: MoveWhat) => void
  onOpenSession: (date: string, kind: DayKind) => void
  onOpenRun: (date: string) => void
}) {
  const isToday = iso === today()
  const vorm = isToday
    ? '-mx-bleed border-y-hair border-accent bg-accent-wash px-bleed py-today-row'
    : `border-t-hair border-rule py-row ${laatste ? 'border-b-hair' : ''}`

  return (
    <div className={`flex gap-column ${vorm}`}>
      <div className={`flex w-day-col flex-none flex-col ${isToday ? 'text-accent' : 'text-dim'}`}>
        <div className="text-caps uppercase tracking-caps-day">{weekdayShort(iso)}</div>
        <div className={`font-serif text-day-number ${isToday ? 'text-accent' : 'text-muted'}`}>
          {dayNumber(iso)}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-in-block">
        {plan.isRest ? (
          <p className="pt-tight font-serif text-note italic text-faint">
            Rustdag. Hier plant de app nooit iets.
          </p>
        ) : (
          <>
            <RunRegel iso={iso} plan={plan} onMove={onMove} onSkip={onSkip} onOpenRun={onOpenRun} />
            <KrachtRegel
              iso={iso}
              plan={plan}
              onMove={onMove}
              onSkip={onSkip}
              onOpenSession={onOpenSession}
            />
            {!plan.run && !plan.strength && !plan.movedTo && !plan.runMovedTo && (
              <p className="text-meta text-dim">Niets ingepland.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Eén regel met wat er staat en wat je ermee kunt. */
function Regel({
  naam,
  status,
  children,
}: {
  naam: string
  status?: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-column">
      <div className="flex min-w-0 flex-col">
        <p className="truncate text-list text-ink">{naam}</p>
        {status && <p className="text-meta text-dim">{status}</p>}
      </div>
      <div className="flex shrink-0 gap-meta">{children}</div>
    </div>
  )
}

function RunRegel({
  iso,
  plan,
  onMove,
  onSkip,
  onOpenRun,
}: {
  iso: string
  plan: DayPlan
  onMove: (what: MoveWhat) => void
  onSkip: (what: MoveWhat) => void
  onOpenRun: (date: string) => void
}) {
  const state = useStore()

  if (plan.runMovedTo) {
    return (
      <Regel naam="Loop" status={`verplaatst naar ${formatShort(plan.runMovedTo)}`}>
        <Link onClick={() => A.undoRunMove(iso)}>Terughalen</Link>
      </Regel>
    )
  }

  const run = plan.run
  if (!run) return null
  const naam = runName(run.kind, run.bike)

  if (run.skipped) {
    return (
      <Regel naam={naam} status="overgeslagen">
        <Link onClick={() => A.undoSkip(iso, 'run')}>Toch doen</Link>
      </Regel>
    )
  }
  if (run.done) return <Regel naam={naam} status="gedaan" />

  return (
    <Regel naam={naam} status={run.movedFrom ? `van ${formatShort(run.movedFrom)}` : undefined}>
      {isBackfillDate(iso) && <Link onClick={() => onOpenRun(iso)}>Invullen</Link>}
      <Link disabled={!canMove(state, iso, 'run')} onClick={() => onMove('run')}>
        Verplaatsen
      </Link>
      <Link onClick={() => onSkip('run')}>Overslaan</Link>
    </Regel>
  )
}

function KrachtRegel({
  iso,
  plan,
  onMove,
  onSkip,
  onOpenSession,
}: {
  iso: string
  plan: DayPlan
  onMove: (what: MoveWhat) => void
  onSkip: (what: MoveWhat) => void
  onOpenSession: (date: string, kind: DayKind) => void
}) {
  const state = useStore()

  if (plan.movedTo) {
    const kind = programFor(state).week[plan.weekday - 1]?.strength
    return (
      <Regel
        naam={kind ? DAY_LABEL[kind] : 'Krachtsessie'}
        status={`verplaatst naar ${formatShort(plan.movedTo)}`}
      >
        <Link onClick={() => A.undoMove(iso)}>Terughalen</Link>
      </Regel>
    )
  }

  const s = plan.strength
  if (!s) return null

  if (s.skipped) {
    return (
      <Regel naam={s.naam} status="overgeslagen">
        <Link onClick={() => A.undoSkip(iso, 'strength')}>Toch doen</Link>
      </Regel>
    )
  }
  if (s.done) return <Regel naam={s.naam} status="gedaan" />

  return (
    <Regel naam={s.naam} status={s.movedFrom ? `van ${formatShort(s.movedFrom)}` : undefined}>
      {isBackfillDate(iso) && <Link onClick={() => onOpenSession(iso, s.kind)}>Invullen</Link>}
      <Link disabled={!canMove(state, iso, 'strength')} onClick={() => onMove('strength')}>
        Verplaatsen
      </Link>
      <Link onClick={() => onSkip('strength')}>Overslaan</Link>
    </Regel>
  )
}
