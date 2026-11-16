import type { ReactNode } from 'react'
import styles from './Toolbar.module.css'

// Search and filters on the left, actions on the right. Wraps onto two lines on phones.
export function Toolbar({
  label,
  children,
  actions,
}: {
  label: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className={styles.toolbar} role="search" aria-label={label}>
      <div className={styles.filters}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}
