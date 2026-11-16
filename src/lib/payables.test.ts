import { makeBill, makeLine, makeWorkspace, meta } from '@/test/factories'
import {
  applyBillDecision,
  applyBillPayment,
  billProblem,
  decisionProblem,
  paymentProblem,
} from './payables'

describe('bill entry', () => {
  it('catches the same vendor bill keyed in twice', () => {
    const ws = makeWorkspace({ bills: [makeBill({ number: 'GPM/101' })] })
    const input = {
      partyId: 'V-01',
      number: ' gpm/101 ',
      date: '2026-10-05',
      amount: 100,
      category: 'Freight',
    }
    expect(billProblem(ws, input)).toMatch(/already entered/)
  })

  it('allows the number again if the first one was rejected', () => {
    const ws = makeWorkspace({ bills: [makeBill({ number: 'GPM/101', status: 'rejected' })] })
    const input = {
      partyId: 'V-01',
      number: 'GPM/101',
      date: '2026-10-05',
      amount: 100,
      category: 'Freight',
    }
    expect(billProblem(ws, input)).toBeNull()
  })
})

describe('approval', () => {
  const ws = makeWorkspace({ bills: [makeBill({ status: 'awaiting_approval' })] })

  it('needs a reason to reject', () => {
    expect(decisionProblem(ws, { billId: 'BL-1', approve: false, reason: ' ' })).toMatch(/reason/)
  })

  it('records who approved it', () => {
    const next = applyBillDecision(ws, { billId: 'BL-1', approve: true }, meta)
    expect(next.bills[0].status).toBe('approved')
    expect(next.bills[0].history.at(-1)).toMatchObject({ action: 'approved', by: 'Tester' })
  })

  it('can’t be decided twice', () => {
    const approved = applyBillDecision(ws, { billId: 'BL-1', approve: true }, meta)
    expect(decisionProblem(approved, { billId: 'BL-1', approve: true })).toMatch(
      /already been decided/,
    )
  })
})

describe('payment', () => {
  it('only pays approved bills', () => {
    const ws = makeWorkspace({ bills: [makeBill({ status: 'awaiting_approval' })] })
    expect(paymentProblem(ws, { billId: 'BL-1', date: '2026-10-20', ref: '' })).toMatch(/approved/)
  })

  it('posts a payment voucher and matches the bank debit', () => {
    const ws = makeWorkspace({
      bills: [makeBill()],
      bankLines: [makeLine({ direction: 'out', amount: 40_000, narration: 'IMPS/GANGA PAPER' })],
    })
    const input = { billId: 'BL-1', date: '2026-10-10', ref: '', bankLineId: 'B-1' }

    expect(paymentProblem(ws, input)).toBeNull()
    const next = applyBillPayment(ws, input, meta)
    expect(next.bills[0]).toMatchObject({ status: 'paid', paymentEntryId: 'L-1' })
    expect(next.ledger[0]).toMatchObject({
      voucherNo: 'PMT/1',
      direction: 'out',
      bankLineId: 'B-1',
    })
  })

  it('won’t match a debit for a different amount', () => {
    const ws = makeWorkspace({
      bills: [makeBill()],
      bankLines: [makeLine({ direction: 'out', amount: 10_000 })],
    })
    expect(
      paymentProblem(ws, { billId: 'BL-1', date: '2026-10-10', ref: '', bankLineId: 'B-1' }),
    ).toMatch(/don’t balance/)
  })
})
