import { useEffect, useRef, useState } from 'react'
import { Caps, Screen, TopLine } from '../components/logboek'
import { Card, ChoiceGrid, Chip, ConfirmCheck, DecimalField, SectionTitle, Sheet, Stepper, Toggle } from '../components/ui'
import { BY_ID, LOAD_LABEL } from '../data/exercises'
import { BAR_IDS, BAR_LABEL, DEFAULT_BAR_WEIGHTS } from '../logic/barWeight'
import { PLATE_OPTIONS, smallestPlate } from '../logic/plates'
import { TEMPLATES } from '../data/plan'
import { programById } from '../data/programs'
import { dataSummary, exportReminder, exportWarning } from '../logic/stats'
import { formatShort } from '../logic/dates'
import {
  MAX_ATTEMPTS,
  PIN_LENGTH,
  blockSecondsLeft,
  canConfirm,
  currentGuard,
  isValidPin,
  registerAttempt,
  sanitizePin,
} from '../logic/wipeGuard'
import { OtherScreen } from './OtherScreen'
import * as A from '../store/actions'
import {
  changePin,
  defaultState,
  exportJSON,
  hasPin,
  importJSON,
  SCHEMA_VERSION,
  setCurrentUser,
  setPin,
  setUserName,
  useRoot,
  useStore,
  wipeUsers,
} from '../store/store'
import { normalizeSettings } from '../store/settings'
import { THEME_OPTIONS, readTheme, setTheme, type ThemeChoice } from '../theme'
import type { LoadArea, Sensitivity, UserState } from '../types'

const AREAS: LoadArea[] = [
  'knee_deep',
  'hip_deep',
  'achilles',
  'calf',
  'lateral_hip',
  'lower_back',
  'shoulder',
]

const SENS_LABEL: Record<Sensitivity, string> = {
  ok: 'ok',
  careful: 'let op',
  off: 'gevoelig',
}

/**
 * Een gebruiker waar dit scherm veilig op kan lezen. De store levert genormaliseerde
 * instellingen aan, maar het scherm gaat daar niet vanuit: een half opgeslagen object
 * of een oude JSON-export mag hooguit een standaardwaarde tonen, nooit het hele scherm
 * zwart maken.
 */
function safeUser(user: UserState | undefined | null): UserState {
  const base = user ?? defaultState()
  return {
    ...base,
    settings: normalizeSettings(base.settings),
    permanentReplacements: base.permanentReplacements ?? {},
  }
}

