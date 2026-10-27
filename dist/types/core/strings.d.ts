import type { KidLocalization, KidPermissionStrings, KidStrings } from './localization/types';
export type { KidLocalization, KidPermissionStrings, KidStrings };
export declare const DEFAULT_STRINGS: KidStrings;
export declare function mergeStrings(overrides?: KidLocalization): KidStrings;
export declare function textDirection(locale?: string): 'rtl' | 'ltr' | undefined;
/** Fill `{token}` placeholders from `vars`; an absent token is left verbatim. */
export declare function format(template: string, vars: Record<string, string | number>): string;
//# sourceMappingURL=strings.d.ts.map