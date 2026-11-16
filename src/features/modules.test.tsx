import { screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { createSeed } from '@/api/seed'
import { guessParty, rankCandidates } from '@/lib/matching'
import { balanceDue } from '@/lib/receivables'
import { toPaise } from '@/lib/format'
import { renderApp } from '@/test/renderApp'

// The seed has a few customer payments that only the bank knows about. Find one whose
// amount matches an open invoice exactly, so the dialog can pre-select it.
const seed = createSeed()
const customers = seed.parties.filter((p) => p.kind === 'customer')
const unbooked = seed.bankLines.find(
  (line) =>
    line.status === 'open' &&
    line.direction === 'in' &&
    rankCandidates(line, seed.ledger).length === 0 &&
    seed.invoices.some(
      (i) =>
        i.partyId === guessParty(line.narration, customers)?.id &&
        toPaise(balanceDue(i)) === toPaise(line.amount),
    ),
)!
const invoice = seed.invoices.find(
  (i) =>
    i.partyId === guessParty(unbooked.narration, customers)?.id &&
    toPaise(balanceDue(i)) === toPaise(unbooked.amount),
)!

describe('Modules working together', () => {
  it('posts a receipt from an unbooked bank line and matches it straight away', async () => {
    const { user } = renderApp(`/reconciliation/lines/${unbooked.id}`)
    const drawer = await screen.findByRole('dialog')

    await user.click(within(drawer).getByRole('button', { name: 'Record customer receipt' }))
    const dialog = await screen.findByRole('dialog', { name: 'Record customer receipt' })
    expect(within(dialog).getByRole('checkbox', { name: new RegExp(invoice.id) })).toBeChecked()

    await user.click(within(dialog).getByRole('button', { name: 'Record receipt' }))

    expect(await within(drawer).findByRole('heading', { name: 'Matched to' })).toBeInTheDocument()
    expect(await screen.findByText(/recorded and matched/)).toBeInTheDocument()
  })

  it('approves a bill and takes it off the approval list', async () => {
    const { user } = renderApp('/payables?status=awaiting_approval')
    await screen.findByRole('heading', { name: 'Payables' })
    const approveButtons = () => screen.queryAllByRole('button', { name: /^approve bill/i })
    const before = approveButtons().length
    expect(before).toBeGreaterThan(0)

    await user.click(approveButtons()[0])

    await waitFor(() => expect(approveButtons()).toHaveLength(before - 1))
    expect(screen.getByText('Bill approved')).toBeInTheDocument()
  })

  it('keeps list filters in the URL', async () => {
    const { user, location } = renderApp('/receivables')
    await screen.findByRole('heading', { name: 'Receivables' })

    await user.click(screen.getByRole('button', { name: /^overdue/i }))
    await user.type(screen.getByRole('searchbox', { name: 'Search invoices' }), 'kaveri')

    expect(location().search).toBe('?status=overdue&q=kaveri')
  })

  it('finds things from the command palette', async () => {
    const { user, location } = renderApp('/')
    await screen.findByRole('heading', { name: 'Overview' })

    await user.keyboard('{Control>}k{/Control}')
    await user.type(await screen.findByRole('combobox', { name: 'Search' }), invoice.id)
    await user.keyboard('{Enter}')

    expect(location().pathname).toBe(`/receivables/${invoice.id}`)
    expect(await screen.findByRole('heading', { name: invoice.id })).toBeInTheDocument()
  })

  it('shows a friendly message for an invoice that does not exist', async () => {
    renderApp('/receivables/INV-0000')
    expect(await screen.findByText('We couldn’t find that invoice')).toBeInTheDocument()
  })

  it('has no detectable accessibility problems on the overview', async () => {
    const { container } = renderApp('/')
    await screen.findByRole('heading', { name: 'Needs your attention' })
    expect(await axe(container)).toHaveNoViolations()
  }, 40_000)
})
