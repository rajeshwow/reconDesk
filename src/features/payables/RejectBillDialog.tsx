import { useState, type FormEvent } from 'react'
import type { Bill } from '@/api/types'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { FormError, TextField, fieldStyles } from '@/components/Field'
import { useToast } from '@/components/Toast'
import { useRejectBill } from './useBillDecisions'

interface RejectBillDialogProps {
  bill: Bill | null
  onOpenChange: (open: boolean) => void
}

export function RejectBillDialog({ bill, onOpenChange }: RejectBillDialogProps) {
  return (
    <Dialog
      open={bill !== null}
      onOpenChange={onOpenChange}
      title={`Reject bill ${bill?.number ?? ''}?`}
      description="The vendor’s accounts team will need the reason to send a corrected bill."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="danger" type="submit" form="reject-form">
            Reject bill
          </Button>
        </>
      }
    >
      {bill && <RejectForm billId={bill.id} onDone={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function RejectForm({ billId, onDone }: { billId: string; onDone: () => void }) {
  const toast = useToast()
  const mutation = useRejectBill()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.isPending) return
    if (!reason.trim()) return setError('Give a reason, e.g. “Rate doesn’t match the PO”.')
    mutation.mutate(
      { billId, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.show('Bill rejected')
          onDone()
        },
      },
    )
  }

  return (
    <form id="reject-form" className={fieldStyles.grid} onSubmit={submit} noValidate>
      <TextField
        label="Reason"
        value={reason}
        onChange={(value) => {
          setReason(value)
          setError('')
        }}
        error={error}
      />
      {mutation.error && <FormError>{mutation.error.message}</FormError>}
    </form>
  )
}
