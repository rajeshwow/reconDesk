import { screen, within } from '@testing-library/react'
import { createSeed } from '@/api/seed'
import { rankCandidates } from '@/lib/matching'
import { renderApp } from '@/test/renderApp'

const seed = createSeed()
const lineWithCandidates = seed.bankLines.find(
  (line) => line.status === 'open' && rankCandidates(line, seed.ledger).length > 0,
)!

async function openDrawer(lineId = lineWithCandidates.id) {
  const app = renderApp(`/reconciliation/lines/${lineId}`)
  const drawer = await screen.findByRole('dialog')
  return { ...app, drawer }
}

describe('Line drawer', () => {
  it('matches a line to a suggested book entry, then unmatches it', async () => {
    const { user, drawer } = await openDrawer()

    await user.click(within(drawer).getAllByRole('button', { name: /^match with/i })[0])

    expect(await within(drawer).findByRole('heading', { name: 'Matched to' })).toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: 'Unmatch' }))
    expect(
      await within(drawer).findByRole('heading', { name: 'Likely matches in the books' }),
    ).toBeInTheDocument()
  })

  it('requires a note when excluding for "Other"', async () => {
    const { user, drawer } = await openDrawer()

    await user.click(within(drawer).getByRole('button', { name: 'Exclude' }))
    const dialog = await screen.findByRole('dialog', { name: 'Exclude this line?' })

    await user.click(within(dialog).getByRole('radio', { name: 'Other' }))
    await user.click(within(dialog).getByRole('button', { name: 'Exclude line' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/add a short note/i)

    await user.type(
      within(dialog).getByRole('textbox', { name: /note/i }),
      'Director loan, not ours',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Exclude line' }))

    expect(await within(drawer).findByText('Other: Director loan, not ours')).toBeInTheDocument()
  })

  it('closes back to the workbench and keeps the filters', async () => {
    const app = renderApp(`/reconciliation/lines/${lineWithCandidates.id}?direction=in`)
    await screen.findByRole('dialog')

    await app.user.keyboard('{Escape}')

    expect(app.location().pathname).toBe('/reconciliation')
    expect(app.location().search).toBe('?direction=in')
  })

  it('handles a link to a line that does not exist', async () => {
    const { drawer } = await openDrawer('B-0000')
    expect(within(drawer).getByText('We couldn’t find that bank line')).toBeInTheDocument()
  })
})
