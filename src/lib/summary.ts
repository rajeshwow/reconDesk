import type { Reconciliation } from '@/api/types'
import { sumAmounts } from './format'

export interface ReconSummary {
  totalLines: number
  doneLines: number
  progress: number
  openLines: number
  openLinesAmount: number
  openEntries: number
  openEntriesAmount: number
}

export function summarize(data: Reconciliation): ReconSummary {
  const openLines = data.bankLines.filter((line) => line.status === 'open')
  const openEntries = data.ledger.filter((entry) => entry.bankLineId === null)
  const total = data.bankLines.length
  const done = total - openLines.length

  return {
    totalLines: total,
    doneLines: done,
    progress: total === 0 ? 100 : Math.floor((done / total) * 100),
    openLines: openLines.length,
    openLinesAmount: sumAmounts(openLines),
    openEntries: openEntries.length,
    openEntriesAmount: sumAmounts(openEntries),
  }
}
