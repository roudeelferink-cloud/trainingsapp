import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MON } from './helpers'

/**
 * Het instellingenscherm met data die niet uit deze versie komt.
 *
 * Elk van deze gevallen gaf eerder een zwart scherm: een ontbrekend veld in
 * `settings` liet de render vastlopen en daarmee de hele view verdwijnen. De store
 * leest localStorage bij het laden van de module, dus per geval zetten we de
 * opgeslagen data klaar en halen we de modules opnieuw op.
 */

const KEY = 'trainingsapp.state.v1'

async function metOpgeslagenData(stored?: unknown) {
  vi.resetModules()
  localStorage.clear()
  if (stored !== undefined) localStorage.setItem(KEY, JSON.stringify(stored))
  const store = await import('../src/store/store')
  const { SettingsScreen } = await import('../src/screens/SettingsScreen')
  const { Today } = await import('../src/screens/Today')
  return { store, SettingsScreen, Today }
}

const render = (el: Parameters<typeof renderToString>[0]) =>
  renderToString(el).replace(/<!-- -->/g, '')

/** De kaarten die er altijd moeten staan; ontbreekt er één, dan is de render gestrand. */
function verwachtEenHeelScherm(html: string) {
  expect(html).toContain('Gevoelige gebieden')
  expect(html).toContain('Stanggewicht')
  expect(html).toContain('Dagelijks onderhoud')
  expect(html).toContain('Exporteer alles')
}

describe('instellingenscherm met oude of halve data', () => {
  it('rendert met een lege staat', async () => {
    const { SettingsScreen } = await metOpgeslagenData(undefined)
    verwachtEenHeelScherm(render(createElement(SettingsScreen)))
  })

  it('rendert met opgeslagen data van vóór de gevoelige gebieden en de stanggewichten', async () => {
    // v5: één platte gebruiker, settings met alleen een lichaamsgewicht
    const { store, SettingsScreen } = await metOpgeslagenData({
      schemaVersion: 5,
      startDate: MON,
      settings: { bodyweightKg: 82 },
      sessions: {},
      runs: {},
    })

    const html = render(createElement(SettingsScreen))
    verwachtEenHeelScherm(html)
    expect(html).toContain('Eiwitdoel: 150 g per dag')

    const rob = store.getUser('rob')!
    expect(rob.settings.bodyweightKg).toBe(82)
    expect(rob.settings.sensitive.knee_deep).toBe('ok')
    expect(rob.settings.barWeights.smith).toBe(15)
  })

  it('rendert met ontbrekende stanggewichten en vult de standaard in', async () => {
    const { store, SettingsScreen } = await metOpgeslagenData({
      schemaVersion: 7,
      currentUser: 'rob',
      users: {
        rob: {
          id: 'rob',
          naam: 'Rob',
          programId: 'kracht_hardlopen',
          startDate: MON,
          // stanggewichten ontbreken volledig, gevoelige gebieden half ingevuld
          settings: { bodyweightKg: 82, sensitive: { knee_deep: 'off' } },
        },
      },
    })

    const html = render(createElement(SettingsScreen))
    verwachtEenHeelScherm(html)
    // smith 15 en trap bar 20 komen uit de standaard, met één decimaal in het veld
    // (Nederlandse notatie: komma als decimaalteken)
    expect(html).toContain('value="15,0"')
    expect(html).toContain('value="20,0"')

    const settings = store.getUser('rob')!.settings
    expect(settings.barWeights.smith).toBe(15)
    expect(settings.barWeights.curl_bar).toBe(7.5)
    // wat er wél stond blijft staan
    expect(settings.sensitive.knee_deep).toBe('off')
    expect(settings.sensitive.shoulder).toBe('ok')
  })

  it('houdt één ingesteld stanggewicht overeind terwijl de rest wordt aangevuld', async () => {
    const { store } = await metOpgeslagenData({
      schemaVersion: 7,
      currentUser: 'rob',
      users: { rob: { id: 'rob', settings: { barWeights: { smith: 7 } } } },
    })

    const bars = store.getUser('rob')!.settings.barWeights
    expect(bars.smith).toBe(7)
    expect(bars.barbell).toBe(20)
  })

  it('rendert voor een tweede gebruiker zonder eigen settings-object', async () => {
    const { store, SettingsScreen, Today } = await metOpgeslagenData({
      schemaVersion: 7,
      currentUser: 'anouc',
      users: {
        rob: { id: 'rob', naam: 'Rob', startDate: MON },
        // Anouc heeft nog nooit iets ingesteld: geen settings-object
        anouc: { id: 'anouc', naam: 'Anouc', programId: 'fullbody_hardlopen', startDate: MON },
      },
    })

    expect(store.getRoot().currentUser).toBe('anouc')
    const html = render(createElement(SettingsScreen))
    verwachtEenHeelScherm(html)
    expect(html).toContain('Anouc')
    expect(html).toContain('Nodig voor het eiwitdoel.')

    // en de weg terug werkt: Vandaag rendert op dezelfde staat
    expect(render(createElement(Today, { onOpenSession: () => {} })).length).toBeGreaterThan(500)
  })

  it('overleeft de import van een oude export zonder gevoelige gebieden of stanggewichten', async () => {
    // een back-up van maanden geleden kent de velden van nu nog niet; die vult de
    // import aan in plaats van het scherm te laten vastlopen
    const { store, SettingsScreen, Today } = await metOpgeslagenData(undefined)
    const oudeExport = {
      schemaVersion: 6,
      currentUser: 'rob',
      users: {
        rob: {
          id: 'rob',
          naam: 'Rob',
          startDate: MON,
          settings: { bodyweightKg: 80, travelMode: false, proteinFactor: 1.8 },
        },
      },
    }

    expect(store.importJSON(JSON.stringify(oudeExport)).ok).toBe(true)

    const settings = store.getUser('rob')!.settings
    expect(settings.sensitive.knee_deep).toBe('ok')
    expect(settings.barWeights.smith).toBe(15)
    expect(settings.maintenanceItems.length).toBeGreaterThan(0)
    expect(settings.bodyweightKg).toBe(80)

    verwachtEenHeelScherm(render(createElement(SettingsScreen)))
    expect(render(createElement(Today, { onOpenSession: () => {} })).length).toBeGreaterThan(500)
  })

  it('rendert met onleesbare instellingen zonder de rest mee te slepen', async () => {
    const { store, SettingsScreen } = await metOpgeslagenData({
      schemaVersion: 7,
      currentUser: 'rob',
      users: {
        rob: {
          id: 'rob',
          settings: {
            bodyweightKg: 'tachtig',
            sensitive: 'nee',
            barWeights: { smith: 0, trap_bar: 'zwaar' },
            maintenanceItems: [{ id: 'ok', label: 'Heel drops' }, null, { label: 'geen id' }],
            proteinFactor: 0,
          },
        },
      },
    })

    verwachtEenHeelScherm(render(createElement(SettingsScreen)))
    const settings = store.getUser('rob')!.settings
    expect(settings.bodyweightKg).toBeNull()
    expect(settings.sensitive.calf).toBe('ok')
    expect(settings.barWeights.smith).toBe(15) // 0 kg stang bestaat niet
    expect(settings.barWeights.trap_bar).toBe(20)
    expect(settings.maintenanceItems).toEqual([{ id: 'ok', label: 'Heel drops' }])
    expect(settings.proteinFactor).toBe(1.8)
  })
})
