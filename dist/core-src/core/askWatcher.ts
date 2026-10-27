import type { PermissionName } from '../catalog/permissions'
import type { ChallengeStatus, Client } from '../client'
import { createChallengeWatch, type ChallengeWatch } from './challengeStream'
import type { SessionStore } from './sessionStore'
import type { ChallengeKind } from './types'

const MIN_POLL_INTERVAL_MS = 30000
const MAX_POLL_BACKOFF_MS = 300000

/** A grownup ask that was emailed and is waiting on an answer; `error` once it failed or expired. */
export type PendingAsk = {
  status: 'pending' | 'error'
  challengeId: string
  permissions: PermissionName[]
  challengeKind: ChallengeKind | null
}

/** The kind of a settings challenge, from its server type; null while the type is unknown. */
export function settingsChallengeKindOf(type: string | undefined): ChallengeKind | null {
  if (!type) return null
  if (type === 'CHALLENGE_SESSION_UPGRADE_BY_AGE_ASSURANCE') return 'ageAssurance'
  if (type === 'CHALLENGE_SESSION_UPGRADE' || type.includes('PARENTAL_CONSENT')) return 'parentalConsent'
  return null
}

export type AskWatcherOptions = {
  client: Client
  sessions?: SessionStore
  pollIntervalMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

/** Watches each session's pending grownup ask until it is answered, so a grant reaches the session store whether or
 * not a settings screen is mounted. */
export interface AskWatcher {
  get(sessionId: string): PendingAsk | null
  subscribe(listener: () => void): () => void
  /** Watches `challengeId`, replacing the session's earlier ask; without a stream it polls after `delay` ms (one
   * poll interval by default). */
  watch(
    sessionId: string,
    challengeId: string,
    permissions: PermissionName[],
    delay?: number,
    challengeKind?: ChallengeKind | null,
  ): void
  clear(sessionId: string): void
  /** While attached, a granted ask is re-read through `reread`, so a mounted settings screen keeps its own read.
   * `reread` resolves false when the read failed, to be retried. */
  attach(sessionId: string, reread: () => Promise<boolean>): () => void
  start(): void
  stop(): void
}

type Polling = { backoff: number; timer: unknown; inFlight: boolean; granted: boolean; stream: ChallengeWatch }

export function createAskWatcher(options: AskWatcherOptions): AskWatcher {
  const { client } = options
  const now = options.now ?? (() => Date.now())
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  const interval = Math.max(MIN_POLL_INTERVAL_MS, options.pollIntervalMs ?? MIN_POLL_INTERVAL_MS)

  let started = false
  const asks = new Map<string, PendingAsk>()
  const polling = new Map<string, Polling>()
  const rereads = new Map<string, () => Promise<boolean>>()
  const streamed = new Map<string, string>()
  const fallbackDelays = new Map<string, number>()

  const listeners = new Set<() => void>()
  function emit() {
    for (const l of listeners) l()
  }
  function update(sessionId: string, patch: Partial<PendingAsk>) {
    const ask = asks.get(sessionId)
    if (!ask) return
    asks.set(sessionId, { ...ask, ...patch })
    emit()
  }
  function pollingFor(sessionId: string): Polling {
    let p = polling.get(sessionId)
    if (!p) {
      p = {
        backoff: interval,
        timer: null,
        inFlight: false,
        granted: false,
        stream: createChallengeWatch({
          client,
          now,
          onStatus: (status) => handleStatus(sessionId, streamed.get(sessionId) ?? '', status),
          onFallback: () => schedule(sessionId, fallbackDelays.get(sessionId) ?? interval),
        }),
      }
      polling.set(sessionId, p)
    }
    return p
  }

  function stopTimer(p: Polling) {
    if (p.timer !== null) {
      clearTimer(p.timer)
      p.timer = null
    }
  }
  function schedule(sessionId: string, delay: number) {
    if (!started) return
    const p = pollingFor(sessionId)
    stopTimer(p)
    p.timer = setTimer(() => void poll(sessionId), delay)
  }
  function watchAsk(sessionId: string, delay: number) {
    const ask = asks.get(sessionId)
    if (!started || !ask || ask.status !== 'pending') return
    fallbackDelays.set(sessionId, delay)
    streamed.set(sessionId, ask.challengeId)
    if (!pollingFor(sessionId).stream.start(ask.challengeId)) schedule(sessionId, delay)
  }
  // A poll or stream result for an ask the session has since replaced is dropped, so it never lands on the new one.
  const isCurrent = (sessionId: string, challengeId: string) => asks.get(sessionId)?.challengeId === challengeId

  async function reread(sessionId: string): Promise<boolean> {
    const attached = rereads.get(sessionId)
    if (attached) return attached()
    try {
      const read = await client.sessionGet(sessionId)
      if (read.session) options.sessions?.publish(read.session)
      return true
    } catch (e) {
      console.error('[k-ID] could not load the session', e)
      return false
    }
  }

  // The grant only counts once the granted session reached the store, so a failed read is retried, not dropped.
  async function finishGranted(sessionId: string, challengeId: string, p: Polling) {
    p.granted = true
    const read = await reread(sessionId)
    if (!isCurrent(sessionId, challengeId)) return
    if (!read) {
      p.backoff = Math.min(p.backoff * 2, MAX_POLL_BACKOFF_MS)
      schedule(sessionId, p.backoff)
      return
    }
    p.granted = false
    asks.delete(sessionId)
    emit()
  }

  async function handleStatus(sessionId: string, challengeId: string, status: ChallengeStatus): Promise<boolean> {
    const ask = asks.get(sessionId)
    if (!ask || ask.challengeId !== challengeId || ask.status !== 'pending') return false
    const p = pollingFor(sessionId)
    p.backoff = interval
    if (ask.permissions.length === 0 && status.permissions?.length) {
      update(sessionId, { permissions: status.permissions })
    }
    const challengeKind = settingsChallengeKindOf(status.type)
    if (challengeKind && challengeKind !== ask.challengeKind) update(sessionId, { challengeKind })
    if (status.status === 'PASS') {
      await finishGranted(sessionId, challengeId, p)
      return false
    }
    if (status.status === 'FAIL' || (status.expiresAt && now() > Date.parse(status.expiresAt))) {
      update(sessionId, { status: 'error' })
      return false
    }
    return true
  }

  async function poll(sessionId: string) {
    const p = pollingFor(sessionId)
    p.timer = null
    p.inFlight = true
    try {
      await pollOnce(sessionId, p)
    } finally {
      p.inFlight = false
    }
  }

  async function pollOnce(sessionId: string, p: Polling) {
    const ask = asks.get(sessionId)
    if (!ask || ask.status !== 'pending') return
    if (p.granted) return finishGranted(sessionId, ask.challengeId, p)
    try {
      const status = await client.challengeGetStatus(ask.challengeId)
      if (await handleStatus(sessionId, ask.challengeId, status)) schedule(sessionId, interval)
    } catch (e) {
      console.error("[k-ID] could not check for the grownup's answer; will retry", e)
      if (!isCurrent(sessionId, ask.challengeId)) return
      p.backoff = Math.min(p.backoff * 2, MAX_POLL_BACKOFF_MS)
      schedule(sessionId, p.backoff)
    }
  }

  return {
    get: (sessionId) => asks.get(sessionId) ?? null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    watch(sessionId, challengeId, permissions, delay, challengeKind = null) {
      asks.set(sessionId, { status: 'pending', challengeId, permissions, challengeKind })
      const p = pollingFor(sessionId)
      p.backoff = interval
      p.granted = false
      stopTimer(p)
      emit()
      watchAsk(sessionId, delay ?? interval)
    },
    clear(sessionId) {
      const p = polling.get(sessionId)
      if (p) {
        stopTimer(p)
        p.stream.stop()
      }
      if (asks.delete(sessionId)) emit()
    },
    attach(sessionId, fn) {
      rereads.set(sessionId, fn)
      return () => {
        if (rereads.get(sessionId) === fn) rereads.delete(sessionId)
      }
    },
    start() {
      if (started) return
      started = true
      for (const sessionId of asks.keys()) {
        const p = pollingFor(sessionId)
        if (!p.inFlight && !p.stream.active) watchAsk(sessionId, 0)
      }
    },
    stop() {
      for (const p of polling.values()) {
        stopTimer(p)
        p.stream.stop()
      }
      started = false
    },
  }
}
