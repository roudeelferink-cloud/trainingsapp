import { useState, type ReactNode } from 'react'
import { ActivityList, ActivitySheet } from '../components/Activities'
import { BarChart, LineChart } from '../components/Chart'
import { Caps, Link, Screen, Stats } from '../components/logboek'
import { Empty } from '../components/ui'
import { activityCount, recentActivities } from '../logic/activities'
import { today } from '../logic/dates'
import { fmt, stateFor } from '../logic/progression'
import {
  completedRuns,
  completedSessions,
  oneRmSeries,
  trainingStreak,
  weeklyRunVolume,
  weeklyStrengthVolume,
} from '../logic/stats'
import { useStore } from '../store/store'
import type { Activity } from '../types'

/**
 * Historie: wat er achter je ligt.
 *
 * Het ontwerp laat dit scherm vrij — er staat alleen dat het de derde bestemming in
 * de balk is. Het volgt daarom de vorm van Week: een kop, de cijfers tussen
 * haarlijnen, en daaronder blokken die met een kapitaal-label beginnen. Er is niets
 * te doen op dit scherm, dus er is ook geen actiezone; een knop die alleen ruimte
 * vult hoort er niet.
 *
 * Instellingen hangt hier: die staat niet in de navigatiebalk, want dat is de balk
 * van wat je elke dag doet.
 */
export function HistoryScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const state = useStore()
  const series = oneRmSeries(state)
  const volume = weeklyRunVolume(state, 12)
  const tonnage = weeklyStrengthVolume(state, 12)
  const [open, setOpen] = useState<string | null>(series[0]?.exerciseId ?? null)
  const streak = trainingStreak(state)

  return (
    <Screen>
      <div className="flex items-baseline justify-between gap-column">
        <h1 className="font-serif text-screen-title text-ink">Historie</h1>
        <Link onClick={onOpenSettings}>Instellingen</Link>
      </div>

      <div className="mt-block">
        <Stats
          variant="week"
          items={[
            { label: 'Sessies', value: String(completedSessions(state)) },
            { label: 'Loops', value: String(completedRuns(state)) },
            { label: 'Extra', value: String(activityCount(state)) },
            { label: 'Streak', value: String(streak), suffix: streak === 1 ? ' dag' : ' dgn' },
          ]}
        />
      </div>

      <Blok label="Hardloopvolume per week">
        {volume.every((v) => v.km === 0) ? (
          <Empty>Nog geen loops gelogd.</Empty>
        ) : (
          <>
            <BarChart
              bars={volume.map((v) => ({ label: `w${v.week}`, value: v.km, highlight: v.deload }))}
            />
            <Uitleg>
              Oker = deloadweek. De app schaalt automatisch terug als een week meer dan 10% boven het
              gemiddelde van de twee voorgaande weken zou uitkomen. Losse rondjes hardlopen tellen mee.
            </Uitleg>
          </>
        )}
      </Blok>

      <Blok label="Tilvolume per week">
        {tonnage.every((v) => v.kg === 0) ? (
          <Empty>Nog geen krachtsessie afgerond.</Empty>
        ) : (
          <>
            <BarChart
              bars={tonnage.map((v) => ({ label: `w${v.week}`, value: v.kg, highlight: v.deload }))}
            />
            <Uitleg>
              Gewicht × reps over alle sets. Bij dumbbells telt het gewicht van beide dumbbells mee,
              en bij werk per kant beide kanten.
            </Uitleg>
          </>
        )}
      </Blok>

      <Blok label="Geschat 1RM per oefening">
        {series.length === 0 ? (
          <Empty>Log een sessie om je verloop te zien.</Empty>
        ) : (
          <div className="flex flex-col">
            {series.map((s, i) => {
              const es = stateFor(state, s.exerciseId)
              const last = s.points[s.points.length - 1]
              const first = s.points[0]
              const delta = Math.round((last.value - first.value) * 10) / 10
              const isOpen = open === s.exerciseId
              return (
                <div
                  key={s.exerciseId}
                  className={`border-t-hair border-rule ${i === series.length - 1 ? 'border-b-hair' : ''}`}
                >
                  <button
                    className="flex w-full items-center justify-between gap-column py-row text-left"
                    onClick={() => setOpen(isOpen ? null : s.exerciseId)}
                    aria-expanded={isOpen}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-list text-ink">{s.naam}</span>
                      <span className="block text-meta text-dim">
                        streef {fmt(es.targetWeight)} kg × {es.targetReps ?? '—'} · {s.points.length} sessies
                      </span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-in-block">
                      <span className="font-serif text-set-value text-ink">{last.value} kg</span>
                      {delta !== 0 && (
                        <span className={`text-meta ${delta > 0 ? 'text-accent' : 'text-faint'}`}>
                          {delta > 0 ? '+' : ''}
                          {delta}
                        </span>
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-row">
                      <LineChart points={s.points} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Blok>

      <ExtraActivityHistory />
      <Deviations />

      {state.notices.length > 0 && (
        <Blok label="Meldingen">
          <ul className="flex flex-col">
            {[...state.notices]
              .reverse()
              .slice(0, 15)
              .map((n, i) => (
                <li key={i} className="border-t-hair border-rule py-row text-body text-muted last:border-b-hair">
                  <span className="text-faint">{n.date}</span> — {n.text}
                </li>
              ))}
          </ul>
        </Blok>
      )}
    </Screen>
  )
}

/** Een blok met een kapitaal-label erboven; het ritme van het hele ontwerp. */
function Blok({ label, right, children }: { label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-block flex flex-col gap-in-block">
      <div className="flex items-baseline justify-between gap-column">
        <Caps>{label}</Caps>
        {right}
      </div>
      {children}
    </div>
  )
}

function Uitleg({ children }: { children: ReactNode }) {
  return <p className="text-meta leading-meta text-dim">{children}</p>
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
    <Blok
      label="Afwijkingen van het voorstel"
      right={items.length > 0 ? <span className="text-meta text-faint">{state.deviations.length}</span> : undefined}
    >
      {items.length === 0 ? (
        <Empty>Nog geen afwijkingen. Ze verschijnen hier vanzelf als je iets anders doet.</Empty>
      ) : (
        <ul className="flex flex-col">
          {items.map((d) => (
            <li key={d.id} className="border-t-hair border-rule py-row text-body text-muted last:border-b-hair">
              <span className="text-faint">{d.date}</span> — {d.note}
            </li>
          ))}
        </ul>
      )}
    </Blok>
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
    <Blok label="Losse activiteiten">
      {items.length === 0 ? (
        <Empty>Nog niets gelogd naast het schema.</Empty>
      ) : (
        <>
          <ActivityList items={items} showDate onEdit={setEdit} />
          <Uitleg>
            Deze tellen niet mee in de 1RM-grafiek. Een los rondje hardlopen telt wél mee in je
            weekkilometers: je pezen weten niet of het in het schema stond.
          </Uitleg>
        </>
      )}
      <ActivitySheet
        open={edit !== null}
        onClose={() => setEdit(null)}
        date={edit?.date ?? today()}
        activity={edit ?? undefined}
      />
    </Blok>
  )
}
