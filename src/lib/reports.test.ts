import { createSeed } from '@/api/seed'
import { makeBill, makeEntry, makeInvoice, makeLine, makeParty, makeRecon } from '@/test/factories'
import { buildAging, receivableItems } from './agingReport'
import { buildBrs } from './brs'
import { exclusionsFromRules } from './rules'
import { buildStatement } from './statement'

describe('bank reconciliation statement', () => {
  it('walks from the book balance to the bank balance', () => {
    const data = makeRecon(
      [
        makeLine({ id: 'B-1', amount: 990, status: 'matched', ledgerIds: ['L-1'] }), // short by TDS
        makeLine({ id: 'B-2', amount: 59, direction: 'out' }), // bank charges
      ],
      [
        makeEntry({ id: 'L-1', amount: 1_000, bankLineId: 'B-1' }),
        makeEntry({ id: 'L-2', amount: 5_000, direction: 'out' }), // cheque not presented
      ],
    )
    const brs = buildBrs(data)

    expect(brs.bookBalance).toBe(96_000)
    expect(brs.bankBalance).toBe(100_931)
    expect(brs.adjustments.find((a) => a.key === 'not-presented')?.amount).toBe(5_000)
    expect(brs.adjustments.find((a) => a.key === 'short')?.amount).toBe(-10)
    expect(brs.difference).toBe(0)
  })

  it('always ties out on the demo data', () => {
    expect(buildBrs(createSeed('2026-11-14')).difference).toBe(0)
  })
})

describe('aging', () => {
  it('puts each balance in the right bucket and totals it', () => {
    const invoices = [
      makeInvoice({ id: 'a', dueDate: '2026-11-20', amount: 100 }),
      makeInvoice({ id: 'b', dueDate: '2026-10-20', amount: 200 }),
      makeInvoice({ id: 'c', dueDate: '2026-07-01', amount: 300 }),
      makeInvoice({
        id: 'd',
        dueDate: '2026-07-01',
        amount: 999,
        allocations: [{ entryId: 'x', amount: 999 }],
      }),
    ]
    const { rows, grand } = buildAging(receivableItems(invoices), '2026-11-14')

    expect(rows).toHaveLength(1)
    expect(grand).toMatchObject({ current: 100, '1-30': 200, '90+': 300, total: 600 })
  })
})

describe('statement of account', () => {
  it('shows invoices as debits and receipts as credits for a customer', () => {
    const lines = buildStatement(
      makeParty(),
      [makeInvoice({ date: '2026-10-01', amount: 1_000 })],
      [],
      [makeEntry({ date: '2026-10-05', amount: 400 })],
    )
    expect(lines.map((l) => [l.debit, l.credit, l.balance])).toEqual([
      [1_000, 0, 1_000],
      [0, 400, 600],
    ])
  })

  it('flips the sides for a vendor and leaves out rejected bills', () => {
    const vendor = makeParty({ id: 'V-01', kind: 'vendor' })
    const lines = buildStatement(
      vendor,
      [],
      [makeBill({ amount: 700 }), makeBill({ id: 'BL-2', status: 'rejected' })],
      [makeEntry({ partyId: 'V-01', direction: 'out', amount: 700, date: '2026-10-20' })],
    )
    expect(lines.map((l) => [l.debit, l.credit, l.balance])).toEqual([
      [0, 700, 700],
      [700, 0, 0],
    ])
  })
})

describe('exclusion rules', () => {
  const rules = [
    { id: 'R-1', contains: 'chrgs', reason: 'Bank charges', enabled: true },
    { id: 'R-2', contains: 'NACH', reason: 'Insurance', enabled: false },
  ]

  it('matches narration case-insensitively and skips disabled rules and closed lines', () => {
    const lines = [
      makeLine({ id: 'B-1', narration: 'CHRGS NEFT 1234' }),
      makeLine({ id: 'B-2', narration: 'NACH DR/LIC' }),
      makeLine({ id: 'B-3', narration: 'CHRGS NEFT 999', status: 'excluded' }),
    ]
    expect(exclusionsFromRules(lines, rules)).toEqual([
      { lineId: 'B-1', reason: 'Bank charges (rule: “chrgs”)' },
    ])
  })
})
