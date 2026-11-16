import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBills, useParties } from '@/api/queries'
import type { Bill, Party } from '@/api/types'
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
  BILL_CATEGORIES,
  BILL_SORTS,
  BILL_STATUS_FILTERS,
  billStatusMatches,
  filterBills,
  isBillOpen,
  toBillRows,
  type BillFilters,
  type BillRow,
} from '@/lib/payables'
import { BillStatusBadge } from './BillStatusBadge'
import { NewBillDialog } from './NewBillDialog'
import { PayBillDialog } from './PayBillDialog'
import { RejectBillDialog } from './RejectBillDialog'
import { useApproveBills } from './useBillDecisions'

const DEFAULTS: BillFilters = { q: '', status: 'open', category: 'all', sort: 'due' }
const ALLOWED = {
  status: BILL_STATUS_FILTERS,
  sort: BILL_SORTS,
  category: ['all', ...BILL_CATEGORIES],
}

const STATUS_LABELS: Record<BillFilters['status'], string> = {
  open: 'Unpaid',
  awaiting_approval: 'To approve',
  approved: 'Approved',
  overdue: 'Overdue',
  paid: 'Paid',
  rejected: 'Rejected',
  all: 'All',
}

export function PayablesPage() {
  const bills = useBills()
  const parties = useParties()

  return (
    <Loader queries={[bills, parties]} what="payables">
      {() => <Payables bills={bills.data!} parties={parties.data!} />}
    </Loader>
  )
}

