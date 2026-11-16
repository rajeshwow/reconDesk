import type {
  BankLine,
  Bill,
  Invoice,
  LedgerEntry,
  Party,
  Reconciliation,
  Workspace,
} from '@/api/types'
import { DEFAULT_MATCH_SETTINGS } from '@/lib/matching'

export function makeLine(overrides: Partial<BankLine> = {}): BankLine {
  return {
    id: 'B-1',
    date: '2026-10-10',
    narration: 'NEFT CR-HDFCR512345678-KAVERI ELECTRICALS',
    ref: 'HDFCR512345678',
    amount: 25_000,
    direction: 'in',
    status: 'open',
    ledgerIds: [],
    history: [],
    ...overrides,
  }
}

export function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'L-1',
    date: '2026-10-10',
    voucherNo: 'RCT/101',
    partyId: 'C-01',
    party: 'Kaveri Electricals',
    narration: 'Receipt against invoices',
    ref: 'HDFCR512345678',
    amount: 25_000,
    direction: 'in',
    bankLineId: null,
    ...overrides,
  }
}

export function makeParty(overrides: Partial<Party> = {}): Party {
  return {
    id: 'C-01',
    name: 'Kaveri Electricals',
    kind: 'customer',
    gstin: '29ABCDE1234F1Z5',
    city: 'Bengaluru',
    email: 'accounts@kaveri.in',
    phone: '+91 9800000000',
    creditDays: 30,
    ...overrides,
  }
}

export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'INV-1001',
    partyId: 'C-01',
    date: '2026-09-01',
    dueDate: '2026-10-01',
    amount: 10_000,
    allocations: [],
    history: [],
    ...overrides,
  }
}

export function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'BL-1',
    number: 'GPM/101',
    partyId: 'V-01',
    date: '2026-10-01',
    dueDate: '2026-10-31',
    amount: 40_000,
    category: 'Raw material',
    status: 'approved',
    paymentEntryId: null,
    history: [],
    ...overrides,
  }
}

export function makeRecon(bankLines: BankLine[], ledger: LedgerEntry[]): Reconciliation {
  return {
    account: { bank: 'Test Bank', name: 'Current', number: 'XXXX0001', openingBalance: 100_000 },
    period: { from: '2026-10-01', to: '2026-10-31' },
    bankLines,
    ledger,
  }
}

export function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    ...makeRecon([], []),
    parties: [makeParty(), makeParty({ id: 'V-01', name: 'Ganga Paper Mills', kind: 'vendor' })],
    invoices: [],
    bills: [],
    activity: [],
    settings: { ...DEFAULT_MATCH_SETTINGS, rules: [] },
    ...overrides,
  }
}

export const meta = { by: 'Tester', at: '2026-10-31T10:00:00.000Z' }
