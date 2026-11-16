# ReconDesk

Month-end finance operations for a small company: receivables, payables, bank reconciliation
and the reports that come out of them, in one place, with every module feeding the others.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # watch mode  (npm run test:run for a single pass)
npm run build      # type-check + production build
```

Node 18+ is enough. There's no backend. An in-memory mock API with realistic delay stands in for one,
seeded with about four months of believable data for a fictional company.

**Demo switches** (add to any URL):

| URL           | What happens                                                                 |
| ------------- | ---------------------------------------------------------------------------- |
| `?fail=load`  | Every read fails → error state with retry                                    |
| `?fail=save`  | Every write fails → optimistic updates roll back, forms show the server error |

Settings → **Reset demo data** puts everything back to the seeded month.

---

## How this meets the brief

| The brief asks for | Where to look |
| --- | --- |
| **React architecture** | Feature folders per module (`src/features/*`), app shell in `src/app`, business logic in `src/lib` with no React in it. See [Architecture](#architecture) |
| **Component design** | Pages split into a loader (`ReceivablesPage`) and a body that only gets loaded data (`Receivables`). Dialogs keep their form inside so it resets on every open (`RecordReceiptDialog`). Memoised list rows (`BankLineRow`) |
| **State management** | Server data in React Query (`api/queries.ts`), list filters in the URL (`hooks/useUrlState.ts`), theme in context (`app/theme.tsx`), form fields in `useState`. Table under [Key decisions](#key-decisions) |
| **Data flow** | URL → `useUrlState` → `lib/` functions → page. Optimistic writes with rollback for reconciliation (`useOptimisticMutation`), server-confirmed writes plus invalidation for the rest (`useServerMutation`). Diagram under [Architecture](#architecture) |
| **Reusable components** | `components/`: `Table<T>`, `Loader`, `Segmented`, `Panel`, `StatCard`, `Dialog`, `Field`, `Toolbar`, `Toast`, `AuditTrail`. Every list page is built from the same parts |
| **UI/UX** | Undo on every reconciliation action, "needs your attention" list linking to the exact fix, dialogs that pre-fill from the bank line, Ctrl K palette, live counts in the sidebar |
| **Responsive design** | Sidebar becomes a slide-in menu under 960px, tables drop secondary columns under 720px, two-column layouts stack. Checked at 390px |
| **Error handling** | `Loader` gives every page an error state with retry; a per-module `ErrorBoundary` catches render crashes; failed optimistic saves roll back with a toast; server validation errors show inside the form; double submits are ignored. Try `?fail=load` and `?fail=save` |
| **Accessibility** | See [Accessibility](#accessibility). Radix dialogs, a real combobox for search, labels on every field, no colour-only status, `jest-axe` in the test suite |
| **Code organization** | One job per file, consistent naming (`*Page`, `*Dialog`, `use*`), domain functions grouped by module in `lib/` |
| **Maintainability** | Strict TypeScript, pure and tested domain logic, the same validation (`receiptProblem`, `paymentProblem`…) used by client and server |
| **Performance** | Each module is a lazy-loaded chunk (`app/routes.tsx`); filtering and suggestions are memoised; list rows are memoised so selecting a line doesn't re-render the statement; React Query caches and dedupes requests. Limits are under [tradeoffs](#assumptions-and-tradeoffs) |
| **Testing** | 67 tests: pure logic unit tests in `lib/*.test.ts`, integration tests through the real app in `features/**/*.test.tsx`, `jest-axe` on two pages. See [Testing](#testing) |

## The problem

At month end, someone in accounts has to answer three questions before the books can close:

1. **Who owes us, and who's late?** (receivables)
2. **What do we owe, and is it approved?** (payables)
3. **Does the bank agree with our books?** (bank reconciliation)

In most small companies these live in three different places: the accounting system, a spreadsheet of
bills waiting for a signature, and a printed bank statement with ticks on it. The awkward part is that
they're the *same money*. A customer pays, the bank shows it, but nobody books the receipt, so the
invoice still looks overdue and the bank line looks unexplained. Fixing that means jumping between
all three.

I've worked on Tally integration and outstanding reconciliation in a CRM, so this is a pain I've seen up
close. ReconDesk puts the three side by side and lets you fix a problem from wherever you find it.

## The user

An accounts executive or finance-ops analyst at a company with a few dozen customers and vendors. They
know accounting well, work on a laptop most of the day and sometimes check things from a phone, and
they're measured on **closing on time with a zero difference**.

## What it does

| Module | What you can do |
| --- | --- |
| **Overview** | Bank vs book balance, what customers owe, what we owe, reconciliation progress. A "needs your attention" list where each item links to the exact filtered view that fixes it. Cash flow for the last six weeks, slowest payers, recent activity. |
| **Bank reconciliation** | Two-pane workbench (statement / books). Scored match suggestions with reasons, accept one or bulk-accept high-confidence ones, manual split matching (only when amounts balance), exclude with a reason, run exclusion rules. Every action is optimistic and has **Undo**. Drawer per line with history. |
| **Receivables** | Invoices by status (unpaid, overdue, part paid…), search and sort, raise an invoice, record a receipt that's applied oldest-invoice-first. Invoice page shows each receipt and **whether it has cleared in the bank**. |
| **Payables** | Vendor bills with an approval step, bulk approve, reject with a reason, record payment. Catches the same vendor bill being entered twice. |
| **Customers & vendors** | Balances and overdue per party, a running **statement of account** (exportable), how many days a customer usually takes to pay, and bank lines with their name that nobody has booked. |
| **Reports** | **Bank reconciliation statement** that walks from the book balance to the bank balance and checks it ties out; receivables and payables **aging** by party. CSV export and print. |
| **Activity log** | Every change, who made it and when, grouped by day and filterable by module. |
| **Settings** | Matching tolerance and date window (the matcher uses them straight away), exclusion rules with a live count of what each would hit, light/dark theme. |

Plus a **Ctrl K** command palette that searches parties, invoices, bills and bank lines, a sidebar
with live counts, and loading / empty / error states on every page.

### How the modules connect

The flow I'd show first in a demo:

1. **Overview** lists "Money received that nobody has booked".
2. Click it and you land on the **reconciliation** workbench, filtered to those lines.
3. Open one. There's no likely match in the books. Press **Record customer receipt**.
4. The dialog has already guessed the customer from the bank narration and ticked the invoice with
   exactly that balance. Save.
5. That one action creates the next receipt voucher (say `RCT/165`), settles the invoice in **Receivables**, matches the
   bank line, updates the customer's **statement of account**, moves the **BRS** and the sidebar
   counts, and writes an **Activity** entry.

The same works the other way for vendor payments made from net banking without a voucher.

## Architecture

```
src/
  app/          shell: providers, routes, layout, sidebar, command palette, theme
  api/          types, seed data, mock API, React Query hooks
  lib/          pure domain logic, no React: matching, reconcile, receivables, payables,
                brs, aging, statement, rules, attention, search, filters
  hooks/        useUrlState (list filters in the URL)
  components/   generic UI: Button, Dialog, Table, Panel, Segmented, StatCard, Field, Toast…
  features/
    overview/        the dashboard
    reconciliation/  workbench, line drawer, ReconActionsProvider
    receivables/     list, invoice page, receipt + invoice dialogs
    payables/        list, bill page, approve/reject/pay
    parties/         list, party page with statement of account
    reports/         BRS and aging
    activity/        log + the feed component the overview reuses
    settings/
  test/         setup, factories, renderApp
