import type { ChallengeStatus, Client } from '../client';
export type ChallengeWatchOptions = {
    client: Client;
    /** Handles one status; resolves false once the challenge needs no more watching. */
    onStatus: (status: ChallengeStatus) => Promise<boolean>;
    /** Streaming is unavailable for this challenge, so the caller polls it instead. */
    onFallback: () => void;
    now?: () => number;
    reconnectBaseMs?: number;
};
export interface ChallengeWatch {
    /** Streams the challenge's status. Returns false once it has fallen back to polling, which the caller then runs. */
    start(challengeId: string): boolean;
    stop(): void;
    readonly active: boolean;
}
/** Watches a challenge's status over the server's event stream, reconnecting as needed, and falls back to polling
 * when streaming is unavailable (404) or fails to open twice in a row. */
export declare function createChallengeWatch(options: ChallengeWatchOptions): ChallengeWatch;
//# sourceMappingURL=challengeStream.d.ts.map