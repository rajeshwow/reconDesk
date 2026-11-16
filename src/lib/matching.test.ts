import { makeEntry, makeLine } from '@/test/factories'
import { rankCandidates, scoreCandidate, suggestMatches } from './matching'

describe('scoreCandidate', () => {
  it('rates exact amount, same date and same reference as high confidence', () => {
    const result = scoreCandidate(makeLine(), makeEntry())
    expect(result?.confidence).toBe('high')
    expect(result?.reasons).toContain('Reference number matches')
  })

  it('never pairs money in with money out', () => {
    expect(
      scoreCandidate(makeLine({ direction: 'in' }), makeEntry({ direction: 'out' })),
    ).toBeNull()
  })

  it('accepts a small short payment but scores it lower', () => {
    const shortPaid = scoreCandidate(makeLine({ amount: 24_750 }), makeEntry())
    expect(shortPaid).not.toBeNull()
    expect(shortPaid!.score).toBeLessThan(scoreCandidate(makeLine(), makeEntry())!.score)
  })

  it('rejects amounts that are clearly different', () => {
    expect(scoreCandidate(makeLine({ amount: 30_000 }), makeEntry())).toBeNull()
  })

  it('does not care about float noise in amounts', () => {
    const result = scoreCandidate(makeLine({ amount: 0.1 + 0.2 }), makeEntry({ amount: 0.3 }))
    expect(result?.reasons).toContain('Amount matches exactly')
  })
})

describe('rankCandidates', () => {
  it('skips entries that are already matched and puts the best first', () => {
    const line = makeLine()
    const ledger = [
      makeEntry({ id: 'taken', bankLineId: 'B-9' }),
      makeEntry({ id: 'weaker', ref: '', date: '2026-10-07' }),
      makeEntry({ id: 'best' }),
    ]
    expect(rankCandidates(line, ledger).map((c) => c.entry.id)).toEqual(['best', 'weaker'])
  })
})

describe('suggestMatches', () => {
  it('never suggests the same book entry for two bank lines', () => {
    const lines = [
      makeLine({ id: 'B-1' }),
      makeLine({ id: 'B-2', ref: 'OTHER', date: '2026-10-12' }),
    ]
    const suggestions = suggestMatches(lines, [makeEntry({ id: 'L-1' })])

    expect(suggestions.get('B-1')?.entry.id).toBe('L-1')
    expect(suggestions.has('B-2')).toBe(false)
  })

  it('ignores lines that are already reconciled', () => {
    const suggestions = suggestMatches([makeLine({ status: 'excluded' })], [makeEntry()])
    expect(suggestions.size).toBe(0)
  })
})
