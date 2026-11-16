import type { BankLine, Direction, Reconciliation } from '@/api/types'
import { AGE_BUCKETS, bucketFor, type AgeBucketKey } from './aging'
import { daysBetween } from './dates'
import {
  DEFAULT_MATCH_SETTINGS,
  suggestMatches,
  type Candidate,
  type Confidence,
  type MatchSettings,
} from './matching'

export type RowStatus = 'open' | 'suggested' | 'matched' | 'excluded'
export type StatusFilter = 'unresolved' | 'all' | RowStatus
export type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'confidence'

export interface Filters {
  q: string
  status: StatusFilter
  direction: 'all' | Direction
  confidence: 'all' | Confidence
  age: 'all' | AgeBucketKey
  sort: SortKey
}

export const DEFAULT_FILTERS: Filters = {
  q: '',
  status: 'unresolved',
  direction: 'all',
  confidence: 'all',
  age: 'all',
  sort: 'date-desc',
}

export const STATUS_OPTIONS: StatusFilter[] = [
  'unresolved',
  'all',
  'open',
  'suggested',
  'matched',
  'excluded',
]
export const DIRECTION_OPTIONS: Filters['direction'][] = ['all', 'in', 'out']
export const CONFIDENCE_OPTIONS: Filters['confidence'][] = ['all', 'high', 'medium', 'low']
export const AGE_OPTIONS: Filters['age'][] = ['all', ...AGE_BUCKETS.map((b) => b.key)]
export const SORT_OPTIONS: SortKey[] = [
  'date-desc',
  'date-asc',
  'amount-desc',
  'amount-asc',
  'confidence',
]

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

// Anything unknown in the URL quietly falls back to the default instead of breaking the page.
export function parseFilters(params: URLSearchParams): Filters {
  return {
    q: params.get('q') ?? '',
    status: oneOf(params.get('status'), STATUS_OPTIONS, DEFAULT_FILTERS.status),
    direction: oneOf(params.get('direction'), DIRECTION_OPTIONS, DEFAULT_FILTERS.direction),
    confidence: oneOf(params.get('confidence'), CONFIDENCE_OPTIONS, DEFAULT_FILTERS.confidence),
    age: oneOf(params.get('age'), AGE_OPTIONS, DEFAULT_FILTERS.age),
    sort: oneOf(params.get('sort'), SORT_OPTIONS, DEFAULT_FILTERS.sort),
  }
}

export function toSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams()
  for (const key of Object.keys(filters) as (keyof Filters)[]) {
    const value = filters[key]
    if (value && value !== DEFAULT_FILTERS[key]) params.set(key, value)
  }
  return params
}

export function countActiveFilters(filters: Filters): number {
  const keys: (keyof Filters)[] = ['q', 'status', 'direction', 'confidence', 'age']
  return keys.filter((key) => filters[key] !== DEFAULT_FILTERS[key]).length
}

export interface BankRow {
  line: BankLine
  status: RowStatus
  suggestion?: Candidate
  age: number
  bucket: AgeBucketKey
}

export function buildRows(
  data: Reconciliation,
  today: string,
  settings: MatchSettings = DEFAULT_MATCH_SETTINGS,
): BankRow[] {
  const suggestions = suggestMatches(data.bankLines, data.ledger, settings)

  return data.bankLines.map((line) => {
    const suggestion = suggestions.get(line.id)
    const age = daysBetween(line.date, today)
    const status: RowStatus =
      line.status === 'open' ? (suggestion ? 'suggested' : 'open') : line.status
    return { line, status, suggestion, age, bucket: bucketFor(age) }
  })
}

const isUnresolved = (status: RowStatus) => status === 'open' || status === 'suggested'

function statusMatches(status: RowStatus, filter: StatusFilter) {
  if (filter === 'all') return true
  if (filter === 'unresolved') return isUnresolved(status)
  return status === filter
}

function searchMatches(row: BankRow, query: string) {
  const fields = [
    row.line.narration,
    row.line.ref,
    row.line.amount.toFixed(2),
    row.suggestion?.entry.party,
  ]
  return fields.some((field) => field?.toLowerCase().includes(query))
}

const SORTERS: Record<SortKey, (a: BankRow, b: BankRow) => number> = {
  'date-desc': (a, b) => b.line.date.localeCompare(a.line.date),
  'date-asc': (a, b) => a.line.date.localeCompare(b.line.date),
  'amount-desc': (a, b) => b.line.amount - a.line.amount,
  'amount-asc': (a, b) => a.line.amount - b.line.amount,
  confidence: (a, b) => (b.suggestion?.score ?? -1) - (a.suggestion?.score ?? -1),
}

export function filterRows(rows: BankRow[], filters: Filters): BankRow[] {
  const query = filters.q.trim().toLowerCase()

  return rows
    .filter((row) => {
      if (!statusMatches(row.status, filters.status)) return false
      if (filters.direction !== 'all' && row.line.direction !== filters.direction) return false
      if (filters.confidence !== 'all' && row.suggestion?.confidence !== filters.confidence)
        return false
      if (filters.age !== 'all' && row.bucket !== filters.age) return false
      return !query || searchMatches(row, query)
    })
    .sort(SORTERS[filters.sort])
}

export function unresolvedRows(rows: BankRow[]) {
  return rows.filter((row) => isUnresolved(row.status))
}
