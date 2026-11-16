import { NavLink } from 'react-router-dom'
import { useBills, useInvoices, useReconciliation } from '@/api/queries'
import { Icon } from '@/components/Icon'
import { cx } from '@/lib/cx'
import { todayISO } from '@/lib/dates'
import { invoiceStatus } from '@/lib/receivables'
import { NAV_SECTIONS, SETTINGS_ITEM, type NavItem } from './nav'
import styles from './Sidebar.module.css'

// Small counts next to the modules, so the sidebar doubles as a to-do list.
function useBadges(): Record<string, { count: number; label: string } | undefined> {
  const { data: recon } = useReconciliation()
  const { data: invoices } = useInvoices()
  const { data: bills } = useBills()
  const today = todayISO()

  const badge = (count: number | undefined, label: string) => (count ? { count, label } : undefined)

  return {
    '/reconciliation': badge(
      recon?.bankLines.filter((l) => l.status === 'open').length,
      'unmatched lines',
    ),
    '/receivables': badge(
      invoices?.filter((i) => invoiceStatus(i, today) === 'overdue').length,
      'overdue invoices',
    ),
    '/payables': badge(
      bills?.filter((b) => b.status === 'awaiting_approval').length,
      'bills to approve',
    ),
  }
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const badges = useBadges()

  const link = (item: NavItem) => {
    const badge = badges[item.to]
    return (
      <li key={item.to}>
        <NavLink to={item.to} end={item.to === '/'} className={styles.link} onClick={onClose}>
          <Icon name={item.icon} />
          <span className={styles.label}>{item.label}</span>
          {badge && (
            <span className={styles.badge}>
              {badge.count}
              <span className="sr-only"> {badge.label}</span>
            </span>
          )}
        </NavLink>
      </li>
    )
  }

  return (
    <>
      <div
        className={cx(styles.backdrop, open && styles.backdropOpen)}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={cx(styles.sidebar, open && styles.open)} aria-label="Main">
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true" />
          <div>
            <p className={styles.product}>ReconDesk</p>
            <p className={styles.company}>Vardhan Components Pvt Ltd</p>
          </div>
        </div>

        <nav className={styles.nav}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className={styles.section}>
              <p className={styles.sectionTitle}>{section.title}</p>
              <ul className={styles.list}>{section.items.map(link)}</ul>
            </div>
          ))}
        </nav>

        <ul className={cx(styles.list, styles.bottom)}>{link(SETTINGS_ITEM)}</ul>
      </aside>
    </>
  )
}
