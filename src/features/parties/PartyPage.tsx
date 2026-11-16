import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useBills, useInvoices, useParties, useReconciliation } from '@/api/queries'
import type { Bill, Invoice, Party, Reconciliation } from '@/api/types'
import { Amount } from '@/components/Amount'
import { Badge } from '@/components/Badge'
import { Button, buttonClass } from '@/components/Button'
import { DetailList } from '@/components/DetailList'
import { Icon } from '@/components/Icon'
import { Loader } from '@/components/Loader'
import { Page, PageHeader } from '@/components/Page'
import { Panel } from '@/components/Panel'
import { StatCard, StatGrid } from '@/components/StatCard'
import { EmptyState } from '@/components/States'
import { Table, tableStyles, type Column } from '@/components/Table'
import { downloadCsv } from '@/lib/csv'
import { todayISO } from '@/lib/dates'
import { formatDate, formatMoney } from '@/lib/format'
import { mentionsParty } from '@/lib/matching'
import { averageDaysToPay, buildStatement, partyBalance, type StatementLine } from '@/lib/statement'
import { NewBillDialog } from '@/features/payables/NewBillDialog'
import { NewInvoiceDialog } from '@/features/receivables/NewInvoiceDialog'
import { RecordReceiptDialog } from '@/features/receivables/RecordReceiptDialog'
import styles from '../detail.module.css'

export function PartyPage() {
  const { partyId } = useParams()
  const parties = useParties()
  const invoices = useInvoices()
  const bills = useBills()
  const recon = useReconciliation()

  return (
    <Loader queries={[parties, invoices, bills, recon]} what="this party">
      {() => {
        const party = parties.data!.find((p) => p.id === partyId)
        if (!party) {
          return (
            <EmptyState
              title="We couldn’t find that customer or vendor"
              action={
                <Link to="/parties" className={buttonClass('primary')}>
                  See everyone
                </Link>
              }
            />
          )
        }
        return (
          <PartyDetail
            party={party}
            invoices={invoices.data!}
            bills={bills.data!}
            recon={recon.data!}
          />
        )
      }}
    </Loader>
  )
}

interface PartyDetailProps {
  party: Party
  invoices: Invoice[]
  bills: Bill[]
  recon: Reconciliation
}

type Dialog = 'receipt' | 'invoice' | 'bill' | null

