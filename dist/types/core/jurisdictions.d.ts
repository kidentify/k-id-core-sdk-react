import { type KidStrings } from './strings';
/** Options for <KidSelectJurisdiction>; `code` is sent to the age-gate API (an ISO 3166-1 alpha-2 country
 * or an ISO 3166-2 subdivision). Subdivisions mirror the set the server recognizes, not all of 3166-2. */
export type JurisdictionOption = {
    code: string;
    name: string;
};
export declare const COUNTRIES: JurisdictionOption[];
export declare function localizeJurisdictions(strings: KidStrings, locale?: string): JurisdictionOption[];
export declare const JURISDICTIONS: JurisdictionOption[];
//# sourceMappingURL=jurisdictions.d.ts.map