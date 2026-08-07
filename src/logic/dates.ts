/** Alle datums zijn lokale kalenderdagen als 'YYYY-MM-DD'. */

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): string {
  return toISO(new Date())
}

/** ISO-weekdag: 1 = maandag ... 7 = zondag */
export function weekday(iso: string): number {
  const d = fromISO(iso).getDay()
  return d === 0 ? 7 : d
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function mondayOf(iso: string): string {
  return addDays(iso, -(weekday(iso) - 1))
}

export function daysBetween(a: string, b: string): number {
  const ms = fromISO(b).getTime() - fromISO(a).getTime()
  return Math.round(ms / 86400000)
}

const DAG = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export function formatShort(iso: string): string {
  const d = fromISO(iso)
  return `${DAG[d.getDay()]} ${d.getDate()} ${MAAND[d.getMonth()]}`
}

export function formatLong(iso: string): string {
  const namen = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
  const d = fromISO(iso)
  return `${namen[d.getDay()]} ${d.getDate()} ${MAAND[d.getMonth()]}`
}
