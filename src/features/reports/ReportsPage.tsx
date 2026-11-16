import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Page, PageHeader } from '@/components/Page'
import { Skeleton } from '@/components/States'
import styles from './ReportsPage.module.css'

const REPORTS = [
  { to: 'brs', label: 'Bank reconciliation statement' },
  { to: 'receivables-aging', label: 'Receivables aging' },
  { to: 'payables-aging', label: 'Payables aging' },
]

// Each report is its own route, so it can be bookmarked and the back button works.
export function ReportsPage() {
  return (
    <Page>
      <PageHeader title="Reports" subtitle="Month-end numbers, ready to export or print" />
      <nav aria-label="Reports" className={styles.tabs}>
        {REPORTS.map((report) => (
          <NavLink key={report.to} to={report.to} className={styles.tab}>
            {report.label}
          </NavLink>
        ))}
      </nav>
      <Suspense fallback={<Skeleton height={320} />}>
        <Outlet />
      </Suspense>
    </Page>
  )
}
