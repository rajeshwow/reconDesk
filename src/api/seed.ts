import { addDays, daysBetween, todayISO } from '@/lib/dates'
import { formatMoney, subtractMoney } from '@/lib/format'
import { DEFAULT_MATCH_SETTINGS } from '@/lib/matching'
import { balanceDue } from '@/lib/receivables'
import { createRandom } from '@/lib/random'
import type {
  ActivityEvent,
  BankLine,
  Bill,
  Direction,
  Invoice,
  LedgerEntry,
  Module,
  Party,
  PartyKind,
  Workspace,
} from './types'

const CUSTOMERS = [
  ['Shree Balaji Traders', 'Pune'],
  ['Kaveri Electricals', 'Bengaluru'],
  ['Mehta Steel Works', 'Ahmedabad'],
  ['Annapurna Caterers', 'Nagpur'],
  ['Deccan Tyres & Tubes', 'Hyderabad'],
  ['Blue Lotus Interiors', 'Mumbai'],
  ['Krishna Cold Storage', 'Nashik'],
  ['Sahyadri Agro Products', 'Kolhapur'],
  ['Sterling Print House', 'Chennai'],
  ['Greenfield Packaging', 'Indore'],
] as const

const VENDORS = [
  ['Ganga Paper Mills', 'Kanpur', 'Raw material'],
  ['Rathi Plastics', 'Jaipur', 'Raw material'],
  ['Narmada Cement Agency', 'Vadodara', 'Raw material'],
  ['Coastal Freight Carriers', 'Mumbai', 'Freight'],
  ['Om Sai Logistics', 'Pune', 'Freight'],
  ['Prakash Properties', 'Pune', 'Rent'],
  ['Techwave Software Solutions', 'Bengaluru', 'Software'],
  ['Joshi & Associates', 'Pune', 'Professional fees'],
  ['Pioneer Office Supplies', 'Pune', 'Office supplies'],
] as const

const STATE_CODES: Record<string, string> = {
  Pune: '27',
  Mumbai: '27',
  Nagpur: '27',
  Nashik: '27',
  Kolhapur: '27',
  Bengaluru: '29',
  Ahmedabad: '24',
  Vadodara: '24',
  Hyderabad: '36',
  Chennai: '33',
  Indore: '23',
  Kanpur: '09',
  Jaipur: '08',
}

const BANK_CODES = ['HDFCR', 'SBIN', 'ICIC', 'UTIB', 'KKBK']
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

// People who "did" things in the seeded history. The person using the app is "You".
const AR_CLERK = 'Vikram Shah'
const AP_CLERK = 'Neha Kulkarni'
const APPROVER = 'Anita Rao'

