import { type ReactNode, useEffect, useMemo, useRef } from 'react'

import { createSettingsController, type SettingsController } from '../core'
import { KidSettingsContext, useKidCoreContext } from './context'

export type KidSettingsProviderProps = {
  /** The established session to manage, from the age gate's persisted `onSession`. */
  sessionId: string
  /** Resume an in-flight settings challenge; persist it from `onChallenge` and pass it back. */
  challengeId?: string
  /** The settings challenge id OUT, for the integrator to persist and pass back (the SDK persists nothing). */
  onChallenge?: (challengeId: string) => void
  children: ReactNode
}

/** Post-session scope, symmetric with <KidSessionProvider>. Holds the settings controller: reads the
 * session's permissions and owns the grownup-ask sub-flow, so it survives <KidSettings> unmounting. */
export function KidSettingsProvider({ sessionId, challengeId, onChallenge, children }: KidSettingsProviderProps) {
  const { client, sessions, asks } = useKidCoreContext()

  // onChallenge can change identity per render; a ref keeps the controller stable across those.
  const onChallengeRef = useRef(onChallenge)
  onChallengeRef.current = onChallenge

  const controllerRef = useRef<SettingsController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = createSettingsController({
      client,
      sessions,
      asks,
      initial: { sessionId, challengeId },
      onChallenge: (id) => onChallengeRef.current?.(id),
    })
  }
  const controller = controllerRef.current

  useEffect(() => {
    controller.start()
    return () => controller.destroy()
  }, [controller])

  const value = useMemo(() => ({ controller }), [controller])
  return <KidSettingsContext.Provider value={value}>{children}</KidSettingsContext.Provider>
}
