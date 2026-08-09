import type { UserState } from '../types'
import { applyRemoteUser, getRoot, getUser, setLocalChangeHandler } from './store'

/**
 * Sync tussen de toestellen van één huishouden, zelfde opzet als camper-app:
 * Firestore is de bron van waarheid, localStorage is de offline cache, en de
 * niet-te-raden huishoudcode is het gedeelde geheim. Er is geen login: de app
 * meldt zich anoniem aan zodat de rules een auth-token kunnen eisen.
 *
 * Eén document per gebruiker onder `trainingsapp/{code}/gebruikers/{id}`. Dat is
 * bewust geen gezamenlijk document: twee toestellen die tegelijk loggen schrijven
 * dan nooit over elkaar heen, en de data van de ander kan per constructie niet in
 * je eigen berekening belanden.
 */

// Firebase web-config. Hoort in de client thuis: dit zijn geen geheimen, de
// afscherming komt van de security rules (zie firestore.rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyBfIRQVYADLitxVUXHaENwRjEsMOfXQvto',
  authDomain: 'notin-app.firebaseapp.com',
  projectId: 'notin-app',
  storageBucket: 'notin-app.firebasestorage.app',
  messagingSenderId: '368094874150',
  appId: '1:368094874150:web:a8b70cc36c458c565934e7',
}

/** Eigen top-level collection; camper-app zit onder `households` en blijft ongemoeid. */
export const COLLECTION = 'trainingsapp'
export const USERS_SUBCOLLECTION = 'gebruikers'

const SYNC_DEBOUNCE_MS = 500

export type SyncStatus = 'uit' | 'starten' | 'verbonden' | 'offline' | 'fout'

export interface SyncInfo {
  status: SyncStatus
  detail: string
  /** wijzigingen die nog naar Firestore moeten */
  pending: number
}

const info: SyncInfo = { status: 'uit', detail: '', pending: 0 }
const watchers = new Set<(i: SyncInfo) => void>()

export function syncInfo(): SyncInfo {
  return { ...info }
}

export function watchSync(fn: (i: SyncInfo) => void): () => void {
  watchers.add(fn)
  return () => {
    watchers.delete(fn)
  }
}

function setInfo(status: SyncStatus, detail = ''): void {
  info.status = status
  info.detail = detail
  for (const w of watchers) w(syncInfo())
}

function setPending(n: number): void {
  info.pending = n
  for (const w of watchers) w(syncInfo())
}

/* ---------------- document <-> gebruiker ---------------- */

/** JSON-rondje: strips undefined, want dat weigert Firestore. */
export function userToDoc(user: UserState): Record<string, unknown> {
  return JSON.parse(JSON.stringify({ ...user, bijgewerkt: user.updatedAt ?? new Date().toISOString() }))
}

/**
 * Neemt een binnengekomen document over. Alleen de velden die we kennen; de rest
 * valt terug op wat er lokaal al stond, zodat een half document niets wist.
 */
export function docToUser(raw: unknown, local: UserState): UserState {
  if (!raw || typeof raw !== 'object') return local
  const d = raw as Partial<UserState> & { bijgewerkt?: unknown }
  return {
    ...local,
    ...d,
    id: local.id,
    naam: typeof d.naam === 'string' && d.naam.trim() ? d.naam : local.naam,
    programId: d.programId === 'fullbody_hardlopen' || d.programId === 'kracht_hardlopen'
      ? d.programId
      : local.programId,
    sessions: d.sessions && typeof d.sessions === 'object' ? d.sessions : local.sessions,
    runs: d.runs && typeof d.runs === 'object' ? d.runs : local.runs,
    activities: Array.isArray(d.activities) ? d.activities : local.activities,
    exerciseState: d.exerciseState && typeof d.exerciseState === 'object'
      ? d.exerciseState
      : local.exerciseState,
    notices: Array.isArray(d.notices) ? d.notices : local.notices,
    updatedAt: typeof d.updatedAt === 'string'
      ? d.updatedAt
      : typeof d.bijgewerkt === 'string'
        ? d.bijgewerkt
        : local.updatedAt,
  }
}

/**
 * Wie wint bij een botsing: het jongste `updatedAt`. Bij gelijke of ontbrekende
 * tijdstippen wint het binnengekomen document, want dat is wat de andere kant
 * als laatste bevestigd heeft.
 */
export function shouldAcceptRemote(local: UserState | null, remote: UserState): boolean {
  if (!local) return true
  if (!local.updatedAt) return true
  if (!remote.updatedAt) return false
  return remote.updatedAt >= local.updatedAt
}

/* ---------------- Firestore ---------------- */

/** De handvol Firestore-functies die deze laag gebruikt; in tests vervangbaar. */
export interface SyncBackend {
  db: unknown
  doc: (...a: unknown[]) => unknown
  collection: (...a: unknown[]) => unknown
  setDoc: (ref: unknown, data: unknown, opts?: unknown) => Promise<void>
  onSnapshot: (ref: unknown, next: (s: any) => void, err: (e: any) => void) => () => void
}

type Fb = SyncBackend

