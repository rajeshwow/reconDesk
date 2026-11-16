import { useState, type FormEvent } from 'react'
import { billsApi } from '@/api/mockApi'
import { queryKeys, useBills, usePartyLookup, useServerMutation } from '@/api/queries'
import type { BankLine } from '@/api/types'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { FormError, TextField, fieldStyles } from '@/components/Field'
import { Select } from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO } from '@/lib/dates'
import { formatMoney, toPaise } from '@/lib/format'
import { mentionsParty } from '@/lib/matching'

interface PayBillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Paying a known bill from its own page. */
  billId?: string
  /** Recording a payment the bank already shows: pick which approved bill it settled. */
  bankLine?: BankLine
}

export function PayBillDialog({ open, onOpenChange, billId, bankLine }: PayBillDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record bill payment"
      description={
        bankLine
          ? 'Creates a payment voucher and matches it to this bank debit.'
          : 'Creates a payment voucher. It shows up in bank reconciliation until the bank debit appears.'
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="payment-form">
            Record payment
          </Button>
        </>
      }
    >
      <PaymentForm billId={billId} bankLine={bankLine} onDone={() => onOpenChange(false)} />
    </Dialog>
  )
}

function PaymentForm({
  billId: fixedBill,
  bankLine,
  onDone,
}: {
  billId?: string
  bankLine?: BankLine
  onDone: () => void
}) {
  const toast = useToast()
  const { data: bills = [] } = useBills()
  const parties = usePartyLookup()
  const mutation = useServerMutation(billsApi.pay, [queryKeys.bills, queryKeys.reconciliation])

  // Approved bills, the likely one first: same amount as the debit and the vendor in the narration.
  const likely = (amount: number, partyId: string) =>
    (bankLine && toPaise(amount) === toPaise(bankLine.amount) ? 2 : 0) +
    (bankLine && mentionsParty(bankLine.narration, parties.get(partyId)?.name ?? '') ? 1 : 0)
  const payable = bills
    .filter((b) => b.status === 'approved')
    .sort((a, b) => likely(b.amount, b.partyId) - likely(a.amount, a.partyId))

  const [billId, setBillId] = useState(fixedBill ?? (bankLine ? payable[0]?.id : '') ?? '')
  const [date, setDate] = useState(bankLine?.date ?? todayISO())
  const [ref, setRef] = useState(bankLine?.ref ?? '')
  const [error, setError] = useState('')

  const bill = bills.find((b) => b.id === billId)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.isPending) return
    if (!billId) return setError('Choose the bill this payment settles.')
    mutation.mutate(
      { billId, date, ref: ref.trim(), bankLineId: bankLine?.id },
      {
        onSuccess: (entry) => {
          toast.show(
            bankLine ? `${entry.voucherNo} recorded and matched` : `${entry.voucherNo} recorded`,
          )
          onDone()
        },
      },
    )
  }

  const label = (id: string) => {
    const b = bills.find((x) => x.id === id)!
    const exact =
      bankLine && toPaise(b.amount) === toPaise(bankLine.amount) ? ' · exact amount' : ''
    return `${b.number} · ${parties.get(b.partyId)?.name} · ${formatMoney(b.amount)}${exact}`
  }

  return (
    <form id="payment-form" className={fieldStyles.grid} onSubmit={submit} noValidate>
      {fixedBill ? (
        <TextField
          label="Bill"
          value={bill ? label(bill.id) : fixedBill}
          onChange={() => {}}
          readOnly
        />
      ) : (
        <Select
          label="Approved bill"
          value={billId}
          options={[
            { value: '', label: payable.length ? 'Choose a bill' : 'No approved bills to pay' },
            ...payable.map((b) => ({ value: b.id, label: label(b.id) })),
          ]}
          onChange={(id) => {
            setBillId(id)
            setError('')
          }}
        />
      )}
      <div className={fieldStyles.row}>
        <TextField
          label="Payment date"
          type="date"
          value={date}
          onChange={setDate}
          readOnly={Boolean(bankLine)}
        />
        <TextField
          label="UTR / cheque no."
          value={ref}
          onChange={setRef}
          readOnly={Boolean(bankLine)}
        />
      </div>
      {bill && (
        <p className={fieldStyles.hint}>Amount paid: {formatMoney(bill.amount)} (the full bill)</p>
      )}
      {(error || mutation.error) && <FormError>{error || mutation.error?.message}</FormError>}
    </form>
  )
}
