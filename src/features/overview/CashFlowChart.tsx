import type { WeekFlow } from '@/lib/cashflow'
import { formatCompact, formatDate, formatMoney } from '@/lib/format'
import styles from './CashFlowChart.module.css'

// Plain CSS bars. The table underneath is what screen readers get; the bars are hidden
// from them because "a green bar taller than a red bar" isn't information on its own.
export function CashFlowChart({ weeks }: { weeks: WeekFlow[] }) {
  const largest = Math.max(1, ...weeks.flatMap((w) => [w.moneyIn, w.moneyOut]))
  const height = (value: number) => `${Math.max(2, (value / largest) * 100)}%`

  return (
    <figure className={styles.figure}>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.keyIn}>Money in</span>
        <span className={styles.keyOut}>Money out</span>
      </div>

      <div className={styles.chart} aria-hidden="true">
        {weeks.map((week) => (
          <div key={week.start} className={styles.week}>
            <div className={styles.bars}>
              <span
                className={styles.in}
                style={{ height: height(week.moneyIn) }}
                title={formatMoney(week.moneyIn)}
              />
              <span
                className={styles.out}
                style={{ height: height(week.moneyOut) }}
                title={formatMoney(week.moneyOut)}
              />
            </div>
            <span className={styles.label}>{formatDate(week.start)}</span>
            <span className={styles.net}>{formatCompact(week.moneyIn - week.moneyOut)}</span>
          </div>
        ))}
      </div>

      <table className="sr-only">
        <caption>Money in and out of the bank account per week</caption>
        <thead>
          <tr>
            <th scope="col">Week starting</th>
            <th scope="col">Money in</th>
            <th scope="col">Money out</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.start}>
              <th scope="row">{formatDate(week.start, true)}</th>
              <td>{formatMoney(week.moneyIn)}</td>
              <td>{formatMoney(week.moneyOut)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
