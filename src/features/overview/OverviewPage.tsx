import { Link } from 'react-router-dom'
import {
  useActivity,
  useBills,
  useInvoices,
  useParties,
  useReconciliation,
  useSettings,
} from '@/api/queries'
import { Badge } from '@/components/Badge'
import { Icon } from '@/components/Icon'
import { Loader } from '@/components/Loader'
import { Page, PageHeader } from '@/components/Page'
import { Panel } from '@/components/Panel'
import { StatCard, StatGrid } from '@/components/StatCard'
import { EmptyState } from '@/components/States'
import { buildAging, receivableItems } from '@/lib/agingReport'
import { buildAttention } from '@/lib/attention'
import { buildBrs } from '@/lib/brs'
import { weeklyCashFlow } from '@/lib/cashflow'
import { addDays, todayISO } from '@/lib/dates'
import { formatDate, formatMoney, subtractMoney, sumAmounts } from '@/lib/format'
import { isBillOpen } from '@/lib/payables'
import { balanceDue, invoiceStatus } from '@/lib/receivables'
import { summarize } from '@/lib/summary'
import { ActivityFeed } from '@/features/activity/ActivityFeed'
import { CashFlowChart } from './CashFlowChart'
import styles from './OverviewPage.module.css'

export function OverviewPage() {
  const recon = useReconciliation()
  const invoices = useInvoices()
  const bills = useBills()
  const parties = useParties()
  const settings = useSettings()
  const activity = useActivity()

  return (
    <Loader queries={[recon, invoices, bills, parties, settings, activity]} what="the overview">
      {() => {
        const today = todayISO()
        const data = recon.data!
        const brs = buildBrs(data)
        const progress = summarize(data)

        const unpaid = invoices.data!.filter((i) => balanceDue(i) > 0)
        const overdue = unpaid.filter((i) => invoiceStatus(i, today) === 'overdue')
        const owed = (list: typeof unpaid) =>
          sumAmounts(list.map((i) => ({ amount: balanceDue(i) })))

        const openBills = bills.data!.filter(isBillOpen)
        const dueSoon = openBills.filter((b) => b.dueDate <= addDays(today, 7))

        const attention = buildAttention({
          recon: data,
          invoices: invoices.data!,
          bills: bills.data!,
          settings: settings.data!,
          today,
        })
        const names = new Map(parties.data!.map((p) => [p.id, p.name]))
        const worstPayers = buildAging(receivableItems(invoices.data!), today)
          .rows.map((r) => ({
            partyId: r.partyId,
            late: subtractMoney(r.totals.total, r.totals.current),
          }))
          .filter((r) => r.late > 0)
          .sort((a, b) => b.late - a.late)
          .slice(0, 5)

        return (
          <Page>
            <PageHeader
              title="Overview"
              subtitle={`Vardhan Components Pvt Ltd · ${formatDate(today, true)}`}
            />

            <StatGrid label="Key numbers">
              <StatCard
                label="Bank balance"
                value={formatMoney(brs.bankBalance)}
                hint={`Books say ${formatMoney(brs.bookBalance)}`}
                to="/reports/brs"
              />
              <StatCard
                label="Customers owe us"
                value={formatMoney(owed(unpaid))}
                hint={`${formatMoney(owed(overdue))} overdue`}
                to="/receivables"
              />
              <StatCard
                label="We owe vendors"
                value={formatMoney(sumAmounts(openBills))}
                hint={`${formatMoney(sumAmounts(dueSoon))} due this week`}
                to="/payables"
              />
              <StatCard
                label="Statement reconciled"
                value={`${progress.progress}%`}
                hint={`${progress.openLines} lines still open`}
                to="/reconciliation"
              >
                <progress
                  className={styles.progress}
                  max={100}
                  value={progress.progress}
                  aria-label="Reconciled"
                />
              </StatCard>
            </StatGrid>

            <div className={styles.grid}>
              <Panel title="Needs your attention" flush>
                {attention.length === 0 ? (
                  <EmptyState compact title="Nothing needs you right now 🎉" />
                ) : (
                  <ul className={styles.tasks}>
                    {attention.map((item) => (
                      <li key={item.key}>
                        <Link to={item.to} className={styles.task}>
                          <Badge tone={item.tone}>{item.count}</Badge>
                          <span className={styles.taskText}>
                            <span className={styles.taskTitle}>{item.title}</span>
                            <span className={styles.taskDetail}>{item.detail}</span>
                          </span>
                          <Icon name="arrow" size={16} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Cash flow, last 6 weeks">
                <CashFlowChart weeks={weeklyCashFlow(data.bankLines, today, 6)} />
              </Panel>
            </div>

            <div className={styles.grid}>
              <Panel
                title="Slowest paying customers"
                actions={<Link to="/reports/receivables-aging">Aging report</Link>}
              >
                {worstPayers.length === 0 ? (
                  <p className={styles.muted}>No customer is overdue.</p>
                ) : (
                  <ol className={styles.payers}>
                    {worstPayers.map((payer) => (
                      <li key={payer.partyId}>
                        <Link to={`/parties/${payer.partyId}`}>{names.get(payer.partyId)}</Link>
                        <span className={styles.amount}>{formatMoney(payer.late)} overdue</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>

              <Panel title="Recent activity" actions={<Link to="/activity">View all</Link>}>
                <ActivityFeed events={activity.data!.slice(0, 6)} />
              </Panel>
            </div>
          </Page>
        )
      }}
    </Loader>
  )
}
