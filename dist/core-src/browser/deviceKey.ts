import type { DeviceKey, DeviceKeyProvider } from '../clientTrust'

type StoredKey = { privateKey: CryptoKey; publicJwk: JsonWebKey }

async function generateKey(): Promise<StoredKey> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return { privateKey: pair.privateKey, publicJwk: { kty, crv, x, y } }
}

function isStoredKey(value: unknown): value is StoredKey {
  const key = value as Partial<StoredKey> | undefined
  return (
    key?.privateKey instanceof CryptoKey &&
    key.privateKey.type === 'private' &&
    key.privateKey.algorithm.name === 'ECDSA' &&
    typeof key.publicJwk?.x === 'string' &&
    typeof key.publicJwk.y === 'string'
  )
}

const DB_NAME = 'k-id-core'
const DB_STORE = 'device-keys'
const DB_KEY = 'dpop'

function settled<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Reading `indexedDB` itself throws a SecurityError where site data is blocked or in a sandboxed iframe.
function keyStoreFactory(): IDBFactory | undefined {
  try {
    return globalThis.indexedDB ?? undefined
  } catch {
    return undefined
  }
}

function openKeyStore(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function readStoredKey(db: IDBDatabase): Promise<unknown> {
  return settled(db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(DB_KEY))
}

// The per-device backoff is keyed on this key, so it is kept across reloads. It stays non-extractable: IndexedDB
// stores the CryptoKey itself, never its bytes.
async function loadKey(): Promise<StoredKey> {
  const factory = keyStoreFactory()
  if (!factory) return generateKey()
  let db: IDBDatabase | undefined
  let stored: unknown
  try {
    db = await openKeyStore(factory)
    stored = await readStoredKey(db)
  } catch {
    db?.close()
    return generateKey()
  }
  try {
    if (isStoredKey(stored)) return stored
    const fresh = await generateKey()
    try {
      const keys = db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE)
      // `add` rather than `put` when nothing is stored, so a tab that loses the race adopts the winner's key.
      await settled(stored === undefined ? keys.add(fresh, DB_KEY) : keys.put(fresh, DB_KEY))
      return fresh
    } catch {
      const winner = await readStoredKey(db).catch(() => undefined)
      return isStoredKey(winner) ? winner : fresh
    }
  } finally {
    db.close()
  }
}

export function createWebCryptoKeyProvider(): DeviceKeyProvider {
  let shared: Promise<DeviceKey> | null = null
  return {
    getKey() {
      shared ??= (async () => {
        const { privateKey, publicJwk } = await loadKey()
        return {
          publicJwk,
          async sign(data: Uint8Array) {
            return new Uint8Array(
              await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, data as BufferSource),
            )
          },
        }
      })().catch((err) => {
        shared = null
        throw err
      })
      return shared
    },
  }
}

export const webCryptoKeyProvider = createWebCryptoKeyProvider()
