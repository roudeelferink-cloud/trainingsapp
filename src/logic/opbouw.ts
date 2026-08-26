import type {
  Exercise,
  ExerciseState,
  LoggedSet,
  MuscleZone,
  Settings,
  Tempo,
} from '../types'
import { isBandExercise } from './band'
import { nextLoadable } from './plates'

/**
 * Progressie op wat je gedaan hebt, niet op wat je invult.
 *
 * De oude regel verhoogde het gewicht als je een sessie na afloop als 'makkelijk'
 * beoordeelde. Dat werkt alleen als je die knop indrukt, en dat gebeurde niet — dus
 * stonden streefgewichten weken stil terwijl de reps al lang gehaald werden. Deze regel
 * kijkt naar de gelogde sets en verder nergens naar.
 *
 * **De regel.** Haal je een oefening drie sessies op rij helemaal — alle geplande sets,
 * alle geplande reps, en niets naar beneden bijgesteld — dan gaat het gewicht omhoog.
 * De teller begint daarna opnieuw.
 *
 * **Wat "helemaal" betekent.** Alle drie tegelijk:
 *
 * 1. alle geplande sets zijn gedaan (een afgebroken sessie telt niet);
 * 2. elke set haalde minstens de geplande reps;
 * 3. elke set stond op minstens het streefgewicht.
 *
 * Voorwaarde 3 is de reden dat het naar beneden bijstellen van een set als "niet gehaald"
 * telt. Dat is geen straf: er staat nergens een boete op, de teller gaat gewoon naar 0 en
 * je bouwt opnieuw op vanaf wat je wél gehaald hebt. De app rekent met wat er echt
 * gebeurde, en dat is precies wat je wilt als je een keer minder in de tank hebt.
 *
 * **De stap.** Klein en passend bij het materiaal: het eerstvolgende gewicht dat te laden
 * is (`plates.ts` weet wat er ligt), of groter als de oefening dat vraagt — op de leg
 * press is 2,5 kg erbij geen verschil dat je voelt. Dat staat als `progressStepKg` op de
 * oefening zelf.
 *
 * **De rem** staat in `kiesVerhogingen`: hooguit twee oefeningen per sessie, benen eerst,
 * en niets in een deloadweek.
 */

/** Hoeveel sessies op rij er gehaald moet worden voordat het gewicht omhoog gaat. */
export const DREMPEL: Record<Tempo, number> = { opbouwen: 3, onderhoud: 6 }

/**
 * Hooguit zoveel oefeningen per sessie gaan omhoog.
 *
 * Drie oefeningen tegelijk zwaarder is geen opbouw maar een andere sessie. Wie na een
 * rustige periode ineens overal weer aan de drempel komt, krijgt het over een paar
 * sessies uitgesmeerd in plaats van in één klap.
 */
export const MAX_VERHOGINGEN_PER_SESSIE = 2

/** Welke spiergroep hoort bij deze oefening? Volgt uit het bewegingspatroon. */
export function zoneOf(ex: Exercise): MuscleZone {
  switch (ex.pattern) {
    case 'knee_dominant':
    case 'hip_dominant':
    case 'calf':
    case 'abduction':
    case 'single_leg':
      return 'benen'
    case 'core':
      return 'romp'
    default:
      return 'bovenlichaam'
  }
}

export function tempoFor(settings: Settings | undefined, ex: Exercise): Tempo {
  return settings?.progressie?.[zoneOf(ex)] ?? 'opbouwen'
}

export function drempelFor(settings: Settings | undefined, ex: Exercise): number {
  return DREMPEL[tempoFor(settings, ex)]
}

/** Waarom een sessie wel of niet meetelt voor de opbouw. */
export type Uitkomst =
  /** alles gehaald: deze sessie telt mee */
  | 'gehaald'
  /** niet alle geplande sets gedaan */
  | 'sets'
  /** een set haalde de geplande reps niet */
  | 'reps'
  /** een set stond lichter dan het streefgewicht */
  | 'gewicht'
  /** er valt nog niets te tellen: geen streefgewicht, of bandwerk */
  | 'geen_streef'

export interface Beoordeling {
  gehaald: boolean
  uitkomst: Uitkomst
}

export interface Gepland {
  /** aantal sets dat er stond */
  sets: number
  /** de ondergrens van het schema, als er nog geen streefreps zijn */
  repMin: number
}

/**
 * Is deze oefening deze sessie helemaal gehaald?
 *
 * `prev` is de staat zoals hij vóór de sessie was: dat is het gewicht en het aantal reps
 * dat er voorgevuld stond, en dus waar de sessie tegen afgemeten hoort te worden.
 */
