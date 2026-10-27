import type { CSSProperties } from 'react';
import type { Appearance, ElementName } from '../core/index';
declare const STYLESHEET = "@layer kid{\n.kid-card{display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box;padding:20px;color:var(--kid-color-text);background:var(--kid-color-surface);border:1px solid var(--kid-color-border);border-radius:var(--kid-radius);font-family:var(--kid-font-family);accent-color:var(--kid-color-primary)}\n.kid-title{font-size:16px;font-weight:600;margin:0}\n.kid-label{font-size:14px;font-weight:600}\n.kid-input{padding:10px 12px;border:1px solid var(--kid-color-border);border-radius:calc(var(--kid-radius) / 2);font:inherit}\n.kid-button{padding:10px 14px;border:none;border-radius:calc(var(--kid-radius) / 2);background:var(--kid-color-primary);color:var(--kid-color-on-primary);font:inherit;font-weight:600;cursor:pointer}\n.kid-muted{color:var(--kid-color-text-muted);font-size:14px;margin:0}\n.kid-danger{color:var(--kid-color-danger);font-size:14px;margin:0}\n.kid-row{display:flex;align-items:center;justify-content:space-between;gap:12px}\n.kid-askForm{display:flex;flex-direction:column;gap:12px}\n.kid-controlColumn{display:flex;flex-direction:column;align-items:flex-end;gap:4px}\n.kid-pill{padding:4px 12px;border-radius:999px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}\n.kid-pillAsk{border:1px solid var(--kid-color-border);background:transparent;color:var(--kid-color-text)}\n.kid-pillAdded{border:1px solid var(--kid-color-primary);background:var(--kid-color-primary);color:var(--kid-color-on-primary)}\n}";
export { STYLESHEET };
export declare function injectStyles(): void;
export type ElementProps = {
    className: string;
    style?: CSSProperties;
    dir?: 'rtl' | 'ltr';
};
export declare function elementProps(appearance: Appearance | undefined, ...keys: ElementName[]): ElementProps;
export declare function useEl(): (...keys: ElementName[]) => ElementProps;
//# sourceMappingURL=styles.d.ts.map