import { useState } from 'react'
import { Card } from '../components/ui'
import { programById } from '../data/programs'
import { USER_SEEDS, setCurrentUser, useRoot } from '../store/store'

/**
 * Eerste start: wie ben je. Die keuze wordt lokaal onthouden en is later te wijzigen
 * bij Instellingen. Geen account, geen code, geen cloud — alles staat op dit toestel.
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const root = useRoot()
  const [user, setUser] = useState(root.currentUser)
  const [error, setError] = useState<string | null>(null)

  function start() {
    if (!user) {
      setError('Kies wie je bent.')
      return
    }
    setCurrentUser(user)
    onDone()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-medium">Welkom</h1>
        <p className="text-muted mt-1">
          Eén ding instellen, daarna kun je loggen. Later te wijzigen bij Instellingen.
        </p>
      </div>

      <Card>
        <h2 className="font-medium mb-1">Wie ben je?</h2>
        <p className="text-sm text-muted mb-3">
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
                className={`w-full text-left rounded border px-4 py-3 ${
                  on ? 'bg-raised border-fg' : 'bg-raised border-line'
                }`}
              >
                <span className="block font-medium">{root.users[u.id]?.naam ?? u.naam}</span>
                <span className="block text-sm text-muted">{program.naam}</span>
              </button>
            )
          })}
        </div>
      </Card>

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn-primary w-full" onClick={start}>
        Beginnen
      </button>

      <p className="text-xs text-faint">
        Alles blijft op dit toestel staan: er gaat niets naar internet en er is geen account
        nodig. Naar een ander toestel verhuizen gaat via Exporteer alles bij Instellingen, en daar
        het bestand importeren.
      </p>
    </div>
  )
}
