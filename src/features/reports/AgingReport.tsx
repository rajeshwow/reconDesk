import { Link } from 'react-router-dom'
import { useBills, useInvoices, useParties } from '@/api/queries'
import { Button } from '@/components/Button'
import { Icon } from '@/components/Icon'
import { Loader } from '@/components/Loader'
import { Panel } from '@/components/Panel'
import { EmptyState } from '@/components/States'
import { Table, tableStyles, type Column } from '@/components/Table'
import { DUE_BUCKETS } from '@/lib/aging'
import {
  buildAging,
  payableItems,
  receivableItems,
  type AgingRow,
  type BucketTotals,
} from '@/lib/agingReport'
import { downloadCsv } from '@/lib/csv'
import { todayISO } from '@/lib/dates'
import { formatDate, formatMoney } from '@/lib/format'
import styles from './ReportsPage.module.css'

export function AgingReport({ side }: { side: 'receivables' | 'payables' }) {
  const parties = useParties()
  const invoices = useInvoices()
  const bills = useBills()

  return (
    <Loader queries={[parties, invoices, bills]} what={`the ${side} aging`}>
      {() => {
        const today = todayISO()
        const items =
          side === 'receivables' ? receivableItems(invoices.data!) : payableItems(bills.data!)
        const { rows, grand } = buildAging(items, today)
        const names = new Map(parties.data!.map((p) => [p.id, p.name]))
        const amount = (value: number) =>
          value ? formatMoney(value) : <span className={tableStyles.muted}>—</span>

        const columns: Column<AgingRow>[] = [
          {
            key: 'party',
            header: side === 'receivables' ? 'Customer' : 'Vendor',
            render: (r) => (
              <Link to={`/parties/${r.partyId}`} className={tableStyles.link}>
                {names.get(r.partyId)}
              </Link>
            ),
          },
          ...DUE_BUCKETS.map((bucket) => ({
            key: bucket.key,
            header: bucket.label,
            align: 'right' as const,
            hideOnMobile: bucket.key !== '90+',
            render: (r: AgingRow) => amount(r.totals[bucket.key]),
          })),
          {
            key: 'total',
            header: 'Total',
            align: 'right',
            render: (r) => <strong>{formatMoney(r.totals.total)}</strong>,
          },
        ]

        const cells = (totals: BucketTotals) => [
          ...DUE_BUCKETS.map((b) => totals[b.key]),
          totals.total,
        ]

        function exportCsv() {
          downloadCsv(`${side}-aging-${today}.csv`, [
            [
              side === 'receivables' ? 'Customer' : 'Vendor',
              ...DUE_BUCKETS.map((b) => b.label),
              'Total',
            ],
            ...rows.map((r) => [
              names.get(r.partyId) ?? r.partyId,
              ...cells(r.totals).map((v) => v.toFixed(2)),
            ]),
            ['Total', ...cells(grand).map((v) => v.toFixed(2))],
          ])
        }

        return (
          <Panel
            title={`${side === 'receivables' ? 'What customers owe us' : 'What we owe vendors'}, by days past due · ${formatDate(today, true)}`}
            flush
            actions={
              <div className={styles.actions}>
                <Button size="sm" variant="ghost" onClick={() => window.print()}>
                  <Icon name="print" size={16} /> Print
                </Button>
                <Button size="sm" variant="ghost" onClick={exportCsv} disabled={rows.length === 0}>
                  <Icon name="download" size={16} /> Export CSV
                </Button>
              </div>
            }
          >
            {rows.length === 0 ? (
              <EmptyState compact title="Nothing outstanding" />
            ) : (
              <Table
                caption={`${side} aging`}
                columns={columns}
                rows={rows}
                rowKey={(r) => r.partyId}
                footer={
                  <tr>
                    <td>Total</td>
                    {DUE_BUCKETS.map((b) => (
                      <td
                        key={b.key}
                        className={
                          b.key === '90+'
                            ? tableStyles.right
                            : `${tableStyles.right} ${tableStyles.optional}`
                        }
                      >
                        {formatMoney(grand[b.key])}
                      </td>
                    ))}
                    <td className={tableStyles.right}>{formatMoney(grand.total)}</td>
                  </tr>
                }
              />
            )}
          </Panel>
        )
      }}
    </Loader>
  )
}

export const ReceivablesAging = () => <AgingReport side="receivables" />
export const PayablesAging = () => <AgingReport side="payables" />