function PartyDetail({ party, invoices, bills, recon }: PartyDetailProps) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const isCustomer = party.kind === 'customer'
  const today = todayISO()

  const balance = partyBalance(party, invoices, bills, today)
  const statement = useMemo(
    () => buildStatement(party, invoices, bills, recon.ledger),
    [party, invoices, bills, recon.ledger],
  )
  const daysToPay = isCustomer ? averageDaysToPay(party, invoices, recon.ledger) : null
  const toApprove = bills.filter(
    (b) => b.partyId === party.id && b.status === 'awaiting_approval',
  ).length

  // Money that moved in the bank with their name on it, but isn't in the books yet.
  const unbookedLines = recon.bankLines.filter(
    (l) => l.status === 'open' && mentionsParty(l.narration, party.name),
  )

  function exportStatement() {
    downloadCsv(`statement-${party.name.replace(/\W+/g, '-').toLowerCase()}.csv`, [
      ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'],
      ...statement.map((l) => [
        l.date,
        l.particulars,
        l.debit || '',
        l.credit || '',
        l.balance.toFixed(2),
      ]),
    ])
  }

  const columns: Column<StatementLine>[] = [
    { key: 'date', header: 'Date', render: (l) => formatDate(l.date, true) },
    {
      key: 'particulars',
      header: 'Particulars',
      render: (l) =>
        l.link ? (
          <Link to={l.link} className={tableStyles.link}>
            {l.particulars}
          </Link>
        ) : (
          l.particulars
        ),
    },
    {
      key: 'debit',
      header: 'Debit',
      align: 'right',
      render: (l) => (l.debit ? formatMoney(l.debit) : ''),
    },
    {
      key: 'credit',
      header: 'Credit',
      align: 'right',
      render: (l) => (l.credit ? formatMoney(l.credit) : ''),
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (l) => formatMoney(l.balance) },
  ]

  return (
    <Page>
      <PageHeader
        back={{ to: '/parties', label: 'Customers & vendors' }}
        title={party.name}
        badge={
          <Badge tone={isCustomer ? 'info' : 'neutral'}>{isCustomer ? 'Customer' : 'Vendor'}</Badge>
        }
        subtitle={`${party.city} · GSTIN ${party.gstin}`}
        actions={
          isCustomer ? (
            <>
              <Button onClick={() => setDialog('invoice')}>New invoice</Button>
              <Button variant="primary" onClick={() => setDialog('receipt')}>
                Record receipt
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setDialog('bill')}>
              Enter bill
            </Button>
          )
        }
      />

      <StatGrid label="Balances">
        <StatCard
          label={isCustomer ? 'They owe us' : 'We owe them'}
          value={formatMoney(balance.outstanding)}
          hint={`${balance.openCount} open ${isCustomer ? 'invoices' : 'bills'}`}
          to={
            isCustomer
              ? `/receivables?q=${encodeURIComponent(party.name)}`
              : `/payables?q=${encodeURIComponent(party.name)}`
          }
        />
        <StatCard
          label="Overdue"
          value={formatMoney(balance.overdue)}
          tone={balance.overdue > 0 ? 'danger' : undefined}
        />
        {isCustomer ? (
          <StatCard
            label="Usually pays in"
            value={daysToPay === null ? '—' : `${daysToPay} days`}
            hint={`Terms: ${party.creditDays} days`}
            tone={daysToPay !== null && daysToPay > party.creditDays ? 'warning' : undefined}
          />
        ) : (
          <StatCard
            label="Bills to approve"
            value={toApprove}
            hint={`Terms: ${party.creditDays} days`}
          />
        )}
        <StatCard
          label="In the bank, not in books"
          value={unbookedLines.length}
          hint="Lines that mention them"
        />
      </StatGrid>

      <div className={styles.columns}>
        <div className={styles.main}>
          <Panel
            title="Statement of account"
            flush
            actions={
              <Button
                size="sm"
                variant="ghost"
                onClick={exportStatement}
                disabled={statement.length === 0}
              >
                <Icon name="download" size={16} /> Export CSV
              </Button>
            }
          >
            {statement.length === 0 ? (
              <EmptyState compact title="No transactions yet" />
            ) : (
              <Table
                caption={`Statement of account for ${party.name}`}
                columns={columns}
                rows={statement}
                rowKey={(l) => l.key}
              />
            )}
          </Panel>
        </div>

        <div className={styles.side}>
          <Panel title="Details">
            <DetailList
              items={[
                ['GSTIN', party.gstin],
                ['City', party.city],
                ['Credit terms', `${party.creditDays} days`],
                ['Email', party.email],
                ['Phone', party.phone],
              ]}
            />
          </Panel>

          <Panel title="Unbooked bank lines">
            {unbookedLines.length === 0 ? (
              <p className={styles.note}>
                Nothing on the statement is waiting to be booked for them.
              </p>
            ) : (
              <ul className={tableStyles.plainList}>
                {unbookedLines.map((line) => (
                  <li key={line.id}>
                    <Link to={`/reconciliation/lines/${line.id}`} className={tableStyles.link}>
                      {formatDate(line.date)} · {line.id}
                    </Link>{' '}
                    <Amount value={line.amount} direction={line.direction} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <RecordReceiptDialog
        open={dialog === 'receipt'}
        onOpenChange={() => setDialog(null)}
        partyId={party.id}
      />
      <NewInvoiceDialog
        open={dialog === 'invoice'}
        onOpenChange={() => setDialog(null)}
        partyId={party.id}
      />
      <NewBillDialog
        open={dialog === 'bill'}
        onOpenChange={() => setDialog(null)}
        partyId={party.id}
      />
    </Page>
  )
}
