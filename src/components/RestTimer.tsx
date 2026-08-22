import { useEffect, useState } from 'react'
import { Caps, Meter } from './logboek'

/**
 * De rusttimer: een regel met de resterende tijd en een lijn die leegloopt.
 *
 * Er wordt een eindtijd bewaard, geen aftellend getal. Zo klopt de tijd ook nog als
 * het scherm even uit is geweest of de telefoon de timer heeft laten slapen — de
 * klok van het toestel is de waarheid, niet een teller die doorliep of niet.
 *
 * Nooit een modal en nooit iets dat de knop blokkeert: rusten is een suggestie, geen
 * poortje. Bij nul een korte tik, en de regel zegt dat de rust voorbij is.
 */
export function RestTimer({
  endsAt,
  totalSeconds,
  label,
}: {
  /** tijdstip waarop de rust afloopt, in ms sinds epoch */
  endsAt: number
  totalSeconds: number
  /** waar de rust bij hoort: 'Rust na set 1' */
  label: string
}) {
  const [now, setNow] = useState(() => Date.now())
  const over = Math.max(0, endsAt - now)
  const voorbij = over === 0

  useEffect(() => {
    if (endsAt <= Date.now()) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [endsAt])

  // één trilling op het moment dat de rust afloopt, niet bij elke render daarna
  const [getikt, setGetikt] = useState(false)
  useEffect(() => {
    if (!voorbij || getikt) return
    setGetikt(true)
    navigator.vibrate?.(60)
  }, [voorbij, getikt])
  useEffect(() => setGetikt(false), [endsAt])

  return (
    <div className="flex flex-col gap-timer">
      <div className="flex items-baseline justify-between gap-column">
        <Caps size="lg">{voorbij ? 'Rust voorbij' : label}</Caps>
        {!voorbij && (
          <div className="flex items-baseline gap-timer">
            <div className="font-serif text-timer leading-none text-accent">{klok(over)}</div>
            <div className="text-meta text-faint">van {klok(totalSeconds * 1000)}</div>
          </div>
        )}
      </div>
      {/* de lijn loopt leeg: wat er nog staat, is wat er nog rest */}
      <Meter ratio={totalSeconds > 0 ? over / (totalSeconds * 1000) : 0} />
    </div>
  )
}

/** Milliseconden als m:ss, naar boven afgerond zodat '0:00' pas op nul staat. */
function klok(ms: number): string {
  const totaal = Math.ceil(ms / 1000)
  const m = Math.floor(totaal / 60)
  const s = totaal % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
