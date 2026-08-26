/**
 * Loggen, op één plek.
 *
 * Stond eerst in `http.ts`, maar `review.ts` moet er ook bij en dat hoort niets van HTTP
 * te weten. Eén regel per gebeurtenis, met een tijdstempel ervoor: dit draait in een
 * container, en `docker compose logs api` is het enige venster erop.
 */
export function log(bericht: string, e?: unknown): void {
  const stamp = new Date().toISOString()
  if (e !== undefined) console.error(`[${stamp}] ${bericht}`, e)
  else console.log(`[${stamp}] ${bericht}`)
}
