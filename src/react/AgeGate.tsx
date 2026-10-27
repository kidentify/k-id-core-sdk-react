import type { ReactNode } from 'react'

import { KidAskAnAdult, KidCollectAge, KidSelectJurisdiction, KidVerifyAge } from './components'
import { collectSlots, useAgeGateState } from '@kid/core-sdk-js/react'

/** Compound slots. Each just renders its children; <KidAgeGate> picks the one matching the status. */
export function KidAgeGatePending({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
export function KidAgeGateProhibited({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
export function KidAgeGateFail({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
export function KidAgeGatePass({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
export function KidAgeGateError({ children }: { children?: ReactNode }) {
  return <>{children}</>
}

const Capture = () => (
  <>
    <KidSelectJurisdiction />
    <KidCollectAge />
    <KidAskAnAdult />
    <KidVerifyAge />
  </>
)

export function KidAgeGate({ children }: { children?: ReactNode }) {
  const { status } = useAgeGateState()
  const slots = collectSlots(children, {
    pending: KidAgeGatePending,
    prohibited: KidAgeGateProhibited,
    fail: KidAgeGateFail,
    pass: KidAgeGatePass,
    error: KidAgeGateError,
  })

  switch (status) {
    case 'running':
      return <Capture />
    case 'pending':
      return <>{slots.pending ?? null}</>
    case 'prohibited':
      return <>{slots.prohibited ?? null}</>
    case 'fail':
      return <>{slots.fail ?? null}</>
    case 'pass':
      return <>{slots.pass ?? null}</>
    case 'error':
      return <>{slots.error ?? null}</>
  }
}
