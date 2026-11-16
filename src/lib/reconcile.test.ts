import { makeEntry, makeLine, makeRecon, meta } from '@/test/factories'
import { applyExclude, applyMatch, applyReopen, findMatchProblem, matchError } from './reconcile'

describe('matchError', () => {
  it('allows a split payment when the entries add up exactly', () => {
    const line = makeLine({ amount: 30_000 })
    const entries = [makeEntry({ id: 'a', amount: 12_500 }), makeEntry({ id: 'b', amount: 17_500 })]
    expect(matchError(line, entries)).toBeNull()
  })

  it('blocks a split payment that does not balance', () => {
    const line = makeLine({ amount: 30_000 })
    const entries = [makeEntry({ id: 'a', amount: 12_500 }), makeEntry({ id: 'b', amount: 17_000 })]
    expect(matchError(line, entries)).toMatch(/don’t balance/)
  })

  it('blocks entries that are already matched elsewhere', () => {
    expect(matchError(makeLine(), [makeEntry({ bankLineId: 'B-9' })])).toMatch(/already matched/)
  })
})

describe('findMatchProblem', () => {
  it('reports unknown ids instead of throwing', () => {
    const data = makeRecon([makeLine()], [makeEntry()])
    expect(findMatchProblem(data, { lineId: 'nope', ledgerIds: ['L-1'] })).toBe(
      'Bank line not found',
    )
    expect(findMatchProblem(data, { lineId: 'B-1', ledgerIds: ['nope'] })).toBe(
      'Book entry not found',
    )
  })
})

describe('state transitions', () => {
  const data = makeRecon([makeLine()], [makeEntry()])

  it('match links both sides and records who did it', () => {
    const next = applyMatch(data, [{ lineId: 'B-1', ledgerIds: ['L-1'] }], meta)

    expect(next.bankLines[0]).toMatchObject({ status: 'matched', ledgerIds: ['L-1'] })
    expect(next.ledger[0].bankLineId).toBe('B-1')
    expect(next.bankLines[0].history.at(-1)).toMatchObject({
      action: 'matched',
      by: 'Tester',
      note: 'RCT/101',
    })
  })

  it('does not mutate the previous state (needed for rollback)', () => {
    applyMatch(data, [{ lineId: 'B-1', ledgerIds: ['L-1'] }], meta)
    expect(data.bankLines[0].status).toBe('open')
    expect(data.ledger[0].bankLineId).toBeNull()
  })

  it('reopen releases the book entries again', () => {
    const matched = applyMatch(data, [{ lineId: 'B-1', ledgerIds: ['L-1'] }], meta)
    const reopened = applyReopen(matched, ['B-1'], meta)

    expect(reopened.bankLines[0]).toMatchObject({ status: 'open', ledgerIds: [] })
    expect(reopened.ledger[0].bankLineId).toBeNull()
    expect(reopened.bankLines[0].history.at(-1)?.action).toBe('unmatched')
  })

  it('exclude keeps the reason, and reopen clears it', () => {
    const excluded = applyExclude(data, [{ lineId: 'B-1', reason: 'Bank charges' }], meta)
    expect(excluded.bankLines[0]).toMatchObject({
      status: 'excluded',
      excludeReason: 'Bank charges',
    })

    const reopened = applyReopen(excluded, ['B-1'], meta)
    expect(reopened.bankLines[0].excludeReason).toBeUndefined()
    expect(reopened.bankLines[0].history.at(-1)?.action).toBe('reopened')
  })
})