// A small company's last ~4 months: invoices to customers, bills from vendors, and the
// last 45 days of the bank statement. Most things line up; the rest are the cases that
// eat time at month end: TDS short payments, one NEFT covering two invoices, bank
// charges nobody posted, cheques not yet cleared, and money in the bank nobody booked.
export function createSeed(today = todayISO()): Workspace {
  const random = createRandom(4821)
  const from = addDays(today, -44)

  const parties: Party[] = []
  const invoices: Invoice[] = []
  const bills: Bill[] = []
  const bankLines: BankLine[] = []
  const ledger: LedgerEntry[] = []
  const activity: ActivityEvent[] = []
  const seq = {
    bank: 1000,
    ledger: 2000,
    receipt: 140,
    payment: 380,
    invoice: 1000,
    bill: 300,
    activity: 0,
  }

  // ── small generators ──

  const letters = (n: number) => Array.from({ length: n }, () => random.pick([...LETTERS])).join('')
  const amount = (min: number, max: number) =>
    random.int(min, max) * 100 + (random.chance(0.3) ? random.int(1, 99) / 100 : 0)
  const utr = () => `${random.pick(BANK_CODES)}5${random.int(10_000_000, 99_999_999)}`
  const time = () =>
    `${String(random.int(9, 18)).padStart(2, '0')}:${String(random.int(0, 59)).padStart(2, '0')}`
  const at = (date: string) => `${date}T${time()}:00`
  const slug = (name: string) =>
    name
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z]+/g, '')
  const initials = (name: string) =>
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .replace(/[^A-Z]/g, '')

  function log(date: string, by: string, module: Module, text: string, link?: string) {
    activity.push({ id: `A-${++seq.activity}`, at: at(date), by, module, text, link })
  }

  function addParty(name: string, city: string, kind: PartyKind): Party {
    const party: Party = {
      id: `${kind === 'customer' ? 'C' : 'V'}-${String(parties.length + 1).padStart(2, '0')}`,
      name,
      kind,
      city,
      gstin: `${STATE_CODES[city]}${letters(5)}${random.int(1000, 9999)}${letters(1)}1Z${letters(1)}`,
      email: `accounts@${slug(name)}.in`,
      phone: `+91 98${random.int(10_000_000, 99_999_999)}`,
      creditDays: random.pick(kind === 'customer' ? [30, 30, 45, 60] : [15, 30, 30, 45]),
    }
    parties.push(party)
    return party
  }

  function addEntry(
    party: Party,
    direction: Direction,
    value: number,
    date: string,
    ref: string,
    narration: string,
  ) {
    const entry: LedgerEntry = {
      id: `L-${++seq.ledger}`,
      voucherNo: direction === 'in' ? `RCT/${++seq.receipt}` : `PMT/${++seq.payment}`,
      date,
      partyId: party.id,
      party: party.name,
      narration,
      ref,
      amount: value,
      direction,
      bankLineId: null,
    }
    ledger.push(entry)
    return entry
  }

  function addLine(
    narration: string,
    ref: string,
    value: number,
    direction: Direction,
    date: string,
  ) {
    const line: BankLine = {
      id: `B-${++seq.bank}`,
      date,
      narration,
      ref,
      amount: Math.round(value * 100) / 100,
      direction,
      status: 'open',
      ledgerIds: [],
      history: [{ at: `${date}T07:30:00`, by: 'Statement import', action: 'imported' }],
    }
    bankLines.push(line)
    return line
  }

  function markMatched(line: BankLine, entries: LedgerEntry[]) {
    line.status = 'matched'
    line.ledgerIds = entries.map((e) => e.id)
    entries.forEach((e) => (e.bankLineId = line.id))
    line.history.push({
      at: `${addDays(line.date, 1)}T11:20:00`,
      by: 'Auto-match',
      action: 'matched',
      note: entries.map((e) => e.voucherNo).join(', '),
    })
  }

  function bankNarration(name: string, direction: Direction, ref: string) {
    const short = name.toUpperCase().slice(0, 18)
    return direction === 'in' ? `NEFT CR-${ref}-${short}` : `IMPS/P2A/${ref}/${short}`
  }

  // What the bank did with a voucher we posted: not through yet, short by TDS, or clean.
  function reflectInBank(entry: LedgerEntry, ref: string) {
    const roll = random.next()
    if (roll < 0.12) return

    const date = addDays(entry.date, random.int(0, 3))
    if (date > today) return

    const shortPaid = entry.direction === 'in' && roll < 0.22
    const narration = random.chance(0.2)
      ? `CLG/CHQ ${ref.slice(-6)}`
      : bankNarration(entry.party, entry.direction, ref)
    const line = addLine(
      narration,
      ref,
      shortPaid ? entry.amount * 0.99 : entry.amount,
      entry.direction,
      date,
    )

    if (!shortPaid && daysBetween(date, today) > 6 && random.chance(0.75))
      markMatched(line, [entry])
  }

  // ── receivables ──

  function addInvoice(party: Party, date: string, value: number) {
    const invoice: Invoice = {
      id: `INV-${++seq.invoice}`,
      partyId: party.id,
      date,
      dueDate: addDays(date, party.creditDays),
      amount: value,
      allocations: [],
      history: [{ at: at(date), by: AR_CLERK, action: 'created' }],
    }
    invoices.push(invoice)
    if (daysBetween(date, today) <= 21) {
      log(
        date,
        AR_CLERK,
        'receivables',
        `Raised ${invoice.id} on ${party.name} for ${formatMoney(value)}`,
        `/receivables/${invoice.id}`,
      )
    }
    return invoice
  }

  function postReceipt(party: Party, paid: Invoice[], value: number, date: string) {
    const ref = utr()
    const narration = `Receipt against ${paid.map((i) => i.id).join(', ')}`
    const entry = addEntry(party, 'in', value, date, random.chance(0.65) ? ref : '', narration)

    let left = value
    for (const invoice of paid) {
      const share = Math.min(left, balanceDue(invoice))
      left = subtractMoney(left, share)
      invoice.allocations.push({ entryId: entry.id, amount: share })
      invoice.history.push({
        at: at(date),
        by: AR_CLERK,
        action: 'paid',
        note: `${entry.voucherNo}, ${formatMoney(share)}`,
      })
    }
    log(
      date,
      AR_CLERK,
      'receivables',
      `Recorded ${formatMoney(value)} from ${party.name} as ${entry.voucherNo}`,
      `/parties/${party.id}`,
    )
    return { entry, ref }
  }

  const customers = CUSTOMERS.map(([name, city]) => addParty(name, city, 'customer'))
  const vendors = VENDORS.map(([name, city, category]) => ({
    party: addParty(name, city, 'vendor'),
    category,
  }))

  const drafts = customers
    .flatMap((party) =>
      Array.from({ length: random.int(6, 10) }, () => ({
        party,
        date: addDays(today, -random.int(2, 115)),
        value: amount(150, 6000),
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  for (const { party, date, value } of drafts) {
    const slowPayer = random.chance(0.15)
    const payDate = addDays(date, random.int(10, party.creditDays + 25))
    if (!slowPayer && payDate < from) continue // settled in an earlier month, not interesting here

    const invoice = addInvoice(party, date, value)
    if (slowPayer || payDate > today) continue

    const partly = random.chance(0.12)
    const { entry, ref } = postReceipt(
      party,
      [invoice],
      partly ? Math.round(value / 2) : value,
      payDate,
    )
    reflectInBank(entry, ref)
  }

  // One NEFT covering two invoices. The books have two receipts, the bank has one line.
  for (let i = 0; i < 5; i++) {
    const party = random.pick(customers)
    const date = addDays(today, -random.int(30, 55))
    const pair = [
      addInvoice(party, date, amount(150, 3000)),
      addInvoice(party, addDays(date, 2), amount(150, 3000)),
    ]
    const settled = addDays(date, random.int(5, 12))
    const payDate = settled < from ? addDays(from, 1) : settled
    const receipts = pair.map(
      (invoice) => postReceipt(party, [invoice], invoice.amount, payDate).entry,
    )
    const ref = utr()
    addLine(
      bankNarration(party.name, 'in', ref),
      ref,
      receipts[0].amount + receipts[1].amount,
      'in',
      addDays(payDate, 1),
    )
  }

  // Customers who paid, but nobody has booked the receipt yet. Only the bank knows.
  const unpaid = invoices.filter(
    (i) => i.allocations.length === 0 && daysBetween(i.date, today) > 12,
  )
  for (const invoice of unpaid.slice(0, 4)) {
    const party = parties.find((p) => p.id === invoice.partyId)!
    const ref = utr()
    addLine(
      bankNarration(party.name, 'in', ref),
      ref,
      invoice.amount,
      'in',
      addDays(today, -random.int(1, 8)),
    )
  }

  // ── payables ──

  for (const { party, category } of vendors) {
    for (let i = random.int(3, 7); i > 0; i--) {
      const date = addDays(today, -random.int(1, 95))
      const payDate = addDays(date, random.int(7, party.creditDays + 5))
      if (payDate < from) continue

      const value = category === 'Rent' ? 85_000 : amount(60, 3800)
      const bill: Bill = {
        id: `BL-${++seq.bill}`,
        number: `${initials(party.name)}/${random.int(100, 2999)}`,
        partyId: party.id,
        date,
        dueDate: addDays(date, party.creditDays),
        amount: value,
        category,
        status: 'awaiting_approval',
        paymentEntryId: null,
        history: [{ at: at(date), by: AP_CLERK, action: 'created' }],
      }
      bills.push(bill)
      const link = `/payables/${bill.id}`
      if (daysBetween(date, today) <= 21) {
        log(
          date,
          AP_CLERK,
          'payables',
          `Entered bill ${bill.number} from ${party.name} for ${formatMoney(value)}`,
          link,
        )
      }

      if (daysBetween(date, today) < 10 && random.chance(0.8)) continue

      const reviewed = addDays(date, random.int(1, 3))
      const decidedOn = reviewed > today ? today : reviewed
      if (random.chance(0.07)) {
        bill.status = 'rejected'
        bill.rejectReason = 'Rate doesn’t match the purchase order'
        bill.history.push({
          at: at(decidedOn),
          by: APPROVER,
          action: 'rejected',
          note: bill.rejectReason,
        })
        continue
      }

      bill.status = 'approved'
      bill.history.push({ at: at(decidedOn), by: APPROVER, action: 'approved' })
      log(decidedOn, APPROVER, 'payables', `Approved bill ${bill.number} from ${party.name}`, link)

      // Some approved bills get held back when cash is tight, and go overdue.
      if (payDate > today || random.chance(0.18)) continue
      const ref = utr()
      const entry = addEntry(
        party,
        'out',
        value,
        payDate,
        random.chance(0.65) ? ref : '',
        `Payment against bill ${bill.number}`,
      )
      bill.status = 'paid'
      bill.paymentEntryId = entry.id
      bill.history.push({
        at: at(payDate),
        by: AP_CLERK,
        action: 'paid',
        note: `${entry.voucherNo}, ${formatMoney(value)}`,
      })
      log(
        payDate,
        AP_CLERK,
        'payables',
        `Paid ${formatMoney(value)} to ${party.name} as ${entry.voucherNo}`,
        link,
      )
      reflectInBank(entry, ref)
    }
  }

  // Vendor payments made from net banking that never got a voucher.
  for (const bill of bills.filter((b) => b.status === 'approved').slice(0, 2)) {
    const party = parties.find((p) => p.id === bill.partyId)!
    const ref = utr()
    addLine(
      bankNarration(party.name, 'out', ref),
      ref,
      bill.amount,
      'out',
      addDays(today, -random.int(1, 6)),
    )
  }

  // ── lines only the bank knows about ──

  for (let i = 0; i < 5; i++) {
    addLine(
      `CHRGS NEFT/RTGS ${random.int(1000, 9999)}`,
      '',
      random.pick([17.7, 29.5, 59, 118]),
      'out',
      addDays(from, random.int(0, 44)),
    )
  }
  addLine(
    'NACH DR/LIC OF INDIA/PREMIUM',
    `NACH${random.int(100000, 999999)}`,
    18_450,
    'out',
    addDays(from, random.int(0, 44)),
  )
  addLine('CASH DEP BR 0421 SELF', '', 50_000, 'in', addDays(from, random.int(0, 44)))
  addLine(
    'UPI/CR/BHIM/9821XXXX12',
    `UPI${random.int(100000000, 999999999)}`,
    2_360,
    'in',
    addDays(from, random.int(0, 44)),
  )
  addLine('GST ON CHARGES', '', 21.24, 'out', addDays(from, random.int(0, 44)))

  log(
    today,
    'Statement import',
    'reconciliation',
    `Imported HDFC statement up to today`,
    '/reconciliation',
  )

  const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)

  return {
    account: {
      bank: 'HDFC Bank',
      name: 'Current Account',
      number: 'XXXX4821',
      openingBalance: 1_845_320.5,
    },
    period: { from, to: today },
    parties,
    invoices: invoices.sort(byDate),
    bills: bills.sort(byDate),
    bankLines: bankLines.sort(byDate),
    ledger: ledger.sort(byDate),
    activity: activity.sort((a, b) => b.at.localeCompare(a.at)),
    settings: {
      ...DEFAULT_MATCH_SETTINGS,
      rules: [
        { id: 'R-1', contains: 'CHRGS', reason: 'Bank charges', enabled: true },
        { id: 'R-2', contains: 'GST ON CHARGES', reason: 'Bank charges', enabled: true },
        {
          id: 'R-3',
          contains: 'NACH DR/LIC',
          reason: 'Insurance premium, posted at month end',
          enabled: false,
        },
      ],
    },
  }
}
