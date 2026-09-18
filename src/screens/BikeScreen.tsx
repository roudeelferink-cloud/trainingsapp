import { useEffect, useRef, useState, type ReactNode } from 'react'
import { beep, unlockSound } from '../components/bikeSound'
import { Actions, Caps, Meter, Primary, Screen, Secondary, TopLine } from '../components/logboek'
import { Sheet, Stepper } from '../components/ui'
import {
  BIKE_VARIANT_LABEL,
  bikeBlocks,
  blockAt,
  canUndoSwap,
  needsCaution,
  EASY_CAUTION,
  type BikeBlock,
} from '../logic/bike'
import { buildDay } from '../logic/day'
import { formatShort, today } from '../logic/dates'
import * as A from '../store/actions'
import { useStore } from '../store/store'

/**
 * De fietstraining die een krachtsessie vervangt: het blokkenschema, een timer per blok,
 * en na afloop de registratie.
 *
 * De timer werkt zoals de rusttimer: er wordt een starttijd bewaard, geen aftellend getal.
 * Waar je in de rit zit rekent `blockAt` uit met de klok van het toestel, dus gaat het
 * scherm uit, dan klopt het blok zodra het weer aangaat. De starttijd staat in
 * localStorage, zodat ook een herladen app de rit terugvindt.
 *
 * Bij elke blokwissel een geluidssignaal en een balk in oker met het nieuwe blok. Geen
 * trilling: die werkt niet in een iOS-PWA.
 */
