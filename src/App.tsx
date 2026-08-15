import { useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Onboarding } from './screens/Onboarding'
import { OtherScreen } from './screens/OtherScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { SessionScreen } from './screens/SessionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { Today } from './screens/Today'
import { WeekScreen } from './screens/WeekScreen'
import { useRoot } from './store/store'
import type { DayKind } from './types'

type Tab = 'vandaag' | 'week' | 'voortgang' | 'ander' | 'instellingen'

export default function App() {
  const root = useRoot()
  const [tab, setTab] = useState<Tab>('vandaag')
  const [session, setSession] = useState<{ date: string; kind: DayKind } | null>(null)
  const klaar = !!root.currentUser

  const open = (date: string, kind: DayKind) => setSession({ date, kind })

  if (!klaar) {
    return (
      <div className="min-h-dvh bg-ink-900">
        <main className="max-w-md mx-auto px-4 pt-6 pb-10 safe-top">
          <ErrorBoundary scherm="Start">
            <Onboarding onDone={() => setTab('vandaag')} />
          </ErrorBoundary>
        </main>
      </div>
    )
  }

  const ander = Object.values(root.users).find((u) => u.id !== root.currentUser)

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'vandaag', label: 'Vandaag', icon: '●' },
    { id: 'week', label: 'Week', icon: '▦' },
    { id: 'voortgang', label: 'Voortgang', icon: '↗' },
    { id: 'ander', label: ander?.naam ?? 'Ander', icon: '👥' },
    { id: 'instellingen', label: 'Instellingen', icon: '⚙' },
  ]

  return (
    <div className="min-h-dvh bg-ink-900">
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
          {tab === 'ander' && <OtherScreen />}
          {tab === 'instellingen' && <SettingsScreen />}
        </ErrorBoundary>
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-ink-800/95 backdrop-blur border-t border-ink-600 safe-bottom">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[60px] text-[11px] font-semibold ${
                tab === t.id ? 'text-accent' : 'text-slate-400'
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {t.icon}
              </span>
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
