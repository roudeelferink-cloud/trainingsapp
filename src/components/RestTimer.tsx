import { useEffect, useRef, useState } from 'react'

/**
 * Rusttimer per oefening: een rustige regel, geen opvallend blok. Telt af en
 * trilt kort als hij op nul staat.
 */
export function RestTimer({ seconds = 120 }: { seconds?: number }) {
  const [left, setLeft] = useState<number | null>(null)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (ref.current) window.clearInterval(ref.current)
    }
  }, [])

  function start(s: number) {
    if (ref.current) window.clearInterval(ref.current)
    setLeft(s)
    ref.current = window.setInterval(() => {
      setLeft((cur) => {
        if (cur === null) return null
        if (cur <= 1) {
          if (ref.current) window.clearInterval(ref.current)
          if ('vibrate' in navigator) navigator.vibrate?.([200, 80, 200])
          return 0
        }
        return cur - 1
      })
    }, 1000)
  }

  function stop() {
    if (ref.current) window.clearInterval(ref.current)
    setLeft(null)
  }

  if (left === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted min-h-[44px]">
        <span className="label">rust</span>
        <button className="btn-quiet btn-sm num" onClick={() => start(90)}>
          1:30
        </button>
        <button className="btn-quiet btn-sm num" onClick={() => start(seconds)}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </button>
      </div>
    )
  }

  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')
  return (
    <button
      onClick={stop}
      className={`w-full min-h-[44px] text-left text-sm num ${left === 0 ? 'text-fg' : 'text-muted'}`}
    >
      {left === 0 ? '✓ Rust voorbij — tik om te sluiten' : `rust ${mm}:${ss} — tik om te stoppen`}
    </button>
  )
}
