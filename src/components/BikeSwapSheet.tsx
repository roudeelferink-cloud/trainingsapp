import { BIKE_VARIANT_LABEL, EASY_CAUTION, needsCaution, plannedMinutes } from '../logic/bike'
import { bikeSuggestion } from '../logic/bikeSwap'
import * as A from '../store/actions'
import { useStore } from '../store/store'
import type { BikeVariant } from '../types'
import { Caps } from './logboek'
import { Sheet } from './ui'

/**
 * "Vervang door fietsen": de app stelt één variant voor, de andere staat eronder. Eén tik
 * op een van de twee en de krachtsessie is vervangen — geen tweede bevestiging.
 *
 * Hetzelfde blad op Vandaag, op Plannen en in het sessiescherm; er is er maar één.
 */
export function BikeSwapSheet({
  open,
  iso,
  naam,
  onClose,
  onDone,
}: {
  open: boolean
  iso: string
  /** de krachtsessie die vervangen wordt, zoals hij op het scherm heet */
  naam: string
  onClose: () => void
  /** na het vervangen, bijvoorbeeld om het sessiescherm te sluiten */
  onDone?: () => void
}) {
  const state = useStore()
  if (!open) return null

  const voorstel = bikeSuggestion(state, iso)
  const ander: BikeVariant = voorstel.variant === 'kracht_duur' ? 'duurrit' : 'kracht_duur'
  const kies = (variant: BikeVariant) => {
    const res = A.replaceWithBike(iso, variant)
    onClose()
    if (res.ok) onDone?.()
  }

  return (
    <Sheet open onClose={onClose} title="Vervang door fietsen">
      <p className="mb-block text-body text-muted">
        {naam} wordt een training op de spinningfiets. Het schema schuift niet en de
        streefgewichten blijven staan; vandaag is het nog terug te draaien.
      </p>
      <div className="flex flex-col gap-in-block">
        <Caps tone="accent">Voorstel</Caps>
        <p className="quote">{voorstel.reason}</p>
        <button className="btn-primary w-full" onClick={() => kies(voorstel.variant)}>
          {BIKE_VARIANT_LABEL[voorstel.variant]} · ~{plannedMinutes(state, iso, voorstel.variant)} min
        </button>
        <button className="btn-ghost w-full" onClick={() => kies(ander)}>
          {BIKE_VARIANT_LABEL[ander]} · ~{plannedMinutes(state, iso, ander)} min
        </button>
        {needsCaution(state, iso) && <p className="text-meta text-dim">Duurrit: {EASY_CAUTION}</p>}
      </div>
    </Sheet>
  )
}
