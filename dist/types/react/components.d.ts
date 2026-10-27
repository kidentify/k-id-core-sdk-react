import { type ReactNode } from 'react';
import { type AgeSignal, type KidError, type KidStrings, type PermissionName } from '../core/index';
export type WebAgeMethod = 'date-of-birth' | 'age-slider';
export declare function KidSelectJurisdiction({ onSelect }?: {
    onSelect?: (code: string) => void;
}): import("react/jsx-runtime").JSX.Element | null;
export declare function KidCollectAge({ methods, onSubmit, }?: {
    methods?: WebAgeMethod[];
    onSubmit?: (signal: AgeSignal) => void;
}): import("react/jsx-runtime").JSX.Element | null;
type EmailStrings = KidStrings['askAnAdult'] | KidStrings['verifyAge'];
type Submit = () => Promise<{
    ok: boolean;
    error?: KidError;
}>;
export declare function ChallengeEmailForm({ strings: t, id, name, setEmail: commitEmail, submit: send, onSent, }: {
    strings: EmailStrings;
    id: string;
    name: 'askAnAdult' | 'verifyAge';
    setEmail: (email: string) => void;
    submit: Submit;
    onSent?: (info: {
        email: string;
    }) => void;
}): import("react/jsx-runtime").JSX.Element;
export declare function KidAskAnAdult({ onSent }?: {
    onSent?: (info: {
        email: string;
    }) => void;
}): import("react/jsx-runtime").JSX.Element;
export declare function KidVerifyAge({ onSent }?: {
    onSent?: (info: {
        email: string;
    }) => void;
}): import("react/jsx-runtime").JSX.Element;
export declare function KidSessionVerifyAgePending({ children }: {
    children?: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function KidSessionVerifyAgeFail({ children }: {
    children?: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function KidSessionVerifyAgePass({ children }: {
    children?: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export declare function KidSessionVerifyAgeError({ children }: {
    children?: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
/** Verifies the player is an adult (the civil age of their jurisdiction) on the established session: the email form
 * while it needs the player's email, then the slot matching the outcome. Renders nothing until the age gate passes.
 * Remounting it after a fail or error tries again. */
export declare function KidSessionVerifyAge({ onSent, children, }: {
    onSent?: (info: {
        email: string;
    }) => void;
    children?: ReactNode;
}): import("react/jsx-runtime").JSX.Element | null;
export declare function KidPermission({ name, fallback, children, }: {
    name: PermissionName;
    fallback?: ReactNode;
    children: ReactNode;
}): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=components.d.ts.map