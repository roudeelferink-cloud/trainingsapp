import { useMemo, useState, type ReactNode } from 'react'
import {
  Actions,
  Caps,
  Link,
  Primary,
  Screen,
  Secondary,
  TopLine,
} from '../components/logboek'
import { MoveSheet } from '../components/MoveSheet'
import { ChoiceGrid, Sheet, Stepper } from '../components/ui'
import { programFor, restDayHint } from '../data/programs'
import { paceMinPerKm } from '../logic/activities'
import { TOO_OLD_TEXT, backfillNotice, isTooOld } from '../logic/backfill'
import { buildDay, canMove, moveTargets, runName } from '../logic/day'
import { formatShort } from '../logic/dates'
import { FEELS, feelLabel } from '../logic/feel'
import { BIKE_MINUTES } from '../logic/running'
import { fmt, runContext } from '../logic/runningLoad'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { SkipReason } from '../types'

/**
 * De loop als sessie: openen, invullen, afronden.
 *
 * Een krachtsessie kon je openen, een loop alleen afvinken. Dat verschil was er zonder
 * reden — ook een loop heeft een geplande afstand, een werkelijke afstand, een duur en
 * een beoordeling achteraf, en die vier horen op één scherm te staan in plaats van in
 * een blad onder een knop.
 *
 * Wat de app hier níét doet is er iets van vinden. Er wordt geen afstand voorgeschreven,
 * niets afgetopt en niets teruggeschaald: je vult in wat je gelopen hebt en de app rekent
 * er het tempo bij. De enige regel die de app zelf schrijft is de feitelijke constatering
 * uit `runContext` — hoe deze afstand zich verhoudt tot je gemiddelde en je langste loop.
 * Advies blijft van de krachttraining.
 */
