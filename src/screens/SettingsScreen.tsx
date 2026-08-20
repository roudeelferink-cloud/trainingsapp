import { useEffect, useRef, useState } from 'react'
import { Card, Chip, ConfirmCheck, DecimalField, SectionTitle, Sheet, Stepper, Toggle } from '../components/ui'
import { BY_ID, LOAD_LABEL } from '../data/exercises'
import { BAR_IDS, BAR_LABEL, DEFAULT_BAR_WEIGHTS } from '../logic/barWeight'
import { PLATE_OPTIONS, smallestPlate } from '../logic/plates'
import { TEMPLATES } from '../data/plan'
import { programById } from '../data/programs'
import { dataSummary, exportReminder, exportWarning, proteinGoal } from '../logic/stats'
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

export function SettingsScreen() {
  const state = safeUser(useStore())
  const settings = state.settings
  const [newItem, setNewItem] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const goal = proteinGoal(state)
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
    <div className="space-y-4">
      {message && (
        <div className="rounded-xl bg-ink-700 border border-ink-600 p-3 text-sm">{message}</div>
      )}

      <Card>
        <SectionTitle>Lichaamsgewicht</SectionTitle>
        <div className="flex items-center gap-2">
          <DecimalField
            ariaLabel="Lichaamsgewicht"
            placeholder="kg"
            value={settings.bodyweightKg}
            onChange={A.setBodyweight}
          />
          <span className="text-slate-400">kg</span>
        </div>
        <p className="text-sm text-slate-400 mt-2">
          {goal ? `Eiwitdoel: ${goal} g per dag (gewicht × 1,8, afgerond op 5).` : 'Nodig voor het eiwitdoel.'}
        </p>
      </Card>

      <Card>
        <SectionTitle>Gevoelige gebieden</SectionTitle>
        <p className="text-sm text-slate-400 mb-3">
          Op <b>gevoelig</b> filtert de app alle oefeningen met dat label eruit en kiest automatisch een
          alternatief uit hetzelfde patroon. <b>Let op</b> laat het werk staan, maar bouwt op vanaf de
          laagste weerstand.
        </p>
        <div className="space-y-2">
          {AREAS.map((a) => (
            <div key={a} className="flex items-center justify-between gap-2">
              <span className="text-sm">{LOAD_LABEL[a]}</span>
              <div className="flex gap-1 shrink-0">
                {(['ok', 'careful', 'off'] as Sensitivity[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => A.setSensitivity(a, v)}
                    className={`min-h-[44px] px-3 rounded-lg text-xs font-semibold ${
                      settings.sensitive?.[a] === v
                        ? v === 'off'
                          ? 'bg-rose-500 text-ink-900'
                          : v === 'careful'
                            ? 'bg-amber-400 text-ink-900'
                            : 'bg-emerald-400 text-ink-900'
                        : 'bg-ink-700 border border-ink-600 text-slate-300'
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
        <p className="text-sm text-slate-400 mb-3">
          Bij een oefening met een stang vul je alleen de schijven in. De app telt het gewicht van de
          stang erbij en toont het totaal.
        </p>
        <div className="space-y-3">
          {BAR_IDS.map((bar) => (
            <div key={bar}>
              <p className="label mb-1">{BAR_LABEL[bar]}</p>
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
        <p className="text-sm text-slate-400 mb-3">
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
                className={`btn btn-sm min-h-[44px] px-3 tabular-nums ${
                  aan ? 'bg-accent text-ink-900' : 'bg-ink-700 border border-ink-600 text-slate-300'
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
        <SectionTitle>Dagelijks onderhoud</SectionTitle>
        <div className="space-y-2">
          {settings.maintenanceItems.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{m.label}</span>
              <button
                className="btn-quiet btn-sm shrink-0"
                onClick={() => A.removeMaintenanceItem(m.id)}
              >
                Verwijder
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <input
            className="field"
            placeholder="Nieuw item"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <button
            className="btn-ghost btn-sm shrink-0"
            onClick={() => {
              if (newItem.trim()) {
                A.addMaintenanceItem(newItem.trim())
                setNewItem('')
              }
            }}
          >
            Toevoegen
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle>Permanent vervangen oefeningen</SectionTitle>
        {permanents.length === 0 ? (
          <p className="text-sm text-slate-400">Geen. Deze rouleren niet mee met de 12-weekse wissel.</p>
        ) : (
          <div className="space-y-2">
            {permanents.map(([slotKey, exId]) => (
              <div key={slotKey} className="flex items-center gap-2">
                <span className="flex-1 text-sm">
                  <span className="text-slate-400">{slotLabel(slotKey)} → </span>
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
          <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold text-amber-200">{reminder.text}</p>
            <p className="text-xs text-amber-200/70 mt-1">
              Alles staat alleen op dit toestel. Zonder export ben je bij het wissen van je
              browserdata alles kwijt.
            </p>
          </div>
        )}
        <p className="text-sm text-slate-400 mb-3">
          Alles staat op dit toestel; er gaat niets naar internet. Een export is daarmee ook de
          enige manier om je gegevens naar een ander toestel te verplaatsen: exporteer hier, en
          importeer het bestand daar. Een import vervangt alles wat er op dat toestel staat.
        </p>
        <div className="space-y-2">
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

      <p className="text-xs text-slate-500 px-1">
        Startdatum programma: {state.startDate}. Alles blijft lokaal op dit toestel.
      </p>

      <ProfielCard />

      <GegevensbeheerCard />
    </div>
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

      <p className="text-sm text-slate-300">
        <b>{huidige?.naam ?? 'Niemand'}</b>
        {huidige && ` — ${programById(huidige.programId).naam}`}
      </p>
      <p className="text-xs text-slate-400 mt-1 mb-3">
        {huidige ? programById(huidige.programId).omschrijving : 'Kies wie dit toestel gebruikt.'}
      </p>

      <p className="label mb-1">Jouw naam</p>
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
      {msg && <p className="text-sm text-slate-300 mt-2">{msg}</p>}

      <div className="mt-4 pt-3 border-t border-ink-700 space-y-2">
        {wisselen ? (
          <>
            <p className="text-sm text-slate-400">
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
                  className={`btn btn-sm ${
                    u.id === root.currentUser
                      ? 'bg-accent text-ink-900'
                      : 'bg-ink-700 border border-ink-600'
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
        <div className="mt-4 pt-4 border-t border-ink-700">
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
    <div className="mt-8 pt-5 border-t-2 border-ink-700">
      <button
        className="w-full flex items-center justify-between gap-2 py-2 px-1 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <span className="block font-bold text-slate-300">Gegevensbeheer</span>
          <span className="block text-xs text-slate-500">
            Pincode en het wissen van gegevens. Dichtgeklapt, want hier gaat het mis.
          </span>
        </span>
        <span className="text-slate-500 text-lg shrink-0" aria-hidden>
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

          <div className="mt-4 pt-4 border-t border-ink-700">
            <p className="text-sm text-slate-400 mb-2">
              Wissen kan niet ongedaan gemaakt worden en geldt voor {state.naam}, tenzij je in de
              dialoog aangeeft dat het andere profiel ook mee moet.
            </p>
            <button
              className="btn w-full bg-rose-500/90 text-ink-900 disabled:opacity-40"
              disabled={geblokkeerd}
              onClick={probeerWissen}
            >
              Gegevens wissen
            </button>
            {geblokkeerd && (
              <p className="text-sm text-rose-300 mt-2" role="alert">
                Te vaak een verkeerde pincode. Nog {seconden} seconden geblokkeerd.
              </p>
            )}
            {msg && <p className="text-sm text-slate-300 mt-2">{msg}</p>}
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
          <span className="block text-xs text-slate-500">
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
    <div className="space-y-2">
      <p className="label">{gezet ? 'Pincode wijzigen' : 'Pincode instellen'}</p>
      {gezet && (
        <PinInput label="Oude pincode" value={oud} onChange={setOud} />
      )}
      <PinInput label="Nieuwe pincode" value={nieuw} onChange={setNieuw} />
      <PinInput label="Nieuwe pincode herhalen" value={herhaal} onChange={setHerhaal} />
      {fout && (
        <p className="text-sm text-rose-300" role="alert">
          {fout}
        </p>
      )}
      <p className="text-xs text-slate-500">
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
      <p className="label mb-0.5">{label}</p>
      <input
        className="field font-mono tracking-[0.4em] text-center"
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
      <div className="space-y-3">
        {waarschuwing && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm font-semibold text-amber-200">
              {waarschuwing} Hierna is deze historie weg.
            </p>
            <button className="btn-ghost btn-sm w-full mt-2" onClick={downloadExport}>
              Eerst exporteren
            </button>
          </div>
        )}

        <div className="rounded-xl bg-ink-900 border border-ink-600 p-3">
          <p className="text-sm font-semibold mb-1">Dit verdwijnt van {state.naam}:</p>
          <ul className="text-sm text-slate-300 space-y-0.5 tabular-nums">
            <li>{samenvatting.sessions} gelogde krachtsessies</li>
            <li>{samenvatting.runs} hardloopsessies</li>
            <li>{samenvatting.activities} losse activiteiten</li>
            <li>
              {samenvatting.oldest
                ? `oudste log: ${formatShort(samenvatting.oldest)}`
                : 'nog geen logs'}
            </li>
          </ul>
          <p className="text-xs text-slate-500 mt-2">
            Ook de instellingen en streefgewichten van dit profiel gaan mee.
          </p>
        </div>

        {ander && (
          <ConfirmCheck checked={ookAnder} onToggle={() => setOokAnder((v) => !v)}>
            Ook het profiel van {ander.naam} wissen
            <span className="block text-xs text-slate-500">
              Standaard blijft dat staan; alleen {state.naam} wordt gewist.
            </span>
          </ConfirmCheck>
        )}

        <div>
          <PinInput label="Pincode" value={code} onChange={controleer} />
          {fout && (
            <p className="text-sm text-rose-300 mt-1" role="alert">
              {fout}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            De knop hieronder gaat pas aan bij de juiste code. Na {MAX_ATTEMPTS} fouten sluit dit
            venster en is wissen een minuut geblokkeerd.
          </p>
        </div>

        <button
          className="btn w-full bg-rose-500 text-ink-900 disabled:opacity-40"
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
