import { en } from './localization/en'
import type { KidLocalization, KidPermissionStrings, KidStrings } from './localization/types'

export type { KidLocalization, KidPermissionStrings, KidStrings }

export const DEFAULT_STRINGS: KidStrings = en

export function mergeStrings(overrides?: KidLocalization): KidStrings {
  if (!overrides) return DEFAULT_STRINGS
  return {
    jurisdiction: { ...DEFAULT_STRINGS.jurisdiction, ...overrides.jurisdiction },
    age: { ...DEFAULT_STRINGS.age, ...overrides.age },
    askAnAdult: { ...DEFAULT_STRINGS.askAnAdult, ...overrides.askAnAdult },
    verifyAge: { ...DEFAULT_STRINGS.verifyAge, ...overrides.verifyAge },
    settings: { ...DEFAULT_STRINGS.settings, ...overrides.settings },
    subdivisions: { ...DEFAULT_STRINGS.subdivisions, ...overrides.subdivisions },
    permissions: mergePermissions(overrides.permissions),
  }
}

function mergePermissions(overrides: KidLocalization['permissions']): KidStrings['permissions'] {
  const merged = { ...DEFAULT_STRINGS.permissions }
  for (const [name, copy] of Object.entries(overrides ?? {})) {
    merged[name] = { ...(merged[name] ?? { name }), ...copy }
  }
  return merged
}

const RTL_LANGUAGES = ['ar', 'fa', 'he', 'ur']

export function textDirection(locale?: string): 'rtl' | 'ltr' | undefined {
  if (!locale) return undefined
  const language = locale.split(/[-_]/)[0]?.toLowerCase() ?? ''
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr'
}

/** Fill `{token}` placeholders from `vars`; an absent token is left verbatim. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole))
}
