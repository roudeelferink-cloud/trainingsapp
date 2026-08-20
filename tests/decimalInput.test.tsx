import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { formatDecimal, parseDecimal, Stepper } from '../src/components/ui'

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

/**
 * Decimale invoer met zweterige duimen op een Nederlands toetsenbord: de komma is
 * daar het decimaalteken. In een `type="number"`-veld maakte een komma de waarde
 * leeg en daarmee 0 — daarom zijn de velden tekstvelden met eigen parsing.
 */
describe('parseDecimal', () => {
  it('leest punt en komma allebei als decimaalteken', () => {
    expect(parseDecimal('12.5')).toBe(12.5)
    expect(parseDecimal('12,5')).toBe(12.5)
    expect(parseDecimal('40')).toBe(40)
  })

  it('telt een half getal tijdens het typen als het hele deel', () => {
    expect(parseDecimal('7,')).toBe(7)
    expect(parseDecimal('7.')).toBe(7)
    expect(parseDecimal(',5')).toBe(0.5)
  })

  it('weigert onzin in plaats van er 0 van te maken', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('.')).toBeNull()
    expect(parseDecimal(',')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
    expect(parseDecimal('1e3')).toBeNull()
  })
})

describe('formatDecimal', () => {
  it('toont de komma als decimaalteken', () => {
    expect(formatDecimal(12.5)).toBe('12,5')
    expect(formatDecimal(40)).toBe('40')
    expect(formatDecimal(10, 1)).toBe('10,0')
  })
})

describe('Stepper als tekstveld', () => {
  it('is een tekstveld met het decimale toetsenbord, geen number-veld', () => {
    const html = render(createElement(Stepper, { value: 12.5, onChange: () => {} }))
    expect(html).toContain('type="text"')
    expect(html).toContain('inputMode="decimal"')
    expect(html).not.toContain('type="number"')
  })

  it('toont de waarde met een komma', () => {
    const html = render(createElement(Stepper, { value: 12.5, onChange: () => {} }))
    expect(html).toContain('value="12,5"')
  })

  it('toont de schatting als grijze placeholder, ook met komma', () => {
    const html = render(
      createElement(Stepper, { value: 0, onChange: () => {}, placeholder: 37.5 }),
    )
    expect(html).toContain('placeholder="37,5"')
    expect(html).toContain('value=""')
  })
})
