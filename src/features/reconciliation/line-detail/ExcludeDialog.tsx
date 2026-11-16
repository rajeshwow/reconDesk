import { useState, type FormEvent } from 'react'
import { Button } from '@/components/Button'
import { Dialog } from '@/components/Dialog'
import styles from './ExcludeDialog.module.css'

const REASONS = [
  'Bank charges',
  'Not yet posted in books',
  'Duplicate on statement',
  'Other',
] as const
type Reason = (typeof REASONS)[number]

interface ExcludeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
}

export function ExcludeDialog({ open, onOpenChange, onConfirm }: ExcludeDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Exclude this line?"
      description="It won’t count as unmatched any more. You can reopen it later."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form="exclude-form">
            Exclude line
          </Button>
        </>
      }
    >
      {/* The form only mounts while the dialog is open, so it starts fresh every time. */}
      <ExcludeForm onConfirm={onConfirm} />
    </Dialog>
  )
}

function ExcludeForm({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState<Reason>('Bank charges')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = note.trim()
    if (reason === 'Other' && !trimmed) {
      setError('Add a short note so the next person knows why.')
      return
    }
    onConfirm(trimmed ? `${reason}: ${trimmed}` : reason)
  }

  return (
    <form id="exclude-form" className={styles.form} onSubmit={submit} noValidate>
      <fieldset className={styles.reasons}>
        <legend className={styles.legend}>Reason</legend>
        {REASONS.map((option) => (
          <label key={option} className={styles.option}>
            <input
              type="radio"
              name="reason"
              value={option}
              checked={reason === option}
              onChange={() => {
                setReason(option)
                setError('')
              }}
            />
            {option}
          </label>
        ))}
      </fieldset>

      <div className={styles.field}>
        <label htmlFor="exclude-note" className={styles.legend}>
          Note {reason === 'Other' ? '(required)' : '(optional)'}
        </label>
        <textarea
          id="exclude-note"
          rows={3}
          className={styles.textarea}
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setError('')
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'exclude-error' : undefined}
        />
        {error && (
          <p id="exclude-error" className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}
