import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useBills, useParties, useReconciliation } from '@/api/queries'
import type { Bill, Party, Reconciliation } from '@/api/types'
import { AuditTrail } from '@/components/AuditTrail'
import { Badge } from '@/components/Badge'
import { Button, buttonClass } from '@/components/Button'
import { DetailList } from '@/components/DetailList'
import { Loader } from '@/components/Loader'
import { Page, PageHeader } from '@/components/Page'
import { Panel } from '@/components/Panel'
import { EmptyState } from '@/components/States'
import { todayISO } from '@/lib/dates'
import { formatDate, formatMoney } from '@/lib/format'
import { isBillOverdue } from '@/lib/payables'
import { BillStatusBadge } from './BillStatusBadge'
import { PayBillDialog } from './PayBillDialog'
import { RejectBillDialog } from './RejectBillDialog'
import { useApproveBills } from './useBillDecisions'
import styles from '../detail.module.css'

export function BillPage() {
  const { billId } = useParams()
  const bills = useBills()
  const parties = useParties()
  const recon = useReconciliation()

  return (
    <Loader queries={[bills, parties, recon]} what="this bill">
      {() => {
        const bill = bills.data!.find((b) => b.id === billId)
        const party = parties.data!.find((p) => p.id === bill?.partyId)
        if (!bill || !party) {
          return (
            <EmptyState
              title="We couldn’t find that bill"
              action={
                <Link to="/payables" className={buttonClass('primary')}>
                  Back to payables
                </Link>
              }
            />
          )
        }
        return <BillDetail bill={bill} party={party} recon={recon.data!} />
      }}
    </Loader>
  )
}

function BillDetail({ bill, party, recon }: { bill: Bill; party: Party; recon: Reconciliation }) {
  const { approve, isPending } = useApproveBills()
  const [paying, setPaying] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  const overdue = isBillOverdue(bill, todayISO())
  const payment = recon.ledger.find((e) => e.id === bill.paymentEntryId)

  return (
    <Page>
      <PageHeader
        back={{ to: '/payables', label: 'Payables' }}
        title={`Bill ${bill.number}`}
        badge={<BillStatusBadge bill={bill} overdue={overdue} />}
        subtitle={
          <>
            <Link to={`/parties/${party.id}`}>{party.name}</Link> · {bill.category} ·{' '}
            {formatMoney(bill.amount)}
          </>
        }
        actions={
          <>
            {bill.status === 'awaiting_approval' && (
              <>
                <Button variant="danger" onClick={() => setRejecting(true)}>
                  Reject
                </Button>
                <Button variant="primary" disabled={isPending} onClick={() => approve([bill.id])}>
                  Approve
                </Button>
              </>
            )}
            {bill.status === 'approved' && (
              <Button variant="primary" onClick={() => setPaying(true)}>
                Record payment
              </Button>
            )}
          </>
        }
      />

      <div className={styles.columns}>
        <div className={styles.main}>
          <Panel title="Bill details">
            <DetailList
              items={[
                ['Our reference', bill.id],
                ['Vendor’s bill no.', bill.number],
                ['Bill date', formatDate(bill.date, true)],
                ['Due date', `${formatDate(bill.dueDate, true)}${overdue ? ' (overdue)' : ''}`],
                ['Amount', formatMoney(bill.amount)],
                ['Category', bill.category],
                ...(bill.rejectReason
                  ? [['Rejected because', bill.rejectReason] as [string, string]]
                  : []),
              ]}
            />
          </Panel>

          <Panel title="Payment">
            {payment ? (
              <DetailList
                items={[
                  ['Voucher', payment.voucherNo],
                  ['Paid on', formatDate(payment.date, true)],
                  ['Reference', payment.ref || '—'],
                  [
                    'In the bank',
                    payment.bankLineId ? (
                      <Link to={`/reconciliation/lines/${payment.bankLineId}`}>
                        Cleared · {payment.bankLineId}
                      </Link>
                    ) : (
                      <Badge tone="warning">Not presented yet</Badge>
                    ),
                  ],
                ]}
              />
            ) : (
              <p className={styles.note}>
                {bill.status === 'approved'
                  ? 'Approved and ready to pay.'
                  : bill.status === 'awaiting_approval'
                    ? 'Needs approval before it can be paid.'
                    : 'This bill won’t be paid.'}
              </p>
            )}
          </Panel>
        </div>

        <Panel title="History">
          <AuditTrail events={bill.history} />
        </Panel>
      </div>

      <PayBillDialog open={paying} onOpenChange={setPaying} billId={bill.id} />
      <RejectBillDialog bill={rejecting ? bill : null} onOpenChange={setRejecting} />
    </Page>
  )
}
