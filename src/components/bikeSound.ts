/**
 * Het geluidssignaal bij een blokwissel op de fiets.
 *
 * Trillen werkt niet in een iOS-PWA, dus het is geluid: een korte toon via Web Audio. Ook
 * dat mag op iOS pas na een tik van de gebruiker, dus `unlockSound` hangt aan de startknop
 * (en aan elke tik op het fietsscherm, voor als de app tussendoor herladen is). Zonder
 * Web Audio — een oude webview, of de tests — gebeurt er stil niets.
 */

type Ctx = AudioContext

let ctx: Ctx | null = null

function audioContextClass(): (new () => Ctx) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** Maakt het geluid klaar; aanroepen vanuit een tik. */
export function unlockSound(): void {
  try {
    const AC = audioContextClass()
    if (!AC) return
    ctx = ctx ?? new AC()
    void ctx.resume()
  } catch {
    /* geen geluid is geen ramp: de visuele wissel staat er ook */
  }
}

/**
 * Twee korte tonen, bij een zwaar blok hoger. Hard genoeg om boven het zoemen van een
 * spinningfiets uit te komen, kort genoeg om niet te irriteren.
 */
export function beep(hard: boolean): void {
  try {
    if (!ctx) return
    void ctx.resume()
    const start = ctx.currentTime
    for (const [i, freq] of (hard ? [880, 1175] : [660, 880]).entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = start + i * 0.28
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.24)
    }
  } catch {
    /* zie hierboven */
  }
}
