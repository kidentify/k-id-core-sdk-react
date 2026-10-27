/**
 * The icon as declare sends it. A public https link goes as is for k-ID to fetch; anything k-ID cannot reach (a
 * path in the app's bundle, a local dev server, a blob) is read here and sent inline as a data URL.
 */
export declare function declaredIconUrl(iconUrl: string, fetchImpl: typeof fetch, base?: string): Promise<string>;
//# sourceMappingURL=declareIcon.d.ts.map