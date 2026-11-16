import type { Bill, Invoice } from '@/api/types'
import { DUE_BUCKETS, dueBucketFor, type DueBucketKey } from './aging'
import { isBillOpen } from './payables'
import { balanceDue, daysOverdue } from './receivables'
import { toPaise } from './format'

export interface OpenItem {
  partyId: string
  dueDate: string
  balance: number
}

export type BucketTotals = Record<DueBucketKey, number> & { total: number }

export interface AgingRow {
  partyId: string
  totals: BucketTotals
}

const emptyTotals = (): BucketTotals => ({
  ...(Object.fromEntries(DUE_BUCKETS.map((b) => [b.key, 0])) as Record<DueBucketKey, number>),
  total: 0,
})

export const receivableItems = (invoices: Invoice[]): OpenItem[] =>
  invoices
    .map((i) => ({ partyId: i.partyId, dueDate: i.dueDate, balance: balanceDue(i) }))
    .filter((i) => i.balance > 0)

export const payableItems = (bills: Bill[]): OpenItem[] =>
  bills
    .filter(isBillOpen)
    .map((b) => ({ partyId: b.partyId, dueDate: b.dueDate, balance: b.amount }))

// One row per party, biggest balance first, plus a grand total row.
export function buildAging(items: OpenItem[], today: string) {
  const byParty = new Map<string, BucketTotals>()
  const grand = emptyTotals()

  for (const item of items) {
    const bucket = dueBucketFor(daysOverdue(item.dueDate, today))
    const row = byParty.get(item.partyId) ?? emptyTotals()
    for (const totals of [row, grand]) {
      totals[bucket] = (toPaise(totals[bucket]) + toPaise(item.balance)) / 100
      totals.total = (toPaise(totals.total) + toPaise(item.balance)) / 100
    }
    byParty.set(item.partyId, row)
  }

  const rows: AgingRow[] = [...byParty]
    .map(([partyId, totals]) => ({ partyId, totals }))
    .sort((a, b) => b.totals.total - a.totals.total)

  return { rows, grand }
}
