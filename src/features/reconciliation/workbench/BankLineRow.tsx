import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Amount } from '@/components/Amount'
import { Button, buttonClass } from '@/components/Button'
import type { BankRow } from '@/lib/filters'
import { formatDate } from '@/lib/format'
import { cx } from '@/lib/cx'
import { StatusBadge } from '@/features/reconciliation/badges'
import styles from './BankLineRow.module.css'

interface BankLineRowProps {
  row: BankRow
  search: string
  selected: boolean
  onSelect: (lineId: string) => void
  onAccept: (row: BankRow) => void
}

// Memoised: ticking a book entry or selecting another line only re-renders the rows
// whose props actually changed, not the whole statement.
export const BankLineRow = memo(function BankLineRow({
  row,
  search,
  selected,
  onSelect,
  onAccept,
}: BankLineRowProps) {
  const { line, status, suggestion } = row
  const selectable = status === 'open' || status === 'suggested'

  const body = (
    <>
      <span className={styles.date}>{formatDate(line.date)}</span>
      <span className={styles.text}>
        <span className={styles.narration}>{line.narration}</span>
        <span className={styles.meta}>
          {line.ref || 'No reference'}
          {status === 'suggested' &&
            suggestion &&
            ` · Suggested ${suggestion.entry.voucherNo}, ${suggestion.entry.party}`}
        </span>
      </span>
      <span className={styles.amount}>
        <Amount value={line.amount} direction={line.direction} />
      </span>
      <span className={styles.status}>
        <StatusBadge status={status} confidence={suggestion?.confidence} />
      </span>
    </>
  )

  return (
    <li className={cx(styles.row, selected && styles.selected)}>
      {selectable ? (
        <button
          type="button"
          className={styles.main}
          aria-pressed={selected}
          onClick={() => onSelect(line.id)}
        >
          {body}
        </button>
      ) : (
        <div className={styles.main}>{body}</div>
      )}
      <div className={styles.actions}>
        {status === 'suggested' && suggestion && (
          <Button
            size="sm"
            variant="primary"
            aria-label={`Accept match with ${suggestion.entry.voucherNo}`}
            onClick={() => onAccept(row)}
          >
            Accept
          </Button>
        )}
        <Link
          to={{ pathname: `/reconciliation/lines/${line.id}`, search }}
          className={buttonClass('ghost', 'sm')}
          aria-label={`Details for ${line.narration}`}
        >
          Details
        </Link>
      </div>
    </li>
  )
})
