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
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="var(--c-line)" strokeWidth="1" />
      <text x="2" y={y(max) + 4} fill="var(--c-muted)" fontSize="9">
        {Math.round(max)}
      </text>
      <text x="2" y={y(min) + 4} fill="var(--c-muted)" fontSize="9">
        {Math.round(min)}
      </text>
      <path d={area} fill="var(--c-fg)" opacity="0.08" />
      <path d={d} fill="none" stroke="var(--c-fg)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r="3" fill="var(--c-fg)" />
      ))}
      <text x={pad.l} y={h - 4} fill="var(--c-faint)" fontSize="9">
        {formatShort(points[0].date)}
      </text>
      <text x={w - pad.r} y={h - 4} fill="var(--c-faint)" fontSize="9" textAnchor="end">
        {formatShort(points[points.length - 1].date)} · {unit}
      </text>
    </svg>
  )
}

export function BarChart({ bars }: { bars: { label: string; value: number; highlight?: boolean }[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <div className="flex items-end gap-1 h-28">
      {bars.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className={`w-full rounded-t ${b.highlight ? 'bg-faint' : 'bg-muted'}`}
            style={{ height: `${(b.value / max) * 88}px` }}
            title={`${b.value} km`}
          />
          <span className="text-[9px] text-faint truncate w-full text-center">{b.label}</span>
        </div>
      ))}
    </div>
  )
}
