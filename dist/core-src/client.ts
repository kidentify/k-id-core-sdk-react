import type { PermissionName } from './catalog/permissions'
import type { BotCheckProvider } from './botCheck'
import {
  ClientTrust,
  webCrypto,
  type ClientAttestation,
  type ClientCrypto,
  type DeviceKeyProvider,
} from './clientTrust'
import { declaredIconUrl } from './declareIcon'
import type { components } from './fapi-schema'
import { createSseParser } from './sse'

type Schemas = components['schemas']

export type Permission = Omit<Schemas['Permission'], 'name'> & { name: PermissionName }
export type Session = Omit<Schemas['Session'], 'permissions'> & { permissions: Permission[] }
export type Challenge = Schemas['Challenge']
export type ChallengeStatus = Omit<Schemas['ChallengeStatus'], 'permissions'> & { permissions?: PermissionName[] }
export type AgeResult = Omit<Schemas['CheckAgeGateResponse'], 'session'> & { session?: Session }
export type Requirements = Schemas['AgeGateRequirements']
export type InviteParentResult = Schemas['InviteParentResponse']
export type AgeVerification = Schemas['AgeVerification']

export type AgeSignal = { dateOfBirth: string } | { age: number }
export type PlatformAgeSignal = Schemas['PlatformAgeSignal']

/** What the app declares. `permissions` and `supportEmail` are always sent; leave another field out to keep what k-ID has, or send null to clear it. */
export type DeclareInput = {
  permissions: { name: PermissionName }[]
  privacyPolicyUrl?: string | null
  termsOfServiceUrl?: string | null
  /** A public https link, or any image the app can load (a bundled asset, a local path), which is sent inline. */
  iconUrl?: string | null
  /** Required. The address k-ID's emails give players and parents for help. */
  supportEmail: string
}

/** A read of the session, carrying the etag so a caller can make the next read conditional. `notFound` is k-ID's
 * answer when the session no longer exists. */
export type SessionRead = { session: Session | null; etag: string | null; notModified: boolean; notFound?: KidError }

/** Result of a player opt-in/opt-out change: the updated session, or a user-recoverable failure with its error. */
export type SessionChangeResult = { ok: true; session: Session } | { ok: false; error: KidError }

/** Result of a guardian upgrade request: the session plus any minted upgrade challenge to email and poll. */
export type SessionUpgradeResult = { session: Session; challenge: Challenge | null }

export type SessionVerifyAgeResult = {
  status: Schemas['VerifySessionAgeResponse']['status']
  challenge: Challenge | null
}

/** The closed set of error codes the SDK surfaces, grouped by what the developer does about it. Specifics
 * ride in `message` (dev-facing) or the coarse end-user `status:'error'`. */
export type KidErrorCode = 'invalid_request' | 'unauthorized' | 'not_found' | 'rate_limited' | 'unavailable'

// The API returns almost every error as HTTP 400, so map on the JSON `error` code, not the status.
const RAW_ERROR_TO_CODE: Record<string, KidErrorCode> = {
  NOT_FOUND: 'not_found',
  UNAUTHORIZED: 'unauthorized',
  TOO_MANY_REQUESTS: 'rate_limited',
  INVALID_INPUT: 'invalid_request',
  INVALID_EMAIL: 'invalid_request',
  AGE_CONFLICT: 'invalid_request',
  CLIENT_TOKEN_INVALID: 'unauthorized',
  FEATURE_DISABLED: 'unavailable',
  CANNOT_RESOLVE_JURISDICTION: 'unavailable',
  INTERNAL_ERROR: 'unavailable',
  UNKNOWN: 'unavailable',
}

export function toKidErrorCode(rawCode: string | undefined, status: number): KidErrorCode {
  if (rawCode && rawCode in RAW_ERROR_TO_CODE) return RAW_ERROR_TO_CODE[rawCode]
  if (status === 429) return 'rate_limited'
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 404) return 'not_found'
  if (status >= 400 && status < 500) return 'invalid_request'
  return 'unavailable'
}

