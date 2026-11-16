import type { Bill, BillStatus, LedgerEntry, Workspace } from '@/api/types'
import { addDays } from './dates'
import { formatMoney } from './format'
import { applyMatch, matchError, withEvent, type ActionMeta } from './reconcile'
import { nextNumber, withActivity } from './workspace'

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  awaiting_approval: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Paid',
}

export const BILL_CATEGORIES = [
  'Raw material',
  'Freight',
  'Rent',
  'Software',
  'Professional fees',
  'Office supplies',
] as const

export const isBillOpen = (bill: Bill) =>
  bill.status === 'awaiting_approval' || bill.status === 'approved'

export const isBillOverdue = (bill: Bill, today: string) => isBillOpen(bill) && bill.dueDate < today

// ── Entering a bill ────────────────────────────────────────────────────────

export interface BillInput {
  partyId: string
  number: string
  date: string
  amount: number
  category: string
}

export function billProblem(ws: Workspace, input: BillInput): string | null {
  if (!ws.parties.some((p) => p.id === input.partyId && p.kind === 'vendor'))
    return 'Choose a vendor'
  if (!input.number.trim()) return 'Enter the vendor’s bill number'
  if (!input.date) return 'Enter the bill date'
  if (!(input.amount > 0)) return 'Enter an amount above zero'

  // The same vendor bill keyed in twice is one of the most common ways money gets paid twice.
  const duplicate = ws.bills.find(
    (b) =>
      b.partyId === input.partyId &&
      b.status !== 'rejected' &&
      b.number.trim().toLowerCase() === input.number.trim().toLowerCase(),
  )
  if (duplicate) return `Bill ${duplicate.number} from this vendor is already entered`
  return null
}

export function applyNewBill<T extends Workspace>(ws: T, input: BillInput, meta: ActionMeta): T {
  const party = ws.parties.find((p) => p.id === input.partyId)!
  const bill: Bill = {
    id: nextNumber(
      ws.bills.map((b) => b.id),
      'BL-',
    ),
    number: input.number.trim(),
    partyId: party.id,
    date: input.date,
    dueDate: addDays(input.date, party.creditDays),
    amount: input.amount,
    category: input.category,
    status: 'awaiting_approval',
    paymentEntryId: null,
    history: [{ ...meta, action: 'created' }],
  }

  return withActivity(
    { ...ws, bills: [...ws.bills, bill] },
    meta,
    'payables',
    `Entered bill ${bill.number} from ${party.name} for ${formatMoney(bill.amount)}`,
    `/payables/${bill.id}`,
  )
}

// ── Approval ───────────────────────────────────────────────────────────────

export type BillDecision =
  { billId: string; approve: true } | { billId: string; approve: false; reason: string }

export function decisionProblem(ws: Workspace, decision: BillDecision): string | null {
  const bill = ws.bills.find((b) => b.id === decision.billId)
  if (!bill) return 'Bill not found'
  if (bill.status !== 'awaiting_approval') return 'This bill has already been decided'
  if (!decision.approve && !decision.reason.trim()) return 'Give a reason for rejecting'
  return null
}

export function applyBillDecision<T extends Workspace>(
  ws: T,
  decision: BillDecision,
  meta: ActionMeta,
): T {
  const bill = ws.bills.find((b) => b.id === decision.billId)!
  const party = ws.parties.find((p) => p.id === bill.partyId)!

  const updated: Bill = decision.approve
    ? withEvent({ ...bill, status: 'approved' }, meta, 'approved')
    : withEvent(
        { ...bill, status: 'rejected', rejectReason: decision.reason },
        meta,
        'rejected',
        decision.reason,
      )

  return withActivity(
    { ...ws, bills: ws.bills.map((b) => (b.id === bill.id ? updated : b)) },
    meta,
    'payables',
    `${decision.approve ? 'Approved' : 'Rejected'} bill ${bill.number} from ${party.name}`,
    `/payables/${bill.id}`,
  )
}

// ── Payment ────────────────────────────────────────────────────────────────

export interface BillPaymentInput {
  billId: string
  date: string
  ref: string
  bankLineId?: string
}

