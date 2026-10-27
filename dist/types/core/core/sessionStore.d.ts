import type { Session } from '../client';
/** The latest copy of each session, shared by every controller on one client, so a permission changed through
 * settings reaches the permission gate on the same session. */
export interface SessionStore {
    publish(session: Session): void;
    current(sessionId: string): Session | null;
    subscribe(listener: (session: Session) => void): () => void;
}
export declare function createSessionStore(): SessionStore;
//# sourceMappingURL=sessionStore.d.ts.map