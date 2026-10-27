import type { ChallengeStatus, Client } from '../client'

const MAX_FAILED_OPENS = 2
const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 30000
// A stream the server ends sooner than this reconnects with backoff, so a challenge the server already counts as
// expired can't spin while this device's clock still says it is live.
const MIN_HEALTHY_STREAM_MS = 1000

export type ChallengeWatchOptions = {
  client: Client
  /** Handles one status; resolves false once the challenge needs no more watching. */
  onStatus: (status: ChallengeStatus) => Promise<boolean>
  /** Streaming is unavailable for this challenge, so the caller polls it instead. */
  onFallback: () => void
  now?: () => number
  reconnectBaseMs?: number
}

export interface ChallengeWatch {
  /** Streams the challenge's status. Returns false once it has fallen back to polling, which the caller then runs. */
  start(challengeId: string): boolean
  stop(): void
  readonly active: boolean
}

/** Watches a challenge's status over the server's event stream, reconnecting as needed, and falls back to polling
 * when streaming is unavailable (404) or fails to open twice in a row. */
export function createChallengeWatch(options: ChallengeWatchOptions): ChallengeWatch {
  const now = options.now ?? (() => Date.now())
  const base = options.reconnectBaseMs ?? RECONNECT_BASE_MS

  let challengeId: string | null = null
  let fellBack = false
  // One per start(); aborting it ends every open of that watch.
  let watch: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let failedOpens = 0
  let backoff = base
  let handled: Promise<unknown> = Promise.resolve()

  function stop() {
    watch?.abort()
    watch = null
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function retry(current: AbortController, delay: number) {
    timer = setTimeout(() => {
      timer = null
      if (watch === current) open(current)
    }, delay)
  }

  function retryWithBackoff(current: AbortController) {
    retry(current, backoff)
    backoff = Math.min(backoff * 2, RECONNECT_MAX_MS)
  }

  function open(current: AbortController) {
    const id = challengeId
    if (!id) return
    const openedAt = now()
    let snapshot = false
    options.client
      .challengeStream(
        id,
        (status) => {
          snapshot = true
          handled = handled.then(async () => {
            if (watch !== current) return
            let keepWatching = true
            try {
              keepWatching = await options.onStatus(status)
            } catch (e) {
              // The stream re-sends the status on reconnect, so a failed handling is retried then.
              console.error('[k-ID] could not handle a challenge status; will retry', e)
            }
            if (!keepWatching && watch === current) stop()
          })
        },
        current.signal,
      )
      .then(async (end) => {
        await handled
        if (watch !== current) return
        // A proxy can pass the headers and hold or drop the body, so an open only counts once a status arrives.
        if (!snapshot) return failOpen(current)
        failedOpens = 0
        if (end.closed && now() - openedAt >= MIN_HEALTHY_STREAM_MS) {
          backoff = base
          retry(current, end.retryMs ?? 0)
          return
        }
        retryWithBackoff(current)
      })
      .catch((e: unknown) => {
        if (watch !== current) return
        failOpen(current, (e as { code?: string }).code === 'not_found')
      })
  }

  function failOpen(current: AbortController, unavailable = false) {
    failedOpens += 1
    if (unavailable || failedOpens >= MAX_FAILED_OPENS) {
      stop()
      fellBack = true
      options.onFallback()
      return
    }
    retryWithBackoff(current)
  }

  return {
    start(id) {
      if (id !== challengeId) {
        stop()
        challengeId = id
        fellBack = false
        failedOpens = 0
        backoff = base
      }
      if (fellBack) return false
      if (watch) return true
      watch = new AbortController()
      open(watch)
      return true
    },
    stop,
    get active() {
      return watch !== null
    },
  }
}
