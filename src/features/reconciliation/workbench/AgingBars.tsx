import { AGE_BUCKETS, type AgeBucketKey } from '@/lib/aging'
import { unresolvedRows, type BankRow, type Filters } from '@/lib/filters'
import { formatMoney, sumAmounts } from '@/lib/format'
import styles from './AgingBars.module.css'

interface AgingBarsProps {
  rows: BankRow[]
  active: Filters['age']
  onSelect: (age: Filters['age']) => void
}

// Four bars don't need a chart library. Plain buttons are keyboard-friendly, read well
// on a screen reader, and double as the age filter.
export function AgingBars({ rows, active, onSelect }: AgingBarsProps) {
  const open = unresolvedRows(rows)
  const buckets = AGE_BUCKETS.map((bucket) => {
    const items = open.filter((row) => row.bucket === bucket.key).map((row) => row.line)
    return { ...bucket, count: items.length, amount: sumAmounts(items) }
  })
  const largest = Math.max(1, ...buckets.map((b) => b.count))

  const toggle = (key: AgeBucketKey) => onSelect(active === key ? 'all' : key)

  return (
    <section className={styles.card} aria-labelledby="aging-heading">
      <div className={styles.header}>
        <h2 id="aging-heading" className={styles.heading}>
          Unresolved by age
        </h2>
        <span className={styles.hint}>Select a bar to filter</span>
      </div>
      <ul className={styles.bars}>
        {buckets.map((bucket) => (
          <li key={bucket.key}>
            <button
              type="button"
              className={styles.bar}
              aria-pressed={active === bucket.key}
              onClick={() => toggle(bucket.key)}
            >
              <span className={styles.label}>{bucket.label}</span>
              <span className={styles.track}>
                <span
                  className={styles.fill}
                  data-bucket={bucket.key}
                  style={{ width: `${(bucket.count / largest) * 100}%` }}
                />
              </span>
              <span className={styles.value}>
                {bucket.count} · {formatMoney(bucket.amount)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
