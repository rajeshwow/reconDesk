import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInvoices, useParties, useReconciliation } from '@/api/queries'
import type { Invoice, LedgerEntry, Party } from '@/api/types'
import { Button } from '@/components/Button'
import { SearchInput } from '@/components/Field'
import { Icon } from '@/components/Icon'
import { Loader } from '@/components/Loader'
import { Page, PageHeader } from '@/components/Page'
import { Card } from '@/components/Panel'
import { Segmented } from '@/components/Segmented'
import { Select } from '@/components/Select'
import { StatCard, StatGrid } from '@/components/StatCard'
import { EmptyState } from '@/components/States'
import { Table, tableStyles, type Column } from '@/components/Table'
import { Toolbar } from '@/components/Toolbar'
import { useUrlState } from '@/hooks/useUrlState'
import { addDays, todayISO } from '@/lib/dates'
import { formatDate, formatMoney, plural, sumAmounts } from '@/lib/format'
import {
  filterInvoices,
  INVOICE_SORTS,
  INVOICE_STATUS_FILTERS,
  statusMatches,
  toInvoiceRows,
  type InvoiceFilters,
  type InvoiceRow,
} from '@/lib/receivables'
import { InvoiceStatusBadge } from './InvoiceStatusBadge'
import { NewInvoiceDialog } from './NewInvoiceDialog'
import { RecordReceiptDialog } from './RecordReceiptDialog'

const DEFAULTS: InvoiceFilters = { q: '', status: 'open', sort: 'due' }
const ALLOWED = { status: INVOICE_STATUS_FILTERS, sort: INVOICE_SORTS }

const STATUS_LABELS: Record<InvoiceFilters['status'], string> = {
  open: 'Unpaid',
  overdue: 'Overdue',
  due: 'Not yet due',
  partial: 'Part paid',
  paid: 'Paid',
  all: 'All',
}

const SORT_OPTIONS = [
  { value: 'due', label: 'Due date' },
  { value: 'overdue', label: 'Most overdue' },
  { value: 'balance', label: 'Largest balance' },
  { value: 'newest', label: 'Newest first' },
] as const

export function ReceivablesPage() {
  const invoices = useInvoices()
  const parties = useParties()
  const recon = useReconciliation()

  return (
    <Loader queries={[invoices, parties, recon]} what="receivables">
      {() => (
        <Receivables
          invoices={invoices.data!}
          parties={parties.data!}
          ledger={recon.data!.ledger}
        />
      )}
    </Loader>
  )
}

function Receivables({
  invoices,
  parties,
  ledger,
}: {
  invoices: Invoice[]
  parties: Party[]
  ledger: LedgerEntry[]
}) {
  const { state: filters, update, reset, isFiltered } = useUrlState(DEFAULTS, ALLOWED)
  const [receipt, setReceipt] = useState<{ open: boolean; invoiceId?: string }>({ open: false })
  const [creating, setCreating] = useState(false)

  const today = todayISO()
  const names = useMemo(() => new Map(parties.map((p) => [p.id, p.name])), [parties])
  const rows = useMemo(() => toInvoiceRows(invoices, names, today), [invoices, names, today])
  const visible = useMemo(() => filterInvoices(rows, filters), [rows, filters])

  const unpaid = rows.filter((r) => r.status !== 'paid')
  const overdue = rows.filter((r) => r.status === 'overdue')
  const dueSoon = unpaid.filter(
    (r) => r.status !== 'overdue' && r.invoice.dueDate <= addDays(today, 7),
  )
  const collected = ledger.filter(
    (e) => e.direction === 'in' && e.partyId && e.date >= addDays(today, -30),
  )
  const balanceOf = (list: InvoiceRow[]) => sumAmounts(list.map((r) => ({ amount: r.balance })))

  const columns: Column<InvoiceRow>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      render: ({ invoice }) => (
        <>
          <Link to={`/receivables/${invoice.id}`} className={tableStyles.link}>
            {invoice.id}
          </Link>
          <span className={tableStyles.sub}>{formatDate(invoice.date, true)}</span>
        </>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: ({ invoice, partyName }) => (
        <Link to={`/parties/${invoice.partyId}`} className={tableStyles.link}>
          {partyName}
        </Link>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      hideOnMobile: true,
      render: ({ invoice, status, overdueDays }) => (
        <>
          {formatDate(invoice.dueDate, true)}
          {status === 'overdue' && <span className={tableStyles.sub}>{overdueDays} days late</span>}
        </>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      hideOnMobile: true,
      render: ({ invoice }) => formatMoney(invoice.amount),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: ({ balance }) => formatMoney(balance),
    },
    {
      key: 'status',
      header: 'Status',
      render: ({ status }) => <InvoiceStatusBadge status={status} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: ({ invoice, status }) =>
        status !== 'paid' && (
          <Button
            size="sm"
            aria-label={`Record receipt for ${invoice.id}`}
            onClick={() => setReceipt({ open: true, invoiceId: invoice.id })}
          >
            Record receipt
          </Button>
        ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Receivables"
        subtitle="What customers owe, and what’s late"
        actions={
          <>
            <Button onClick={() => setReceipt({ open: true })}>Record receipt</Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} /> New invoice
            </Button>
          </>
        }
      />

      <StatGrid label="Receivables summary">
        <StatCard
          label="Outstanding"
          value={formatMoney(balanceOf(unpaid))}
          hint={`${plural(unpaid.length, 'unpaid invoice')}`}
        />
        <StatCard
          label="Overdue"
          tone={overdue.length ? 'danger' : undefined}
          value={formatMoney(balanceOf(overdue))}
          hint={`${plural(overdue.length, 'invoice')} past due`}
          to="/receivables?status=overdue&sort=overdue"
        />
        <StatCard
          label="Due in 7 days"
          value={formatMoney(balanceOf(dueSoon))}
          hint={plural(dueSoon.length, 'invoice')}
        />
        <StatCard
          label="Collected, last 30 days"
          value={formatMoney(sumAmounts(collected))}
          hint={plural(collected.length, 'receipt')}
        />
      </StatGrid>

      <Segmented
        label="Invoice status"
        value={filters.status}
        options={INVOICE_STATUS_FILTERS.map((value) => ({
          value,
          label: STATUS_LABELS[value],
          count: rows.filter((r) => statusMatches(r, value)).length,
        }))}
        onChange={(status) => update({ status })}
      />

      <Toolbar label="Filter invoices">
        <SearchInput
          label="Search invoices"
          placeholder="Invoice no., customer or amount"
          value={filters.q}
          onChange={(q) => update({ q })}
        />
        <Select
          label="Sort by"
          value={filters.sort}
          options={[...SORT_OPTIONS]}
          onChange={(sort) => update({ sort })}
        />
      </Toolbar>

      <Card label="Invoices">
        {visible.length === 0 ? (
          <EmptyState
            title="No invoices here"
            action={isFiltered && <Button onClick={reset}>Clear filters</Button>}
          >
            {isFiltered
              ? 'Nothing matches this search and status.'
              : 'Raise an invoice to get started.'}
          </EmptyState>
        ) : (
          <Table caption="Invoices" columns={columns} rows={visible} rowKey={(r) => r.invoice.id} />
        )}
      </Card>

      <RecordReceiptDialog
        open={receipt.open}
        invoiceId={receipt.invoiceId}
        onOpenChange={(open) => setReceipt((r) => ({ ...r, open }))}
      />
      <NewInvoiceDialog open={creating} onOpenChange={setCreating} />
    </Page>
  )
}
