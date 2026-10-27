import type { Client } from '../client';
import type { AgeGateController, AskWatcher, SessionStore, SettingsController, SettingsState } from '../core';
import type { Appearance, AgeGateState } from '../core/types';
import { type JurisdictionOption } from '../jurisdictions';
import type { KidStrings } from '../strings';
export type DeclarationStatus = 'ready' | 'pending' | 'error';
export type KidCoreContextValue = {
    client: Client;
    sessions: SessionStore;
    asks: AskWatcher;
    appearance?: Appearance;
    strings: KidStrings;
    locale?: string;
    dir?: 'rtl' | 'ltr';
    declarationStatus: DeclarationStatus;
    /** Why declare failed, with `declarationStatus: 'error'`. */
    declarationError?: unknown;
};
export declare const KidCoreContext: import("react").Context<KidCoreContextValue | null>;
export declare function useKidCoreContext(): KidCoreContextValue;
/** The merged widget copy (English defaults with the `localization` overrides applied). */
export declare function useKidStrings(): KidStrings;
export declare function useKidJurisdictions(): JurisdictionOption[];
export type KidSessionContextValue = {
    controller: AgeGateController;
};
export declare const KidSessionContext: import("react").Context<KidSessionContextValue | null>;
export declare function useAgeGateController(): AgeGateController;
export declare function useAgeGateState(): AgeGateState;
export type KidSettingsContextValue = {
    controller: SettingsController;
};
export declare const KidSettingsContext: import("react").Context<KidSettingsContextValue | null>;
export declare function useSettingsController(): SettingsController;
export declare function useSettingsState(): SettingsState;
//# sourceMappingURL=context.d.ts.map