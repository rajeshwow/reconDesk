import { screen, waitFor, within } from '@testing-library/react'
import { axe } from 'jest-axe'
import { mockControls } from '@/api/mockApi'
import { renderApp } from '@/test/renderApp'

const acceptButtons = () => screen.queryAllByRole('button', { name: /^accept match with/i })

describe('Workbench', () => {
  it('shows a loading state, then the statement', async () => {
    renderApp('/reconciliation')

    expect(await screen.findByText(/loading the reconciliation/i)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Bank reconciliation' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Bank lines' })).getAllByRole('listitem').length,
    ).toBeGreaterThan(0)
  })

  it('narrows the list as you search and offers a way out when nothing matches', async () => {
    const { user, location } = renderApp('/reconciliation')
    const search = await screen.findByRole('searchbox', { name: 'Search' })

    await user.type(search, 'no such payment')

    expect(await screen.findByText('No bank lines match these filters')).toBeInTheDocument()
    expect(location().search).toBe('?q=no+such+payment')

    await user.click(screen.getByRole('button', { name: 'Show all lines' }))
    expect(screen.getByRole('list', { name: 'Bank lines' })).toBeInTheDocument()
  })

  it('shows an error with a retry when loading fails', async () => {
    mockControls.failLoad = true
    const { user } = renderApp('/reconciliation')

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load the reconciliation')

    mockControls.failLoad = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Bank reconciliation' })).toBeInTheDocument()
  })

  it('accepting a suggestion reconciles the line and offers undo', async () => {
    const { user } = renderApp('/reconciliation')
    await screen.findByRole('heading', { name: 'Bank reconciliation' })
    const before = acceptButtons().length

    await user.click(acceptButtons()[0])

    expect(acceptButtons()).toHaveLength(before - 1)
    const toast = await within(screen.getByRole('status')).findByText('Matched')
    expect(toast.parentElement).toContainElement(screen.getByRole('button', { name: 'Undo' }))

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(acceptButtons()).toHaveLength(before))
  })

  it('rolls back an optimistic update when the save fails', async () => {
    mockControls.failSave = true
    const { user } = renderApp('/reconciliation')
    await screen.findByRole('heading', { name: 'Bank reconciliation' })
    const before = acceptButtons().length

    await user.click(acceptButtons()[0])

    expect(await screen.findByText(/couldn’t save/i)).toBeInTheDocument()
    expect(acceptButtons()).toHaveLength(before)
  })

  it('filters by age when a bar is clicked', async () => {
    const { user, location } = renderApp('/reconciliation')
    await screen.findByRole('heading', { name: 'Bank reconciliation' })

    const bar = screen.getByRole('button', { name: /over 30 days/i })
    await user.click(bar)

    expect(bar).toHaveAttribute('aria-pressed', 'true')
    expect(location().search).toContain('age=30%2B')
  })

  it('has no detectable accessibility problems', async () => {
    const { container } = renderApp('/reconciliation')
    await screen.findByRole('heading', { name: 'Bank reconciliation' })
    expect(await axe(container)).toHaveNoViolations()
  }, 40_000)
})
