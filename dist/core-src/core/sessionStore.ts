import type { Session } from '../client'

/** The latest copy of each session, shared by every controller on one client, so a permission changed through
 * settings reaches the permission gate on the same session. */
export interface SessionStore {
  publish(session: Session): void
  current(sessionId: string): Session | null
  subscribe(listener: (session: Session) => void): () => void
}

export function createSessionStore(): SessionStore {
  const latest = new Map<string, Session>()
  const listeners = new Set<(session: Session) => void>()
  return {
    publish(session) {
      if (latest.get(session.sessionId) === session) return
      latest.set(session.sessionId, session)
      for (const l of listeners) l(session)
    },
    current: (sessionId) => latest.get(sessionId) ?? null,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
