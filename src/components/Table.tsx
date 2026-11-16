import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'
import styles from './Table.module.css'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  align?: 'right'
  /** Drop the column on narrow screens. The first column should never be hidden. */
  hideOnMobile?: boolean
}

interface TableProps<T> {
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  footer?: ReactNode
  rowClassName?: (row: T) => string | undefined
}

// A plain semantic table. Rows aren't clickable: the first cell holds a real link,
// which works with the keyboard, middle-click and screen readers.
export function Table<T>({ caption, columns, rows, rowKey, footer, rowClassName }: TableProps<T>) {
  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  column.align === 'right' && styles.right,
                  column.hideOnMobile && styles.optional,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClassName?.(row)}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    column.align === 'right' && styles.right,
                    column.hideOnMobile && styles.optional,
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  )
}

export const tableStyles = styles
