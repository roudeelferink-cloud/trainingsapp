import { useMemo, useState } from 'react'
import { ActivityList, ActivitySheet } from '../components/Activities'
import { MoveSheet } from '../components/MoveSheet'
import { Card, ChoiceGrid, Chip, ConfirmCheck, Empty, SectionTitle, Sheet, Stepper } from '../components/ui'
import { programFor, restDayHint } from '../data/programs'
import { activitiesOn, paceMinPerKm } from '../logic/activities'
import { buildDay, canMove, moveTargets, type DayPlan, type MoveWhat } from '../logic/day'
import { addDays, formatLong, formatShort, today } from '../logic/dates'
import { warmupLabel } from '../logic/warmup'
import { trainingStreak } from '../logic/stats'
import { BIKE_MINUTES } from '../logic/running'
import { DAY_SCORES, FEELS, feelLabel } from '../logic/feel'
import { DELOAD_RISK, weeksUntilDeload } from '../logic/deload'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { Activity, DayKind, DayScore, SkipReason } from '../types'

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
      {/* de check-in stuurt het programma van vandaag en blijft daarom boven de sessie;
          eenmaal ingevuld klapt hij in, zodat de sessie zelf bovenaan komt te staan */}
      <CheckIn iso={iso} value={plan.checkin} />

      <Notes plan={plan} />
      <GuardrailCards plan={plan} />

      <DeloadCard iso={iso} plan={plan} />

      {plan.isRest && (
        <Card className="text-center py-8">
          <p className="text-2xl font-medium mb-1">Rustdag</p>
          <p className="text-muted">Woensdag. Niks doen is vandaag het programma.</p>
        </Card>
      )}

      {plan.movedTo && !plan.strength && (
        <Card>
          <p className="text-sm text-fg">
            Krachtsessie verplaatst naar <b>{formatShort(plan.movedTo)}</b>.
          </p>
          <button className="btn-quiet btn-sm mt-3 w-full" onClick={() => A.undoMove(iso)}>
            Verplaatsing ongedaan maken
          </button>
        </Card>
      )}

      {plan.runMovedTo && !plan.run && (
        <Card>
          <p className="text-sm text-fg">
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
          <div className="h-px flex-1 bg-line" />
          <span className="text-sm font-medium text-muted">10-15 min pauze</span>
          <div className="h-px flex-1 bg-line" />
        </div>
      )}

      {plan.strength && <StrengthCard iso={iso} plan={plan} onOpenSession={onOpenSession} />}

      {!plan.isRest && !plan.run && !plan.strength && !plan.movedTo && !plan.runMovedTo && (
        <Card>
          <Empty>
            Geen sessie ingepland vandaag.
            <NextSessionHint iso={iso} />
          </Empty>
        </Card>
      )}

      {/* stuurt vandaag niets (hij voedt alleen de deloadbeslissing) en staat daarom
          onder de sessies in plaats van erboven */}
      <DayCheckCard iso={iso} />
      <ExtraActivities iso={iso} />
    </div>
  )
}

/**
 * Wat er hierna op de rol staat. Een lege dag zonder vooruitblik is een doodlopende
 * straat; dit is puur afgeleide informatie uit het bestaande weekschema.
 */
