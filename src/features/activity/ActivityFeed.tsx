import { Link } from 'react-router-dom'
import type { ActivityEvent, Module } from '@/api/types'
import { Badge, type Tone } from '@/components/Badge'
import { formatDateTime } from '@/lib/format'
import styles from './ActivityFeed.module.css'

export const MODULE_LABELS: Record<Module, string> = {
  reconciliation: 'Reconciliation',
  receivables: 'Receivables',
  payables: 'Payables',
  settings: 'Settings',
}

const MODULE_TONES: Record<Module, Tone> = {
  reconciliation: 'info',
  receivables: 'success',
  payables: 'warning',
  settings: 'neutral',
}

export function ActivityFeed({
  events,
  showModule = true,
}: {
  events: ActivityEvent[]
  showModule?: boolean
}) {
  return (
    <ol className={styles.feed}>
      {events.map((event) => (
        <li key={event.id} className={styles.event}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(event.by)}
          </span>
          <div className={styles.body}>
            <p className={styles.text}>
              {event.link ? <Link to={event.link}>{event.text}</Link> : event.text}
            </p>
            <p className={styles.meta}>
              {event.by} · {formatDateTime(event.at)}
              {showModule && (
                <>
                  {' '}
                  <Badge tone={MODULE_TONES[event.module]}>{MODULE_LABELS[event.module]}</Badge>
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
