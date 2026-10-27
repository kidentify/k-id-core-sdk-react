import type { PermissionName } from './catalog/permissions';
import type { BotCheckProvider } from './botCheck';
import { type ClientAttestation, type ClientCrypto, type DeviceKeyProvider } from './clientTrust';
import type { components } from './fapi-schema';
type Schemas = components['schemas'];
export type Permission = Omit<Schemas['Permission'], 'name'> & {
    name: PermissionName;
};
export type Session = Omit<Schemas['Session'], 'permissions'> & {
    permissions: Permission[];
};
export type Challenge = Schemas['Challenge'];
export type ChallengeStatus = Omit<Schemas['ChallengeStatus'], 'permissions'> & {
    permissions?: PermissionName[];
};
export type AgeResult = Omit<Schemas['CheckAgeGateResponse'], 'session'> & {
    session?: Session;
};
export type Requirements = Schemas['AgeGateRequirements'];
export type InviteParentResult = Schemas['InviteParentResponse'];
export type AgeVerification = Schemas['AgeVerification'];
export type AgeSignal = {
    dateOfBirth: string;
} | {
    age: number;
};
export type PlatformAgeSignal = Schemas['PlatformAgeSignal'];
/** What the app declares. `permissions` and `supportEmail` are always sent; leave another field out to keep what k-ID has, or send null to clear it. */
export type DeclareInput = {
    permissions: {
        name: PermissionName;
    }[];
    privacyPolicyUrl?: string | null;
    termsOfServiceUrl?: string | null;
    /** A public https link, or any image the app can load (a bundled asset, a local path), which is sent inline. */
    iconUrl?: string | null;
    /** Required. The address k-ID's emails give players and parents for help. */
    supportEmail: string;
};
/** A read of the session, carrying the etag so a caller can make the next read conditional. `notFound` is k-ID's
 * answer when the session no longer exists. */
export type SessionRead = {
    session: Session | null;
    etag: string | null;
    notModified: boolean;
    notFound?: KidError;
};
/** Result of a player opt-in/opt-out change: the updated session, or a user-recoverable failure with its error. */
export type SessionChangeResult = {
    ok: true;
    session: Session;
} | {
    ok: false;
    error: KidError;
};
/** Result of a guardian upgrade request: the session plus any minted upgrade challenge to email and poll. */
export type SessionUpgradeResult = {
    session: Session;
    challenge: Challenge | null;
};
export type SessionVerifyAgeResult = {
    status: Schemas['VerifySessionAgeResponse']['status'];
    challenge: Challenge | null;
};
/** The closed set of error codes the SDK surfaces, grouped by what the developer does about it. Specifics
 * ride in `message` (dev-facing) or the coarse end-user `status:'error'`. */
export type KidErrorCode = 'invalid_request' | 'unauthorized' | 'not_found' | 'rate_limited' | 'unavailable';
export declare function toKidErrorCode(rawCode: string | undefined, status: number): KidErrorCode;
export type SendEmailResult = {
    ok: true;
} | {
    ok: false;
    error: KidError;
};
/** How an opened challenge stream ended: the server closed it (with its reconnect hint, if any), or the connection
 * dropped. */
export type ChallengeStreamEnd = {
    closed: true;
    retryMs?: number;
} | {
    closed: false;
};
/** A non-2xx error from the k-ID API. `code` is one of the closed `KidErrorCode` set; `message` is safe to
 * display (never raw server text). `rawCode` is the underlying server code, kept for internal flow branches. */
