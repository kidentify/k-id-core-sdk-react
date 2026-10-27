import type { PermissionName } from '../catalog/permissions'
import { KidError, toKidError, type Client, type Permission, type Session } from '../client'
import { type AskWatcher, createAskWatcher, settingsChallengeKindOf } from './askWatcher'
import type { SessionStore } from './sessionStore'
import type { ChallengeKind } from './types'

/** The grownup-ask sub-flow: mint one settings challenge for a batch of permissions, email the grownup, poll
 * to completion. `sending` = minting/emailing; `pending` = polling; `error` = the ask failed (re-askable). */
export type SettingsChallengeStatus = 'idle' | 'sending' | 'pending' | 'error'

export type SettingsChallengeState = {
  status: SettingsChallengeStatus
  /** The permissions in the current ask, so a UI can mark those rows as waiting. */
  permissions: PermissionName[]
  challengeId: string | null
  /** What the challenge asks for: a grownup's approval, or the player's own age check. Null until known. */
  challengeKind: ChallengeKind | null
}

export type SettingsState = {
  session: Session | null
  isLoaded: boolean
  /** Why the session failed to load: a k-ID API error as is, and any other failure as `unavailable`. A UI shows an
   * error and offers `refresh()` to retry. */
  error: KidError | null
  challenge: SettingsChallengeState
}

export type SettingsInputs = {
  sessionId: string
  /** Resume an in-flight settings challenge; persist it from `onChallenge` and pass it back. */
  challengeId?: string
}

