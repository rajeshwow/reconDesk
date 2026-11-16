import { Amount } from '@/components/Amount'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/States'
import { formatDate } from '@/lib/format'
import type { Candidate } from '@/lib/matching'
import { ConfidenceBadge } from '@/features/reconciliation/badges'
import styles from './EntryList.module.css'

interface CandidateListProps {
  candidates: Candidate[]
  onMatch: (entryId: string) => void
}

export function CandidateList({ candidates, onMatch }: CandidateListProps) {
  if (candidates.length === 0) {
    return (
      <EmptyState compact title="No likely matches">
        Nothing in the books is close on amount. If one payment covers several invoices, close this
        and match it by hand. Bank charges and similar lines can be excluded.
      </EmptyState>
    )
  }

  return (
    <ol className={styles.list}>
      {candidates.map(({ entry, score, confidence, reasons }) => (
        <li key={entry.id} className={styles.item}>
          <div className={styles.top}>
            <div className={styles.text}>
              <p className={styles.title}>
                {entry.voucherNo} · {entry.party}
              </p>
              <p className={styles.meta}>
                {formatDate(entry.date, true)}
                {entry.ref && ` · Ref ${entry.ref}`}
              </p>
            </div>
            <Amount value={entry.amount} direction={entry.direction} />
          </div>
          <ul className={styles.reasons}>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <div className={styles.bottom}>
            <ConfidenceBadge confidence={confidence} score={score} />
            <Button
              size="sm"
              variant="primary"
              aria-label={`Match with ${entry.voucherNo}`}
              onClick={() => onMatch(entry.id)}
            >
              Match
            </Button>
          </div>
        </li>
      ))}
    </ol>
  )
}
