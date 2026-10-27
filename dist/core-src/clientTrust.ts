import type { BotCheckHint, BotCheckProvider } from './botCheck'
import type { components } from './fapi-schema'

type ClientToken = components['schemas']['ClientToken']
type ClientAttestRequest = components['schemas']['ClientAttestRequest']

export type PublicJwk = { kty?: string; crv?: string; x?: string; y?: string }

export interface DeviceKey {
  publicJwk: PublicJwk
  /** Returns the raw 64-byte `r || s` signature JWS expects. */
  sign(data: Uint8Array): Promise<Uint8Array>
}

export interface DeviceKeyProvider {
  getKey(): Promise<DeviceKey>
}

export type FapiSend = (
  path: string,
  init: { method: string; headers: Record<string, string>; body?: unknown },
) => Promise<{
  ok: boolean
  status: number
  data: { error?: string } & Record<string, unknown>
  retryAfter?: number
}>

/** A token step k-ID answered with a failure, or that never reached it (status 0). */
export type MintFailure = Awaited<ReturnType<FapiSend>>

/** The hashing and randomness client trust signs with, where the platform has no WebCrypto. */
export interface ClientCrypto {
  sha256(data: Uint8Array): Promise<Uint8Array>
  randomBytes(length: number): Uint8Array
}

export const webCrypto: ClientCrypto = {
  sha256: async (data) => new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data))),
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
}

/** The platform a mint is for, and the device evidence an app sends with it. Without one, a mint is the web's. */
export interface ClientAttestation {
  platform: ClientAttestRequest['platform']
  /** The attest request for this mint, bound to SHA-256(nonce.jkt), or null when the device has none to give. */
  evidence?(clientDataHash: Uint8Array): Promise<ClientAttestRequest | null>
  /** Called once a mint succeeds, with what was sent and whether k-ID verified it. */
  minted?(sent: ClientAttestRequest, verified: boolean): void
}