export function BikeScreen({ date, onClose }: { date: string; onClose: () => void }) {
  const state = useStore()
  const plan = buildDay(state, date)
  const strength = plan.strength
  const bike = strength?.bike ?? null
  const sleutel = `trainingsapp.fietsrit.${state.id}.${date}`

  const [startedAt, setStartedAt] = useState<number | null>(() => leesStart(sleutel))
  const [now, setNow] = useState(() => Date.now())
  const [afronden, setAfronden] = useState(false)
  const [meer, setMeer] = useState(false)
  const [opgeslagen, setOpgeslagen] = useState(false)
  const [min, setMin] = useState(() => bike?.ride?.minutes ?? bike?.plannedMin ?? 40)
  const [km, setKm] = useState(() => bike?.ride?.distanceKm ?? 0)
  /** het blok waar net naartoe gewisseld is; staat een paar seconden in beeld */
  const [wissel, setWissel] = useState<BikeBlock | null>(null)
  const vorigBlok = useRef<number | null>(null)

  const blocks = bike
    ? bikeBlocks(bike.variant, { deload: plan.deload.active, caution: needsCaution(state, date) })
    : []
  const pos = startedAt === null ? null : blockAt(blocks, startedAt, now)

  // de klok loopt alleen zolang de rit loopt; bij terugkomen rekent hij meteen opnieuw
  useEffect(() => {
    if (startedAt === null || pos?.finished) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    const wakker = () => setNow(Date.now())
    document.addEventListener('visibilitychange', wakker)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', wakker)
    }
  }, [startedAt, pos?.finished])

  // een blokwissel: één keer geluid en één keer de balk, ook als er intussen meer gebeurde
  const index = pos?.index ?? null
  useEffect(() => {
    if (index === null) {
      vorigBlok.current = null
      return
    }
    if (vorigBlok.current !== null && vorigBlok.current !== index) {
      const nieuw = blocks[index]
      beep(nieuw?.hard ?? false)
      setWissel(nieuw ?? { label: 'Klaar', minutes: 0, text: 'De rit is af.', hard: false })
      const id = window.setTimeout(() => setWissel(null), 4000)
      vorigBlok.current = index
      return () => window.clearTimeout(id)
    }
    vorigBlok.current = index
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  if (!strength || !bike) {
    return (
      <Full>
        <Screen
          bottom="free"
          action={
            <Actions>
              <Primary onClick={onClose}>Terug</Primary>
            </Actions>
          }
        >
          <TopLine left="Fietsen" right={formatShort(date)} />
          <p className="quote mt-block">Er staat op {formatShort(date)} geen fietstraining.</p>
        </Screen>
      </Full>
    )
  }

  const naam = BIKE_VARIANT_LABEL[bike.variant]
  const ander = bike.variant === 'kracht_duur' ? 'duurrit' : 'kracht_duur'
  const huidig = pos && !pos.finished ? blocks[pos.index] : null
  const volgend = pos && !pos.finished ? blocks[pos.index + 1] : null

  function start() {
    unlockSound()
    const t = Date.now()
    schrijfStart(sleutel, t)
    setStartedAt(t)
    setNow(t)
  }

  function stopTimer() {
    wisStart(sleutel)
    setStartedAt(null)
  }

  function bewaar() {
    A.completeBikeSwap(date, min, km > 0 ? km : null)
    wisStart(sleutel)
    setStartedAt(null)
    setOpgeslagen(true)
  }

  return (
    <Full>
      <div className="flex h-full flex-col" onPointerDown={unlockSound}>
        {wissel && (
          <div
            role="status"
            className="flex-none bg-accent px-gutter py-in-block text-center text-button font-bold text-on-accent"
          >
            {wissel.minutes > 0 ? `Nu: ${wissel.label} · ${wissel.minutes} min` : 'Rit klaar'}
          </div>
        )}
        <div className="min-h-0 flex-1">
          <Screen
            bottom="free"
            action={
              <div className="flex flex-col gap-block">
                {huidig && pos && (
                  <div className="flex flex-col gap-timer">
                    <div className="flex items-baseline justify-between gap-column">
                      <Caps size="lg" tone={huidig.hard ? 'accent' : 'dim'}>
                        {huidig.label}
                      </Caps>
                      <div className="flex items-baseline gap-timer">
                        <div className="font-serif text-timer leading-none text-accent">
                          {klok(pos.remainingMs)}
                        </div>
                        <div className="text-meta text-faint">van {klok(huidig.minutes * 60_000)}</div>
                      </div>
                    </div>
                    <Meter ratio={pos.remainingMs / (huidig.minutes * 60_000)} />
                    <p className="text-meta text-dim">{huidig.text}</p>
                    {volgend && (
                      <p className="text-meta text-faint">
                        Hierna: {volgend.label.toLowerCase()} · {volgend.minutes} min
                      </p>
                    )}
                  </div>
                )}
                {pos?.finished && <Caps size="lg" tone="accent">Rit klaar</Caps>}
                <Actions>
                  {startedAt === null && !bike.ride ? (
                    <Primary onClick={start}>Start</Primary>
                  ) : (
                    <Primary onClick={() => setAfronden(true)}>
                      {bike.ride ? 'Rit bijwerken' : 'Afronden'}
                    </Primary>
                  )}
                  <Secondary onClick={() => setMeer(true)}>Meer</Secondary>
                </Actions>
              </div>
            }
          >
            <TopLine
              left={
                <button type="button" onClick={onClose} className="text-muted">
                  ← Fietsen
                </button>
              }
              right={formatShort(date)}
            />

            <h1 className="mt-block font-serif text-exercise leading-exercise text-ink">{naam}</h1>
            <div className="mt-in-block flex flex-wrap gap-meta text-label text-dim">
              <span>vervangt {strength.naam}</span>
              <span>~{bike.plannedMin} min</span>
              {plan.deload.active && bike.variant === 'kracht_duur' && <span>deloadweek: 3 blokken</span>}
              {bike.ride && <span>gereden: {bike.ride.minutes} min</span>}
            </div>

            {bike.variant === 'duurrit' && needsCaution(state, date) && (
              <p className="quote mt-block">{EASY_CAUTION}</p>
            )}

            <div className="mt-block flex flex-col">
              <Caps>Opbouw</Caps>
              <div className="mt-in-block flex flex-col">
                {blocks.map((b, i) => {
                  const nu = pos !== null && !pos.finished && pos.index === i
                  const klaar = pos !== null && (pos.finished || pos.index > i)
                  return (
                    <div
                      key={i}
                      aria-current={nu ? 'step' : undefined}
                      className={`flex items-baseline gap-column border-t-hair py-row ${
                        i === blocks.length - 1 ? 'border-b-hair' : ''
                      } ${nu ? 'border-accent' : 'border-rule'}`}
                    >
                      <div
                        className={`w-set-label flex-none text-label ${
                          nu ? 'font-semibold text-accent' : klaar ? 'text-faint' : 'text-dim'
                        }`}
                      >
                        {b.minutes} min
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-tight">
                        <span
                          className={`text-list ${nu ? 'text-ink' : klaar ? 'text-faint' : b.hard ? 'text-ink' : 'text-muted'}`}
                        >
                          {b.label}
                        </span>
                        {!klaar && <span className="text-meta leading-meta text-dim">{b.text}</span>}
                      </div>
                      {nu ? (
                        <Caps tone="accent" size="lg" className="shrink-0">
                          Nu
                        </Caps>
                      ) : klaar ? (
                        <span className="shrink-0 text-meta text-faint">✓</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </Screen>
        </div>
      </div>

      <Sheet
        open={afronden}
        onClose={() => {
          setAfronden(false)
          setOpgeslagen(false)
        }}
        title="Fietsen afronden"
      >
        {opgeslagen ? (
          <div className="flex flex-col gap-block">
            <Caps tone="accent">Opgeslagen</Caps>
            <p className="quote">
              {min} minuten {naam.toLowerCase()}
              {km > 0 ? `, ${String(km).replace('.', ',')} km` : ''} op {formatShort(date)}. Hij staat in
              de historie, in plaats van {strength.naam}.
            </p>
            <button className="btn-primary w-full" onClick={onClose}>
              Klaar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-block">
            <div className="flex flex-col gap-in-block">
              <Caps>Duur</Caps>
              <Stepper value={min} onChange={setMin} step={5} min={1} max={180} suffix="min" ariaLabel="Duur in minuten" />
            </div>
            <div className="flex flex-col gap-in-block">
              <Caps>Afstand — optioneel</Caps>
              <Stepper
                value={km}
                onChange={setKm}
                step={0.5}
                decimals={1}
                min={0}
                max={150}
                suffix="km"
                ariaLabel="Afstand in kilometer"
              />
            </div>
            <button className="btn-primary w-full" onClick={bewaar}>
              Opslaan
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={meer} onClose={() => setMeer(false)} title={naam}>
        <div className="flex flex-col gap-in-block">
          {!bike.ride && (
            <button
              className="btn-ghost w-full"
              onClick={() => {
                A.setBikeVariant(date, ander)
                stopTimer()
                setMeer(false)
              }}
            >
              Toch {BIKE_VARIANT_LABEL[ander].toLowerCase()}
            </button>
          )}
          {startedAt !== null && (
            <button
              className="btn-ghost w-full"
              onClick={() => {
                stopTimer()
                setMeer(false)
              }}
            >
              Timer stoppen
            </button>
          )}
          {canUndoSwap(date, today()) && (
            <button
              className="btn-quiet w-full"
              onClick={() => {
                A.undoBikeSwap(date)
                wisStart(sleutel)
                setMeer(false)
                onClose()
              }}
            >
              Terug naar {strength.naam}
            </button>
          )}
        </div>
      </Sheet>
    </Full>
  )
}

/** Milliseconden als m:ss, naar boven afgerond zodat '0:00' pas op nul staat. */
function klok(ms: number): string {
  const totaal = Math.ceil(ms / 1000)
  const m = Math.floor(totaal / 60)
  const s = totaal % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/* De starttijd van de rit, per profiel en per dag. Opslag kan weigeren; dan loopt de
   timer gewoon in het geheugen. */

function leesStart(sleutel: string): number | null {
  try {
    const v = Number(localStorage.getItem(sleutel))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

function schrijfStart(sleutel: string, t: number): void {
  try {
    localStorage.setItem(sleutel, String(t))
  } catch {
    /* zie hierboven */
  }
}

function wisStart(sleutel: string): void {
  try {
    localStorage.removeItem(sleutel)
  } catch {
    /* zie hierboven */
  }
}

/** Net als de krachtsessie: het scherm dekt de app af, met een eigen weg terug. */
function Full({ children }: { children: ReactNode }) {
  return <div className="safe-top fixed inset-0 z-40 flex flex-col bg-bg">{children}</div>
}
