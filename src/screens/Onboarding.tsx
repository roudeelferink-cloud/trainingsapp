import { useState } from 'react'
import { Card } from '../components/ui'
import { programById } from '../data/programs'
import {
  USER_SEEDS,
  randomHouseholdCode,
  setCurrentUser,
  setHousehold,
  useRoot,
} from '../store/store'

/**
 * Eerste start: welke huishoudcode en wie ben je. Beide worden lokaal onthouden
 * en zijn later te wijzigen bij Instellingen. Geen account, geen wachtwoord — de
 * code is het gedeelde geheim tussen de twee toestellen.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const root = useRoot()
  const [code, setCode] = useState(root.household)
  const [user, setUser] = useState(root.currentUser)
  const [error, setError] = useState<string | null>(null)

  const clean = code.trim().toLowerCase()
  const codeOk = /^[0-9a-f]{16}$/.test(clean)

  function start() {
    if (!codeOk) {
      setError('Een huishoudcode is 16 tekens: de cijfers 0-9 en de letters a-f.')
      return
    }
    if (!user) {
      setError('Kies wie je bent.')
      return
    }
    setHousehold(clean)
    setCurrentUser(user)
    onDone()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Welkom</h1>
        <p className="text-slate-400 mt-1">
          Twee dingen instellen, daarna kun je loggen. Allebei later te wijzigen bij Instellingen.
        </p>
      </div>

      <Card>
        <h2 className="font-bold mb-1">1 · Huishoudcode</h2>
        <p className="text-sm text-slate-400 mb-3">
          Dezelfde code op beide toestellen betekent: dezelfde gedeelde gegevens. Heeft de ander al
          een code, neem die dan over. Anders maak je er hier een.
        </p>
        <input
          className="field font-mono"
          value={code}
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="16 tekens"
          aria-label="Huishoudcode"
          onChange={(e) => {
            setCode(e.target.value)
            setError(null)
          }}
        />
        <button
          className="btn-ghost btn-sm w-full mt-2"
          onClick={() => {
            setCode(randomHouseholdCode())
            setError(null)
          }}
        >
          Nieuwe code maken
        </button>
      </Card>

      <Card>
        <h2 className="font-bold mb-1">2 · Wie ben je?</h2>
        <p className="text-sm text-slate-400 mb-3">
          Je logt alleen voor jezelf. De voortgang van de ander kun je wel bekijken.
        </p>
        <div className="space-y-2">
          {USER_SEEDS.map((u) => {
            const program = programById(u.programId)
            const on = user === u.id
            return (
              <button
                key={u.id}
                onClick={() => {
                  setUser(u.id)
                  setError(null)
                }}
                className={`w-full text-left rounded-xl border px-4 py-3 ${
                  on ? 'bg-accent/15 border-accent' : 'bg-ink-700 border-ink-600'
                }`}
              >
                <span className="block font-semibold">{root.users[u.id]?.naam ?? u.naam}</span>
                <span className="block text-sm text-slate-400">{program.naam}</span>
              </button>
            )
          })}
        </div>
      </Card>

      {error && (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <button className="btn-primary w-full" onClick={start}>
        Beginnen
      </button>

      <p className="text-xs text-slate-500">
        Je gegevens staan op dit toestel en onder deze code in de cloud, zodat je ze op je telefoon
        én tablet hebt. Zonder internet werkt alles gewoon door; het synct zodra je weer verbinding
        hebt.
      </p>
    </div>
  )
}
