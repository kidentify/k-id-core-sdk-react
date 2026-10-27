import { type Client, type KidError, type Session } from '../client';
import type { KidStatus, RawChallengeStatus } from './types';
export type VerifyAgeStep = 'checking' | 'email' | null;
export type VerifyAgeState = {
    status: Extract<KidStatus, 'running' | 'pending' | 'pass' | 'fail' | 'error'>;
    step: VerifyAgeStep;
    challengeId: string | null;
    rawChallengeStatus: RawChallengeStatus;
    /** The challenge's deadline, or null when it has none. The flow moves to `fail` at this time. */
    expiresAt: string | null;
    /** Why the check ended in `status === 'error'`: a k-ID API error as is, and any other failure as `unavailable`. */
    error: KidError | null;
};
export type VerifyAgeOptions = {
    client: Client;
    sessionId: string;
    /** The civil age of the session's jurisdiction, which the re-read session must prove before the flow passes. */
    civilAge: () => Promise<number | undefined>;
    /** Receives the session re-read once k-ID reports a pass. */
    onSession?: (session: Session) => void;
    pollIntervalMs?: number;
    now?: () => number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void;
};
export interface VerifyAgeController {
    getState(): VerifyAgeState;
    subscribe(listener: () => void): () => void;
    start(): void;
    setEmail(email: string): void;
    submit(): Promise<{
        ok: boolean;
        error?: KidError;
    }>;
    destroy(): void;
}
export declare function createVerifyAgeController(options: VerifyAgeOptions): VerifyAgeController;
//# sourceMappingURL=verifyAge.d.ts.map