export declare class KidError extends Error {
    readonly status: number;
    readonly code: KidErrorCode;
    readonly rawCode: string | undefined;
    /** With `rate_limited`, the whole seconds k-ID asked the caller to wait before trying again, when it said. */
    readonly retryAfter?: number | undefined;
    constructor(status: number, code: KidErrorCode, message: string, rawCode: string | undefined, 
    /** With `rate_limited`, the whole seconds k-ID asked the caller to wait before trying again, when it said. */
    retryAfter?: number | undefined);
}
/** The error a failure the SDK catches before any call carries, such as a submit before a challenge exists. */
export declare function localKidError(code: 'invalid_request'): KidError;
/** Anything that is not already a KidError, such as a dropped connection, becomes main's transport error. */
export declare function toKidError(e: unknown): KidError;
export interface ClientOptions {
    /** Sent as `Authorization: Bearer`. */
    publishableKey?: string;
    baseUrl?: string;
    /** Injected fetch (tests / SSR). Default: global `fetch`. */
    fetchImpl?: typeof fetch;
    /** The device key a keyed client's calls are bound to. Without one, calls are sent unbound. */
    deviceKeys?: DeviceKeyProvider;
    /** Solves the bot check k-ID asks a live key's mint for. Without one, a mint that asks for it gets no token. */
    botCheck?: BotCheckProvider;
    /** The URL a relative `baseUrl` or declared `iconUrl` resolves against. Without it, both must be absolute. */
    baseURI?: () => string | undefined;
    /** Sent with every call, such as an app's `Kid-App-Id` where there is no `Origin`. */
    headers?: Record<string, string>;
    /** The mint's platform and device evidence. Default: the web's, with the bot check. */
    attestation?: ClientAttestation;
    /** Hashing and randomness for client trust. Default: WebCrypto. */
    crypto?: ClientCrypto;
    /** Opens the challenge's event stream. Default: `fetchImpl`, reading the body as it arrives. */
    eventStream?: EventStreamTransport;
    /** Turns a declared `iconUrl` into what declare sends. Default: a public https link as is, anything else inline. */
    readIcon?: (iconUrl: string) => Promise<string>;
    /** Asks the platform for the player's age range. Without it, the age gate never asks. */
    platformAgeSignal?: (ageGates: number[]) => Promise<PlatformAgeSignal | null>;
}
/** How an event stream's request ended: its status, and the body when it was not a stream. */
export type EventStreamResult = {
    status: number;
    text: string;
};
/** Opens an event stream: `onHeaders` once the response starts, `onText` with each piece of the body as it arrives.
 * Resolves when the response ends; rejects when the connection fails or `signal` aborts it. */
export type EventStreamTransport = (url: string, headers: Record<string, string>, signal: AbortSignal, onHeaders: (status: number, contentType: string | null) => void, onText: (text: string) => void) => Promise<EventStreamResult>;
export interface Client {
    /** Age-gate check. An absent jurisdiction is resolved server-side from the client IP. A platform age signal stands in
     * for an absent age. */
    ageGateCheck(age: AgeSignal | undefined, jurisdiction?: string, platformAgeSignal?: PlatformAgeSignal): Promise<AgeResult>;
    /** Whether the server will use a platform age signal from this client. */
    platformAgeSignalTrusted(): Promise<boolean>;
    /** Asks the platform for the player's age range, where the client has a way to. */
    platformAgeSignal?: (ageGates: number[]) => Promise<PlatformAgeSignal | null>;
    getRequirements(jurisdiction?: string): Promise<Requirements>;
    /** Get a player session by id. Pass a prior etag to let an unchanged session 304. */
    sessionGet(sessionId: string, etag?: string): Promise<SessionRead>;
    challengeGetStatus(challengeId: string): Promise<ChallengeStatus>;
    /** Stream the challenge's status, calling `onStatus` with each one, until the stream ends. Throws a `KidError` when
     * the stream can't be opened; `not_found` means streaming is unavailable, so poll instead. */
    challengeStream(challengeId: string, onStatus: (status: ChallengeStatus) => void, signal: AbortSignal): Promise<ChallengeStreamEnd>;
    /** Send the consent request. Omit `email` to reach the challenge's existing approver (guardian upgrade on a
     * linked session). Re-callable to re-send to a still-pending challenge. */
    challengeSendEmail(challengeId: string, email?: string): Promise<SendEmailResult>;
    /** Send a parent-invite challenge (VPL). Mirrors the wire; unused by the VPC flow. */
    challengeInviteParent(sessionId: string, parentEmail: string, playerName?: string): Promise<InviteParentResult>;
    /** Enable or disable a player-managed permission (opt-in/opt-out). User-recoverable failures return a code. */
    sessionChange(sessionId: string, name: PermissionName, enabled: boolean): Promise<SessionChangeResult>;
    /** Request a guardian upgrade for guardian-managed permissions; mints a challenge to email and poll. */
    sessionUpgrade(sessionId: string, permissionNames: PermissionName[]): Promise<SessionUpgradeResult>;
    sessionVerifyAge(sessionId: string): Promise<SessionVerifyAgeResult>;
    /** Declare the app's config (test mode only). Throws on a non-2xx. */
    declare(input: DeclareInput): Promise<void>;
}
export declare function createClient(options?: ClientOptions): Client;
export {};
//# sourceMappingURL=client.d.ts.map