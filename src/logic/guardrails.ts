import { DAY_LABEL } from '../data/plan'
import { programFor } from '../data/programs'
import type { UserState } from '../types'
import { addDays, formatShort } from './dates'
import { deloadFor } from './deload'
import { LEG_LOAD_HIGH, legLoadOn, type LegLoad } from './legLoad'

/**
 * De guardrails van een dag op één hoop.
 *
 * Alles wat de app uit zichzelf bijstuurt hoort zichtbaar en uitlegbaar te zijn: per
 * bijsturing één regel waarom. Deze module verzamelt de regels die je met alleen een
 * datum al kunt bepalen. De bijsturingen die de sessie van vandaag zelf nodig heeft (de
 * geschatte duur, het gewichtsvoorstel per oefening) komen uit `duration.ts` en
 * `progression.ts` en worden in `day.ts` toegevoegd.
 *
 * **Wat hier niet meer staat.** Het weekplafond op de kilometers, de rem op drie
 * stijgende weken en de waarschuwing over zware benen vlak voor de duurloop zijn eruit.
 * Die gingen alle drie over hardlopen, en daar bemoeit de app zich niet meer mee: de
 * loopplanning is met de hand beter dan met een formule. Wat overblijft gaat over kracht
 * — de deloadweek, en twee zware beendagen achter elkaar.
 */

export type GuardrailTone = 'info' | 'warn'

export interface Guardrail {
  id: string
  text: string
  tone: GuardrailTone
  /** knop die de sessie van die dag verplaatst; de MoveSheet doet de rest */
  move?: { date: string; what: 'strength' | 'run' }
}

/* -------------------------------------------------------------------------
 * Twee zware beensessies vlak na elkaar
 * ---------------------------------------------------------------------- */

export interface LegStack {
  first: string
  second: string
  hours: number
  text: string
}

function sessionName(state: UserState, load: LegLoad): string {
  if (!load.kind) return 'De krachtsessie'
  const program = programFor(state)
  return program.templateFor(load.kind, 1)?.naam ?? DAY_LABEL[load.kind]
}

/**
 * Twee dagen zwaar beenwerk direct achter elkaar. Dat is de manier om je knieën en pezen
 * te overvragen die volledig binnen de krachttraining zit, en hij komt vooral in beeld
 * bij het naar voren halen van een sessie.
 */
export function legStackAround(state: UserState, iso: string): LegStack | null {
  const here = legLoadOn(state, iso)
  if (here.score < LEG_LOAD_HIGH) return null

  for (const richting of [-1, 1] as const) {
    const buur = addDays(iso, richting)
    const other = legLoadOn(state, buur)
    if (other.score < LEG_LOAD_HIGH) continue
    const first = richting === -1 ? buur : iso
    const second = richting === -1 ? iso : buur
    return {
      first,
      second,
      hours: 24,
      text:
        `Twee dagen zwaar beenwerk achter elkaar: ${sessionName(state, legLoadOn(state, first))} op ` +
        `${formatShort(first)} en ${sessionName(state, legLoadOn(state, second))} op ${formatShort(second)}, ` +
        '24 uur ertussen.',
    }
  }
  return null
}

/* -------------------------------------------------------------------------
 * Alles bij elkaar
 * ---------------------------------------------------------------------- */

/** Alles wat er vandaag bijgestuurd wordt, met per bijsturing één regel waarom. */
export function dayGuardrails(state: UserState, iso: string): Guardrail[] {
  const out: Guardrail[] = []

  const deload = deloadFor(state, iso)
  if (deload.explanation) {
    out.push({ id: 'deload', text: deload.explanation, tone: deload.skipped ? 'warn' : 'info' })
  }

  const stapel = legStackAround(state, iso)
  if (stapel && iso === stapel.second) {
    out.push({
      id: 'benen-stapeling',
      text: stapel.text,
      tone: 'warn',
      move: { date: stapel.second, what: 'strength' },
    })
  }

  return out
}

/** Belast de sessie van deze dag de benen zwaar? */
export function isHeavyLegsSession(state: UserState, iso: string): boolean {
  return legLoadOn(state, iso).score >= LEG_LOAD_HIGH
}
