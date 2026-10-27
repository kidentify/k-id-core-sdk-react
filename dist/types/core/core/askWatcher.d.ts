import type { PermissionName } from '../catalog/permissions';
import type { Client } from '../client';
import type { SessionStore } from './sessionStore';
import type { ChallengeKind } from './types';
/** A grownup ask that was emailed and is waiting on an answer; `error` once it failed or expired. */
export type PendingAsk = {
    status: 'pending' | 'error';
    challengeId: string;
    permissions: PermissionName[];
    challengeKind: ChallengeKind | null;
};
/** The kind of a settings challenge, from its server type; null while the type is unknown. */
export declare function settingsChallengeKindOf(type: string | undefined): ChallengeKind | null;
export type AskWatcherOptions = {
    client: Client;
    sessions?: SessionStore;
    pollIntervalMs?: number;
    now?: () => number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void;
};
/** Watches each session's pending grownup ask until it is answered, so a grant reaches the session store whether or
 * not a settings screen is mounted. */
export interface AskWatcher {
    get(sessionId: string): PendingAsk | null;
    subscribe(listener: () => void): () => void;
    /** Watches `challengeId`, replacing the session's earlier ask; without a stream it polls after `delay` ms (one
     * poll interval by default). */
    watch(sessionId: string, challengeId: string, permissions: PermissionName[], delay?: number, challengeKind?: ChallengeKind | null): void;
    clear(sessionId: string): void;
    /** While attached, a granted ask is re-read through `reread`, so a mounted settings screen keeps its own read.
     * `reread` resolves false when the read failed, to be retried. */
    attach(sessionId: string, reread: () => Promise<boolean>): () => void;
    start(): void;
    stop(): void;
}
export declare function createAskWatcher(options: AskWatcherOptions): AskWatcher;
//# sourceMappingURL=askWatcher.d.ts.map