function Payables({ bills, parties }: { bills: Bill[]; parties: Party[] }) {
  const { state: filters, update, reset, isFiltered } = useUrlState(DEFAULTS, ALLOWED)
  const { approve, isPending: approving } = useApproveBills()
  const [checked, setChecked] = useState<string[]>([])
  const [paying, setPaying] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Bill | null>(null)
  const [creating, setCreating] = useState(false)

  const today = todayISO()
  const names = useMemo(() => new Map(parties.map((p) => [p.id, p.name])), [parties])
  const rows = useMemo(() => toBillRows(bills, names, today), [bills, names, today])
  const visible = useMemo(() => filterBills(rows, filters), [rows, filters])

  const open = bills.filter(isBillOpen)
  const toApprove = bills.filter((b) => b.status === 'awaiting_approval')
  const overdue = rows.filter((r) => r.overdue).map((r) => r.bill)
  const dueThisWeek = open.filter((b) => b.dueDate >= today && b.dueDate <= addDays(today, 7))

  // Bulk approval only makes sense on the "To approve" tab.
  const selecting = filters.status === 'awaiting_approval'
  const checkedVisible = checked.filter((id) => visible.some((r) => r.bill.id === id))

  function toggle(id: string) {
    setChecked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  const columns: Column<BillRow>[] = [
    ...(selecting
      ? [
          {
            key: 'select',
            header: <span className="sr-only">Select</span>,
            render: ({ bill }: BillRow) => (
              <input
                type="checkbox"
                aria-label={`Select bill ${bill.number}`}
                checked={checked.includes(bill.id)}
                onChange={() => toggle(bill.id)}
              />
            ),
          },
        ]
      : []),
    {
      key: 'bill',
      header: 'Bill',
      render: ({ bill }) => (
        <>
          <Link to={`/payables/${bill.id}`} className={tableStyles.link}>
            {bill.number}
          </Link>
          <span className={tableStyles.sub}>{bill.category}</span>
        </>
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: ({ bill, partyName }) => (
        <Link to={`/parties/${bill.partyId}`} className={tableStyles.link}>
          {partyName}
        </Link>
      ),
    },
    {
      key: 'date',
      header: 'Bill date',
      hideOnMobile: true,
      render: ({ bill }) => formatDate(bill.date, true),
    },
    {
      key: 'due',
      header: 'Due',
      hideOnMobile: true,
      render: ({ bill }) => formatDate(bill.dueDate, true),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: ({ bill }) => formatMoney(bill.amount),
    },
    {
      key: 'status',
      header: 'Status',
      render: ({ bill, overdue }) => <BillStatusBadge bill={bill} overdue={overdue} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: ({ bill }) => (
        <div className={tableStyles.rowActions}>
          {bill.status === 'awaiting_approval' && (
            <>
              <Button
                size="sm"
                variant="primary"
                aria-label={`Approve bill ${bill.number}`}
                onClick={() => approve([bill.id])}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                aria-label={`Reject bill ${bill.number}`}
                onClick={() => setRejecting(bill)}
              >
                Reject
              </Button>
            </>
          )}
          {bill.status === 'approved' && (
            <Button
              size="sm"
              aria-label={`Pay bill ${bill.number}`}
              onClick={() => setPaying(bill.id)}
            >
              Pay
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Payables"
        subtitle="Vendor bills: approve, pay, and keep an eye on what’s due"
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> Enter bill
          </Button>
        }
      />

      <StatGrid label="Payables summary">
        <StatCard
          label="Unpaid bills"
          value={formatMoney(sumAmounts(open))}
          hint={plural(open.length, 'bill')}
        />
        <StatCard
          label="Waiting for approval"
          value={toApprove.length}
          tone={toApprove.length ? 'warning' : undefined}
          hint={formatMoney(sumAmounts(toApprove))}
          to="/payables?status=awaiting_approval"
        />
        <StatCard
          label="Due in 7 days"
          value={formatMoney(sumAmounts(dueThisWeek))}
          hint={plural(dueThisWeek.length, 'bill')}
        />
        <StatCard
          label="Overdue"
          value={formatMoney(sumAmounts(overdue))}
          tone={overdue.length ? 'danger' : undefined}
          hint={`${plural(overdue.length, 'bill')} past due`}
          to="/payables?status=overdue"
        />
      </StatGrid>

      <Segmented
        label="Bill status"
        value={filters.status}
        options={BILL_STATUS_FILTERS.map((value) => ({
          value,
          label: STATUS_LABELS[value],
          count: rows.filter((r) => billStatusMatches(r, value)).length,
        }))}
        onChange={(status) => {
          update({ status })
          setChecked([])
        }}
      />

      <Toolbar
        label="Filter bills"
        actions={
          selecting && (
            <Button
              variant="primary"
              disabled={checkedVisible.length === 0 || approving}
              onClick={() => approve(checkedVisible, () => setChecked([]))}
            >
              Approve selected ({checkedVisible.length})
            </Button>
          )
        }
      >
        <SearchInput
          label="Search bills"
          placeholder="Bill no., vendor or amount"
          value={filters.q}
          onChange={(q) => update({ q })}
        />
        <Select
          label="Category"
          value={filters.category}
          options={[
            { value: 'all', label: 'All categories' },
            ...BILL_CATEGORIES.map((c) => ({ value: c, label: c })),
          ]}
          onChange={(category) => update({ category })}
        />
        <Select
          label="Sort by"
          value={filters.sort}
          options={[
            { value: 'due', label: 'Due date' },
            { value: 'amount', label: 'Largest amount' },
            { value: 'newest', label: 'Newest first' },
          ]}
          onChange={(sort) => update({ sort })}
        />
      </Toolbar>

      <Card label="Bills">
        {visible.length === 0 ? (
          <EmptyState
            title="No bills here"
            action={isFiltered && <Button onClick={reset}>Clear filters</Button>}
          >
            {filters.status === 'awaiting_approval'
              ? 'Nothing is waiting for approval.'
              : 'Nothing matches these filters.'}
          </EmptyState>
        ) : (
          <Table caption="Bills" columns={columns} rows={visible} rowKey={(r) => r.bill.id} />
        )}
      </Card>

      <PayBillDialog
        open={paying !== null}
        billId={paying ?? undefined}
        onOpenChange={(o) => !o && setPaying(null)}
      />
      <RejectBillDialog bill={rejecting} onOpenChange={(o) => !o && setRejecting(null)} />
      <NewBillDialog open={creating} onOpenChange={setCreating} />
    </Page>
  )
}
