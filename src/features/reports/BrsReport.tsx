import { Link } from 'react-router-dom'
import { useReconciliation } from '@/api/queries'
import { Button } from '@/components/Button'
import { Icon } from '@/components/Icon'
import { Loader } from '@/components/Loader'
import { Panel } from '@/components/Panel'
import { buildBrs } from '@/lib/brs'
import { downloadCsv } from '@/lib/csv'
import { formatDate, formatMoney } from '@/lib/format'
import styles from './ReportsPage.module.css'

// Where each adjustment comes from in the workbench, so the numbers can be checked.
const DRILL_DOWN: Record<string, string> = {
  credits: '/reconciliation?direction=in&status=unresolved',
  debits: '/reconciliation?direction=out&status=unresolved',
}

export function BrsReport() {
  const recon = useReconciliation()

  return (
    <Loader queries={[recon]} what="the bank reconciliation statement">
      {() => {
        const data = recon.data!
        const brs = buildBrs(data)
        const asOf = formatDate(data.period.to, true)

        function exportCsv() {
          downloadCsv(`brs-${data.period.to}.csv`, [
            [
              'Bank reconciliation statement',
              `${data.account.bank} ${data.account.number}`,
              `as of ${asOf}`,
            ],
            [],
            ['Balance as per books', brs.bookBalance.toFixed(2)],
            ...brs.adjustments.map((a) => [a.label, a.amount.toFixed(2)]),
            ['Balance as per bank statement', brs.adjustedBalance.toFixed(2)],
          ])
        }

        return (
          <Panel
            title={`${data.account.bank} · ${data.account.name} ${data.account.number} · as of ${asOf}`}
            flush
            actions={
              <div className={styles.actions}>
                <Button size="sm" variant="ghost" onClick={() => window.print()}>
                  <Icon name="print" size={16} /> Print
                </Button>
                <Button size="sm" variant="ghost" onClick={exportCsv}>
                  <Icon name="download" size={16} /> Export CSV
                </Button>
              </div>
            }
          >
            <table className={styles.statement}>
              <caption className="sr-only">Bank reconciliation statement</caption>
              <thead>
                <tr>
                  <th scope="col">Particulars</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className={styles.total}>
                  <td>Balance as per books</td>
                  <td>{formatMoney(brs.bookBalance)}</td>
                </tr>
                {brs.adjustments.map((a) => (
                  <tr key={a.key}>
                    <td>
                      {DRILL_DOWN[a.key] ? <Link to={DRILL_DOWN[a.key]}>{a.label}</Link> : a.label}
                      <span className={styles.count}>{a.count} items</span>
                    </td>
                    <td>{formatMoney(a.amount)}</td>
                  </tr>
                ))}
                <tr className={styles.total}>
                  <td>Balance as per bank statement</td>
                  <td>{formatMoney(brs.adjustedBalance)}</td>
                </tr>
              </tbody>
            </table>
            <p
              className={`${styles.tieOut} ${brs.difference === 0 ? styles.ok : styles.bad}`}
              role="status"
            >
              <Icon name={brs.difference === 0 ? 'check' : 'activity'} />
              {brs.difference === 0
                ? `Ties out to the bank closing balance of ${formatMoney(brs.bankBalance)}`
                : `Unexplained difference of ${formatMoney(brs.difference)}`}
            </p>
          </Panel>
        )
      }}
    </Loader>
  )
}