export function RunScreen({ date, onClose }: { date: string; onClose: () => void }) {
  const state = useStore()
  const plan = buildDay(state, date)
  const run = plan.run

  const [km, setKm] = useState(() => run?.log?.km ?? run?.km ?? 0)
  const [min, setMin] = useState(() => run?.log?.minutes ?? (run?.bike ? BIKE_MINUTES : 0))
  const [doneOpen, setDoneOpen] = useState(false)
  const [opgeslagen, setOpgeslagen] = useState(false)
  const [meer, setMeer] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  // de doellijst rekent per dag door wat een verplaatsing zou betekenen: pas bij openen
  const targets = useMemo(() => (moveOpen ? moveTargets(state, date, 'run') : []), [moveOpen, state, date])

  if (!run) {
    return (
      <Leeg date={date} onClose={onClose}>
        Er staat geen loop meer op {formatShort(date)}.
      </Leeg>
    )
  }
  if (isTooOld(date)) {
    return (
      <Leeg date={date} onClose={onClose}>
        {TOO_OLD_TEXT}
      </Leeg>
    )
  }

  const naam = runName(run.kind, run.bike)
  const achteraf = backfillNotice(date)
  const tempo = run.bike ? null : paceMinPerKm(km, min)

  function bewaar(feel?: (typeof FEELS)[number]['id']) {
    A.completeRun(date, run!.kind, {
      plannedKm: run!.plannedKm,
      km: run!.bike ? 0 : km,
      minutes: min > 0 ? min : null,
      bike: run!.bike,
      feel,
    })
    setOpgeslagen(true)
  }

  return (
    <Full>
      <Screen
        bottom="free"
        action={
          <Actions>
            <Primary onClick={() => setDoneOpen(true)}>
              {run.done ? 'Loop bijwerken' : run.bike ? 'Fietsen afronden' : 'Loop afronden'}
            </Primary>
            <Secondary onClick={() => setMeer(true)}>Meer</Secondary>
          </Actions>
        }
      >
        <TopLine
          left={
            <button type="button" onClick={onClose} className="text-muted">
              ← {naam}
            </button>
          }
          right={formatShort(date)}
        />

        <h1 className="mt-block font-serif text-exercise leading-exercise text-ink">{naam}</h1>
        <div className="mt-in-block flex flex-wrap gap-meta text-label text-dim">
          <span>{run.free ? 'geen afstand gezet' : `gepland ${fmt(run.plannedKm)} km`}</span>
          {run.movedFrom && <span>verplaatst van {formatShort(run.movedFrom)}</span>}
          {run.done && <span>afgevinkt</span>}
          {run.log?.feel && <span>{feelLabel(run.log.feel).toLowerCase()}</span>}
        </div>

        {achteraf && (
          <div className="mt-block flex flex-col gap-in-block">
            <Caps>Eerdere dag</Caps>
            <p className="quote">{achteraf}</p>
          </div>
        )}

        {!run.bike && (
          <div className="mt-block flex flex-col gap-in-block">
            <div className="flex items-baseline justify-between gap-column">
              <Caps>Geplande afstand</Caps>
              {run.manualPlan && (
                <Link onClick={() => A.clearPlannedRunKm(date)}>Weghalen</Link>
              )}
            </div>
            <Stepper
              value={run.plannedKm}
              onChange={(v) => (v > 0 ? A.setPlannedRunKm(date, v) : A.clearPlannedRunKm(date))}
              step={0.5}
              decimals={1}
              suffix="km"
              max={100}
              ariaLabel="Geplande afstand"
            />
            <p className="text-meta text-dim">
              De app schrijft geen afstand voor. Zet hier wat je van plan was, of laat het leeg.
            </p>
          </div>
        )}

        {!run.bike && (
          <div className="mt-block flex flex-col gap-in-block">
            <Caps>Werkelijk gelopen</Caps>
            <Stepper
              value={km}
              onChange={setKm}
              step={0.5}
              decimals={1}
              suffix="km"
              max={100}
              ariaLabel="Gelopen kilometers"
            />
            <p className="text-meta text-dim">
              Wat je écht gelopen hebt. Er wordt niets afgetopt: loop je verder dan gepland, dan
              staat dat er zo.
            </p>
          </div>
        )}

        <div className="mt-block flex flex-col gap-in-block">
          <Caps>Duur — optioneel</Caps>
          <Stepper
            value={min}
            onChange={setMin}
            step={5}
            max={300}
            suffix="min"
            ariaLabel="Duur in minuten"
          />
          {tempo && <p className="text-meta text-dim">Tempo {tempo}</p>}
        </div>

        {/* de enige regel die de app zelf schrijft: één constatering, geen voorstel */}
        {!run.bike && km > 0 && (
          <p className="quote mt-block">{runContext(state, date, run.kind, km)}</p>
        )}

        <div className="mt-block flex gap-meta">
          <Link disabled={!canMove(state, date, 'run')} onClick={() => setMoveOpen(true)}>
            Verplaatsen
          </Link>
          <Link onClick={() => setSkipOpen(true)}>Overslaan</Link>
        </div>
      </Screen>

      <Sheet
        open={doneOpen}
        onClose={() => {
          setDoneOpen(false)
          setOpgeslagen(false)
        }}
        title={run.bike ? 'Fietsen afronden' : 'Loop afronden'}
      >
        {opgeslagen ? (
          <div className="flex flex-col gap-block">
            <Caps tone="accent">Opgeslagen</Caps>
            <p className="quote">
              {run.bike
                ? `${min} minuten gefietst op ${formatShort(date)}.`
                : `${fmt(km)} km op ${formatShort(date)}${tempo ? ` — tempo ${tempo}` : ''}.`}
            </p>
            <button className="btn-primary w-full" onClick={onClose}>
              Klaar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-block">
            <p className="text-body text-muted">
              {run.bike
                ? `${min} minuten fietsen.`
                : `${fmt(km)} km${min > 0 ? ` in ${min} min` : ''}${tempo ? ` — tempo ${tempo}` : ''}.`}
            </p>
            <div className="flex flex-col gap-in-block">
              <Caps>Hoe ging het?</Caps>
              <ChoiceGrid options={FEELS} value={run.log?.feel} onChange={(feel) => bewaar(feel)} />
            </div>
            <button className="btn-quiet w-full" onClick={() => bewaar()}>
              Opslaan zonder beoordeling
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={meer} onClose={() => setMeer(false)} title={naam}>
        <div className="flex flex-col gap-in-block">
          <button className="btn-ghost w-full" onClick={() => A.setBike(date, !run.bike)}>
            {run.bike ? 'Toch lopen' : 'Fiets in plaats van lopen'}
          </button>
          <button
            className="btn-ghost w-full disabled:opacity-40"
            disabled={!canMove(state, date, 'run')}
            onClick={() => {
              setMeer(false)
              setMoveOpen(true)
            }}
          >
            Verplaatsen
          </button>
          <button
            className="btn-quiet w-full"
            onClick={() => {
              setMeer(false)
              setSkipOpen(true)
            }}
          >
            Overslaan
          </button>
        </div>
      </Sheet>

      <MoveSheet
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        targets={targets}
        hint={`De krachtsessie van die dag blijft staan.${restDayHint(programFor(state))}`}
        onPick={(target) => {
          A.moveRun(date, target)
          setMoveOpen(false)
          onClose()
        }}
      />

      <Sheet open={skipOpen} onClose={() => setSkipOpen(false)} title="Overslaan — waarom?">
        <p className="mb-block text-body text-muted">Wordt gelogd, verder geen gevolgen.</p>
        <ChoiceGrid
          columns={2}
          options={SKIP_REASONS}
          onChange={(r) => {
            A.skipSession(date, 'run', r)
            setSkipOpen(false)
            onClose()
          }}
        />
      </Sheet>
    </Full>
  )
}

export const SKIP_REASONS: { id: SkipReason; label: string }[] = [
  { id: 'druk', label: 'Druk' },
  { id: 'etentje', label: 'Etentje' },
  { id: 'geen_zin', label: 'Geen zin' },
  { id: 'ziek', label: 'Ziek' },
]

/** Er valt hier niets te loggen: zeg dat, en laat de weg terug open. */
function Leeg({
  date,
  onClose,
  children,
}: {
  date: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Full>
      <Screen
        bottom="free"
        action={
          <Actions>
            <Primary onClick={onClose}>Terug</Primary>
          </Actions>
        }
      >
        <TopLine left="Hardlopen" right={formatShort(date)} />
        <p className="quote mt-block">{children}</p>
      </Screen>
    </Full>
  )
}

/** Net als de krachtsessie: het scherm dekt de app af, met een eigen weg terug. */
function Full({ children }: { children: ReactNode }) {
  return <div className="safe-top fixed inset-0 z-40 flex flex-col bg-bg">{children}</div>
}
