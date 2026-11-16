import type { CSSProperties, ReactNode } from 'react'
import { cx } from '@/lib/cx'
import { Button } from './Button'
import styles from './States.module.css'

interface EmptyStateProps {
  title: string
  children?: ReactNode
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ title, children, action, compact }: EmptyStateProps) {
  return (
    <div className={cx(styles.state, compact && styles.compact)}>
      <p className={styles.title}>{title}</p>
      {children && <p className={styles.text}>{children}</p>}
      {action}
    </div>
  )
}

interface ErrorStateProps {
  title: string
  message: string
  onRetry?: () => void
  retrying?: boolean
}

export function ErrorState({ title, message, onRetry, retrying }: ErrorStateProps) {
  return (
    <div className={cx(styles.state, styles.error)} role="alert">
      <p className={styles.title}>{title}</p>
      <p className={styles.text}>{message}</p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry} disabled={retrying}>
          {retrying ? 'Retrying…' : 'Try again'}
        </Button>
      )}
    </div>
  )
}

export function Skeleton({
  width = '100%',
  height = 14,
}: {
  width?: CSSProperties['width']
  height?: number
}) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden="true" />
}