/** Downloadt de volledige export. Ook de wisdialoog gebruikt dit. */
function downloadExport(): void {
  const blob = new Blob([exportJSON()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trainingsapp-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function SettingsScreen({ onClose }: { onClose?: () => void }) {
  const state = safeUser(useStore())
  const settings = state.settings
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const reminder = exportReminder(state)

  function doExport() {
    downloadExport()
    setMessage('Export gedownload. De herinnering staat weer op 30 dagen.')
  }

  async function doImport(file: File) {
    const text = await file.text()
    const res = importJSON(text)
    setMessage(res.ok ? 'Import gelukt.' : `Import mislukt: ${res.error}`)
  }

  const permanents = Object.entries(state.permanentReplacements)

  return (
    <Screen>
      <TopLine
        left={
          onClose ? (
            <button type="button" onClick={onClose} className="text-muted">
              ← Historie
            </button>
          ) : (
            'Instellingen'
          )
        }
        right={onClose ? 'Instellingen' : undefined}
      />
      {message && <p className="quote mt-block">{message}</p>}

      <ThemaCard />

      <Card>
        <SectionTitle>Lichaamsgewicht</SectionTitle>
        <div className="flex items-center gap-2">
          <DecimalField
            ariaLabel="Lichaamsgewicht"
            placeholder="kg"
            value={settings.bodyweightKg}
            onChange={A.setBodyweight}
          />
          <span className="text-body text-dim">kg</span>
        </div>
        <p className="mt-in-block text-body text-muted">
          Basis voor het startgewichtadvies bij nieuwe oefeningen.
        </p>
      </Card>

      <Card>
        <SectionTitle>Gevoelige gebieden</SectionTitle>
        <p className="mb-block text-body text-muted">
          Op <b>gevoelig</b> filtert de app alle oefeningen met dat label eruit en kiest automatisch een
          alternatief uit hetzelfde patroon. <b>Let op</b> laat het werk staan, maar bouwt op vanaf de
          laagste weerstand.
        </p>
        <div className="flex flex-col gap-in-block">
          {AREAS.map((a) => (
            <div key={a} className="flex items-center justify-between gap-2">
              <span className="text-body text-ink">{LOAD_LABEL[a]}</span>
              <div className="flex gap-1 shrink-0">
                {(['ok', 'careful', 'off'] as Sensitivity[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => A.setSensitivity(a, v)}
                    aria-pressed={settings.sensitive?.[a] === v}
                    className={`min-h-tap border-hair px-3 text-meta transition-colors duration-color ${
                      settings.sensitive?.[a] === v
                        ? 'border-accent bg-accent font-semibold text-on-accent'
                        : 'border-chip-border text-dim'
                    }`}
                  >
                    {SENS_LABEL[v]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Stanggewicht</SectionTitle>
        <p className="mb-block text-body text-muted">
          Bij een oefening met een stang vul je alleen de schijven in. De app telt het gewicht van de
          stang erbij en toont het totaal.
        </p>
        <div className="flex flex-col gap-block">
          {BAR_IDS.map((bar) => (
            <div key={bar}>
              <Caps className="mb-in-block">{BAR_LABEL[bar]}</Caps>
              <Stepper
                ariaLabel={`Gewicht ${BAR_LABEL[bar]}`}
                value={settings.barWeights?.[bar] ?? DEFAULT_BAR_WEIGHTS[bar]}
                onChange={(v) => A.setBarWeight(bar, v)}
                step={0.5}
                min={1}
                max={40}
                decimals={1}
                suffix="kg"
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Schijven</SectionTitle>
        <p className="mb-block text-body text-muted">
          Welke schijven er liggen. Ze gaan per paar op de stang, dus de kleinste echte stap is
          twee keer de lichtste schijf: nu <b>{smallestPlate(settings) * 2} kg</b>. Een voorstel dat
          niet te laden is, doet de app niet.
        </p>
        <div className="flex flex-wrap gap-2">
          {PLATE_OPTIONS.map((kg) => {
            const aan = settings.plates.includes(kg)
            return (
              <button
                key={kg}
                aria-pressed={aan}
                onClick={() => A.togglePlate(kg)}
                className={`min-h-tap border-hair px-3 text-body transition-colors duration-color ${
                  aan ? 'border-accent bg-accent font-semibold text-on-accent' : 'border-chip-border text-dim'
                }`}
              >
                {String(kg).replace('.', ',')} kg
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>Reismodus</SectionTitle>
        <Toggle
          checked={settings.travelMode}
          onChange={A.setTravelMode}
          label="Reismodus aan"
          hint="Alles naar lichaamsgewicht en band, max 30 min. Loopdagen blijven ongewijzigd."
        />
      </Card>

      <Card>
        <SectionTitle>Permanent vervangen oefeningen</SectionTitle>
        {permanents.length === 0 ? (
          <p className="text-body text-muted">Geen. Deze rouleren niet mee met de 12-weekse wissel.</p>
        ) : (
          <div className="flex flex-col gap-in-block">
            {permanents.map(([slotKey, exId]) => (
              <div key={slotKey} className="flex items-center gap-2">
                <span className="flex-1 text-body">
                  <span className="text-dim">{slotLabel(slotKey)} → </span>
                  {BY_ID[exId]?.naam ?? exId}
                </span>
                <button className="btn-quiet btn-sm shrink-0" onClick={() => A.undoPermanent(slotKey)}>
                  Herstel
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle right={<Chip tone="off">schema v{SCHEMA_VERSION}</Chip>}>Back-up</SectionTitle>
        {reminder && (
          <div className="mb-block flex flex-col gap-tight">
            <Caps tone="accent">{reminder.text}</Caps>
            <p className="text-meta leading-meta text-dim">
              Alles staat alleen op dit toestel. Zonder export ben je bij het wissen van je
              browserdata alles kwijt.
            </p>
          </div>
        )}
        <p className="mb-block text-body text-muted">
          Alles staat op dit toestel; er gaat niets naar internet. Een export is daarmee ook de
          enige manier om je gegevens naar een ander toestel te verplaatsen: exporteer hier, en
          importeer het bestand daar. Een import vervangt alles wat er op dat toestel staat.
        </p>
        <div className="flex flex-col gap-in-block">
          <button className="btn-ghost w-full" onClick={doExport}>
            Exporteer alles
          </button>
          <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()}>
            Importeer
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void doImport(f)
              e.target.value = ''
            }}
          />
        </div>
      </Card>

      <p className="mt-block text-meta text-faint">
        Startdatum programma: {state.startDate}. Alles blijft lokaal op dit toestel.
      </p>

      <ProfielCard />

      <GegevensbeheerCard />
    </Screen>
  )
}

/**
 * Licht of donker. Standaard volgt de app het toestel; dat is wat een telefoon 's
 * avonds vanzelf goed zet. De keuze hoort bij dit toestel en niet bij je
 * trainingsgeschiedenis, dus hij gaat niet mee in de export.
 */
function ThemaCard() {
  const [keuze, setKeuze] = useState<ThemeChoice>(() => readTheme())

  return (
    <Card>
      <SectionTitle>Weergave</SectionTitle>
      <ChoiceGrid
        options={THEME_OPTIONS}
        value={keuze}
        onChange={(id) => {
          setKeuze(id)
          setTheme(id)
        }}
      />
      <p className="mt-in-block text-meta leading-meta text-dim">
        Systeem volgt de instelling van je telefoon. De keuze geldt alleen op dit toestel en
        staat niet in de back-up.
      </p>
    </Card>
  )
}

/**
 * Wie dit toestel gebruikt, en hoe die persoon heet.
 *
 * Wisselen is geen dagelijkse handeling meer — het staat daarom hier onderaan en niet
 * in de onderbalk. Het zet alleen om wie je ziet en voor wie je logt: de gegevens van
 * beide profielen blijven staan waar ze staan.
 */
function ProfielCard() {
  const root = useRoot()
  const [naam, setNaam] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [wisselen, setWisselen] = useState(false)
  const [meekijken, setMeekijken] = useState(false)

  const users = Object.values(root.users ?? {})
  const huidige = root.users?.[root.currentUser]
  const ander = users.find((u) => u.id !== root.currentUser)

  return (
    <Card>
      <SectionTitle right={<Chip tone="off">dit toestel</Chip>}>Profiel</SectionTitle>

      <p className="text-body text-muted">
        <b>{huidige?.naam ?? 'Niemand'}</b>
        {huidige && ` — ${programById(huidige.programId).naam}`}
      </p>
      <p className="mb-block mt-tight text-meta text-dim">
        {huidige ? programById(huidige.programId).omschrijving : 'Kies wie dit toestel gebruikt.'}
      </p>

      <Caps className="mb-in-block">Jouw naam</Caps>
      <div className="flex gap-2">
        <input
          className="field"
          placeholder={huidige?.naam ?? ''}
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
        />
        <button
          className="btn-ghost btn-sm shrink-0"
          onClick={() => {
            if (naam.trim() && huidige) {
              setUserName(huidige.id, naam.trim())
              setNaam('')
              setMsg('Naam aangepast.')
            }
          }}
        >
          Opslaan
        </button>
      </div>
      {msg && <p className="mt-in-block text-body text-muted">{msg}</p>}

      <div className="mt-block flex flex-col gap-in-block border-t-hair border-rule pt-block">
        {wisselen ? (
          <>
            <p className="text-body text-muted">
              Wie gebruikt dit toestel vanaf nu? Er wordt niets gewist: de gegevens van allebei
              blijven staan en je kunt altijd terugwisselen.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u.id)
                    setWisselen(false)
                    setMeekijken(false)
                    setMsg(`Dit toestel staat nu op ${u.naam}.`)
                  }}
                  className={`min-h-tap border-hair px-3 text-body transition-colors duration-color ${
                    u.id === root.currentUser
                      ? 'border-accent bg-accent font-semibold text-on-accent'
                      : 'border-chip-border text-dim'
                  }`}
                >
                  {u.naam}
                </button>
              ))}
            </div>
            <button className="btn-quiet btn-sm w-full" onClick={() => setWisselen(false)}>
              Annuleren
            </button>
          </>
        ) : (
          <button className="btn-quiet btn-sm w-full" onClick={() => setWisselen(true)}>
            Ander profiel gebruiken
          </button>
        )}

        {ander && (
          <button className="btn-quiet btn-sm w-full" onClick={() => setMeekijken((v) => !v)}>
            {meekijken ? 'Meekijken sluiten' : `Meekijken met ${ander.naam}`}
          </button>
        )}
      </div>

      {meekijken && (
        <div className="mt-block border-t-hair border-rule pt-block">
          <OtherScreen />
        </div>
      )}
    </Card>
  )
}

/**
 * Gegevensbeheer: de enige plek waar gegevens verdwijnen.
 *
 * Staat onderaan, apart van de rest en standaard dichtgeklapt — wissen is geen
 * instelling maar een ingreep. De pincode ervoor is misklikbeveiliging, geen echte
 * beveiliging: hij staat leesbaar in localStorage. Zie `src/logic/wipeGuard.ts`.
 */
function GegevensbeheerCard() {
  const root = useRoot()
  const state = safeUser(useStore())
  const [open, setOpen] = useState(false)
  const [wissen, setWissen] = useState(false)
  const [pinVorm, setPinVorm] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [seconden, setSeconden] = useState(() => blockSecondsLeft(currentGuard()))

  // tijdens een blokkade elke seconde bijwerken, zodat de teller echt loopt
  useEffect(() => {
    if (seconden <= 0) return
    const t = setInterval(() => setSeconden(blockSecondsLeft(currentGuard())), 1000)
    return () => clearInterval(t)
  }, [seconden])

  const geblokkeerd = seconden > 0
  const pinGezet = hasPin()

  function probeerWissen() {
    if (geblokkeerd) return
    if (!pinGezet) {
      setPinVorm(true)
      setMsg('Stel eerst een pincode in. Zonder code kan er niets gewist worden.')
      return
    }
    setMsg(null)
    setWissen(true)
  }

  return (
    <div className="mt-block border-t-hair border-rule pt-block">
      <button
        className="w-full flex items-center justify-between gap-2 py-2 px-1 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <span className="block text-list text-ink">Gegevensbeheer</span>
          <span className="block text-meta text-faint">
            Pincode en het wissen van gegevens. Dichtgeklapt, want hier gaat het mis.
          </span>
        </span>
        <span className="shrink-0 text-label text-dim" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <Card className="mt-2">
          <PincodeVorm
            open={pinVorm}
            onOpen={() => setPinVorm(true)}
            onClose={() => setPinVorm(false)}
            onDone={(t) => {
              setPinVorm(false)
              setMsg(t)
            }}
          />

          <div className="mt-block border-t-hair border-rule pt-block">
            <p className="mb-in-block text-body text-muted">
              Wissen kan niet ongedaan gemaakt worden en geldt voor {state.naam}, tenzij je in de
              dialoog aangeeft dat het andere profiel ook mee moet.
            </p>
            <button
              className="btn-primary w-full disabled:opacity-40"
              disabled={geblokkeerd}
              onClick={probeerWissen}
            >
              Gegevens wissen
            </button>
            {geblokkeerd && (
              <p className="mt-in-block text-body text-accent" role="alert">
                Te vaak een verkeerde pincode. Nog {seconden} seconden geblokkeerd.
              </p>
            )}
            {msg && <p className="mt-in-block text-body text-muted">{msg}</p>}
          </div>
        </Card>
      )}

      <WisDialoog
        open={wissen}
        onClose={() => setWissen(false)}
        onBlocked={() => {
          setWissen(false)
          setSeconden(blockSecondsLeft(currentGuard()))
        }}
        onDone={(t) => {
          setWissen(false)
          setMsg(t)
        }}
        gebruikerId={root.currentUser}
      />
    </div>
  )
}

/** Pincode instellen of wijzigen. Wijzigen kan alleen met de oude code erbij. */
function PincodeVorm({
  open,
  onOpen,
  onClose,
  onDone,
}: {
  open: boolean
  onOpen: () => void
  onClose: () => void
  onDone: (bericht: string) => void
}) {
  const [oud, setOud] = useState('')
  const [nieuw, setNieuw] = useState('')
  const [herhaal, setHerhaal] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const gezet = hasPin()

  function opslaan() {
    if (!isValidPin(nieuw)) return setFout(`Een pincode is ${PIN_LENGTH} cijfers.`)
    if (nieuw !== herhaal) return setFout('De twee nieuwe codes zijn niet gelijk.')
    const ok = gezet ? changePin(oud, nieuw) : setPin(nieuw)
    if (!ok) return setFout('De oude pincode klopt niet.')
    setOud('')
    setNieuw('')
    setHerhaal('')
    setFout(null)
    onDone(gezet ? 'Pincode gewijzigd.' : 'Pincode ingesteld.')
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">
          Pincode
          <span className="block text-meta text-faint">
            {gezet ? 'Ingesteld' : 'Nog niet ingesteld — wissen is nu niet mogelijk'}
          </span>
        </span>
        <button className="btn-quiet btn-sm shrink-0" onClick={onOpen}>
          {gezet ? 'Wijzigen' : 'Instellen'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-in-block">
      <Caps>{gezet ? 'Pincode wijzigen' : 'Pincode instellen'}</Caps>
      {gezet && (
        <PinInput label="Oude pincode" value={oud} onChange={setOud} />
      )}
      <PinInput label="Nieuwe pincode" value={nieuw} onChange={setNieuw} />
      <PinInput label="Nieuwe pincode herhalen" value={herhaal} onChange={setHerhaal} />
      {fout && (
        <p className="text-body text-accent" role="alert">
          {fout}
        </p>
      )}
      <p className="text-meta leading-meta text-faint">
        De code staat gewoon op dit toestel opgeslagen. Hij is er tegen een misklik, niet
        tegen iemand die je telefoon in handen heeft.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-ghost btn-sm" onClick={opslaan}>
          Opslaan
        </button>
        <button className="btn-quiet btn-sm" onClick={onClose}>
          Annuleren
        </button>
      </div>
    </div>
  )
}

function PinInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <Caps className="mb-tight">{label}</Caps>
      <input
        className="field text-center font-mono tracking-caps-wide"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        placeholder={'0'.repeat(PIN_LENGTH)}
        value={value}
        onChange={(e) => onChange(sanitizePin(e.target.value))}
      />
    </div>
  )
}

/**
 * De wisdialoog. Toont eerst wat er precies verdwijnt, dan pas de pincode. De
 * bevestigknop blijft uit tot de juiste code er staat; drie fouten sluiten de dialoog
 * en zetten de actie een minuut op slot.
 *
 * Geëxporteerd zodat de test hem los kan renderen; in de app komt hij alleen via
 * Gegevensbeheer op het scherm.
 */
export function WisDialoog({
  open,
  onClose,
  onBlocked,
  onDone,
  gebruikerId,
}: {
  open: boolean
  onClose: () => void
  onBlocked: () => void
  onDone: (bericht: string) => void
  gebruikerId: string
}) {
  const root = useRoot()
  const state = safeUser(useStore())
  const [code, setCode] = useState('')
  const [ookAnder, setOokAnder] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  const ander = Object.values(root.users ?? {}).find((u) => u.id !== gebruikerId)
  const samenvatting = dataSummary(state)
  const waarschuwing = exportWarning(state)
  const codeOk = canConfirm(root.pin, code)

  function controleer(waarde: string) {
    setCode(waarde)
    setFout(null)
    if (!isValidPin(waarde)) return

    const res = registerAttempt(root.pin, waarde)
    if (res.ok) return
    setCode('')
    if (res.blocked) {
      setFout(null)
      onBlocked()
      return
    }
    setFout(`Verkeerde pincode. Nog ${res.left} ${res.left === 1 ? 'poging' : 'pogingen'}.`)
  }

  function wis() {
    if (!codeOk) return
    const ids = ookAnder && ander ? [gebruikerId, ander.id] : [gebruikerId]
    wipeUsers(ids)
    setCode('')
    setOokAnder(false)
    onDone('Gegevens gewist. Kies wie dit toestel gebruikt.')
  }

  if (!open) return null

  return (
    <Sheet open onClose={onClose} title="Gegevens wissen">
      <div className="flex flex-col gap-block">
        {waarschuwing && (
          <div className="flex flex-col gap-in-block">
            <Caps tone="accent">{waarschuwing} Hierna is deze historie weg.</Caps>
            <button className="btn-ghost w-full" onClick={downloadExport}>
              Eerst exporteren
            </button>
          </div>
        )}

        <div className="border-hair border-rule p-3">
          <p className="mb-tight text-body text-ink">Dit verdwijnt van {state.naam}:</p>
          <ul className="flex flex-col gap-tight text-body text-muted">
            <li>{samenvatting.sessions} gelogde krachtsessies</li>
            <li>{samenvatting.runs} hardloopsessies</li>
            <li>{samenvatting.activities} losse activiteiten</li>
            <li>
              {samenvatting.oldest
                ? `oudste log: ${formatShort(samenvatting.oldest)}`
                : 'nog geen logs'}
            </li>
          </ul>
          <p className="mt-in-block text-meta text-faint">
            Ook de instellingen en streefgewichten van dit profiel gaan mee.
          </p>
        </div>

        {ander && (
          <ConfirmCheck checked={ookAnder} onToggle={() => setOokAnder((v) => !v)}>
            Ook het profiel van {ander.naam} wissen
            <span className="block text-meta text-faint">
              Standaard blijft dat staan; alleen {state.naam} wordt gewist.
            </span>
          </ConfirmCheck>
        )}

        <div>
          <PinInput label="Pincode" value={code} onChange={controleer} />
          {fout && (
            <p className="mt-tight text-body text-accent" role="alert">
              {fout}
            </p>
          )}
          <p className="mt-tight text-meta text-faint">
            De knop hieronder gaat pas aan bij de juiste code. Na {MAX_ATTEMPTS} fouten sluit dit
            venster en is wissen een minuut geblokkeerd.
          </p>
        </div>

        <button
          className="btn-primary w-full disabled:opacity-40"
          disabled={!codeOk}
          onClick={wis}
        >
          Definitief wissen
        </button>
        <button className="btn-quiet w-full" onClick={onClose}>
          Annuleren
        </button>
      </div>
    </Sheet>
  )
}

function slotLabel(slotKey: string): string {
  const [kind, idx] = slotKey.split(':')
  const tpl = (TEMPLATES as Record<string, { naam: string; slots: { exerciseId: string }[] }>)[kind]
  if (!tpl) return slotKey
  const original = tpl.slots[Number(idx)]
  return `${tpl.naam}: ${original ? (BY_ID[original.exerciseId]?.naam ?? '') : ''}`
}
