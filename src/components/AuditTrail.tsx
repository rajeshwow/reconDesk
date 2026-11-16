import type { AuditEvent } from '@/api/types'
import { formatDateTime } from '@/lib/format'
import styles from './AuditTrail.module.css'

const ACTION_LABELS: Record<AuditEvent['action'], string> = {
  imported: 'Imported from statement',
  matched: 'Matched',
  unmatched: 'Unmatched',
  excluded: 'Excluded',
  reopened: 'Reopened',
  posted: 'Posted to books',
  created: 'Created',
  approved: 'Approved',
  rejected: 'Rejected',
  paid: 'Payment recorded',
}

export function AuditTrail({ events }: { events: AuditEvent[] }) {
  const newestFirst = [...events].reverse()

  return (
    <ol className={styles.trail}>
      {newestFirst.map((event, index) => (
        <li key={`${event.at}-${index}`} className={styles.event}>
          <p>
            {ACTION_LABELS[event.action]}
            {event.note && <span className={styles.note}>: {event.note}</span>}
          </p>
          <p className={styles.when}>
            {event.by} · {formatDateTime(event.at)}
          </p>
        </li>
      ))}
    </ol>
  )
}
