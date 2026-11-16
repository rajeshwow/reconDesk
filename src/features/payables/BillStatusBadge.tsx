import type { Bill } from '@/api/types'
import { Badge, type Tone } from '@/components/Badge'
import { BILL_STATUS_LABELS } from '@/lib/payables'

const TONES: Record<Bill['status'], Tone> = {
  awaiting_approval: 'warning',
  approved: 'info',
  rejected: 'neutral',
  paid: 'success',
}

export function BillStatusBadge({ bill, overdue }: { bill: Bill; overdue?: boolean }) {
  if (overdue) return <Badge tone="danger">{BILL_STATUS_LABELS[bill.status]} · overdue</Badge>
  return <Badge tone={TONES[bill.status]}>{BILL_STATUS_LABELS[bill.status]}</Badge>
}
