import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBills, useInvoices, useParties } from '@/api/queries'
import type { Bill, Invoice, Party } from '@/api/types'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SearchInput } from '@/components/Field'
import { Loader } from '@/components/Loader'
import { Page, PageHeader } from '@/components/Page'
import { Card } from '@/components/Panel'
import { Segmented } from '@/components/Segmented'
import { Select } from '@/components/Select'
import { EmptyState } from '@/components/States'
import { Table, tableStyles, type Column } from '@/components/Table'
import { Toolbar } from '@/components/Toolbar'
import { useUrlState } from '@/hooks/useUrlState'
import { todayISO } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { partyBalance, type PartyBalance } from '@/lib/statement'

const KINDS = ['all', 'customer', 'vendor'] as const
const SORTS = ['name', 'outstanding', 'overdue'] as const
const DEFAULTS = {
  q: '',
  kind: 'all' as (typeof KINDS)[number],
  sort: 'outstanding' as (typeof SORTS)[number],
}
const ALLOWED = { kind: KINDS, sort: SORTS }

interface PartyRow {
  party: Party
  balance: PartyBalance
}

export function PartiesPage() {
  const parties = useParties()
  const invoices = useInvoices()
  const bills = useBills()

  return (
    <Loader queries={[parties, invoices, bills]} what="customers and vendors">
      {() => <Parties parties={parties.data!} invoices={invoices.data!} bills={bills.data!} />}
    </Loader>
  )
}

function Parties({
  parties,
  invoices,
  bills,
}: {
  parties: Party[]
  invoices: Invoice[]
  bills: Bill[]
}) {
  const { state, update, reset, isFiltered } = useUrlState(DEFAULTS, ALLOWED)
  const today = todayISO()

  const rows = useMemo(
    () => parties.map((party) => ({ party, balance: partyBalance(party, invoices, bills, today) })),
    [parties, invoices, bills, today],
  )

  const visible = useMemo(() => {
    const q = state.q.trim().toLowerCase()
    return rows
      .filter((r) => state.kind === 'all' || r.party.kind === state.kind)
      .filter(
        (r) =>
          !q ||
          [r.party.name, r.party.city, r.party.gstin].some((f) => f.toLowerCase().includes(q)),
      )
      .sort((a, b) =>
        state.sort === 'name'
          ? a.party.name.localeCompare(b.party.name)
          : b.balance[state.sort] - a.balance[state.sort],
      )
  }, [rows, state])

  const columns: Column<PartyRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: ({ party }) => (
        <>
          <Link to={`/parties/${party.id}`} className={tableStyles.link}>
            {party.name}
          </Link>
          <span className={tableStyles.sub}>{party.city}</span>
        </>
      ),
    },
    {
      key: 'kind',
      header: 'Type',
      render: ({ party }) => (
        <Badge tone={party.kind === 'customer' ? 'info' : 'neutral'}>
          {party.kind === 'customer' ? 'Customer' : 'Vendor'}
        </Badge>
      ),
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      hideOnMobile: true,
      render: ({ party }) => <span className="tabular">{party.gstin}</span>,
    },
    {
      key: 'terms',
      header: 'Credit',
      hideOnMobile: true,
      render: ({ party }) => `${party.creditDays} days`,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      render: ({ party, balance }) => (
        <>
          {formatMoney(balance.outstanding)}
          <span className={tableStyles.sub}>
            {party.kind === 'customer' ? 'they owe us' : 'we owe them'}
          </span>
        </>
      ),
    },
    {
      key: 'overdue',
      header: 'Overdue',
      align: 'right',
      hideOnMobile: true,
      render: ({ balance }) =>
        balance.overdue > 0 ? (
          <Badge tone="danger">{formatMoney(balance.overdue)}</Badge>
        ) : (
          <span className={tableStyles.muted}>—</span>
        ),
    },
  ]

  return (
    <Page>
      <PageHeader title="Customers & vendors" subtitle="Who owes what, and to whom" />

      <Segmented
        label="Party type"
        value={state.kind}
        options={[
          { value: 'all', label: 'All', count: rows.length },
          {
            value: 'customer',
            label: 'Customers',
            count: rows.filter((r) => r.party.kind === 'customer').length,
          },
          {
            value: 'vendor',
            label: 'Vendors',
            count: rows.filter((r) => r.party.kind === 'vendor').length,
          },
        ]}
        onChange={(kind) => update({ kind })}
      />

      <Toolbar label="Filter parties">
        <SearchInput
          label="Search parties"
          placeholder="Name, city or GSTIN"
          value={state.q}
          onChange={(q) => update({ q })}
        />
        <Select
          label="Sort by"
          value={state.sort}
          options={[
            { value: 'outstanding', label: 'Largest balance' },
            { value: 'overdue', label: 'Most overdue' },
            { value: 'name', label: 'Name' },
          ]}
          onChange={(sort) => update({ sort })}
        />
      </Toolbar>

      <Card label="Parties">
        {visible.length === 0 ? (
          <EmptyState
            title="No one matches that search"
            action={isFiltered && <Button onClick={reset}>Clear filters</Button>}
          />
        ) : (
          <Table
            caption="Customers and vendors"
            columns={columns}
            rows={visible}
            rowKey={(r) => r.party.id}
          />
        )}
      </Card>
    </Page>
  )
}