```

The rule I tried to stick to: **business logic lives in `lib/` as plain functions, React only renders
and wires things up.** `lib/` doesn't import React, which is why most of the tests are fast unit tests,
and why a feature folder is mostly layout.

**How data flows:**

```
URL ?status=&q=&sort=  ─► useUrlState ─┐
                                       ├─► lib/ (filter, sort, summarise) ─► page
React Query (one query per resource) ──┘

reconciliation write ─► optimistic: apply the lib reducer to the cache now
                        ─► server applies the same reducer ─► replace cache, or roll back

everything else      ─► wait for the server ─► invalidate every query the write touched
                        (e.g. a receipt: invoices + reconciliation + activity)
```

## Key decisions

**One set of reducers, used by the client and the "server".** `applyMatch`, `applyReceipt`,
`applyBillPayment` and friends are pure functions over the data. The mock API validates with the same
`*Problem` functions and applies the same reducers. They're generic over the data shape, so the server
can pass the whole workspace through `applyMatch` and get the whole workspace back. With a real backend
these would be the backend's own rules, and I'd keep only the reconciliation ones on the client for the
optimistic path.

**Two kinds of writes, on purpose.**
- *Reconciliation* actions are **optimistic with Undo**. People clear dozens of lines in a row and
  shouldn't wait for each one, and the result is easy to predict locally.
- *Receipts, invoices, bills, approvals, settings* **wait for the server**. They create records with
  server-side numbers (`RCT/152`, `INV-1043`) and touch several modules at once, so guessing locally
  isn't worth the risk. The dialog stays open and shows the server's error if it refuses.

**Cross-module consistency comes from query invalidation, not shared client state.** Each resource
(reconciliation, invoices, bills, parties, activity, settings) is its own React Query cache entry,
like separate REST endpoints. A write lists the resources it affects (`useServerMutation(fn, [invoices,
reconciliation])`) and those refetch. No global store needed.

**Where state lives:**

| State | Where | Why |
| --- | --- | --- |
| Server data | React Query | caching, loading/error flags, refetch, rollback |
| List filters, tabs, sort, open drawer, current report | URL | shareable, survives refresh, back button works |
| Theme | Context + localStorage | needed by the topbar and settings page |
| Form fields, selection, open dialogs | `useState` | nobody else needs it |

**The matcher is greedy and explainable.** Every (bank line, book entry) pair gets a score from amount,
date gap, reference and party name. Pairs are taken best-first, so one book entry is never suggested
twice. It isn't an optimal assignment (Hungarian algorithm), but every suggestion comes with its
reasons. In finance, people won't accept a match they can't explain. Tolerance and date window come
from Settings.

**The BRS is built to tie out.** It starts from the book balance and adds or subtracts each category of
difference (cheques not presented, receipts not credited, bank-only items, TDS short payments). A test
checks it ties out to the bank balance on the full demo data, so a bug in any reducer would show up there.

**Money is compared in paise.** `0.1 + 0.2 !== 0.3` shouldn't decide whether a ₹25,000 receipt matches.

**Generic pieces stayed small.** `Table<T>` takes column definitions, `Loader` handles
loading/error/retry for any set of queries, `useUrlState` turns a defaults object into URL-backed list
state. Every list page is built from the same four or five parts, so they behave the same.

## Libraries

| Library | Why |
| --- | --- |
| React 18 + TypeScript + Vite | Standard and fast. Strict TS makes the domain model self-documenting |
| TanStack Query | Server state, caching, invalidation, optimistic updates and rollback |
| React Router | Nested routes (drawer, report tabs) and URL search params |
| Radix Dialog | Focus trap, Esc, scroll lock and aria wiring for dialogs, the drawer and the palette |
| CSS Modules + CSS variables | Scoped styles with no runtime cost. Light/dark from one set of tokens |
| Vitest + Testing Library + jest-axe | Fast, tests behaviour rather than implementation, automated a11y check |

**Left out on purpose:** a chart library (a few CSS bars plus an `sr-only` data table are lighter and
more accessible), a component library (the brief is about component design), a global store (see
above), and MSW (see tradeoffs).

## Accessibility

- Status is never shown by colour alone: badges have text, amounts carry +/−, overdue says "overdue".
- Native `<select>`, checkboxes, radios and `<table>`s. Visible labels on every input.
- Dialogs, drawer and palette come from Radix (focus trap, Esc, focus returns).
- The palette is a proper combobox (`aria-activedescendant`, arrow keys, Enter).
- On phones the sidebar slides in, and is hidden from the tab order while closed.
- Result counts and toasts are announced. The cash flow chart has a hidden data table.
- Skip link, visible focus ring, `prefers-reduced-motion` and `prefers-color-scheme` respected.
- `jest-axe` runs against the overview and the reconciliation workbench.

## Testing

```
lib/matching.test.ts       scoring rules, tolerance, float safety, no double suggestions
lib/reconcile.test.ts      split matches, validation, immutability, reopen/exclude
lib/filters.test.ts        URL parsing (junk → defaults), round-trip, search, sort, buckets
lib/receivables.test.ts    invoice status, oldest-first allocation, receipt from a bank line
lib/payables.test.ts       duplicate bills, approval rules, payment matched to a debit
lib/reports.test.ts        BRS walk + ties out on demo data, aging buckets, statement of
                           account (both sides), exclusion rules