export type SettingsOptions = {
  client: Client
  initial: SettingsInputs
  onChallenge?: (challengeId: string) => void
  sessions?: SessionStore
  /** The app-wide watcher that keeps polling an ask after this controller is destroyed; without one, the
   * controller polls its own asks only while started. */
  asks?: AskWatcher
  pollIntervalMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

export interface SettingsController {
  getState(): SettingsState
  subscribe(listener: () => void): () => void
  /** Load the session (and resume a pending settings-challenge poll). Idempotent; call once after mount. */
  start(): void
  /** Enable or disable a player-managed permission (opt-in / opt-out). */
  change(name: PermissionName, enabled: boolean): Promise<{ ok: boolean; error?: KidError }>
  /** Request grownup approval for one or more guardian-managed permissions in a single request: mint one
   * settings challenge, email the grownup, then poll to completion. Pass `approverEmail` when the session has
   * none (`session.hasApproverEmail === false`); omit it to email the linked one.
   *
   * A permission with a `verifiedAgeThreshold` needs the player's own age check instead. Without an email this
   * returns `invalid_request` when that check is needed; call it again with the player's own email. */
  upgrade(names: PermissionName[], approverEmail?: string): Promise<{ ok: boolean; error?: KidError }>
  /** Re-read the session (permissions change out of band). */
  refresh(): Promise<void>
  destroy(): void
}

const PLAYER_EMAIL_NEEDED = "The player's email is needed to verify their age."

export function createSettingsController(options: SettingsOptions): SettingsController {
  const { client, initial, onChallenge } = options
  const asks =
    options.asks ??
    createAskWatcher({
      client,
      sessions: options.sessions,
      pollIntervalMs: options.pollIntervalMs,
      now: options.now,
      setTimer: options.setTimer,
      clearTimer: options.clearTimer,
    })
  const ownsAsks = !options.asks

  let started = false
  let resumed = false
  let etag: string | null = null
  let unsubscribeSessions: (() => void) | null = null
  let unsubscribeAsks: (() => void) | null = null
  let detachAsks: (() => void) | null = null
  // The ask while it is being sent, or once sending failed; after that the watcher holds it.
  let local: SettingsChallengeState | null = initial.challengeId
    ? { status: 'pending', permissions: [], challengeId: initial.challengeId, challengeKind: null }
    : null

  let state: SettingsState = {
    session: null,
    isLoaded: false,
    error: null,
    challenge: challengeState(),
  }

  function challengeState(): SettingsChallengeState {
    if (local) return local
    const ask = asks.get(initial.sessionId)
    if (ask) {
      return {
        status: ask.status,
        permissions: ask.permissions,
        challengeId: ask.challengeId,
        challengeKind: ask.challengeKind,
      }
    }
    return { status: 'idle', permissions: [], challengeId: null, challengeKind: null }
  }

  const listeners = new Set<() => void>()
  function emit() {
    for (const l of listeners) l()
  }
  function commit(patch: Partial<SettingsState>) {
    const prev = state.session
    state = { ...state, ...patch }
    emit()
    if (state.session && state.session !== prev) options.sessions?.publish(state.session)
  }
  function adoptSession(session: Session) {
    if (session === state.session || session.sessionId !== initial.sessionId) return
    etag = null
    commit({ session, isLoaded: true, error: null })
  }
  // A restarted controller missed what was published while it was stopped.
  function catchUpSession() {
    const cached = state.session ? options.sessions?.current(initial.sessionId) : null
    if (cached) adoptSession(cached)
  }
  function syncChallenge() {
    commit({ challenge: challengeState() })
  }
  function setLocal(next: SettingsChallengeState | null) {
    local = next
    syncChallenge()
  }

  async function loadSession(): Promise<boolean> {
    try {
      const read = await client.sessionGet(initial.sessionId, etag ?? undefined)
      if (read.notModified) return true
      // sessionGet returns a null session for a not_found sessionId (deliberate for the age gate, where a
      // stale id is a normal resume). Here sessionId is a required input, so a missing session is a failure.
      if (!read.session) {
        commit({ error: read.notFound ?? toKidError(undefined) })
        return true
      }
      etag = read.etag
      commit({ session: read.session, isLoaded: true, error: null })
      return true
    } catch (e) {
      console.error('[k-ID] could not load the session', e)
      commit({ error: toKidError(e) })
      return false
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
      unsubscribeAsks ??= asks.subscribe(syncChallenge)
      detachAsks ??= asks.attach(initial.sessionId, loadSession)
      if (ownsAsks) asks.start()
      void loadSession()
      if (!resumed) {
        resumed = true
        if (initial.challengeId && !asks.get(initial.sessionId)) {
          asks.watch(initial.sessionId, initial.challengeId, [], 0)
        }
        local = null
      }
      syncChallenge()
    },
    async change(name, enabled) {
      const res = await client.sessionChange(initial.sessionId, name, enabled)
      if (!res.ok) return { ok: false, error: res.error }
      etag = null
      commit({ session: res.session, isLoaded: true, error: null })
      return { ok: true }
    },
    async upgrade(names, approverEmail) {
      asks.clear(initial.sessionId)
      setLocal({ status: 'sending', permissions: names, challengeId: null, challengeKind: null })
      let challengeKind: ChallengeKind | null = null
      try {
        const { challenge } = await client.sessionUpgrade(initial.sessionId, names)
        if (!challenge) {
          await loadSession()
          setLocal(null)
          return { ok: true }
        }
        challengeKind = settingsChallengeKindOf(challenge.type)
        // Nothing is sent without the player's email; the next call asks again, and this challenge just expires.
        if (challengeKind === 'ageAssurance' && !approverEmail) {
          setLocal({ status: 'error', permissions: names, challengeId: null, challengeKind })
          return { ok: false, error: new KidError(0, 'invalid_request', PLAYER_EMAIL_NEEDED, undefined) }
        }
        const sent = await client.challengeSendEmail(challenge.challengeId, approverEmail)
        if (!sent.ok) {
          setLocal({ status: 'error', permissions: names, challengeId: challenge.challengeId, challengeKind })
          return { ok: false, error: sent.error }
        }
        // Reported only after the email is sent, so a resume never picks up an un-emailed challenge.
        onChallenge?.(challenge.challengeId)
        local = null
        asks.watch(initial.sessionId, challenge.challengeId, names, undefined, challengeKind)
        return { ok: true }
      } catch (e) {
        console.error('[k-ID] could not start the settings challenge', e)
        setLocal({ status: 'error', permissions: names, challengeId: null, challengeKind })
        return { ok: false, error: toKidError(e) }
      }
    },
    async refresh() {
      await loadSession()
    },
    destroy() {
      if (ownsAsks) asks.stop()
      detachAsks?.()
      detachAsks = null
      unsubscribeAsks?.()
      unsubscribeAsks = null
      unsubscribeSessions?.()
      unsubscribeSessions = null
      started = false
    },
  }
}

export type { Permission }
