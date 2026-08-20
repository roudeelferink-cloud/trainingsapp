import { useEffect, useRef, useState } from 'react'

/** Simpele rusttimer per oefening. Telt af, trilt kort als hij op nul staat. */
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
      <div className="flex gap-2">
        <button className="btn-ghost btn-sm flex-1" onClick={() => start(90)}>
          Rust 1:30
        </button>
        <button className="btn-ghost btn-sm flex-1" onClick={() => start(seconds)}>
          Rust {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </button>
      </div>
    )
  }

  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')
  return (
    <button
      onClick={stop}
      className={`btn w-full ${left === 0 ? 'bg-fg text-on-invert' : 'bg-raised border border-line'}`}
    >
      {left === 0 ? 'Rust voorbij — tik om te sluiten' : `Rust ${mm}:${ss} — tik om te stoppen`}
    </button>
  )
}
