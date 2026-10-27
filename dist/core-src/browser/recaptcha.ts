import type { BotCheckHint, BotCheckProvider } from '../botCheck'

const RECAPTCHA_SCRIPT = 'https://www.google.com/recaptcha/enterprise.js?render='

/** A check that never answers is given up on, so a mint is never stuck behind it. */
const CHECK_TIMEOUT_MS = 30_000

interface RecaptchaEnterprise {
  ready(callback: () => void): void
  execute(siteKey: string, options: { action: string }): Promise<string>
}

type VendorGlobals = typeof globalThis & {
  grecaptcha?: { enterprise?: RecaptchaEnterprise }
}

const vendorGlobals = globalThis as VendorGlobals

interface ScriptLoad {
  element: HTMLScriptElement
  done: Promise<void>
  loaded: boolean
}

const scripts = new Map<string, ScriptLoad>()

function loadScript(src: string): ScriptLoad {
  const cached = scripts.get(src)
  if (cached) return cached
  const element = document.createElement('script')
  element.src = src
  element.async = true
  const load: ScriptLoad = {
    element,
    loaded: false,
    done: new Promise<void>((resolve, reject) => {
      element.onload = () => {
        load.loaded = true
        resolve()
      }
      element.onerror = () => {
        forgetScript(src, load)
        reject(new Error(`Could not load ${src}`))
      }
    }),
  }
  scripts.set(src, load)
  document.head.appendChild(element)
  return load
}

// A load that stalled is dropped, so the next attempt fetches the script again instead of waiting on it forever.
function forgetScript(src: string, load: ScriptLoad) {
  if (scripts.get(src) === load) scripts.delete(src)
  load.element.remove()
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Bot check timed out')), CHECK_TIMEOUT_MS)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

async function recaptchaToken(hint: BotCheckHint): Promise<string> {
  const src = RECAPTCHA_SCRIPT + encodeURIComponent(hint.siteKey)
  const script = loadScript(src)
  let abandoned = false
  try {
    return await withTimeout(
      script.done.then(() => {
        if (abandoned) throw new Error('Bot check abandoned')
        const enterprise = vendorGlobals.grecaptcha?.enterprise
        if (!enterprise) throw new Error('reCAPTCHA Enterprise did not load')
        return new Promise<string>((resolve, reject) => {
          enterprise.ready(() => {
            enterprise.execute(hint.siteKey, { action: hint.action ?? '' }).then(resolve, reject)
          })
        })
      }),
    )
  } catch (err) {
    if (!script.loaded) forgetScript(src, script)
    throw err
  } finally {
    abandoned = true
  }
}

export const scriptBotCheck: BotCheckProvider = {
  async token(hint) {
    if (typeof document === 'undefined') throw new Error('A bot check needs a page')
    return recaptchaToken(hint)
  },
}
