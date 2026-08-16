import { formatShort } from '../logic/dates'
import type { MoveTarget } from '../logic/day'
import { Sheet } from './ui'

/**
 * Keuzelijst met dagen om een sessie naartoe te verplaatsen. Kracht en loop delen hem,
 * en zowel Vandaag als de weekpagina gebruiken hem, zodat verplaatsen overal dezelfde
 * flow is: dag kiezen, klaar.
 *
 * De lijst loopt beide kanten op — een sessie naar voren halen is net zo goed
 * verplaatsen — en toont per dag wat die keuze oplevert. Een conflict houdt je niet
 * tegen; het staat er alleen bij, zodat je weet wat je kiest.
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
  const eerder = targets.filter((t) => t.earlier)
  const later = targets.filter((t) => !t.earlier)

  return (
    <Sheet open={open} onClose={onClose} title="Verplaats naar">
      <p className="text-sm text-slate-400 mb-3">{hint}</p>
      <div className="space-y-2">
        {eerder.length > 0 && <Kop>Naar voren halen</Kop>}
        {eerder.map((t) => (
          <Rij key={t.date} target={t} onPick={onPick} />
        ))}
        {later.length > 0 && <Kop>Later deze week</Kop>}
        {later.map((t) => (
          <Rij key={t.date} target={t} onPick={onPick} />
        ))}
      </div>
    </Sheet>
  )
}

function Kop({ children }: { children: string }) {
  return <p className="label pt-1">{children}</p>
}

function Rij({ target, onPick }: { target: MoveTarget; onPick: (date: string) => void }) {
  if (target.blocked) {
    return (
      <div className="w-full rounded-xl border border-ink-600 bg-ink-900/40 px-4 py-3 opacity-60">
        <p className="font-semibold text-slate-400">{formatShort(target.date)}</p>
        <p className="text-xs text-slate-400">{target.blocked}</p>
      </div>
    )
  }

  return (
    <button
      className={`btn-ghost w-full flex-col !items-start py-2 ${
        target.warnings.length > 0 ? 'border-amber-500/40' : ''
      }`}
      onClick={() => onPick(target.date)}
    >
      <span>{formatShort(target.date)}</span>
      {target.swapWith && (
        <span className="text-xs font-normal text-slate-400">ruilt met {target.swapWith}</span>
      )}
      {target.warnings.map((w, i) => (
        <span key={i} className="text-xs font-normal text-amber-300 text-left whitespace-normal">
          {w}
        </span>
      ))}
    </button>
  )
}
