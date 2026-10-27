import type { BotCheckProvider } from './botCheck';
import type { components } from './fapi-schema';
type ClientToken = components['schemas']['ClientToken'];
type ClientAttestRequest = components['schemas']['ClientAttestRequest'];
export type PublicJwk = {
    kty?: string;
    crv?: string;
    x?: string;
    y?: string;
};
export interface DeviceKey {
    publicJwk: PublicJwk;
    /** Returns the raw 64-byte `r || s` signature JWS expects. */
    sign(data: Uint8Array): Promise<Uint8Array>;
}
export interface DeviceKeyProvider {
    getKey(): Promise<DeviceKey>;
}
export type FapiSend = (path: string, init: {
    method: string;
    headers: Record<string, string>;
    body?: unknown;
}) => Promise<{
    ok: boolean;
    status: number;
    data: {
        error?: string;
    } & Record<string, unknown>;
    retryAfter?: number;
}>;
/** A token step k-ID answered with a failure, or that never reached it (status 0). */
export type MintFailure = Awaited<ReturnType<FapiSend>>;
/** The hashing and randomness client trust signs with, where the platform has no WebCrypto. */
export interface ClientCrypto {
    sha256(data: Uint8Array): Promise<Uint8Array>;
    randomBytes(length: number): Uint8Array;
}
export declare const webCrypto: ClientCrypto;
/** The platform a mint is for, and the device evidence an app sends with it. Without one, a mint is the web's. */
export interface ClientAttestation {
    platform: ClientAttestRequest['platform'];
    /** The attest request for this mint, bound to SHA-256(nonce.jkt), or null when the device has none to give. */
    evidence?(clientDataHash: Uint8Array): Promise<ClientAttestRequest | null>;
    /** Called once a mint succeeds, with what was sent and whether k-ID verified it. */
    minted?(sent: ClientAttestRequest, verified: boolean): void;
}
/** `url` must be absolute. */
export declare function createDPoPProof(key: DeviceKey, method: string, url: string, extra?: {
    nonce?: string;
    accessToken?: string;
}, hash?: ClientCrypto): Promise<string>;
export declare class ClientTrust {
    private readonly send;
    private readonly resolveUrl;
    private readonly keys;
    private readonly botCheck?;
    private readonly attestation?;
    private readonly hash;
    private token;
    private minting;
    private nextMintAt;
    private failure;
    constructor(send: FapiSend, resolveUrl: (path: string) => string, keys: DeviceKeyProvider, botCheck?: BotCheckProvider | undefined, attestation?: ClientAttestation | undefined, hash?: ClientCrypto);
    headers(method: string, path: string): Promise<Record<string, string>>;
    /** The token step's failure that leaves calls without a token, with a 429's `retryAfter` as the seconds left
     * before the next mint; null when there is none. */
    tokenFailure(): MintFailure | null;
    invalidate(): void;
    trustLevel(): Promise<ClientToken['trustLevel'] | null>;
    private current;
    private mint;
}
export {};
//# sourceMappingURL=clientTrust.d.ts.map