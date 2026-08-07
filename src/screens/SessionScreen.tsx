import { useCallback, useEffect, useState } from 'react'
import { RestTimer } from '../components/RestTimer'
import { Card, Chip, Sheet, Stepper } from '../components/ui'
import { LOAD_LABEL } from '../data/exercises'
import { buildDay } from '../logic/day'
import { formatShort } from '../logic/dates'
import { CALIBRATION_TEXT, fmt, targetFor } from '../logic/progression'
import { swapCandidates, type ResolvedSlot } from '../logic/select'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { DayKind, LoggedSet } from '../types'

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

  const [index, setIndex] = useState(0)
  const [optionsFor, setOptionsFor] = useState<ResolvedSlot | null>(null)
  const [doneOpen, setDoneOpen] = useState(false)
  const [messages, setMessages] = useState<string[] | null>(null)

  // Signatuur van de sessie: verandert bij wisselen, korte versie, deload of check-in.
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

  // Sessie veranderd: opnieuw vullen, maar wat al gelogd is blijft staan.
  if (signature !== seenSignature) {
    const fresh = seed()
    for (const [k, v] of Object.entries(entries)) {
      if (fresh[k] && v.some((s) => s.reps > 0)) fresh[k] = v
    }
    setSeenSignature(signature)
    setEntries(fresh)
  }

  useEffect(() => {
    if (index > slots.length - 1) setIndex(Math.max(0, slots.length - 1))
  }, [slots.length, index])

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

  const r = slots[Math.min(index, slots.length - 1)]
  const sets = entries[r.slot.key] ?? []
  const target = targetFor(r.exercise, r.repMin, state, {
    calibration: plan.cycle.calibration,
    deload: plan.cycle.deload,
  })
  const filled = sets.filter((s) => s.reps > 0).length

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
          <span>
            Oefening {index + 1} van {slots.length}
          </span>
          <span>
            {doneSets}/{totalSets} sets
          </span>
        </div>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight">{r.exercise.naam}</h2>
            <p className="text-sm text-slate-400">
              {r.sets} × {r.repMin === r.repMax ? r.repMin : `${r.repMin}-${r.repMax}`}
              {r.exercise.perSide && ' per been/arm'} ·{' '}
              {r.slot.role === 'core' ? 'kern' : 'accessoire'}
            </p>
          </div>
          <button className="btn-ghost btn-sm shrink-0" onClick={() => setOptionsFor(r)}>
            Opties
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {target.byFeel ? (
            <Chip tone="warn">{CALIBRATION_TEXT}</Chip>
          ) : (
            <Chip tone="lift">
              streef {fmt(target.weight)} kg × {target.reps}
            </Chip>
          )}
          {plan.cycle.deload && <Chip tone="warn">deload −10%</Chip>}
          {r.reasons.map((x) => (
            <Chip key={x} tone="off">
              {x}
            </Chip>
          ))}
        </div>

        {r.warning && <p className="text-sm text-rose-300 mt-2">{r.warning}</p>}
        {r.exercise.cue && <p className="text-sm text-slate-400 mt-2">{r.exercise.cue}</p>}

        <div className="mt-4 space-y-3">
          {sets.map((s, i) => (
            <div
              key={i}
              className={`rounded-xl border p-2 ${
                s.reps > 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-ink-600 bg-ink-900/40'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-slate-400 w-10">Set {i + 1}</span>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <p className="label mb-0.5">kg</p>
                    <Stepper
                      value={s.weight}
                      onChange={(v) => updateSet(r.slot.key, i, { weight: v })}
                      step={r.exercise.minIncrement || 1}
                      max={400}
                      decimals={r.exercise.minIncrement % 1 === 0 ? 0 : 2}
                    />
                  </div>
                  <div>
                    <p className="label mb-0.5">reps</p>
                    <Stepper
                      value={s.reps}
                      onChange={(v) => updateSet(r.slot.key, i, { reps: v })}
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
                    onClick={() => updateSet(r.slot.key, i, { rir: n })}
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
        </div>

        <div className="mt-4">
          <RestTimer seconds={r.slot.role === 'core' ? 150 : 90} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          className="btn-ghost disabled:opacity-40"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
        >
          Vorige
        </button>
        {index < slots.length - 1 ? (
          <button className="btn-primary" onClick={() => setIndex((i) => i + 1)}>
            Volgende
          </button>
        ) : (
          <button className="btn-primary" onClick={() => setDoneOpen(true)}>
            Afronden
          </button>
        )}
      </div>

      <p className="text-center text-xs text-slate-500 mt-3">
        {filled}/{sets.length} sets gelogd voor deze oefening
      </p>

      <SlotOptions
        resolved={optionsFor}
        date={date}
        onClose={() => setOptionsFor(null)}
      />

      <Sheet open={doneOpen} onClose={() => setDoneOpen(false)} title="Sessie afronden">
        {messages === null ? (
          <>
            <p className="text-sm text-slate-400 mb-4">
              {doneSets} van {totalSets} sets gelogd. Lege sets worden genegeerd.
            </p>
            <button
              className="btn-primary w-full"
              onClick={() => {
                const msgs = A.completeSession(date, kind, slots, entries, strength.short)
                setMessages(msgs)
              }}
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

  return (
    <Sheet open onClose={onClose} title={resolved.exercise.naam}>
      {picking === null ? (
        <div className="space-y-2">
          {resolved.exercise.loads.length > 0 && (
            <p className="text-xs text-slate-400 mb-2">
              Belast: {resolved.exercise.loads.map((l) => LOAD_LABEL[l]).join(', ')}
            </p>
          )}
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
  children: React.ReactNode
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
