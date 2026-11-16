import { makeEntry, makeInvoice, makeLine, makeWorkspace, meta } from '@/test/factories'
import {
  allocateOldestFirst,
  applyReceipt,
  balanceDue,
  invoiceStatus,
  receiptProblem,
} from './receivables'

describe('invoiceStatus', () => {
  const today = '2026-10-15'

  it.each([
    ['due', makeInvoice({ dueDate: '2026-10-20' })],
    ['overdue', makeInvoice({ dueDate: '2026-10-01' })],
    [
      'partial',
      makeInvoice({ dueDate: '2026-10-20', allocations: [{ entryId: 'L-1', amount: 4_000 }] }),
    ],
    [
      'paid',
      makeInvoice({ dueDate: '2026-10-01', allocations: [{ entryId: 'L-1', amount: 10_000 }] }),
    ],
  ])('%s', (status, invoice) => {
    expect(invoiceStatus(invoice, today)).toBe(status)
  })

  it('works out the balance in paise', () => {
    const invoice = makeInvoice({
      amount: 0.3,
      allocations: [
        { entryId: 'L-1', amount: 0.1 },
        { entryId: 'L-2', amount: 0.2 },
      ],
    })
    expect(balanceDue(invoice)).toBe(0)
  })
})

describe('allocateOldestFirst', () => {
  it('fills the oldest invoice first and leaves the rest on the next one', () => {
    const older = makeInvoice({ id: 'old', date: '2026-08-01', amount: 6_000 })
    const newer = makeInvoice({ id: 'new', date: '2026-09-01', amount: 6_000 })

    expect(allocateOldestFirst(8_000, [newer, older])).toEqual([
      { invoiceId: 'old', amount: 6_000 },
      { invoiceId: 'new', amount: 2_000 },
    ])
  })
})

describe('recording a receipt from a bank line', () => {
  const ws = makeWorkspace({
    invoices: [makeInvoice({ amount: 25_000 })],
    bankLines: [makeLine()],
    ledger: [makeEntry({ id: 'L-7', voucherNo: 'RCT/151', bankLineId: 'B-0' })],
  })
  const input = {
    partyId: 'C-01',
    date: '2026-10-10',
    amount: 25_000,
    ref: 'X',
    invoiceIds: ['INV-1001'],
    bankLineId: 'B-1',
  }

  it('creates the next voucher, settles the invoice and matches the line', () => {
    const next = applyReceipt(ws, input, meta)
    const entry = next.ledger.at(-1)!

    expect(entry).toMatchObject({
      id: 'L-8',
      voucherNo: 'RCT/152',
      amount: 25_000,
      bankLineId: 'B-1',
    })
    expect(next.invoices[0].allocations).toEqual([{ entryId: 'L-8', amount: 25_000 }])
    expect(next.bankLines[0]).toMatchObject({ status: 'matched', ledgerIds: ['L-8'] })
    expect(next.activity[0].module).toBe('receivables')
  })

  it('refuses an amount that differs from the bank line', () => {
    expect(receiptProblem(ws, { ...input, amount: 24_000 })).toMatch(/has to equal the bank line/)
  })

  it('refuses an invoice that belongs to someone else', () => {
    const other = makeWorkspace({ ...ws, invoices: [makeInvoice({ partyId: 'C-99' })] })
    expect(receiptProblem(other, input)).toMatch(/doesn’t belong/)
  })
})
