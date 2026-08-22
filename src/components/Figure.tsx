/**
 * Zijaanzicht-poppetje op basis van gewrichtshoeken.
 *
 * Hoeken in graden. Richtingen worden gerekend als 0° = naar rechts, 90° = omhoog;
 * het poppetje kijkt naar rechts. Gewrichtshoeken zijn relatief aan het vorige
 * segment, waarbij 180° "gestrekt" betekent. Ledemaatlengtes liggen vast.
 */

export const VIEW = { w: 120, h: 140, floor: 128 }

export const LIMB = {
  torso: 30,
  head: 12,
  thigh: 24,
  shin: 24,
  foot: 10,
  upperArm: 18,
  forearm: 17,
}

export interface Pose {
  /** heuppunt in tekencoördinaten */
  root: [number, number]
  /** voorwaartse helling van de romp t.o.v. verticaal (0 = rechtop) */
  torso: number
  /** nekbuiging; positief = kin naar de borst */
  neck: number
  /** linkerzijde (verste been/arm) */
  hip: number
  knee: number
  ankle: number
  shoulder: number
  elbow: number
  /** rechterzijde (dichtstbijzijnde been/arm); leeg = gelijk aan links */
  hipR?: number
  kneeR?: number
  ankleR?: number
  shoulderR?: number
  elbowR?: number
  /**
   * Kant waarheen de elleboog vouwt. Standaard buigt de hand naar de voorkant van
   * het lichaam; bij een stang op de rug vouwt hij de andere kant op.
   */
  elbowDir?: 1 | -1
  /** Kant waarheen de knie vouwt; standaard gaat de hiel naar achteren. */
  kneeDir?: 1 | -1
}

export type Anchor = 'hands' | 'shoulders' | 'hips' | 'feet' | 'head'

export type Prop =
  | { kind: 'barbell'; anchor: Anchor; dy?: number }
  | { kind: 'dumbbells'; anchor: Anchor }
  | { kind: 'bench'; x: number; y: number; w: number; tilt?: number }
  | { kind: 'outline'; points: [number, number][]; closed?: boolean }
  | { kind: 'cable'; anchor: Anchor; to: [number, number] }
  | { kind: 'rail'; x: number; y1: number; y2: number }

type Pt = [number, number]

const rad = (deg: number) => (deg * Math.PI) / 180
const dir = (deg: number): Pt => [Math.cos(rad(deg)), -Math.sin(rad(deg))]
const step = (from: Pt, deg: number, len: number): Pt => {
  const [dx, dy] = dir(deg)
  return [from[0] + dx * len, from[1] + dy * len]
}

export interface Skeleton {
  hip: Pt
  shoulder: Pt
  head: Pt
  knee: [Pt, Pt]
  ankle: [Pt, Pt]
  toe: [Pt, Pt]
  elbow: [Pt, Pt]
  hand: [Pt, Pt]
}

/** Voorwaartse kinematiek: van heup naar romp, hoofd, benen en armen. */
export function computeSkeleton(pose: Pose): Skeleton {
  const hip = pose.root
  const torsoDir = 90 - pose.torso
  const shoulder = step(hip, torsoDir, LIMB.torso)
  const head = step(shoulder, torsoDir - pose.neck, LIMB.head)

  const kneeFold = pose.kneeDir ?? -1
  const leg = (hipA: number, kneeA: number, ankleA: number) => {
    const thighDir = torsoDir - hipA
    const knee = step(hip, thighDir, LIMB.thigh)
    const shinDir = thighDir + kneeFold * (180 - kneeA)
    const ankle = step(knee, shinDir, LIMB.shin)
    const toe = step(ankle, shinDir - ankleA + 180, LIMB.foot)
    return { knee, ankle, toe }
  }

  const fold = pose.elbowDir ?? 1
  const arm = (shoulderA: number, elbowA: number) => {
    const upperDir = torsoDir + 180 + shoulderA
    const elbow = step(shoulder, upperDir, LIMB.upperArm)
    const hand = step(elbow, upperDir + fold * (180 - elbowA), LIMB.forearm)
    return { elbow, hand }
  }

  const legL = leg(pose.hip, pose.knee, pose.ankle)
  const legR = leg(pose.hipR ?? pose.hip, pose.kneeR ?? pose.knee, pose.ankleR ?? pose.ankle)
  const armL = arm(pose.shoulder, pose.elbow)
  const armR = arm(pose.shoulderR ?? pose.shoulder, pose.elbowR ?? pose.elbow)

  return {
    hip,
    shoulder,
    head,
    knee: [legL.knee, legR.knee],
    ankle: [legL.ankle, legR.ankle],
    toe: [legL.toe, legR.toe],
    elbow: [armL.elbow, armR.elbow],
    hand: [armL.hand, armR.hand],
  }
}

function anchorPoint(s: Skeleton, a: Anchor): Pt {
  switch (a) {
    case 'hands':
      return mid(s.hand[0], s.hand[1])
    case 'shoulders':
      return s.shoulder
    case 'hips':
      return s.hip
    case 'feet':
      return mid(s.ankle[0], s.ankle[1])
    case 'head':
      return s.head
  }
}

const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]

/* ---------------- tekenen ---------------- */

/*
 * De kleuren komen uit theme.css, zodat het poppetje meekleurt met het thema. Ze
 * worden als CSS-eigenschap gezet en niet als SVG-attribuut: een attribuut leest
 * geen var().
 */
