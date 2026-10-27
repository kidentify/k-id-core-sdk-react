export type SseEvent = { event: string; data: string }

export interface SseParser {
  /** Feed decoded text; complete events are dispatched as their terminating blank line arrives. */
  push(chunk: string): void
  /** The server's last `retry:` hint, in ms. */
  readonly retryMs: number | undefined
}

/** A server-sent events parser (the WHATWG event-stream format), for streams `EventSource` can't open because it
 * can't send headers. */
export function createSseParser(onEvent: (event: SseEvent) => void): SseParser {
  let buffer = ''
  let event = ''
  let data: string[] = []
  let retryMs: number | undefined

  function line(text: string) {
    if (text === '') {
      if (data.length > 0) onEvent({ event: event || 'message', data: data.join('\n') })
      event = ''
      data = []
      return
    }
    if (text.startsWith(':')) return
    const colon = text.indexOf(':')
    const field = colon < 0 ? text : text.slice(0, colon)
    let value = colon < 0 ? '' : text.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
    else if (field === 'retry' && /^\d+$/.test(value)) retryMs = Number(value)
  }

  return {
    push(chunk) {
      buffer += chunk
      let start = 0
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer[i]
        if (c !== '\n' && c !== '\r') continue
        // A trailing CR may be the first half of a CRLF split across chunks.
        if (c === '\r' && i === buffer.length - 1) break
        line(buffer.slice(start, i))
        if (c === '\r' && buffer[i + 1] === '\n') i++
        start = i + 1
      }
      buffer = buffer.slice(start)
    },
    get retryMs() {
      return retryMs
    },
  }
}