/** Developer-facing default `KidError` messages, keyed by case. Fixed and scrubbed of server detail; a
 * developer showing an end-user message maps the closed `code` to their own copy. */
type KidErrorMessages = {
  invalidRequest: string
  invalidAgeSignal: string
  invalidJurisdiction: string
  ageConflict: string
  challengeIdRequired: string
  challengeResolved: string
  emailMismatch: string
  permissionNotChangeable: string
  unauthorizedKey: string
  unauthorizedOrigin: string
  sessionNotFound: string
  challengeNotFound: string
  rateLimited: string
  serverError: string
  featureDisabled: string
}

const DEFAULT_ERROR_MESSAGES: KidErrorMessages = {
  invalidRequest: 'The request was invalid.',
  invalidAgeSignal: 'Provide a valid date of birth or age.',
  invalidJurisdiction: 'Unknown or invalid jurisdiction code.',
  ageConflict: 'The platform age signal conflicts with the provided age.',
  challengeIdRequired: 'A challenge id is required.',
  challengeResolved: 'This challenge is already resolved; no email can be sent.',
  emailMismatch: "The email address doesn't match this challenge's approver, or is required.",
  permissionNotChangeable: "That permission can't be changed here.",
  unauthorizedKey: 'Invalid or unrecognized publishable key.',
  unauthorizedOrigin: "This origin isn't allowed for your publishable key.",
  sessionNotFound: 'Session not found.',
  challengeNotFound: 'Challenge not found.',
  rateLimited: 'Too many requests. Please wait and try again.',
  serverError: 'Something went wrong on our side. Please try again.',
  featureDisabled: "This feature isn't enabled for this product.",
}

const INVALID_INPUT_SUBCASES: { test: RegExp; key: keyof KidErrorMessages }[] = [
  { test: /invalid jurisdiction/i, key: 'invalidJurisdiction' },
  { test: /dateofbirth|date of birth/i, key: 'invalidAgeSignal' },
  { test: /challenge id must be provided/i, key: 'challengeIdRequired' },
  { test: /completed challenge/i, key: 'challengeResolved' },
]

type MessageKeys = { notFound?: keyof KidErrorMessages; invalid?: keyof KidErrorMessages }

function resolveErrorMessage(
  rawCode: string | undefined,
  rawMessage: string | undefined,
  status: number,
  keys: MessageKeys,
  msgs: KidErrorMessages,
): string {
  switch (rawCode) {
    case 'AGE_CONFLICT':
      return msgs.ageConflict
    case 'INVALID_EMAIL':
      return msgs.emailMismatch
    case 'FEATURE_DISABLED':
      return msgs.featureDisabled
    case 'TOO_MANY_REQUESTS':
      return msgs.rateLimited
    case 'UNAUTHORIZED':
      return status === 403 ? msgs.unauthorizedOrigin : msgs.unauthorizedKey
    case 'INTERNAL_ERROR':
      return msgs.serverError
    case 'NOT_FOUND':
      return msgs[keys.notFound ?? 'sessionNotFound']
  }
  if (status === 429) return msgs.rateLimited
  if (status === 401 || status === 403) return status === 403 ? msgs.unauthorizedOrigin : msgs.unauthorizedKey
  if (status >= 500 || status === 0) return msgs.serverError
  const subcase = rawMessage ? INVALID_INPUT_SUBCASES.find((s) => s.test.test(rawMessage)) : undefined
  return msgs[subcase?.key ?? keys.invalid ?? 'invalidRequest']
}

export type SendEmailResult = { ok: true } | { ok: false; error: KidError }

/** How an opened challenge stream ended: the server closed it (with its reconnect hint, if any), or the connection
 * dropped. */
export type ChallengeStreamEnd = { closed: true; retryMs?: number } | { closed: false }

