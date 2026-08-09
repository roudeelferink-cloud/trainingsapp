import { useState } from 'react'
import {
  ACTIVITY_INTENSITIES,
  ACTIVITY_TYPES,
  DEFAULT_ACTIVITY_MINUTES,
  activitySummary,
} from '../logic/activities'
import { formatShort } from '../logic/dates'
import * as A from '../store/actions'
import type { Activity, ActivityIntensity, ActivityType } from '../types'
import { Chip, Sheet, Stepper } from './ui'

/**
 * Invoer en weergave van losse activiteiten. Bewust licht: type, duur, intensiteit
 * en een notitie. Geen sets of reps — dit is geen krachtwerk en telt ook nergens
 * in mee.
 */

export function ActivitySheet({
  open,
  onClose,
  date,
  activity,
}: {
  open: boolean
  onClose: () => void
  /** dag waarop een nieuwe activiteit terechtkomt; te wijzigen in het formulier */
  date: string
  /** meegegeven = bewerken, weggelaten = nieuw */
  activity?: Activity
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={activity ? 'Activiteit bewerken' : 'Activiteit toevoegen'}
    >
      <ActivityForm date={date} activity={activity} onDone={onClose} />
    </Sheet>
  )
}

function ActivityForm({
  date,
  activity,
  onDone,
}: {
  date: string
  activity?: Activity
  onDone: () => void
}) {
  const [type, setType] = useState<ActivityType>(activity?.type ?? 'fietsen')
  const [minutes, setMinutes] = useState(activity?.minutes ?? DEFAULT_ACTIVITY_MINUTES)
  const [intensity, setIntensity] = useState<ActivityIntensity>(activity?.intensity ?? 'normaal')
  const [note, setNote] = useState(activity?.note ?? '')
  const [day, setDay] = useState(activity?.date ?? date)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function save() {
    if (activity) {
      A.updateActivity(activity.id, { type, minutes, intensity, note, date: day })
    } else {
      A.addActivity(day, { type, minutes, intensity, note })
    }
    onDone()
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="label mb-1">Wat</p>
        <div className="grid grid-cols-3 gap-2">
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`btn btn-sm ${
                type === t.id ? 'bg-accent text-ink-900' : 'bg-ink-700 border border-ink-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label mb-1">Duur (min)</p>
        <Stepper value={minutes} onChange={setMinutes} step={5} min={1} max={600} suffix="min" />
      </div>

      <div>
        <p className="label mb-1">Intensiteit</p>
        <div className="grid grid-cols-3 gap-2">
          {ACTIVITY_INTENSITIES.map((i) => (
            <button
              key={i.id}
              onClick={() => setIntensity(i.id)}
              className={`btn btn-sm ${
                intensity === i.id ? 'bg-accent text-ink-900' : 'bg-ink-700 border border-ink-600'
              }`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label mb-1">Datum</p>
        <input
          className="field"
          type="date"
          aria-label="Datum"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
        <p className="text-xs text-slate-400 mt-1">
          Staat op {formatShort(day)}. Achteraf invullen mag.
        </p>
      </div>

      <div>
        <p className="label mb-1">Notitie (optioneel)</p>
        <input
          className="field"
          placeholder="Bijvoorbeeld: rondje met de kinderen"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <button className="btn-primary w-full" onClick={save}>
        {activity ? 'Opslaan' : 'Toevoegen'}
      </button>

      {activity &&
        (confirmDelete ? (
          <div className="space-y-2">
            <button
              className="btn w-full bg-rose-500 text-ink-900"
              onClick={() => {
                A.removeActivity(activity.id)
                onDone()
              }}
            >
              Ja, verwijderen
            </button>
            <button className="btn-quiet w-full" onClick={() => setConfirmDelete(false)}>
              Annuleren
            </button>
          </div>
        ) : (
          <button className="btn-quiet w-full" onClick={() => setConfirmDelete(true)}>
            Verwijderen
          </button>
        ))}
    </div>
  )
}

/** Lijst met gelogde activiteiten. Altijd herkenbaar als extra, nooit als schema. */
export function ActivityList({
  items,
  onEdit,
  showDate = false,
}: {
  items: Activity[]
  onEdit: (a: Activity) => void
  showDate?: boolean
}) {
  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li
          key={a.id}
          className="flex items-start justify-between gap-2 rounded-xl border border-ink-600 bg-ink-700/40 p-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Chip tone="neutral">Extra</Chip>
              {showDate && <span className="text-xs text-slate-400">{formatShort(a.date)}</span>}
            </div>
            <p className="font-semibold mt-1">{activitySummary(a)}</p>
            {a.note && <p className="text-sm text-slate-400 break-words">{a.note}</p>}
          </div>
          <button className="btn-ghost btn-sm shrink-0" onClick={() => onEdit(a)}>
            Bewerk
          </button>
        </li>
      ))}
    </ul>
  )
}