export function beoordeelSessie(
  ex: Exercise,
  gepland: Gepland,
  sets: LoggedSet[],
  prev: ExerciseState,
): Beoordeling {
  // bandwerk gaat per niveau en heeft zijn eigen trap in progression.ts
  if (isBandExercise(ex)) return { gehaald: false, uitkomst: 'geen_streef' }

  const streef = prev.targetWeight
  if (streef === null || streef === undefined || streef <= 0) {
    return { gehaald: false, uitkomst: 'geen_streef' }
  }

  const gedaan = sets.filter((s) => s.reps > 0)
  if (gedaan.length < gepland.sets) return { gehaald: false, uitkomst: 'sets' }

  const doelReps = prev.targetReps ?? gepland.repMin
  if (gedaan.some((s) => s.reps < doelReps)) return { gehaald: false, uitkomst: 'reps' }
  if (gedaan.some((s) => s.weight < streef - 1e-9)) return { gehaald: false, uitkomst: 'gewicht' }

  return { gehaald: true, uitkomst: 'gehaald' }
}

/** De teller na deze sessie. Niet gehaald is terug naar nul; er staat geen boete op. */
export function volgendeStreak(prev: ExerciseState, gehaald: boolean): number {
  if (!gehaald) return 0
  return (prev.hitStreak ?? 0) + 1
}

/**
 * Het gewicht waar deze oefening naartoe gaat, of null als er niets te laden valt.
 *
 * Standaard de eerstvolgende stap die er echt is: twee keer de lichtste schijf bij
 * stangwerk (met 1,25 kg in de bak is dat 2,5 kg), de volgende maat in het dumbbellrek,
 * of `minIncrement` bij een machine met een pin. Vraagt de oefening om een grotere stap,
 * dan wordt er doorgeteld tot die gehaald is — maar altijd naar een gewicht dat te laden
 * is, nooit naar een getal dat niet bestaat.
 *
 * Op `onderhoud` telt hij niet door: daar is de kleinste stap de bedoeling.
 */
export function stapVoor(
  ex: Exercise,
  huidig: number,
  settings: Settings | undefined,
  tempo: Tempo,
): number | null {
  let volgende = nextLoadable(huidig, ex, settings)
  if (volgende === null) return null
  if (tempo === 'onderhoud') return volgende

  const gewenst = ex.progressStepKg
  if (!gewenst || gewenst <= 0) return volgende

  while (volgende !== null && volgende < huidig + gewenst - 1e-9) {
    const daarna = nextLoadable(volgende, ex, settings)
    if (daarna === null || daarna <= volgende) break
    volgende = daarna
  }
  return volgende
}

export interface Kandidaat {
  exerciseId: string
  naam: string
  zone: MuscleZone
  /** volgorde binnen de sessie; bepaalt wie voorgaat binnen dezelfde zone */
  positie: number
  streak: number
  van: number
  naar: number
  /** de reps die er gehaald zijn, voor de uitlegregel */
  reps: number
}

export interface Verhoging extends Kandidaat {
  note: string
}

/**
 * Welke oefeningen deze sessie daadwerkelijk omhoog gaan.
 *
 * Benen eerst. Dat is een keuze en geen natuurwet: de zwaarste oefeningen van de week
 * zijn beenoefeningen, daar zit de meeste winst, en als er maar twee stappen per sessie
 * in zitten horen die daar terecht te komen. Binnen een zone wint de oefening die
 * vooraan in de sessie staat — dat is ook de oefening waar je het frist aan begint.
 *
 * In een deloadweek gaat er niets omhoog. Daar staat met opzet minder op de stang; een
 * gehaalde sessie zegt daar niets over wat je aankunt.
 */
export function kiesVerhogingen(kandidaten: Kandidaat[], deload: boolean): Verhoging[] {
  if (deload) return []
  return [...kandidaten]
    .sort((a, b) => {
      const zoneA = a.zone === 'benen' ? 0 : 1
      const zoneB = b.zone === 'benen' ? 0 : 1
      if (zoneA !== zoneB) return zoneA - zoneB
      return a.positie - b.positie
    })
    .slice(0, MAX_VERHOGINGEN_PER_SESSIE)
    .map((k) => ({ ...k, note: verhogingsRegel(k) }))
}

/**
 * De regel die bij een verhoging hoort, in de stijl van de andere contextregels: kort,
 * feitelijk, met het getal erbij waar hij op rust.
 *
 * "3× 140 kg × 12 gehaald — nu 145"
 */
export function verhogingsRegel(k: Kandidaat): string {
  return `${k.streak}× ${kg(k.van)} kg × ${k.reps} gehaald — nu ${kg(k.naar)}`
}

function kg(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ',')
}
