import type { BankLine, LedgerEntry } from '@/api/types'
import { Button } from '@/components/Button'
import { cx } from '@/lib/cx'
import { formatMoney, sumAmounts } from '@/lib/format'
import { matchDifference, matchError } from '@/lib/reconcile'
import styles from './MatchBar.module.css'

interface MatchBarProps {
  line: BankLine
  entries: LedgerEntry[]
  onMatch: () => void
  onCancel: () => void
}

export function MatchBar({ line, entries, onMatch, onCancel }: MatchBarProps) {
  const difference = matchDifference(line, entries)
  const problem =
    entries.length === 0 ? 'Tick one or more book entries.' : matchError(line, entries)
  const message =
    problem ??
    (difference === 0
      ? 'Amounts balance. Ready to match.'
      : 'Small difference, usually TDS or bank charges.')

  return (
    <div className={styles.bar} role="region" aria-label="Manual match">
      <dl className={styles.figures}>
        <div>
          <dt>Bank line</dt>
          <dd>{formatMoney(line.amount)}</dd>
        </div>
        <div>
          <dt>Selected ({entries.length})</dt>
          <dd>{formatMoney(sumAmounts(entries))}</dd>
        </div>
        <div>
          <dt>Difference</dt>
          <dd className={cx(difference === 0 ? styles.balanced : styles.off)}>
            {formatMoney(Math.abs(difference))}
          </dd>
        </div>
      </dl>
      <p className={styles.message} aria-live="polite">
        {message}
      </p>
      <div className={styles.buttons}>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={problem !== null} onClick={onMatch}>
          Match {entries.length > 1 ? `${entries.length} entries` : ''}
        </Button>
      </div>
    </div>
  )
}
