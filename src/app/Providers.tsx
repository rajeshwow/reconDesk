import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/Toast'
import { ReconActionsProvider } from '@/features/reconciliation/ReconActionsProvider'
import { ThemeProvider } from './theme'

const defaultClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000, refetchOnWindowFocus: false },
  },
})

export function Providers({
  children,
  client = defaultClient,
}: {
  children: ReactNode
  client?: QueryClient
}) {
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <ToastProvider>
          <ReconActionsProvider>{children}</ReconActionsProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
