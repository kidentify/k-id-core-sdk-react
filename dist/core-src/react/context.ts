import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'

import type { Client } from '../client'
import type { AgeGateController, AskWatcher, SessionStore, SettingsController, SettingsState } from '../core'
import type { Appearance, AgeGateState } from '../core/types'
import { type JurisdictionOption, localizeJurisdictions } from '../jurisdictions'
import type { KidStrings } from '../strings'

export type DeclarationStatus = 'ready' | 'pending' | 'error'

export type KidCoreContextValue = {
  client: Client
  sessions: SessionStore
  asks: AskWatcher
  appearance?: Appearance
  strings: KidStrings
  locale?: string
  dir?: 'rtl' | 'ltr'
  declarationStatus: DeclarationStatus
  /** Why declare failed, with `declarationStatus: 'error'`. */
  declarationError?: unknown
}

export const KidCoreContext = createContext<KidCoreContextValue | null>(null)

export function useKidCoreContext(): KidCoreContextValue {
  const ctx = useContext(KidCoreContext)
  if (!ctx) throw new Error('Wrap your app in <KidCoreProvider> before using k-ID hooks or components.')
  return ctx
}

/** The merged widget copy (English defaults with the `localization` overrides applied). */
export function useKidStrings(): KidStrings {
  return useKidCoreContext().strings
}

export function useKidJurisdictions(): JurisdictionOption[] {
  const { strings, locale } = useKidCoreContext()
  return useMemo(() => localizeJurisdictions(strings, locale), [strings, locale])
}

export type KidSessionContextValue = {
  controller: AgeGateController
}

export const KidSessionContext = createContext<KidSessionContextValue | null>(null)

export function useAgeGateController(): AgeGateController {
  const ctx = useContext(KidSessionContext)
  if (!ctx) throw new Error('Wrap the flow in <KidSessionProvider> before using k-ID hooks or components.')
  return ctx.controller
}

export function useAgeGateState(): AgeGateState {
  const controller = useAgeGateController()
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
}

export type KidSettingsContextValue = {
  controller: SettingsController
}

export const KidSettingsContext = createContext<KidSettingsContextValue | null>(null)

export function useSettingsController(): SettingsController {
  const ctx = useContext(KidSettingsContext)
  if (!ctx) throw new Error('Wrap the settings surface in <KidSettingsProvider> before using its hooks or components.')
  return ctx.controller
}

export function useSettingsState(): SettingsState {
  const controller = useSettingsController()
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState)
}
