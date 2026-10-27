import type { CSSProperties } from 'react';
import type { PermissionName } from '../catalog/permissions';
import type { AgeSignal, Challenge, KidError, Permission, Session } from '../client';
export type { AgeSignal, Challenge, Permission, PermissionName, Session };
/** An element `appearance.elements` can style, also its `kid-<name>` class. */
export type ElementName = 'card' | 'title' | 'label' | 'input' | 'button' | 'muted' | 'danger' | 'row' | 'pill' | 'pillAsk' | 'pillAdded' | 'askForm' | 'controlColumn' | 'verifyAge' | 'selectJurisdiction' | 'collectAge' | 'askAnAdult' | 'settings';
/** The single status the whole surface reads. Lowercase (JS-client convention); the wire's UPPER_SNAKE
 * outcomes are mapped down to these. `running` = capturing or not-started; `pending` = consent sent and
 * polling; `pass`/`prohibited`/`fail` are terminal; `error` is an unrecoverable failure. */
export type KidStatus = 'running' | 'pending' | 'pass' | 'prohibited' | 'fail' | 'error';
/** The raw challenge status from the poll, for a custom waiting screen. `in-progress` = the adult opened
 * the request but has not finished. */
export type RawChallengeStatus = 'pending' | 'in-progress' | 'pass' | 'fail' | null;
/** Which interactive step the capture flow is on while `running`; null once it leaves `running`. Our
 * components self-suppress against this. `ageAssurance` is the adults-only assurance step (<KidVerifyAge>);
 * `parentalConsent` is the inclusive VPC step (<KidAskAnAdult>). */
export type AgeGateStep = 'jurisdiction' | 'age' | 'parentalConsent' | 'ageAssurance' | 'checking' | null;
export type ChallengeKind = 'parentalConsent' | 'ageAssurance';
export type Requirements = {
    shouldDisplay: boolean;
    approvedAgeCollectionMethods: string[];
    digitalConsentAge?: number;
    /** The age at which a player is a legal adult; compare `useKidSession().ageVerification.verifiedAge` to it. */
    civilAge?: number;
    minimumAge?: number;
    accessAge?: number;
};
export type AgeGateState = {
    status: KidStatus;
    step: AgeGateStep;
    challengeId: string | null;
    challengeKind: ChallengeKind | null;
    sessionId: string | null;
    session: Session | null;
    /** One-time claim token for this check; null until the check, after a
     * prohibition, and on resume. */
    claimToken: string | null;
    rawChallengeStatus: RawChallengeStatus;
    /** The challenge's deadline, or null when it has none. The flow moves to `fail` at this time. */
    expiresAt: string | null;
    requirements: Requirements | null;
    /** True when the email arrived via the KidSessionProvider prop, so <KidAskAnAdult> / <KidVerifyAge> self-suppress. */
    emailProvided: boolean;
    /** Why the gate ended in `status === 'error'`: a k-ID API error as is, and any other failure as `unavailable`. */
    error: KidError | null;
};
export type AppearanceVariables = {
    colorPrimary: string;
    colorOnPrimary: string;
    colorText: string;
    colorTextMuted: string;
    colorSurface: string;
    colorSurfaceMuted: string;
    colorBorder: string;
    colorDanger: string;
    fontFamily: string;
    radius: string;
};
export type Appearance = {
    variables?: Partial<AppearanceVariables>;
    /** Per-element overrides keyed by element name (`card`, `title`, `label`, `input`, `button`, `muted`,
     * `danger`, `verifyAge`, ...). A string is added as a className; an object is merged as inline CSSProperties. */
    elements?: Partial<Record<ElementName, string | CSSProperties>>;
};
//# sourceMappingURL=types.d.ts.map