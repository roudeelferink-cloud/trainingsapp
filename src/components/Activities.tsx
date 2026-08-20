import { useState } from 'react'
import {
  ACTIVITY_INTENSITIES,
  ACTIVITY_TYPES,
  DEFAULT_ACTIVITY_MINUTES,
  activityPace,
  activitySummary,
  supportsDistance,
} from '../logic/activities'
import { formatShort } from '../logic/dates'
import * as A from '../store/actions'
import type { Activity, ActivityIntensity, ActivityType } from '../types'
import { ChoiceGrid, Chip, Sheet, Stepper } from './ui'

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
  const [km, setKm] = useState(activity?.distanceKm ?? 0)
  const [intensity, setIntensity] = useState<ActivityIntensity>(activity?.intensity ?? 'normaal')
  const [note, setNote] = useState(activity?.note ?? '')
  const [day, setDay] = useState(activity?.date ?? date)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // afstand vragen we alleen bij hardlopen, fietsen en wandelen
  const metAfstand = supportsDistance(type)

  function save() {
    const input = { type, minutes, intensity, note, distanceKm: metAfstand ? km : null }
    if (activity) {
      A.updateActivity(activity.id, { ...input, date: day })
    } else {
      A.addActivity(day, input)
    }
    onDone()
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="label mb-1">Wat</p>
        <ChoiceGrid
          options={ACTIVITY_TYPES}
          value={type}
          onChange={setType}
          buttonClass="min-h-[44px] px-3 text-sm rounded-lg"
        />
      </div>

      <div>
        <p className="label mb-1">Duur (min)</p>
        <Stepper
          ariaLabel="Duur in minuten"
          value={minutes}
          onChange={setMinutes}
          step={5}
          min={1}
          max={600}
          suffix="min"
        />
      </div>

      {metAfstand && (
        <div>
          <p className="label mb-1">Afstand (km)</p>
          <Stepper
            ariaLabel="Afstand in kilometer"
            value={km}
            onChange={setKm}
            step={0.5}
            min={0}
            max={300}
            decimals={1}
            suffix="km"
          />
          <p className="text-xs text-slate-400 mt-1">
            {tempoHint(type, minutes, km) ?? 'Laat op 0 staan als je de afstand niet weet.'}
          </p>
        </div>
      )}

      <div>
        <p className="label mb-1">Intensiteit</p>
        <ChoiceGrid
          options={ACTIVITY_INTENSITIES}
          value={intensity}
          onChange={setIntensity}
          buttonClass="min-h-[44px] px-3 text-sm rounded-lg"
        />
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

/**
 * Live tempo terwijl je invult, zodat je meteen ziet of de ingevoerde afstand klopt.
 * Rekent op dezelfde manier als de historie: min/km bij lopen, km/u bij fietsen.
 */
function tempoHint(type: ActivityType, minutes: number, km: number): string | null {
  const pace = activityPace({
    id: '', date: '', createdAt: '', note: null, intensity: 'normaal',
    type, minutes, distanceKm: km,
  })
  return pace === null ? null : `Gemiddeld ${pace}.`
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
            {activityPace(a) && (
              <p className="text-sm text-slate-400 tabular-nums">
                gemiddeld {activityPace(a)}
              </p>
            )}
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
