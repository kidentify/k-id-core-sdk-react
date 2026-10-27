import { type ReactNode } from 'react';
import type { KidStatus } from '../core/types';
export type Slots = Partial<Record<KidStatus, ReactNode>>;
/** Picks each status's slot out of `children` by its component type. */
export declare function collectSlots(children: ReactNode, types: Partial<Record<KidStatus, unknown>>): Slots;
//# sourceMappingURL=slots.d.ts.map