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

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'vandaag', label: 'Vandaag', icon: <IconToday /> },
    { id: 'week', label: 'Week', icon: <IconWeek /> },
    { id: 'voortgang', label: 'Voortgang', icon: <IconProgress /> },
    { id: 'instellingen', label: 'Instellingen', icon: <IconSettings /> },
  ]

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <div className="safe-top min-h-0 flex-1">
        {/* key op de tab: bij het wisselen van scherm begint het vangnet weer schoon */}
        <ErrorBoundary
          key={tab}
          scherm={tabs.find((t) => t.id === tab)?.label}
          onReset={() => setTab('vandaag')}
        >
          {tab === 'vandaag' && <Today onOpenSession={open} />}
          {/* de schermen hieronder zijn nog niet herbouwd en scrollen als één blok */}
          {tab === 'week' && (
            <Scroll>
              <WeekScreen onOpenSession={open} />
            </Scroll>
          )}
          {tab === 'voortgang' && (
            <Scroll>
              <ProgressScreen />
            </Scroll>
          )}
          {tab === 'instellingen' && (
            <Scroll>
              <SettingsScreen />
            </Scroll>
          )}
        </ErrorBoundary>
      </div>

      <nav className="safe-bottom flex-none border-t-hair border-rule">
        <div className="mx-auto grid max-w-content grid-cols-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex min-h-tap flex-col items-center justify-center gap-tight pt-nav-top text-caps-lg ${
                tab === t.id ? 'text-accent' : 'text-dim'
              }`}
            >
              <span aria-hidden>{t.icon}</span>
              <span className="max-w-full truncate px-1">{t.label}</span>
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

/** Scrollende omhulling voor een scherm dat zijn eigen actiezone nog niet meebrengt. */
function Scroll({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-content px-gutter py-block">{children}</div>
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
