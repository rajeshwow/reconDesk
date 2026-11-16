import type { Direction, Reconciliation } from '@/api/types'
import { toPaise } from './format'

// Bank Reconciliation Statement: starts from the balance in our books and walks to the
// balance the bank shows, one category of difference at a time.

interface Signed {
  amount: number
  direction: Direction
}

const signedPaise = (items: Signed[]) =>
  items.reduce((total, i) => total + (i.direction === 'in' ? 1 : -1) * toPaise(i.amount), 0)

const paise = (items: { amount: number }[]) =>
  items.reduce((total, i) => total + toPaise(i.amount), 0)

export interface BrsAdjustment {
  key: string
  label: string
  /** Signed: positive is added to the book balance, negative is subtracted. */
  amount: number
  count: number
}

export interface Brs {
  bookBalance: number
  bankBalance: number
  adjustments: BrsAdjustment[]
  adjustedBalance: number
  difference: number
}

export function buildBrs({ account, bankLines, ledger }: Reconciliation): Brs {
  const opening = toPaise(account.openingBalance)
  const book = opening + signedPaise(ledger)
  const bank = opening + signedPaise(bankLines)

  const unmatchedEntries = ledger.filter((e) => e.bankLineId === null)
  const notInBooks = bankLines.filter((l) => l.status !== 'matched')
  const matchedLines = bankLines.filter((l) => l.status === 'matched')
  const matchedEntries = ledger.filter((e) => e.bankLineId !== null)

  const notPresented = unmatchedEntries.filter((e) => e.direction === 'out')
  const notCredited = unmatchedEntries.filter((e) => e.direction === 'in')
  const creditsNotInBooks = notInBooks.filter((l) => l.direction === 'in')
  const debitsNotInBooks = notInBooks.filter((l) => l.direction === 'out')

  const bookedPerLine = new Map<string, number>()
  for (const entry of matchedEntries) {
    const lineId = entry.bankLineId!
    bookedPerLine.set(lineId, (bookedPerLine.get(lineId) ?? 0) + toPaise(entry.amount))
  }
  const differing = matchedLines.filter((l) => toPaise(l.amount) !== bookedPerLine.get(l.id))

  const rows = [
    {
      key: 'not-presented',
      label: 'Add: payments issued but not yet presented',
      paise: paise(notPresented),
      count: notPresented.length,
    },
    {
      key: 'not-credited',
      label: 'Less: receipts recorded but not yet credited',
      paise: -paise(notCredited),
      count: notCredited.length,
    },
    {
      key: 'credits',
      label: 'Add: credits in bank not recorded in books',
      paise: paise(creditsNotInBooks),
      count: creditsNotInBooks.length,
    },
    {
      key: 'debits',
      label: 'Less: debits in bank not recorded in books',
      paise: -paise(debitsNotInBooks),
      count: debitsNotInBooks.length,
    },
    {
      key: 'short',
      label: 'Add/less: amount differences on matched items (TDS, charges)',
      paise: signedPaise(matchedLines) - signedPaise(matchedEntries),
      count: differing.length,
    },
  ]

  const adjusted = book + rows.reduce((total, r) => total + r.paise, 0)

  return {
    bookBalance: book / 100,
    bankBalance: bank / 100,
    adjustments: rows.map(({ paise: p, ...rest }) => ({ ...rest, amount: p / 100 })),
    adjustedBalance: adjusted / 100,
    difference: (bank - adjusted) / 100,
  }
}
