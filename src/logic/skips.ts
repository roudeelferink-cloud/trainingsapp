import type { SkipReason } from '../types'

/**
 * Overslaan: de redenen op één plek.
 *
 * Ze stonden met de hand nagebouwd op Vandaag en op de planpagina, allebei met dezelfde
 * vier regels. Sinds er een vijfde reden bij is die de app zélf zet — `ingehaald`, als
 * een opgepakte sessie de sessie van vandaag verdringt — moet de lijst waaruit je kiest
 * verschillen van de lijst waarmee een reden getoond wordt. Dat is precies het soort
 * onderscheid dat je maar op één plek wilt hebben.
 */

/** Wat een overgeslagen sessie op het scherm heet, per reden. */
export const SKIP_LABEL: Record<SkipReason, string> = {
  druk: 'Druk',
  etentje: 'Etentje',
  geen_zin: 'Geen zin',
  ziek: 'Ziek',
  ingehaald: 'Ingehaald',
}

/** De redenen die je zelf kiest. `ingehaald` staat er niet bij: die zet de app. */
export const SKIP_CHOICES: { id: SkipReason; label: string }[] = (
  ['druk', 'etentje', 'geen_zin', 'ziek'] as const
).map((id) => ({ id, label: SKIP_LABEL[id] }))

export function isSkipReason(v: unknown): v is SkipReason {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SKIP_LABEL, v)
}

/**
 * De reden waarmee de sessie van vandaag wijkt voor een sessie die je vandaag oppakt.
 * Hij is niet overgeslagen omdat je geen zin had, hij is overgeslagen omdat er iets
 * anders voor in de plaats kwam — en dat hoort er over een maand nog te staan.
 */
export const PICKED_UP_REASON: SkipReason = 'ingehaald'
