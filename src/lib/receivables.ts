import type { Invoice, LedgerEntry, Workspace } from '@/api/types'
import { addDays, daysBetween } from './dates'
import { formatMoney, subtractMoney, sumAmounts, toPaise } from './format'
import { applyMatch, type ActionMeta } from './reconcile'
import { nextNumber, withActivity } from './workspace'

export type InvoiceStatus = 'due' | 'partial' | 'overdue' | 'paid'

export const amountReceived = (invoice: Invoice) => sumAmounts(invoice.allocations)

export const balanceDue = (invoice: Invoice) =>
  subtractMoney(invoice.amount, amountReceived(invoice))

export function invoiceStatus(invoice: Invoice, today: string): InvoiceStatus {
  if (balanceDue(invoice) <= 0) return 'paid'
  if (invoice.dueDate < today) return 'overdue'
  return invoice.allocations.length > 0 ? 'partial' : 'due'
}

export const daysOverdue = (dueDate: string, today: string) =>
  Math.max(0, daysBetween(dueDate, today))

// ── Recording a receipt ────────────────────────────────────────────────────

export interface ReceiptInput {
  partyId: string
  date: string
  amount: number
  ref: string
  invoiceIds: string[]
  /** Set when the receipt is posted straight from an unmatched bank line. */
  bankLineId?: string
}

// Money goes to the oldest invoice first, which is how most customers expect it applied.
// Anything left over stays on the voucher as an advance.
export function allocateOldestFirst(amount: number, invoices: Invoice[]) {
  let left = toPaise(amount)
  const sorted = [...invoices].sort((a, b) => a.date.localeCompare(b.date))

  return sorted.map((invoice) => {
    const share = Math.min(left, toPaise(balanceDue(invoice)))
    left -= share
    return { invoiceId: invoice.id, amount: share / 100 }
  })
}

export function receiptProblem(ws: Workspace, input: ReceiptInput): string | null {
  const party = ws.parties.find((p) => p.id === input.partyId && p.kind === 'customer')
  if (!party) return 'Choose a customer'
  if (!(input.amount > 0)) return 'Enter an amount above zero'
  if (!input.date) return 'Enter the receipt date'
  if (input.invoiceIds.length === 0) return 'Pick at least one invoice'

  const invoices = ws.invoices.filter((i) => input.invoiceIds.includes(i.id))
  if (invoices.length !== input.invoiceIds.length || invoices.some((i) => i.partyId !== party.id)) {
    return 'One of the invoices doesn’t belong to this customer'
  }
  if (invoices.some((i) => balanceDue(i) <= 0)) return 'One of the invoices is already paid'

  if (input.bankLineId) {
    const line = ws.bankLines.find((l) => l.id === input.bankLineId)
    if (!line || line.status !== 'open' || line.direction !== 'in')
      return 'That bank line is no longer open'
    if (toPaise(line.amount) !== toPaise(input.amount)) {
      return `The receipt has to equal the bank line (${formatMoney(line.amount)})`
    }
  }
  return null
}

export function applyReceipt<T extends Workspace>(ws: T, input: ReceiptInput, meta: ActionMeta): T {
  const party = ws.parties.find((p) => p.id === input.partyId)!
  const selected = ws.invoices.filter((i) => input.invoiceIds.includes(i.id))
  const shares = allocateOldestFirst(input.amount, selected).filter((s) => s.amount > 0)

  const entry: LedgerEntry = {
    id: nextNumber(
      ws.ledger.map((e) => e.id),
      'L-',
    ),
    voucherNo: nextNumber(
      ws.ledger.map((e) => e.voucherNo),
      'RCT/',
    ),
    date: input.date,
    partyId: party.id,
    party: party.name,
    narration: `Receipt against ${shares.map((s) => s.invoiceId).join(', ')}`,
    ref: input.ref,
    amount: input.amount,
    direction: 'in',
    bankLineId: null,
  }

  const invoices = ws.invoices.map((invoice) => {
    const share = shares.find((s) => s.invoiceId === invoice.id)
    if (!share) return invoice
    return {
      ...invoice,
      allocations: [...invoice.allocations, { entryId: entry.id, amount: share.amount }],
      history: [
        ...invoice.history,
        {
          ...meta,
          action: 'paid' as const,
          note: `${entry.voucherNo}, ${formatMoney(share.amount)}`,
        },
      ],
    }
  })

  let next: T = { ...ws, ledger: [...ws.ledger, entry], invoices }
  if (input.bankLineId) {
    next = applyMatch(next, [{ lineId: input.bankLineId, ledgerIds: [entry.id] }], meta)
  }

  return withActivity(
    next,
    meta,
    'receivables',
    `Recorded ${formatMoney(input.amount)} from ${party.name} as ${entry.voucherNo}`,
    `/parties/${party.id}`,
  )
}

