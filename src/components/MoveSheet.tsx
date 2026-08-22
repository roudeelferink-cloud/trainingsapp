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
      <p className="mb-block text-body text-muted">{hint}</p>
      <div className="flex flex-col gap-in-block">
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
  return <p className="caps pt-tight">{children}</p>
}

function Rij({ target, onPick }: { target: MoveTarget; onPick: (date: string) => void }) {
  if (target.blocked) {
    return (
      <div className="w-full border-hair border-rule px-4 py-3 opacity-60">
        <p className="text-list text-muted">{formatShort(target.date)}</p>
        <p className="text-meta text-dim">{target.blocked}</p>
      </div>
    )
  }

  return (
    <button
      className={`btn-ghost w-full flex-col !items-start py-2 text-list ${
        target.warnings.length > 0 ? 'border-accent' : ''
      }`}
      onClick={() => onPick(target.date)}
    >
      <span>{formatShort(target.date)}</span>
      {target.swapWith && (
        <span className="text-meta text-dim">ruilt met {target.swapWith}</span>
      )}
      {target.warnings.map((w, i) => (
        <span key={i} className="whitespace-normal text-left text-meta text-accent">
          {w}
        </span>
      ))}
    </button>
  )
}
