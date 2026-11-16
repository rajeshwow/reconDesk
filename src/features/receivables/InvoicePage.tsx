import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInvoices, useParties, useReconciliation } from '@/api/queries'
import type { Invoice, Party, Reconciliation } from '@/api/types'
import { AuditTrail } from '@/components/AuditTrail'
import { Badge } from '@/components/Badge'
import { Button, buttonClass } from '@/components/Button'
import { DetailList } from '@/components/DetailList'
import { Loader } from '@/components/Loader'
import { Page, PageHeader } from '@/components/Page'
import { Panel } from '@/components/Panel'
import { StatCard, StatGrid } from '@/components/StatCard'
import { EmptyState } from '@/components/States'
import { Table, tableStyles, type Column } from '@/components/Table'
import { todayISO } from '@/lib/dates'
import { formatDate, formatMoney } from '@/lib/format'
import { amountReceived, balanceDue, daysOverdue, invoiceStatus } from '@/lib/receivables'
import { InvoiceStatusBadge } from './InvoiceStatusBadge'
import { RecordReceiptDialog } from './RecordReceiptDialog'
import styles from '../detail.module.css'

export function InvoicePage() {
  const { invoiceId } = useParams()
  const invoices = useInvoices()
  const parties = useParties()
  const recon = useReconciliation()

  return (
    <Loader queries={[invoices, parties, recon]} what="this invoice">
      {() => {
        const invoice = invoices.data!.find((i) => i.id === invoiceId)
        const party = parties.data!.find((p) => p.id === invoice?.partyId)
        if (!invoice || !party) return <NotFound />
        return <InvoiceDetail invoice={invoice} party={party} recon={recon.data!} />
      }}
    </Loader>
  )
}

function NotFound() {
  return (
    <EmptyState
      title="We couldn’t find that invoice"
      action={
        <Link to="/receivables" className={buttonClass('primary')}>
          Back to receivables
        </Link>
      }
    >
      The number may be mistyped, or the link is from another company.
    </EmptyState>
  )
}

interface ReceiptRow {
  entryId: string
  voucherNo: string
  date: string
  applied: number
  bankLineId: string | null
}

function InvoiceDetail({
  invoice,
  party,
  recon,
}: {
  invoice: Invoice
  party: Party
  recon: Reconciliation
}) {
  const [recording, setRecording] = useState(false)
  const today = todayISO()
  const status = invoiceStatus(invoice, today)
  const balance = balanceDue(invoice)

  const receipts: ReceiptRow[] = invoice.allocations.map((allocation) => {
    const entry = recon.ledger.find((e) => e.id === allocation.entryId)
    return {
      entryId: allocation.entryId,
      voucherNo: entry?.voucherNo ?? allocation.entryId,
      date: entry?.date ?? '',
      applied: allocation.amount,
      bankLineId: entry?.bankLineId ?? null,
    }
  })

  const columns: Column<ReceiptRow>[] = [
    { key: 'voucher', header: 'Voucher', render: (r) => <strong>{r.voucherNo}</strong> },
    { key: 'date', header: 'Date', render: (r) => (r.date ? formatDate(r.date, true) : '—') },
    { key: 'applied', header: 'Applied', align: 'right', render: (r) => formatMoney(r.applied) },
    {
      key: 'bank',
      header: 'In the bank',
      render: (r) =>
        r.bankLineId ? (
          <Link to={`/reconciliation/lines/${r.bankLineId}`} className={tableStyles.link}>
            Cleared · {r.bankLineId}
          </Link>
        ) : (
          <Badge tone="warning">Not cleared yet</Badge>
        ),
    },
  ]

  return (
    <Page>
      <PageHeader
        back={{ to: '/receivables', label: 'Receivables' }}
        title={invoice.id}
        badge={<InvoiceStatusBadge status={status} />}
        subtitle={
          <>
            <Link to={`/parties/${party.id}`}>{party.name}</Link> · raised{' '}
            {formatDate(invoice.date, true)}
          </>
        }
        actions={
          status !== 'paid' && (
            <Button variant="primary" onClick={() => setRecording(true)}>
              Record receipt
            </Button>
          )
        }
      />

      <StatGrid label="Invoice amounts">
        <StatCard label="Invoice amount" value={formatMoney(invoice.amount)} />
        <StatCard
          label="Received"
          value={formatMoney(amountReceived(invoice))}
          hint={`${receipts.length} receipts`}
        />
        <StatCard
          label="Balance due"
          value={formatMoney(balance)}
          tone={status === 'overdue' ? 'danger' : undefined}
        />
        <StatCard
          label="Due date"
          value={formatDate(invoice.dueDate, true)}
          hint={
            status === 'overdue'
              ? `${daysOverdue(invoice.dueDate, today)} days overdue`
              : `${party.creditDays} days credit`
          }
        />
      </StatGrid>

      <div className={styles.columns}>
        <div className={styles.main}>
          <Panel title="Receipts against this invoice" flush>
            {receipts.length === 0 ? (
              <EmptyState compact title="Nothing received yet">
                When the customer pays, record the receipt here or straight from the bank statement.
              </EmptyState>
            ) : (
              <Table
                caption="Receipts"
                columns={columns}
                rows={receipts}
                rowKey={(r) => r.entryId}
              />
            )}
          </Panel>
          <Panel title="History">
            <AuditTrail events={invoice.history} />
          </Panel>
        </div>

        <Panel title="Customer">
          <DetailList
            items={[
              ['Name', <Link to={`/parties/${party.id}`}>{party.name}</Link>],
              ['GSTIN', party.gstin],
              ['City', party.city],
              ['Credit terms', `${party.creditDays} days`],
              ['Email', party.email],
              ['Phone', party.phone],
            ]}
          />
        </Panel>
      </div>

      <RecordReceiptDialog open={recording} onOpenChange={setRecording} invoiceId={invoice.id} />
    </Page>
  )
}
