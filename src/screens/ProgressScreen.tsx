import { useState } from 'react'
import { ActivityList, ActivitySheet } from '../components/Activities'
import { BarChart, LineChart } from '../components/Chart'
import { Card, Chip, Empty, SectionTitle } from '../components/ui'
import { activityCount, recentActivities } from '../logic/activities'
import { today } from '../logic/dates'
import { fmt, stateFor } from '../logic/progression'
import {
  completedRuns,
  completedSessions,
  oneRmSeries,
  weeklyRunVolume,
} from '../logic/stats'
import { useStore } from '../store/store'
import type { Activity } from '../types'

export function ProgressScreen() {
  const state = useStore()
  const series = oneRmSeries(state)
  const volume = weeklyRunVolume(state, 12)
  const [open, setOpen] = useState<string | null>(series[0]?.exerciseId ?? null)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-3xl font-bold tabular-nums">{completedSessions(state)}</p>
          <p className="text-xs text-slate-400">krachtsessies</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold tabular-nums">{completedRuns(state)}</p>
          <p className="text-xs text-slate-400">looptrainingen</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold tabular-nums">{activityCount(state)}</p>
          <p className="text-xs text-slate-400">extra activiteiten</p>
        </Card>
      </div>

      <Card>
        <SectionTitle>Hardloopvolume per week</SectionTitle>
        {volume.every((v) => v.km === 0) ? (
          <Empty>Nog geen loops gelogd.</Empty>
        ) : (
          <>
            <BarChart
              bars={volume.map((v) => ({ label: `w${v.week}`, value: v.km, highlight: v.deload }))}
            />
            <p className="text-xs text-slate-400 mt-2">
              Oranje = deloadweek. De app schaalt automatisch terug als een week meer dan 10% boven de
              vorige zou uitkomen.
            </p>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Geschat 1RM per oefening</SectionTitle>
        {series.length === 0 ? (
          <Empty>Log een sessie om je verloop te zien.</Empty>
        ) : (
          <div className="space-y-2">
            {series.map((s) => {
              const es = stateFor(state, s.exerciseId)
              const last = s.points[s.points.length - 1]
              const first = s.points[0]
              const delta = last.value - first.value
              const isOpen = open === s.exerciseId
              return (
                <div key={s.exerciseId} className="rounded-xl border border-ink-600 overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between gap-2 p-3 text-left"
                    onClick={() => setOpen(isOpen ? null : s.exerciseId)}
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{s.naam}</span>
                      <span className="block text-xs text-slate-400">
                        streef {fmt(es.targetWeight)} kg × {es.targetReps ?? '—'} · {s.points.length} sessies
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums font-bold">{last.value} kg</span>
                      {delta !== 0 && (
                        <Chip tone={delta > 0 ? 'ok' : 'warn'}>
                          {delta > 0 ? '+' : ''}
                          {Math.round(delta * 10) / 10}
                        </Chip>
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-2 pb-2">
                      <LineChart points={s.points} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <ExtraActivityHistory />

      {state.notices.length > 0 && (
        <Card>
          <SectionTitle>Meldingen</SectionTitle>
          <ul className="space-y-2">
            {[...state.notices]
              .reverse()
              .slice(0, 15)
              .map((n, i) => (
                <li key={i} className="text-sm text-slate-300">
                  <span className="text-slate-500">{n.date}</span> — {n.text}
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/**
 * Historie van alles buiten het schema om. Bewust een eigen blok: hier hoort geen
 * geplande sessie tussen te staan.
 */
function ExtraActivityHistory() {
  const state = useStore()
  const items = recentActivities(state, 30)
  const [edit, setEdit] = useState<Activity | null>(null)

  return (
    <Card>
      <SectionTitle>Losse activiteiten</SectionTitle>
      {items.length === 0 ? (
        <Empty>Nog niets gelogd naast het schema.</Empty>
      ) : (
        <>
          <ActivityList items={items} showDate onEdit={setEdit} />
          <p className="text-xs text-slate-400 mt-2">
            Deze tellen niet mee in de 1RM-grafiek of het hardloopvolume.
          </p>
        </>
      )}
      <ActivitySheet
        open={edit !== null}
        onClose={() => setEdit(null)}
        date={edit?.date ?? today()}
        activity={edit ?? undefined}
      />
    </Card>
  )
}
