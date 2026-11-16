import type { Direction } from '@/api/types'
import { cx } from '@/lib/cx'
import { formatMoney } from '@/lib/format'
import styles from './Amount.module.css'

interface AmountProps {
  value: number
  direction: Direction
  large?: boolean
}

// Sign + colour, never colour alone: "+" for money in, "−" for money out.
export function Amount({ value, direction, large }: AmountProps) {
  return (
    <span className={cx(styles.amount, styles[direction], large && styles.large)}>
      {direction === 'in' ? '+' : '−'}
      {formatMoney(value)}
    </span>
  )
}
