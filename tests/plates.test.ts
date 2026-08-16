import { describe, expect, it } from 'vitest'
import { getExercise } from '../src/data/exercises'
import { DEFAULT_PLATES, loadStep, nextLoadable, roundToLoadable, smallestPlate } from '../src/logic/plates'
import { defaultSettings } from '../src/store/settings'
import type { Settings } from '../src/types'

const legPress = getExercise('leg_press') // schijven, geen stang
const smithSquat = getExercise('smith_squat') // schijven op de smithstang
const dbPress = getExercise('db_shoulder_press') // dumbbells
const bandWalk = getExercise('band_lateral_walk') // band, geen kilo's

const met = (plates: number[]): Settings => ({ ...defaultSettings(), plates })

describe('beschikbare schijven', () => {
  it('valt terug op de standaardschijven als er niets ingesteld is', () => {
    expect(smallestPlate(undefined)).toBe(DEFAULT_PLATES[0])
    expect(smallestPlate(met([]))).toBe(DEFAULT_PLATES[0])
  })

  it('rekent met twee schijven per stap, want ze gaan per paar op de stang', () => {
    expect(loadStep(legPress, met([1.25, 2.5, 5]))).toBe(2.5)
    expect(loadStep(legPress, met([2.5, 5]))).toBe(5)
    expect(loadStep(legPress, met([5]))).toBe(10)
  })

  it('gebruikt bij een machine zonder schijven de stap van de oefening', () => {
    const pulldown = getExercise('lat_pulldown')
    expect(loadStep(pulldown, defaultSettings())).toBe(pulldown.minIncrement)
  })

  it('kent bandwerk geen kilo’s toe', () => {
    expect(loadStep(bandWalk, defaultSettings())).toBe(0)
    expect(roundToLoadable(20, bandWalk, defaultSettings())).toBe(0)
    expect(nextLoadable(20, bandWalk, defaultSettings())).toBeNull()
  })
})

describe('afronden op wat te laden is', () => {
  it('rondt naar beneden af, nooit naar boven', () => {
    expect(roundToLoadable(101.25, legPress, met([1.25, 2.5]))).toBe(100)
    expect(roundToLoadable(102.5, legPress, met([1.25, 2.5]))).toBe(102.5)
    expect(roundToLoadable(57, legPress, met([2.5, 5]))).toBe(55)
  })

  it('telt de stang mee en gaat er nooit onder', () => {
    const settings = met([1.25, 2.5, 5])
    const bar = settings.barWeights.smith // 15 kg
    expect(roundToLoadable(bar + 2.5, smithSquat, settings)).toBe(bar + 2.5)
    expect(roundToLoadable(bar + 1, smithSquat, settings)).toBe(bar)
    expect(roundToLoadable(5, smithSquat, settings)).toBe(bar)
  })

  it('kiest bij dumbbells wat er in het rek staat', () => {
    expect(roundToLoadable(9, dbPress, defaultSettings())).toBe(5)
    expect(roundToLoadable(12.5, dbPress, defaultSettings())).toBe(12.5)
    // onder de lichtste dumbbell blijft de lichtste over: die ligt er tenslotte
    expect(roundToLoadable(3, dbPress, defaultSettings())).toBe(5)
  })

  it('geeft de eerstvolgende stap die echt bestaat', () => {
    expect(nextLoadable(100, legPress, met([1.25, 2.5]))).toBe(102.5)
    expect(nextLoadable(100, legPress, met([5]))).toBe(110)
    expect(nextLoadable(101, legPress, met([1.25]))).toBe(102.5)
    expect(nextLoadable(5, dbPress, defaultSettings())).toBe(12.5)
    expect(nextLoadable(20, dbPress, defaultSettings())).toBeNull()
  })

  it('houdt 0 op 0', () => {
    expect(roundToLoadable(0, legPress, defaultSettings())).toBe(0)
    expect(roundToLoadable(-5, legPress, defaultSettings())).toBe(0)
  })
})