/** A non-2xx error from the k-ID API. `code` is one of the closed `KidErrorCode` set; `message` is safe to
 * display (never raw server text). `rawCode` is the underlying server code, kept for internal flow branches. */
export class KidError extends Error {
  constructor(
    readonly status: number,
    readonly code: KidErrorCode,
    message: string,
    readonly rawCode: string | undefined,
    /** With `rate_limited`, the whole seconds k-ID asked the caller to wait before trying again, when it said. */
    readonly retryAfter?: number,
  ) {
    super(message)
    this.name = 'KidError'
  }
}

/** The error a failure the SDK catches before any call carries, such as a submit before a challenge exists. */
export function localKidError(code: 'invalid_request'): KidError {
  return new KidError(0, code, DEFAULT_ERROR_MESSAGES.invalidRequest, undefined)
}

/** Anything that is not already a KidError, such as a dropped connection, becomes main's transport error. */
export function toKidError(e: unknown): KidError {
  return e instanceof KidError ? e : new KidError(0, 'unavailable', DEFAULT_ERROR_MESSAGES.serverError, undefined)
}

// A 429's Retry-After, kept by its response body until the body becomes an error.
const retryAfterByBody = new WeakMap<object, number>()

/** Retry-After as a whole number of seconds; anything else, an HTTP date or an overflow included, is left out. */
function parseRetryAfter(header: string | null | undefined): number | undefined {
  const value = header?.trim()
  if (!value || !/^\d+$/.test(value)) return undefined
  const seconds = Number(value)
  return Number.isSafeInteger(seconds) ? seconds : undefined
}

export interface ClientOptions {
  /** Sent as `Authorization: Bearer`. */
  publishableKey?: string
  baseUrl?: string
  /** Injected fetch (tests / SSR). Default: global `fetch`. */
  fetchImpl?: typeof fetch
  /** The device key a keyed client's calls are bound to. Without one, calls are sent unbound. */
  deviceKeys?: DeviceKeyProvider
  /** Solves the bot check k-ID asks a live key's mint for. Without one, a mint that asks for it gets no token. */
  botCheck?: BotCheckProvider
  /** The URL a relative `baseUrl` or declared `iconUrl` resolves against. Without it, both must be absolute. */
  baseURI?: () => string | undefined
  /** Sent with every call, such as an app's `Kid-App-Id` where there is no `Origin`. */
  headers?: Record<string, string>
  /** The mint's platform and device evidence. Default: the web's, with the bot check. */
  attestation?: ClientAttestation
  /** Hashing and randomness for client trust. Default: WebCrypto. */
  crypto?: ClientCrypto
  /** Opens the challenge's event stream. Default: `fetchImpl`, reading the body as it arrives. */
  eventStream?: EventStreamTransport
  /** Turns a declared `iconUrl` into what declare sends. Default: a public https link as is, anything else inline. */
  readIcon?: (iconUrl: string) => Promise<string>
  /** Asks the platform for the player's age range. Without it, the age gate never asks. */
  platformAgeSignal?: (ageGates: number[]) => Promise<PlatformAgeSignal | null>
}

/** How an event stream's request ended: its status, and the body when it was not a stream. */
export type EventStreamResult = { status: number; text: string }

/** Opens an event stream: `onHeaders` once the response starts, `onText` with each piece of the body as it arrives.
 * Resolves when the response ends; rejects when the connection fails or `signal` aborts it. */
export type EventStreamTransport = (
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  onHeaders: (status: number, contentType: string | null) => void,
  onText: (text: string) => void,
) => Promise<EventStreamResult>

function fetchEventStream(doFetch: typeof fetch): EventStreamTransport {
  return async (url, headers, signal, onHeaders, onText) => {
    const r = await doFetch(url, { method: 'GET', headers, signal })
    const contentType = r.headers.get('content-type')
    onHeaders(r.status, r.body ? contentType : null)
    if (!r.ok || !r.body || !contentType?.startsWith('text/event-stream')) {
      return { status: r.status, text: JSON.stringify(await r.json().catch(() => ({}))) }
    }
    const reader = r.body.getReader()
    const decoder = new TextDecoder()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      onText(decoder.decode(value, { stream: true }))
    }
    onText(decoder.decode())
    return { status: r.status, text: '' }
  }
}