let fb: Fb | null = null
let unsubscribe: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | null = null
/** gebruikers waarvan de laatste wijziging nog niet weg is */
const dirty = new Set<string>()

function flush(): void {
  if (!fb) {
    setPending(dirty.size)
    return
  }
  const code = getRoot().household
  if (!code) return
  for (const id of [...dirty]) {
    const user = getUser(id)
    if (!user) continue
    const ref = fb.doc(fb.db, COLLECTION, code, USERS_SUBCOLLECTION, id)
    dirty.delete(id)
    // offline: de eigen IndexedDB-cache van Firestore bewaart de write en synct later
    void fb.setDoc(ref, userToDoc(user), { merge: true }).catch(() => {})
  }
  setPending(dirty.size)
}

/** Elke lokale wijziging: gebufferd wegschrijven, ook als Firebase nog niet klaar is. */
function queue(userId: string): void {
  dirty.add(userId)
  setPending(dirty.size)
  if (timer) clearTimeout(timer)
  timer = setTimeout(flush, SYNC_DEBOUNCE_MS)
}

function subscribeHousehold(code: string): void {
  if (!fb || !code) return
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  const ref = fb.collection(fb.db, COLLECTION, code, USERS_SUBCOLLECTION)
  let first = true
  unsubscribe = fb.onSnapshot(
    ref,
    (snap: any) => {
      setInfo('verbonden')
      if (first) {
        first = false
        // Nog niets in de cloud onder deze code: eigen data is het startpunt.
        if (snap.empty) {
          queue(getRoot().currentUser || 'rob')
          return
        }
      }
      if (snap.metadata?.hasPendingWrites) return // onze eigen schrijfactie
      snap.forEach((d: any) => {
        const local = getUser(d.id)
        if (!local) return // onbekende gebruiker in de cloud: negeren
        const remote = docToUser(d.data(), local)
        if (shouldAcceptRemote(local, remote)) applyRemoteUser(d.id, remote)
      })
    },
    (err: any) => {
      setInfo(
        'fout',
        err?.code === 'permission-denied'
          ? 'Geen toegang — zijn de Firestore-rules gepubliceerd en staat anonieme login aan?'
          : err?.message || 'Onbekende fout',
      )
    },
  )
}

/** Koppelt dit toestel aan een (andere) huishoudcode. */
export function connectHousehold(code: string): void {
  subscribeHousehold(code)
}

export async function initSync(): Promise<void> {
  setLocalChangeHandler((id) => queue(id))
  const code = getRoot().household
  if (!code) {
    setInfo('uit', 'Nog geen huishoudcode ingesteld.')
    return
  }
  setInfo('starten')

  let appMod, fsMod, authMod
  try {
    ;[appMod, fsMod, authMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore'),
      import('firebase/auth'),
    ])
  } catch {
    // SDK niet bereikbaar (eerste start offline) — de app draait door op localStorage
    setInfo('offline', 'Geen verbinding — wijzigingen blijven lokaal tot er internet is.')
    return
  }

  try {
    const app = appMod.initializeApp(firebaseConfig)
    let db
    try {
      // Firestore cachet zelf in IndexedDB en synct bij herverbinding.
      db = fsMod.initializeFirestore(app, {
        localCache: fsMod.persistentLocalCache({
          tabManager: fsMod.persistentMultipleTabManager(),
        }),
      })
    } catch {
      db = fsMod.getFirestore(app)
    }
    fb = {
      db,
      doc: fsMod.doc as Fb['doc'],
      collection: fsMod.collection as Fb['collection'],
      setDoc: fsMod.setDoc as Fb['setDoc'],
      onSnapshot: fsMod.onSnapshot as unknown as Fb['onSnapshot'],
    }
    try {
      await authMod.signInAnonymously(authMod.getAuth(app))
    } catch {
      setInfo('fout', 'Anoniem inloggen mislukt — zet "Anonymous" aan onder Authentication in Firebase.')
    }
    subscribeHousehold(code)
    if (dirty.size > 0) flush()
  } catch (e) {
    setInfo('fout', (e as Error)?.message ?? 'Firebase initialiseren mislukt.')
  }
}

/** Alleen voor tests: alle sync-toestand terug naar nul. */
export function resetSyncForTests(): void {
  if (unsubscribe) unsubscribe()
  unsubscribe = null
  fb = null
  dirty.clear()
  if (timer) clearTimeout(timer)
  timer = null
  info.status = 'uit'
  info.detail = ''
  info.pending = 0
  setLocalChangeHandler(null)
}

/** Alleen voor tests: welke gebruikers wachten nog op wegschrijven. */
export function pendingUsers(): string[] {
  return [...dirty]
}

/** Alleen voor tests: de debounce overslaan. */
export function flushNow(): void {
  if (timer) clearTimeout(timer)
  timer = null
  flush()
}

/** Alleen voor tests: een nep-Firestore injecteren. */
export function setFirestoreForTests(stub: Fb | null): void {
  fb = stub
}

export function startLocalQueue(): void {
  setLocalChangeHandler((id) => queue(id))
}
