import type { Module, Workspace } from '@/api/types'
import type { ActionMeta } from './reconcile'

// Next number in a series such as "RCT/152", "INV-1043" or "L-2210". It's worked out from
// the data itself, so the client and the server always agree on what comes next.
export function nextNumber(existing: string[], prefix: string): string {
  const numbers = existing
    .filter((value) => value.startsWith(prefix))
    .map((value) => Number(value.slice(prefix.length)))
    .filter(Number.isFinite)
  return `${prefix}${Math.max(0, ...numbers) + 1}`
}

export function withActivity<T extends Workspace>(
  ws: T,
  meta: ActionMeta,
  module: Module,
  text: string,
  link?: string,
): T {
  const id = nextNumber(
    ws.activity.map((a) => a.id),
    'A-',
  )
  return { ...ws, activity: [{ id, ...meta, module, text, link }, ...ws.activity] }
}
