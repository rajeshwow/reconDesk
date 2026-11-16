import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import {
  CONFIDENCE_OPTIONS,
  DIRECTION_OPTIONS,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  type Filters,
} from '@/lib/filters'
import styles from './FilterBar.module.css'

const LABELS: Record<string, string> = {
  unresolved: 'Needs attention',
  all: 'All',
  open: 'Unmatched',
  suggested: 'Suggested',
  matched: 'Matched',
  excluded: 'Excluded',
  in: 'Money in',
  out: 'Money out',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  'date-desc': 'Newest first',
  'date-asc': 'Oldest first',
  'amount-desc': 'Largest amount',
  'amount-asc': 'Smallest amount',
  confidence: 'Best match first',
}

function toOptions<T extends string>(values: T[], allLabel = 'All') {
  return values.map((value) => ({ value, label: value === 'all' ? allLabel : LABELS[value] }))
}

interface FilterBarProps {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
  activeCount: number
}

export function FilterBar({ filters, onChange, onReset, activeCount }: FilterBarProps) {
  return (
    <div className={styles.bar} role="search" aria-label="Filter bank lines">
      <div className={styles.searchField}>
        <label htmlFor="line-search" className={styles.label}>
          Search
        </label>
        <input
          id="line-search"
          type="search"
          className={styles.search}
          placeholder="Narration, reference, amount or party"
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </div>
      <Select
        label="Status"
        value={filters.status}
        options={toOptions(STATUS_OPTIONS)}
        onChange={(status) => onChange({ status })}
      />
      <Select
        label="Direction"
        value={filters.direction}
        options={toOptions(DIRECTION_OPTIONS, 'In & out')}
        onChange={(direction) => onChange({ direction })}
      />
      <Select
        label="Match confidence"
        value={filters.confidence}
        options={toOptions(CONFIDENCE_OPTIONS, 'Any')}
        onChange={(confidence) => onChange({ confidence })}
      />
      <Select
        label="Sort by"
        value={filters.sort}
        options={toOptions(SORT_OPTIONS)}
        onChange={(sort) => onChange({ sort })}
      />
      {activeCount > 0 && (
        <Button variant="ghost" className={styles.clear} onClick={onReset}>
          Clear filters ({activeCount})
        </Button>
      )}
    </div>
  )
}
