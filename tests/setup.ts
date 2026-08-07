/**
 * De store leest localStorage bij het laden van de module. In Node bestaat die niet,
 * dus zetten we er een eenvoudige versie neer die zich hetzelfde gedraagt.
 */
const backing = new Map<string, string>()

const shim: Storage = {
  get length() {
    return backing.size
  },
  clear: () => backing.clear(),
  getItem: (k: string) => backing.get(k) ?? null,
  key: (i: number) => [...backing.keys()][i] ?? null,
  removeItem: (k: string) => void backing.delete(k),
  setItem: (k: string, v: string) => void backing.set(k, String(v)),
}

if (!('localStorage' in globalThis)) {
  Object.defineProperty(globalThis, 'localStorage', { value: shim, writable: true })
}

// RestTimer trilt na afloop; in Node bestaat navigator.vibrate niet.
if (!('navigator' in globalThis)) {
  Object.defineProperty(globalThis, 'navigator', { value: { vibrate: () => false }, writable: true })
}
