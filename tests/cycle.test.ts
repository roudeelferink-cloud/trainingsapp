import { describe, expect, it } from 'vitest'
import { cycleInfo } from '../src/logic/cycle'
import { addDays } from '../src/logic/dates'
import { MON } from './helpers'

const at = (weeks: number) => cycleInfo(MON, addDays(MON, weeks * 7))

describe('cycluslogica', () => {
  it('start op week 1', () => {
    expect(at(0).week).toBe(1)
    expect(at(0).cycleWeek).toBe(1)
  })

  it('telt de cyclusweken van 1 tot 4', () => {
    expect(at(3).cycleWeek).toBe(4)
  })

  it('begint bij week 5 aan cyclus 2', () => {
    expect(at(4).cycle).toBe(2)
    expect(at(4).cycleWeek).toBe(1)
  })

  it('kalibreert alleen in week 1 en 2', () => {
    expect(at(0).calibration).toBe(true)
    expect(at(1).calibration).toBe(true)
    expect(at(2).calibration).toBe(false)
  })

  it('rouleert de selectie pas na 3 volledige cycli', () => {
    expect(at(11).week).toBe(12)
    expect(at(11).rotation).toBe(0)
    expect(at(12).week).toBe(13)
    expect(at(12).rotation).toBe(1)
    expect(at(24).rotation).toBe(2)
  })

  it('telt gewoon door zonder einddatum', () => {
    expect(at(83).week).toBe(84)
    expect(at(199).week).toBe(200)
  })

  it('valt terug op week 1 voor datums vóór de start', () => {
    expect(cycleInfo(MON, addDays(MON, -14)).week).toBe(1)
  })
})
