import { setLabels, setsUnit } from '../logic/history'
import type { Exercise, LoggedSet } from '../types'

/**
 * Eén regel gelogde sets: "vr 4 sep · 100 × 12 · 100 × 12 · 100 × 10".
 *
 * Dezelfde regel staat op twee plekken — onder de oefeningkop tijdens een sessie, en in
 * de historie per oefening — dus staat hij hier één keer. Een set die naar beneden
 * bijgesteld is staat een toon zachter: hij telde niet mee voor de opbouw, en dat hoor je
 * te kunnen zien zonder dat er een uitroepteken bij hoeft.
 */
export function SetsRegel({
  exercise,
  sets,
  lead,
  extra,
}: {
  exercise: Exercise
  sets: LoggedSet[]
  /** wat er vóór de sets staat; meestal de datum */
  lead: string
  /** wat er achter de sets komt; bijvoorbeeld het streefgewicht van nu */
  extra?: string
}) {
  const labels = setLabels(exercise, sets)
  const eenheid = setsUnit(exercise)
  if (labels.length === 0) return null

  return (
    <p className="text-meta leading-meta text-dim">
      <span className="text-muted">{lead}</span>
      {labels.map((l, i) => (
        <span key={i} className={l.down ? 'text-faint' : undefined}>
          {' · '}
          {l.text}
        </span>
      ))}
      {eenheid ? <span className="text-faint">{` · ${eenheid}`}</span> : null}
      {extra ? <span className="text-muted">{` · ${extra}`}</span> : null}
    </p>
  )
}