function paymentEntry(ws: Workspace, bill: Bill, input: BillPaymentInput): LedgerEntry {
  const party = ws.parties.find((p) => p.id === bill.partyId)!
  return {
    id: nextNumber(
      ws.ledger.map((e) => e.id),
      'L-',
    ),
    voucherNo: nextNumber(
      ws.ledger.map((e) => e.voucherNo),
      'PMT/',
    ),
    date: input.date,
    partyId: party.id,
    party: party.name,
    narration: `Payment against bill ${bill.number}`,
    ref: input.ref,
    amount: bill.amount,
    direction: 'out',
    bankLineId: null,
  }
}

export function paymentProblem(ws: Workspace, input: BillPaymentInput): string | null {
  const bill = ws.bills.find((b) => b.id === input.billId)
  if (!bill) return 'Bill not found'
  if (bill.status !== 'approved') return 'Only approved bills can be paid'
  if (!input.date) return 'Enter the payment date'

  if (input.bankLineId) {
    const line = ws.bankLines.find((l) => l.id === input.bankLineId)
    if (!line) return 'That bank line no longer exists'
    // Same rules as a manual match, so a payment can't be posted against the wrong debit.
    return matchError(line, [paymentEntry(ws, bill, input)], ws.settings)
  }
  return null
}

export function applyBillPayment<T extends Workspace>(
  ws: T,
  input: BillPaymentInput,
  meta: ActionMeta,
): T {
  const bill = ws.bills.find((b) => b.id === input.billId)!
  const entry = paymentEntry(ws, bill, input)

  const paid = withEvent(
    { ...bill, status: 'paid' as const, paymentEntryId: entry.id },
    meta,
    'paid',
    `${entry.voucherNo}, ${formatMoney(bill.amount)}`,
  )

  let next: T = {
    ...ws,
    ledger: [...ws.ledger, entry],
    bills: ws.bills.map((b) => (b.id === bill.id ? paid : b)),
  }
  if (input.bankLineId) {
    next = applyMatch(next, [{ lineId: input.bankLineId, ledgerIds: [entry.id] }], meta)
  }

  return withActivity(
    next,
    meta,
    'payables',
    `Paid ${formatMoney(bill.amount)} to ${entry.party} as ${entry.voucherNo}`,
    `/payables/${bill.id}`,
  )
}

// ── List view ──────────────────────────────────────────────────────────────

export interface BillRow {
  bill: Bill
  partyName: string
  overdue: boolean
}

export const BILL_STATUS_FILTERS = [
  'open',
  'awaiting_approval',
  'approved',
  'overdue',
  'paid',
  'rejected',
  'all',
] as const
export const BILL_SORTS = ['due', 'amount', 'newest'] as const

export interface BillFilters {
  q: string
  status: (typeof BILL_STATUS_FILTERS)[number]
  category: string
  sort: (typeof BILL_SORTS)[number]
}

export function toBillRows(
  bills: Bill[],
  partyNames: Map<string, string>,
  today: string,
): BillRow[] {
  return bills.map((bill) => ({
    bill,
    partyName: partyNames.get(bill.partyId) ?? 'Unknown vendor',
    overdue: isBillOverdue(bill, today),
  }))
}

export function billStatusMatches(row: BillRow, status: BillFilters['status']) {
  if (status === 'all') return true
  if (status === 'open') return isBillOpen(row.bill)
  if (status === 'overdue') return row.overdue
  return row.bill.status === status
}

const BILL_SORTERS: Record<BillFilters['sort'], (a: BillRow, b: BillRow) => number> = {
  due: (a, b) => a.bill.dueDate.localeCompare(b.bill.dueDate),
  amount: (a, b) => b.bill.amount - a.bill.amount,
  newest: (a, b) => b.bill.date.localeCompare(a.bill.date),
}

export function filterBills(
  rows: BillRow[],
  { q, status, category, sort }: BillFilters,
): BillRow[] {
  const query = q.trim().toLowerCase()
  return rows
    .filter((row) => billStatusMatches(row, status))
    .filter((row) => category === 'all' || row.bill.category === category)
    .filter(
      (row) =>
        !query ||
        row.bill.number.toLowerCase().includes(query) ||
        row.partyName.toLowerCase().includes(query) ||
        row.bill.amount.toFixed(2).includes(query),
    )
    .sort(BILL_SORTERS[sort])
}
