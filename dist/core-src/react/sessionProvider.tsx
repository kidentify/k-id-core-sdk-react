import { type ReactNode, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'

import type { JurisdictionCode } from '../catalog/jurisdictions'
import { createAgeGateController, resumableChallengeId, type AgeGateController } from '../core'
import type { AgeSignal } from '../core/types'
import { KidSessionContext, useKidCoreContext } from './context'

export type KidSessionProviderProps = {
  /**
   * ISO 3166-1 alpha-2 country or ISO 3166-2 subdivision code, or `"auto"` to resolve it from the client IP
   * server-side (falls back to the in-widget picker when it can't be resolved). Omit to show the picker.
   */
  jurisdiction?: 'auto' | JurisdictionCode | (string & {})
  age?: AgeSignal
  email?: string
  /** Resume an in-flight flow; persist these from `onChallenge`/`onSession` and pass them back. */
  challengeId?: string
  sessionId?: string
  onChallenge?: (challengeId: string) => void
  onSession?: (sessionId: string) => void
  /**
   * Fires once the age check has a result, pass or pending, with a one-time token for your backend. Not fired on resume
   * or when the player is prohibited.
   */
  onClaim?: (claimToken: string) => void
  children: ReactNode
}

export function KidSessionProvider({
  jurisdiction,
  age,
  email,
  challengeId,
  sessionId,
  onChallenge,
  onSession,
  onClaim,
  children,
}: KidSessionProviderProps) {
  const { client, sessions, declarationStatus, declarationError } = useKidCoreContext()
  const controllerRef = useRef<AgeGateController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = createAgeGateController({
      client,
      sessions,
      initial: { jurisdiction, age, email, challengeId, sessionId },
    })
  }
  const controller = controllerRef.current

  // The flow reads the TEST config declare writes, so it holds its requests until declare lands.
  useEffect(() => {
    if (declarationStatus === 'error') {
      controller.declarationFailed(declarationError)
      return
    }
    if (declarationStatus !== 'ready') return
    controller.start()
    return () => controller.destroy()
  }, [controller, declarationStatus, declarationError])

  // The declarative inputs can change after mount; resume ids (challengeId/sessionId) are fixed at creation.
  const ageKey = JSON.stringify(age ?? null)
  useEffect(() => {
    controller.configure({ jurisdiction, age, email })
    // age is compared by value via ageKey; depending on the object identity would loop every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, jurisdiction, ageKey, email])

  const outChallengeId = useSyncExternalStore(
    controller.subscribe,
    () => resumableChallengeId(controller.getState()),
    () => resumableChallengeId(controller.getState()),
  )
  const outSessionId = useSyncExternalStore(
    controller.subscribe,
    () => controller.getState().sessionId,
    () => controller.getState().sessionId,
  )

  const firedChallenge = useRef<string | null>(null)
  useEffect(() => {
    if (outChallengeId && outChallengeId !== firedChallenge.current) {
      firedChallenge.current = outChallengeId
      onChallenge?.(outChallengeId)
    }
  }, [outChallengeId, onChallenge])

  const firedSession = useRef<string | null>(null)
  useEffect(() => {
    if (outSessionId && outSessionId !== firedSession.current) {
      firedSession.current = outSessionId
      onSession?.(outSessionId)
    }
  }, [outSessionId, onSession])

  const outClaimToken = useSyncExternalStore(
    controller.subscribe,
    () => controller.getState().claimToken,
    () => controller.getState().claimToken,
  )

  const firedClaim = useRef<string | null>(null)
  useEffect(() => {
    if (outClaimToken && outClaimToken !== firedClaim.current) {
      firedClaim.current = outClaimToken
      onClaim?.(outClaimToken)
    }
  }, [outClaimToken, onClaim])

  const value = useMemo(() => ({ controller }), [controller])
  return <KidSessionContext.Provider value={value}>{children}</KidSessionContext.Provider>
}
