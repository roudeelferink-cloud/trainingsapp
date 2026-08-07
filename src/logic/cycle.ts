import { daysBetween, mondayOf } from './dates'

export interface CycleInfo {
  /** doorlopend weeknummer, 1-gebaseerd, zonder einde */
  week: number
  /** 1..4 binnen de golf */
  cycleWeek: number
  /** 1-gebaseerd cyclusnummer */
  cycle: number
  deload: boolean
  /** eerste 2 weken: op gevoel trainen */
  calibration: boolean
  /** rotatie-index van de oefeningselectie; +1 na elke 3 volledige cycli */
  rotation: number
}

export function cycleInfo(startDate: string, iso: string): CycleInfo {
  const diff = daysBetween(mondayOf(startDate), mondayOf(iso))
  const week = Math.floor(diff / 7) + 1
  const w = Math.max(1, week)
  const cycleWeek = ((w - 1) % 4) + 1
  const cycle = Math.floor((w - 1) / 4) + 1
  return {
    week: w,
    cycleWeek,
    cycle,
    deload: cycleWeek === 4,
    calibration: w <= 2,
    rotation: Math.floor((cycle - 1) / 3),
  }
}
