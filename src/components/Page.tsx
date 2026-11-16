import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import styles from './Page.module.css'

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div className={wide ? `${styles.page} ${styles.wide}` : styles.page}>{children}</div>
}

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  back?: { to: string; label: string }
  badge?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, back, badge, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titles}>
        {back && (
          <Link to={back.to} className={styles.back}>
            <Icon name="back" size={16} />
            {back.label}
          </Link>
        )}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{title}</h1>
          {badge}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  )
}
