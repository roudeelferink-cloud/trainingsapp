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
    <div className="flex flex-col gap-block">
      <div>
        <h1 className="font-serif text-exercise leading-exercise text-ink">Welkom</h1>
        <p className="quote mt-in-block">
          Eén ding instellen, daarna kun je loggen. Later te wijzigen bij Instellingen.
        </p>
      </div>

      <Card>
        <h2 className="mb-tight text-list text-ink">Wie ben je?</h2>
        <p className="mb-block text-body text-muted">
          Je logt alleen voor jezelf. De voortgang van de ander kun je wel bekijken.
        </p>
        <div className="flex flex-col gap-in-block">
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
                aria-pressed={on}
                className={`w-full border-hair px-4 py-3 text-left transition-colors duration-color ${
                  on ? 'border-accent bg-accent text-on-accent' : 'border-chip-border text-muted'
                }`}
              >
                <span className="block text-list">{root.users[u.id]?.naam ?? u.naam}</span>
                <span className="block text-meta opacity-80">{program.naam}</span>
              </button>
            )
          })}
        </div>
      </Card>

      {error && (
        <p className="text-body text-accent" role="alert">
          {error}
        </p>
      )}

      <button className="btn-primary w-full" onClick={start}>
        Beginnen
      </button>

      <p className="text-meta leading-meta text-faint">
        Alles blijft op dit toestel staan: er gaat niets naar internet en er is geen account
        nodig. Naar een ander toestel verhuizen gaat via Exporteer alles bij Instellingen, en daar
        het bestand importeren.
      </p>
    </div>
  )
}
