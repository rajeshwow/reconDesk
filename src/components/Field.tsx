import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Field.module.css'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
  error?: string
}

export function TextField({ label, value, onChange, hint, error, ...input }: TextFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

interface SearchInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ label, value, onChange, placeholder }: SearchInputProps) {
  const id = useId()
  return (
    <div className={styles.search}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" size={16} />
      <input
        id={id}
        type="search"
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

// A form-level error, e.g. what the server said when a save was refused.
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p className={styles.formError} role="alert">
      {children}
    </p>
  )
}

export const fieldStyles = styles
