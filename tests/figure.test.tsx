import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Figure, FigurePair, VIEW, computeSkeleton, type Pose } from '../src/components/Figure'
import { EXERCISES, getExercise } from '../src/data/exercises'
import { FIGURES, getFigure } from '../src/data/figures'

const JOINTS: (keyof Pose)[] = ['torso', 'neck', 'hip', 'knee', 'ankle', 'shoulder', 'elbow']

function allPoints(pose: Pose): [string, [number, number]][] {
  const s = computeSkeleton(pose)
  return [
    ['heup', s.hip], ['schouder', s.shoulder], ['hoofd', s.head],
    ['knieL', s.knee[0]], ['knieR', s.knee[1]],
    ['enkelL', s.ankle[0]], ['enkelR', s.ankle[1]],
    ['teenL', s.toe[0]], ['teenR', s.toe[1]],
    ['elleboogL', s.elbow[0]], ['elleboogR', s.elbow[1]],
    ['handL', s.hand[0]], ['handR', s.hand[1]],
  ]
}

const withFigure = EXERCISES.filter((e) => e.hasFigure)

describe('welke oefeningen een poppetje krijgen', () => {
  it('geeft alleen samengestelde oefeningen een poppetje', () => {
    expect(withFigure.length).toBeGreaterThan(20)
    for (const ex of withFigure) expect(getFigure(ex.id), ex.id).not.toBeNull()
  })

  it('slaat isolatie, band- en kabelwerk en romp over', () => {
    const zonder = ['leg_extension', 'triceps_pushdown', 'band_curl', 'band_lateral_walk', 'plank', 'cable_crunch']
    for (const id of zonder) {
      expect(getExercise(id).hasFigure, id).toBe(false)
      expect(getFigure(id), id).toBeNull()
    }
  })

  it('verwijst nergens naar een oefening die niet bestaat', () => {
    const ids = new Set(EXERCISES.map((e) => e.id))
    expect(Object.keys(FIGURES).filter((k) => !ids.has(k))).toEqual([])
  })

  it('zet hasFigure alleen waar er ook echt een figuur is', () => {
    for (const ex of EXERCISES) expect(ex.hasFigure, ex.id).toBe(ex.id in FIGURES)
  })
})

describe('hoekensets', () => {
  it.each(withFigure.map((e) => [e.id] as const))('%s heeft twee complete hoekensets', (id) => {
    const spec = getFigure(id)!
    for (const which of ['start', 'end'] as const) {
      const pose = spec[which]
      expect(pose.root, `${which}: root ontbreekt`).toHaveLength(2)
      for (const joint of JOINTS) {
        expect(typeof pose[joint], `${which}: ${String(joint)} ontbreekt`).toBe('number')
        expect(Number.isFinite(pose[joint]), `${which}: ${String(joint)} is geen getal`).toBe(true)
      }
    }
  })

  it('geeft start en eind verschillende houdingen', () => {
    for (const ex of withFigure) {
      const { start, end } = getFigure(ex.id)!
      expect(JSON.stringify(start), ex.id).not.toBe(JSON.stringify(end))
    }
  })

  it('houdt elk lichaamspunt binnen het kader', () => {
    for (const ex of withFigure) {
      const spec = getFigure(ex.id)!
      for (const which of ['start', 'end'] as const) {
        for (const [naam, [x, y]] of allPoints(spec[which])) {
          expect(x, `${ex.id}/${which} ${naam} x`).toBeGreaterThanOrEqual(0)
          expect(x, `${ex.id}/${which} ${naam} x`).toBeLessThanOrEqual(VIEW.w)
          expect(y, `${ex.id}/${which} ${naam} y`).toBeGreaterThanOrEqual(0)
          expect(y, `${ex.id}/${which} ${naam} y`).toBeLessThanOrEqual(VIEW.h)
        }
      }
    }
  })

  it('zakt nergens door de vloer', () => {
    for (const ex of withFigure) {
      const spec = getFigure(ex.id)!
      for (const which of ['start', 'end'] as const) {
        for (const [naam, [, y]] of allPoints(spec[which])) {
          expect(y, `${ex.id}/${which} ${naam}`).toBeLessThanOrEqual(VIEW.floor + 3)
        }
      }
    }
  })

  it('houdt de ledemaatlengtes vast', () => {
    const spec = getFigure('smith_squat')!
    const a = computeSkeleton(spec.start)
    const b = computeSkeleton(spec.end)
    const len = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1])
    expect(len(a.hip, a.shoulder)).toBeCloseTo(len(b.hip, b.shoulder), 5)
    expect(len(a.hip, a.knee[0])).toBeCloseTo(len(b.hip, b.knee[0]), 5)
  })
})

describe('Figure rendert', () => {
  it.each(withFigure.map((e) => [e.id] as const))('%s rendert start en eind foutloos', (id) => {
    const spec = getFigure(id)!
    for (const which of ['start', 'end'] as const) {
      const html = renderToString(
        createElement(Figure, { pose: spec[which], props: spec.props?.[which], label: which }),
      )
      expect(html).toContain('<svg')
      expect(html, 'ongeldige coördinaat in het pad').not.toMatch(/NaN|Infinity/)
    }
  })

  it('rendert het paar met labels start en eind', () => {
    const spec = getFigure('rdl_trapbar')!
    const html = renderToString(
      createElement(FigurePair, { start: spec.start, end: spec.end, props: spec.props }),
    )
    expect(html).toContain('start')
    expect(html).toContain('eind')
    expect(html).not.toMatch(/NaN/)
  })

  it('tekent een vloerlijn en het materiaal', () => {
    const spec = getFigure('bench_smith')!
    const html = renderToString(createElement(Figure, { pose: spec.start, props: spec.props?.start }))
    expect(html).toContain('<line') // vloer en smith-rail
    expect(html).toContain('<circle') // hoofd en de schijf van de stang
  })

  it('gebruikt de themakleuren', () => {
    const spec = getFigure('smith_squat')!
    const html = renderToString(createElement(Figure, { pose: spec.start, props: spec.props?.start }))
    expect(html).toContain('#38bdf8') // accent
    expect(html).toContain('#f59e0b') // materiaal
  })
})
