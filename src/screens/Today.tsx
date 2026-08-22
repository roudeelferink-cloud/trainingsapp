import { useMemo, useState, type ReactNode } from 'react'
import { ActivityList, ActivitySheet } from '../components/Activities'
import {
  Actions,
  Caps,
  Link,
  Primary,
  Rule,
  Screen,
  Secondary,
  Segments,
  Stats,
  TopLine,
  type Stat,
} from '../components/logboek'
import { MoveSheet } from '../components/MoveSheet'
import { ChoiceGrid, ConfirmCheck, Empty, Sheet, Stepper } from '../components/ui'
import { programFor, restDayHint } from '../data/programs'
import { activitiesOn, paceMinPerKm } from '../logic/activities'
import { buildDay, canMove, moveTargets, type DayPlan, type MoveWhat } from '../logic/day'
import { formatLong, formatShort, addDays, today } from '../logic/dates'
import { trainingStreak } from '../logic/stats'
import { BIKE_MINUTES } from '../logic/running'
import { fmt, runContext, weekLoad } from '../logic/runningLoad'
import { DAY_SCORES, FEELS, feelLabel } from '../logic/feel'
import { DELOAD_RISK } from '../logic/deload'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { Activity, DayKind, DayScore, SkipReason } from '../types'

const REASONS: { id: SkipReason; label: string }[] = [
  { id: 'druk', label: 'Druk' },
  { id: 'etentje', label: 'Etentje' },
  { id: 'geen_zin', label: 'Geen zin' },
  { id: 'ziek', label: 'Ziek' },
]

/**
 * Vandaag: één pagina, van boven naar beneden te lezen. Bovenaan wat er op het
 * programma staat, daaronder waarom het is wat het is, dan de check-in, en onderin
 * — binnen duimbereik — de knop waar je op drukt.
 */
export function Today({ onOpenSession }: { onOpenSession: (date: string, kind: DayKind) => void }) {
  const state = useStore()
  const iso = today()
  const plan = buildDay(state, iso)
  const stats = useStats(plan)
  const leeg = !plan.isRest && !plan.run && !plan.strength && !plan.movedTo && !plan.runMovedTo

  return (
    <Screen action={<TodayActions iso={iso} plan={plan} onOpenSession={onOpenSession} />}>
      <TopLine left={formatLong(plan.date)} right={<Markeringen plan={plan} />} />
      <Rule className="my-block" />

      <Headline plan={plan} />

      {leeg && (
        <p className="quote mt-in-block">
          Geen sessie ingepland vandaag.
          <NextSessionHint iso={iso} />
        </p>
      )}

      <div className="mt-block">
        <Stats items={stats} />
      </div>

      <Loopafstand iso={iso} plan={plan} />
      <Bijsturing plan={plan} />
      <DeloadBlok iso={iso} plan={plan} />
      <Dagcheck iso={iso} checkin={plan.checkin} />
      <TweedeSessie iso={iso} plan={plan} onOpenSession={onOpenSession} />
      <ExtraActiviteiten iso={iso} />
    </Screen>
  )
}

/**
 * Rechtsboven: waar je in het programma zit, en wat er deze week aan de hand is dat
 * het programma anders maakt. Gestapelde kapitaalregels, net als de weekkop — geen
 * gekleurde bolletjes, want oker doet maar twee dingen en dit is er geen van.
 */
