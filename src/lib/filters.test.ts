import { makeEntry, makeLine, makeRecon } from '@/test/factories'
import { bucketFor } from './aging'
import { buildRows, DEFAULT_FILTERS, filterRows, parseFilters, toSearchParams } from './filters'

describe('URL filters', () => {
  it('falls back to defaults for missing or junk values', () => {
    const filters = parseFilters(new URLSearchParams('status=banana&sort=sideways'))
    expect(filters).toEqual(DEFAULT_FILTERS)
  })

  it('round-trips through the URL and leaves defaults out', () => {
    const filters = { ...DEFAULT_FILTERS, q: 'kaveri', direction: 'in' as const }
    const params = toSearchParams(filters)

    expect(params.toString()).toBe('q=kaveri&direction=in')
    expect(parseFilters(params)).toEqual(filters)
  })
})

describe('filterRows', () => {
  const data = makeRecon(
    [
      makeLine({ id: 'B-1', date: '2026-10-20', amount: 25_000 }),
      makeLine({
        id: 'B-2',
        date: '2026-10-05',
        amount: 900,
        narration: 'CHRGS NEFT',
        ref: '',
        direction: 'out',
      }),
      makeLine({
        id: 'B-3',
        date: '2026-10-12',
        amount: 5_000,
        status: 'matched',
        ledgerIds: ['L-9'],
      }),
    ],
    [makeEntry({ date: '2026-10-20' })],
  )
  const rows = buildRows(data, '2026-10-31')

  it('shows only lines that need attention by default', () => {
    expect(filterRows(rows, DEFAULT_FILTERS).map((r) => r.line.id)).toEqual(['B-1', 'B-2'])
  })

  it('searches narration, reference, amount and suggested party', () => {
    const search = (q: string) =>
      filterRows(rows, { ...DEFAULT_FILTERS, status: 'all', q }).map((r) => r.line.id)
    expect(search('chrgs')).toEqual(['B-2'])
    expect(search('25000')).toEqual(['B-1'])
    expect(search('kaveri')).toContain('B-1')
  })

  it('sorts by amount', () => {
    const sorted = filterRows(rows, { ...DEFAULT_FILTERS, status: 'all', sort: 'amount-desc' })
    expect(sorted.map((r) => r.line.amount)).toEqual([25_000, 5_000, 900])
  })

  it('marks open lines with a candidate as suggested', () => {
    expect(rows.find((r) => r.line.id === 'B-1')?.status).toBe('suggested')
    expect(rows.find((r) => r.line.id === 'B-2')?.status).toBe('open')
  })
})

describe('bucketFor', () => {
  it.each([
    [0, '0-7'],
    [7, '0-7'],
    [8, '8-15'],
    [30, '16-30'],
    [31, '30+'],
  ])('%i days -> %s', (days, bucket) => {
    expect(bucketFor(days)).toBe(bucket)
  })
})
