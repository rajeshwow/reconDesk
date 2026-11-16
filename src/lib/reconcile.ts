// Pure state transitions. The mock server uses these to save, and the UI uses the
// exact same functions for optimistic updates, so both sides can't drift apart.
import type {
  AuditEvent,
  BankLine,
  Exclusion,
  LedgerEntry,
  MatchPair,
  Reconciliation,
} from '@/api/types'
import { formatMoney, sumAmounts, toPaise } from './format'
import { DEFAULT_MATCH_SETTINGS, withinTolerance } from './matching'

export interface ActionMeta {
  by: string
  at: string
}

export function matchDifference(line: BankLine, entries: LedgerEntry[]): number {
  return (toPaise(line.amount) - toPaise(sumAmounts(entries))) / 100
}

export function matchError(
  line: BankLine,
  entries: LedgerEntry[],
  settings = DEFAULT_MATCH_SETTINGS,
): string | null {
  if (line.status !== 'open') return 'This bank line is already reconciled'
  if (entries.length === 0) return 'Select at least one book entry'
  if (entries.some((e) => e.bankLineId !== null)) return 'A selected book entry is already matched'
  if (entries.some((e) => e.direction !== line.direction)) {
    return 'Money in and money out can’t be matched together'
  }

  const gap = Math.abs(matchDifference(line, entries))
  const smallGapAllowed = entries.length === 1 && withinTolerance(gap, line.amount, settings)
  if (gap > 0 && !smallGapAllowed) return `Amounts don’t balance (off by ${formatMoney(gap)})`

  return null
}

export function findMatchProblem(
  data: Reconciliation,
  pair: MatchPair,
  settings = DEFAULT_MATCH_SETTINGS,
): string | null {
  const line = data.bankLines.find((l) => l.id === pair.lineId)
  if (!line) return 'Bank line not found'
  const entries = data.ledger.filter((e) => pair.ledgerIds.includes(e.id))
  if (entries.length !== pair.ledgerIds.length) return 'Book entry not found'
  return matchError(line, entries, settings)
}

// Generic so the server can pass the whole workspace through and get it back intact.
export function applyMatch<T extends Reconciliation>(
  data: T,
  pairs: MatchPair[],
  meta: ActionMeta,
): T {
  const ledgerByLine = new Map(pairs.map((p) => [p.lineId, p.ledgerIds]))
  const lineByEntry = new Map(pairs.flatMap((p) => p.ledgerIds.map((id) => [id, p.lineId])))

  const bankLines = data.bankLines.map((line) => {
    const ledgerIds = ledgerByLine.get(line.id)
    if (!ledgerIds) return line
    const vouchers = data.ledger
      .filter((e) => ledgerIds.includes(e.id))
      .map((e) => e.voucherNo)
      .join(', ')
    return withEvent({ ...line, status: 'matched' as const, ledgerIds }, meta, 'matched', vouchers)
  })

  const ledger = data.ledger.map((entry) => {
    const bankLineId = lineByEntry.get(entry.id)
    return bankLineId ? { ...entry, bankLineId } : entry
  })

  return { ...data, bankLines, ledger }
}

export function applyReopen<T extends Reconciliation>(
  data: T,
  lineIds: string[],
  meta: ActionMeta,
): T {
  const ids = new Set(lineIds)

  const bankLines = data.bankLines.map((line) => {
    if (!ids.has(line.id) || line.status === 'open') return line
    const action = line.status === 'matched' ? 'unmatched' : 'reopened'
    const reopened = { ...line, status: 'open' as const, ledgerIds: [], excludeReason: undefined }
    return withEvent(reopened, meta, action)
  })

  const ledger = data.ledger.map((entry) =>
    entry.bankLineId && ids.has(entry.bankLineId) ? { ...entry, bankLineId: null } : entry,
  )

  return { ...data, bankLines, ledger }
}

export function applyExclude<T extends Reconciliation>(
  data: T,
  exclusions: Exclusion[],
  meta: ActionMeta,
): T {
  const reasons = new Map(exclusions.map((e) => [e.lineId, e.reason]))

  const bankLines = data.bankLines.map((line) => {
    const reason = reasons.get(line.id)
    if (!reason || line.status !== 'open') return line
    return withEvent(
      { ...line, status: 'excluded' as const, excludeReason: reason },
      meta,
      'excluded',
      reason,
    )
  })

  return { ...data, bankLines }
}

export function withEvent<T extends { history: AuditEvent[] }>(
  item: T,
  meta: ActionMeta,
  action: AuditEvent['action'],
  note?: string,
): T {
  return { ...item, history: [...item.history, { ...meta, action, note }] }
}
