import { useRef, useState } from 'react'
import { Card, Chip, SectionTitle, Toggle } from '../components/ui'
import { BY_ID, LOAD_LABEL } from '../data/exercises'
import { TEMPLATES } from '../data/plan'
import { exportReminder, proteinGoal } from '../logic/stats'
import * as A from '../store/actions'
import { exportJSON, importJSON, resetState, SCHEMA_VERSION, useStore } from '../store/store'
import type { LoadArea, Sensitivity } from '../types'

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

export function SettingsScreen() {
  const state = useStore()
  const [newItem, setNewItem] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const goal = proteinGoal(state)
  const reminder = exportReminder(state)

  function doExport() {
    const blob = new Blob([exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trainingsapp-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
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
          <input
            className="field"
            type="number"
            inputMode="decimal"
            placeholder="kg"
            value={state.settings.bodyweightKg ?? ''}
            onChange={(e) => A.setBodyweight(e.target.value === '' ? null : Number(e.target.value))}
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
                      state.settings.sensitive[a] === v
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
        <SectionTitle>Reismodus</SectionTitle>
        <Toggle
          checked={state.settings.travelMode}
          onChange={A.setTravelMode}
          label="Reismodus aan"
          hint="Alles naar lichaamsgewicht en band, max 30 min. Loopdagen blijven ongewijzigd."
        />
      </Card>

      <Card>
        <SectionTitle>Dagelijks onderhoud</SectionTitle>
        <div className="space-y-2">
          {state.settings.maintenanceItems.map((m) => (
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

      <Card>
        <SectionTitle>Reset</SectionTitle>
        {confirmReset ? (
          <div className="space-y-2">
            <p className="text-sm text-rose-300">
              Alles wissen: historie, instellingen en voortgang. Dit kan niet ongedaan gemaakt worden.
            </p>
            <button
              className="btn w-full bg-rose-500 text-ink-900"
              onClick={() => {
                resetState()
                setConfirmReset(false)
                setMessage('Alles gewist.')
              }}
            >
              Ja, wis alles
            </button>
            <button className="btn-quiet w-full" onClick={() => setConfirmReset(false)}>
              Annuleren
            </button>
          </div>
        ) : (
          <button className="btn-quiet w-full" onClick={() => setConfirmReset(true)}>
            Alles wissen
          </button>
        )}
        <p className="text-xs text-slate-500 mt-3">
          Startdatum programma: {state.startDate}. Alles blijft lokaal op dit toestel.
        </p>
      </Card>
    </div>
  )
}

function slotLabel(slotKey: string): string {
  const [kind, idx] = slotKey.split(':')
  const tpl = (TEMPLATES as Record<string, { naam: string; slots: { exerciseId: string }[] }>)[kind]
  if (!tpl) return slotKey
  const original = tpl.slots[Number(idx)]
  return `${tpl.naam}: ${original ? (BY_ID[original.exerciseId]?.naam ?? '') : ''}`
}
