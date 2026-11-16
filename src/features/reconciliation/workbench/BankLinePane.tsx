import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import type { BankRow } from '@/lib/filters'
import { BankLineRow } from './BankLineRow'
import styles from './Pane.module.css'

interface BankLinePaneProps {
  rows: BankRow[]
  totalCount: number
  selectedId?: string
  onSelect: (lineId: string) => void
  onAccept: (row: BankRow) => void
  empty: ReactNode
}

export function BankLinePane({
  rows,
  totalCount,
  selectedId,
  onSelect,
  onAccept,
  empty,
}: BankLinePaneProps) {
  const { search } = useLocation()
  const countLabel =
    rows.length === totalCount ? `${totalCount} lines` : `${rows.length} of ${totalCount} lines`

  return (
    <section className={styles.pane} aria-labelledby="bank-heading">
      <div className={styles.header}>
        <h2 id="bank-heading" className={styles.heading}>
          Bank statement
        </h2>
        <p className={styles.count} aria-live="polite">
          {countLabel}
        </p>
      </div>
      {rows.length === 0 ? (
        empty
      ) : (
        <ul className={styles.list} aria-label="Bank lines">
          {rows.map((row) => (
            <BankLineRow
              key={row.line.id}
              row={row}
              search={search}
              selected={row.line.id === selectedId}
              onSelect={onSelect}
              onAccept={onAccept}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
