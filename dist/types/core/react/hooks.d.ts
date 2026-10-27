import { type AgeVerification, type KidError } from '../client';
import type { SettingsChallengeState, VerifyAgeController, VerifyAgeState } from '../core';
import type { ChallengeKind, KidStatus, Permission, PermissionName, RawChallengeStatus, Requirements, Session } from '../core/types';
export type UseKidAgeGate = {
    status: KidStatus;
    challengeId: string | null;
    challengeKind: ChallengeKind | null;
    sessionId: string | null;
    /** Why the gate ended in `status: 'error'`: a k-ID API error as is, and any other failure as `unavailable`. */
    error: KidError | null;
    requirements: Requirements | null;
    /** Send the challenge email. Valid only after a challenge exists; re-callable to re-send a correction. */
    submit: () => Promise<{
        ok: boolean;
        error?: KidError;
    }>;
};
export declare function useKidAgeGate(): UseKidAgeGate;
export type UseKidSession = {
    session: Session | null;
    permissions: Partial<Record<PermissionName, boolean>>;
    sessionId: string | null;
    isLoaded: boolean;
    ageVerification: AgeVerification | null;
    verifyAge: UseKidSessionVerifyAge;
    /** Re-read the session; permissions can change out of band. Cheap: an unchanged session 304s. */
    refresh: () => Promise<void>;
};
export type UseKidSessionVerifyAge = VerifyAgeState & {
    /** Checks the session is a verified adult, minting a challenge when it is not. Idempotent; a no-op until the gate
     * passes. */
    start: () => void;
    /** Sends the player the verification link. Re-callable to re-send to a corrected address. */
    submit: (email: string) => Promise<{
        ok: boolean;
        error?: KidError;
    }>;
};
export declare function useSessionVerifyAgeController(): VerifyAgeController | null;
export declare function useKidSession(): UseKidSession;
export type UseKidPermission = {
    can: (name: PermissionName) => boolean;
    get: (name: PermissionName) => Permission | null;
};
/** Client permissions gate what a player SEES; enforce the real capability server-side. */
export declare function useKidPermission(): UseKidPermission;
export type UseKidPermissionSettings = {
    /** Every permission on the session, with its `managedBy`, so a custom UI can branch per row. */
    permissions: Permission[];
    isLoaded: boolean;
    /** Why the session failed to load, or null; show an error and call `refresh()` to retry. */
    error: KidError | null;
    /** Change a player-managed permission (opt-in / opt-out). Guardian-managed and prohibited ones are rejected. */
    change: (name: PermissionName, enabled: boolean) => Promise<{
        ok: boolean;
        error?: KidError;
    }>;
    /** Whether the session has an approver email. When false, collect one and pass it to `upgrade`. */
    hasApproverEmail: boolean;
    /** Request grownup approval for one or more guardian-managed permissions in one request (one email). A permission
     * with a `verifiedAgeThreshold` needs the player's own age check instead: without an email this returns
     * `invalid_request` when that check is needed; call it again with the player's own email. */
    upgrade: (names: PermissionName[], approverEmail?: string) => Promise<{
        ok: boolean;
        error?: KidError;
    }>;
    /** The in-flight ask, for a custom waiting view; `challengeKind` says whether it waits on the grownup or on the
     * player's own age check. */
    challenge: SettingsChallengeState;
    refresh: () => Promise<void>;
};
export declare function useKidPermissionSettings(): UseKidPermissionSettings;
export type UseKidChallenge = {
    challengeId: string | null;
    status: RawChallengeStatus;
    /** The challenge's deadline, or null when it has none. The flow moves to `fail` at this time. */
    expiresAt: string | null;
};
export declare function useKidChallenge(): UseKidChallenge;
//# sourceMappingURL=hooks.d.ts.map