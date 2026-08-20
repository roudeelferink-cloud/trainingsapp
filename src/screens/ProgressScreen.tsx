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
  weeklyStrengthVolume,
} from '../logic/stats'
import { useStore } from '../store/store'
import type { Activity } from '../types'

export function ProgressScreen() {
  const state = useStore()
  const series = oneRmSeries(state)
  const volume = weeklyRunVolume(state, 12)
  const tonnage = weeklyStrengthVolume(state, 12)
  const [open, setOpen] = useState<string | null>(series[0]?.exerciseId ?? null)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 divide-x divide-line border-y border-line">
        <div className="py-3 px-2 text-center">
          <p className="text-2xl num leading-tight">{completedSessions(state)}</p>
          <p className="label mt-0.5">krachtsessies</p>
        </div>
        <div className="py-3 px-2 text-center">
          <p className="text-2xl num leading-tight">{completedRuns(state)}</p>
          <p className="label mt-0.5">looptrainingen</p>
        </div>
        <div className="py-3 px-2 text-center">
          <p className="text-2xl num leading-tight">{activityCount(state)}</p>
          <p className="label mt-0.5">extra activiteiten</p>
        </div>
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
            <p className="text-xs text-muted mt-2">
              Lichtere balk = deloadweek. De app schaalt automatisch terug als een week meer dan 10% boven het
              gemiddelde van de twee voorgaande weken zou uitkomen. Losse rondjes hardlopen tellen mee.
            </p>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>Tilvolume per week</SectionTitle>
        {tonnage.every((v) => v.kg === 0) ? (
          <Empty>Nog geen krachtsessie afgerond.</Empty>
        ) : (
          <>
            <BarChart
              bars={tonnage.map((v) => ({ label: `w${v.week}`, value: v.kg, highlight: v.deload }))}
            />
            <p className="text-xs text-muted mt-2">
              Gewicht × reps over alle sets. Bij dumbbells telt het gewicht van beide dumbbells mee,
              en bij werk per kant beide kanten.
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
                <div key={s.exerciseId} className="rounded border border-line overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between gap-2 p-3 text-left"
                    onClick={() => setOpen(isOpen ? null : s.exerciseId)}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{s.naam}</span>
                      <span className="block text-xs text-muted">
                        streef {fmt(es.targetWeight)} kg × {es.targetReps ?? '—'} · {s.points.length} sessies
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="num font-medium">{last.value} kg</span>
                      {delta !== 0 && (
                        <Chip>
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

      <Deviations />

      {state.notices.length > 0 && (
        <Card>
          <SectionTitle>Meldingen</SectionTitle>
          <ul className="space-y-2">
            {[...state.notices]
              .reverse()
              .slice(0, 15)
              .map((n, i) => (
                <li key={i} className="text-sm text-fg">
                  <span className="text-faint">{n.date}</span> — {n.text}
                </li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/**
 * Waar je van de voorstellen afweek.
 *
 * Geen verwijt en geen correctie: de app remt af, ze houdt niemand tegen. Het staat hier
 * omdat het patroon iets zegt — wie elke zondag twee kilometer verder loopt dan gepland,
 * heeft geen ander advies nodig maar een ander plan.
 */
function Deviations() {
  const state = useStore()
  const items = [...(state.deviations ?? [])].reverse().slice(0, 20)

  return (
    <Card>
      <SectionTitle right={items.length > 0 ? <Chip>{state.deviations.length}</Chip> : undefined}>
        Afwijkingen van het voorstel
      </SectionTitle>
      {items.length === 0 ? (
        <Empty>Nog geen afwijkingen. Ze verschijnen hier vanzelf als je iets anders doet.</Empty>
      ) : (
        <ul className="space-y-2">
          {items.map((d) => (
            <li key={d.id} className="text-sm text-fg">
              <span className="text-faint">{d.date}</span> — {d.note}
            </li>
          ))}
        </ul>
      )}
    </Card>
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
          <p className="text-xs text-muted mt-2">
            Deze tellen niet mee in de 1RM-grafiek. Een los rondje hardlopen telt wél mee in je
            weekkilometers: je pezen weten niet of het in het schema stond.
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
