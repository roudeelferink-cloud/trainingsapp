import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { FigurePair } from '../components/Figure'
import {
  Actions,
  Caps,
  Link,
  Primary,
  Screen,
  Secondary,
  Segments,
  TopLine,
} from '../components/logboek'
import { RestTimer } from '../components/RestTimer'
import { ChoiceGrid, Chip, Sheet, Stepper, formatDecimal } from '../components/ui'
import { LOAD_LABEL } from '../data/exercises'
import { getFigure } from '../data/figures'
import { MAX_BAND_LEVEL, MIN_BAND_LEVEL, bandLabel, isBandExercise, levelOf } from '../logic/band'
import { barTotalLabel, barWeightFor, platesFromTotal, totalFromPlates } from '../logic/barWeight'
import { buildDay } from '../logic/day'
import { formatShort } from '../logic/dates'
import { DUMBBELL_WEIGHT_UNIT, isDumbbell } from '../logic/dumbbell'
import { loadHint, repsHint, repsInputLabel, weightInputLabel } from '../logic/load'
import { ORDER_CATEGORY_LABEL, ORDER_RATIONALE } from '../logic/order'
import { WARMUP_HINT, WARMUP_TYPES, warmupLabel } from '../logic/warmup'
import { FEELS } from '../logic/feel'
import { CALIBRATION_TEXT, fmt, targetFor, type Target } from '../logic/progression'
import { swapCandidates, type ResolvedSlot } from '../logic/select'
import {
  checkSet,
  editIndex,
  isLastSlot,
  seedSets,
  sessionSteps,
  stepAfter,
  stepBefore,
  stepMark,
  uncheckSet,
} from '../logic/sessionFlow'
import { programFor } from '../data/programs'
import { ADVICE_HINT, startWeightAdvice } from '../logic/startWeight'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { UserState, DayKind, Exercise, LoggedSet, Settings, Warmup } from '../types'

/**
 * Rustduur per soort oefening, in seconden. Een kernoefening vraagt meer hersteltijd
 * dan een aanvullende; dit zijn de waarden waar de timer op start.
 */
const REST_CORE = 150
const REST_ACCESSORY = 90

/** De warming-up is de eerste stap van de sessie, niet een zevende oefening. */
const WARMUP_STEP = 'warmup'

/**
 * Sessie: één ding tegelijk.
 *
 * Eerst de warming-up, dan oefening voor oefening. Er is geen navigatiebalk — tijdens
 * een sessie telt maar één ding, en die balk zou je er per ongeluk uit tikken. Wat je
 * tussen sets aanraakt (de steppers, de knop) staat onderin binnen duimbereik.
 */
