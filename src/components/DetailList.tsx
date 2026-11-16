import type { ReactNode } from 'react'
import styles from './DetailList.module.css'

// Label/value pairs, e.g. a party's GSTIN, credit terms and contact details.
export function DetailList({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className={styles.list}>
      {items.map(([label, value]) => (
        <div key={label} className={styles.item}>
          <dt className={styles.label}>{label}</dt>
          <dd className={styles.value}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
