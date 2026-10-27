import { Children, isValidElement, type ReactNode } from 'react'

import type { KidStatus } from '../core/types'

export type Slots = Partial<Record<KidStatus, ReactNode>>

/** Picks each status's slot out of `children` by its component type. */
export function collectSlots(children: ReactNode, types: Partial<Record<KidStatus, unknown>>): Slots {
  const slots: Slots = {}
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    for (const [status, type] of Object.entries(types)) {
      if (child.type === type) slots[status as KidStatus] = child
    }
  })
  return slots
}