export function SessionScreen({
  date,
  kind,
  onClose,
}: {
  date: string
  kind: DayKind
  onClose: () => void
}) {
  const state = useStore()
  const plan = buildDay(state, date)
  const strength = plan.strength && plan.strength.kind === kind ? plan.strength : null
  const slots = strength?.slots ?? []

  // een sessie begint bij de warming-up; kom je terug, dan bij waar je gebleven was
  const [step, setStep] = useState<string>(() => {
    if (!strength?.warmup.done) return WARMUP_STEP
    const af = strength.log?.completedSlots ?? []
    return (slots.find((r) => !af.includes(r.slot.key)) ?? slots[0])?.slot.key ?? WARMUP_STEP
  })
  const [helpFor, setHelpFor] = useState<Exercise | null>(null)
  const [optionsFor, setOptionsFor] = useState<ResolvedSlot | null>(null)
  const [lijstOpen, setLijstOpen] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)
  const [orderHelp, setOrderHelp] = useState(false)
  const [messages, setMessages] = useState<string[] | null>(null)
  const [completed, setCompleted] = useState<string[]>(() => strength?.log?.completedSlots ?? [])
  const [rest, setRest] = useState<{ endsAt: number; total: number; label: string } | null>(null)
  const [justChecked, setJustChecked] = useState<number | null>(null)
  /*
    De set die je zelf hebt aangetikt om bij te stellen. Blijft alleen staan zolang je op
    dezelfde oefening bent: bij het wisselen van oefening is er weer geen keuze gemaakt en
    pakt de invoer vanzelf de set waar je aan toe bent.
  */
  const [gekozenSet, setGekozenSet] = useState<{ key: string; index: number } | null>(null)

  const signature = `${date}|${kind}|${slots.map((s) => `${s.slot.key}:${s.exercise.id}:${s.sets}`).join(',')}`

  const seed = useCallback((): Record<string, LoggedSet[]> => {
    const out: Record<string, LoggedSet[]> = {}
    for (const r of slots) {
      const existing = strength?.log?.entries?.[r.slot.key]
      if (existing && existing.length && strength?.log?.exercises?.[r.slot.key] === r.exercise.id) {
        out[r.slot.key] = existing
        continue
      }
      const t = targetFor(r.exercise, r.repMin, state, {
        calibration: plan.cycle.calibration,
        deload: plan.deload.active,
      })
      out[r.slot.key] = seedSets(r.sets, t, adviceFor(r, state, plan.cycle.calibration))
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const [entries, setEntries] = useState<Record<string, LoggedSet[]>>(seed)
  const [seenSignature, setSeenSignature] = useState(signature)

  if (signature !== seenSignature) {
    const fresh = seed()
    for (const [k, v] of Object.entries(entries)) {
      if (fresh[k] && v.some((s) => s.done)) fresh[k] = v
    }
    setSeenSignature(signature)
    setEntries(fresh)
  }

  /** Naar een andere stap. De setkeuze hoort bij de oefening die je verlaat. */
  function gaNaar(key: string) {
    setGekozenSet(null)
    setRest(null)
    setStep(key)
  }

  // is de open oefening weggevallen (gewisseld, korte versie), pak dan de eerste
  const eersteKey = slots[0]?.slot.key ?? WARMUP_STEP
  useEffect(() => {
    if (step !== WARMUP_STEP && !slots.some((r) => r.slot.key === step)) setStep(eersteKey)
  }, [eersteKey, slots, step])

  if (!strength || slots.length === 0) {
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
          <TopLine left="Sessie" />
          <p className="quote mt-block">Er staat geen sessie meer open op {formatShort(date)}.</p>
        </Screen>
      </Full>
    )
  }

  const index = slots.findIndex((r) => r.slot.key === step)
  const resolved = index === -1 ? null : slots[index]

  function persistDraft(nextEntries: Record<string, LoggedSet[]>, nextCompleted: string[]) {
    A.saveSessionDraft(
      date,
      kind,
      nextEntries,
      Object.fromEntries(slots.map((x) => [x.slot.key, x.exercise.id])),
      strength!.short,
      nextCompleted,
    )
  }

  /** Niet ingevuld gewicht valt terug op de schatting die in het veld stond. */
  function effectiveEntries(): Record<string, LoggedSet[]> {
    const out: Record<string, LoggedSet[]> = {}
    for (const r of slots) {
      const advice = adviceFor(r, state, plan.cycle.calibration)
      out[r.slot.key] = (entries[r.slot.key] ?? []).map((s) =>
        s.weight === 0 && advice ? { ...s, weight: advice.weight } : s,
      )
    }
    return out
  }

  function updateSet(slotKey: string, i: number, patch: Partial<LoggedSet>) {
    setEntries((cur) => {
      const arr = [...(cur[slotKey] ?? [])]
      arr[i] = { ...arr[i], ...patch }
      const next = { ...cur, [slotKey]: arr }
      persistDraft(next, completed)
      return next
    })
  }

  function setSetDone(slotKey: string, i: number, done: boolean) {
    setEntries((cur) => {
      const arr = done ? checkSet(cur[slotKey] ?? [], i) : uncheckSet(cur[slotKey] ?? [], i)
      const next = { ...cur, [slotKey]: arr }
      persistDraft(next, completed)
      return next
    })
  }

  function addSet(slotKey: string) {
    setEntries((cur) => {
      const arr = [...(cur[slotKey] ?? [])]
      const last = arr[arr.length - 1]
      arr.push(last ? { ...last, done: false } : { weight: 0, reps: 0, rir: 2, done: false })
      const next = { ...cur, [slotKey]: arr }
      persistDraft(next, completed)
      return next
    })
  }

  function markeerAf(key: string, af: boolean) {
    const next = af ? [...completed, key] : completed.filter((k) => k !== key)
    setCompleted(next)
    persistDraft(entries, next)
    return next
  }

  /**
   * Naar de volgende oefening in de sessie, of — op de laatste — naar het afrondblad.
   *
   * Bewust de volgende in de lijst en niet de volgende openstaande: na een terugsprong
   * naar oefening 1 wil je bij 2 uitkomen, niet bij het einde van de sessie.
   */
  function volgende(vanaf: number) {
    const doel = slots[vanaf + 1]
    if (doel) gaNaar(doel.slot.key)
    else setDoneOpen(true)
  }

  const sets = resolved ? (entries[resolved.slot.key] ?? []) : []
  const actieveSet = sets.findIndex((s) => !s.done)
  const afgerond = resolved ? completed.includes(resolved.slot.key) : false
  const totalSets = slots.reduce((n, x) => n + (entries[x.slot.key]?.length ?? x.sets), 0)
  const doneSets = slots.reduce((n, x) => n + (entries[x.slot.key] ?? []).filter((s) => s.done).length, 0)

  /**
   * De voortgangssegmenten: de warming-up telt als eerste stap. Elk segment is een knop —
   * vanaf de balk spring je direct naar een oefening, ook naar eentje die je al gedaan hebt.
   */
  const afgerondeStappen = [
    ...(strength.warmup.done ? [WARMUP_STEP] : []),
    ...slots.filter((r) => completed.includes(r.slot.key)).map((r) => r.slot.key),
  ]
  const stappen = [
    { key: WARMUP_STEP, naam: 'Warming-up' },
    ...slots.map((r, i) => ({ key: r.slot.key, naam: `Oefening ${i + 1}: ${r.exercise.naam}` })),
  ]

  const kop = (
    <>
      <TopLine
        left={
          <button type="button" onClick={onClose} className="text-muted">
            ← {strength.naam}
          </button>
        }
        right={
          <button type="button" onClick={() => setLijstOpen(true)} className="text-dim">
            {step === WARMUP_STEP ? 'Warming-up' : `Oefening ${index + 1} / ${slots.length}`}
          </button>
        }
      />
      <div className="mt-in-block flex gap-progress">
        {stappen.map((s) => {
          const mark = stepMark(s.key, step, afgerondeStappen)
          return (
            <button
              key={s.key}
              type="button"
              aria-label={`Naar ${s.naam}`}
              aria-current={mark === 'current' ? 'step' : undefined}
              onClick={() => gaNaar(s.key)}
              className={`h-progress flex-1 transition-colors duration-color ${
                mark === 'current' ? 'bg-ink' : mark === 'done' ? 'bg-accent' : 'bg-chip-border'
              }`}
            />
          )
        })}
      </div>
    </>
  )

  if (step === WARMUP_STEP) {
    return (
      <Full>
        <WarmupStep
          date={date}
          kind={kind}
          plan={plan}
          strength={strength}
          kop={kop}
          orderHelp={orderHelp}
          onOrderHelp={() => setOrderHelp((x) => !x)}
          onDone={() => gaNaar(eersteKey)}
        />
        <SessieBladen
          date={date}
          kind={kind}
          slots={slots}
          entries={entries}
          completed={completed}
          strength={strength}
          doneSets={doneSets}
          totalSets={totalSets}
          lijstOpen={lijstOpen}
          setLijstOpen={setLijstOpen}
          doneOpen={doneOpen}
          setDoneOpen={setDoneOpen}
          messages={messages}
          setMessages={setMessages}
          onPick={gaNaar}
          effectiveEntries={effectiveEntries}
          onClose={onClose}
          helpFor={helpFor}
          setHelpFor={setHelpFor}
          optionsFor={optionsFor}
          setOptionsFor={setOptionsFor}
          step={step}
        />
      </Full>
    )
  }

  if (!resolved) return <Full>{null}</Full>

  const target = targetFor(resolved.exercise, resolved.repMin, state, {
    calibration: plan.cycle.calibration,
    deload: plan.deload.active,
  })
  const advice = adviceFor(resolved, state, plan.cycle.calibration)
  const bar = barWeightFor(resolved.exercise, state.settings)
  const advicePlates =
    advice === null ? undefined : bar > 0 ? platesFromTotal(advice.weight, bar) : advice.weight
  const rustSeconden = resolved.slot.role === 'core' ? REST_CORE : REST_ACCESSORY
  const huidige = actieveSet === -1 ? null : sets[actieveSet]
  /*
    Welke set de steppers bewerken: de set die je zelf aantikte, anders de eerste die nog
    open staat, anders de laatste. Zie `editIndex` — daar staat waarom die volgorde.
  */
  const bewerkIndex = editIndex(
    sets,
    resolved && gekozenSet?.key === resolved.slot.key ? gekozenSet.index : null,
  )
  const laatsteOefening = isLastSlot(
    slots.map((r) => r.slot.key),
    resolved.slot.key,
  )
  const stapKeys = sessionSteps(WARMUP_STEP, slots.map((r) => r.slot.key))
  const vorigeStap = stepBefore(stapKeys, step)
  const volgendeStap = stepAfter(stapKeys, step)

  const primair = () => {
    if (actieveSet === -1) {
      markeerAf(resolved.slot.key, true)
      setRest(null)
      return volgende(index)
    }
    setSetDone(resolved.slot.key, actieveSet, true)
    setJustChecked(actieveSet)
    window.setTimeout(() => setJustChecked(null), 600)
    setRest({
      endsAt: Date.now() + rustSeconden * 1000,
      total: rustSeconden,
      label: `Rust na set ${actieveSet + 1}`,
    })
  }

  return (
    <Full>
      <Screen
        bottom="free"
        fill
        action={
          <div className="flex flex-col gap-block">
            {rest && (
              <RestTimer endsAt={rest.endsAt} totalSeconds={rest.total} label={rest.label} />
            )}
            <Actions>
              <Primary onClick={primair}>
                {actieveSet === -1
                  ? laatsteOefening
                    ? 'Sessie afronden'
                    : 'Volgende oefening'
                  : `Set ${actieveSet + 1} klaar`}
              </Primary>
              {actieveSet !== -1 && (
                <Secondary
                  onClick={() => {
                    // overgeslagen sets blijven niet-afgevinkt en tellen dus niet mee
                    const rest = sets.findIndex((s, i) => i > actieveSet && !s.done)
                    if (rest === -1) {
                      markeerAf(resolved.slot.key, true)
                      volgende(index)
                    } else {
                      updateSet(resolved.slot.key, actieveSet, { reps: 0 })
                      setSetDone(resolved.slot.key, actieveSet, true)
                    }
                  }}
                >
                  Sla
                  <br />
                  over
                </Secondary>
              )}
            </Actions>
          </div>
        }
      >
        {kop}

        <h1 className="mt-block font-serif text-exercise leading-exercise text-ink">
          {resolved.exercise.naam}
        </h1>

        <div className="mt-in-block flex flex-wrap gap-meta text-label text-dim">
          <span>
            {resolved.sets} sets × {repBereik(resolved)}
            {resolved.exercise.unilateral && ' p/kant'}
          </span>
          <span>rust {klokje(rustSeconden)}</span>
          {huidige && <span>RIR {huidige.rir}</span>}
        </div>

        <Toelichting
          exercise={resolved.exercise}
          settings={state.settings}
          target={target}
          advice={advice}
          bar={bar}
          kalibratie={plan.cycle.calibration}
        />

        {/*
          Vooruit en achteruit binnen de sessie. Terugbladeren zet niets terug: een
          afgeronde oefening blijft afgerond, je kunt er alleen weer bij.
        */}
        <div className="mt-in-block flex items-baseline justify-between gap-column">
          <Link onClick={() => vorigeStap && gaNaar(vorigeStap)} disabled={!vorigeStap}>
            ← Vorige
          </Link>
          <Link onClick={() => volgendeStap && gaNaar(volgendeStap)} disabled={!volgendeStap}>
            Volgende →
          </Link>
        </div>

        <div className="mt-in-block flex gap-meta">
          <Link onClick={() => setHelpFor(resolved.exercise)}>Uitleg</Link>
          <Link onClick={() => setOptionsFor(resolved)}>Aanpassen</Link>
          {afgerond && <Link onClick={() => markeerAf(resolved.slot.key, false)}>Zet terug</Link>}
        </div>

        <div className="mt-block flex flex-col">
          {sets.map((s, i) => (
            <SetRij
              key={i}
              nummer={i + 1}
              set={s}
              actief={i === actieveSet}
              bewerkt={i === bewerkIndex}
              net={justChecked === i}
              laatste={i === sets.length - 1}
              waarde={setWaarde(resolved, s, !s.done && i !== actieveSet)}
              onToggle={() => setSetDone(resolved.slot.key, i, !s.done)}
              onKies={() => setGekozenSet({ key: resolved.slot.key, index: i })}
            />
          ))}
        </div>

        <div className="mt-in-block">
          <Link onClick={() => addSet(resolved.slot.key)}>+ set toevoegen</Link>
        </div>

        {/* de invoer wordt naar onderen geduwd: daar zit je duim tussen twee sets in */}
        <div className="mt-auto flex flex-col gap-block pt-block">
          <div className="flex flex-col gap-in-block">
            <div className="flex items-baseline justify-between gap-column">
              <Caps>{weightInputLabel(resolved.exercise, state.settings)}</Caps>
              {!isBandExercise(resolved.exercise) && (
                <span className="text-caps-lg text-faint">
                  stap {formatDecimal(resolved.exercise.minIncrement || 2.5)} kg
                </span>
              )}
            </div>
            {isBandExercise(resolved.exercise) ? (
              <>
                <Stepper
                  ariaLabel={`Bandniveau set ${bewerkIndex + 1}`}
                  value={levelOf(sets[bewerkIndex] ?? { weight: 0 })}
                  onChange={(v) => updateSet(resolved.slot.key, bewerkIndex, { weight: 0, level: v })}
                  step={1}
                  min={MIN_BAND_LEVEL}
                  max={MAX_BAND_LEVEL}
                />
                <p className="text-meta text-dim">{bandLabel(levelOf(sets[bewerkIndex] ?? { weight: 0 }))}</p>
              </>
            ) : (
              <>
                <Stepper
                  ariaLabel={`Gewicht set ${bewerkIndex + 1}`}
                  value={(() => {
                    const s = sets[bewerkIndex]
                    if (!s) return 0
                    return bar > 0 ? platesFromTotal(s.weight, bar) : s.weight
                  })()}
                  onChange={(v) =>
                    updateSet(resolved.slot.key, bewerkIndex, {
                      weight: bar > 0 ? totalFromPlates(v, bar) : v,
                    })
                  }
                  step={resolved.exercise.minIncrement || 2.5}
                  max={400}
                  suffix={bar > 0 || isDumbbell(resolved.exercise) ? undefined : 'kg'}
                  // alleen zolang er niets ingevuld is; anders zou 0 schijven
                  // (de kale stang) weer als schatting worden weergegeven
                  placeholder={(sets[bewerkIndex]?.weight ?? 0) === 0 ? advicePlates : undefined}
                />
                {bar > 0 && <StangTotaal set={sets[bewerkIndex]} bar={bar} schatting={advicePlates} />}
              </>
            )}
          </div>

          <div className="flex flex-col gap-in-block">
            <Caps>{repsInputLabel(resolved.exercise)}</Caps>
            <Stepper
              ariaLabel={`Reps set ${bewerkIndex + 1}`}
              value={sets[bewerkIndex]?.reps ?? 0}
              onChange={(v) => updateSet(resolved.slot.key, bewerkIndex, { reps: v })}
              step={1}
              max={100}
            />
            {repsHint(resolved.exercise) && (
              <p className="text-meta text-dim">{repsHint(resolved.exercise)}</p>
            )}
          </div>

          {/*
            RIR hoort bij de set die je net gedaan hebt: zonder beoordeling achteraf is
            dit wat de progressie te lezen krijgt.
          */}
          <Segments<number>
            label="RIR"
            options={[0, 1, 2, 3, 4].map((n) => ({ id: n, label: n }))}
            value={sets[bewerkIndex]?.rir}
            onChange={(v) => v !== undefined && updateSet(resolved.slot.key, bewerkIndex, { rir: v })}
          />
        </div>
      </Screen>

      <SessieBladen
        date={date}
        kind={kind}
        slots={slots}
        entries={entries}
        completed={completed}
        strength={strength}
        doneSets={doneSets}
        totalSets={totalSets}
        lijstOpen={lijstOpen}
        setLijstOpen={setLijstOpen}
        doneOpen={doneOpen}
        setDoneOpen={setDoneOpen}
        messages={messages}
        setMessages={setMessages}
        onPick={gaNaar}
        effectiveEntries={effectiveEntries}
        onClose={onClose}
        helpFor={helpFor}
        setHelpFor={setHelpFor}
        optionsFor={optionsFor}
        setOptionsFor={setOptionsFor}
        step={step}
      />
    </Full>
  )
}

/* -------------------------------------------------------------------------
 * De warming-up: de eerste stap, en meteen wat er van deze sessie te weten valt
 * ---------------------------------------------------------------------- */

function WarmupStep({
  date,
  kind,
  plan,
  strength,
  kop,
  orderHelp,
  onOrderHelp,
  onDone,
}: {
  date: string
  kind: DayKind
  plan: ReturnType<typeof buildDay>
  strength: NonNullable<ReturnType<typeof buildDay>['strength']>
  kop: ReactNode
  orderHelp: boolean
  onOrderHelp: () => void
  onDone: () => void
}) {
  const [help, setHelp] = useState(false)
  const warmup: Warmup = strength.warmup

  /*
    Alles wat de app aan deze sessie bijstuurt staat hier, vóór de eerste oefening.
    Geen stille correcties: als er een set af gaat of een oefening eruit kan, hoor je
    te kunnen lezen waarom — en dat lees je aan het begin, niet halverwege.
  */
  const regels = [
    plan.cycle.calibration ? `Kalibratieweek: ${CALIBRATION_TEXT}.` : null,
    ...plan.guardrails.map((g) => g.text),
  ].filter(Boolean) as string[]

  return (
    <Screen
      bottom="free"
      fill
      action={
        <Actions>
          <Primary
            onClick={() => {
              if (!warmup.done) A.setWarmupDone(date, kind, true)
              onDone()
            }}
          >
            {warmup.done ? 'Naar de eerste oefening' : 'Warming-up klaar'}
          </Primary>
          <Secondary onClick={onDone}>
            Sla
            <br />
            over
          </Secondary>
        </Actions>
      }
    >
      {kop}

      <h1 className="mt-block font-serif text-exercise leading-exercise text-ink">Warming-up</h1>
      <div className="mt-in-block flex flex-wrap gap-meta text-label text-dim">
        <span>{warmupLabel(warmup)}</span>
        <span>
          {strength.slots.length} oefeningen · ~{strength.estimatedMin} min
        </span>
      </div>

      {regels.length > 0 && (
        <div className="mt-block flex flex-col gap-in-block">
          <Caps tone="accent">Bijgestuurd</Caps>
          {regels.map((r, i) => (
            <p key={i} className="quote">
              {r}
            </p>
          ))}
          {/* het voorstel is er één met een knop: anders blijft het bij een waarschuwing */}
          {strength.tooLong?.dropKey && (
            <Link onClick={() => A.skipSlot(date, strength.tooLong!.dropKey!)}>
              Haal {strength.tooLong.dropName} eruit
            </Link>
          )}
        </div>
      )}

      {help && <p className="quote mt-block">{WARMUP_HINT}</p>}

      <div className="mt-block flex flex-col gap-in-block">
        <div className="flex items-baseline justify-between gap-column">
          <Caps>Waarmee</Caps>
          <Link onClick={() => setHelp((x) => !x)}>Uitleg warming-up</Link>
        </div>
        <ChoiceGrid
          options={WARMUP_TYPES}
          value={warmup.type}
          onChange={(t) => A.setWarmupType(date, kind, t)}
          columns={2}
        />
      </div>

      <div className="mt-block flex flex-col gap-in-block">
        <Caps>Duur warming-up</Caps>
        <Stepper
          ariaLabel="Duur warming-up"
          value={warmup.minutes}
          onChange={(v) => A.setWarmupMinutes(date, kind, v)}
          step={1}
          min={1}
          max={60}
          suffix="min"
        />
      </div>

      <div className="mt-block flex items-baseline justify-between gap-column">
        <Caps>Volgorde</Caps>
        <div className="flex gap-meta">
          {strength.manualOrder && (
            <Link onClick={() => A.resetSlotOrder(date)}>Standaardvolgorde</Link>
          )}
          <Link onClick={onOrderHelp}>Uitleg volgorde</Link>
        </div>
      </div>
      {orderHelp && <p className="quote mt-in-block">{ORDER_RATIONALE}</p>}
    </Screen>
  )
}

/* -------------------------------------------------------------------------
 * De setrijen
 * ---------------------------------------------------------------------- */

function SetRij({
  nummer,
  set,
  actief,
  bewerkt,
  net,
  laatste,
  waarde,
  onToggle,
  onKies,
}: {
  nummer: number
  set: LoggedSet
  actief: boolean
  /** de invoer onderin hoort bij deze set */
  bewerkt: boolean
  /** net afgevinkt: het vinkje loopt één keer vol */
  net: boolean
  laatste: boolean
  waarde: string
  onToggle: () => void
  /** deze set bijstellen; laat het afvinken met rust */
  onKies: () => void
}) {
  const label = set.done ? 'text-dim' : actief ? 'font-semibold text-ink' : 'text-faint'
  const value = set.done ? 'text-muted' : actief ? 'text-ink' : 'text-faint'

  return (
    <div
      className={`flex items-center gap-column border-t-hair border-rule py-row ${
        laatste ? 'border-b-hair' : ''
      }`}
    >
      <button
        type="button"
        aria-label={`Set ${nummer} ${set.done ? 'weer openzetten' : 'afvinken'}`}
        onClick={onToggle}
        className={`flex h-checkbox w-checkbox flex-none items-center justify-center border-hair text-meta
                    transition-colors duration-color ${net ? 'pop-check' : ''} ${
                      set.done
                        ? 'border-accent bg-accent text-on-accent'
                        : actief
                          ? 'border-checkbox-border text-transparent'
                          : 'border-checkbox-idle text-transparent'
                    }`}
      >
        ✓
      </button>
      {/*
        De rij zelf is een knop: aantikken zet de invoer onderin op déze set. Zo corrigeer
        je een set van een al afgeronde oefening zonder de oefening terug te zetten — het
        vinkje links blijft daarvoor apart.
      */}
      <button
        type="button"
        aria-label={`Set ${nummer} bijstellen`}
        aria-pressed={bewerkt}
        onClick={onKies}
        className="flex min-w-0 flex-1 items-center gap-column text-left"
      >
        <div className={`w-set-label flex-none text-label ${label}`}>Set {nummer}</div>
        <div className={`flex-1 font-serif text-set-value ${value}`}>{waarde}</div>
      </button>
      {bewerkt && !actief ? (
        <Caps tone="accent" size="lg" className="shrink-0">
          Bijstellen
        </Caps>
      ) : set.done ? (
        <div className="shrink-0 text-meta text-faint">RIR {set.rir}</div>
      ) : actief ? (
        <Caps tone="accent" size="lg" className="shrink-0">
          Nu
        </Caps>
      ) : null}
    </div>
  )
}

/**
 * Wat er in een setrij staat. Een set die nog moet komen toont het repbereik in
 * plaats van een verzonnen exact aantal — dat getal weet niemand nog.
 */
function setWaarde(r: ResolvedSlot, s: LoggedSet, toonBereik: boolean): string {
  const belasting = isBandExercise(r.exercise)
    ? bandLabel(levelOf(s))
    : `${fmt(s.weight)} kg${isDumbbell(r.exercise) ? ` ${DUMBBELL_WEIGHT_UNIT}` : ''}`
  // een set die nog moet komen toont het bereik, niet een verzonnen exact aantal
  const reps = !s.done && toonBereik ? repBereik(r) : String(s.reps)
  return `${belasting} × ${reps}`
}

function repBereik(r: ResolvedSlot): string {
  return r.repMin === r.repMax ? String(r.repMin) : `${r.repMin}–${r.repMax}`
}

function klokje(seconden: number): string {
  return `${Math.floor(seconden / 60)}:${String(seconden % 60).padStart(2, '0')}`
}

/** Het totaal met stang erbij, of de schatting zolang er niets ingevuld is. */
function StangTotaal({ set, bar, schatting }: { set?: LoggedSet; bar: number; schatting?: number }) {
  const leeg = (set?.weight ?? 0) === 0
  if (leeg && schatting === undefined) return null
  const schijven = leeg ? (schatting ?? 0) : platesFromTotal(set!.weight, bar)
  return (
    <p className="text-meta text-dim">
      {barTotalLabel(schijven, bar)}
      {leeg && ' (schatting)'}
    </p>
  )
}

/** De regel onder de oefeningnaam: wat de app over dit gewicht te zeggen heeft. */
function Toelichting({
  exercise,
  settings,
  target,
  advice,
  bar,
  kalibratie,
}: {
  exercise: Exercise
  settings: Settings
  target: Target
  advice: ReturnType<typeof startWeightAdvice>
  bar: number
  kalibratie: boolean
}) {
  const regels: string[] = []

  if (!target.byFeel) {
    if (target.level !== null) regels.push(`Streef ${bandLabel(target.level)}.`)
    else if (target.weight !== null) regels.push(`Streef ${fmt(target.weight)} kg × ${target.reps}.`)
  } else if (kalibratie) {
    regels.push(`${CALIBRATION_TEXT}.`)
  }
  // de kalibratienotitie staat er hierboven al; niet twee keer hetzelfde zeggen
  if (target.note && !regels.some((r) => r.startsWith(target.note!))) regels.push(target.note)
  if (advice) {
    const eenheid = bar > 0 ? ' totaal (stang inbegrepen)' : isDumbbell(exercise) ? ` ${DUMBBELL_WEIGHT_UNIT}` : ''
    const bron =
      advice.source === 'related' ? `afgeleid van ${advice.relatedName}` : 'op basis van je lichaamsgewicht'
    regels.push(`Schatting ${fmt(advice.weight)} kg${eenheid} — ${bron}. ${ADVICE_HINT}`)
  }
  const hint = loadHint(exercise, settings)
  if (hint) regels.push(hint)

  if (regels.length === 0) return null
  return (
    <div className="mt-in-block flex flex-col gap-tight">
      {regels.map((r, i) => (
        <p key={i} className="font-serif italic text-note text-muted">
          {r}
        </p>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------
 * De bladen: oefeningenlijst, uitleg, opties, afronden
 * ---------------------------------------------------------------------- */

function SessieBladen(props: {
  date: string
  kind: DayKind
  slots: ResolvedSlot[]
  entries: Record<string, LoggedSet[]>
  completed: string[]
  strength: NonNullable<ReturnType<typeof buildDay>['strength']>
  doneSets: number
  totalSets: number
  lijstOpen: boolean
  setLijstOpen: (v: boolean) => void
  doneOpen: boolean
  setDoneOpen: (v: boolean) => void
  messages: string[] | null
  setMessages: (v: string[]) => void
  onPick: (key: string) => void
  effectiveEntries: () => Record<string, LoggedSet[]>
  onClose: () => void
  helpFor: Exercise | null
  setHelpFor: (e: Exercise | null) => void
  optionsFor: ResolvedSlot | null
  setOptionsFor: (r: ResolvedSlot | null) => void
  step: string
}) {
  const {
    date,
    kind,
    slots,
    entries,
    completed,
    strength,
    doneSets,
    totalSets,
    lijstOpen,
    setLijstOpen,
    doneOpen,
    setDoneOpen,
    messages,
    setMessages,
    onPick,
    effectiveEntries,
    onClose,
    helpFor,
    setHelpFor,
    optionsFor,
    setOptionsFor,
    step,
  } = props

  return (
    <>
      <Sheet open={lijstOpen} onClose={() => setLijstOpen(false)} title={strength.naam}>
        <div className="flex flex-col">
          <button
            type="button"
            className="flex items-center justify-between gap-column border-t-hair border-rule py-row text-left"
            onClick={() => {
              setLijstOpen(false)
              onPick(WARMUP_STEP)
            }}
          >
            <span className={step === WARMUP_STEP ? 'text-list text-ink' : 'text-list text-muted'}>
              Warming-up
            </span>
            <span className="text-meta text-faint">{strength.warmup.done ? '✓' : warmupLabel(strength.warmup)}</span>
          </button>
          {slots.map((r) => {
            const af = completed.includes(r.slot.key)
            const gedaan = (entries[r.slot.key] ?? []).filter((s) => s.done).length
            return (
              <button
                key={r.slot.key}
                type="button"
                className="flex items-center justify-between gap-column border-t-hair border-rule py-row text-left last:border-b-hair"
                onClick={() => {
                  setLijstOpen(false)
                  onPick(r.slot.key)
                }}
              >
                <span className={`min-w-0 truncate text-list ${step === r.slot.key ? 'text-ink' : 'text-muted'}`}>
                  {r.exercise.naam}
                </span>
                <span className="shrink-0 text-meta text-faint">
                  {af ? '✓' : `${gedaan}/${entries[r.slot.key]?.length ?? r.sets}`}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-block">
          <button
            className="btn-primary w-full"
            onClick={() => {
              setLijstOpen(false)
              setDoneOpen(true)
            }}
          >
            Sessie afronden
          </button>
        </div>
      </Sheet>

      {helpFor && (
        <Sheet open onClose={() => setHelpFor(null)} title={`Uitleg ${helpFor.naam}`}>
          <Explanation exercise={helpFor} />
        </Sheet>
      )}

      <SlotOptions resolved={optionsFor} date={date} onClose={() => setOptionsFor(null)} />

      <Sheet open={doneOpen} onClose={() => setDoneOpen(false)} title="Sessie afronden">
        {messages === null ? (
          <div className="flex flex-col gap-block">
            <p className="text-body text-muted">
              {doneSets} van {totalSets} sets afgevinkt. Alleen afgevinkte sets tellen mee.
            </p>
            {/*
              De beoordeling ís de afrondknop: één tik, en de sessie staat erin. Dat is
              bewust — een los schermpje erna wordt overgeslagen, en zonder beoordeling
              moet de progressie terugvallen op de RIR per set.
            */}
            <div className="flex flex-col gap-in-block">
              <Caps>Hoe ging het?</Caps>
              <ChoiceGrid
                options={FEELS}
                onChange={(feel) =>
                  setMessages(
                    A.completeSession(
                      date,
                      kind,
                      slots,
                      effectiveEntries(),
                      strength.short,
                      completed,
                      feel,
                    ),
                  )
                }
              />
            </div>
            <button
              className="btn-quiet w-full"
              onClick={() =>
                setMessages(
                  A.completeSession(date, kind, slots, effectiveEntries(), strength.short, completed),
                )
              }
            >
              Afronden zonder beoordeling
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-block">
            <Caps tone="accent">Sessie opgeslagen</Caps>
            {messages.length === 0 ? (
              <p className="quote">Streefwaarden blijven gelijk.</p>
            ) : (
              <ul className="flex flex-col gap-in-block">
                {messages.map((m, i) => (
                  <li key={i} className="quote">
                    {m}
                  </li>
                ))}
              </ul>
            )}
            <button className="btn-primary w-full" onClick={onClose}>
              Klaar
            </button>
          </div>
        )}
      </Sheet>
    </>
  )
}

/**
 * Tijdens kalibratie geen schatting: dan is "op gevoel" de instructie.
 * De schaal komt uit het programma van deze gebruiker — een beginner start lichter.
 */
function adviceFor(r: ResolvedSlot, state: UserState, calibration: boolean) {
  if (calibration) return null
  return startWeightAdvice(r.exercise, state, programFor(state).startScale)
}

function Explanation({ exercise }: { exercise: Exercise }) {
  const figure = exercise.hasFigure ? getFigure(exercise.id) : null
  const c = exercise.coaching

  return (
    <div className="flex flex-col gap-block">
      {figure && <FigurePair start={figure.start} end={figure.end} props={figure.props} />}
      <div className="flex flex-col gap-in-block text-body">
        <Block label="Start">{c.setup}</Block>
        <Block label="Uitvoering">
          <ul className="flex flex-col gap-tight">
            {c.execution.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-faint" aria-hidden>
                  ·
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Block>
        <Block label="Fout">{c.mistake}</Block>
        {c.note && <Block label="Apparaat">{c.note}</Block>}
      </div>
      {exercise.loads.length > 0 && (
        <p className="text-meta text-faint">
          Belast: {exercise.loads.map((l) => LOAD_LABEL[l]).join(', ')}
        </p>
      )}
    </div>
  )
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-tight">
      <Caps>{label}</Caps>
      <div className="text-muted">{children}</div>
    </div>
  )
}

function SlotOptions({
  resolved,
  date,
  onClose,
}: {
  resolved: ResolvedSlot | null
  date: string
  onClose: () => void
}) {
  const state = useStore()
  const [picking, setPicking] = useState<'once' | 'permanent' | null>(null)

  useEffect(() => {
    if (!resolved) setPicking(null)
  }, [resolved])

  if (!resolved) return null
  const candidates = swapCandidates(resolved.exercise, state)
  const target = targetFor(resolved.exercise, resolved.repMin, state, {
    calibration: false,
    deload: false,
  })
  // plek in de sessie, zodat "eerder" en "later" alleen aanstaan als ze kunnen
  const slots = buildDay(state, date).strength?.slots ?? []
  const index = slots.findIndex((r) => r.slot.key === resolved.slot.key)

  return (
    <Sheet open onClose={onClose} title={resolved.exercise.naam}>
      {picking === null ? (
        <div className="flex flex-col gap-in-block">
          <div className="mb-in-block flex flex-wrap gap-column">
            {!target.byFeel &&
              (target.level !== null ? (
                <Chip tone="lift">streef {bandLabel(target.level)}</Chip>
              ) : (
                <Chip tone="lift">streef {fmt(target.weight)} kg</Chip>
              ))}
            <Chip tone="off">{ORDER_CATEGORY_LABEL[resolved.exercise.orderCategory]}</Chip>
            {resolved.reasons.map((x) => (
              <Chip key={x} tone="off">
                {x}
              </Chip>
            ))}
          </div>
          {resolved.warning && <p className="quote">{resolved.warning}</p>}
          <div className="grid grid-cols-2 gap-in-block">
            <button
              className="btn-ghost disabled:opacity-40"
              disabled={index <= 0}
              onClick={() => A.moveSlot(date, resolved.slot.key, -1)}
            >
              ↑ Eerder
            </button>
            <button
              className="btn-ghost disabled:opacity-40"
              disabled={index === -1 || index >= slots.length - 1}
              onClick={() => A.moveSlot(date, resolved.slot.key, 1)}
            >
              ↓ Later
            </button>
          </div>
          <button className="btn-ghost w-full" onClick={() => setPicking('once')}>
            Wissel eenmalig
          </button>
          <button className="btn-ghost w-full" onClick={() => setPicking('permanent')}>
            Vervang permanent
          </button>
          <button
            className="btn-quiet w-full"
            onClick={() => {
              A.skipSlot(date, resolved.slot.key)
              onClose()
            }}
          >
            Sla deze oefening over
          </button>
          {state.permanentReplacements[resolved.slot.key] && (
            <button
              className="btn-quiet w-full"
              onClick={() => {
                A.undoPermanent(resolved.slot.key)
                onClose()
              }}
            >
              Terug naar standaardoefening
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-in-block">
          <p className="mb-in-block text-body text-muted">
            {picking === 'once'
              ? 'Alleen voor vandaag.'
              : 'Wordt vanaf nu de standaard en rouleert niet mee.'}
          </p>
          {candidates.length === 0 && (
            <p className="text-body text-muted">Geen alternatief beschikbaar binnen je instellingen.</p>
          )}
          {candidates.map((c) => (
            <button
              key={c.id}
              className="btn-ghost w-full"
              onClick={() => {
                if (picking === 'once') A.swapOnce(date, resolved.slot.key, c.id)
                else A.replacePermanently(date, resolved.slot.key, c.id)
                onClose()
              }}
            >
              {c.naam}
            </button>
          ))}
          <button className="btn-quiet w-full" onClick={() => setPicking(null)}>
            Terug
          </button>
        </div>
      )}
    </Sheet>
  )
}

/** De sessie dekt het hele scherm af: geen navigatiebalk, geen weg eromheen. */
function Full({ children }: { children: ReactNode }) {
  return <div className="safe-top fixed inset-0 z-40 flex flex-col bg-bg">{children}</div>
}
