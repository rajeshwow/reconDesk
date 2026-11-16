export type Direction = 'in' | 'out'

export interface AuditEvent {
  at: string
  by: string
  action:
    | 'imported'
    | 'matched'
    | 'unmatched'
    | 'excluded'
    | 'reopened'
    | 'posted'
    | 'created'
    | 'approved'
    | 'rejected'
    | 'paid'
  note?: string
}

// ── Parties ────────────────────────────────────────────────────────────────

export type PartyKind = 'customer' | 'vendor'

export interface Party {
  id: string
  name: string
  kind: PartyKind
  gstin: string
  city: string
  email: string
  phone: string
  creditDays: number
}

// ── Receivables ────────────────────────────────────────────────────────────

// How much of a receipt voucher went towards an invoice.
export interface Allocation {
  entryId: string
  amount: number
}

export interface Invoice {
  /** Our own invoice number, e.g. INV-1043. */
  id: string
  partyId: string
  date: string
  dueDate: string
  amount: number
  allocations: Allocation[]
  history: AuditEvent[]
}

// ── Payables ───────────────────────────────────────────────────────────────

export type BillStatus = 'awaiting_approval' | 'approved' | 'rejected' | 'paid'

export interface Bill {
  id: string
  number: string
  partyId: string
  date: string
  dueDate: string
  amount: number
  category: string
  status: BillStatus
  paymentEntryId: string | null
  rejectReason?: string
  history: AuditEvent[]
}

// ── Bank and books ─────────────────────────────────────────────────────────

export type BankLineStatus = 'open' | 'matched' | 'excluded'

export interface BankLine {
  id: string
  date: string
  narration: string
  ref: string
  amount: number
  direction: Direction
  status: BankLineStatus
  ledgerIds: string[]
  excludeReason?: string
  history: AuditEvent[]
}

export interface LedgerEntry {
  id: string
  date: string
  voucherNo: string
  partyId: string | null
  party: string
  narration: string
  ref: string
  amount: number
  direction: Direction
  bankLineId: string | null
}

export interface BankAccount {
  bank: string
  name: string
  number: string
  openingBalance: number
}

export interface Reconciliation {
  account: BankAccount
  period: { from: string; to: string }
  bankLines: BankLine[]
  ledger: LedgerEntry[]
}

export interface MatchPair {
  lineId: string
  ledgerIds: string[]
}

export interface Exclusion {
  lineId: string
  reason: string
}

// ── Settings and activity ──────────────────────────────────────────────────

export interface ExclusionRule {
  id: string
  contains: string
  reason: string
  enabled: boolean
}

export interface Settings {
  /** Percent. A single book entry may differ from the bank line by this much. */
  amountTolerance: number
  /** Book entries further apart than this are not suggested at all. */
  dateWindowDays: number
  rules: ExclusionRule[]
}

export type Module = 'reconciliation' | 'receivables' | 'payables' | 'settings'

export interface ActivityEvent {
  id: string
  at: string
  by: string
  module: Module
  text: string
  link?: string
}

// Everything the mock server keeps. Each API call returns only the slice it owns.
export interface Workspace extends Reconciliation {
  parties: Party[]
  invoices: Invoice[]
  bills: Bill[]
  activity: ActivityEvent[]
  settings: Settings
}
