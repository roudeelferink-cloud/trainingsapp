import { defaultState } from '../src/store/store'
import type { UserState } from '../src/types'

/** Vaste maandag, zodat tests niet afhangen van de dag waarop ze draaien. */
export const MON = '2026-08-03'
export const DI = '2026-08-04'
export const WO = '2026-08-05'
export const DO = '2026-08-06'
export const VR = '2026-08-07'
export const ZA = '2026-08-08'
export const ZO = '2026-08-09'

/** Schone staat met een voorspelbare startdatum. */
export function baseState(patch: Partial<UserState> = {}): UserState {
  return { ...defaultState(), startDate: MON, ...patch }
}
