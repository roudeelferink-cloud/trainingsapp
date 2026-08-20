import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { FigurePair } from '../components/Figure'
import { RestTimer } from '../components/RestTimer'
import { Card, ChoiceGrid, Chip, Sheet, Stepper, formatDecimal, parseDecimal } from '../components/ui'
import { LOAD_LABEL } from '../data/exercises'
import { getFigure } from '../data/figures'
import { MAX_BAND_LEVEL, MIN_BAND_LEVEL, bandLabel, isBandExercise, levelOf } from '../logic/band'
import { barTotalLabel, barWeightFor, platesFromTotal, totalFromPlates } from '../logic/barWeight'
import { buildDay } from '../logic/day'
import { formatShort } from '../logic/dates'
import { DUMBBELL_WEIGHT_UNIT, isDumbbell } from '../logic/dumbbell'
import { loadHint, repsInputLabel, weightInputLabel } from '../logic/load'
import { ORDER_CATEGORY_LABEL, ORDER_RATIONALE } from '../logic/order'
import { WARMUP_HINT, WARMUP_TYPES, warmupLabel } from '../logic/warmup'
import { FEELS } from '../logic/feel'
import { CALIBRATION_TEXT, fmt, targetFor } from '../logic/progression'
import { swapCandidates, type ResolvedSlot } from '../logic/select'
import {
  allSetsDone,
  checkSet,
  nextUncompleted,
  seedSets,
  uncheckSet,
} from '../logic/sessionFlow'
import { programFor } from '../data/programs'
import { ADVICE_HINT, startWeightAdvice } from '../logic/startWeight'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { UserState, DayKind, Exercise, LoggedSet, Warmup } from '../types'

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

  // meteen bij de eerste render open, zodat je zonder extra tik kunt loggen
  const firstKey = slots[0]?.slot.key ?? null
  const [active, setActive] = useState<string | null>(() => slots[0]?.slot.key ?? null)
  const [helpOpen, setHelpOpen] = useState<string[]>([]) // uitleg staat standaard dicht
  const [optionsFor, setOptionsFor] = useState<ResolvedSlot | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)
  const [orderHelp, setOrderHelp] = useState(false) // uitleg bij de volgorde, standaard dicht
  const [messages, setMessages] = useState<string[] | null>(null)
  const [completed, setCompleted] = useState<string[]>(() => strength?.log?.completedSlots ?? [])
  const [justDone, setJustDone] = useState<string | null>(null)

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

  // is de actieve oefening weggevallen (gewisseld, korte versie), pak dan de eerste
  useEffect(() => {
    if (active && !slots.some((r) => r.slot.key === active)) setActive(firstKey)
  }, [firstKey, slots, active])

  if (!strength || slots.length === 0) {
    return (
      <Full onClose={onClose} title="Sessie">
        <Card>
          <p className="text-fg">Er staat geen sessie meer open op {formatShort(date)}.</p>
          <button className="btn-primary w-full mt-4" onClick={onClose}>
            Terug
          </button>
        </Card>
      </Full>
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
      return { ...cur, [slotKey]: arr }
    })
  }

  function completeExercise(key: string) {
    const next = [...completed, key]
    setCompleted(next)
    persistDraft(entries, next)
    setJustDone(key)
    window.setTimeout(() => {
      setJustDone(null)
      setActive(
        nextUncompleted(
          slots.map((r) => r.slot.key),
          next,
          key,
        ),
      )
    }, 700)
  }

  function uncompleteExercise(key: string) {
    const next = completed.filter((k) => k !== key)
    setCompleted(next)
    persistDraft(entries, next)
  }

  const totalSets = slots.reduce((n, x) => n + (entries[x.slot.key]?.length ?? x.sets), 0)
  const doneSets = slots.reduce(
    (n, x) => n + (entries[x.slot.key] ?? []).filter((s) => s.done).length,
    0,
  )
  const completedCount = slots.filter((x) => completed.includes(x.slot.key)).length

  return (
    <Full onClose={onClose} title={strength.naam}>
      <div className="mb-3">
        <div className="h-2 rounded-full bg-raised overflow-hidden">
          <div
            className="h-full bg-fg transition-all"
            style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted mt-1">
          <span>
            {completedCount} van {slots.length} afgerond
          </span>
          <span>
            {doneSets}/{totalSets} sets
          </span>
        </div>
      </div>

      {plan.cycle.calibration && (
        <p className="text-sm text-muted mb-3">
          <span aria-hidden>▲ </span>Kalibratieweek: {CALIBRATION_TEXT}.
        </p>
      )}

      {/*
        Alles wat de app aan deze sessie bijstuurt staat hier, met de reden erbij. Geen
        stille correcties: als er een set af gaat of een oefening eruit kan, hoor je te
        kunnen lezen waarom.
      */}
      {plan.guardrails.length > 0 && (
        <ul className="mb-3 space-y-1">
          {plan.guardrails.map((g) => (
            <li key={g.id} className="text-sm flex gap-2 text-muted">
              <span aria-hidden>▲</span>
              <span>{g.text}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted mb-2 num">
        Geschatte duur {strength.estimatedMin} min
        {strength.tooLong?.dropName && ` · zonder ${strength.tooLong.dropName} ${strength.tooLong.minutesWithoutDrop} min`}
      </p>

      {/* het voorstel is er één met een knop: anders blijft het bij een waarschuwing */}
      {strength.tooLong?.dropKey && (
        <button
          className="btn-quiet btn-sm w-full mb-3"
          onClick={() => A.skipSlot(date, strength.tooLong!.dropKey!)}
        >
          Haal {strength.tooLong.dropName} eruit
        </button>
      )}

      <WarmupBlock date={date} kind={kind} warmup={strength.warmup} />

      <div className="flex items-center gap-2 mb-2">
        <span className="label flex-1">Volgorde</span>
        {strength.manualOrder && (
          <button className="btn-quiet btn-sm" onClick={() => A.resetSlotOrder(date)}>
            Standaardvolgorde
          </button>
        )}
        <RoundButton
          label="Uitleg volgorde"
          active={orderHelp}
          onClick={() => setOrderHelp((x) => !x)}
        >
          ?
        </RoundButton>
      </div>
      {orderHelp && <p className="text-sm text-fg mb-2">{ORDER_RATIONALE}</p>}

      <div className="border-y border-line">
        {slots.map((r, i) => {
          const isActive = active === r.slot.key
          const isHelp = helpOpen.includes(r.slot.key)
          const isCompleted = completed.includes(r.slot.key)
          const sets = entries[r.slot.key] ?? []
          const filled = sets.filter((s) => s.done).length
          const advice = adviceFor(r, state, plan.cycle.calibration)
          // stanggewicht: de gebruiker vult schijven in, de log bewaart het totaal
          const bar = barWeightFor(r.exercise, state.settings)
          const advicePlates =
            advice === null ? undefined : bar > 0 ? platesFromTotal(advice.weight, bar) : advice.weight

          return (
            <div
              key={r.slot.key}
              className={`${i > 0 ? 'border-t border-line' : ''} ${isActive ? 'bg-raised' : ''}`}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  className="flex-1 min-w-0 text-left py-1.5"
                  onClick={() => setActive(isActive ? null : r.slot.key)}
                >
                  <span className="block font-medium truncate">
                    {isCompleted && (
                      <span className="text-muted mr-1" aria-hidden>
                        ✓
                      </span>
                    )}
                    {r.exercise.naam}
                  </span>
                  <span className="block text-xs text-muted num">
                    {r.sets} × {r.repMin === r.repMax ? r.repMin : `${r.repMin}-${r.repMax}`}
                    {r.exercise.perSide && ' p/kant'}
                    {filled > 0 && ` · ${filled} afgevinkt`}
                  </span>
                </button>
                <RoundButton
                  label={`Uitleg ${r.exercise.naam}`}
                  active={isHelp}
                  onClick={() =>
                    setHelpOpen((cur) =>
                      cur.includes(r.slot.key)
                        ? cur.filter((k) => k !== r.slot.key)
                        : [...cur, r.slot.key],
                    )
                  }
                >
                  ?
                </RoundButton>
                <RoundButton label={`Opties ${r.exercise.naam}`} onClick={() => setOptionsFor(r)}>
                  ⋯
                </RoundButton>
              </div>

              {isHelp && <Explanation exercise={r.exercise} />}

              {isActive && (
                <div className="px-3 pb-3 space-y-3">
                  {loadHint(r.exercise, state.settings) && (
                    <p className="text-xs text-muted">{loadHint(r.exercise, state.settings)}</p>
                  )}
                  {advice && (
                    <p className="text-xs text-muted">
                      Schatting {advice.weight} kg
                      {bar > 0
                        ? ' totaal (stang inbegrepen)'
                        : isDumbbell(r.exercise)
                          ? ` ${DUMBBELL_WEIGHT_UNIT}`
                          : ''}{' '}
                      —{' '}
                      {advice.source === 'related'
                        ? `afgeleid van ${advice.relatedName}`
                        : 'op basis van je lichaamsgewicht'}
                      . {ADVICE_HINT}
                    </p>
                  )}
                  {/*
                    Eén set tegelijk groot en bewerkbaar. Afgeronde sets krimpen tot één
                    regel (tikken maakt ze weer bewerkbaar), komende sets staan gedempt
                    en voorgevuld klaar.
                  */}
                  {(() => {
                    const editIndex = sets.findIndex((s) => !s.done)
                    return sets.map((s, si) =>
                      si === editIndex ? (
                        <SetEditor
                          key={`${r.slot.key}:${si}`}
                          index={si}
                          count={sets.length}
                          set={s}
                          exercise={r.exercise}
                          bar={bar}
                          advicePlates={advicePlates}
                          weightLabel={weightInputLabel(r.exercise, state.settings)}
                          repsLabel={repsInputLabel(r.exercise)}
                          onPatch={(patch) => updateSet(r.slot.key, si, patch)}
                          onSave={() => setSetDone(r.slot.key, si, true)}
                        />
                      ) : (
                        <SetRegel
                          key={si}
                          index={si}
                          set={s}
                          exercise={r.exercise}
                          advice={advice?.weight}
                          onReopen={s.done ? () => setSetDone(r.slot.key, si, false) : undefined}
                        />
                      ),
                    )
                  })()}
                  <button className="btn-quiet btn-sm w-full" onClick={() => addSet(r.slot.key)}>
                    + set toevoegen
                  </button>
                  <RestTimer seconds={r.slot.role === 'core' ? 150 : 90} />
                  {justDone === r.slot.key && (
                    <div className="flex justify-center" aria-hidden>
                      <span className="pop-check inline-flex w-12 h-12 items-center justify-center rounded-full bg-fg text-on-invert text-2xl font-medium">
                        ✓
                      </span>
                    </div>
                  )}
                  {isCompleted ? (
                    <button
                      className="btn-quiet w-full"
                      onClick={() => uncompleteExercise(r.slot.key)}
                    >
                      ✓ Afgerond — zet terug
                    </button>
                  ) : (
                    <button
                      className={`${allSetsDone(sets) ? 'btn-primary' : 'btn-quiet'} w-full`}
                      onClick={() => completeExercise(r.slot.key)}
                    >
                      Oefening klaar
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* pas dé primaire actie zodra alles afgerond is; tot die tijd is de set aan de beurt */}
      <button
        className={`${completedCount === slots.length ? 'btn-primary' : 'btn-ghost'} w-full mt-4`}
        onClick={() => setDoneOpen(true)}
      >
        Sessie afronden
      </button>

      <SlotOptions resolved={optionsFor} date={date} onClose={() => setOptionsFor(null)} />

      <Sheet open={doneOpen} onClose={() => setDoneOpen(false)} title="Sessie afronden">
        {messages === null ? (
          <>
            <p className="text-sm text-muted mb-1">
              {doneSets} van {totalSets} sets afgevinkt. Alleen afgevinkte sets tellen mee.
            </p>
            {/*
              De beoordeling ís de afrondknop: één tik, en de sessie staat erin. Dat is
              bewust — een los schermpje erna wordt overgeslagen, en zonder beoordeling
              moet de progressie terugvallen op de RIR per set.
            */}
            <p className="font-medium mt-4 mb-2">Hoe ging het?</p>
            <ChoiceGrid
              options={FEELS}
              buttonClass="min-h-[56px] text-sm"
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
            <button
              className="btn-quiet w-full mt-2"
              onClick={() =>
                setMessages(
                  A.completeSession(date, kind, slots, effectiveEntries(), strength.short, completed),
                )
              }
            >
              Afronden zonder beoordeling
            </button>
          </>
        ) : (
          <>
            <p className="font-medium text-muted mb-2">Sessie opgeslagen.</p>
            {messages.length === 0 ? (
              <p className="text-sm text-muted mb-4">Streefwaarden blijven gelijk.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {messages.map((m, i) => (
                  <li key={i} className="text-sm text-fg">
                    {m}
                  </li>
                ))}
              </ul>
            )}
            <button className="btn-primary w-full" onClick={onClose}>
              Klaar
            </button>
          </>
        )}
      </Sheet>
    </Full>
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

/**
 * Het blok waar elke krachtsessie mee begint. Staat bewust boven de oefeningen en
 * niet ertussen: het is de opwarming, geen zevende oefening. Type en duur zijn
 * instelbaar en het vinkje wordt bij de sessie opgeslagen.
 */
function WarmupBlock({ date, kind, warmup }: { date: string; kind: DayKind; warmup: Warmup }) {
  const [help, setHelp] = useState(false)

  return (
    <div className={`border-t border-line py-3 mb-3 ${warmup.done ? 'text-muted' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0">
          <span className="block font-medium">
            {warmup.done && (
              <span className="text-muted mr-1" aria-hidden>
                ✓
              </span>
            )}
            Warming-up
          </span>
          <span className="block text-xs text-muted num">{warmupLabel(warmup)}</span>
        </span>
        <RoundButton label="Uitleg warming-up" active={help} onClick={() => setHelp((x) => !x)}>
          ?
        </RoundButton>
        <button
          aria-label={`Warming-up ${warmup.done ? 'weer openzetten' : 'afvinken'}`}
          onClick={() => A.setWarmupDone(date, kind, !warmup.done)}
          className={`shrink-0 w-11 h-11 rounded border text-lg font-medium ${
            warmup.done
              ? 'bg-fg text-on-invert border-fg'
              : 'bg-raised border-line text-muted'
          }`}
        >
          ✓
        </button>
      </div>

      {help && <p className="text-sm text-fg mt-2">{WARMUP_HINT}</p>}

      <div className="mt-3">
        <ChoiceGrid
          options={WARMUP_TYPES}
          value={warmup.type}
          onChange={(t) => A.setWarmupType(date, kind, t)}
          columns={2}
          buttonClass="min-h-[44px] text-sm"
        />
      </div>

      <div className="mt-2">
        <p className="label mb-0.5">Duur</p>
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
    </div>
  )
}

/** Nederlandse weergave van een gewicht op een setregel. */
function kgLabel(weight: number): string {
  return `${formatDecimal(weight)} kg`
}

/**
 * Een set die nu niet bewerkt wordt: één regel. Afgerond is gedempt met een vinkje
 * en weer te openen; een komende set staat er nog vager, voorgevuld en wacht op
 * zijn beurt.
 */
function SetRegel({
  index,
  set,
  exercise,
  advice,
  onReopen,
}: {
  index: number
  set: LoggedSet
  exercise: Exercise
  /** schatting voor het gewicht zolang er niets ingevuld is */
  advice?: number
  onReopen?: () => void
}) {
  const band = isBandExercise(exercise)
  const gewicht = band
    ? bandLabel(levelOf(set))
    : set.weight > 0
      ? kgLabel(set.weight)
      : advice !== undefined
        ? `${kgLabel(advice)} (schatting)`
        : '—'
  const inhoud = (
    <>
      <span className="num w-5 shrink-0">{index + 1}</span>
      <span className="num flex-1 text-left">
        {gewicht} × {set.reps}
      </span>
      {set.done && <span className="num">RIR {set.rir}</span>}
      {set.done && <span aria-hidden>✓</span>}
    </>
  )

  if (onReopen) {
    return (
      <button
        aria-label={`Set ${index + 1} aanpassen`}
        onClick={onReopen}
        className="w-full flex items-center gap-2 min-h-[44px] px-1 text-sm text-muted border-t border-line first:border-t-0"
      >
        {inhoud}
      </button>
    )
  }
  return (
    <div className="w-full flex items-center gap-2 min-h-[44px] px-1 text-sm text-faint border-t border-line first:border-t-0">
      {inhoud}
    </div>
  )
}

/**
 * De set die nu aan de beurt is: kg en reps als twee grote velden naast elkaar,
 * het getal in monospace, en één primaire knop — Set opslaan.
 */
function SetEditor({
  index,
  count,
  set,
  exercise,
  bar,
  advicePlates,
  weightLabel,
  repsLabel,
  onPatch,
  onSave,
}: {
  index: number
  count: number
  set: LoggedSet
  exercise: Exercise
  /** stanggewicht in kg; 0 = geen stang, dan is het veld het hele gewicht */
  bar: number
  advicePlates?: number
  weightLabel: string
  repsLabel: string
  onPatch: (patch: Partial<LoggedSet>) => void
  onSave: () => void
}) {
  const band = isBandExercise(exercise)

  return (
    <div className="border border-line rounded p-3">
      <p className="label mb-2">
        Set {index + 1} van {count}
      </p>

      <div className="grid grid-cols-2 gap-2">
        {band ? (
          <GrootVeld
            label={weightLabel}
            ariaLabel={`Bandniveau set ${index + 1}`}
            value={levelOf(set)}
            onChange={(v) => onPatch({ weight: 0, level: Math.round(v) })}
            step={1}
            min={MIN_BAND_LEVEL}
            max={MAX_BAND_LEVEL}
          />
        ) : (
          <GrootVeld
            label={weightLabel}
            ariaLabel={`Gewicht set ${index + 1}`}
            value={bar > 0 ? platesFromTotal(set.weight, bar) : set.weight}
            onChange={(v) => onPatch({ weight: bar > 0 ? totalFromPlates(v, bar) : v })}
            step={exercise.minIncrement || 2.5}
            max={400}
            placeholder={set.weight === 0 ? advicePlates : undefined}
          />
        )}
        <GrootVeld
          label={repsLabel}
          ariaLabel={`Reps set ${index + 1}`}
          value={set.reps}
          onChange={(v) => onPatch({ reps: Math.round(v) })}
          step={1}
          max={100}
        />
      </div>

      {band && <p className="text-xs text-muted mt-1">{bandLabel(levelOf(set))}</p>}
      {!band && bar > 0 && (set.weight > 0 || advicePlates !== undefined) && (
        <p className="text-xs text-muted mt-1 num">
          {barTotalLabel(set.weight === 0 ? (advicePlates ?? 0) : platesFromTotal(set.weight, bar), bar)}
          {set.weight === 0 && ' (schatting)'}
        </p>
      )}

      <div className="flex items-center gap-1 mt-3">
        <span className="label w-10">RIR</span>
        {[0, 1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => onPatch({ rir: n })}
            className={`flex-1 min-h-[44px] rounded text-sm font-medium num ${
              set.rir === n ? 'bg-fg text-on-invert' : 'bg-raised border border-line'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <button className="btn-primary w-full mt-3" onClick={onSave}>
        Set opslaan
      </button>
    </div>
  )
}

/**
 * Groot invoerveld voor de actieve set: het getal in monospace, komma-invoer zoals
 * overal (zie parseDecimal), en de −/+ eronder zodat het veld zelf de breedte houdt.
 */
function GrootVeld({
  label,
  ariaLabel,
  value,
  onChange,
  step,
  min = 0,
  max,
  placeholder,
}: {
  label: string
  ariaLabel: string
  value: number
  onChange: (v: number) => void
  step: number
  min?: number
  max: number
  placeholder?: number
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  const empty = value === 0 && placeholder !== undefined
  const basis = empty ? placeholder : value

  return (
    <div>
      <p className="label mb-1">{label}</p>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        className="w-full min-w-[56px] rounded border border-line bg-transparent px-2 py-2 text-center text-2xl num font-medium focus:outline-none focus:border-fg placeholder:text-faint placeholder:font-normal"
        value={draft ?? (empty ? '' : formatDecimal(value))}
        placeholder={placeholder === undefined ? undefined : formatDecimal(placeholder)}
        onChange={(e) => {
          const text = e.target.value
          setDraft(text)
          if (text === '') return onChange(0)
          const parsed = parseDecimal(text)
          if (parsed !== null) onChange(clamp(parsed))
        }}
        onBlur={() => setDraft(null)}
      />
      <div className="grid grid-cols-2 gap-1 mt-1">
        <button
          aria-label={`${ariaLabel} minder`}
          className="btn-ghost btn-sm"
          onClick={() => {
            setDraft(null)
            onChange(clamp(basis - step))
          }}
        >
          −
        </button>
        <button
          aria-label={`${ariaLabel} meer`}
          className="btn-ghost btn-sm"
          onClick={() => {
            setDraft(null)
            onChange(clamp(basis + step))
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}

function RoundButton({
  children,
  onClick,
  label,
  active,
}: {
  children: ReactNode
  onClick: () => void
  label: string
  active?: boolean
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`shrink-0 w-11 h-11 rounded border flex items-center justify-center text-lg font-medium ${
        active ? 'bg-fg text-on-invert border-fg' : 'bg-transparent border-line text-muted'
      }`}
    >
      {children}
    </button>
  )
}

function Explanation({ exercise }: { exercise: Exercise }) {
  const figure = exercise.hasFigure ? getFigure(exercise.id) : null
  const c = exercise.coaching

  return (
    <div className="px-3 pb-3 space-y-3">
      {figure && <FigurePair start={figure.start} end={figure.end} props={figure.props} />}
      <div className="space-y-2 text-sm">
        <Block label="Start">{c.setup}</Block>
        <Block label="Uitvoering">
          <ul className="space-y-1">
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
        <p className="text-xs text-faint">
          Belast: {exercise.loads.map((l) => LOAD_LABEL[l]).join(', ')}
        </p>
      )}
    </div>
  )
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="label mb-0.5">{label}</p>
      <div className="text-fg">{children}</div>
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
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {!target.byFeel &&
              (target.level !== null ? (
                <Chip>streef {bandLabel(target.level)}</Chip>
              ) : (
                <Chip>streef {fmt(target.weight)} kg</Chip>
              ))}
            <Chip>{ORDER_CATEGORY_LABEL[resolved.exercise.orderCategory]}</Chip>
            {resolved.reasons.map((x) => (
              <Chip key={x}>
                {x}
              </Chip>
            ))}
          </div>
          {resolved.warning && <p className="text-sm text-error">{resolved.warning}</p>}
          <div className="grid grid-cols-2 gap-2">
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
        <div className="space-y-2">
          <p className="text-sm text-muted mb-2">
            {picking === 'once'
              ? 'Alleen voor vandaag.'
              : 'Wordt vanaf nu de standaard en rouleert niet mee.'}
          </p>
          {candidates.length === 0 && (
            <p className="text-sm text-muted">Geen alternatief beschikbaar binnen je instellingen.</p>
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

function Full({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-40 bg-bg overflow-y-auto">
      <div className="sticky top-0 z-10 bg-bg backdrop-blur border-b border-line safe-top">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button className="btn-ghost btn-sm" onClick={onClose}>
            ← Terug
          </button>
          <span className="font-medium truncate">{title}</span>
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 py-4 pb-24">{children}</div>
    </div>
  )
}
