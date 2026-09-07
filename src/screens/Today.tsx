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
import { activitiesOn } from '../logic/activities'
import {
  buildDay,
  canMove,
  moveTargets,
  type DayPlan,
  type MoveWhat,
  type PickUpConflict,
  type PickUpResolve,
} from '../logic/day'
import { formatLong, formatShort, addDays, today } from '../logic/dates'
import { missedSessions, type Missed } from '../logic/gemist'
import { SKIP_CHOICES, SKIP_LABEL } from '../logic/skips'
import { trainingStreak } from '../logic/stats'
import { BIKE_MINUTES } from '../logic/running'
import { fmt, runContext, weekRunFacts } from '../logic/runningLoad'
import { DAY_SCORES, feelLabel } from '../logic/feel'
import { DELOAD_RISK } from '../logic/deload'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { Activity, DayKind, DayScore, SkipReason } from '../types'

/**
 * Vandaag: één pagina, van boven naar beneden te lezen. Bovenaan wat er op het
 * programma staat, daaronder waarom het is wat het is, dan de check-in, en onderin
 * — binnen duimbereik — de knop waar je op drukt.
 */
export function Today({
  onOpenSession,
  onOpenRun,
}: {
  onOpenSession: (date: string, kind: DayKind) => void
  onOpenRun: (date: string) => void
}) {
  const state = useStore()
  const iso = today()
  const plan = buildDay(state, iso)
  const stats = useStats(plan)
  const leeg = !plan.isRest && !plan.run && !plan.strength && !plan.movedTo && !plan.runMovedTo

  return (
    <Screen
      action={
        <TodayActions iso={iso} plan={plan} onOpenSession={onOpenSession} onOpenRun={onOpenRun} />
      }
    >
      <TopLine left={formatLong(plan.date)} right={<Markeringen plan={plan} />} />
      <Rule className="my-block" />

      <NogOpen iso={iso} onOpenSession={onOpenSession} onOpenRun={onOpenRun} />

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
      <NietVandaag iso={iso} plan={plan} />
      <Verplaatst plan={plan} />
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
    if (run.bike) return <Getal lead={van('Fietsen', run.movedFrom)} value={String(BIKE_MINUTES)} unit="min" />
    if (run.free) {
      return (
        <Titel lead={run.movedFrom ? van('', run.movedFrom) : undefined}>
          {run.kind === 'long' ? 'Duurloop' : 'Hardlopen'}
        </Titel>
      )
    }
    return (
      <Getal
        lead={van(run.kind === 'long' ? 'Duurloop' : 'Korte loop', run.movedFrom)}
        value={fmt(run.km)}
        unit="km"
      />
    )
  }

  if (s && !s.skipped) return <Titel lead={van('Krachtsessie', s.movedFrom)}>{s.naam}</Titel>

  if (run?.skipped) {
    return <Titel lead={SKIP_LABEL[run.skipped]}>Loop overgeslagen</Titel>
  }
  if (s?.skipped) {
    return <Titel lead={SKIP_LABEL[s.skipped]}>{s.naam} overgeslagen</Titel>
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

/**
 * De regel boven de kop, met erbij waar de sessie vandaan komt als hij niet van vandaag
 * is. Verplaatst of vandaag opgepakt maakt geen verschil: in beide gevallen doe je hier
 * iets dat oorspronkelijk op een andere dag stond, en dat hoor je te zien.
 */
function van(basis: string, movedFrom: string | null): string {
  if (!movedFrom) return basis
  const herkomst = `van ${formatShort(movedFrom)}`
  return basis ? `${basis} · ${herkomst}` : herkomst
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
    // Feitelijk, geen richtlijn: hoe vaak en hoeveel er deze week gelopen is. De app
    // heeft geen mening meer over wat daar had moeten staan.
    const week = weekRunFacts(state, plan.date)
    items.push({
      label: 'Deze week',
      value: `${week.aantal}×`,
      suffix: ` / ${fmt(week.km)} km`,
      flex: 1.4,
    })
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
 * Nog open: een gemiste sessie vandaag oppakken
 * ---------------------------------------------------------------------- */

/**
 * Wat er van eerdere dagen nog open staat, boven de sessie van vandaag.
 *
 * Het stond er wel — op de planpagina, als "Nog in te vullen" — maar dat is een andere
 * vraag. Invullen zegt "dit deed ik toen"; hier staat de vraag die je op dinsdag stelt
 * als je zondag hebt laten lopen: kan ik hem alsnog dóén? Dat is een verplaatsing naar
 * vandaag, en dus logt hij op vandaag en telt hij gewoon mee.
 *
 * Drie keuzes per regel, in de volgorde waarin ze waarschijnlijk zijn. Alleen de eerste
 * is oker: er staat er maar één voorop.
 */
function NogOpen({
  iso,
  onOpenSession,
  onOpenRun,
}: {
  iso: string
  onOpenSession: (date: string, kind: DayKind) => void
  onOpenRun: (date: string) => void
}) {
  const state = useStore()
  const gemist = missedSessions(state, iso)
  const [conflict, setConflict] = useState<{ m: Missed; met: PickUpConflict } | null>(null)
  const [skipFor, setSkipFor] = useState<Missed | null>(null)
  const [melding, setMelding] = useState<string[] | null>(null)

  if (gemist.length === 0) return null

  const oppakken = (m: Missed, resolve?: PickUpResolve) => {
    const res = A.pickUpToday(m.date, m.what, resolve)
    if (res.ok) {
      setConflict(null)
      // de guardrails houden niets tegen, maar je hoort ze wel te lezen
      if (res.warnings.length > 0) setMelding(res.warnings)
      return
    }
    if (res.conflict) setConflict({ m, met: res.conflict })
  }

  return (
    <div className="mb-block flex flex-col gap-in-block">
      <Caps tone="accent">Nog open</Caps>
      {gemist.map((m) => (
        <div key={`${m.date}:${m.what}`} className="flex flex-col gap-tight">
          <p className="min-w-0 truncate text-body text-muted">
            {formatShort(m.date)} · {m.naam}
          </p>
          <div className="flex flex-wrap gap-column">
            <Link onClick={() => oppakken(m)}>Vandaag doen</Link>
            <Link
              tone="quiet"
              onClick={() => (m.what === 'run' ? onOpenRun(m.date) : onOpenSession(m.date, m.kind!))}
            >
              Achteraf invullen
            </Link>
            <Link tone="quiet" onClick={() => setSkipFor(m)}>
              Overslaan
            </Link>
          </div>
        </div>
      ))}

      {conflict && (
        <Sheet open onClose={() => setConflict(null)} title="Er staat vandaag al iets">
          <p className="mb-block text-body text-muted">
            Vandaag staat al {conflict.met.naam}. Er kan er maar één staan, dus die van vandaag
            wijkt — doorschuiven of overslaan.
          </p>
          <div className="flex flex-col gap-in-block">
            {conflict.met.shiftTo ? (
              <button className="btn-ghost w-full" onClick={() => oppakken(conflict.m, 'shift')}>
                Doorschuiven naar {formatShort(conflict.met.shiftTo)}
              </button>
            ) : (
              <p className="quote">
                Doorschuiven kan niet: er is deze week geen dag meer vrij, of {conflict.met.naam}{' '}
                staat hier zelf al als verplaatsing.
              </p>
            )}
            <button className="btn-quiet w-full" onClick={() => oppakken(conflict.m, 'skip')}>
              {conflict.met.naam} overslaan
            </button>
          </div>
        </Sheet>
      )}

      {melding && (
        <Sheet open onClose={() => setMelding(null)} title="Opgepakt">
          <div className="flex flex-col gap-in-block">
            {melding.map((w, i) => (
              <p key={i} className="quote">
                {w}
              </p>
            ))}
            <p className="text-meta text-dim">
              Dit houdt je niet tegen; het staat er zodat je weet wat je vandaag op je bord hebt.
            </p>
          </div>
        </Sheet>
      )}

      <SkipSheet
        open={skipFor !== null}
        onClose={() => setSkipFor(null)}
        onPick={(r) => {
          if (skipFor) A.skipSession(skipFor.date, skipFor.what, r)
          setSkipFor(null)
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------
 * De loopafstand
 * ---------------------------------------------------------------------- */

/**
 * De afstand van vandaag: die zet je zelf, of je zet hem niet.
 *
 * De app rekende hier ooit een afstand voor en kapte hem af op wat het gemiddelde
 * toestond. Dat werkte averechts — minder lopen verlaagde het gemiddelde, en daarmee het
 * plafond, en daarmee de volgende afstand. Nu staat er alleen wat jij invult, met
 * eronder wat de app ziet: hoe die afstand zich verhoudt tot je gemiddelde loop van deze
 * soort en tot je langste loop. Verder heeft ze er geen mening over.
 */
function Loopafstand({ iso, plan }: { iso: string; plan: DayPlan }) {
  const state = useStore()
  const run = plan.run
  const [open, setOpen] = useState(false)
  const [km, setKm] = useState(0)

  if (!run || run.skipped || run.bike) return null

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
              : 'De app schrijft geen afstand voor. Zet hier wat je van plan bent, of laat het leeg.'}{' '}
            De app rekent mee en houdt je nergens tegen.
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
              A.setPlannedRunKm(iso, km)
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
              Afstand weghalen
            </button>
          )}
        </div>
      </Sheet>
    </div>
  )
}

/* -------------------------------------------------------------------------
 * Niet vandaag: verplaatsen
 * ---------------------------------------------------------------------- */

/**
 * Verplaatsen, op de plek waar je het zoekt.
 *
 * Het zat er al — in het blad achter "Meer" onderin, en als knop bij een bijsturing die
 * zelden vuurt. Daarmee was het er wel en vond niemand het: wie op donderdag ziet dat het
 * niet gaat lukken, kijkt naar de sessie die op het scherm staat en niet naar een knop
 * die "Meer" heet. Dus staat het nu ook gewoon in de pagina, per ding dat er die dag
 * staat, met dezelfde MoveSheet eronder.
 */
function NietVandaag({ iso, plan }: { iso: string; plan: DayPlan }) {
  const state = useStore()
  const [moveFrom, setMoveFrom] = useState<MoveWhat | null>(null)
  const targets = useMemo(
    () => (moveFrom ? moveTargets(state, iso, moveFrom) : []),
    [moveFrom, state, iso],
  )

  const run = plan.run
  const s = plan.strength
  const regels: { what: MoveWhat; naam: string }[] = []
  if (run && !run.done && !run.skipped) {
    regels.push({ what: 'run', naam: run.bike ? 'Fietsen' : run.kind === 'long' ? 'Duurloop' : 'Korte loop' })
  }
  if (s && !s.done && !s.skipped) regels.push({ what: 'strength', naam: s.naam })
  if (regels.length === 0) return null

  return (
    <div className="mt-block flex flex-col gap-in-block">
      <Caps>Niet vandaag?</Caps>
      {regels.map((r) => (
        <div key={r.what} className="flex items-baseline justify-between gap-column">
          <p className="min-w-0 truncate text-body text-muted">{r.naam}</p>
          <Link
            disabled={!canMove(state, iso, r.what)}
            onClick={() => setMoveFrom(r.what)}
          >
            Verplaatsen
          </Link>
        </div>
      ))}

      {moveFrom && (
        <MoveSheet
          open
          onClose={() => setMoveFrom(null)}
          targets={targets}
          hint={`${
            moveFrom === 'run'
              ? 'De krachtsessie van vandaag blijft staan.'
              : 'De loop van vandaag blijft staan; die verplaats je apart.'
          }${restDayHint(programFor(state))}`}
          onPick={(target) => {
            if (moveFrom === 'run') A.moveRun(iso, target)
            else A.moveSession(iso, target)
            setMoveFrom(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * Wat er van vandaag ergens anders is gaan staan, met de datum erbij.
 *
 * Alleen als er van die soort vandaag ook echt niets meer staat. Bij een ruil — en een
 * gemiste sessie die je vandaag oppakt is er een — klopt "verplaatst naar" wel, maar het
 * leest als "hier is niets meer", terwijl er juist iets anders voor in de plaats staat.
 */
function Verplaatst({ plan }: { plan: DayPlan }) {
  const loop = plan.runMovedTo && !plan.run
  const kracht = plan.movedTo && !plan.strength
  if (!loop && !kracht) return null
  return (
    <div className="mt-block flex flex-col gap-in-block">
      <Caps>Verplaatst</Caps>
      {loop && <p className="quote">Loop verplaatst naar {formatShort(plan.runMovedTo!)}.</p>}
      {kracht && (
        <p className="quote">Krachtsessie verplaatst naar {formatShort(plan.movedTo!)}.</p>
      )}
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
  const acties = new Map(plan.guardrails.filter((g) => g.move).map((g) => [g.text, g]))
  const regels = [...plan.notes]
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
    s.movedFrom ? `van ${formatShort(s.movedFrom)}` : null,
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
  onOpenRun,
}: {
  iso: string
  plan: DayPlan
  onOpenSession: (date: string, kind: DayKind) => void
  onOpenRun: (date: string) => void
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
  if (run && !run.done) return <RunActions iso={iso} plan={plan} onOpenRun={onOpenRun} />
  if (s?.skipped) {
    return (
      <Actions>
        <Primary onClick={() => A.undoSkip(iso, 'strength')}>{s.naam} toch doen</Primary>
      </Actions>
    )
  }
  if (s) return <StrengthActions iso={iso} plan={plan} onOpenSession={onOpenSession} />
  // de loop is af en er staat verder niets: hem terugzien en bijstellen kan nog steeds
  if (run?.done) return <RunActions iso={iso} plan={plan} onOpenRun={onOpenRun} />

  if (plan.movedTo || plan.runMovedTo) {
    const wat = plan.movedTo ? 'strength' : 'run'
    return (
      <Actions>
        <Primary onClick={() => (wat === 'run' ? A.undoRunMove(iso) : A.undoMove(iso))}>
          Verplaatsing ongedaan maken
        </Primary>
      </Actions>
    )
  }
  return null
}

function RunActions({
  iso,
  plan,
  onOpenRun,
}: {
  iso: string
  plan: DayPlan
  onOpenRun: (date: string) => void
}) {
  const state = useStore()
  const run = plan.run!
  const [meer, setMeer] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  // de doellijst rekent per dag door wat een verplaatsing zou betekenen; dat gebeurt pas
  // als de lijst open gaat, niet bij elke render van dit scherm
  const targets = useMemo(() => (moveOpen ? moveTargets(state, iso, 'run') : []), [moveOpen, state, iso])
  const kanVerplaatsen = canMove(state, iso, 'run')

  return (
    <>
      <Actions>
        <Primary onClick={() => onOpenRun(iso)}>
          {run.done ? 'Loop bekijken' : run.bike ? 'Start fietsen' : 'Start loop'}
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
      <ChoiceGrid columns={2} options={SKIP_CHOICES} onChange={onPick} />
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
