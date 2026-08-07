import { useState } from 'react'
import { ProgressScreen } from './screens/ProgressScreen'
import { SessionScreen } from './screens/SessionScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { Today } from './screens/Today'
import { WeekScreen } from './screens/WeekScreen'
import type { DayKind } from './types'

type Tab = 'vandaag' | 'week' | 'voortgang' | 'instellingen'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'vandaag', label: 'Vandaag', icon: '●' },
  { id: 'week', label: 'Week', icon: '▦' },
  { id: 'voortgang', label: 'Voortgang', icon: '↗' },
  { id: 'instellingen', label: 'Instellingen', icon: '⚙' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('vandaag')
  const [session, setSession] = useState<{ date: string; kind: DayKind } | null>(null)

  const open = (date: string, kind: DayKind) => setSession({ date, kind })

  return (
    <div className="min-h-dvh bg-ink-900">
      <main className="max-w-md mx-auto px-4 pt-5 pb-28 safe-top">
        {tab === 'vandaag' && <Today onOpenSession={open} />}
        {tab === 'week' && <WeekScreen onOpenSession={open} />}
        {tab === 'voortgang' && <ProgressScreen />}
        {tab === 'instellingen' && <SettingsScreen />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-ink-800/95 backdrop-blur border-t border-ink-600 safe-bottom">
        <div className="max-w-md mx-auto grid grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[60px] text-xs font-semibold ${
                tab === t.id ? 'text-accent' : 'text-slate-400'
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {session && (
        <SessionScreen date={session.date} kind={session.kind} onClose={() => setSession(null)} />
      )}
    </div>
  )
}
