// Stands in for a real backend: an in-memory "database", some network delay, and
// switchable failures so the loading/error/rollback paths can be demoed.
//   ?fail=load  -> every read fails
//   ?fail=save  -> every write fails (optimistic updates roll back)
//
// Writes validate with the same pure functions the UI uses, then apply them. With a real
// backend these would be its own rules; the shape of the calls would stay the same.
import {
  applyExclude,
  applyMatch,
  applyReopen,
  findMatchProblem,
  type ActionMeta,
} from '@/lib/reconcile'
import {
  applyNewInvoice,
  applyReceipt,
  invoiceProblem,
  receiptProblem,
  type InvoiceInput,
  type ReceiptInput,
} from '@/lib/receivables'
import {
  applyBillDecision,
  applyBillPayment,
  applyNewBill,
  billProblem,
  decisionProblem,
  paymentProblem,
  type BillDecision,
  type BillInput,
  type BillPaymentInput,
} from '@/lib/payables'
import { withActivity } from '@/lib/workspace'
import { createSeed } from './seed'
import type { Exclusion, MatchPair, Reconciliation, Settings, Workspace } from './types'

const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 350

export const mockControls = { failLoad: false, failSave: false }

if (typeof window !== 'undefined') {
  const fail = new URLSearchParams(window.location.search).get('fail')
  mockControls.failLoad = fail === 'load'
  mockControls.failSave = fail === 'save'
}

let db = createSeed()

export function resetMockDb() {
  db = createSeed()
  mockControls.failLoad = false
  mockControls.failSave = false
}

function respond<T>(handler: () => T, shouldFail: boolean): Promise<T> {
  const delay = LATENCY_MS + Math.random() * LATENCY_MS
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error('The server didn’t respond. Please try again.'))
        return
      }
      try {
        // Clone on the way out so nothing in the UI can reach into the "database".
        resolve(structuredClone(handler()))
      } catch (error) {
        reject(error)
      }
    }, delay)
  })
}

const read = <T>(handler: () => T) => respond(handler, mockControls.failLoad)

// Runs a validated write. Returns whatever slice the caller asked for afterwards.
function write<T>(
  problem: (ws: Workspace) => string | null,
  change: (ws: Workspace, meta: ActionMeta) => Workspace,
  result: () => T,
) {
  return respond(() => {
    const message = problem(db)
    if (message) throw new Error(message)
    db = change(db, { by: 'You', at: new Date().toISOString() })
    return result()
  }, mockControls.failSave)
}

const ok = () => null

const recon = (): Reconciliation => ({
  account: db.account,
  period: db.period,
  bankLines: db.bankLines,
  ledger: db.ledger,
})

export const reconApi = {
  get: () => read(recon),

  match: (pairs: MatchPair[]) =>
    write(
      (ws) => pairs.map((pair) => findMatchProblem(ws, pair, ws.settings)).find(Boolean) ?? null,
      (ws, meta) =>
        withActivity(
          applyMatch(ws, pairs, meta),
          meta,
          'reconciliation',
          pairs.length === 1
            ? `Matched bank line ${pairs[0].lineId}`
            : `Matched ${pairs.length} bank lines`,
          pairs.length === 1
            ? `/reconciliation/lines/${pairs[0].lineId}`
            : '/reconciliation?status=matched',
        ),
      recon,
    ),

  reopen: (lineIds: string[]) =>
    write(
      ok,
      (ws, meta) =>
        withActivity(
          applyReopen(ws, lineIds, meta),
          meta,
          'reconciliation',
          `Reopened ${lineIds.join(', ')}`,
        ),
      recon,
    ),

  exclude: (exclusions: Exclusion[]) =>
    write(
      ok,
      (ws, meta) =>
        withActivity(
          applyExclude(ws, exclusions, meta),
          meta,
          'reconciliation',
          exclusions.length === 1
            ? `Excluded ${exclusions[0].lineId}: ${exclusions[0].reason}`
            : `Excluded ${exclusions.length} lines`,
        ),
      recon,
    ),
}

export const partiesApi = {
  list: () => read(() => db.parties),
}

export const invoicesApi = {
  list: () => read(() => db.invoices),
  create: (input: InvoiceInput) =>
    write(
      (ws) => invoiceProblem(ws, input),
      (ws, meta) => applyNewInvoice(ws, input, meta),
      () => db.invoices.at(-1)!,
    ),
  recordReceipt: (input: ReceiptInput) =>
    write(
      (ws) => receiptProblem(ws, input),
      (ws, meta) => applyReceipt(ws, input, meta),
      () => db.ledger.at(-1)!,
    ),
}

export const billsApi = {
  list: () => read(() => db.bills),
  create: (input: BillInput) =>
    write(
      (ws) => billProblem(ws, input),
      (ws, meta) => applyNewBill(ws, input, meta),
      () => db.bills.at(-1)!,
    ),
  decide: (decision: BillDecision) =>
    write(
      (ws) => decisionProblem(ws, decision),
      (ws, meta) => applyBillDecision(ws, decision, meta),
      ok,
    ),
  pay: (input: BillPaymentInput) =>
    write(
      (ws) => paymentProblem(ws, input),
      (ws, meta) => applyBillPayment(ws, input, meta),
      () => db.ledger.at(-1)!,
    ),
}

export const activityApi = {
  list: () => read(() => db.activity),
}

export const settingsApi = {
  get: () => read(() => db.settings),
  update: (settings: Settings) =>
    write(
      () => {
        if (settings.amountTolerance < 0 || settings.amountTolerance > 10)
          return 'Tolerance must be between 0 and 10%'
        if (settings.dateWindowDays < 1 || settings.dateWindowDays > 60)
          return 'Date window must be 1 to 60 days'
        if (settings.rules.some((r) => !r.contains.trim() || !r.reason.trim()))
          return 'Every rule needs text and a reason'
        return null
      },
      (ws, meta) =>
        withActivity(
          { ...ws, settings },
          meta,
          'settings',
          'Updated matching settings',
          '/settings',
        ),
      () => db.settings,
    ),
}
