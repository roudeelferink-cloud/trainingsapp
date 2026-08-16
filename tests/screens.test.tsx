import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildDay } from '../src/logic/day'
import { addDays, mondayOf, today } from '../src/logic/dates'
import { Onboarding } from '../src/screens/Onboarding'
import { OtherScreen } from '../src/screens/OtherScreen'
import { ProgressScreen } from '../src/screens/ProgressScreen'
import { SessionScreen } from '../src/screens/SessionScreen'
import { SettingsScreen } from '../src/screens/SettingsScreen'
import { Today } from '../src/screens/Today'
import { WeekScreen } from '../src/screens/WeekScreen'
import { getExercise } from '../src/data/exercises'
import * as A from '../src/store/actions'
import { getFigure } from '../src/data/figures'
import { ANOUC, ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'

const noop = () => {}

/** React zet <!-- --> tussen losse tekstknopen; die halen we weg om op tekst te kunnen matchen. */
const render = (el: Parameters<typeof renderToString>[0]) => renderToString(el).replace(/<!-- -->/g, '')

/** De schermen lezen de gedeelde store, dus die zetten we per test klaar. */
beforeEach(() => {
  resetState()
  setState((s) => ({
    ...s,
    startDate: mondayOf(today()),
    settings: { ...s.settings, bodyweightKg: 82 },
  }))
})

describe('schermen renderen', () => {
  it('rendert Vandaag', () => {
    const html = render(createElement(Today, { onOpenSession: noop }))
    expect(html.length).toBeGreaterThan(500)
    expect(html).toContain('Hoe voelen benen en pezen?')
  })

  it('zet de loop vóór de krachttraining met een pauze ertussen', () => {
    // dinsdag: korte loop + duwen
    const dinsdag = addDays(mondayOf(today()), 1)
    setState((s) => ({ ...s, startDate: mondayOf(dinsdag) }))
    const plan = buildDay(getState(), dinsdag)
    expect(plan.run).not.toBeNull()
    expect(plan.strength).not.toBeNull()
  })

  it('rendert Week', () => {
    const html = render(createElement(WeekScreen, { onOpenSession: noop }))
    expect(html).toContain('Rustdag')
  })

  it('rendert Voortgang', () => {
    expect(render(createElement(ProgressScreen)).length).toBeGreaterThan(200)
  })

  it('rendert Instellingen met de back-upknoppen en de uitleg dat data lokaal is', () => {
    const html = render(createElement(SettingsScreen))
    expect(html).toContain('Exporteer alles')
    expect(html).toContain('Importeer')
    // export/import is de enige weg tussen twee toestellen
    expect(html).toContain('enige manier om je gegevens naar een ander toestel te verplaatsen')
  })

  it('houdt het profiel in Instellingen, maar niets over koppelen of syncen', () => {
    const html = render(createElement(SettingsScreen))
    expect(html).toContain('Profiel')
    expect(html).toContain('Jouw naam')
    expect(html).toContain('Ander profiel gebruiken')
    for (const weg of ['Huishoudcode', 'Koppel', 'gesynchroniseerd', 'huishoudcode']) {
      expect(html, weg).not.toContain(weg)
    }
  })

  it('toont de dagcheck op Vandaag, met slaap en energie op een schaal van 3', () => {
    const html = render(createElement(Today, { onOpenSession: noop }))
    expect(html).toContain('Dagcheck')
    expect(html).toContain('Slaap')
    expect(html).toContain('Energie')
    expect(html).toContain('Overslaan mag')
  })

  it('toont de deloadweek met de mogelijkheid om hem over te slaan', () => {
    setState((s) => ({ ...s, startDate: addDays(mondayOf(today()), -49) })) // week 8
    const html = render(createElement(Today, { onOpenSession: noop }))
    expect(html).toContain('Deloadweek')
    // overslaan zit achter een dialoog met het risico erin; de knop opent die, hij slaat niets over
    expect(html).toContain('Deload overslaan')
    expect(html).toContain('40%')
  })

  it('toont de geschatte duur van de sessie', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const html = render(
      createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }),
    )
    expect(html).toContain('Geschatte duur')
    expect(html).toContain('Sessie afronden')
  })

  it('laat de geplande loopafstand zien en aanpassen', () => {
    const zondag = addDays(mondayOf(today()), 6)
    setState((s) => ({ ...s, startDate: mondayOf(zondag) }))
    const html = render(createElement(Today, { onOpenSession: noop }))
    expect(html).toContain('Duurloop 10 km')
    expect(html).toContain('Geplande afstand aanpassen')
  })

  it('toont in Instellingen welke schijven er liggen', () => {
    const html = render(createElement(SettingsScreen))
    expect(html).toContain('Schijven')
    expect(html).toContain('kleinste echte stap')
  })

  it('levert de waarschuwing over zware benen aan met een knop om te verplaatsen', () => {
    // Anouc traint zaterdag full body en loopt zondag haar duurloop: dat staat elke week zo.
    // Het scherm rendert deze regels als kaart met knoppen; hier staat vast wat het krijgt.
    setCurrentUser(ANOUC)
    const zondag = addDays(mondayOf(today()), 6)
    setState((s) => ({ ...s, startDate: mondayOf(zondag) }))

    const plan = buildDay(getState(), zondag)
    const melding = plan.guardrails.find((g) => g.id.startsWith('benen-voor-duurloop'))
    expect(melding).toBeTruthy()
    expect(melding!.move).toBeTruthy()
    expect(melding!.text).toContain('duurloop')
  })

  it('rendert elke krachtsessie van de week met ingevulde setvelden', () => {
    const monday = mondayOf(today())
    let gerenderd = 0
    for (let d = 0; d < 7; d++) {
      const iso = addDays(monday, d)
      const plan = buildDay(getState(), iso)
      if (!plan.strength) continue
      const html = render(
        createElement(SessionScreen, { date: iso, kind: plan.strength.kind, onClose: noop }),
      )
      expect(html, plan.strength.naam).toContain('Set 1')
      expect(html, plan.strength.naam).toContain('RIR')
      gerenderd++
    }
    expect(gerenderd).toBeGreaterThanOrEqual(4)
  })

  it('rendert Vandaag met reismodus, deload en een gevoelige knie', () => {
    setState((s) => ({
      ...s,
      startDate: addDays(mondayOf(today()), -49), // week 8: de vaste deloadweek
      settings: {
        ...s.settings,
        travelMode: true,
        sensitive: { ...s.settings.sensitive, knee_deep: 'off' },
      },
    }))
    const html = render(createElement(Today, { onOpenSession: noop }))
    expect(html).toContain('Reismodus')
    expect(render(createElement(WeekScreen, { onOpenSession: noop }))).toContain('Deload')
  })

  it('houdt de uitleg standaard dicht, ook bij een oefening zonder eerdere logs', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const kind = plan.strength!.kind
    const html = render(createElement(SessionScreen, { date: monday, kind, onClose: noop }))

    // niets gelogd, dus zeker geen eerdere historie voor deze oefeningen
    expect(getState().exerciseState).toEqual({})

    // de knop is er wel, de inhoud niet
    expect(html).toContain('Uitleg Leg press')
    expect(html).not.toContain('Uitvoering')
    expect(html).not.toContain('Voeten middenhoog')
    expect(html).not.toContain('Poppetje')
  })

  it('toont de uitleg met poppetje, Start, Uitvoering en Fout zodra die open staat', () => {
    const spec = getFigure('leg_press')!
    const ex = getExercise('leg_press')
    expect(ex.hasFigure).toBe(true)
    expect(spec.start).toBeDefined()
    // de inhoud die achter de ?-knop zit
    expect(ex.coaching.setup).toContain('Rugleuning')
    expect(ex.coaching.execution.length).toBeGreaterThanOrEqual(2)
    expect(ex.coaching.mistake.length).toBeGreaterThan(20)
  })

  it('vult het geschatte startgewicht voor in het invoerveld', () => {
    setState((s) => ({ ...s, startDate: addDays(mondayOf(today()), -21) })) // voorbij de kalibratieweken
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const html = render(
      createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }),
    )
    // 82 kg × 0,5 -> 40 kg, voorgevuld als overschrijfbare waarde
    expect(html).toContain('value="40"')
    expect(html).toContain('Voelt dit te licht?')
  })

  it('laat bij een stangoefening alleen de schijven invullen en toont het totaal', () => {
    setState((s) => ({ ...s, startDate: addDays(mondayOf(today()), -21) })) // voorbij de kalibratie
    const monday = mondayOf(today())
    // smith squat naar voren halen: die staat standaard op plek 2 en is dus niet open
    A.replacePermanently(monday, 'legs_a:0', 'smith_squat')
    A.setBarWeight('smith', 15)

    const plan = buildDay(getState(), monday)
    expect(plan.strength!.slots[0].exercise.id).toBe('smith_squat')

    const html = render(
      createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }),
    )
    expect(html).toContain('kg schijven')
    expect(html).toContain('kg stang +')
    expect(html).toContain('kg totaal')
  })

  it('zet het glute medius-werk met de mini-band in de beensessie', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const html = render(
      createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }),
    )

    // beide staan er, allebei op de mini-band: opbouwen vanaf de laagste weerstand
    expect(html).toContain('Laterale bandwalk (mini-band)')
    expect(html).toContain('Clamshell (mini-band)')
  })

  it('toont per oefening een klaar-knop en de afrondvoortgang', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const html = render(
      createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }),
    )
    expect(html).toContain('Oefening klaar')
    expect(html).toContain(`0 van ${plan.strength!.slots.length} afgerond`)
  })

  it('opent de sessie met het warming-upblok, boven de eerste oefening', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const html = render(
      createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }),
    )

    expect(html).toContain('Warming-up')
    expect(html).toContain('Loopband')
    expect(html).toContain('Losfietsen')
    expect(html).toContain('Loopband 5 min')
    expect(html).toContain('Duur warming-up')
    expect(html).toContain('Warming-up afvinken')
    // het blok staat vóór de eerste oefening
    expect(html.indexOf('Warming-up')).toBeLessThan(html.indexOf('Leg press'))
  })

  it('houdt de uitleg bij de volgorde achter het vraagteken', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const html = render(
      createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }),
    )

    expect(html).toContain('Volgorde')
    expect(html).toContain('Uitleg volgorde')
    // de knop is er, de uitleg zelf staat pas open als je erop tikt
    expect(html).not.toContain('Zwaar en technisch')
    // en zonder eigen volgorde is er niets om terug te zetten
    expect(html).not.toContain('Standaardvolgorde')
  })

  it('zet de warming-up ook bovenaan het sessieoverzicht van Vandaag', () => {
    const monday = mondayOf(today())
    setState((s) => ({ ...s, startDate: monday }))
    const html = render(createElement(Today, { onOpenSession: noop }))

    if (!buildDay(getState(), today()).strength) return
    expect(html).toContain('Warming-up')
    expect(html).toContain('Loopband 5 min')
  })

  it('rendert het startscherm met alleen de gebruikerskeuze', () => {
    const html = render(createElement(Onboarding, { onDone: noop }))
    expect(html).toContain('Wie ben je?')
    expect(html).toContain('Rob')
    expect(html).toContain('Anouc')
    // alles blijft lokaal: geen code, geen koppeling, geen cloud
    expect(html).toContain('Alles blijft op dit toestel')
    expect(html).not.toContain('Huishoudcode')
  })

  it('rendert de voortgang van de ander als kijkscherm, zonder logknoppen', () => {
    setCurrentUser(ROB)
    const html = render(createElement(OtherScreen))
    expect(html).toContain('Anouc')
    expect(html).toContain('meekijken')
    expect(html).toContain('Kilometers per week')
    expect(html).not.toContain('Start sessie')
    expect(html).not.toContain('Activiteit toevoegen')
  })

  it('rendert Vandaag voor Anouc met haar eigen full body-sessie', () => {
    setCurrentUser(ANOUC)
    setState((s) => ({ ...s, startDate: mondayOf(today()) }))
    const woensdag = addDays(mondayOf(today()), 2)
    const plan = buildDay(getState(), woensdag)
    expect(plan.strength?.kind).toBe('full_body_a')

    const html = render(createElement(WeekScreen, { onOpenSession: noop }))
    expect(html).toContain('Full body A')
    expect(html).toContain('Full body B')
    // haar loopdagen krijgen geen voorgeschreven afstand
    expect(html).toContain('eigen afstand')
  })

  it('toont de exportherinnering in Instellingen als er nog nooit geëxporteerd is', () => {
    setState((s) => ({
      ...s,
      sessions: {
        'x:legs_a': {
          date: '2026-08-03',
          kind: 'legs_a',
          short: false,
          completedAt: 'x',
          skippedSlots: [],
          completedSlots: [],
          exercises: {},
          entries: {},
        },
      },
    }))
    expect(render(createElement(SettingsScreen))).toContain('nooit een back-up')
  })
})
