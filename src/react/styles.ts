import type { CSSProperties } from 'react'

import type { Appearance, ElementName } from '@kid/core-sdk-js'
import { useKidCoreContext } from '@kid/core-sdk-js/react'

// @layer plus injecting at the top of <head> (see injectStyles) keeps these defaults below unlayered consumer
// CSS and below layers the page declares later (e.g. Tailwind utilities), so an override wins without !important.
const STYLESHEET = `@layer kid{
.kid-card{display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box;padding:20px;color:var(--kid-color-text);background:var(--kid-color-surface);border:1px solid var(--kid-color-border);border-radius:var(--kid-radius);font-family:var(--kid-font-family);accent-color:var(--kid-color-primary)}
.kid-title{font-size:16px;font-weight:600;margin:0}
.kid-label{font-size:14px;font-weight:600}
.kid-input{padding:10px 12px;border:1px solid var(--kid-color-border);border-radius:calc(var(--kid-radius) / 2);font:inherit}
.kid-button{padding:10px 14px;border:none;border-radius:calc(var(--kid-radius) / 2);background:var(--kid-color-primary);color:var(--kid-color-on-primary);font:inherit;font-weight:600;cursor:pointer}
.kid-muted{color:var(--kid-color-text-muted);font-size:14px;margin:0}
.kid-danger{color:var(--kid-color-danger);font-size:14px;margin:0}
.kid-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.kid-askForm{display:flex;flex-direction:column;gap:12px}
.kid-controlColumn{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.kid-pill{padding:4px 12px;border-radius:999px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.kid-pillAsk{border:1px solid var(--kid-color-border);background:transparent;color:var(--kid-color-text)}
.kid-pillAdded{border:1px solid var(--kid-color-primary);background:var(--kid-color-primary);color:var(--kid-color-on-primary)}
}`

export { STYLESHEET }

const STYLE_ID = 'kid-core-styles'
let injected = false

export function injectStyles(): void {
  if (injected || typeof document === 'undefined') return
  injected = true
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLESHEET
  document.head.prepend(style)
}

export type ElementProps = { className: string; style?: CSSProperties; dir?: 'rtl' | 'ltr' }

export function elementProps(appearance: Appearance | undefined, ...keys: ElementName[]): ElementProps {
  const classes: string[] = []
  let style: CSSProperties | undefined
  for (const key of keys) {
    classes.push(`kid-${key}`)
    const override = appearance?.elements?.[key]
    if (typeof override === 'string') classes.push(override)
    else if (override) style = { ...style, ...override }
  }
  return style ? { className: classes.join(' '), style } : { className: classes.join(' ') }
}

export function useEl(): (...keys: ElementName[]) => ElementProps {
  const { appearance, dir } = useKidCoreContext()
  return (...keys: ElementName[]) =>
    dir ? { ...elementProps(appearance, ...keys), dir } : elementProps(appearance, ...keys)
}
