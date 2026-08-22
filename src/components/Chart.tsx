import type { Point } from '../logic/stats'
import { formatShort } from '../logic/dates'

/** Kleine lijngrafiek zonder externe libraries. */
export function LineChart({ points, unit = 'kg' }: { points: Point[]; unit?: string }) {
  const w = 320
  const h = 120
  const pad = { l: 30, r: 8, t: 10, b: 18 }
  if (points.length === 0) return null

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const lo = min === max ? min - 5 : min - (max - min) * 0.15
  const hi = min === max ? max + 5 : max + (max - min) * 0.15
  const x = (i: number) =>
    pad.l + (points.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (w - pad.l - pad.r))
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b)

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${d} L${x(points.length - 1).toFixed(1)},${h - pad.b} L${x(0).toFixed(1)},${h - pad.b} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Verloop">
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} className="stroke-rule" strokeWidth="1" />
      <text x="2" y={y(max) + 4} className="fill-dim" fontSize="9">
        {Math.round(max)}
      </text>
      <text x="2" y={y(min) + 4} className="fill-dim" fontSize="9">
        {Math.round(min)}
      </text>
      <path d={area} className="fill-accent" opacity="0.12" />
      <path d={d} fill="none" className="stroke-accent" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r="3" className="fill-accent" />
      ))}
      <text x={pad.l} y={h - 4} className="fill-faint" fontSize="9">
        {formatShort(points[0].date)}
      </text>
      <text x={w - pad.r} y={h - 4} className="fill-faint" fontSize="9" textAnchor="end">
        {formatShort(points[points.length - 1].date)} · {unit}
      </text>
    </svg>
  )
}

/**
 * Staafdiagram zonder externe libraries. Er is één accentkleur, dus die gaat naar
 * wat eruit hoort te springen: de deloadweken. De gewone weken zijn een haarlijngrijs.
 */
export function BarChart({ bars }: { bars: { label: string; value: number; highlight?: boolean }[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <div className="flex h-chart gap-1">
      {bars.map((b, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-1 items-end">
            <div
              className={`w-full ${b.highlight ? 'bg-accent' : 'bg-rule-strong'}`}
              style={{ height: `${(b.value / max) * 100}%` }}
              title={`${b.value} km`}
            />
          </div>
          <span className="w-full truncate text-center text-caps text-faint">{b.label}</span>
        </div>
      ))}
    </div>
  )
}
