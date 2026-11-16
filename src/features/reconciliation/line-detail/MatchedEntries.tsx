import { Link } from 'react-router-dom'
import type { LedgerEntry, Party } from '@/api/types'
import { Amount } from '@/components/Amount'
import { formatDate } from '@/lib/format'
import styles from './EntryList.module.css'

interface MatchedEntriesProps {
  entries: LedgerEntry[]
  parties: Map<string, Party>
}

export function MatchedEntries({ entries, parties }: MatchedEntriesProps) {
  return (
    <ul className={styles.list}>
      {entries.map((entry) => {
        const party = entry.partyId ? parties.get(entry.partyId) : undefined
        return (
          <li key={entry.id} className={styles.item}>
            <div className={styles.top}>
              <div className={styles.text}>
                <p className={styles.title}>
                  {entry.voucherNo} ·{' '}
                  {party ? <Link to={`/parties/${party.id}`}>{party.name}</Link> : entry.party}
                </p>
                <p className={styles.meta}>
                  {formatDate(entry.date, true)} · {entry.narration}
                </p>
              </div>
              <Amount value={entry.amount} direction={entry.direction} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
