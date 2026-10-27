import { type ReactNode } from 'react';
export type KidSettingsProviderProps = {
    /** The established session to manage, from the age gate's persisted `onSession`. */
    sessionId: string;
    /** Resume an in-flight settings challenge; persist it from `onChallenge` and pass it back. */
    challengeId?: string;
    /** The settings challenge id OUT, for the integrator to persist and pass back (the SDK persists nothing). */
    onChallenge?: (challengeId: string) => void;
    children: ReactNode;
};
/** Post-session scope, symmetric with <KidSessionProvider>. Holds the settings controller: reads the
 * session's permissions and owns the grownup-ask sub-flow, so it survives <KidSettings> unmounting. */
export declare function KidSettingsProvider({ sessionId, challengeId, onChallenge, children }: KidSettingsProviderProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=settingsProvider.d.ts.map