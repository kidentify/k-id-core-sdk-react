import { localKidError, toKidError, type ChallengeStatus, type Client, type KidError, type Session } from '../client'
import { createChallengeWatch } from './challengeStream'
import type { KidStatus, RawChallengeStatus } from './types'

const MIN_POLL_INTERVAL_MS = 30000
const MAX_POLL_BACKOFF_MS = 300000

export type VerifyAgeStep = 'checking' | 'email' | null

export type VerifyAgeState = {
  status: Extract<KidStatus, 'running' | 'pending' | 'pass' | 'fail' | 'error'>
  step: VerifyAgeStep
  challengeId: string | null
  rawChallengeStatus: RawChallengeStatus
  /** The challenge's deadline, or null when it has none. The flow moves to `fail` at this time. */
  expiresAt: string | null
  /** Why the check ended in `status === 'error'`: a k-ID API error as is, and any other failure as `unavailable`. */
  error: KidError | null
}

export type VerifyAgeOptions = {
  client: Client
  sessionId: string
  /** The civil age of the session's jurisdiction, which the re-read session must prove before the flow passes. */
  civilAge: () => Promise<number | undefined>
  /** Receives the session re-read once k-ID reports a pass. */
  onSession?: (session: Session) => void
  pollIntervalMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export interface VerifyAgeController {
  getState(): VerifyAgeState
  subscribe(listener: () => void): () => void
  start(): void
  setEmail(email: string): void
  submit(): Promise<{ ok: boolean; error?: KidError }>
  destroy(): void
}

export function createVerifyAgeController(options: VerifyAgeOptions): VerifyAgeController {
  const { client, sessionId, onSession } = options
  const now = options.now ?? (() => Date.now())
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const interval = Math.max(MIN_POLL_INTERVAL_MS, options.pollIntervalMs ?? MIN_POLL_INTERVAL_MS)

  let started = false
  let checked = false
  let polling = false
  let confirming = false
  let confirmation = 0
  let collectedEmail: string | undefined
  let backoff = interval
  let timer: unknown = null
  let fallbackDelay = 0
  const stream = createChallengeWatch({
    client,
    now,
    onStatus: async (status) => {
      const pending = await handleStatus(status)
      if (pending) schedule(Infinity)
      return pending
    },
    onFallback: () => schedule(fallbackDelay),
  })

  let state: VerifyAgeState = {
    status: 'running',
    step: 'checking',
    challengeId: null,
    rawChallengeStatus: null,
    expiresAt: null,
    error: null,
  }

  const listeners = new Set<() => void>()
  function commit(patch: Partial<VerifyAgeState>) {
    state = { ...state, ...patch }
    for (const l of listeners) l()
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
    if (state.expiresAt) {
      const remaining = Date.parse(state.expiresAt) - now()
      if (remaining <= 0) {
        finish('fail')
        return
      }
      delay = Math.min(delay, remaining)
    }
    if (Number.isFinite(delay)) timer = setTimer(poll, delay)
  }
  function watch(delay: number) {
    if (!started || !state.challengeId) return
    fallbackDelay = delay
    schedule(stream.start(state.challengeId) ? Infinity : delay)
  }

  function finish(status: 'fail' | 'error', detail?: unknown) {
    if (status === 'error') console.error('[k-ID] age verification error', detail)
    stopTimer()
    stream.stop()
    commit({
      status,
      step: null,
      rawChallengeStatus: status === 'fail' ? 'fail' : state.rawChallengeStatus,
      error: status === 'error' ? toKidError(detail) : null,
    })
  }

  function scheduleConfirm(delay: number) {
    if (!started) return
    stopTimer()
    timer = setTimer(() => {
      timer = null
      void confirmPass()
    }, delay)
  }

  // k-ID reporting a pass is not enough: the session itself must now prove an adult.
  // A remount can start a newer confirmation while an older read is still in flight; only the newest may land.
  async function confirmPass() {
    const id = ++confirmation
    confirming = true
    let verifiedAge: number | undefined
    let civilAge: number | undefined
    try {
      const read = await client.sessionGet(sessionId)
      if (id !== confirmation) return
      if (read.session) onSession?.(read.session)
      verifiedAge = read.session?.ageVerification?.verifiedAge
      civilAge = await options.civilAge()
      if (id !== confirmation) return
    } catch (e) {
      if (id !== confirmation) return
      console.error('[k-ID] could not re-read the session after verifying age; will retry', e)
      backoff = Math.min(backoff * 2, MAX_POLL_BACKOFF_MS)
      commit({ status: 'error', step: null, error: toKidError(e) })
      scheduleConfirm(backoff)
      return
    }
    confirming = false
    backoff = interval
    if (verifiedAge !== undefined && civilAge !== undefined && verifiedAge >= civilAge) {
      commit({ status: 'pass', step: null, error: null, rawChallengeStatus: state.challengeId ? 'pass' : null })
      return
    }
    finish('fail')
  }

  async function check() {
    checked = true
    try {
      const res = await client.sessionVerifyAge(sessionId)
      if (res.status === 'PASS') {
        await confirmPass()
        return
      }
      if (res.status === 'FAIL') {
        finish('fail')
        return
      }
      if (!res.challenge) {
        finish('error', 'challenge without an id')
        return
      }
      commit({ step: 'email', challengeId: res.challenge.challengeId, rawChallengeStatus: 'pending' })
    } catch (e) {
      finish('error', e)
    }
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
      if (await handleStatus(status)) schedule(stream.active ? Infinity : interval)
    } catch (e) {
      console.error('[k-ID] age verification poll failed; will retry', e)
      backoff = Math.min(backoff * 2, MAX_POLL_BACKOFF_MS)
      schedule(stream.active ? Infinity : backoff)
    }
  }

  async function handleStatus(status: ChallengeStatus): Promise<boolean> {
    if (status.status === 'PASS') {
      stopTimer()
      stream.stop()
      await confirmPass()
      return false
    }
    if (status.status === 'FAIL' || (status.expiresAt && now() > Date.parse(status.expiresAt))) {
      finish('fail')
      return false
    }
    commit({
      rawChallengeStatus: status.status === 'IN_PROGRESS' ? 'in-progress' : 'pending',
      expiresAt: status.expiresAt ?? null,
    })
    return true
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      // A finished fail or error starts over with a fresh check, so remounting the component tries again.
      if (state.status === 'fail' || (state.status === 'error' && !confirming)) {
        stopTimer()
        started = true
        backoff = interval
        commit({
          status: 'running',
          step: 'checking',
          challengeId: null,
          rawChallengeStatus: null,
          expiresAt: null,
          error: null,
        })
        void check()
        return
      }
      if (started) return
      started = true
      if (!checked) {
        void check()
        return
      }
      if (polling || timer !== null || stream.active) return
      if (confirming) scheduleConfirm(0)
      else if (state.status === 'pending') watch(0)
    },
    setEmail(email) {
      collectedEmail = email
    },
    async submit() {
      const challengeId = state.challengeId
      if (!challengeId || (state.status !== 'running' && state.status !== 'pending')) {
        console.warn('[k-ID] submit() called before a challenge exists; nothing to send.')
        return { ok: false, error: localKidError('invalid_request') }
      }
      const email = collectedEmail
      if (!email) {
        console.warn(
          '[k-ID] submit() called without an email; pass one to `verifyAge.submit` or render <KidSessionVerifyAge>.',
        )
        return { ok: false, error: localKidError('invalid_request') }
      }
      const res = await client.challengeSendEmail(challengeId, email)
      if (!res.ok) {
        console.error('[k-ID] could not send the verification email', res.error)
        return { ok: false, error: res.error }
      }
      backoff = interval
      commit({ status: 'pending', step: null })
      watch(interval)
      return { ok: true }
    },
    destroy() {
      stopTimer()
      stream.stop()
      started = false
    },
  }
}