WorkbenchPage.test.tsx     loading, search + empty state, load error + retry, accept + undo,
                           rollback on failed save, age filter, axe
LineDrawer.test.tsx        match/unmatch, exclude validation, close keeps filters, unknown id
modules.test.tsx           receipt from an unbooked bank line, bill approval, URL filters,
                           command palette, unknown invoice, axe on the overview
```

The integration tests render the real app (providers, router, mock API) and interact the way a
user would, by role and label.

## Assumptions and tradeoffs

- **One company, one bank account, one currency (INR), one user.** No auth or roles; "approval" is a
  step, not a permission. Real approvals would need limits per approver.
- **Receipts apply oldest invoice first**, and anything left over is an advance. No credit notes,
  no partial bill payments, no GST breakup. These are real features, but not the point of the exercise.
- **Everything is filtered client-side.** Fine for hundreds of records. At thousands, filtering moves
  to the server, `useUrlState` values become API query params, and long lists get virtualised.
- **Suggestions are recomputed on every change.** O(lines × entries), trivial here and memoised.
  A real system would score at statement import.
- **Mock API instead of MSW.** Simpler, but no real HTTP in the app or tests. MSW would be my first
  change once there's a real API contract.
- **Concurrent optimistic writes:** if two reconciliation saves are in flight and the first fails,
  its rollback snapshot can briefly undo the second until the reply lands. Acceptable for one user;
  for a shared workspace I'd invalidate and refetch on error instead.
- **Code splitting is per module, not finer.** Each page is its own chunk and the shared shell is about
  96 KB gzipped, mostly React, React Query and Radix. Going further (e.g. splitting the dialogs out of
  the pages) would add loading states for very little gain at this size.

## What I'd do next

1. **Statement import** (CSV / MT940) and a period selector, since the data is seeded today.
2. **Split suggestions:** propose 2–3 open receipts from the same party that sum to a bank credit.
3. **Learn rules from history:** "you've excluded `CHRGS*` as bank charges six times, make it a rule?"
4. **Payment reminders** from the receivables list, using the statement of account as the attachment.
5. **Period close:** lock the month at a zero BRS difference and export it as PDF.
6. **Roles and approval limits** in payables.
7. **Server-side filtering and pagination**, and a virtualised statement for large accounts.
8. **Playwright E2E** for the cross-module flow above, and visual checks on the phone layout.

If it grew into a real product: typed API clients generated from OpenAPI, Storybook for `components/`,
and server-sent updates so two people don't reconcile the same line at once.
