import { Badge, type Tone } from '@/components/Badge'
import type { RowStatus } from '@/lib/filters'
import type { Confidence } from '@/lib/matching'

const CONFIDENCE_TONE: Record<Confidence, Tone> = {
  high: 'success',
  medium: 'warning',
  low: 'neutral',
}

const capitalise = (text: string) => text[0].toUpperCase() + text.slice(1)

export function StatusBadge({
  status,
  confidence,
}: {
  status: RowStatus
  confidence?: Confidence
}) {
  switch (status) {
    case 'matched':
      return <Badge tone="success">Matched</Badge>
    case 'excluded':
      return <Badge tone="neutral">Excluded</Badge>
    case 'suggested':
      return (
        <Badge tone="info">{confidence ? `${capitalise(confidence)} match` : 'Suggested'}</Badge>
      )
    default:
      return <Badge tone="warning">Unmatched</Badge>
  }
}

export function ConfidenceBadge({ confidence, score }: { confidence: Confidence; score: number }) {
  return (
    <Badge tone={CONFIDENCE_TONE[confidence]}>
      {capitalise(confidence)} · {score}
    </Badge>
  )
}
