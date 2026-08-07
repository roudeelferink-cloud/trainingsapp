import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { FigurePair } from '../components/Figure'
import { RestTimer } from '../components/RestTimer'
import { Card, Chip, Sheet, Stepper } from '../components/ui'
import { LOAD_LABEL } from '../data/exercises'
import { getFigure } from '../data/figures'
import { buildDay } from '../logic/day'
import { formatShort } from '../logic/dates'
import { CALIBRATION_TEXT, fmt, targetFor } from '../logic/progression'
import { swapCandidates, type ResolvedSlot } from '../logic/select'
import { ADVICE_HINT, startWeightAdvice } from '../logic/startWeight'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { AppState, DayKind, Exercise, LoggedSet } from '../types'

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
  const [messages, setMessages] = useState<string[] | null>(null)

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
        deload: plan.cycle.deload,
      })
      out[r.slot.key] = Array.from({ length: r.sets }, () => ({
        weight: t.weight ?? 0,
        reps: 0,
        rir: 2,
      }))
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const [entries, setEntries] = useState<Record<string, LoggedSet[]>>(seed)
  const [seenSignature, setSeenSignature] = useState(signature)

  if (signature !== seenSignature) {
    const fresh = seed()
    for (const [k, v] of Object.entries(entries)) {
      if (fresh[k] && v.some((s) => s.reps > 0)) fresh[k] = v
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
          <p className="text-slate-300">Er staat geen sessie meer open op {formatShort(date)}.</p>
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

  function updateSet(slotKey: string, i: number, patch: Partial<LoggedSet>) {
    setEntries((cur) => {
      const arr = [...(cur[slotKey] ?? [])]
      arr[i] = { ...arr[i], ...patch }
      const next = { ...cur, [slotKey]: arr }
      A.saveSessionDraft(
        date,
        kind,
        next,
        Object.fromEntries(slots.map((x) => [x.slot.key, x.exercise.id])),
        strength!.short,
      )
      return next
    })
  }

  function addSet(slotKey: string) {
    setEntries((cur) => {
      const arr = [...(cur[slotKey] ?? [])]
      const last = arr[arr.length - 1]
      arr.push(last ? { ...last, reps: 0 } : { weight: 0, reps: 0, rir: 2 })
      return { ...cur, [slotKey]: arr }
    })
  }

  const totalSets = slots.reduce((n, x) => n + (entries[x.slot.key]?.length ?? x.sets), 0)
  const doneSets = slots.reduce(
    (n, x) => n + (entries[x.slot.key] ?? []).filter((s) => s.reps > 0).length,
    0,
  )

  return (
    <Full onClose={onClose} title={strength.naam}>
      <div className="mb-3">
        <div className="h-2 rounded-full bg-ink-700 overflow-hidden">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>{slots.length} oefeningen</span>
          <span>
            {doneSets}/{totalSets} sets
          </span>
        </div>
      </div>

      {plan.cycle.calibration && (
        <p className="text-sm text-rose-300 mb-3">Kalibratieweek: {CALIBRATION_TEXT}.</p>
      )}

      <div className="rounded-2xl border border-ink-600 bg-ink-800 overflow-hidden">
        {slots.map((r, i) => {
          const isActive = active === r.slot.key
          const isHelp = helpOpen.includes(r.slot.key)
          const sets = entries[r.slot.key] ?? []
          const filled = sets.filter((s) => s.reps > 0).length
          const advice = adviceFor(r, state, plan.cycle.calibration)

          return (
            <div
              key={r.slot.key}
              className={`${i > 0 ? 'border-t border-ink-600' : ''} ${isActive ? 'bg-ink-700/40' : ''}`}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  className="flex-1 min-w-0 text-left py-1.5"
                  onClick={() => setActive(isActive ? null : r.slot.key)}
                >
                  <span className="block font-semibold truncate">{r.exercise.naam}</span>
                  <span className="block text-xs text-slate-400 tabular-nums">
                    {r.sets} × {r.repMin === r.repMax ? r.repMin : `${r.repMin}-${r.repMax}`}
                    {r.exercise.perSide && ' p/kant'}
                    {filled > 0 && ` · ${filled} gelogd`}
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
                  {advice && (
                    <p className="text-xs text-slate-400">
                      Schatting {advice.weight} kg —{' '}
                      {advice.source === 'related'
                        ? `afgeleid van ${advice.relatedName}`
                        : 'op basis van je lichaamsgewicht'}
                      . {ADVICE_HINT}
                    </p>
                  )}
                  {sets.map((s, si) => (
                    <div
                      key={si}
                      className={`rounded-xl border p-2 ${
                        s.reps > 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-ink-600 bg-ink-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-400 w-10">Set {si + 1}</span>
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div>
                            <p className="label mb-0.5">kg</p>
                            <Stepper
                              ariaLabel={`Gewicht set ${si + 1}`}
                              value={s.weight}
                              onChange={(v) => updateSet(r.slot.key, si, { weight: v })}
                              step={r.exercise.minIncrement || 1}
                              max={400}
                              placeholder={advice?.weight}
                            />
                          </div>
                          <div>
                            <p className="label mb-0.5">reps</p>
                            <Stepper
                              ariaLabel={`Reps set ${si + 1}`}
                              value={s.reps}
                              onChange={(v) => updateSet(r.slot.key, si, { reps: v })}
                              step={1}
                              max={100}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-slate-400 w-10">RIR</span>
                        {[0, 1, 2, 3, 4].map((n) => (
                          <button
                            key={n}
                            onClick={() => updateSet(r.slot.key, si, { rir: n })}
                            className={`flex-1 min-h-[40px] rounded-lg text-sm font-bold ${
                              s.rir === n ? 'bg-accent text-ink-900' : 'bg-ink-700 border border-ink-600'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button className="btn-quiet btn-sm w-full" onClick={() => addSet(r.slot.key)}>
                    + set toevoegen
                  </button>
                  <RestTimer seconds={r.slot.role === 'core' ? 150 : 90} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className="btn-primary w-full mt-4" onClick={() => setDoneOpen(true)}>
        Sessie afronden
      </button>

      <SlotOptions resolved={optionsFor} date={date} onClose={() => setOptionsFor(null)} />

      <Sheet open={doneOpen} onClose={() => setDoneOpen(false)} title="Sessie afronden">
        {messages === null ? (
          <>
            <p className="text-sm text-slate-400 mb-4">
              {doneSets} van {totalSets} sets gelogd. Lege sets worden genegeerd.
            </p>
            <button
              className="btn-primary w-full"
              onClick={() =>
                setMessages(A.completeSession(date, kind, slots, effectiveEntries(), strength.short))
              }
            >
              Afronden en opslaan
            </button>
          </>
        ) : (
          <>
            <p className="font-semibold text-emerald-300 mb-2">Sessie opgeslagen.</p>
            {messages.length === 0 ? (
              <p className="text-sm text-slate-400 mb-4">Streefwaarden blijven gelijk.</p>
            ) : (
              <ul className="space-y-2 mb-4">
                {messages.map((m, i) => (
                  <li key={i} className="text-sm text-slate-200">
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

/** Tijdens kalibratie geen schatting: dan is "op gevoel" de instructie. */
function adviceFor(r: ResolvedSlot, state: AppState, calibration: boolean) {
  if (calibration) return null
  return startWeightAdvice(r.exercise, state)
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
      className={`shrink-0 w-11 h-11 rounded-full border flex items-center justify-center text-lg font-bold ${
        active ? 'bg-accent text-ink-900 border-accent' : 'bg-ink-700 border-ink-600 text-slate-300'
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
                <span className="text-slate-500" aria-hidden>
                  ·
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Block>
        <Block label="Fout">{c.mistake}</Block>
      </div>
      {exercise.loads.length > 0 && (
        <p className="text-xs text-slate-500">
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
      <div className="text-slate-300">{children}</div>
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

  return (
    <Sheet open onClose={onClose} title={resolved.exercise.naam}>
      {picking === null ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {!target.byFeel && <Chip tone="lift">streef {fmt(target.weight)} kg</Chip>}
            {resolved.reasons.map((x) => (
              <Chip key={x} tone="off">
                {x}
              </Chip>
            ))}
          </div>
          {resolved.warning && <p className="text-sm text-rose-300">{resolved.warning}</p>}
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
          <p className="text-sm text-slate-400 mb-2">
            {picking === 'once'
              ? 'Alleen voor vandaag.'
              : 'Wordt vanaf nu de standaard en rouleert niet mee.'}
          </p>
          {candidates.length === 0 && (
            <p className="text-sm text-slate-400">Geen alternatief beschikbaar binnen je instellingen.</p>
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
    <div className="fixed inset-0 z-40 bg-ink-900 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-ink-900/95 backdrop-blur border-b border-ink-700 safe-top">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button className="btn-ghost btn-sm" onClick={onClose}>
            ← Terug
          </button>
          <span className="font-bold truncate">{title}</span>
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 py-4 pb-24">{children}</div>
    </div>
  )
}
