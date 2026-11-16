import { lazy, type ComponentType } from 'react'
import { Navigate, useRoutes, type RouteObject } from 'react-router-dom'
import { Layout } from './Layout'
import { NotFound } from './NotFound'

// Each module is its own chunk, downloaded the first time someone opens it. Someone who
// only works in Payables never downloads the reconciliation workbench.
function lazyPage<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }))
}

const OverviewPage = lazyPage(() => import('@/features/overview/OverviewPage'), 'OverviewPage')
const WorkbenchPage = lazyPage(
  () => import('@/features/reconciliation/workbench/WorkbenchPage'),
  'WorkbenchPage',
)
const LineDrawer = lazyPage(
  () => import('@/features/reconciliation/line-detail/LineDrawer'),
  'LineDrawer',
)
const ReceivablesPage = lazyPage(
  () => import('@/features/receivables/ReceivablesPage'),
  'ReceivablesPage',
)
const InvoicePage = lazyPage(() => import('@/features/receivables/InvoicePage'), 'InvoicePage')
const PayablesPage = lazyPage(() => import('@/features/payables/PayablesPage'), 'PayablesPage')
const BillPage = lazyPage(() => import('@/features/payables/BillPage'), 'BillPage')
const PartiesPage = lazyPage(() => import('@/features/parties/PartiesPage'), 'PartiesPage')
const PartyPage = lazyPage(() => import('@/features/parties/PartyPage'), 'PartyPage')
const ReportsPage = lazyPage(() => import('@/features/reports/ReportsPage'), 'ReportsPage')
const BrsReport = lazyPage(() => import('@/features/reports/BrsReport'), 'BrsReport')
const ReceivablesAging = lazyPage(
  () => import('@/features/reports/AgingReport'),
  'ReceivablesAging',
)
const PayablesAging = lazyPage(() => import('@/features/reports/AgingReport'), 'PayablesAging')
const ActivityPage = lazyPage(() => import('@/features/activity/ActivityPage'), 'ActivityPage')
const SettingsPage = lazyPage(() => import('@/features/settings/SettingsPage'), 'SettingsPage')

const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <OverviewPage /> },
      {
        // The drawer is a child route, so the workbench stays mounted behind it and keeps
        // its scroll position and selection while a line's details are open.
        path: '/reconciliation',
        element: <WorkbenchPage />,
        children: [{ path: 'lines/:lineId', element: <LineDrawer /> }],
      },
      { path: '/receivables', element: <ReceivablesPage /> },
      { path: '/receivables/:invoiceId', element: <InvoicePage /> },
      { path: '/payables', element: <PayablesPage /> },
      { path: '/payables/:billId', element: <BillPage /> },
      { path: '/parties', element: <PartiesPage /> },
      { path: '/parties/:partyId', element: <PartyPage /> },
      {
        path: '/reports',
        element: <ReportsPage />,
        children: [
          { index: true, element: <Navigate to="brs" replace /> },
          { path: 'brs', element: <BrsReport /> },
          { path: 'receivables-aging', element: <ReceivablesAging /> },
          { path: 'payables-aging', element: <PayablesAging /> },
        ],
      },
      { path: '/activity', element: <ActivityPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]

export function AppRoutes() {
  return useRoutes(routes)
}

export const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true }
