import type { PermissionName } from '../catalog/permissions';
import { KidError, type Client, type Permission, type Session } from '../client';
import { type AskWatcher } from './askWatcher';
import type { SessionStore } from './sessionStore';
import type { ChallengeKind } from './types';
/** The grownup-ask sub-flow: mint one settings challenge for a batch of permissions, email the grownup, poll
 * to completion. `sending` = minting/emailing; `pending` = polling; `error` = the ask failed (re-askable). */
export type SettingsChallengeStatus = 'idle' | 'sending' | 'pending' | 'error';
export type SettingsChallengeState = {
    status: SettingsChallengeStatus;
    /** The permissions in the current ask, so a UI can mark those rows as waiting. */
    permissions: PermissionName[];
    challengeId: string | null;
    /** What the challenge asks for: a grownup's approval, or the player's own age check. Null until known. */
    challengeKind: ChallengeKind | null;
};
export type SettingsState = {
    session: Session | null;
    isLoaded: boolean;
    /** Why the session failed to load: a k-ID API error as is, and any other failure as `unavailable`. A UI shows an
     * error and offers `refresh()` to retry. */
    error: KidError | null;
    challenge: SettingsChallengeState;
};
export type SettingsInputs = {
    sessionId: string;
    /** Resume an in-flight settings challenge; persist it from `onChallenge` and pass it back. */
    challengeId?: string;
};
export type SettingsOptions = {
    client: Client;
    initial: SettingsInputs;
    onChallenge?: (challengeId: string) => void;
    sessions?: SessionStore;
    /** The app-wide watcher that keeps polling an ask after this controller is destroyed; without one, the
     * controller polls its own asks only while started. */
    asks?: AskWatcher;
    pollIntervalMs?: number;
    now?: () => number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void;
};
export interface SettingsController {
    getState(): SettingsState;
    subscribe(listener: () => void): () => void;
    /** Load the session (and resume a pending settings-challenge poll). Idempotent; call once after mount. */
    start(): void;
    /** Enable or disable a player-managed permission (opt-in / opt-out). */
    change(name: PermissionName, enabled: boolean): Promise<{
        ok: boolean;
        error?: KidError;
    }>;
    /** Request grownup approval for one or more guardian-managed permissions in a single request: mint one
     * settings challenge, email the grownup, then poll to completion. Pass `approverEmail` when the session has
     * none (`session.hasApproverEmail === false`); omit it to email the linked one.
     *
     * A permission with a `verifiedAgeThreshold` needs the player's own age check instead. Without an email this
     * returns `invalid_request` when that check is needed; call it again with the player's own email. */
    upgrade(names: PermissionName[], approverEmail?: string): Promise<{
        ok: boolean;
        error?: KidError;
    }>;
    /** Re-read the session (permissions change out of band). */
    refresh(): Promise<void>;
    destroy(): void;
}
export declare function createSettingsController(options: SettingsOptions): SettingsController;
export type { Permission };
//# sourceMappingURL=settings.d.ts.map