export interface Client {
  /** Age-gate check. An absent jurisdiction is resolved server-side from the client IP. A platform age signal stands in
   * for an absent age. */
  ageGateCheck(
    age: AgeSignal | undefined,
    jurisdiction?: string,
    platformAgeSignal?: PlatformAgeSignal,
  ): Promise<AgeResult>
  /** Whether the server will use a platform age signal from this client. */
  platformAgeSignalTrusted(): Promise<boolean>
  /** Asks the platform for the player's age range, where the client has a way to. */
  platformAgeSignal?: (ageGates: number[]) => Promise<PlatformAgeSignal | null>
  getRequirements(jurisdiction?: string): Promise<Requirements>
  /** Get a player session by id. Pass a prior etag to let an unchanged session 304. */
  sessionGet(sessionId: string, etag?: string): Promise<SessionRead>
  challengeGetStatus(challengeId: string): Promise<ChallengeStatus>
  /** Stream the challenge's status, calling `onStatus` with each one, until the stream ends. Throws a `KidError` when
   * the stream can't be opened; `not_found` means streaming is unavailable, so poll instead. */
  challengeStream(
    challengeId: string,
    onStatus: (status: ChallengeStatus) => void,
    signal: AbortSignal,
  ): Promise<ChallengeStreamEnd>
  /** Send the consent request. Omit `email` to reach the challenge's existing approver (guardian upgrade on a
   * linked session). Re-callable to re-send to a still-pending challenge. */
  challengeSendEmail(challengeId: string, email?: string): Promise<SendEmailResult>
  /** Send a parent-invite challenge (VPL). Mirrors the wire; unused by the VPC flow. */
  challengeInviteParent(sessionId: string, parentEmail: string, playerName?: string): Promise<InviteParentResult>
  /** Enable or disable a player-managed permission (opt-in/opt-out). User-recoverable failures return a code. */
  sessionChange(sessionId: string, name: PermissionName, enabled: boolean): Promise<SessionChangeResult>
  /** Request a guardian upgrade for guardian-managed permissions; mints a challenge to email and poll. */
  sessionUpgrade(sessionId: string, permissionNames: PermissionName[]): Promise<SessionUpgradeResult>
  sessionVerifyAge(sessionId: string): Promise<SessionVerifyAgeResult>
  /** Declare the app's config (test mode only). Throws on a non-2xx. */
  declare(input: DeclareInput): Promise<void>
}

function bearer(key: string | undefined): Record<string, string> {
  return key ? { Authorization: `Bearer ${key}` } : {}
}