const NEAR = 'var(--ink)' // de dichtstbijzijnde ledemaat, het duidelijkst
const FAR = 'var(--faint)' // de verste ledemaat, een toon weg
const BODY = 'var(--muted)'
const GEAR = 'var(--accent)' // materiaal: stang, schijf, band
const FLOOR = 'var(--rule-strong)'

function Limb({ pts, color, width = 3.2 }: { pts: Pt[]; color: string; width?: number }) {
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  return (
    <path
      d={d}
      style={{ stroke: color }}
      strokeWidth={width}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function Gear({ prop, skel }: { prop: Prop; skel: Skeleton }) {
  switch (prop.kind) {
    case 'barbell': {
      const [x, y0] = anchorPoint(skel, prop.anchor)
      const y = y0 + (prop.dy ?? 0)
      return (
        <g>
          <circle cx={x} cy={y} r={7} fill="none" style={{ stroke: GEAR }} strokeWidth={2.4} />
          <circle cx={x} cy={y} r={1.8} style={{ fill: GEAR }} />
        </g>
      )
    }
    case 'dumbbells': {
      const [x, y] = anchorPoint(skel, prop.anchor)
      return (
        <g style={{ fill: GEAR }}>
          <rect x={x - 6} y={y - 1.4} width={12} height={2.8} rx={1.2} />
          <rect x={x - 8} y={y - 4.5} width={3.5} height={9} rx={1.4} />
          <rect x={x + 4.5} y={y - 4.5} width={3.5} height={9} rx={1.4} />
        </g>
      )
    }
    case 'bench': {
      const tilt = prop.tilt ?? 0
      return (
        <g style={{ stroke: FLOOR }} fill="none" strokeWidth={2.6} strokeLinecap="round">
          <g transform={`rotate(${-tilt} ${prop.x} ${prop.y})`}>
            <line x1={prop.x} y1={prop.y} x2={prop.x + prop.w} y2={prop.y} />
          </g>
          <line x1={prop.x + prop.w * 0.2} y1={prop.y} x2={prop.x + prop.w * 0.2} y2={VIEW.floor} />
          <line x1={prop.x + prop.w * 0.8} y1={prop.y} x2={prop.x + prop.w * 0.8} y2={VIEW.floor} />
        </g>
      )
    }
    case 'outline':
      return (
        <path
          d={
            prop.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') +
            (prop.closed ? ' Z' : '')
          }
          style={{ stroke: FLOOR }}
          strokeWidth={2.6}
          fill="none"
          strokeLinejoin="round"
        />
      )
    case 'cable': {
      const [x, y] = anchorPoint(skel, prop.anchor)
      return (
        <line
          x1={x}
          y1={y}
          x2={prop.to[0]}
          y2={prop.to[1]}
          style={{ stroke: GEAR }}
          strokeWidth={1.6}
          strokeDasharray="3 2"
        />
      )
    }
    case 'rail':
      return (
        <line
          x1={prop.x}
          y1={prop.y1}
          x2={prop.x}
          y2={prop.y2}
          style={{ stroke: FLOOR }}
          strokeWidth={2.2}
          strokeDasharray="5 3"
        />
      )
  }
}

export function Figure({
  pose,
  props: gear = [],
  label,
  className = '',
}: {
  pose: Pose
  props?: Prop[]
  label?: string
  className?: string
}) {
  const s = computeSkeleton(pose)

  return (
    <figure className={`m-0 ${className}`}>
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        className="w-full h-auto"
        role="img"
        aria-label={label ? `Poppetje: ${label}` : 'Poppetje'}
      >
        <line x1={4} y1={VIEW.floor} x2={VIEW.w - 4} y2={VIEW.floor} style={{ stroke: FLOOR }} strokeWidth={2} />

        {gear
          .filter((p) => p.kind === 'bench' || p.kind === 'outline' || p.kind === 'rail')
          .map((p, i) => (
            <Gear key={`bg${i}`} prop={p} skel={s} />
          ))}

        {/* verste ledematen eerst, zodat de dichtstbijzijnde er overheen komen */}
        <Limb pts={[s.hip, s.knee[0], s.ankle[0], s.toe[0]]} color={FAR} />
        <Limb pts={[s.shoulder, s.elbow[0], s.hand[0]]} color={FAR} />

        <Limb pts={[s.hip, s.shoulder]} color={BODY} width={4.2} />
        <Limb pts={[s.shoulder, s.head]} color={BODY} width={3} />
        <circle cx={s.head[0]} cy={s.head[1]} r={6} style={{ fill: BODY }} />

        <Limb pts={[s.hip, s.knee[1], s.ankle[1], s.toe[1]]} color={NEAR} />
        <Limb pts={[s.shoulder, s.elbow[1], s.hand[1]]} color={NEAR} />

        {gear
          .filter((p) => p.kind === 'barbell' || p.kind === 'dumbbells' || p.kind === 'cable')
          .map((p, i) => (
            <Gear key={`fg${i}`} prop={p} skel={s} />
          ))}
      </svg>
      {label && (
        <figcaption className="mt-tight text-center text-meta text-dim">{label}</figcaption>
      )}
    </figure>
  )
}

/** Start en eind naast elkaar. */
export function FigurePair({
  start,
  end,
  props: gear,
}: {
  start: Pose
  end: Pose
  props?: { start: Prop[]; end: Prop[] }
}) {
  return (
    <div className="grid grid-cols-2 gap-2 border-hair border-rule bg-field-bg p-2">
      <Figure pose={start} props={gear?.start} label="start" />
      <Figure pose={end} props={gear?.end} label="eind" />
    </div>
  )
}
