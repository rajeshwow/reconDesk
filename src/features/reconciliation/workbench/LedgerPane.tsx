import { useMemo, useState } from 'react'
import type { BankLine, LedgerEntry } from '@/api/types'
import { Amount } from '@/components/Amount'
import { EmptyState } from '@/components/States'
import { formatDate, formatMoney } from '@/lib/format'
import paneStyles from './Pane.module.css'
import styles from './LedgerPane.module.css'

interface LedgerPaneProps {
  entries: LedgerEntry[]
  selectedLine: BankLine | null
  checkedIds: string[]
  onToggle: (entryId: string) => void
}

export function LedgerPane({ entries, selectedLine, checkedIds, onToggle }: LedgerPaneProps) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matching = entries.filter(
      (e) =>
        (!selectedLine || e.direction === selectedLine.direction) &&
        (!q || `${e.voucherNo} ${e.party} ${e.amount.toFixed(2)}`.toLowerCase().includes(q)),
    )
    // With a bank line picked, the closest amounts float to the top. That's where the answer usually is.
    return selectedLine
      ? matching.sort(
          (a, b) =>
            Math.abs(a.amount - selectedLine.amount) - Math.abs(b.amount - selectedLine.amount),
        )
      : matching.sort((a, b) => b.date.localeCompare(a.date))
  }, [entries, selectedLine, query])

  return (
    <section className={paneStyles.pane} aria-labelledby="ledger-heading">
      <div className={paneStyles.header}>
        <h2 id="ledger-heading" className={paneStyles.heading}>
          Books · unmatched
        </h2>
        <p className={paneStyles.count}>{entries.length} entries</p>
      </div>

      <div className={styles.tools}>
        <label htmlFor="ledger-search" className="sr-only">
          Search book entries
        </label>
        <input
          id="ledger-search"
          type="search"
          className={styles.search}
          placeholder="Search voucher, party or amount"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className={styles.hint}>
          {selectedLine
            ? `Tick the entries that add up to ${formatMoney(selectedLine.amount)}.`
            : 'Select a bank line on the left to match it by hand. Useful when one payment covers several invoices.'}
        </p>
      </div>

      {visible.length === 0 ? (
        <EmptyState title={query ? 'Nothing matches your search' : 'No unmatched book entries'} />
      ) : (
        <ul className={paneStyles.list} aria-label="Unmatched book entries">
          {visible.map((entry) => (
            <li key={entry.id} className={styles.item}>
              <label className={styles.entry} data-disabled={!selectedLine || undefined}>
                <input
                  type="checkbox"
                  checked={checkedIds.includes(entry.id)}
                  disabled={!selectedLine}
                  onChange={() => onToggle(entry.id)}
                />
                <span className={styles.date}>{formatDate(entry.date)}</span>
                <span className={styles.text}>
                  <span className={styles.voucher}>{entry.voucherNo}</span>
                  <span className={styles.party}>{entry.party}</span>
                </span>
                <Amount value={entry.amount} direction={entry.direction} />
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
