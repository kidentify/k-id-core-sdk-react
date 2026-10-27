import type { KidLocalization } from './types';
export { en } from './en';
export type { KidLocalization, KidPermissionStrings, KidStrings } from './types';
export declare const arSA: KidLocalization;
export declare const deDE: KidLocalization;
export declare const enGB: KidLocalization;
export declare const esES: KidLocalization;
export declare const esMX: KidLocalization;
export declare const frFR: KidLocalization;
export declare const frCA: KidLocalization;
export declare const hiIN: KidLocalization;
export declare const idID: KidLocalization;
export declare const itIT: KidLocalization;
export declare const jaJP: KidLocalization;
export declare const koKR: KidLocalization;
export declare const msMY: KidLocalization;
export declare const nlNL: KidLocalization;
export declare const ptPT: KidLocalization;
export declare const ptBR: KidLocalization;
export declare const ruRU: KidLocalization;
export declare const thTH: KidLocalization;
export declare const trTR: KidLocalization;
export declare const zhCN: KidLocalization;
export declare const zhTW: KidLocalization;
export declare const KID_LOCALES: readonly ['ar', 'de', 'en', 'en-GB', 'es', 'es-MX', 'fr', 'fr-CA', 'hi', 'id', 'it', 'ja', 'ko', 'ms', 'nl', 'pt', 'pt-BR', 'ru', 'th', 'tr', 'zh', 'zh-Hant'];
export type KidLocale = (typeof KID_LOCALES)[number];
/** Matches the exact tag first, then Traditional Chinese for `zh-TW`, `zh-HK`, `zh-MO` and `zh-Hant`, then the base
 * language, then English. English is `{ locale: 'en' }`, which keeps the built-in copy. */
export declare function getKidLocalization(locale: string): KidLocalization;
//# sourceMappingURL=index.d.ts.map