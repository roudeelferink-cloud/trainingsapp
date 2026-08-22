import { Stats } from '../components/logboek'
import { Card, Chip, Empty, SectionTitle } from '../components/ui'
import { DAY_LABEL } from '../data/plan'
import { programFor } from '../data/programs'
import { recentActivities } from '../logic/activities'
import { formatShort } from '../logic/dates'
import {
  completedRuns,
  completedSessions,
  trainingStreak,
  weeklyRunVolume,
} from '../logic/stats'
import { useRoot } from '../store/store'
import type { UserState } from '../types'

/**
 * De voortgang van de ander, puur om te kijken. Er staat hier bewust geen knop
 * die iets wijzigt: loggen doe je alleen voor jezelf. De berekeningen draaien
 * over de `UserState` van die ander, dus ze lopen nergens door elkaar.
 */
export function OtherScreen() {
  const root = useRoot()
  const other = Object.values(root.users).find((u) => u.id !== root.currentUser)

  if (!other) {
    return (
      <Card>
        <Empty>Geen tweede gebruiker gevonden.</Empty>
      </Card>
    )
  }

  return <OtherUser user={other} />
}

function OtherUser({ user }: { user: UserState }) {
  const program = programFor(user)
  const weeks = weeklyRunVolume(user, 6)
  const sessions = Object.values(user.sessions)
    .filter((s) => s.completedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)
  const extras = recentActivities(user, 5)

  return (
    <div className="flex flex-col gap-block">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-screen-title text-ink">{user.naam}</h1>
          <p className="text-body text-muted">{program.naam}</p>
        </div>
        <Chip tone="off">meekijken</Chip>
      </div>

      <Stats
        variant="week"
        items={[
          { label: 'Streak', value: String(trainingStreak(user)) },
          { label: 'Sessies', value: String(completedSessions(user)) },
          { label: 'Loops', value: String(completedRuns(user)) },
        ]}
      />

      <Card>
        <SectionTitle>Kilometers per week</SectionTitle>
        {weeks.every((w) => w.km === 0) ? (
          <Empty>Nog geen loops gelogd.</Empty>
        ) : (
          <ul className="space-y-1">
            {[...weeks].reverse().map((w) => (
              <li key={w.weekStart} className="flex justify-between text-sm">
                <span className="text-dim">week {w.week}</span>
                <span className="tabular-nums font-semibold">{w.km} km</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle>Afgelopen sessies</SectionTitle>
        {sessions.length === 0 ? (
          <Empty>Nog geen sessies afgerond.</Empty>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={`${s.date}:${s.kind}`} className="flex justify-between gap-2 text-sm">
                <span className="truncate">{DAY_LABEL[s.kind] ?? s.kind}</span>
                <span className="shrink-0 text-dim">{formatShort(s.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {extras.length > 0 && (
        <Card>
          <SectionTitle>Losse activiteiten</SectionTitle>
          <ul className="space-y-1">
            {extras.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 text-sm">
                <span className="truncate">
                  {a.type} {a.minutes} min
                </span>
                <span className="shrink-0 text-dim">{formatShort(a.date)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-meta leading-meta text-faint">
        Alleen om te kijken. Wat {user.naam} logt telt niet mee in jouw progressie of
        gewichtsadvies, en andersom net zo min.
      </p>
    </div>
  )
}
