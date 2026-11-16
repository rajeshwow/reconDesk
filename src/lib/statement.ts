import type { Bill, Invoice, LedgerEntry, Party } from '@/api/types'
import { daysBetween } from './dates'
import { toPaise } from './format'
import { isBillOpen, isBillOverdue } from './payables'
import { balanceDue, invoiceStatus } from './receivables'

export interface StatementLine {
  key: string
  date: string
  particulars: string
  debit: number
  credit: number
  /** Positive means they owe us (customer) or we owe them (vendor). */
  balance: number
  link?: string
}

// Statement of account, the way a customer or vendor would see it reconciled against
// their own books. Customers: invoices are debits, receipts credits. Vendors: the reverse.
export function buildStatement(
  party: Party,
  invoices: Invoice[],
  bills: Bill[],
  ledger: LedgerEntry[],
): StatementLine[] {
  const isCustomer = party.kind === 'customer'
  const payments = ledger.filter((e) => e.partyId === party.id)

  const documents = isCustomer
    ? invoices
        .filter((i) => i.partyId === party.id)
        .map((i) => ({
          key: i.id,
          date: i.date,
          particulars: `Invoice ${i.id}`,
          amount: i.amount,
          link: `/receivables/${i.id}`,
        }))
    : bills
        .filter((b) => b.partyId === party.id && b.status !== 'rejected')
        .map((b) => ({
          key: b.id,
          date: b.date,
          particulars: `Bill ${b.number}`,
          amount: b.amount,
          link: `/payables/${b.id}`,
        }))

  const settlements = payments.map((e) => ({
    key: e.id,
    date: e.date,
    particulars: `${isCustomer ? 'Receipt' : 'Payment'} ${e.voucherNo}${e.ref ? ` · ${e.ref}` : ''}`,
    amount: e.amount,
    link: e.bankLineId ? `/reconciliation/lines/${e.bankLineId}` : undefined,
  }))

  // Documents before settlements on the same day, so the balance never dips below zero
  // just because of ordering.
  const rows = [
    ...documents.map((d) => ({ ...d, increases: true })),
    ...settlements.map((s) => ({ ...s, increases: false })),
  ].sort((a, b) => a.date.localeCompare(b.date) || Number(b.increases) - Number(a.increases))

  let running = 0
  return rows.map(({ increases, amount, ...row }) => {
    running += increases ? toPaise(amount) : -toPaise(amount)
    const owedSide = increases === isCustomer
    return {
      ...row,
      debit: owedSide ? amount : 0,
      credit: owedSide ? 0 : amount,
      balance: running / 100,
    }
  })
}

export interface PartyBalance {
  outstanding: number
  overdue: number
  openCount: number
}

export function partyBalance(
  party: Party,
  invoices: Invoice[],
  bills: Bill[],
  today: string,
): PartyBalance {
  const items =
    party.kind === 'customer'
      ? invoices
          .filter((i) => i.partyId === party.id && balanceDue(i) > 0)
          .map((i) => ({ amount: balanceDue(i), overdue: invoiceStatus(i, today) === 'overdue' }))
      : bills
          .filter((b) => b.partyId === party.id && isBillOpen(b))
          .map((b) => ({ amount: b.amount, overdue: isBillOverdue(b, today) }))

  const total = (list: typeof items) => list.reduce((sum, i) => sum + toPaise(i.amount), 0) / 100
  return {
    outstanding: total(items),
    overdue: total(items.filter((i) => i.overdue)),
    openCount: items.length,
  }
}

// How long this customer takes to pay, weighted by amount: a late ₹5L invoice matters
// more than a late ₹5K one.
export function averageDaysToPay(
  party: Party,
  invoices: Invoice[],
  ledger: LedgerEntry[],
): number | null {
  const receiptDates = new Map(ledger.map((e) => [e.id, e.date]))
  let weightedDays = 0
  let weight = 0

  for (const invoice of invoices.filter((i) => i.partyId === party.id)) {
    for (const allocation of invoice.allocations) {
      const paidOn = receiptDates.get(allocation.entryId)
      if (!paidOn) continue
      weightedDays += daysBetween(invoice.date, paidOn) * allocation.amount
      weight += allocation.amount
    }
  }
  return weight === 0 ? null : Math.round(weightedDays / weight)
}
