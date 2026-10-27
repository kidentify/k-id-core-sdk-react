import { type ReactNode } from 'react';
import type { JurisdictionCode } from '../catalog/jurisdictions';
import type { AgeSignal } from '../core/types';
export type KidSessionProviderProps = {
    /**
     * ISO 3166-1 alpha-2 country or ISO 3166-2 subdivision code, or `"auto"` to resolve it from the client IP
     * server-side (falls back to the in-widget picker when it can't be resolved). Omit to show the picker.
     */
    jurisdiction?: 'auto' | JurisdictionCode | (string & {});
    age?: AgeSignal;
    email?: string;
    /** Resume an in-flight flow; persist these from `onChallenge`/`onSession` and pass them back. */
    challengeId?: string;
    sessionId?: string;
    onChallenge?: (challengeId: string) => void;
    onSession?: (sessionId: string) => void;
    /**
     * Fires once the age check has a result, pass or pending, with a one-time token for your backend. Not fired on resume
     * or when the player is prohibited.
     */
    onClaim?: (claimToken: string) => void;
    children: ReactNode;
};
export declare function KidSessionProvider({ jurisdiction, age, email, challengeId, sessionId, onChallenge, onSession, onClaim, children, }: KidSessionProviderProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=sessionProvider.d.ts.map