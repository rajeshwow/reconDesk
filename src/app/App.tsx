import { BrowserRouter } from 'react-router-dom'
import { Providers } from './Providers'
import { AppRoutes, routerFuture } from './routes'

export function App() {
  return (
    <Providers>
      <BrowserRouter future={routerFuture}>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  )
}
