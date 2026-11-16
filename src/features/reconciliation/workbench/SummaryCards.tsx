import { StatCard } from '@/components/StatCard'
import { formatMoney } from '@/lib/format'
import type { ReconSummary } from '@/lib/summary'
import styles from './SummaryCards.module.css'

export function SummaryCards({
  summary,
  suggestions,
}: {
  summary: ReconSummary
  suggestions: number
}) {
  return (
    <section className={styles.grid} aria-label="Summary">
      <StatCard
        label="Reconciled"
        value={`${summary.progress}%`}
        hint={`${summary.doneLines} of ${summary.totalLines} bank lines`}
      >
        <progress
          className={styles.progress}
          max={100}
          value={summary.progress}
          aria-label="Reconciled"
        />
      </StatCard>
      <StatCard
        label="Unmatched on statement"
        value={summary.openLines}
        hint={formatMoney(summary.openLinesAmount)}
      />
      <StatCard
        label="Unmatched in books"
        value={summary.openEntries}
        hint={formatMoney(summary.openEntriesAmount)}
      />
      <StatCard label="High-confidence matches" value={suggestions} hint="Ready to accept" />
    </section>
  )
}
