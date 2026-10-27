export declare const MAX_DECLARE_ATTEMPTS = 4;
export declare function isRetryableDeclareError(error: unknown): boolean;
export declare function declareRetryDelayMs(attempt: number): number;
export declare function isLiveKey(publishableKey: string): boolean;
//# sourceMappingURL=declare-retry.d.ts.map