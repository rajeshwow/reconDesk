import type { BankLine, Bill, Invoice, Party } from '@/api/types'
import { formatMoney } from './format'

export interface SearchResult {
  key: string
  group: string
  title: string
  detail: string
  to: string
}

export interface SearchSources {
  pages: { to: string; label: string; description: string }[]
  parties: Party[]
  invoices: Invoice[]
  bills: Bill[]
  bankLines: BankLine[]
}

const PER_GROUP = 5

// Typing "kaveri", "INV-1043", "25000" or "chrgs" should all land somewhere useful.
export function searchEverything(query: string, sources: SearchSources): SearchResult[] {
  const q = query.trim().toLowerCase()
  const has = (...fields: (string | number | undefined)[]) =>
    fields.some((f) => f !== undefined && String(f).toLowerCase().includes(q))

  const partyName = new Map(sources.parties.map((p) => [p.id, p.name]))

  const pages = sources.pages
    .filter((p) => !q || has(p.label, p.description))
    .map((p) => ({
      key: `page-${p.to}`,
      group: 'Go to',
      title: p.label,
      detail: p.description,
      to: p.to,
    }))

  if (!q) return pages

  const parties = sources.parties
    .filter((p) => has(p.name, p.city, p.gstin))
    .map((p) => ({
      key: p.id,
      group: 'Customers & vendors',
      title: p.name,
      detail: `${p.kind === 'customer' ? 'Customer' : 'Vendor'} · ${p.city}`,
      to: `/parties/${p.id}`,
    }))

  const invoices = sources.invoices
    .filter((i) => has(i.id, partyName.get(i.partyId), i.amount.toFixed(2)))
    .map((i) => ({
      key: i.id,
      group: 'Invoices',
      title: i.id,
      detail: `${partyName.get(i.partyId)} · ${formatMoney(i.amount)}`,
      to: `/receivables/${i.id}`,
    }))

  const bills = sources.bills
    .filter((b) => has(b.number, b.id, partyName.get(b.partyId), b.amount.toFixed(2)))
    .map((b) => ({
      key: b.id,
      group: 'Bills',
      title: `Bill ${b.number}`,
      detail: `${partyName.get(b.partyId)} · ${formatMoney(b.amount)}`,
      to: `/payables/${b.id}`,
    }))

  const lines = sources.bankLines
    .filter((l) => has(l.narration, l.ref, l.amount.toFixed(2)))
    .map((l) => ({
      key: l.id,
      group: 'Bank lines',
      title: l.narration,
      detail: `${l.id} · ${formatMoney(l.amount)}`,
      to: `/reconciliation/lines/${l.id}`,
    }))

  return [pages, parties, invoices, bills, lines].flatMap((group) => group.slice(0, PER_GROUP))
}
