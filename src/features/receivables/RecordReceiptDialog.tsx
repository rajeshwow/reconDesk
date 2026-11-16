import { useMemo, useState, type FormEvent } from 'react'
import { invoicesApi } from '@/api/mockApi'
import { queryKeys, useInvoices, useParties, useServerMutation } from '@/api/queries'
import type { BankLine } from '@/api/types'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import { FormError, TextField, fieldStyles } from '@/components/Field'
import { Select } from '@/components/Select'
import { useToast } from '@/components/Toast'
import { todayISO } from '@/lib/dates'
import { formatDate, formatMoney, subtractMoney, toPaise } from '@/lib/format'
import { guessParty } from '@/lib/matching'
import { allocateOldestFirst, balanceDue } from '@/lib/receivables'
import styles from './RecordReceiptDialog.module.css'

interface RecordReceiptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Posting straight from an unmatched bank credit: amount, date and reference come from it. */
  bankLine?: BankLine
  partyId?: string
  invoiceId?: string
}

export function RecordReceiptDialog({ open, onOpenChange, ...defaults }: RecordReceiptDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record customer receipt"
      description={
        defaults.bankLine
          ? 'Creates a receipt voucher and matches it to this bank line.'
          : 'Creates a receipt voucher. It shows up in bank reconciliation once the money arrives.'
      }
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="receipt-form">
            Record receipt
          </Button>
        </>
      }
    >
      <ReceiptForm {...defaults} onDone={() => onOpenChange(false)} />
    </Dialog>
  )
}

type FormProps = Omit<RecordReceiptDialogProps, 'open' | 'onOpenChange'> & { onDone: () => void }

function ReceiptForm({ bankLine, partyId: initialParty, invoiceId, onDone }: FormProps) {
  const toast = useToast()
  const { data: parties = [] } = useParties()
  const { data: invoices = [] } = useInvoices()
  const mutation = useServerMutation(invoicesApi.recordReceipt, [
    queryKeys.invoices,
    queryKeys.reconciliation,
  ])

  const customers = parties.filter((p) => p.kind === 'customer')
  const startingInvoice = invoices.find((i) => i.id === invoiceId)

  const [partyId, setPartyId] = useState(
    initialParty ??
      startingInvoice?.partyId ??
      (bankLine && guessParty(bankLine.narration, customers)?.id) ??
      '',
  )
  const [amount, setAmount] = useState(
    bankLine ? String(bankLine.amount) : startingInvoice ? String(balanceDue(startingInvoice)) : '',
  )
  const [date, setDate] = useState(bankLine?.date ?? todayISO())
  const [ref, setRef] = useState(bankLine?.ref ?? '')
  const [error, setError] = useState('')

  const openInvoices = useMemo(
    () =>
      invoices
        .filter((i) => i.partyId === partyId && balanceDue(i) > 0)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [invoices, partyId],
  )

  // From a bank line, an invoice with exactly that balance is almost certainly the one.
  const [invoiceIds, setInvoiceIds] = useState<string[]>(() => {
    if (invoiceId) return [invoiceId]
    if (!bankLine) return []
    const exact = openInvoices.find((i) => toPaise(balanceDue(i)) === toPaise(bankLine.amount))
    return exact ? [exact.id] : openInvoices.slice(0, 1).map((i) => i.id)
  })

  const value = Number(amount.replace(/,/g, ''))
  const selected = openInvoices.filter((i) => invoiceIds.includes(i.id))
  const shares = new Map(
    allocateOldestFirst(value || 0, selected).map((s) => [s.invoiceId, s.amount]),
  )
  const allocated = [...shares.values()].reduce((total, share) => total + toPaise(share), 0) / 100
  const advance = subtractMoney(value || 0, allocated)

  function toggle(id: string) {
    setInvoiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
    setError('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mutation.isPending) return
    if (!partyId) return setError('Choose the customer who paid.')
    if (!(value > 0)) return setError('Enter the amount received.')
    if (invoiceIds.length === 0) return setError('Tick at least one invoice this payment is for.')

    mutation.mutate(
      { partyId, amount: value, date, ref: ref.trim(), invoiceIds, bankLineId: bankLine?.id },
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

  return (
    <form id="receipt-form" className={fieldStyles.grid} onSubmit={submit} noValidate>
      <Select
        label="Customer"
        value={partyId}
        options={[
          { value: '', label: 'Choose a customer' },
          ...customers.map((p) => ({ value: p.id, label: p.name })),
        ]}
        onChange={(id) => {
          setPartyId(id)
          setInvoiceIds([])
          setError('')
        }}
      />

      <div className={fieldStyles.row}>
        <TextField
          label="Amount (₹)"
          inputMode="decimal"
          value={amount}
          onChange={setAmount}
          readOnly={Boolean(bankLine)}
        />
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={setDate}
          readOnly={Boolean(bankLine)}
        />
      </div>
      <TextField
        label="UTR / cheque no."
        value={ref}
        onChange={setRef}
        hint="Helps the matcher find it on the statement"
      />

      {partyId && (
        <fieldset className={styles.invoices}>
          <legend className={fieldStyles.label}>Invoices this pays</legend>
          {openInvoices.length === 0 && (
            <p className={styles.none}>This customer has no open invoices.</p>
          )}
          {openInvoices.map((invoice) => (
            <label key={invoice.id} className={styles.invoice}>
              <input
                type="checkbox"
                checked={invoiceIds.includes(invoice.id)}
                onChange={() => toggle(invoice.id)}
              />
              <span className={styles.invoiceText}>
                <span className={styles.invoiceId}>{invoice.id}</span>
                <span className={styles.meta}>
                  {formatDate(invoice.date)} · balance {formatMoney(balanceDue(invoice))}
                </span>
              </span>
              {shares.has(invoice.id) && (
                <span className={styles.share}>{formatMoney(shares.get(invoice.id)!)}</span>
              )}
            </label>
          ))}
          {advance > 0 && selected.length > 0 && (
            <p className={styles.meta}>
              {formatMoney(advance)} is more than these invoices. It stays on account as an advance.
            </p>
          )}
        </fieldset>
      )}

      {(error || mutation.error) && <FormError>{error || mutation.error?.message}</FormError>}
      {mutation.isPending && <p className={styles.meta}>Saving…</p>}
    </form>
  )
}
