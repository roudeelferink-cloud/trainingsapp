import { useState, type ReactNode } from 'react'
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

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'vandaag', label: 'Vandaag', icon: <IconToday /> },
    { id: 'week', label: 'Week', icon: <IconWeek /> },
    { id: 'voortgang', label: 'Voortgang', icon: <IconProgress /> },
    { id: 'instellingen', label: 'Instellingen', icon: <IconSettings /> },
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
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => kiesTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 min-h-[60px] text-[11px] font-medium ${
                tab === t.id ? 'text-fg' : 'text-muted'
              }`}
            >
              <span aria-hidden>{t.icon}</span>
              <span className="truncate max-w-full px-1">{t.label}</span>
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

/**
 * De iconen van de onderbalk. Inline SVG in plaats van tekstglyphs: die rendert iOS
 * klein en ongelijk van gewicht, en zo kleuren ze netjes mee met de actieve tab.
 */
function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

function IconToday() {
  return (
    <TabIcon>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </TabIcon>
  )
}

function IconWeek() {
  return (
    <TabIcon>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8.5 5V3M15.5 5V3" />
    </TabIcon>
  )
}

function IconProgress() {
  return (
    <TabIcon>
      <path d="M4 18l5.5-5.5 3.5 3.5L20 8" />
      <path d="M14.5 8H20v5.5" />
    </TabIcon>
  )
}

function IconSettings() {
  return (
    <TabIcon>
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="9" cy="16" r="2" />
    </TabIcon>
  )
}

