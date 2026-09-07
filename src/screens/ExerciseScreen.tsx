import { LineChart } from '../components/Chart'
import { Actions, Caps, Primary, Screen, Stats, TopLine } from '../components/logboek'
import { SetsRegel } from '../components/Sets'
import { Empty } from '../components/ui'
import { getExercise } from '../data/exercises'
import { isBandExercise } from '../logic/band'
import { formatShort } from '../logic/dates'
import { historyFor } from '../logic/history'
import { fmt } from '../logic/progression'
import { useStore } from '../store/store'

/** Hoe ver de pagina per oefening terugkijkt. */
export const HISTORY_WEEKS = 12

/**
 * Eén oefening, over de tijd.
 *
 * Alleen kijken: hier valt niets te bewerken en niets te loggen. Dat is bewust — een
 * historiescherm waar je per ongeluk een sessie van drie weken terug kunt aanpassen is
 * geen historie meer. Wat er wél staat is het antwoord op de vraag waarvoor je hier komt:
 * loopt het op, en wat deed ik precies.
 *
 * De lijn toont per sessie de zwaarste set, want dat is de maat die je zelf ook gebruikt
 * als je naar een oefening kijkt. Bij bandwerk is dat het bandniveau; kilo's bestaan daar
 * niet.
 */
export function ExerciseScreen({
  exerciseId,
  onClose,
}: {
  exerciseId: string
  onClose: () => void
}) {
  const state = useStore()
  const exercise = getExercise(exerciseId)
  const band = isBandExercise(exercise)
  const sessies = historyFor(state, exerciseId, HISTORY_WEEKS)
  const punten = sessies.filter((s) => s.top > 0).map((s) => ({ date: s.date, value: s.top }))
  const zwaarste = punten.reduce((m, p) => Math.max(m, p.value), 0)

  return (
    <div className="safe-top fixed inset-0 z-40 flex flex-col bg-bg">
      <Screen
        bottom="free"
        action={
          <Actions>
            <Primary onClick={onClose}>Klaar</Primary>
          </Actions>
        }
      >
        <TopLine
          left={
            <button type="button" onClick={onClose} className="text-muted">
              ← Historie
            </button>
          }
          right={`${HISTORY_WEEKS} weken`}
        />

        <h1 className="mt-block font-serif text-exercise leading-exercise text-ink">
          {exercise.naam}
        </h1>

        <div className="mt-block">
          <Stats
            variant="week"
            items={[
              { label: 'Sessies', value: String(sessies.length) },
              {
                label: band ? 'Zwaarste band' : 'Zwaarste set',
                value: zwaarste > 0 ? (band ? `n${zwaarste}` : fmt(zwaarste)) : '—',
                suffix: zwaarste > 0 && !band ? ' kg' : undefined,
                flex: 1.2,
              },
            ]}
          />
        </div>

        <div className="mt-block flex flex-col gap-in-block">
          <Caps>{band ? 'Bandniveau per sessie' : 'Zwaarste set per sessie'}</Caps>
          {punten.length === 0 ? (
            <Empty>Nog geen sessie met deze oefening in de afgelopen {HISTORY_WEEKS} weken.</Empty>
          ) : (
            <LineChart points={punten} unit={band ? 'niveau' : 'kg'} />
          )}
        </div>

        <div className="mt-block flex flex-col gap-in-block">
          <Caps>Sessies</Caps>
          {sessies.length === 0 ? (
            <Empty>Nog niets gelogd.</Empty>
          ) : (
            <div className="flex flex-col">
              {[...sessies].reverse().map((s, i, alles) => (
                <div
                  key={`${s.key}:${s.slotKey}`}
                  className={`border-t-hair border-rule py-row ${
                    i === alles.length - 1 ? 'border-b-hair' : ''
                  }`}
                >
                  <SetsRegel exercise={exercise} sets={s.sets} lead={formatShort(s.date)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Screen>
    </div>
  )
}
