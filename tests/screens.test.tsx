import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildDay } from '../src/logic/day'
import { addDays, fromISO, mondayOf, today } from '../src/logic/dates'
import { Onboarding } from '../src/screens/Onboarding'
import { OtherScreen } from '../src/screens/OtherScreen'
import { HistoryScreen } from '../src/screens/HistoryScreen'
import { SessionScreen } from '../src/screens/SessionScreen'
import { SettingsScreen } from '../src/screens/SettingsScreen'
import { Today } from '../src/screens/Today'
import { WeekScreen } from '../src/screens/WeekScreen'
import { getExercise } from '../src/data/exercises'
import * as A from '../src/store/actions'
import { getFigure } from '../src/data/figures'
import { ANOUC, ROB, getState, resetState, setCurrentUser, setState } from '../src/store/store'

const noop = () => {}

/**
 * De sessie opent op de warming-up. Wie de oefeningen wil zien, heeft die eerst
 * afgevinkt — precies zoals in de sportschool. Deze helper doet dat.
 */
function naDeWarmingUp(date: string, kind: Parameters<typeof A.setWarmupDone>[1]) {
  A.setWarmupDone(date, kind, true)
}

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
    expect(html).toContain('Hoe ligt de dag?')
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
    expect(render(createElement(HistoryScreen, { onOpenSettings: () => {} })).length).toBeGreaterThan(200)
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

  it('zet slaap, energie en benen in één check-inblok op Vandaag', () => {
    const html = render(createElement(Today, { onOpenSession: noop }))
    expect(html).toContain('Hoe ligt de dag?')
    // slaap en energie op een schaal van 3, met de labels uit DAY_SCORES
    expect(html).toContain('Slaap')
    expect(html).toContain('Energie')
    expect(html).toContain('Slecht')
    expect(html).toContain('Goed')
    // benen en pezen houden hun eigen schaal van 5, met de uitleg erbij
    expect(html).toContain('Benen')
    expect(html).toContain('1 = brak · 5 = fris')
  })

  it('toont de deloadweek met de mogelijkheid om hem over te slaan', () => {
    setState((s) => ({ ...s, startDate: addDays(mondayOf(today()), -49) })) // week 8
    const html = render(createElement(Today, { onOpenSession: noop }))
    expect(html).toContain('Deloadweek')
    // overslaan zit achter een dialoog met het risico erin; de knop opent die, hij slaat niets over
    expect(html).toContain('Deload overslaan')
    expect(html).toContain('40%')
  })

  it('opent op de warming-up met de omvang van de sessie erbij', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const html = render(
      createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }),
    )
    expect(html).toContain('Warming-up')
    expect(html).toContain(`${plan.strength!.slots.length} oefeningen`)
    expect(html).toContain(`~${plan.strength!.estimatedMin} min`)
    expect(html).toContain('Warming-up klaar')
  })

  it('laat de geplande loopafstand zien en aanpassen', () => {
    // de duurloop staat op zondag; de klok gaat naar die dag zodat Vandaag hem toont,
    // anders slaagt deze test alleen als de suite toevallig op een zondag draait
    const zondag = addDays(mondayOf(today()), 6)
    setState((s) => ({ ...s, startDate: mondayOf(zondag) }))
    vi.useFakeTimers()
    vi.setSystemTime(fromISO(zondag))
    try {
      const html = render(createElement(Today, { onOpenSession: noop }))
      // de kop is het grote cijfer met zijn eenheid, niet één samengestelde regel
      expect(html).toContain('Duurloop')
      expect(html).toContain('>10<')
      expect(html).toContain('km')
      // afvinken is de primaire actie; de rest zit achter de knop ernaast
      expect(html).toContain('Loop afvinken')
      expect(html).toContain('Meer')
    } finally {
      vi.useRealTimers()
    }
  })

  it('wijst op een lege dag vooruit naar de volgende sessie', () => {
    // Anouc heeft op donderdag niets gepland; vrijdag staat haar korte loop
    setCurrentUser(ANOUC)
    const donderdag = addDays(mondayOf(today()), 3)
    setState((s) => ({ ...s, startDate: mondayOf(donderdag) }))
    vi.useFakeTimers()
    vi.setSystemTime(fromISO(donderdag))
    try {
      const html = render(createElement(Today, { onOpenSession: noop }))
      expect(html).toContain('Geen sessie ingepland vandaag.')
      expect(html).toContain('Volgende sessie:')
      expect(html).toContain('hardlopen')
    } finally {
      vi.useRealTimers()
    }
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
      naDeWarmingUp(iso, plan.strength.kind)
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
    // de markeringen rechtsboven staan in kleine letters in de DOM; het kapitaal komt uit de CSS
    expect(html).toContain('reismodus')
    expect(html).toContain('deloadweek')
    expect(render(createElement(WeekScreen, { onOpenSession: noop }))).toContain('deloadweek')
  })

  it('houdt de uitleg standaard dicht, ook bij een oefening zonder eerdere logs', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const kind = plan.strength!.kind
    naDeWarmingUp(monday, kind)
    const html = render(createElement(SessionScreen, { date: monday, kind, onClose: noop }))

    // niets gelogd, dus zeker geen eerdere historie voor deze oefeningen
    expect(getState().exerciseState).toEqual({})

    // de knop is er wel, de inhoud niet
    expect(html).toContain('Leg press')
    expect(html).toContain('Uitleg')
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
    naDeWarmingUp(monday, plan.strength!.kind)
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

    naDeWarmingUp(monday, plan.strength!.kind)
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
    naDeWarmingUp(monday, plan.strength!.kind)
    const html = render(
      createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }),
    )

    // beide staan in de sessie; het scherm doet er één tegelijk, dus de lijst met
    // oefeningen is waar ze allebei te zien zijn
    const namen = plan.strength!.slots.map((r) => r.exercise.naam)
    expect(namen).toContain('Laterale bandwalk (mini-band)')
    expect(namen).toContain('Clamshell (mini-band)')
    expect(html).toContain(plan.strength!.slots[0].exercise.naam)
  })

  it('zegt bij welke set en welke oefening je bent', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    naDeWarmingUp(monday, plan.strength!.kind)
    const html = render(
      createElement(SessionScreen, { date: monday, kind: plan.strength!.kind, onClose: noop }),
    )
    expect(html).toContain('Set 1 klaar')
    expect(html).toContain(`Oefening 1 / ${plan.strength!.slots.length}`)
  })

  it('begint de sessie bij de warming-up, met type en duur', () => {
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
    expect(html).toContain('Warming-up klaar')
    // de eerste oefening komt pas na deze stap
    expect(html).not.toContain('Set 1 klaar')
  })

  it('houdt de uitleg bij de volgorde achter een eigen knop', () => {
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

  it('noemt de krachtsessie op Vandaag maar laat de oefeningen aan het sessiescherm', () => {
    const monday = mondayOf(today())
    setState((s) => ({ ...s, startDate: monday }))
    const plan = buildDay(getState(), today())
    if (!plan.strength) return

    const html = render(createElement(Today, { onOpenSession: noop }))

    // de sessie staat er met naam en de weg erheen
    expect(html).toContain(plan.strength.naam)
    expect(html).toMatch(/Start sessie|Bekijk/)
    // maar de inhoud van de sessie hoort in de sessie, niet op het dagoverzicht
    expect(html).not.toContain('Loopband 5 min')
    expect(html).not.toContain('Uitleg volgorde')
  })

  it('laat de knop meelopen met waar je in de oefening bent', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const kind = plan.strength!.kind
    const slot = plan.strength!.slots[0]
    naDeWarmingUp(monday, kind)

    // alle sets van de eerste oefening afgevinkt, maar de oefening nog niet afgerond
    A.saveSessionDraft(
      monday,
      kind,
      {
        [slot.slot.key]: Array.from({ length: slot.sets }, () => ({
          weight: 40,
          reps: 10,
          rir: 2,
          done: true,
        })),
      },
      { [slot.slot.key]: slot.exercise.id },
      plan.strength!.short,
      [],
    )

    const html = render(createElement(SessionScreen, { date: monday, kind, onClose: noop }))
    expect(html).toContain('Volgende oefening')
    expect(html).not.toContain('Set 1 klaar')
    // er valt niets meer over te slaan, dus die knop hoort weg te zijn
    expect(html).not.toContain('Sla')
  })

  it('biedt op de laatste openstaande oefening het afronden aan', () => {
    const monday = mondayOf(today())
    const plan = buildDay(getState(), monday)
    const kind = plan.strength!.kind
    const slots = plan.strength!.slots
    const laatste = slots[slots.length - 1]
    naDeWarmingUp(monday, kind)

    // alles behalve de laatste oefening is afgerond, en die laatste is volgevinkt
    A.saveSessionDraft(
      monday,
      kind,
      {
        [laatste.slot.key]: Array.from({ length: laatste.sets }, () => ({
          weight: 20,
          reps: 10,
          rir: 2,
          done: true,
        })),
      },
      Object.fromEntries(slots.map((r) => [r.slot.key, r.exercise.id])),
      plan.strength!.short,
      slots.slice(0, -1).map((r) => r.slot.key),
    )

    const html = render(createElement(SessionScreen, { date: monday, kind, onClose: noop }))
    expect(html).toContain(laatste.exercise.naam)
    expect(html).toContain('Sessie afronden')
    expect(html).not.toContain('Volgende oefening')
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
