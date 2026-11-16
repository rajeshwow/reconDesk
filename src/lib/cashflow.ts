import type { BankLine } from '@/api/types'
import { addDays } from './dates'
import { toPaise } from './format'

export interface WeekFlow {
  start: string
  moneyIn: number
  moneyOut: number
}

// Money in and out of the bank account per week, oldest week first, ending this week.
export function weeklyCashFlow(lines: BankLine[], today: string, weeks = 6): WeekFlow[] {
  const firstStart = addDays(today, -(weeks * 7 - 1))

  return Array.from({ length: weeks }, (_, index) => {
    const start = addDays(firstStart, index * 7)
    const end = addDays(start, 6)
    const inWeek = lines.filter((l) => l.date >= start && l.date <= end)
    const total = (direction: BankLine['direction']) =>
      inWeek
        .filter((l) => l.direction === direction)
        .reduce((sum, l) => sum + toPaise(l.amount), 0) / 100

    return { start, moneyIn: total('in'), moneyOut: total('out') }
  })
}
