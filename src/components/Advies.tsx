import { useEffect, useRef, useState } from 'react'
import { Caps } from './logboek'
import { formatShort, today } from '../logic/dates'
import { fetchReview, needsFetch } from '../logic/review'
import { saveReview } from '../store/actions'
import { currentUserId, getRoot, useStore } from '../store/store'

/**
 * Het adviesblok op Historie.
 *
 * Wat er staat komt van de server op de Pi; wat de app zélf bijstuurt staat elders en
 * verandert hier niet van. Drie dingen die het ontwerp bepalen:
 *
 * - **Stil als er niets is.** Nooit opgehaald, geen server, geen netwerk: dan staat er
 *   geen blok. Geen foutmelding, geen lege huls, geen spinner die blijft draaien — je
 *   kunt hier midden in een sessie zijn, en dan hoort de app gewoon te werken.
 * - **Eén ophaalpoging per dag.** Is het opgeslagen advies van vandaag, dan gaat er geen
 *   verzoek uit. Is het ouder, dan blijft het staan terwijl het nieuwe onderweg is; zo
 *   springt het blok niet leeg en weer vol.
 * - **Per profiel.** Het advies hoort bij de gebruiker die het toestel gebruikt, en gaat
 *   mee als je wisselt.
 *
 * Alle maten en kleuren komen uit de tokens; er staat hier geen enkele eigen waarde.
 */
export function Advies() {
  const state = useStore()
  const iso = today()
  const cache = state.review
  const userId = currentUserId()

  // welke (profiel, dag) er al opgehaald is; voorkomt een tweede verzoek bij hertekenen
  const gevraagd = useRef<string | null>(null)
  const [bezig, setBezig] = useState(false)

  useEffect(() => {
    const sleutel = `${userId}:${iso}`
    if (!needsFetch(cache, iso) || gevraagd.current === sleutel) return
    gevraagd.current = sleutel

    const controller = new AbortController()
    setBezig(true)
    // de volledige staat, in dezelfde vorm als de JSON-export
    fetchReview({ profiel: userId, vandaag: iso, state: getRoot(), signal: controller.signal })
      .then((res) => {
        if (res) saveReview(userId, res)
      })
      .finally(() => setBezig(false))

    return () => controller.abort()
    // Bewust alleen de datum van het advies en niet het hele object: elke andere
    // schrijfactie in de app maakt een nieuwe staat, en die zou een lopend verzoek
    // afbreken. Wisselen van profiel komt binnen via `userId`.
  }, [userId, iso, cache?.datum])

  if (!cache) return null

  const oud = cache.datum !== iso

  return (
    <div className="mt-block flex flex-col gap-in-block">
      <div className="flex items-baseline justify-between gap-column">
        <Caps>Advies</Caps>
        {oud && <span className="text-meta text-faint">{formatShort(cache.datum)}</span>}
      </div>

      <p className="font-serif italic text-lead leading-quote text-ink-quote">
        {cache.review.toon}
      </p>

      <ul className="flex flex-col">
        {cache.review.signalen.map((s, i) => (
          <li
            key={`signaal-${i}`}
            className="border-t-hair border-rule py-row text-body text-muted last:border-b-hair"
          >
            {s}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-tight">
        <Caps tone="accent">Wat je ermee doet</Caps>
        <ul className="flex flex-col">
          {cache.review.advies.map((a, i) => (
            <li
              key={`advies-${i}`}
              className="border-t-hair border-rule py-row text-body text-ink last:border-b-hair"
            >
              {a}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-meta leading-meta text-dim">
        {bezig
          ? 'Bezig met een nieuw advies…'
          : 'Van de server thuis, hooguit één keer per dag. Wat de app zelf voorstelt staat hier los van en verandert hier niet door.'}
      </p>
    </div>
  )
}
