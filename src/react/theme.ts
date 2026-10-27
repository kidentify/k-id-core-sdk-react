import type { CSSProperties } from 'react'

import type { Appearance, AppearanceVariables } from '@kid/core-sdk-js'

const DEFAULT_VARIABLES: AppearanceVariables = {
  colorPrimary: '#4f46e5',
  colorOnPrimary: '#ffffff',
  colorText: '#111827',
  colorTextMuted: '#6b7280',
  colorSurface: '#ffffff',
  colorSurfaceMuted: '#f3f4f6',
  colorBorder: '#e5e7eb',
  colorDanger: '#dc2626',
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  radius: '12px',
}

const VAR_NAMES: Record<keyof AppearanceVariables, string> = {
  colorPrimary: '--kid-color-primary',
  colorOnPrimary: '--kid-color-on-primary',
  colorText: '--kid-color-text',
  colorTextMuted: '--kid-color-text-muted',
  colorSurface: '--kid-color-surface',
  colorSurfaceMuted: '--kid-color-surface-muted',
  colorBorder: '--kid-color-border',
  colorDanger: '--kid-color-danger',
  fontFamily: '--kid-font-family',
  radius: '--kid-radius',
}

export function appearanceToCssVars(appearance?: Appearance): CSSProperties {
  const merged = { ...DEFAULT_VARIABLES, ...appearance?.variables }
  const vars: Record<string, string> = {}
  for (const key of Object.keys(VAR_NAMES) as (keyof AppearanceVariables)[]) {
    vars[VAR_NAMES[key]] = String(merged[key])
  }
  return vars as CSSProperties
}
