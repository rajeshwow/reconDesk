import type { Bill, Invoice, Reconciliation, Settings } from '@/api/types'
import { buildRows } from './filters'
import { formatMoney, sumAmounts } from './format'
import { isBillOverdue } from './payables'
import { balanceDue, daysOverdue, invoiceStatus } from './receivables'
import { exclusionsFromRules } from './rules'

export interface AttentionItem {
  key: string
  title: string
  detail: string
  count: number
  to: string
  tone: 'danger' | 'warning' | 'info'
}

interface Inputs {
  recon: Reconciliation
  invoices: Invoice[]
  bills: Bill[]
  settings: Settings
  today: string
}

// The overview's to-do list: one line per kind of problem, each linking to the exact
// filtered view that fixes it. Empty kinds are left out.
export function buildAttention({
  recon,
  invoices,
  bills,
  settings,
  today,
}: Inputs): AttentionItem[] {
  const rows = buildRows(recon, today, settings)

  const toApprove = bills.filter((b) => b.status === 'awaiting_approval')
  const lateBills = bills.filter((b) => b.status === 'approved' && isBillOverdue(b, today))
  const veryLate = invoices.filter(
    (i) => invoiceStatus(i, today) === 'overdue' && daysOverdue(i.dueDate, today) > 30,
  )
  const readyToMatch = rows.filter(
    (r) => r.status === 'suggested' && r.suggestion?.confidence === 'high',
  )
  const unbooked = rows.filter((r) => r.status === 'open' && r.line.direction === 'in')
  const byRule = exclusionsFromRules(recon.bankLines, settings.rules)

  const items: AttentionItem[] = [
    {
      key: 'late-bills',
      title: 'Approved bills past their due date',
      detail: `${formatMoney(sumAmounts(lateBills))} to pay`,
      count: lateBills.length,
      to: '/payables?status=overdue',
      tone: 'danger',
    },
    {
      key: 'late-invoices',
      title: 'Invoices more than 30 days overdue',
      detail: `${formatMoney(sumAmounts(veryLate.map((i) => ({ amount: balanceDue(i) }))))} to chase`,
      count: veryLate.length,
      to: '/receivables?status=overdue&sort=overdue',
      tone: 'danger',
    },
    {
      key: 'approve',
      title: 'Bills waiting for your approval',
      detail: formatMoney(sumAmounts(toApprove)),
      count: toApprove.length,
      to: '/payables?status=awaiting_approval',
      tone: 'warning',
    },
    {
      key: 'unbooked',
      title: 'Money received that nobody has booked',
      detail: `${formatMoney(sumAmounts(unbooked.map((r) => r.line)))} on the statement`,
      count: unbooked.length,
      to: '/reconciliation?status=open&direction=in',
      tone: 'warning',
    },
    {
      key: 'ready',
      title: 'High-confidence matches ready to accept',
      detail: 'One click each, or all at once',
      count: readyToMatch.length,
      to: '/reconciliation?confidence=high',
      tone: 'info',
    },
    {
      key: 'rules',
      title: 'Bank charges your rules can clear',
      detail: 'Press “Apply rules” on the reconciliation page',
      count: byRule.length,
      to: '/reconciliation',
      tone: 'info',
    },
  ]

  return items.filter((item) => item.count > 0)
}
