import { useId, type ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Panel.module.css'

interface PanelProps {
  title: ReactNode
  actions?: ReactNode
  /** No padding around the body, for tables and lists that run edge to edge. */
  flush?: boolean
  children: ReactNode
}

export function Panel({ title, actions, flush, children }: PanelProps) {
  const id = useId()
  return (
    <section className={styles.panel} aria-labelledby={id}>
      <div className={styles.header}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {actions}
      </div>
      <div className={cx(styles.body, flush && styles.flush)}>{children}</div>
    </section>
  )
}

// A panel without a header, for a table that already says what it is.
export function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={styles.panel} aria-label={label}>
      {children}
    </section>
  )
}
