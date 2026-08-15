import { formatShort } from '../logic/dates'
import type { MoveTarget } from '../logic/day'
import { Sheet } from './ui'

/**
 * Keuzelijst met dagen om een sessie naartoe te verplaatsen. Kracht en loop delen
 * hem, en zowel Vandaag als de weekpagina gebruiken hem, zodat verplaatsen overal
 * dezelfde flow is: dag kiezen, klaar.
 */
export function MoveSheet({
  open,
  onClose,
  targets,
  hint,
  onPick,
}: {
  open: boolean
  onClose: () => void
  targets: MoveTarget[]
  hint: string
  onPick: (date: string) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Verplaats naar">
      <p className="text-sm text-slate-400 mb-3">{hint}</p>
      <div className="space-y-2">
        {targets.map((t) =>
          t.blocked ? (
            <div
              key={t.date}
              className="w-full rounded-xl border border-ink-600 bg-ink-900/40 px-4 py-3 opacity-60"
            >
              <p className="font-semibold text-slate-400">{formatShort(t.date)}</p>
              <p className="text-xs text-slate-400">{t.blocked}</p>
            </div>
          ) : (
            <button
              key={t.date}
              className="btn-ghost w-full flex-col !items-start py-2"
              onClick={() => onPick(t.date)}
            >
              <span>{formatShort(t.date)}</span>
              {t.swapWith && (
                <span className="text-xs font-normal text-slate-400">ruilt met {t.swapWith}</span>
              )}
            </button>
          ),
        )}
      </div>
    </Sheet>
  )
}