// ── Raising an invoice ─────────────────────────────────────────────────────

export interface InvoiceInput {
  partyId: string
  date: string
  amount: number
}

export function invoiceProblem(ws: Workspace, input: InvoiceInput): string | null {
  if (!ws.parties.some((p) => p.id === input.partyId && p.kind === 'customer'))
    return 'Choose a customer'
  if (!input.date) return 'Enter the invoice date'
  if (!(input.amount > 0)) return 'Enter an amount above zero'
  return null
}

export function applyNewInvoice<T extends Workspace>(
  ws: T,
  input: InvoiceInput,
  meta: ActionMeta,
): T {
  const party = ws.parties.find((p) => p.id === input.partyId)!
  const invoice: Invoice = {
    id: nextNumber(
      ws.invoices.map((i) => i.id),
      'INV-',
    ),
    partyId: party.id,
    date: input.date,
    dueDate: addDays(input.date, party.creditDays),
    amount: input.amount,
    allocations: [],
    history: [{ ...meta, action: 'created' }],
  }

  return withActivity(
    { ...ws, invoices: [...ws.invoices, invoice] },
    meta,
    'receivables',
    `Raised ${invoice.id} on ${party.name} for ${formatMoney(invoice.amount)}`,
    `/receivables/${invoice.id}`,
  )
}

// ── List view ──────────────────────────────────────────────────────────────

export interface InvoiceRow {
  invoice: Invoice
  partyName: string
  status: InvoiceStatus
  balance: number
  overdueDays: number
}

export const INVOICE_STATUS_FILTERS = ['open', 'overdue', 'due', 'partial', 'paid', 'all'] as const
export const INVOICE_SORTS = ['due', 'overdue', 'balance', 'newest'] as const

export interface InvoiceFilters {
  q: string
  status: (typeof INVOICE_STATUS_FILTERS)[number]
  sort: (typeof INVOICE_SORTS)[number]
}

export function toInvoiceRows(
  invoices: Invoice[],
  partyNames: Map<string, string>,
  today: string,
): InvoiceRow[] {
  return invoices.map((invoice) => ({
    invoice,
    partyName: partyNames.get(invoice.partyId) ?? 'Unknown customer',
    status: invoiceStatus(invoice, today),
    balance: balanceDue(invoice),
    overdueDays: daysOverdue(invoice.dueDate, today),
  }))
}

const INVOICE_SORTERS: Record<InvoiceFilters['sort'], (a: InvoiceRow, b: InvoiceRow) => number> = {
  due: (a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate),
  overdue: (a, b) => b.overdueDays - a.overdueDays,
  balance: (a, b) => b.balance - a.balance,
  newest: (a, b) => b.invoice.date.localeCompare(a.invoice.date),
}

export function statusMatches(row: InvoiceRow, status: InvoiceFilters['status']) {
  if (status === 'all') return true
  if (status === 'open') return row.status !== 'paid'
  return row.status === status
}

export function filterInvoices(
  rows: InvoiceRow[],
  { q, status, sort }: InvoiceFilters,
): InvoiceRow[] {
  const query = q.trim().toLowerCase()
  return rows
    .filter((row) => statusMatches(row, status))
    .filter(
      (row) =>
        !query ||
        row.invoice.id.toLowerCase().includes(query) ||
        row.partyName.toLowerCase().includes(query) ||
        row.invoice.amount.toFixed(2).includes(query),
    )
    .sort(INVOICE_SORTERS[sort])
}