function Markeringen({ plan }: { plan: DayPlan }) {
  const state = useStore()
  const merken = [
    plan.deload.active ? 'deloadweek' : null,
    plan.deload.skipped ? 'deload overgeslagen' : null,
    plan.cycle.calibration ? 'kalibratie' : null,
    state.settings?.travelMode ? 'reismodus' : null,
  ].filter(Boolean) as string[]

  return (
    <div className="flex flex-col items-end gap-tight whitespace-nowrap">
      <div>Week {plan.cycle.week}</div>
      {merken.map((m) => (
        <div key={m} className="text-faint">
          {m}
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------
 * De kop: wat staat er vandaag op het programma
 * ---------------------------------------------------------------------- */

/**
 * De kop van de dag. Een loop heeft een afstand en krijgt daarom het grote cijfer;
 * een krachtsessie heeft een naam en krijgt die op formaat. Een dag zonder allebei
 * zegt dat gewoon.
 */
function Headline({ plan }: { plan: DayPlan }) {
  const run = plan.run
  const s = plan.strength

  if (plan.isRest) return <Titel>Rustdag</Titel>

  if (run && !run.skipped) {
    if (run.bike) return <Getal lead="Fietsen" value={String(BIKE_MINUTES)} unit="min" />
    if (run.free) return <Titel>{run.kind === 'long' ? 'Duurloop' : 'Hardlopen'}</Titel>
    return (
      <Getal
        lead={run.kind === 'long' ? 'Duurloop' : 'Korte loop'}
        value={fmt(run.km)}
        unit="km"
      />
    )
  }

  if (s && !s.skipped) return <Titel lead="Krachtsessie">{s.naam}</Titel>

  if (run?.skipped) {
    return <Titel lead={REASONS.find((r) => r.id === run.skipped)?.label}>Loop overgeslagen</Titel>
  }
  if (s?.skipped) {
    return <Titel lead={REASONS.find((r) => r.id === s.skipped)?.label}>{s.naam} overgeslagen</Titel>
  }

  // niets meer te doen omdat het al ergens anders staat
  if (plan.movedTo) {
    return <Titel lead={`naar ${formatShort(plan.movedTo)}`}>Krachtsessie verplaatst</Titel>
  }
  if (plan.runMovedTo) {
    return <Titel lead={`naar ${formatShort(plan.runMovedTo)}`}>Loop verplaatst</Titel>
  }

  return <Titel>Niets ingepland</Titel>
}

/** Een kop op naam: de sessie, de rustdag. */
function Titel({ children, lead }: { children: ReactNode; lead?: string }) {
  return (
    <div>
      {lead ? <Lead>{lead}</Lead> : null}
      <div className="font-serif text-exercise leading-exercise text-ink">{children}</div>
    </div>
  )
}

/** Een kop op maat: de afstand of de duur, als groot cijfer met zijn eenheid. */
function Getal({ lead, value, unit }: { lead: string; value: string; unit: string }) {
  return (
    <div>
      <Lead>{lead}</Lead>
      <div className="mt-tight flex items-baseline gap-in-block">
        <div className="font-serif text-display font-medium leading-none tracking-display text-ink">
          {value}
        </div>
        <div className="font-serif text-stat text-dim">{unit}</div>
      </div>
    </div>
  )
}

function Lead({ children }: { children: ReactNode }) {
  return <div className="font-serif italic text-lead text-muted">{children}</div>
}

/**
 * De kerncijfers van de dag. Er staat alleen in wat de app echt weet: geen kolom
 * zonder gegeven, en geen gereserveerde lege ruimte.
 */
function useStats(plan: DayPlan): Stat[] {
  const state = useStore()
  const streak = trainingStreak(state)
  const items: Stat[] = []
  const run = plan.run
  const s = plan.strength

  if (run && !run.skipped) {
    const load = weekLoad(state, plan.date)
    items.push({
      label: 'Deze week',
      value: fmt(load.done),
      suffix: ` / ${fmt(load.km)} km`,
      flex: 1.4,
    })
    if (!run.bike && !run.free && run.km !== run.plannedKm) {
      items.push({ label: 'Gepland', value: fmt(run.plannedKm), suffix: ' km' })
    }
  } else if (s && !s.skipped) {
    items.push({ label: 'Duur', value: `~${s.estimatedMin}`, suffix: ' min' })
    items.push({ label: 'Oefeningen', value: String(s.slots.length) })
  }

  items.push({
    label: 'Streak',
    value: String(streak),
    suffix: streak === 1 ? ' dag' : ' dagen',
  })
  return items
}

/* -------------------------------------------------------------------------
 * De loopafstand
 * ---------------------------------------------------------------------- */

/**
 * De afstand van vandaag: één feitelijke regel eronder en een knop om hem zelf te zetten.
 *
 * De app kapte de afstand af op wat het gemiddelde toestond. Dat werkte averechts —
 * minder lopen verlaagde het gemiddelde, en daarmee het plafond, en daarmee de volgende
 * afstand. Nu vul je hem zelf in en zegt de app alleen wat ze ziet: hoe deze afstand zich
 * verhoudt tot je gemiddelde loop van deze soort en tot je langste loop.
 */
function Loopafstand({ iso, plan }: { iso: string; plan: DayPlan }) {
  const state = useStore()
  const run = plan.run
  const [open, setOpen] = useState(false)
  const [km, setKm] = useState(0)

  if (!run || run.skipped || run.bike || run.free) return null

  return (
    <div className="mt-block flex flex-col gap-in-block">
      <div className="flex items-baseline justify-between gap-column">
        <Caps>Geplande afstand</Caps>
        <Link
          onClick={() => {
            setKm(run.plannedKm || run.km || 5)
            setOpen(true)
          }}
        >
          Zelf invullen
        </Link>
      </div>
      {run.context && <p className="quote">{run.context}</p>}

      <Sheet open={open} onClose={() => setOpen(false)} title="Geplande afstand">
        <div className="flex flex-col gap-block">
          <p className="text-body text-muted">
            {run.manualPlan
              ? 'Deze afstand heb je zelf gezet.'
              : `Voorstel van de app: ${fmt(run.plannedKm)} km.`}{' '}
            Je mag hier zetten wat je wilt — de app rekent mee en houdt je niet tegen.
          </p>
          <div className="flex flex-col gap-in-block">
            <Caps>Gepland</Caps>
            <Stepper
              value={km}
              onChange={setKm}
              step={0.5}
              decimals={1}
              suffix="km"
              max={60}
              ariaLabel="Geplande afstand"
            />
            {/* de context rekent live mee met wat er in de stepper staat */}
            <p className="text-meta text-dim">{runContext(state, iso, run.kind, km)}</p>
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => {
              A.setPlannedRunKm(iso, run.kind, km)
              setOpen(false)
            }}
          >
            Opslaan
          </button>
          {run.manualPlan && (
            <button
              className="btn-quiet w-full"
              onClick={() => {
                A.clearPlannedRunKm(iso)
                setOpen(false)
              }}
            >
              Terug naar het voorstel van de app
            </button>
          )}
        </div>
      </Sheet>
    </div>
  )
}

/* -------------------------------------------------------------------------
 * Bijsturing
 * ---------------------------------------------------------------------- */

/**
 * Wat de app vandaag heeft bijgestuurd, in de woorden die de logica zelf gebruikt.
 *
 * Er wordt hier geen tekst bedacht: dit zijn de bestaande guardrails, de notities
 * van de dag en de redenen achter de loopafstand. Waar een melding iets op te lossen
 * heeft, staat de knop ernaast — een waarschuwing zonder uitweg is een verwijt.
 * Is er niets, dan valt het blok volledig weg.
 */
function Bijsturing({ plan }: { plan: DayPlan }) {
  const state = useStore()
  const [moveFrom, setMoveFrom] = useState<{ date: string; what: MoveWhat } | null>(null)

  // buildDay zet elke guardrail ook in de notities; de guardrail zelf voegt de knoppen toe
  const acties = new Map(plan.guardrails.filter((g) => g.move || g.dismissKey).map((g) => [g.text, g]))
  const regels = [...plan.notes]
  if (plan.run && !plan.run.bike) {
    for (const w of plan.run.why) if (!regels.includes(w)) regels.push(w)
  }
  if (regels.length === 0) return null

  return (
    <div className="mt-block flex flex-col gap-in-block">
      <Caps tone="accent">Bijgestuurd</Caps>
      {regels.map((tekst, i) => {
        const g = acties.get(tekst)
        return (
          <div key={i} className="flex flex-col gap-in-block">
            <p className="quote">{tekst}</p>
            {g ? (
              <div className="flex gap-meta">
                {g.move && <Link onClick={() => setMoveFrom(g.move!)}>Verplaatsen</Link>}
                {g.dismissKey && (
                  <Link onClick={() => A.dismissWarning(g.dismissKey!, plan.date)}>Niet meer tonen</Link>
                )}
              </div>
            ) : null}
          </div>
        )
      })}

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
    </div>
  )
}

/**
 * De deloadweek, en het overslaan daarvan.
 *
 * Overslaan kan, maar niet met één tik: eerst het risico aanvinken, dan pas de knop.
 * Dat is bewust ongemakkelijk — een deload die je wegklikt omdat hij in de weg staat is
 * precies de deload die je nodig had.
 */
function DeloadBlok({ iso, plan }: { iso: string; plan: DayPlan }) {
  const [open, setOpen] = useState(false)
  const [gelezen, setGelezen] = useState(false)
  const deload = plan.deload

  if (!deload.reason) return null

  return (
    <div className="mt-block flex flex-col gap-in-block">
      <Caps tone={deload.active ? 'accent' : 'dim'}>
        {deload.active ? 'Deloadweek' : 'Deload overgeslagen'}
      </Caps>
      <p className="quote">{deload.explanation}</p>
      {deload.active ? (
        <Link onClick={() => setOpen(true)}>Deload overslaan</Link>
      ) : (
        <Link onClick={() => A.undoSkipDeload(iso)}>Toch de deload doen</Link>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Deload overslaan">
        <p className="mb-block text-body text-muted">{DELOAD_RISK}</p>
        <ConfirmCheck checked={gelezen} onToggle={() => setGelezen((v) => !v)}>
          Ik heb het risico gelezen en sla de deload bewust over
        </ConfirmCheck>
        <div className="mt-block flex flex-col gap-in-block">
          <button
            className="btn-primary w-full disabled:opacity-40"
            disabled={!gelezen}
            onClick={() => {
              A.skipDeload(iso, gelezen)
              setGelezen(false)
              setOpen(false)
            }}
          >
            Deload overslaan
          </button>
          <button className="btn-quiet w-full" onClick={() => setOpen(false)}>
            Annuleren
          </button>
        </div>
      </Sheet>
    </div>
  )
}

/* -------------------------------------------------------------------------
 * Hoe ligt de dag
 * ---------------------------------------------------------------------- */

/**
 * De check-in, in één blok: slaap en energie op een schaal van drie, benen en pezen
 * op een schaal van vijf. Alles optioneel en direct opgeslagen — geen bevestigknop.
 *
 * Slaap en energie voeden de deloadbeslissing, benen en pezen sturen het programma
 * van vandaag. Ze horen bij elkaar op het scherm omdat je ze in één beweging invult.
 */
function Dagcheck({ iso, checkin }: { iso: string; checkin: number | undefined }) {
  const state = useStore()
  const check = state.dayChecks?.[iso]

  return (
    <div className="mt-block flex flex-col gap-checkin-row">
      <Caps>Hoe ligt de dag?</Caps>

      {(
        [
          { part: 'sleep' as const, label: 'Slaap' },
          { part: 'energy' as const, label: 'Energie' },
        ]
      ).map(({ part, label }) => (
        <Segments<DayScore>
          key={part}
          label={label}
          options={DAY_SCORES}
          value={check?.[part]}
          onChange={(v) => v !== undefined && A.setDayCheckPart(iso, part, v)}
        />
      ))}

      <Segments<number>
        label="Benen"
        options={[1, 2, 3, 4, 5].map((n) => ({ id: n, label: n }))}
        value={checkin}
        clearable
        onChange={(v) => (v === undefined ? A.clearCheckin(iso) : A.setCheckin(iso, v))}
      />

      <div className="flex items-baseline justify-between gap-column">
        <p className="text-meta text-dim">Benen en pezen: 1 = brak · 5 = fris</p>
        {check ? <Link onClick={() => A.clearDayCheck(iso)}>Wissen</Link> : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------
 * De tweede sessie van de dag
 * ---------------------------------------------------------------------- */

/**
 * Staat er naast de loop ook nog kracht, dan krijgt die één regel: wat het is en de
 * weg erheen. De primaire knop onderin blijft van de loop — die komt eerst.
 */
function TweedeSessie({
  iso,
  plan,
  onOpenSession,
}: {
  iso: string
  plan: DayPlan
  onOpenSession: (date: string, kind: DayKind) => void
}) {
  const s = plan.strength
  if (!s || !plan.run || plan.run.skipped) return null

  const meta = [
    s.optional ? 'optioneel' : null,
    `${s.slots.length} oefeningen`,
    `~${s.estimatedMin} min`,
    s.short ? 'korte versie' : null,
    s.done ? 'gedaan' : null,
  ].filter(Boolean)

  return (
    <div className="mt-block border-t-hair border-rule pt-block">
      <div className="flex items-center justify-between gap-column">
        <div className="flex min-w-0 flex-col gap-tight">
          <div className="truncate text-body text-ink">Ook vandaag · {s.naam}</div>
          <div className="text-meta text-dim">{meta.join(' · ')}</div>
        </div>
        <Link onClick={() => onOpenSession(iso, s.kind)}>Bekijk</Link>
      </div>
    </div>
  )
}

/**
 * Alles wat je buiten het schema om gedaan hebt. Staat er elke dag, ook op een
 * rustdag en ook als de geplande sessie al afgerond is.
 */
function ExtraActiviteiten({ iso }: { iso: string }) {
  const state = useStore()
  const items = activitiesOn(state, iso)
  const [sheet, setSheet] = useState<{ activity?: Activity } | null>(null)

  return (
    <div className="mt-block border-t-hair border-rule pt-block">
      <div className="flex items-baseline justify-between gap-column">
        <Caps>Extra activiteiten</Caps>
        <Link onClick={() => setSheet({})}>Toevoegen</Link>
      </div>

      {items.length === 0 ? (
        <Empty>Nog niets extra gelogd vandaag.</Empty>
      ) : (
        <div className="mt-in-block">
          <ActivityList items={items} onEdit={(a) => setSheet({ activity: a })} />
        </div>
      )}

      <ActivitySheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        date={iso}
        activity={sheet?.activity}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------
 * De actiezone
 * ---------------------------------------------------------------------- */

/**
 * De knop waar het vandaag om draait, met alles wat je verder met de sessie kunt
 * achter één knop ernaast. Het ontwerp geeft die zone twee plaatsen; de app heeft
 * meer acties dan dat, dus de rest zit in een blad in plaats van in een rij knopjes
 * die het duimbereik opeten.
 */
function TodayActions({
  iso,
  plan,
  onOpenSession,
}: {
  iso: string
  plan: DayPlan
  onOpenSession: (date: string, kind: DayKind) => void
}) {
  const run = plan.run
  const s = plan.strength

  if (run?.skipped) {
    return (
      <Actions>
        <Primary onClick={() => A.undoSkip(iso, 'run')}>Loop toch doen</Primary>
      </Actions>
    )
  }
  if (run && !run.done) return <RunActions iso={iso} plan={plan} />
  if (s?.skipped) {
    return (
      <Actions>
        <Primary onClick={() => A.undoSkip(iso, 'strength')}>{s.naam} toch doen</Primary>
      </Actions>
    )
  }
  if (s) return <StrengthActions iso={iso} plan={plan} onOpenSession={onOpenSession} />

  if (plan.movedTo || plan.runMovedTo) {
    const wat = plan.movedTo ? 'strength' : 'run'
    const datum = plan.movedTo ?? plan.runMovedTo!
    return (
      <Actions>
        <Primary onClick={() => (wat === 'run' ? A.undoRunMove(iso) : A.undoMove(iso))}>
          Terughalen van {formatShort(datum)}
        </Primary>
      </Actions>
    )
  }
  return null
}

function RunActions({ iso, plan }: { iso: string; plan: DayPlan }) {
  const state = useStore()
  const run = plan.run!
  const [meer, setMeer] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [km, setKm] = useState(run.km)
  const [min, setMin] = useState(Math.round(run.km * 6))
  // de doellijst rekent per dag door wat een verplaatsing zou betekenen; dat gebeurt pas
  // als de lijst open gaat, niet bij elke render van dit scherm
  const targets = useMemo(() => (moveOpen ? moveTargets(state, iso, 'run') : []), [moveOpen, state, iso])
  const kanVerplaatsen = canMove(state, iso, 'run')

  return (
    <>
      <Actions>
        <Primary
          onClick={() => {
            setKm(run.bike ? 0 : run.km)
            setMin(run.bike ? BIKE_MINUTES : Math.round(run.km * 6))
            setLogOpen(true)
          }}
        >
          {run.bike ? 'Fietsen afvinken' : 'Loop afvinken'}
        </Primary>
        <Secondary onClick={() => setMeer(true)}>Meer</Secondary>
      </Actions>

      <Sheet open={meer} onClose={() => setMeer(false)} title={run.bike ? 'Fietsen' : 'De loop'}>
        <div className="flex flex-col gap-in-block">
          <button className="btn-ghost w-full" onClick={() => A.setBike(iso, !run.bike)}>
            {run.bike ? 'Toch lopen' : 'Fiets in plaats van lopen'}
          </button>
          <button
            className="btn-ghost w-full disabled:opacity-40"
            disabled={!kanVerplaatsen}
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

      <Sheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title={run.bike ? 'Fietsen loggen' : 'Loop loggen'}
      >
        <div className="flex flex-col gap-block">
          {!run.bike && (
            <div className="flex flex-col gap-in-block">
              <Caps>Werkelijk gelopen</Caps>
              <Stepper
                value={km}
                onChange={setKm}
                step={0.5}
                decimals={1}
                suffix="km"
                max={60}
                ariaLabel="Gelopen kilometers"
              />
              <p className="text-meta text-dim">
                Gepland was {fmt(run.km)} km. Dit getal — wat je écht gelopen hebt — is
                waar de opbouw van de komende weken op rekent.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-in-block">
            <Caps>Duur — optioneel</Caps>
            <Stepper
              value={min}
              onChange={setMin}
              step={5}
              max={300}
              suffix="min"
              ariaLabel="Duur in minuten"
            />
            {!run.bike && km > 0 && min > 0 && (
              <p className="text-meta text-dim">Tempo {paceMinPerKm(km, min)}</p>
            )}
          </div>
          {/* dezelfde afsluitende beoordeling als bij kracht: één tik, en het staat erin */}
          <div className="flex flex-col gap-in-block">
            <Caps>Hoe ging het?</Caps>
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
    </>
  )
}

function StrengthActions({
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
  const [meer, setMeer] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const targets = useMemo(() => (moveOpen ? moveTargets(state, iso) : []), [moveOpen, state, iso])
  const kanVerplaatsen = canMove(state, iso)

  return (
    <>
      <Actions>
        <Primary onClick={() => onOpenSession(iso, s.kind)}>
          {s.done ? 'Sessie bekijken' : 'Start sessie'}
        </Primary>
        <Secondary onClick={() => setMeer(true)}>Meer</Secondary>
      </Actions>

      <Sheet open={meer} onClose={() => setMeer(false)} title={s.naam}>
        <div className="flex flex-col gap-in-block">
          {s.log?.feel && (
            <p className="text-body text-muted">
              Beoordeeld als {feelLabel(s.log.feel).toLowerCase()}.
            </p>
          )}
          <button className="btn-ghost w-full" onClick={() => A.setShortVersion(iso, !s.short)}>
            {s.short ? 'Volledige versie' : 'Korte versie'}
          </button>
          <button
            className="btn-ghost w-full disabled:opacity-40"
            disabled={!kanVerplaatsen}
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
    </>
  )
}

function SkipSheet({
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
      <p className="mb-block text-body text-muted">Wordt gelogd, verder geen gevolgen.</p>
      <ChoiceGrid columns={2} options={REASONS} onChange={onPick} />
    </Sheet>
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
        <span className="mt-tight block">
          Volgende sessie: {formatShort(date)} — {delen.join(' + ')}.
        </span>
      )
    }
  }
  return null
}
