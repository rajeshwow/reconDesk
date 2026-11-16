import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoicesApi } from '@/api/mockApi'
import { queryKeys, useParties, useServerMutation } from '@/api/queries'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { FormError, TextField, fieldStyles } from '@/components/Field'
import { Select } from '@/components/Select'
import { useToast } from '@/components/Toast'
import { addDays, todayISO } from '@/lib/dates'
import { formatDate } from '@/lib/format'

interface NewInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  partyId?: string
}

export function NewInvoiceDialog({ open, onOpenChange, partyId }: NewInvoiceDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New invoice"
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="invoice-form">
            Raise invoice
          </Button>
        </>
      }
    >
      <InvoiceForm initialParty={partyId} onDone={() => onOpenChange(false)} />
    </Dialog>
  )
}

function InvoiceForm({ initialParty = '', onDone }: { initialParty?: string; onDone: () => void }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { data: parties = [] } = useParties()
  const mutation = useServerMutation(invoicesApi.create, [queryKeys.invoices])

  const [partyId, setPartyId] = useState(initialParty)
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const customers = parties.filter((p) => p.kind === 'customer')
  const party = customers.find((p) => p.id === partyId)
  const value = Number(amount.replace(/,/g, ''))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.isPending) return
    if (!partyId) return setError('Choose a customer.')
    if (!(value > 0)) return setError('Enter the invoice amount.')

    mutation.mutate(
      { partyId, date, amount: value },
      {
        onSuccess: (invoice) => {
          toast.show(`${invoice.id} raised`, {
            action: { label: 'Open', onClick: () => navigate(`/receivables/${invoice.id}`) },
          })
          onDone()
        },
      },
    )
  }

  return (
    <form id="invoice-form" className={fieldStyles.grid} onSubmit={submit} noValidate>
      <Select
        label="Customer"
        value={partyId}
        options={[
          { value: '', label: 'Choose a customer' },
          ...customers.map((p) => ({ value: p.id, label: p.name })),
        ]}
        onChange={(id) => {
          setPartyId(id)
          setError('')
        }}
      />
      <div className={fieldStyles.row}>
        <TextField
          label="Invoice date"
          type="date"
          value={date}
          onChange={setDate}
          hint={
            party && date
              ? `Due ${formatDate(addDays(date, party.creditDays), true)} (${party.creditDays} days)`
              : undefined
          }
        />
        <TextField
          label="Amount incl. GST (₹)"
          inputMode="decimal"
          value={amount}
          onChange={(v) => {
            setAmount(v)
            setError('')
          }}
        />
      </div>
      {(error || mutation.error) && <FormError>{error || mutation.error?.message}</FormError>}
    </form>
  )
}
