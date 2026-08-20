import { useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Onboarding } from './screens/Onboarding'
import { ProgressScreen } from './screens/ProgressScreen'
import { SessionScreen } from './screens/SessionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { Today } from './screens/Today'
import { WeekScreen } from './screens/WeekScreen'
import { useRoot } from './store/store'
import type { DayKind } from './types'

/**
 * De onderbalk is van de dagelijkse handelingen. Wisselen van profiel hoort daar niet
 * bij: dit toestel is van één gebruiker, en omzetten doe je hooguit een keer. Die knop
 * staat daarom onderaan bij Instellingen, samen met meekijken bij de ander.
 */
type Tab = 'vandaag' | 'week' | 'voortgang' | 'instellingen'

export default function App() {
  const root = useRoot()
  const [tab, setTab] = useState<Tab>('vandaag')
  const [session, setSession] = useState<{ date: string; kind: DayKind } | null>(null)
  const klaar = !!root.currentUser

  const open = (date: string, kind: DayKind) => setSession({ date, kind })

  if (!klaar) {
    return (
      <div className="min-h-dvh bg-bg">
        <main className="max-w-md mx-auto px-4 pt-6 pb-10 safe-top">
          <ErrorBoundary scherm="Start">
            <Onboarding onDone={() => setTab('vandaag')} />
          </ErrorBoundary>
        </main>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'vandaag', label: 'Vandaag' },
    { id: 'week', label: 'Week' },
    { id: 'voortgang', label: 'Voortgang' },
    { id: 'instellingen', label: 'Instellingen' },
  ]

  const kiesTab = (t: Tab) => {
    setTab(t)
    // elk scherm begint bovenaan; anders land je midden in het vorige scrollpunt
    window.scrollTo(0, 0)
  }

  return (
    <div className="min-h-dvh bg-bg">
      <main className="max-w-md mx-auto px-4 pt-5 pb-28 safe-top">
        {/* key op de tab: bij het wisselen van scherm begint het vangnet weer schoon */}
        <ErrorBoundary
          key={tab}
          scherm={tabs.find((t) => t.id === tab)?.label}
          onReset={() => setTab('vandaag')}
        >
          {tab === 'vandaag' && <Today onOpenSession={open} />}
          {tab === 'week' && <WeekScreen onOpenSession={open} />}
          {tab === 'voortgang' && <ProgressScreen />}
          {tab === 'instellingen' && <SettingsScreen />}
        </ErrorBoundary>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-bg backdrop-blur border-t border-line safe-bottom">
        <div className="max-w-md mx-auto grid grid-cols-4">
          {/* tekstlabels, geen iconen; de actieve tab draagt een lijn eronder */}
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => kiesTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex items-center justify-center min-h-[52px] px-1 text-sm ${
                tab === t.id ? 'text-fg font-medium' : 'text-muted font-normal'
              }`}
            >
              <span
                className={`truncate max-w-full border-b-2 pb-0.5 ${
                  tab === t.id ? 'border-fg' : 'border-transparent'
                }`}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

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
