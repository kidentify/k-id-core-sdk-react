import { useSyncExternalStore } from 'react'

import { localKidError, type AgeVerification, type KidError } from '../client'
import type { SettingsChallengeState, VerifyAgeController, VerifyAgeState } from '../core'
import type {
  ChallengeKind,
  KidStatus,
  Permission,
  PermissionName,
  RawChallengeStatus,
  Requirements,
  Session,
} from '../core/types'
import { useAgeGateController, useAgeGateState, useSettingsController, useSettingsState } from './context'

export type UseKidAgeGate = {
  status: KidStatus
  challengeId: string | null
  challengeKind: ChallengeKind | null
  sessionId: string | null
  /** Why the gate ended in `status: 'error'`: a k-ID API error as is, and any other failure as `unavailable`. */
  error: KidError | null
  requirements: Requirements | null
  /** Send the challenge email. Valid only after a challenge exists; re-callable to re-send a correction. */
  submit: () => Promise<{ ok: boolean; error?: KidError }>
}

export function useKidAgeGate(): UseKidAgeGate {
  const controller = useAgeGateController()
  const state = useAgeGateState()
  return {
    status: state.status,
    challengeId: state.challengeId,
    challengeKind: state.challengeKind,
    sessionId: state.sessionId,
    error: state.error,
    requirements: state.requirements,
    submit: controller.submit,
  }
}

export type UseKidSession = {
  session: Session | null
  permissions: Partial<Record<PermissionName, boolean>>
  sessionId: string | null
  isLoaded: boolean
  ageVerification: AgeVerification | null
  verifyAge: UseKidSessionVerifyAge
  /** Re-read the session; permissions can change out of band. Cheap: an unchanged session 304s. */
  refresh: () => Promise<void>
}

export type UseKidSessionVerifyAge = VerifyAgeState & {
  /** Checks the session is a verified adult, minting a challenge when it is not. Idempotent; a no-op until the gate
   * passes. */
  start: () => void
  /** Sends the player the verification link. Re-callable to re-send to a corrected address. */
  submit: (email: string) => Promise<{ ok: boolean; error?: KidError }>
}

const BEFORE_SESSION: VerifyAgeState = {
  status: 'running',
  step: null,
  challengeId: null,
  rawChallengeStatus: null,
  expiresAt: null,
  error: null,
}
const noSubscription = () => () => {}

export function useSessionVerifyAgeController(): VerifyAgeController | null {
  useAgeGateState()
  return useAgeGateController().sessionVerifyAge()
}

function useSessionVerifyAge(): UseKidSessionVerifyAge {
  const controller = useSessionVerifyAgeController()
  const getState = () => controller?.getState() ?? BEFORE_SESSION
  const state = useSyncExternalStore(controller?.subscribe ?? noSubscription, getState, getState)
  return {
    ...state,
    start: () => controller?.start(),
    submit: (email) => {
      if (!controller) return Promise.resolve({ ok: false, error: localKidError('invalid_request') })
      controller.setEmail(email)
      return controller.submit()
    },
  }
}

export function useKidSession(): UseKidSession {
  const controller = useAgeGateController()
  const state = useAgeGateState()
  const verifyAge = useSessionVerifyAge()
  const permissions: Partial<Record<PermissionName, boolean>> = {}
  for (const p of state.session?.permissions ?? []) permissions[p.name] = p.enabled
  return {
    session: state.session,
    permissions,
    sessionId: state.sessionId,
    isLoaded: state.session !== null,
    ageVerification: state.session?.ageVerification ?? null,
    verifyAge,
    refresh: controller.refreshSession,
  }
}

export type UseKidPermission = {
  can: (name: PermissionName) => boolean
  get: (name: PermissionName) => Permission | null
}

/** Client permissions gate what a player SEES; enforce the real capability server-side. */
export function useKidPermission(): UseKidPermission {
  const state = useAgeGateState()
  const byName = new Map((state.session?.permissions ?? []).map((p) => [p.name, p]))
  return {
    can: (name) => byName.get(name)?.enabled ?? false,
    get: (name) => byName.get(name) ?? null,
  }
}

export type UseKidPermissionSettings = {
  /** Every permission on the session, with its `managedBy`, so a custom UI can branch per row. */
  permissions: Permission[]
  isLoaded: boolean
  /** Why the session failed to load, or null; show an error and call `refresh()` to retry. */
  error: KidError | null
  /** Change a player-managed permission (opt-in / opt-out). Guardian-managed and prohibited ones are rejected. */
  change: (name: PermissionName, enabled: boolean) => Promise<{ ok: boolean; error?: KidError }>
  /** Whether the session has an approver email. When false, collect one and pass it to `upgrade`. */
  hasApproverEmail: boolean
  /** Request grownup approval for one or more guardian-managed permissions in one request (one email). A permission
   * with a `verifiedAgeThreshold` needs the player's own age check instead: without an email this returns
   * `invalid_request` when that check is needed; call it again with the player's own email. */
  upgrade: (names: PermissionName[], approverEmail?: string) => Promise<{ ok: boolean; error?: KidError }>
  /** The in-flight ask, for a custom waiting view; `challengeKind` says whether it waits on the grownup or on the
   * player's own age check. */
  challenge: SettingsChallengeState
  refresh: () => Promise<void>
}

export function useKidPermissionSettings(): UseKidPermissionSettings {
  const controller = useSettingsController()
  const state = useSettingsState()
  return {
    permissions: state.session?.permissions ?? [],
    isLoaded: state.isLoaded,
    error: state.error,
    change: controller.change,
    hasApproverEmail: state.session?.hasApproverEmail !== false,
    upgrade: controller.upgrade,
    challenge: state.challenge,
    refresh: controller.refresh,
  }
}

export type UseKidChallenge = {
  challengeId: string | null
  status: RawChallengeStatus
  /** The challenge's deadline, or null when it has none. The flow moves to `fail` at this time. */
  expiresAt: string | null
}

export function useKidChallenge(): UseKidChallenge {
  const state = useAgeGateState()
  return {
    challengeId: state.challengeId,
    status: state.rawChallengeStatus,
    expiresAt: state.expiresAt,
  }
}
