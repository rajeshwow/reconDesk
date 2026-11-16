import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { billsApi } from '@/api/mockApi'
import { queryKeys, useParties, useServerMutation } from '@/api/queries'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { FormError, TextField, fieldStyles } from '@/components/Field'
import { Select } from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO } from '@/lib/dates'
import { BILL_CATEGORIES } from '@/lib/payables'

interface NewBillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  partyId?: string
}

export function NewBillDialog({ open, onOpenChange, partyId }: NewBillDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Enter vendor bill"
      description="New bills wait for approval before they can be paid."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="bill-form">
            Save bill
          </Button>
        </>
      }
    >
      <BillForm initialParty={partyId} onDone={() => onOpenChange(false)} />
    </Dialog>
  )
}

function BillForm({ initialParty = '', onDone }: { initialParty?: string; onDone: () => void }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { data: parties = [] } = useParties()
  const mutation = useServerMutation(billsApi.create, [queryKeys.bills])

  const vendors = parties.filter((p) => p.kind === 'vendor')
  const [partyId, setPartyId] = useState(initialParty)
  const [number, setNumber] = useState('')
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>(BILL_CATEGORIES[0])
  const [error, setError] = useState('')

  const value = Number(amount.replace(/,/g, ''))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.isPending) return
    if (!partyId) return setError('Choose the vendor.')
    if (!number.trim()) return setError('Enter the bill number printed on the vendor’s invoice.')
    if (!(value > 0)) return setError('Enter the bill amount.')

    mutation.mutate(
      { partyId, number, date, amount: value, category },
      {
        onSuccess: (bill) => {
          toast.show(`Bill ${bill.number} sent for approval`, {
            action: { label: 'Open', onClick: () => navigate(`/payables/${bill.id}`) },
          })
          onDone()
        },
      },
    )
  }

  const clear =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setError('')
    }

  return (
    <form id="bill-form" className={fieldStyles.grid} onSubmit={submit} noValidate>
      <Select
        label="Vendor"
        value={partyId}
        options={[
          { value: '', label: 'Choose a vendor' },
          ...vendors.map((p) => ({ value: p.id, label: p.name })),
        ]}
        onChange={clear(setPartyId)}
      />
      <div className={fieldStyles.row}>
        <TextField label="Vendor’s bill no." value={number} onChange={clear(setNumber)} />
        <TextField label="Bill date" type="date" value={date} onChange={setDate} />
      </div>
      <div className={fieldStyles.row}>
        <TextField
          label="Amount incl. GST (₹)"
          inputMode="decimal"
          value={amount}
          onChange={clear(setAmount)}
        />
        <Select
          label="Category"
          value={category}
          options={BILL_CATEGORIES.map((c) => ({ value: c, label: c }))}
          onChange={setCategory}
        />
      </div>
      {(error || mutation.error) && <FormError>{error || mutation.error?.message}</FormError>}
    </form>
  )
}
