import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'
import styles from './Button.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

// Exported so links (e.g. "Details") can look like buttons without becoming buttons.
export const buttonClass = (variant: Variant = 'secondary', size: Size = 'md') =>
  cx(styles.button, styles[variant], styles[size])

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx(buttonClass(variant, size), className)} {...rest} />
  )
})