function NextSessionHint({ iso }: { iso: string }) {
  const state = useStore()

  for (let d = 1; d <= 7; d++) {
    const date = addDays(iso, d)
    const plan = buildDay(state, date)
    const delen: string[] = []
    if (plan.run && !plan.run.done && !plan.run.skipped) {
      delen.push(plan.run.bike ? 'fietsen' : plan.run.kind === 'long' ? 'duurloop' : 'hardlopen')
    }
    if (plan.strength && !plan.strength.done && !plan.strength.skipped) {
      delen.push(plan.strength.naam)
    }
    if (delen.length > 0) {
      return (
        <span className="block mt-1">
          Volgende sessie: {formatShort(date)} — {delen.join(' + ')}.
        </span>
      )
    }
  }
  return null
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
        right={items.length > 0 ? <Chip>{items.length}</Chip> : undefined}
      >
        Extra activiteiten
      </SectionTitle>
      <p className="text-sm text-muted mb-3">
        Naast het schema. Telt niet mee in je krachtprogressie of gewichtsadvies; een los rondje
        hardlopen telt wél mee in je weekkilometers.
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
        <p className="text-sm text-muted capitalize">{formatLong(plan.date)}</p>
        <h1 className="text-2xl font-medium leading-tight">
          Week {plan.cycle.week}
          <span className="text-muted font-medium text-lg">
            {' · '}
            {plan.deload.active
              ? 'deloadweek'
              : `nog ${weeksUntilDeload(plan.cycle.week)} ${
                  weeksUntilDeload(plan.cycle.week) === 1 ? 'week' : 'weken'
                } tot de deload`}
          </span>
        </h1>
        <div className="flex gap-2 mt-2 flex-wrap">
          {plan.deload.active && <Chip>Deload</Chip>}
          {plan.deload.skipped && <Chip>Deload overgeslagen</Chip>}
          {plan.cycle.calibration && <Chip>Kalibratie</Chip>}
          {state.settings?.travelMode && <Chip>Reismodus</Chip>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-3xl font-medium num">{streak}</p>
        <p className="text-xs text-muted">dagen streak</p>
      </div>
    </div>
  )
}

/**
 * De losse regels van vandaag. Bijsturingen met een knop eronder staan niet hier maar in
 * `GuardrailCards`; die zouden als opsommingsteken niets te kiezen geven.
 */