const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// React Native's URL implements neither `origin` nor `pathname`, so there the target is split by hand.
function htu(url: string): string {
  let parsed: string | null
  try {
    const target = new URL(url)
    parsed =
      typeof target.origin === 'string' && typeof target.pathname === 'string'
        ? `${target.origin}${target.pathname}`
        : null
  } catch {
    parsed = null
  }
  if (parsed) return parsed
  const match = /^([a-z][a-z\d+.-]*:\/\/[^/?#]+)([^?#]*)/i.exec(url)
  if (!match) throw new TypeError(`Not an absolute URL: ${url}`)
  return `${match[1].toLowerCase()}${match[2] || '/'}`
}

function jwkThumbprint(jwk: PublicJwk, hash: ClientCrypto): Promise<Uint8Array> {
  return hash.sha256(encoder.encode(`{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`))
}

/** `url` must be absolute. */
export async function createDPoPProof(
  key: DeviceKey,
  method: string,
  url: string,
  extra: { nonce?: string; accessToken?: string } = {},
  hash: ClientCrypto = webCrypto,
): Promise<string> {
  const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: key.publicJwk }
  const claims: Record<string, unknown> = {
    htm: method,
    htu: htu(url),
    iat: Math.floor(Date.now() / 1000),
    jti: base64url(hash.randomBytes(16)),
  }
  if (extra.nonce) claims.nonce = extra.nonce
  if (extra.accessToken) claims.ath = base64url(await hash.sha256(encoder.encode(extra.accessToken)))
  const signingInput = `${base64url(encoder.encode(JSON.stringify(header)))}.${base64url(encoder.encode(JSON.stringify(claims)))}`
  return `${signingInput}.${base64url(await key.sign(encoder.encode(signingInput)))}`
}

/** A token is refreshed this long before it expires, so a call never races its expiry. */
const EXPIRY_MARGIN_MS = 60_000

/** So an outage of the mint endpoints doesn't add two requests to every call. */
const MINT_COOLDOWN_MS = 60_000

export class ClientTrust {
  private token: ClientToken | null = null
  private minting: Promise<ClientToken | null> | null = null
  private nextMintAt = 0
  // Null when the last mint failed before reaching k-ID (no device key, no bot check), or did not fail.
  private failure: MintFailure | null = null

  constructor(
    private readonly send: FapiSend,
    private readonly resolveUrl: (path: string) => string,
    private readonly keys: DeviceKeyProvider,
    private readonly botCheck?: BotCheckProvider,
    private readonly attestation?: ClientAttestation,
    private readonly hash: ClientCrypto = webCrypto,
  ) {}

  async headers(method: string, path: string): Promise<Record<string, string>> {
    const token = await this.current()
    if (!token) return {}
    try {
      const key = await this.keys.getKey()
      const proof = await createDPoPProof(
        key,
        method,
        this.resolveUrl(path),
        { accessToken: token.clientToken },
        this.hash,
      )
      return { 'Kid-Client': token.clientToken, DPoP: proof }
    } catch {
      return {}
    }
  }

  /** The token step's failure that leaves calls without a token, with a 429's `retryAfter` as the seconds left
   * before the next mint; null when there is none. */
  tokenFailure(): MintFailure | null {
    const failure = this.failure
    if (failure?.status !== 429) return failure
    return { ...failure, retryAfter: Math.max(1, Math.ceil((this.nextMintAt - Date.now()) / 1000)) }
  }

  invalidate(): void {
    this.token = null
  }

  async trustLevel(): Promise<ClientToken['trustLevel'] | null> {
    return (await this.current())?.trustLevel ?? null
  }

  private async current(): Promise<ClientToken | null> {
    if (this.token && Date.parse(this.token.expiresAt) - EXPIRY_MARGIN_MS > Date.now()) return this.token
    if (Date.now() < this.nextMintAt) return null
    this.minting ??= this.mint()
      .then((token) => {
        // A rate limit's Retry-After replaces the cooldown, so the mint is tried again as soon as k-ID allows.
        const retryAfter = this.failure?.retryAfter
        if (!token) this.nextMintAt = Date.now() + (retryAfter !== undefined ? retryAfter * 1000 : MINT_COOLDOWN_MS)
        return token
      })
      .finally(() => {
        this.minting = null
      })
    this.token = await this.minting
    return this.token
  }

  private async mint(): Promise<ClientToken | null> {
    this.failure = null
    try {
      const key = await this.keys.getKey()
      const challenge = await this.send('/client/challenge', { method: 'POST', headers: {} })
      if (!challenge.ok) {
        this.failure = challenge
        return null
      }
      const nonce = challenge.data.nonce
      if (typeof nonce !== 'string') return null
      const platform = this.attestation?.platform ?? 'web'
      const evidence = this.attestation?.evidence
      const body: ClientAttestRequest = (evidence &&
        (await evidence(
          await this.hash.sha256(
            encoder.encode(`${nonce}.${base64url(await jwkThumbprint(key.publicJwk, this.hash))}`),
          ),
        ))) ?? { platform }
      const hint = challenge.data.botCheck as BotCheckHint | undefined
      // Only the web answers the bot check; an app proves itself with its attestation instead.
      if (hint && platform === 'web') {
        if (!this.botCheck) return null
        body.botCheckToken = await this.botCheck.token(hint)
      }
      // The proof is signed last, so a slow bot check does not age it.
      const proof = await createDPoPProof(key, 'POST', this.resolveUrl('/client/attest'), { nonce }, this.hash)
      const attest = await this.send('/client/attest', { method: 'POST', headers: { DPoP: proof }, body })
      if (!attest.ok) {
        this.failure = attest
        return null
      }
      const token = attest.data as unknown as ClientToken
      this.attestation?.minted?.(body, token.trustLevel === 'verified')
      return token
    } catch {
      return null
    }
  }
}
