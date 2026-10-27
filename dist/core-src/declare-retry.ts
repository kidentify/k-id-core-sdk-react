import { KidError } from './client'

export const MAX_DECLARE_ATTEMPTS = 4

const BASE_DELAY_MS = 250
const MAX_DELAY_MS = 2000

// `unavailable` covers both transport failures and the config-not-served-yet signal declare returns while a
// written config propagates; a definitive failure (bad key/permission) is not retried.
const RETRYABLE_CODES = new Set(['unavailable', 'rate_limited'])

export function isRetryableDeclareError(error: unknown): boolean {
  return error instanceof KidError && RETRYABLE_CODES.has(error.code)
}

export function declareRetryDelayMs(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS)
}

export function isLiveKey(publishableKey: string): boolean {
  return publishableKey.startsWith('kgp_live_')
}
