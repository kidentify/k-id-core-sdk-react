import { type AgeSignal, type Client, type KidError, type PlatformAgeSignal } from '../client';
import type { SessionStore } from './sessionStore';
import type { AgeGateState } from './types';
import { type VerifyAgeController } from './verifyAge';
export type AgeGateInputs = {
    jurisdiction?: string;
    age?: AgeSignal;
    email?: string;
    challengeId?: string;
    sessionId?: string;
};
export type AgeGateOptions = {
    client: Client;
    initial?: AgeGateInputs;
    /** Asks the device's platform for the player's age range, which stands in for the age gate when it is shared. */
    platformAgeSignal?: (ageGates: number[]) => Promise<PlatformAgeSignal | null>;
    sessions?: SessionStore;
    pollIntervalMs?: number;
    now?: () => number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void;
};
export interface AgeGateController {
    getState(): AgeGateState;
    subscribe(listener: () => void): () => void;
    /** Kick off network work (auto-check, or resume). Idempotent; call once after mount. No request is sent
     * before it, so inputs pushed earlier wait for it. */
    start(): void;
    /** Push the declarative props from KidSessionProvider. Locked age/jurisdiction changes are ignored. */
    configure(inputs: Pick<AgeGateInputs, 'jurisdiction' | 'age' | 'email'>): void;
    /** Collected by <KidSelectJurisdiction>. */
    setJurisdiction(code: string): void;
    /** Collected by <KidCollectAge>. */
    setAge(signal: AgeSignal): void;
    /** Collected by <KidAskAnAdult>. */
    setEmail(email: string): void;
    /** Send the challenge email. Valid only after a challenge exists; re-callable to re-send a correction. */
    submit(): Promise<{
        ok: boolean;
        error?: KidError;
    }>;
    /** Re-read the session (permissions change out of band). */
    refreshSession(): Promise<void>;
    /** The integration config could not be declared: surface `error`. */
    declarationFailed(error: unknown): void;
    /** Verifies the player is an adult on the established session; null until the gate passes. Nothing is sent until
     * its `start()`. */
    sessionVerifyAge(): VerifyAgeController | null;
    destroy(): void;
}
/** The challenge id safe to resume from: only once its email is sent. */
export declare function resumableChallengeId(state: AgeGateState): string | null;
export declare function createAgeGateController(options: AgeGateOptions): AgeGateController;
//# sourceMappingURL=ageGate.d.ts.map