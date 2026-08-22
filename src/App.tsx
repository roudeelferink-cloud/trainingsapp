import { useState, type ReactNode } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Onboarding } from './screens/Onboarding'
import { HistoryScreen } from './screens/HistoryScreen'
import { SessionScreen } from './screens/SessionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { Today } from './screens/Today'
import { WeekScreen } from './screens/WeekScreen'
import { useRoot } from './store/store'
import type { DayKind } from './types'

/**
 * Drie bestemmingen in de balk, precies zoals het ontwerp: Vandaag, Week, Historie.
 *
 * Instellingen staat er bewust niet bij. Die balk is van wat je elke dag doet;
 * pincode, profiel, stanggewichten en de back-up zijn dingen die je hooguit een keer
 * per maand aanraakt. Ze staan achter een regel bovenaan Historie en openen als een
 * eigen scherm over de app heen — zo blijven ze volledig bereikbaar zonder een
 * vierde tab die de andere drie smaller maakt.
 */
type Tab = 'vandaag' | 'week' | 'historie'

const TABS: { id: Tab; label: string }[] = [
  { id: 'vandaag', label: 'Vandaag' },
  { id: 'week', label: 'Week' },
  { id: 'historie', label: 'Historie' },
]

/**
 * De romp van de app: een kolom van schermhoogte met de navigatiebalk onderaan.
 *
 * Het scherm ertussen scrollt zelf. Dat is wat de actiezone mogelijk maakt: de knop
 * waar je tussen sets op drukt staat vast onderin, ook als de lijst erboven lang is.
 */
export default function App() {
  const root = useRoot()
  const [tab, setTab] = useState<Tab>('vandaag')
  const [session, setSession] = useState<{ date: string; kind: DayKind } | null>(null)
  const [instellingen, setInstellingen] = useState(false)
  const klaar = !!root.currentUser

  const open = (date: string, kind: DayKind) => setSession({ date, kind })

  if (!klaar) {
    return (
      <div className="flex h-dvh flex-col bg-bg">
        <div className="safe-top min-h-0 flex-1">
          <ErrorBoundary scherm="Start">
            <Scroll>
              <Onboarding onDone={() => setTab('vandaag')} />
            </Scroll>
          </ErrorBoundary>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <div className="safe-top min-h-0 flex-1">
        {/* key op de tab: bij het wisselen van scherm begint het vangnet weer schoon */}
        <ErrorBoundary
          key={tab}
          scherm={TABS.find((t) => t.id === tab)?.label}
          onReset={() => setTab('vandaag')}
        >
          {tab === 'vandaag' && <Today onOpenSession={open} />}
          {tab === 'week' && <WeekScreen onOpenSession={open} />}
          {tab === 'historie' && <HistoryScreen onOpenSettings={() => setInstellingen(true)} />}
        </ErrorBoundary>
      </div>

      <nav className="safe-bottom flex-none border-t-hair border-rule pb-nav-bottom">
        <div className="mx-auto flex max-w-content">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex-1 pb-in-block pt-nav-top text-center text-caps-lg uppercase tracking-caps
                          transition-colors duration-color ${
                            tab === t.id
                              ? 'border-t-mark border-t-accent text-accent'
                              : 'border-t-mark border-t-transparent text-dim'
                          }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {instellingen && (
        <ErrorBoundary scherm="Instellingen" onReset={() => setInstellingen(false)}>
          <Overlay>
            <SettingsScreen onClose={() => setInstellingen(false)} />
          </Overlay>
        </ErrorBoundary>
      )}

      {session && (
        <ErrorBoundary
          key={`${session.date}:${session.kind}`}
          scherm="Sessie"
          onReset={() => {
            setSession(null)
            setTab('vandaag')
          }}
        >
          <SessionScreen date={session.date} kind={session.kind} onClose={() => setSession(null)} />
        </ErrorBoundary>
      )}
    </div>
  )
}

/** Een scherm dat over de app heen komt: geen navigatiebalk, eigen weg terug. */
function Overlay({ children }: { children: ReactNode }) {
  return <div className="safe-top fixed inset-0 z-40 flex flex-col bg-bg">{children}</div>
}

/** Scrollende omhulling voor een scherm dat zijn eigen actiezone niet meebrengt. */
function Scroll({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-content px-gutter py-block">{children}</div>
    </div>
  )
}
