import { type ReactNode } from 'react';
import { type DeclareInput, type KidLocalization, type Appearance } from '../core/index';
/** The integration config, read once at mount; later prop changes are ignored. Applied only while you use a test key. */
export type KidDeclare = DeclareInput;
export type KidCoreProviderProps = {
    publishableKey: string;
    /** The k-ID API URL Kai shows for your key. The same-origin default only works on pages k-ID serves. */
    baseUrl?: string;
    appearance?: Appearance;
    /** Partial widget-copy overrides (wording or a locale's strings), merged over the English defaults. */
    localization?: KidLocalization;
    declare?: KidDeclare;
    children: ReactNode;
};
export declare function KidCoreProvider({ publishableKey, baseUrl, appearance, localization, declare, children, }: KidCoreProviderProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=provider.d.ts.map