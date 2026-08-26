/**
 * Wat er mis kan gaan, en met welke code dat naar buiten komt.
 *
 * Eén type fout voor het hele servertje. De HTTP-status hangt aan de code, zodat de
 * plek waar de fout ontstaat niets van HTTP hoeft te weten en het antwoord op één plek
 * vastligt.
 */
export type FoutCode =
  /** het verzoek klopte niet: geen JSON, geen profiel, geen staat */
  | 'verzoek'
  /** er staat geen ANTHROPIC_API_KEY in de omgeving */
  | 'geen_sleutel'
  /** de API was niet bereikbaar, weigerde, of deed er te lang over */
  | 'api_onbereikbaar'
  /** er kwam een antwoord, maar er viel geen volledig advies uit te halen */
  | 'kapot_antwoord'
  /** de daglimiet voor dit profiel is op */
  | 'te_vaak'

const STATUS: Record<FoutCode, number> = {
  verzoek: 400,
  geen_sleutel: 503,
  api_onbereikbaar: 502,
  kapot_antwoord: 502,
  te_vaak: 429,
}

export class ReviewFout extends Error {
  readonly code: FoutCode

  constructor(code: FoutCode, message: string) {
    super(message)
    this.name = 'ReviewFout'
    this.code = code
  }

  get status(): number {
    return STATUS[this.code]
  }
}

export function isReviewFout(e: unknown): e is ReviewFout {
  return e instanceof ReviewFout
}
