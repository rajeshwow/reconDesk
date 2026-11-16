import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, type Location } from 'react-router-dom'
import { Providers } from '@/app/Providers'
import { AppRoutes, routerFuture } from '@/app/routes'

export function renderApp(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let current: Location | undefined

  function LocationSpy() {
    current = useLocation()
    return null
  }

  return {
    user: userEvent.setup(),
    location: () => current!,
    ...render(
      <Providers client={client}>
        <MemoryRouter initialEntries={[path]} future={routerFuture}>
          <AppRoutes />
          <LocationSpy />
        </MemoryRouter>
      </Providers>,
    ),
  }
}
