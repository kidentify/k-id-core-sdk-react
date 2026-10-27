import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import {
  createAskWatcher,
  createClient,
  createSessionStore,
  declareRetryDelayMs,
  isLiveKey,
  isRetryableDeclareError,
  MAX_DECLARE_ATTEMPTS,
  mergeStrings,
  textDirection,
  type AskWatcher,
  type Client,
  type DeclareInput,
  type KidLocalization,
  type SessionStore,
  type Appearance,
} from '@kid/core-sdk-js'
import { pageBaseURI, scriptBotCheck, webCryptoKeyProvider } from '@kid/core-sdk-js/browser'
import { type DeclarationStatus, KidCoreContext } from '@kid/core-sdk-js/react'
import { injectStyles } from './styles'
import { appearanceToCssVars } from './theme'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** The integration config, read once at mount; later prop changes are ignored. Applied only while you use a test key. */
export type KidDeclare = DeclareInput

export type KidCoreProviderProps = {
  publishableKey: string
  /** The k-ID API URL Kai shows for your key. The same-origin default only works on pages k-ID serves. */
  baseUrl?: string
  appearance?: Appearance
  /** Partial widget-copy overrides (wording or a locale's strings), merged over the English defaults. */
  localization?: KidLocalization
  declare?: KidDeclare
  children: ReactNode
}

export function KidCoreProvider({
  publishableKey,
  baseUrl,
  appearance,
  localization,
  declare,
  children,
}: KidCoreProviderProps) {
  const strings = useMemo(() => mergeStrings(localization), [localization])
  const locale = localization?.locale
  const dir = textDirection(locale)

  useEffect(() => injectStyles(), [])

  const clientRef = useRef<Client | null>(null)
  if (!clientRef.current)
    clientRef.current = createClient({
      publishableKey,
      baseUrl,
      deviceKeys: webCryptoKeyProvider,
      botCheck: scriptBotCheck,
      baseURI: pageBaseURI,
    })
  const client = clientRef.current
  const sessionsRef = useRef<SessionStore | null>(null)
  if (!sessionsRef.current) sessionsRef.current = createSessionStore()
  const sessions = sessionsRef.current
  const asksRef = useRef<AskWatcher | null>(null)
  if (!asksRef.current) asksRef.current = createAskWatcher({ client, sessions })
  const asks = asksRef.current

  useEffect(() => {
    asks.start()
    return () => asks.stop()
  }, [asks])

  // The flow reads the TEST config declare writes, so it is gated on this readiness.
  // A live key's declare is a server no-op, so live page loads skip the round-trip.
  const declared = isLiveKey(publishableKey) ? undefined : declare
  const [declarationStatus, setDeclarationStatus] = useState<DeclarationStatus>(declared ? 'pending' : 'ready')
  const [declarationError, setDeclarationError] = useState<unknown>()

  const started = useRef(false)
  useEffect(() => {
    if (!declared || started.current) return
    started.current = true

    // Declare is idempotent server-side, so retrying a transient failure is safe (it noops if the config
    // already landed). This retries on failure; it is not a readiness poll loop.
    void (async () => {
      for (let attempt = 1; ; attempt++) {
        try {
          await client.declare(declared)
          setDeclarationStatus('ready')
          return
        } catch (e: unknown) {
          if (attempt >= MAX_DECLARE_ATTEMPTS || !isRetryableDeclareError(e)) {
            console.error('[k-ID] declare failed', e)
            setDeclarationError(e)
            setDeclarationStatus('error')
            return
          }
          await sleep(declareRetryDelayMs(attempt))
        }
      }
    })()
  }, [client, declared])

  const value = useMemo(
    () => ({ client, sessions, asks, appearance, strings, locale, dir, declarationStatus, declarationError }),
    [client, sessions, asks, appearance, strings, locale, dir, declarationStatus, declarationError],
  )

  return (
    <KidCoreContext.Provider value={value}>
      <div style={{ display: 'contents', ...appearanceToCssVars(appearance) }}>{children}</div>
    </KidCoreContext.Provider>
  )
}
