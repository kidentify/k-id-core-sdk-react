import {
  localKidError,
  toKidError,
  type AgeSignal,
  type ChallengeStatus,
  type Client,
  type KidError,
  type PlatformAgeSignal,
  type Session,
} from '../client'
import { createChallengeWatch } from './challengeStream'
import type { SessionStore } from './sessionStore'
import type { AgeGateState, AgeGateStep, ChallengeKind, KidStatus, RawChallengeStatus, Requirements } from './types'
import { createVerifyAgeController, type VerifyAgeController } from './verifyAge'

const MIN_POLL_INTERVAL_MS = 30000
const MAX_POLL_BACKOFF_MS = 300000
const MAX_CHECK_ATTEMPTS = 3
const CHECK_RETRY_MS = 1000

export type AgeGateInputs = {
  jurisdiction?: string
  age?: AgeSignal
  email?: string
  challengeId?: string
  sessionId?: string
}

export type AgeGateOptions = {
  client: Client
  initial?: AgeGateInputs
  /** Asks the device's platform for the player's age range, which stands in for the age gate when it is shared. */
  platformAgeSignal?: (ageGates: number[]) => Promise<PlatformAgeSignal | null>
  sessions?: SessionStore
  pollIntervalMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export interface AgeGateController {
  getState(): AgeGateState
  subscribe(listener: () => void): () => void
  /** Kick off network work (auto-check, or resume). Idempotent; call once after mount. No request is sent
   * before it, so inputs pushed earlier wait for it. */
  start(): void
  /** Push the declarative props from KidSessionProvider. Locked age/jurisdiction changes are ignored. */
  configure(inputs: Pick<AgeGateInputs, 'jurisdiction' | 'age' | 'email'>): void
  /** Collected by <KidSelectJurisdiction>. */
  setJurisdiction(code: string): void
  /** Collected by <KidCollectAge>. */
  setAge(signal: AgeSignal): void
  /** Collected by <KidAskAnAdult>. */
  setEmail(email: string): void
  /** Send the challenge email. Valid only after a challenge exists; re-callable to re-send a correction. */
  submit(): Promise<{ ok: boolean; error?: KidError }>
  /** Re-read the session (permissions change out of band). */
  refreshSession(): Promise<void>
  /** The integration config could not be declared: surface `error`. */
  declarationFailed(error: unknown): void
  /** Verifies the player is an adult on the established session; null until the gate passes. Nothing is sent until
   * its `start()`. */
  sessionVerifyAge(): VerifyAgeController | null
  destroy(): void
}

/** The challenge id safe to resume from: only once its email is sent. */
export function resumableChallengeId(state: AgeGateState): string | null {
  return state.status === 'pending' ? state.challengeId : null
}

const CONSENT_TYPE_MARKER = 'PARENTAL_CONSENT'
// Deliberately excludes CHALLENGE_SESSION_UPGRADE_BY_AGE_ASSURANCE, which also contains "AGE_ASSURANCE".
const ASSURANCE_TYPE_MARKER = 'AGE_GATE_AGE_ASSURANCE'

function isConsentChallenge(type: string | undefined): boolean {
  return !type || type.includes(CONSENT_TYPE_MARKER)
}

function isAssuranceChallenge(type: string | undefined): boolean {
  return !!type && type.includes(ASSURANCE_TYPE_MARKER)
}

function challengeKindOf(type: string | undefined): ChallengeKind | null {
  if (isConsentChallenge(type)) return 'parentalConsent'
  if (isAssuranceChallenge(type)) return 'ageAssurance'
  return null
}

/** The jurisdiction's minimum, access and civil ages, as the age gates to ask the platform for.
 *
 * Apple rejects a range shorter than two years, so a minimum age too close to its neighbour is dropped (the check still
 * enforces it). Empty when the ages still cannot make valid gates. */
function platformAgeGates(requirements: Requirements): number[] {
  function gates(ages: (number | undefined)[]): number[] | null {
    const sorted = [...new Set(ages.filter((a): a is number => a !== undefined && a > 0))].sort((a, b) => a - b)
    return sorted.every((gate, i) => gate - (sorted[i - 1] ?? 0) >= 2) ? sorted : null
  }
  return (
    gates([requirements.minimumAge, requirements.accessAge, requirements.civilAge]) ??
    gates([requirements.accessAge, requirements.civilAge]) ??
    []
  )
}

function sameAge(a: AgeSignal | undefined, b: AgeSignal | undefined): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function createAgeGateController(options: AgeGateOptions): AgeGateController {
  const { client } = options
  const now = options.now ?? (() => Date.now())
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const interval = Math.max(MIN_POLL_INTERVAL_MS, options.pollIntervalMs ?? MIN_POLL_INTERVAL_MS)

  const initial = options.initial ?? {}
  const resuming = Boolean(initial.challengeId || initial.sessionId)

  const prop = { jurisdiction: initial.jurisdiction, age: initial.age, email: initial.email }
  const collected: { jurisdiction?: string; age?: AgeSignal; email?: string } = {}

  let locked = resuming
  let lockedJurisdiction: string | undefined = initial.jurisdiction
  let lockedAge: AgeSignal | undefined = initial.age
  let checked = resuming
  let checking = false
  let started = false
  let resumeStarted = false
  let polling = false
  let requirementsFetched = false
  let autoResolveFailed = false
  let checkAttempts = 0
  let warnedLock = false
  let etag: string | null = null
  let backoff = interval
  let timer: unknown = null
  const platformAgeSignal = options.platformAgeSignal ?? client.platformAgeSignal
  let platformAsked = false
  let askingPlatform = false
  let platformSignal: PlatformAgeSignal | null = null
  let unsubscribeSessions: (() => void) | null = null
  let fallbackDelay = 0
  const stream = createChallengeWatch({
    client,
    now,
    onStatus: async (status) => {
      const pending = await handleStatus(status)
      if (pending) scheduleWithinDeadline(Infinity)
      return pending
    },
    onFallback: () => scheduleWithinDeadline(fallbackDelay),
  })

  let state: AgeGateState = {
    status: initial.challengeId ? 'pending' : 'running',
    step: null,
    challengeId: initial.challengeId ?? null,
    challengeKind: null,
    sessionId: initial.sessionId ?? null,
    session: null,
    claimToken: null,
    rawChallengeStatus: initial.challengeId ? 'pending' : null,
    expiresAt: null,
    requirements: null,
    emailProvided: initial.email !== undefined,
    error: null,
  }
  state = { ...state, step: computeStep(state) }

  const listeners = new Set<() => void>()
  function emit() {
    for (const l of listeners) l()
  }

  let verifyAge: { sessionId: string; controller: VerifyAgeController } | null = null
  function syncVerifyAge() {
    const sessionId = state.status === 'pass' ? state.sessionId : null
    if (!sessionId || verifyAge?.sessionId === sessionId) return
    verifyAge?.controller.destroy()
    verifyAge = {
      sessionId,
      controller: createVerifyAgeController({
        client,
        sessionId,
        civilAge: sessionCivilAge,
        onSession: (session) => {
          etag = null
          commit({ session })
        },
        pollIntervalMs: options.pollIntervalMs,
        now: options.now,
        setTimer: options.setTimer,
        clearTimer: options.clearTimer,
      }),
    }
  }

  async function sessionCivilAge(): Promise<number | undefined> {
    if (state.requirements) return state.requirements.civilAge
    const jurisdiction = state.session?.jurisdiction
    if (!jurisdiction) return undefined
    const requirements = await client.getRequirements(jurisdiction)
    commit({ requirements })
    return requirements.civilAge
  }

  // A resumed session never ran the gate's requirements fetch; fetch them for its jurisdiction.
  function fetchSessionRequirements(session: Session | null) {
    if (state.requirements !== null || !session?.jurisdiction) return
    void client
      .getRequirements(session.jurisdiction)
      .then((requirements: Requirements) => commit({ requirements }))
      .catch((e: unknown) => console.error('[k-ID] could not load the requirements', e))
  }

  function effectiveJurisdiction(): string | undefined {
    // A user selection wins over the prop so a picker choice overrides an unresolved `auto`.
    return locked ? lockedJurisdiction : (collected.jurisdiction ?? prop.jurisdiction)
  }
  function effectiveAge(): AgeSignal | undefined {
    return locked ? lockedAge : (prop.age ?? collected.age)
  }
  function effectiveEmail(): string | undefined {
    return prop.email ?? collected.email
  }
  function jurisdictionArg(): string | undefined {
    const j = effectiveJurisdiction()
    return j && j.toLowerCase() !== 'auto' ? j : undefined
  }

  // The picker is needed when there is no concrete jurisdiction and either none was given or `auto` could
  // not be resolved server-side. An unresolved `auto` still gets to try first.
  function needJurisdiction(): boolean {
    if (jurisdictionArg() !== undefined) return false
    return effectiveJurisdiction() === undefined || autoResolveFailed
  }

  function computeStep({ status, challengeId, challengeKind }: AgeGateState): AgeGateStep {
    if (status !== 'running') return null
    if (needJurisdiction()) return 'jurisdiction'
    if (challengeId) return challengeKind === 'ageAssurance' ? 'ageAssurance' : 'parentalConsent'
    // The age step waits while the platform may still supply the age instead.
    if (!checked && effectiveAge() === undefined && platformSignal === null) {
      return platformAgeSignal && !platformAsked ? 'checking' : 'age'
    }
    return 'checking'
  }

  function isCannotResolve(e: unknown): boolean {
    return typeof e === 'object' && e !== null && (e as { rawCode?: unknown }).rawCode === 'CANNOT_RESOLVE_JURISDICTION'
  }

  function commit(patch: Partial<AgeGateState>) {
    const prev = state.session
    const next = { ...state, ...patch }
    state = { ...next, step: computeStep(next) }
    syncVerifyAge()
    emit()
    if (state.session && state.session !== prev) options.sessions?.publish(state.session)
  }

  function adoptSession(session: Session) {
    if (session === state.session || session.sessionId !== state.sessionId) return
    etag = null
    commit({ session })
  }

  // A restarted gate missed what was published while it was stopped.
  function catchUpSession() {
    const cached = state.session && state.sessionId ? options.sessions?.current(state.sessionId) : null
    if (cached) adoptSession(cached)
  }

  function stopTimer() {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }
  function schedule(delay: number) {
    if (!started) return
    stopTimer()
    if (Number.isFinite(delay)) timer = setTimer(poll, delay)
  }
  function watch(delay: number) {
    if (!started || !state.challengeId) return
    fallbackDelay = delay
    scheduleWithinDeadline(stream.start(state.challengeId) ? Infinity : delay)
  }
  function rearm() {
    if (polling || timer !== null || stream.active || !state.challengeId || state.status !== 'pending') return
    backoff = interval
    watch(0)
  }
  function scheduleWithinDeadline(delay: number) {
    if (state.expiresAt) {
      const remaining = Date.parse(state.expiresAt) - now()
      if (remaining <= 0) {
        commit({ rawChallengeStatus: 'fail' })
        fail('fail', 'challenge expired')
        return
      }
      delay = Math.min(delay, remaining)
    }
    schedule(delay)
  }

  function maybeFetchRequirements() {
    if (!started || requirementsFetched) return
    // Nothing to fetch until we can name a jurisdiction: no concrete one, and either none given or `auto`
    // already failed (waiting on the picker). An unresolved `auto` still probes the server once.
    if (jurisdictionArg() === undefined && (effectiveJurisdiction() === undefined || autoResolveFailed)) return
    requirementsFetched = true
    void client
      .getRequirements(jurisdictionArg())
      .then((requirements: Requirements) => {
        commit({ requirements })
        maybeAskPlatform(requirements)
        maybeCheck()
      })
      .catch((e: unknown) => {
        // `auto` could not be resolved server-side: fall back to the picker and let it retry per selection.
        if (jurisdictionArg() === undefined && isCannotResolve(e)) {
          autoResolveFailed = true
          requirementsFetched = false
          commit({})
          return
        }
        fail('error', e)
      })
  }

  function maybeAskPlatform(requirements: Requirements) {
    const ask = platformAgeSignal
    if (!ask || platformAsked) return
    platformAsked = true
    const gates = platformAgeGates(requirements)
    if (
      effectiveAge() !== undefined ||
      !requirements.approvedAgeCollectionMethods.includes('platform-account') ||
      gates.length === 0
    ) {
      commit({})
      return
    }
    askingPlatform = true
    void (async () => {
      if (await client.platformAgeSignalTrusted()) platformSignal = await ask(gates).catch(() => null)
      askingPlatform = false
      commit({})
      maybeCheck()
    })()
  }

  function maybeCheck() {
    if (!started || checked || checking || resuming || askingPlatform) return
    if (effectiveAge() === undefined && platformSignal === null) return
    if (state.requirements === null) return
    void runCheck()
  }

  async function runCheck() {
    // Capture the inputs before locking: once `locked` is true, effective*() read back the locked values.
    lockedJurisdiction = effectiveJurisdiction()
    lockedAge = effectiveAge()
    checking = true
    locked = true
    commit({ status: 'running' })
    try {
      const res = await client.ageGateCheck(lockedAge, jurisdictionArg(), platformSignal ?? undefined)
      checked = true
      checking = false
      if (res.status === 'PROHIBITED') {
        commit({ status: 'prohibited', session: null, challengeId: null })
        return
      }
      if (res.status === 'PASS') {
        commit({
          status: 'pass',
          session: res.session ?? null,
          sessionId: res.session?.sessionId ?? null,
          challengeId: null,
          claimToken: res.claimToken ?? null,
        })
        return
      }
      // PASS_WITH_CHALLENGE is treated as CHALLENGE.
      const kind = res.challenge ? challengeKindOf(res.challenge.type) : null
      if (res.challenge && kind) {
        commit({
          status: 'running',
          challengeId: res.challenge.challengeId,
          challengeKind: kind,
          rawChallengeStatus: 'pending',
          claimToken: res.claimToken ?? null,
        })
        return
      }
      fail(
        'error',
        res.challenge?.type ? `unsupported challenge type ${res.challenge.type}` : 'challenge without an id',
      )
    } catch (e) {
      checking = false
      const status = (e as { status?: number }).status
      const transient = typeof status !== 'number' || status >= 500
      checkAttempts += 1
      if (transient && checkAttempts < MAX_CHECK_ATTEMPTS) {
        if (!started) return
        stopTimer()
        timer = setTimer(() => void runCheck(), CHECK_RETRY_MS)
        return
      }
      checked = true
      fail('error', e)
    }
  }

  function fail(status: Extract<KidStatus, 'error' | 'fail'>, detail: unknown) {
    if (status === 'error') console.error('[k-ID] age gate error', detail)
    stopTimer()
    stream.stop()
    commit({ status, error: status === 'error' ? toKidError(detail) : null })
  }

  async function submit(): Promise<{ ok: boolean; error?: KidError }> {
    const challengeId = state.challengeId
    if (!challengeId) {
      console.warn('[k-ID] submit() called before a challenge exists; nothing to send.')
      return { ok: false, error: localKidError('invalid_request') }
    }
    const email = effectiveEmail()
    if (!email) {
      console.warn(
        '[k-ID] submit() called without an email; provide the `email` prop or render <KidAskAnAdult> / <KidVerifyAge>.',
      )
      return { ok: false, error: localKidError('invalid_request') }
    }
    const res = await client
      .challengeSendEmail(challengeId, email)
      .catch((e: unknown): { ok: false; error: KidError } => ({ ok: false, error: toKidError(e) }))
    if (res.ok) {
      backoff = interval
      commit({ status: 'pending', rawChallengeStatus: 'pending' })
      watch(interval)
      return { ok: true }
    }
    console.error('[k-ID] could not send the challenge email', res.error)
    return { ok: false, error: res.error }
  }

  async function poll() {
    timer = null
    polling = true
    try {
      await pollOnce()
    } finally {
      polling = false
    }
  }

  async function pollOnce() {
    const challengeId = state.challengeId
    if (!challengeId) return
    try {
      const status = await client.challengeGetStatus(challengeId)
      backoff = interval
      if (await handleStatus(status)) scheduleWithinDeadline(stream.active ? Infinity : interval)
    } catch (e) {
      console.error('[k-ID] poll failed; will retry', e)
      backoff = Math.min(backoff * 2, MAX_POLL_BACKOFF_MS)
      scheduleWithinDeadline(stream.active ? Infinity : backoff)
    }
  }

  async function handleStatus(status: ChallengeStatus): Promise<boolean> {
    if (!state.challengeKind && status.type) {
      const kind = challengeKindOf(status.type)
      if (kind) commit({ challengeKind: kind })
    }
    if (status.status === 'PASS') {
      const sessionId = status.sessionId ?? state.sessionId ?? null
      let session = state.session
      if (sessionId) {
        const read = await client.sessionGet(sessionId)
        etag = read.etag
        session = read.session ?? session
      }
      stopTimer()
      stream.stop()
      commit({ status: 'pass', rawChallengeStatus: 'pass', session, sessionId })
      fetchSessionRequirements(session)
      return false
    }
    if (status.status === 'FAIL') {
      commit({ rawChallengeStatus: 'fail' })
      fail('fail', 'challenge failed')
      return false
    }
    if (status.expiresAt && now() > Date.parse(status.expiresAt)) {
      commit({ rawChallengeStatus: 'fail' })
      fail('fail', 'challenge expired')
      return false
    }
    const raw: RawChallengeStatus = status.status === 'IN_PROGRESS' ? 'in-progress' : 'pending'
    commit({ rawChallengeStatus: raw, expiresAt: status.expiresAt ?? null })
    return true
  }

  async function refreshSession() {
    const sessionId = state.sessionId
    if (!sessionId) return
    const read = await client.sessionGet(sessionId, etag ?? undefined).catch((e: unknown) => {
      throw toKidError(e)
    })
    if (read.notModified) return
    etag = read.etag
    if (read.session) commit({ session: read.session })
  }

  async function resume() {
    if (initial.sessionId) {
      try {
        const read = await client.sessionGet(initial.sessionId)
        etag = read.etag
        if (read.session) {
          commit({ status: 'pass', rawChallengeStatus: 'pass', session: read.session, sessionId: initial.sessionId })
          fetchSessionRequirements(read.session)
          return
        }
        fail('error', 'resumed session not found')
      } catch (e) {
        fail('error', e)
      }
      return
    }
    if (initial.challengeId) {
      backoff = interval
      watch(0)
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      if (started) return
      started = true
      unsubscribeSessions ??= options.sessions?.subscribe(adoptSession) ?? null
      catchUpSession()
      if (resuming) {
        if (resumeStarted) rearm()
        else {
          resumeStarted = true
          void resume()
        }
        return
      }
      maybeFetchRequirements()
      maybeCheck()
      rearm()
    },
    configure(inputs) {
      if (resuming) return
      prop.email = inputs.email
      if (locked) {
        const jurisdictionChanged = inputs.jurisdiction !== undefined && inputs.jurisdiction !== lockedJurisdiction
        const ageChanged = inputs.age !== undefined && !sameAge(inputs.age, lockedAge)
        if ((jurisdictionChanged || ageChanged) && !warnedLock) {
          warnedLock = true
          console.warn('[k-ID] age/jurisdiction ignored: an active challenge already exists for this session.')
        }
        commit({ emailProvided: inputs.email !== undefined })
        return
      }
      prop.jurisdiction = inputs.jurisdiction
      prop.age = inputs.age
      maybeFetchRequirements()
      maybeCheck()
      commit({ emailProvided: inputs.email !== undefined })
    },
    setJurisdiction(code) {
      if (locked) return
      collected.jurisdiction = code
      maybeFetchRequirements()
      maybeCheck()
      emit()
    },
    setAge(signal) {
      if (locked) return
      collected.age = signal
      maybeCheck()
      emit()
    },
    setEmail(email) {
      collected.email = email
      emit()
    },
    submit,
    refreshSession,
    declarationFailed(error) {
      commit({ status: 'error', error: toKidError(error) })
    },
    sessionVerifyAge: () => verifyAge?.controller ?? null,
    destroy() {
      verifyAge?.controller.destroy()
      // Stop watching and allow a later start() to re-arm it, so a mount/unmount/remount (React StrictMode)
      // resumes watching instead of leaving it dead.
      stopTimer()
      unsubscribeSessions?.()
      unsubscribeSessions = null
      stream.stop()
      started = false
    },
  }
}
