import { Badge, type Tone } from '@/components/Badge'
import type { InvoiceStatus } from '@/lib/receivables'

const LOOK: Record<InvoiceStatus, { tone: Tone; label: string }> = {
  due: { tone: 'info', label: 'Due' },
  partial: { tone: 'warning', label: 'Part paid' },
  overdue: { tone: 'danger', label: 'Overdue' },
  paid: { tone: 'success', label: 'Paid' },
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { tone, label } = LOOK[status]
  return <Badge tone={tone}>{label}</Badge>
}
