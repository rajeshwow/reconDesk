import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/lib/cx'
import styles from './StatCard.module.css'

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Makes the whole card a link to the list behind the number. */
  to?: string
  tone?: 'warning' | 'danger'
  children?: ReactNode
}

export function StatCard({ label, value, hint, to, tone, children }: StatCardProps) {
  const body = (
    <>
      <p className={styles.label}>{label}</p>
      <p className={cx(styles.value, tone && styles[tone])}>{value}</p>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
    </>
  )

  return to ? (
    <Link to={to} className={cx(styles.card, styles.link)}>
      {body}
    </Link>
  ) : (
    <div className={styles.card}>{body}</div>
  )
}

export function StatGrid({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section className={styles.grid} aria-label={label}>
      {children}
    </section>
  )
}
