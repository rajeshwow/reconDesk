import { useState } from 'react'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import type { BankRow } from '@/lib/filters'
import { formatMoney, sumAmounts } from '@/lib/format'
import { useReconActions } from '@/features/reconciliation/ReconActionsProvider'

export function BulkAcceptButton({ rows }: { rows: BankRow[] }) {
  const [open, setOpen] = useState(false)
  const actions = useReconActions()

  const pairs = rows.flatMap((row) =>
    row.suggestion ? [{ lineId: row.line.id, ledgerIds: [row.suggestion.entry.id] }] : [],
  )

  function confirm() {
    actions.match(pairs)
    setOpen(false)
  }

  return (
    <>
      <Button variant="primary" disabled={pairs.length === 0} onClick={() => setOpen(true)}>
        Accept {pairs.length} high-confidence
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Accept ${pairs.length} matches?`}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={confirm}>
              Accept all
            </Button>
          </>
        }
      >
        <p>
          Each of these pairs scored 80 or more on amount, date and reference. Together they cover{' '}
          <strong>{formatMoney(sumAmounts(rows.map((r) => r.line)))}</strong> of statement lines.
          You can undo straight after.
        </p>
      </Dialog>
    </>
  )
}