export function createClient(options: ClientOptions = {}): Client {
  const baseUrl = (options.baseUrl ?? '/fapi/v1').replace(/\/+$/, '')
  const doFetch = options.fetchImpl ?? fetch.bind(globalThis)
  const openEventStream = options.eventStream ?? fetchEventStream(doFetch)
  const hash = options.crypto ?? (globalThis.crypto?.subtle ? webCrypto : null)

  function kidError(status: number, data: { error?: string; errorMessage?: string }, keys: MessageKeys = {}): KidError {
    const code = toKidErrorCode(data.error, status)
    return new KidError(
      status,
      code,
      resolveErrorMessage(data.error, data.errorMessage, status, keys, DEFAULT_ERROR_MESSAGES),
      data.error,
      code === 'rate_limited' ? retryAfterByBody.get(data) : undefined,
    )
  }

  type Sent<T> = { ok: boolean; status: number; data: T; etag: string | null; retryAfter?: number }

  // A transport failure (offline / DNS / CORS / abort) becomes a synthetic status-0 non-ok, mapped like any other.
  async function send<T>(
    path: string,
    init: { method: string; headers: Record<string, string>; body?: unknown },
  ): Promise<Sent<T>> {
    let r: Response
    try {
      r = await doFetch(`${baseUrl}${path}`, {
        method: init.method,
        headers: {
          ...(init.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
          ...bearer(options.publishableKey),
          ...options.headers,
          ...init.headers,
        },
        ...(init.method === 'POST' ? { body: JSON.stringify(init.body ?? {}) } : {}),
      })
    } catch {
      return { ok: false, status: 0, data: {} as T, etag: null }
    }
    const data = (await r.json().catch(() => ({}))) as T
    const retryAfter = r.status === 429 ? parseRetryAfter(r.headers?.get?.('retry-after')) : undefined
    if (retryAfter !== undefined && data && typeof data === 'object') retryAfterByBody.set(data, retryAfter)
    return { ok: r.ok, status: r.status, data, etag: r.headers?.get?.('etag') ?? null, retryAfter }
  }

  // The proof must name the absolute URL, so a relative baseUrl is resolved against `baseURI`. An absolute one is
  // used as it is: React Native's URL would add a trailing slash.
  const absolute = /^[a-z][a-z\d+.-]*:\/\//i.test(baseUrl)
  const clientTrust =
    options.publishableKey && options.deviceKeys && hash
      ? new ClientTrust(
          (path, init) => send(path, init),
          (path) => (absolute ? `${baseUrl}${path}` : new URL(`${baseUrl}${path}`, options.baseURI?.()).href),
          options.deviceKeys,
          options.botCheck,
          options.attestation,
          hash,
        )
      : null

  // A call that went out without a token and came back 401 reports why it had none: the token step's own failure.
  function tokenFailure<T>(status: number, trust: Record<string, string>): Sent<T> | null {
    const failure = status === 401 && Object.keys(trust).length === 0 ? clientTrust?.tokenFailure() : null
    if (!failure) return null
    const data = { ...failure.data }
    if (failure.retryAfter !== undefined) retryAfterByBody.set(data, failure.retryAfter)
    return { ok: false, status: failure.status, data: data as T, etag: null, retryAfter: failure.retryAfter }
  }

  async function trusted<T>(
    path: string,
    init: { method: string; headers?: Record<string, string>; body?: unknown },
  ): Promise<Sent<T>> {
    const attempt = async () => {
      const trust = clientTrust ? await clientTrust.headers(init.method, path) : {}
      const sent = await send<T>(path, {
        method: init.method,
        body: init.body,
        headers: { ...(init.headers ?? {}), ...trust },
      })
      return tokenFailure<T>(sent.status, trust) ?? sent
    }
    const first = await attempt()
    if (!clientTrust || (first.data as { error?: string })?.error !== 'CLIENT_TOKEN_INVALID') return first
    clientTrust.invalidate()
    return attempt()
  }

  async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
    return trusted<T>(path, { method: 'POST', body })
  }

  async function get<T>(path: string, headers: Record<string, string> = {}): Promise<Sent<T>> {
    return trusted<T>(path, { method: 'GET', headers })
  }

  return {
    async ageGateCheck(age, jurisdiction, platformAgeSignal) {
      const body: Schemas['CheckAgeGateRequest'] = {
        ...age,
        ...(jurisdiction ? { jurisdiction } : {}),
        ...(platformAgeSignal ? { platformAgeSignal } : {}),
      }
      const { ok, status, data } = await post<AgeResult & { error?: string; errorMessage?: string }>(
        '/age-gate/check',
        body,
      )
      if (!ok) throw kidError(status, data, { invalid: 'invalidAgeSignal' })
      return data
    },

    // The server trusts a platform age signal only from an iOS app: any on a test key, an App Attest verified one on a
    // live key.
    async platformAgeSignalTrusted() {
      if (!options.platformAgeSignal || !clientTrust) return false
      const trustLevel = await clientTrust.trustLevel()
      if (trustLevel === null) return false
      return !options.publishableKey?.startsWith('kgp_live_') || trustLevel === 'verified'
    },

    ...(options.platformAgeSignal ? { platformAgeSignal: options.platformAgeSignal } : {}),

    async getRequirements(jurisdiction) {
      const query = jurisdiction ? `?jurisdiction=${encodeURIComponent(jurisdiction)}` : ''
      const { ok, status, data } = await get<Requirements & { error?: string; errorMessage?: string }>(
        `/age-gate/get-requirements${query}`,
      )
      if (!ok) throw kidError(status, data, { invalid: 'invalidJurisdiction' })
      return data
    },

    async sessionGet(sessionId, etag) {
      const {
        ok,
        status,
        data,
        etag: responseEtag,
      } = await get<Session & { error?: string; errorMessage?: string }>(
        `/session/get?sessionId=${encodeURIComponent(sessionId)}`,
        etag ? { 'If-None-Match': etag } : {},
      )
      if (status === 304) return { session: null, etag: etag ?? null, notModified: true }
      if (!ok) {
        const err = kidError(status, data, { notFound: 'sessionNotFound' })
        // A stale/unknown session is a normal resume outcome, not a throw.
        if (err.code === 'not_found') return { session: null, etag: null, notModified: false, notFound: err }
        throw err
      }
      return { session: data, etag: data.etag ?? responseEtag, notModified: false }
    },

    async challengeGetStatus(challengeId) {
      const { ok, status, data } = await get<ChallengeStatus & { error?: string; errorMessage?: string }>(
        `/challenge/get-status?challengeId=${encodeURIComponent(challengeId)}`,
      )
      if (!ok) throw kidError(status, data, { notFound: 'challengeNotFound' })
      return data
    },

    async challengeStream(challengeId, onStatus, signal) {
      const path = `/challenge/stream?challengeId=${encodeURIComponent(challengeId)}`
      const parser = createSseParser(({ event, data }) => {
        if (event !== 'status') return
        let status: ChallengeStatus
        try {
          status = JSON.parse(data) as ChallengeStatus
        } catch {
          return
        }
        onStatus(status)
      })

      let streaming = false
      let trust: Record<string, string> = {}
      const open = async () => {
        streaming = false
        trust = clientTrust ? await clientTrust.headers('GET', path) : {}
        const headers = { Accept: 'text/event-stream', ...bearer(options.publishableKey), ...options.headers, ...trust }
        return openEventStream(
          `${baseUrl}${path}`,
          headers,
          signal,
          (status, contentType) => {
            streaming = status >= 200 && status < 300 && !!contentType?.startsWith('text/event-stream')
          },
          (text) => {
            if (streaming) parser.push(text)
          },
        )
      }
      const refused = (res: EventStreamResult) => {
        const failure = tokenFailure<{ error?: string; errorMessage?: string }>(res.status, trust)
        if (failure) return kidError(failure.status, failure.data, { notFound: 'challengeNotFound' })
        let data: { error?: string; errorMessage?: string } = {}
        try {
          data = JSON.parse(res.text) as typeof data
        } catch {
          // A refusal that is not JSON maps on its status alone.
        }
        return kidError(res.status, data, { notFound: 'challengeNotFound' })
      }

      let res: EventStreamResult
      try {
        res = await open()
        if (res.status >= 400) {
          const err = refused(res)
          if (!clientTrust || err.rawCode !== 'CLIENT_TOKEN_INVALID') throw err
          clientTrust.invalidate()
          res = await open()
        }
      } catch (e) {
        if (e instanceof KidError) throw e
        // A stream that dropped after it opened ends like any other; one that never opened failed to open.
        if (streaming) return { closed: false }
        throw kidError(0, {})
      }
      if (res.status >= 400) throw refused(res)
      // A proxy that answers with something other than a stream can't stream to this client.
      if (!streaming) throw kidError(0, {})
      return { closed: true, ...(parser.retryMs !== undefined ? { retryMs: parser.retryMs } : {}) }
    },

    async challengeSendEmail(challengeId, email) {
      const body: Schemas['SendEmailRequest'] = { challengeId, ...(email ? { email } : {}) }
      const { ok, status, data } = await post<{ error?: string; errorMessage?: string }>('/challenge/send-email', body)
      if (ok) return { ok: true }
      return {
        ok: false,
        error: kidError(status, data, { notFound: 'challengeNotFound', invalid: 'challengeResolved' }),
      }
    },

    async challengeInviteParent(sessionId, parentEmail, playerName) {
      const body: Schemas['InviteParentRequest'] = { sessionId, parentEmail, ...(playerName ? { playerName } : {}) }
      const { ok, status, data } = await post<InviteParentResult & { error?: string; errorMessage?: string }>(
        '/challenge/invite-parent',
        body,
      )
      if (!ok) throw kidError(status, data, { notFound: 'sessionNotFound' })
      return data
    },

    async sessionChange(sessionId, name, enabled) {
      const body: Schemas['ChangeSessionRequest'] = { sessionId, name, enabled }
      const { ok, status, data } = await post<Session & { error?: string; errorMessage?: string }>(
        '/session/change',
        body,
      )
      if (ok) return { ok: true, session: data }
      return {
        ok: false,
        error: kidError(status, data, { notFound: 'sessionNotFound', invalid: 'permissionNotChangeable' }),
      }
    },

    async sessionUpgrade(sessionId, permissionNames) {
      const body: Schemas['UpgradeSessionRequest'] = {
        sessionId,
        requestedPermissions: permissionNames.map((name) => ({ name })),
      }
      const { ok, status, data } = await post<SessionUpgradeResult & { error?: string; errorMessage?: string }>(
        '/session/upgrade',
        body,
      )
      if (!ok) throw kidError(status, data, { notFound: 'sessionNotFound' })
      return { session: data.session, challenge: data.challenge ?? null }
    },

    async sessionVerifyAge(sessionId) {
      const body: Schemas['VerifySessionAgeRequest'] = { sessionId }
      const { ok, status, data } = await post<
        Schemas['VerifySessionAgeResponse'] & { error?: string; errorMessage?: string }
      >('/session/verify-age', body)
      if (!ok) throw kidError(status, data, { notFound: 'sessionNotFound' })
      return { status: data.status, challenge: data.challenge ?? null }
    },

    async declare(input) {
      let iconUrl = input.iconUrl
      if (iconUrl) {
        try {
          iconUrl = options.readIcon
            ? await options.readIcon(iconUrl)
            : await declaredIconUrl(iconUrl, doFetch, options.baseURI?.())
        } catch (e) {
          throw new KidError(
            0,
            'invalid_request',
            e instanceof Error ? e.message : 'Could not read the app icon.',
            undefined,
          )
        }
      }
      const body: Schemas['DeclareRequest'] = {
        permissions: input.permissions,
        ...(input.privacyPolicyUrl !== undefined ? { privacyPolicyUrl: input.privacyPolicyUrl } : {}),
        ...(input.termsOfServiceUrl !== undefined ? { termsOfServiceUrl: input.termsOfServiceUrl } : {}),
        ...(iconUrl !== undefined ? { iconUrl } : {}),
        supportEmail: input.supportEmail,
      }
      const { ok, status, data } = await post<{ error?: string; errorMessage?: string }>('/declare', body)
      // Declare is dev-time (test mode): pass the server's specific validation detail through so the
      // integrator sees e.g. "Unknown permission: chatt" rather than a scrubbed generic string.
      if (!ok) {
        const code = toKidErrorCode(data.error, status)
        throw new KidError(
          status,
          code,
          data.errorMessage ?? data.error ?? 'Declare failed.',
          data.error,
          code === 'rate_limited' ? retryAfterByBody.get(data) : undefined,
        )
      }
    },
  }
}