function Notes({ plan }: { plan: DayPlan }) {
  const metKnop = new Set(plan.guardrails.filter((g) => g.move || g.dismissKey).map((g) => g.text))
  const regels = plan.notes.filter((n) => !metKnop.has(n))
  if (regels.length === 0) return null

  return (
    <ul className="space-y-1">
      {regels.map((n, i) => (
        <li key={i} className="text-sm text-muted flex gap-2">
          <span aria-hidden>•</span>
          <span>{n}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Bijsturingen waar iets mee te doen valt: de uitleg, en meteen de knop om het op te
 * lossen. Een waarschuwing over een sessie die verkeerd staat zonder knop om hem te
 * verzetten is een verwijt; met knop is het een voorstel.
 */
function GuardrailCards({ plan }: { plan: DayPlan }) {
  const state = useStore()
  const [moveFrom, setMoveFrom] = useState<{ date: string; what: MoveWhat } | null>(null)
  const items = plan.guardrails.filter((g) => g.move || g.dismissKey)
  if (items.length === 0) return null

  return (
    <>
      {items.map((g) => (
        <Card key={g.id} className="border-line">
          <p className="text-sm text-fg">{g.text}</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {g.move && (
              <button className="btn-ghost btn-sm" onClick={() => setMoveFrom(g.move!)}>
                Verplaatsen
              </button>
            )}
            {g.dismissKey && (
              <button
                className="btn-quiet btn-sm"
                onClick={() => A.dismissWarning(g.dismissKey!, plan.date)}
              >
                Niet meer tonen
              </button>
            )}
          </div>
        </Card>
      ))}

      {moveFrom && (
        <MoveSheet
          open
          onClose={() => setMoveFrom(null)}
          targets={moveTargets(state, moveFrom.date, moveFrom.what)}
          hint={`Verplaats de sessie van ${formatShort(moveFrom.date)}.${restDayHint(programFor(state))}`}
          onPick={(target) => {
            if (moveFrom.what === 'run') A.moveRun(moveFrom.date, target)
            else A.moveSession(moveFrom.date, target)
            setMoveFrom(null)
          }}
        />
      )}
    </>
  )
}

/**
 * De dagcheck: slaap en energie, allebei op een schaal van 3. Volledig optioneel —
 * niet invullen kost je niets. Twee weken op rij overwegend slecht is wél een van de
 * aanleidingen voor een deloadweek, dus invullen loont als je je beroerd voelt.
 */
function DayCheckCard({ iso }: { iso: string }) {
  const state = useStore()
  const check = state.dayChecks?.[iso]
  const [edit, setEdit] = useState(false)

  // volledig ingevuld en niet aan het wijzigen: samenvatten op één regel
  if (check && !edit) {
    const label = (v: DayScore) => DAY_SCORES.find((s) => s.id === v)?.label.toLowerCase()
    return (
      <Card>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-fg">
            Dagcheck: slaap <b className="text-fg">{label(check.sleep)}</b> · energie{' '}
            <b className="text-fg">{label(check.energy)}</b>
          </span>
          <button className="btn-quiet btn-sm shrink-0" onClick={() => setEdit(true)}>
            Wijzig
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <SectionTitle
        right={
          check ? (
            <button className="btn-quiet btn-sm" onClick={() => A.clearDayCheck(iso)}>
              Wissen
            </button>
          ) : undefined
        }
      >
        Dagcheck
      </SectionTitle>
      <p className="text-xs text-muted mb-3">Optioneel. Overslaan mag; er verandert dan niets.</p>

      {(
        [
          { part: 'sleep' as const, label: 'Slaap' },
          { part: 'energy' as const, label: 'Energie' },
        ]
      ).map(({ part, label }) => (
        <div key={part} className="mb-2 last:mb-0">
          <p className="label mb-1">{label}</p>
          <ChoiceGrid
            options={DAY_SCORES}
            value={check?.[part]}
            onChange={(v) => {
              A.setDayCheckPart(iso, part, v)
              // blijf open: wie slaap invult wil meestal ook de energie nog zetten
              setEdit(true)
            }}
            buttonClass="min-h-[48px] text-sm"
          />
        </div>
      ))}
    </Card>
  )
}

/**
 * De deloadweek, en het overslaan daarvan.
 *
 * Overslaan kan, maar niet met één tik: eerst het risico aanvinken, dan pas de knop.
 * Dat is bewust ongemakkelijk — een deload die je wegklikt omdat hij in de weg staat is
 * precies de deload die je nodig had.
 */
function DeloadCard({ iso, plan }: { iso: string; plan: DayPlan }) {
  const [open, setOpen] = useState(false)
  const [gelezen, setGelezen] = useState(false)
  const deload = plan.deload

  if (!deload.reason) return null

  return (
    <Card>
      <SectionTitle right={<Chip>week {deload.week}</Chip>}>
        {deload.active ? 'Deloadweek' : 'Deload overgeslagen'}
      </SectionTitle>
      <p className="text-sm text-fg">{deload.explanation}</p>

      {deload.active ? (
        <button className="btn-quiet w-full mt-3" onClick={() => setOpen(true)}>
          Deload overslaan
        </button>
      ) : (
        <button className="btn-ghost w-full mt-3" onClick={() => A.undoSkipDeload(iso)}>
          Toch de deload doen
        </button>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Deload overslaan">
        <p className="text-sm text-fg mb-3">{DELOAD_RISK}</p>
        <ConfirmCheck checked={gelezen} onToggle={() => setGelezen((v) => !v)}>
          Ik heb het risico gelezen en sla de deload bewust over
        </ConfirmCheck>
        <button
          className="btn w-full bg-error text-on-error disabled:opacity-40 mt-3"
          disabled={!gelezen}
          onClick={() => {
            A.skipDeload(iso, gelezen)
            setGelezen(false)
            setOpen(false)
          }}
        >
          Deload overslaan
        </button>
        <button className="btn-quiet w-full mt-2" onClick={() => setOpen(false)}>
          Annuleren
        </button>
      </Sheet>
    </Card>
  )
}

function CheckIn({ iso, value }: { iso: string; value: number | undefined }) {
  const [edit, setEdit] = useState(false)

  // ingevuld en niet aan het wijzigen: één regel is genoeg, de sessie moet bovenaan
  if (value !== undefined && !edit) {
    return (
      <Card>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-fg">
            Benen en pezen: <b className="text-fg">{value}</b>
            <span className="text-muted"> / 5</span>
          </span>
          <button className="btn-quiet btn-sm shrink-0" onClick={() => setEdit(true)}>
            Wijzig
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <p className="font-medium mb-1">Hoe voelen benen en pezen?</p>
      <p className="text-xs text-muted mb-3">Optioneel. Niet invullen = normaal programma.</p>
      <ChoiceGrid
        options={[1, 2, 3, 4, 5].map((n) => ({ id: n, label: n }))}
        value={value}
        onChange={(n) => {
          if (value === n) A.clearCheckin(iso)
          else A.setCheckin(iso, n)
          setEdit(false)
        }}
        columns={5}
        buttonClass="min-h-[56px] text-xl"
      />
      <p className="text-xs text-muted mt-2">1 = brak · 5 = fris</p>
    </Card>
  )
}

function RunCard({ iso, plan }: { iso: string; plan: DayPlan }) {
  const state = useStore()
  const run = plan.run!
  const [logOpen, setLogOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [planKm, setPlanKm] = useState(run.plannedKm)
  const [km, setKm] = useState(run.km)
  const [min, setMin] = useState(Math.round(run.km * 6))
  // de doellijst rekent per dag door wat een verplaatsing zou betekenen; dat gebeurt pas
  // als de lijst open gaat, niet bij elke render van dit scherm
  const targets = useMemo(
    () => (moveOpen ? moveTargets(state, iso, 'run') : []),
    [moveOpen, state, iso],
  )
  const kanVerplaatsen = canMove(state, iso, 'run')

  if (run.skipped) {
    return <SkippedCard label="Loop overgeslagen" reason={run.skipped} onUndo={() => A.undoSkip(iso, 'run')} />
  }

  return (
    <Card className="border-line">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <Chip>1 · Hardlopen</Chip>
          <p className="text-xl font-medium mt-2">
            {run.bike
              ? `Fietsen ${BIKE_MINUTES} min`
              : run.free
                ? run.kind === 'long'
                  ? 'Duurloop'
                  : 'Hardlopen'
                : `${run.kind === 'long' ? 'Duurloop' : 'Korte loop'} ${run.km} km`}
          </p>
          {run.free && !run.bike && (
            <p className="text-sm text-muted">Eigen afstand en tempo — log wat je gelopen hebt.</p>
          )}
          {!run.free && !run.bike && run.km !== run.plannedKm && (
            <p className="text-sm text-muted">Gepland was {run.plannedKm} km</p>
          )}
          {/* waarom de afstand is wat hij is: één regel per bijsturing */}
          {!run.bike &&
            run.why.map((reden, i) => (
              <p key={i} className="text-sm text-muted mt-1">
                {reden}
              </p>
            ))}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {run.done && <Chip>Gedaan</Chip>}
          {run.movedFrom && <Chip>van {formatShort(run.movedFrom)}</Chip>}
        </div>
      </div>

      {run.done ? (
        <p className="text-sm text-muted">
          Gelogd: {run.log?.bike ? `${run.log.minutes ?? BIKE_MINUTES} min fietsen` : `${run.log?.km} km`}
          {run.log && !run.log.bike && ` van ${run.log.plannedKm} km gepland`}
          {run.log?.feel && ` · ${feelLabel(run.log.feel).toLowerCase()}`}
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
              disabled={!kanVerplaatsen}
              onClick={() => setMoveOpen(true)}
            >
              Verplaatsen
            </button>
            <button className="btn-quiet btn-sm" onClick={() => setSkipOpen(true)}>
              Overslaan
            </button>
          </div>
          {!run.bike && (
            <button
              className="btn-quiet btn-sm w-full"
              onClick={() => {
                setPlanKm(run.plannedKm || 5)
                setPlanOpen(true)
              }}
            >
              Geplande afstand aanpassen
            </button>
          )}
        </div>
      )}

      {/*
        De geplande afstand is een voorstel, geen voorschrift. Zelf zetten kan altijd;
        de afwijking wordt vastgelegd zodat er later een patroon uit te lezen valt.
      */}
      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Geplande afstand">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {run.manualPlan
              ? 'Deze afstand heb je zelf gezet.'
              : `Voorstel van de app: ${run.plannedKm} km.`}
          </p>
          <div>
            <p className="label mb-1">Gepland (km)</p>
            <Stepper value={planKm} onChange={setPlanKm} step={0.5} decimals={1} suffix="km" max={60} />
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => {
              A.setPlannedRunKm(iso, run.kind, planKm)
              setPlanOpen(false)
            }}
          >
            Opslaan
          </button>
          {run.manualPlan && (
            <button
              className="btn-quiet w-full"
              onClick={() => {
                A.clearPlannedRunKm(iso)
                setPlanOpen(false)
              }}
            >
              Terug naar het voorstel van de app
            </button>
          )}
        </div>
      </Sheet>

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={run.bike ? 'Fietsen loggen' : 'Loop loggen'}>
        <div className="space-y-4">
          {!run.bike && (
            <div>
              <p className="label mb-1">Werkelijk gelopen (km)</p>
              <Stepper value={km} onChange={setKm} step={0.5} decimals={1} suffix="km" max={60} />
              <p className="text-xs text-muted mt-1 num">
                Gepland was {run.km} km. Verder lopen mag; het telt mee in het weekvolume.
              </p>
            </div>
          )}
          <div>
            <p className="label mb-1">Duur (min) — optioneel</p>
            <Stepper value={min} onChange={setMin} step={5} max={300} suffix="min" />
            {!run.bike && km > 0 && min > 0 && (
              <p className="text-xs text-muted mt-1 num">Tempo {paceMinPerKm(km, min)}</p>
            )}
          </div>
          {/* dezelfde afsluitende beoordeling als bij kracht: één tik, en het staat erin */}
          <div>
            <p className="label mb-1">Hoe ging het?</p>
            <ChoiceGrid
              options={FEELS}
              onChange={(feel) => {
                A.completeRun(iso, run.kind, {
                  plannedKm: run.km,
                  km: run.bike ? 0 : km,
                  minutes: min,
                  bike: run.bike,
                  feel,
                })
                setLogOpen(false)
              }}
            />
          </div>
          <button
            className="btn-quiet w-full"
            onClick={() => {
              A.completeRun(iso, run.kind, {
                plannedKm: run.km,
                km: run.bike ? 0 : km,
                minutes: min,
                bike: run.bike,
              })
              setLogOpen(false)
            }}
          >
            Opslaan zonder beoordeling
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

/** Een overgeslagen sessie: wat het was, waarom, en de weg terug. Loop en kracht delen hem. */
function SkippedCard({
  label,
  reason,
  onUndo,
}: {
  label: string
  reason: SkipReason
  onUndo: () => void
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="font-medium text-fg">{label}</span>
        <Chip>{REASONS.find((r) => r.id === reason)?.label}</Chip>
      </div>
      <button className="btn-quiet btn-sm mt-3 w-full" onClick={onUndo}>
        Toch doen
      </button>
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
  const targets = useMemo(() => (moveOpen ? moveTargets(state, iso) : []), [moveOpen, state, iso])
  const kanVerplaatsen = canMove(state, iso)

  if (s.skipped) {
    return (
      <SkippedCard
        label={`${s.naam} overgeslagen`}
        reason={s.skipped}
        onUndo={() => A.undoSkip(iso, 'strength')}
      />
    )
  }

  return (
    <Card className="border-line">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Chip>{plan.run ? '2 · Kracht' : '1 · Kracht'}</Chip>
          <p className="text-xl font-medium mt-2">{s.naam}</p>
          <p className="text-sm text-muted">
            ~{s.estimatedMin} min · {s.slots.length} oefeningen
            {s.short && ' · korte versie'}
          </p>
          {s.log?.feel && (
            <p className="text-sm text-muted">Beoordeeld als {feelLabel(s.log.feel).toLowerCase()}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {s.done && <Chip>Gedaan</Chip>}
          {s.optional && <Chip>Optioneel</Chip>}
          {s.movedFrom && <Chip>van {formatShort(s.movedFrom)}</Chip>}
        </div>
      </div>

      <ul className="mt-3 mb-4 space-y-1">
        {/* de sessie begint altijd met de warming-up, dus die staat hier ook bovenaan */}
        <li className="flex justify-between text-sm text-muted">
          <span className="truncate pr-2">Warming-up</span>
          <span className="num shrink-0">{warmupLabel(s.warmup)}</span>
        </li>
        {s.slots.map((r) => (
          <li key={r.slot.key} className="flex justify-between text-sm">
            <span className="truncate pr-2">
              {r.exercise.naam}
              {r.slot.role === 'accessory' && <span className="text-faint"> ·</span>}
            </span>
            <span className="text-muted num shrink-0">
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
          disabled={!kanVerplaatsen}
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
      <p className="text-sm text-muted mb-3">Wordt gelogd, verder geen gevolgen.</p>
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

