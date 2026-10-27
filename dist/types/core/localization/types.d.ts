import type { PermissionName } from '../catalog/permissions';
/** Chrome copy for every k-ID widget (English defaults). Override wording or supply a locale's strings via
 * the `localization` prop on `<KidCoreProvider>`, merged per section; `{token}` placeholders are filled by `format`. */
export type KidStrings = {
    jurisdiction: {
        label: string;
        placeholder: string;
        submit: string;
        /** `{country}` is the localized country, `{subdivision}` the region. */
        subdivisionName: string;
    };
    age: {
        dateOfBirthLabel: string;
        /** `{age}` is the selected age. */
        ageLabel: string;
        submit: string;
    };
    askAnAdult: {
        title: string;
        description: string;
        emailPlaceholder: string;
        submit: string;
        submitting: string;
        error: string;
        invalidEmail: string;
    };
    verifyAge: {
        title: string;
        description: string;
        emailPlaceholder: string;
        submit: string;
        submitting: string;
        error: string;
        invalidEmail: string;
    };
    settings: {
        title: string;
        /** `{permission}` is the permission name. */
        enabledLabel: string;
        on: string;
        off: string;
        ask: string;
        added: string;
        granted: string;
        askGrownup: string;
        asking: string;
        waiting: string;
        /** Shown in place of `waiting` while the player's own age check is out. */
        verifying: string;
        error: string;
    };
    /** Subdivision names keyed by ISO 3166-2 code, without the country. */
    subdivisions: Record<string, string>;
    /** Permission copy keyed by permission `name`, as listed in PERMISSIONS.md. */
    permissions: Record<string, KidPermissionStrings>;
};
export type KidPermissionStrings = {
    name: string;
};
export type KidLocalization = {
    [Section in Exclude<keyof KidStrings, 'subdivisions' | 'permissions'>]?: Partial<KidStrings[Section]>;
} & {
    subdivisions?: Record<string, string>;
    /** Merged per permission, so overriding one field keeps the rest. */
    permissions?: Partial<Record<PermissionName, Partial<KidPermissionStrings>>>;
    /** BCP 47 tag; also localizes the country names. */
    locale?: string;
};
//# sourceMappingURL=types.d.ts.map